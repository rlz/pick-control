import { useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { getAudioCalibration, Metronome, listenForOnsets, playRhythmPattern } from '../audio'
import { signatures } from '../domain/exercise'
import { exerciseStore } from '../store/exerciseStore'
import {
    appendHit, appendHistoricalHit, appendLoopRun, replaceHits, resetSession,
    sessionStore, setActiveBpm, setActivePosition, setCalibrationOpen, setCountInBeat,
    setPreviewing, setSessionPhase, setTempoOpen, selectMeasure, type CompletedLoopRun,
} from '../store/sessionStore'
import type { ExerciseNote, PlayerHit, TimeSignature } from '../types'

const currentTime = () => performance.now()

type Options = {
    bpm: number
    measures: number
    signature: TimeSignature
    tempoCeiling: number
    tempoStep: number
    tempoProgram: typeof exerciseStore.tempoProgram
    exercise: ExerciseNote[]
}

export function useSessionController({ bpm, measures, signature, tempoCeiling, tempoStep, tempoProgram, exercise }: Options) {
    const storedSession = useSnapshot(sessionStore)
    const state = storedSession.phase
    const { activeBpm, previewing } = storedSession
    const [isLooping, setIsLooping] = useState(() => tempoProgram !== 'steady')
    const isTempoLoop = tempoProgram !== 'steady'
    const spec = signatures[signature]
    const displayedBpm = activeBpm ?? bpm
    const measureMs = (60000 / displayedBpm) * spec.beats
    const countInBeats = Number(signature.split('/')[0])
    const exerciseBeats = spec.beats * measures
    const cleanup = useRef<null | (() => void)>(null)
    const recordingRequest = useRef(0)
    const metronome = useRef(new Metronome())
    const startedAt = useRef(0)
    const hitsRef = useRef<PlayerHit[]>([])
    const timer = useRef<number | null>(null)
    const isLoopingRef = useRef(tempoProgram !== 'steady')
    useEffect(() => { isLoopingRef.current = isLooping }, [isLooping])
    const tempoRun = useRef<{
        bpm: number
        baseBpm: number
        ceiling: number
        step: number
        program: typeof tempoProgram
        returning: boolean
    } | null>(null)
    const activeRunMs = useRef(0)
    const previewStop = useRef<null | (() => void)>(null)
    const previewTimer = useRef<number | null>(null)
    const progressFrame = useRef<number | null>(null)
    const previewRequest = useRef(0)
    function stopForInteraction() {
        if (state === 'count-in' || state === 'playing') reset(false)
    }

    // A screen wake lock is released whenever the document becomes hidden.
    // Keep it requested for the complete run (including the count-in), and
    // request it again when the player returns to the app.
    useEffect(() => {
        const keepScreenAwake = state === 'count-in' || state === 'playing'
        if (!keepScreenAwake || !('wakeLock' in navigator)) return

        let cancelled = false
        let wakeLock: WakeLockSentinel | null = null

        const release = () => {
            if (!wakeLock) return
            const sentinel = wakeLock
            wakeLock = null
            void sentinel.release()
        }

        const requestWakeLock = async () => {
            if (cancelled || wakeLock || document.visibilityState !== 'visible') return

            try {
                const sentinel = await navigator.wakeLock.request('screen')
                if (cancelled || document.visibilityState !== 'visible') {
                    void sentinel.release()
                    return
                }
                wakeLock = sentinel
                sentinel.addEventListener('release', () => {
                    if (wakeLock === sentinel) wakeLock = null
                })
            } catch {
                // Wake Lock is optional: unsupported browsers and denied requests
                // should not prevent an exercise from running.
            }
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') void requestWakeLock()
        }

        void requestWakeLock()
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            cancelled = true
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            release()
        }
    }, [state])

    useEffect(
        () => () => {
            recordingRequest.current++
            cleanup.current?.()
            metronome.current.stop()
            if (timer.current) clearTimeout(timer.current)
            previewStop.current?.()
            if (previewTimer.current) clearTimeout(previewTimer.current)
            if (progressFrame.current) cancelAnimationFrame(progressFrame.current)
        },
        [],
    )
    function reset(clearLoopHistory = true) {
        if (!clearLoopHistory) saveActiveRun()
        recordingRequest.current++
        stopPreview()
        cleanup.current?.()
        cleanup.current = null
        metronome.current.stop()
        if (timer.current) clearTimeout(timer.current)
        resetSession(clearLoopHistory)
        hitsRef.current = []
        tempoRun.current = null
        activeRunMs.current = 0
        startedAt.current = 0
    }
    function addLoopRun(run: CompletedLoopRun) {
        appendLoopRun({ ...run, hits: [...run.hits] })
    }
    function saveActiveRun() {
        if (startedAt.current <= 0 || activeRunMs.current <= 0) return

        const duration = Math.min(
            activeRunMs.current,
            Math.max(0, currentTime() - startedAt.current),
        )
        if (duration <= 0) return

        const measureMs = activeRunMs.current / measures
        addLoopRun({
            startedAt: startedAt.current,
            duration,
            measureMs,
            bpm: tempoRun.current?.bpm ?? activeBpm ?? bpm,
            hits: hitsRef.current.filter((hit) => hit.time < duration),
        })
    }
    function stopPreview() {
        previewRequest.current++
        previewStop.current?.()
        previewStop.current = null
        if (previewTimer.current) clearTimeout(previewTimer.current)
        if (progressFrame.current) cancelAnimationFrame(progressFrame.current)
        progressFrame.current = null
        previewTimer.current = null
        setPreviewing(null)
        if (state !== 'playing') {
            setActivePosition(-1, -1)
        }
    }
    function showProgress(
        startAt: number,
        measureStart: number,
        measureCount: number,
        currentMeasureMs = measureMs,
    ) {
        const update = () => {
            const elapsed = performance.now() - startAt
            if (elapsed < 0) {
                progressFrame.current = requestAnimationFrame(update)
                return
            }
            const measureOffset = Math.min(Math.floor(elapsed / currentMeasureMs), measureCount - 1)
            const elapsedInMeasure = elapsed - measureOffset * currentMeasureMs
            setActivePosition(
                measureStart + measureOffset,
                Math.min(spec.slots - 1, Math.floor((elapsedInMeasure / currentMeasureMs) * spec.slots)),
            )
            if (elapsed < measureCount * currentMeasureMs) {
                progressFrame.current = requestAnimationFrame(update)
            }
        }
        progressFrame.current = requestAnimationFrame(update)
    }
    async function previewPattern(measure?: number, notes = exercise) {
        stopForInteraction()
        setTempoOpen(false)
        const target = measure ?? 'all'
        if (previewing === target) {
            stopPreview()
            return
        }
        stopPreview()
        const requestId = ++previewRequest.current
        const measureCount = measure === undefined ? measures : 1
        setPreviewing(target)
        setActivePosition(measure ?? 0, -1)
        try {
            const preview = await playRhythmPattern(
                notes,
                bpm,
                spec.beats,
                spec.slots,
                measure ?? 0,
                measureCount,
            )
            // The user may have stopped the preview while the soundfont was loading.
            if (previewRequest.current !== requestId) {
                preview.stop()
                return
            }
            previewStop.current = preview.stop
            showProgress(preview.startsAt, measure ?? 0, measureCount)
        } catch {
            setPreviewing(null)
            setActivePosition(-1, -1)
            alert('Could not load the guitar preview sound.')
            return
        }
        previewTimer.current = window.setTimeout(stopPreview, 80 + measureCount * measureMs + 170)
    }
    async function startExercise() {
        reset()
        selectMeasure(null)
        const request = ++recordingRequest.current
        setCalibrationOpen(false)
        setTempoOpen(false)
        tempoRun.current = {
            bpm,
            baseBpm: bpm,
            ceiling: Math.max(bpm, tempoCeiling),
            step: tempoStep,
            program: tempoProgram,
            returning: false,
        }
        setActiveBpm(bpm)
        setSessionPhase('count-in')
        try {
            const calibration = getAudioCalibration()
            const stopListening = await listenForOnsets(
                (strength, detectedAt) => {
                    const calibrationLatency = calibration?.latencyMs ?? 0
                    const historicalRunIndex = sessionStore.loopRuns.findIndex(
                        (run) => detectedAt >= run.startedAt && detectedAt < run.startedAt + run.duration,
                    )
                    const historicalRun = sessionStore.loopRuns[historicalRunIndex]
                    if (historicalRun) {
                        appendHistoricalHit(historicalRunIndex, {
                            time: detectedAt - historicalRun.startedAt - calibrationLatency,
                            strength,
                        })
                        return
                    }
                    const detectedTime = detectedAt - startedAt.current - calibrationLatency
                    // The first audio block can begin a few milliseconds before
                    // the visual zero after latency correction. Keep that attack
                    // and pin it to the first beat instead of silently dropping it.
                    if (
                        startedAt.current > 0 &&
                        detectedTime >= -120 &&
                        detectedTime < activeRunMs.current
                    ) {
                        const hit = { time: Math.max(0, detectedTime), strength }
                        appendHit(hit)
                        hitsRef.current = [...hitsRef.current, hit]
                    }
                },
                {
                    deviceId: calibration?.deviceId || undefined,
                    detector: calibration?.detector,
                    isDetecting: () => startedAt.current > 0,
                },
            )
            if (request !== recordingRequest.current) {
                stopListening()
                return
            }
            cleanup.current = stopListening
            metronome.current.start(
                () => 60000 / (tempoRun.current?.bpm ?? bpm),
                (beat, playedAt) => {
                    if (request !== recordingRequest.current) return
                    if (beat < countInBeats) {
                        setCountInBeat(beat + 1)
                    } else if (beat === countInBeats) {
                        beginRecording(request, playedAt)
                    }
                    if (beat - countInBeats === exerciseBeats - 1) {
                        metronome.current.stop()
                    }
                },
            )
        } catch {
            if (request !== recordingRequest.current) return
            setSessionPhase('ready')
            alert('Microphone permission is needed to listen to your playing.')
        }
    }
    function beginRecording(request: number, playedAt = currentTime()) {
        startedAt.current = playedAt
        setSessionPhase('playing')
        showProgress(startedAt.current, 0, measures)
        scheduleExerciseEnd(tempoRun.current?.bpm ?? bpm, request)
    }
    function startWorkingMetronome(request: number) {
        let firstBeatAt = 0
        metronome.current.start(
            () => 60000 / (tempoRun.current?.bpm ?? bpm),
            (beat, playedAt) => {
                if (request !== recordingRequest.current) return
                if (beat === 0) firstBeatAt = playedAt
                if (beat === exerciseBeats - 1) metronome.current.stop()
            },
        )
        return firstBeatAt
    }
    function scheduleExerciseEnd(runBpm: number, request: number) {
        const runMs = (60000 / runBpm) * spec.beats * measures
        activeRunMs.current = runMs
        timer.current = window.setTimeout(() => {
            const nextBpm = nextTempoBpm()
            if (
                nextBpm !== null &&
                (isLoopingRef.current || tempoRun.current?.program === 'increase-and-return')
            ) {
                if (request !== recordingRequest.current) return
                metronome.current.stop()
                addLoopRun({
                    startedAt: startedAt.current,
                    duration: runMs,
                    measureMs: runMs / measures,
                    bpm: runBpm,
                    hits: hitsRef.current,
                })
                hitsRef.current = []
                replaceHits([])
                startedAt.current = startWorkingMetronome(request)
                setActivePosition(0, -1)
                setActiveBpm(nextBpm)
                showProgress(startedAt.current, 0, measures, (60000 / nextBpm) * spec.beats)
                scheduleExerciseEnd(nextBpm, request)
                return
            }
            metronome.current.stop()
            // Keep the microphone alive long enough to drain the detector's
            // one-second analysis buffer, so final notes can still be scored.
            const stopListening = cleanup.current
            window.setTimeout(() => stopListening?.(), 1050)
            if (progressFrame.current) cancelAnimationFrame(progressFrame.current)
            setSessionPhase('finished')
            setActivePosition(-1, -1)
            setActiveBpm(null)
            tempoRun.current = null
        }, runMs + 30)
    }
    function nextTempoBpm() {
        const run = tempoRun.current
        if (!run) return null
        if (run.program === 'increase-and-return') {
            if (!run.returning && run.bpm >= run.ceiling) run.returning = true
            if (run.returning) {
                if (run.bpm <= run.baseBpm) {
                    return null
                } else {
                    run.bpm = Math.max(run.baseBpm, run.bpm - run.step)
                }
            } else {
                run.bpm = Math.min(run.ceiling, run.bpm + run.step)
            }
        } else if (run.program === 'increase') {
            run.bpm = Math.min(run.ceiling, run.bpm + run.step)
        }
        return run.bpm
    }
    function forceLooping() { isLoopingRef.current = true; setIsLooping(true) }
    function toggleLooping() {
        if (isTempoLoop) return
        stopForInteraction()
        setIsLooping((previous) => {
            const next = !previous
            isLoopingRef.current = next
            return next
        })
    }
    const timingHits = (source: PlayerHit[], i: number, sourceMeasureMs = measureMs) => {
        const edgeAllowanceMs = 120
        const measureStart = i * sourceMeasureMs
        const measureEnd = (i + 1) * sourceMeasureMs
        return source.filter(
            (hit) => hit.time >= measureStart - edgeAllowanceMs && hit.time < measureEnd,
        )
    }
    return { isLooping, forceLooping, isTempoLoop, displayedBpm, measureMs, countInBeats, stopForInteraction, reset, stopPreview, previewPattern, startExercise, toggleLooping, timingHits }
}
