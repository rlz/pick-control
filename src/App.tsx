import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faGear,
    faMicrophone,
    faPlay,
    faRepeat,
    faRotateRight,
    faStop,
    faVolumeHigh,
} from '@fortawesome/free-solid-svg-icons'
import { useSnapshot } from 'valtio'
import { getAudioCalibration, Metronome, listenForOnsets, playRhythmPattern } from './audio'
import { Measure } from './components/Measure'
import { MeasureEditor } from './components/MeasureEditor'
import { ExerciseSettingsModal } from './components/ExerciseSettingsModal'
import { AudioCalibrationModal } from './components/AudioCalibrationModal'
import { notesToSteps, notesToStrokes, stepsToNotes } from './domain/measureSteps'
import type { StepKind } from './domain/measureSteps'
import { TimingDetail } from './components/TimingDetail'
import { signatures } from './domain/exercise'
import type { GenerationOptions } from './domain/exercise'
import {
    exerciseStore,
    generateExerciseWithSettings,
    MAX_BPM,
    MIN_BPM,
    MAX_TEMPO_STEP,
    MIN_TEMPO_STEP,
    replaceMeasureNotes,
    setBpm,
    setPresetExercise,
    setTempoCeiling,
    setTempoProgram,
    setTempoStep,
} from './store/exerciseStore'
import type { ExerciseNote, PickStroke, PlayerHit, TimeSignature } from './types'
import { presetToExercise, type StickControlPreset } from './domain/stickControlPresets'

const currentTime = () => performance.now()

type CompletedLoopRun = {
    startedAt: number
    duration: number
    hits: PlayerHit[]
}

function rangeStyle(value: number, min: number, max: number): CSSProperties {
    return {
        '--range-value-position': `${((value - min) / (max - min)) * 100}%`,
    } as CSSProperties
}

function App() {
    const storedExercise = useSnapshot(exerciseStore)
    const { measures, generationOptions, signature, bpm, tempoCeiling, tempoProgram, tempoStep } =
        storedExercise
    const exercise: ExerciseNote[] = storedExercise.exercise.map((note) => ({ ...note }))
    const [hits, setHits] = useState<PlayerHit[]>([])
    const [loopRuns, setLoopRuns] = useState<PlayerHit[][]>([])
    const [state, setState] = useState<'ready' | 'count-in' | 'playing' | 'finished'>('ready')
    const [countInBeat, setCountInBeat] = useState(0)
    const [selectedMeasure, setSelectedMeasure] = useState<number | null>(null)
    const [activeSlot, setActiveSlot] = useState(-1)
    const [activeMeasure, setActiveMeasure] = useState(-1)
    const [previewing, setPreviewing] = useState<'all' | number | null>(null)
    const [isLooping, setIsLooping] = useState(() => tempoProgram !== 'steady')
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [tempoOpen, setTempoOpen] = useState(false)
    const [calibrationOpen, setCalibrationOpen] = useState(false)
    const [activeBpm, setActiveBpm] = useState<number | null>(null)
    const [editorMeasure, setEditorMeasure] = useState<number | null>(null)
    const [editorSteps, setEditorSteps] = useState<StepKind[]>([])
    const [editorStrokes, setEditorStrokes] = useState<(PickStroke | undefined)[]>([])
    const cleanup = useRef<null | (() => void)>(null)
    const recordingRequest = useRef(0)
    const metronome = useRef(new Metronome())
    const startedAt = useRef(0)
    const hitsRef = useRef<PlayerHit[]>([])
    const completedLoopRuns = useRef<CompletedLoopRun[]>([])
    const timer = useRef<number | null>(null)
    const isLoopingRef = useRef(tempoProgram !== 'steady')
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
    const notationScroll = useRef<HTMLDivElement>(null)
    const spec = signatures[signature]
    const displayedBpm = activeBpm ?? bpm
    const beatMs = 60000 / displayedBpm
    const measureMs = beatMs * spec.beats
    const countInBeats = Number(signature.split('/')[0])
    const exerciseBeats = spec.beats * measures
    const isTempoLoop = tempoProgram !== 'steady'

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
    useEffect(() => {
        if (activeMeasure < 0 || (state !== 'playing' && previewing === null)) return
        const measure = notationScroll.current?.querySelector<HTMLElement>(
            `[data-measure="${activeMeasure}"]`,
        )
        const scrollContainer = notationScroll.current
        if (!measure || !scrollContainer) return

        const measureTop =
            measure.getBoundingClientRect().top -
            scrollContainer.getBoundingClientRect().top +
            scrollContainer.scrollTop

        scrollContainer.scrollTo({
            top: Math.max(
                0,
                measureTop - scrollContainer.clientHeight / 2 + measure.clientHeight / 2,
            ),
            behavior: 'smooth',
        })
    }, [activeMeasure, previewing, state])
    function generateFromSettings(
        nextMeasures: number,
        nextOptions: GenerationOptions,
        nextSignature: TimeSignature,
    ) {
        if (state === 'count-in' || state === 'playing') return
        reset()
        generateExerciseWithSettings(nextMeasures, nextOptions, nextSignature)
        setSelectedMeasure(null)
        setSettingsOpen(false)
    }
    function reset(clearLoopHistory = true) {
        recordingRequest.current++
        stopPreview()
        cleanup.current?.()
        cleanup.current = null
        metronome.current.stop()
        if (timer.current) clearTimeout(timer.current)
        setHits([])
        hitsRef.current = []
        if (clearLoopHistory) {
            setLoopRuns([])
            completedLoopRuns.current = []
        }
        setState('ready')
        setCountInBeat(0)
        setActiveSlot(-1)
        setActiveMeasure(-1)
        setActiveBpm(null)
        tempoRun.current = null
        activeRunMs.current = 0
        startedAt.current = 0
    }
    function openMeasureEditor() {
        if (selectedMeasure === null || state === 'count-in' || state === 'playing') return
        stopPreview()
        const measureNotes = exercise.filter((note) => note.measure === selectedMeasure)
        setEditorSteps(notesToSteps(measureNotes, spec.slots))
        setEditorStrokes(notesToStrokes(measureNotes, spec.slots))
        setEditorMeasure(selectedMeasure)
    }
    function openExerciseSettings() {
        if (state === 'count-in' || state === 'playing') return
        stopPreview()
        setSettingsOpen(true)
    }
    function setEditorStroke(step: number, stroke: PickStroke) {
        setEditorStrokes((previous) => {
            const next = [...previous]
            next[step] = stroke
            return next
        })
    }
    function setEditorStep(step: number, kind: StepKind) {
        setEditorSteps((previous) => {
            const next = [...previous]
            next[step] = kind
            return next
        })
    }
    function saveMeasureEditor() {
        if (editorMeasure === null) return
        const replacement = stepsToNotes(editorSteps, editorMeasure, editorStrokes)
        replaceMeasureNotes(editorMeasure, replacement)
        setHits([])
        setEditorMeasure(null)
    }
    function saveManualMeasure(
        nextMeasures: number,
        nextSignature: TimeSignature,
        steps: StepKind[],
        strokes: (PickStroke | undefined)[],
    ) {
        if (state === 'count-in' || state === 'playing') return
        const replacement = stepsToNotes(steps, 0, strokes)
        exerciseStore.measures = nextMeasures
        exerciseStore.signature = nextSignature
        exerciseStore.exercise = Array.from({ length: nextMeasures }, (_, measure) =>
            replacement.map((note) => ({
                ...note,
                id: `${measure}-${note.position}`,
                measure,
            })),
        ).flat()
        setHits([])
        setSelectedMeasure(null)
    }
    function choosePreset(preset: StickControlPreset) {
        if (state === 'count-in' || state === 'playing') return
        reset()
        setPresetExercise(presetToExercise(preset))
        setSelectedMeasure(null)
        setSettingsOpen(false)
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
            setActiveMeasure(-1)
            setActiveSlot(-1)
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
            setActiveMeasure(measureStart + measureOffset)
            setActiveSlot(
                Math.min(
                    spec.slots - 1,
                    Math.floor((elapsedInMeasure / currentMeasureMs) * spec.slots),
                ),
            )
            if (elapsed < measureCount * currentMeasureMs) {
                progressFrame.current = requestAnimationFrame(update)
            }
        }
        progressFrame.current = requestAnimationFrame(update)
    }
    async function previewPattern(measure?: number, notes = exercise) {
        if (state === 'count-in' || state === 'playing') return
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
        setActiveMeasure(measure ?? 0)
        setActiveSlot(-1)
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
            setActiveMeasure(-1)
            setActiveSlot(-1)
            alert('Could not load the guitar preview sound.')
            return
        }
        previewTimer.current = window.setTimeout(stopPreview, 80 + measureCount * measureMs + 170)
    }
    async function startExercise() {
        reset()
        setSelectedMeasure(null)
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
        setState('count-in')
        try {
            const calibration = getAudioCalibration()
            const stopListening = await listenForOnsets(
                (strength, detectedAt) => {
                    const calibrationLatency = calibration?.latencyMs ?? 0
                    const historicalRun = completedLoopRuns.current.find(
                        (run) =>
                            detectedAt >= run.startedAt &&
                            detectedAt < run.startedAt + run.duration,
                    )
                    if (historicalRun) {
                        historicalRun.hits.push({
                            time: detectedAt - historicalRun.startedAt - calibrationLatency,
                            strength,
                        })
                        setLoopRuns(completedLoopRuns.current.map((run) => [...run.hits]))
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
                        setHits((previous) => {
                            const next = [...previous, hit]
                            hitsRef.current = next
                            return next
                        })
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
                (beat) => {
                    if (request !== recordingRequest.current) return
                    if (beat < countInBeats) {
                        setCountInBeat(beat + 1)
                    } else if (beat === countInBeats) {
                        beginRecording(request)
                    }
                    if (beat - countInBeats === exerciseBeats - 1) {
                        metronome.current.stop()
                    }
                },
            )
        } catch {
            if (request !== recordingRequest.current) return
            setState('ready')
            alert('Microphone permission is needed to listen to your playing.')
        }
    }
    function beginRecording(request: number) {
        startedAt.current = currentTime()
        setState('playing')
        showProgress(startedAt.current, 0, measures)
        scheduleExerciseEnd(tempoRun.current?.bpm ?? bpm, request)
    }
    function startWorkingMetronome(request: number) {
        metronome.current.start(
            () => 60000 / (tempoRun.current?.bpm ?? bpm),
            (beat) => {
                if (request !== recordingRequest.current) return
                if (beat === exerciseBeats - 1) metronome.current.stop()
            },
        )
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
                completedLoopRuns.current.push({
                    startedAt: startedAt.current,
                    duration: runMs,
                    hits: hitsRef.current,
                })
                setLoopRuns(completedLoopRuns.current.map((run) => [...run.hits]))
                hitsRef.current = []
                setHits([])
                startedAt.current = currentTime()
                setActiveMeasure(0)
                setActiveSlot(-1)
                setActiveBpm(nextBpm)
                showProgress(startedAt.current, 0, measures, (60000 / nextBpm) * spec.beats)
                startWorkingMetronome(request)
                scheduleExerciseEnd(nextBpm, request)
                return
            }
            metronome.current.stop()
            // Keep the microphone alive long enough to drain the detector's
            // one-second analysis buffer, so final notes can still be scored.
            const stopListening = cleanup.current
            window.setTimeout(() => stopListening?.(), 1050)
            if (progressFrame.current) cancelAnimationFrame(progressFrame.current)
            setState('finished')
            setActiveSlot(-1)
            setActiveMeasure(-1)
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
    function toggleLooping() {
        if (isTempoLoop) return
        setIsLooping((previous) => {
            const next = !previous
            isLoopingRef.current = next
            return next
        })
    }
    const measureHits = (i: number) =>
        hits.filter((hit) => hit.time >= i * measureMs && hit.time < (i + 1) * measureMs)
    const timingHits = (source: PlayerHit[], i: number) => {
        const edgeAllowanceMs = 120
        return source.filter(
            (hit) =>
                hit.time >= i * measureMs - edgeAllowanceMs &&
                hit.time <= (i + 1) * measureMs + edgeAllowanceMs,
        )
    }
    return (
        <main
            className={`grid h-dvh overflow-hidden bg-slate-950 text-slate-100 ${
                loopRuns.length
                    ? 'grid-rows-[3.5rem_minmax(0,1fr)_auto] md:grid-rows-[4rem_minmax(0,1fr)_auto]'
                    : 'grid-rows-[3.5rem_minmax(0,1fr)_5.5rem] md:grid-rows-[4rem_minmax(0,1fr)_6rem]'
            }`}
        >
            <header className="relative z-30 flex items-center overflow-visible border-b border-slate-800 bg-slate-900/90 px-5 backdrop-blur md:px-7">
                <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-indigo-300">
                    <span className="grid size-8 place-items-center rounded-lg bg-indigo-400/15 text-xl">
                        ◒
                    </span>
                    <span>TaktControl</span>
                </div>
                <h1 className="absolute left-1/2 m-0 hidden -translate-x-1/2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm font-medium text-slate-300 sm:block">
                    {signature} <span className="px-1 text-slate-500">·</span> {measures} measures
                </h1>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        className="header-control"
                        type="button"
                        onClick={() => setCalibrationOpen(true)}
                        aria-label="Открыть калибровку аудиовхода"
                        aria-expanded={calibrationOpen}
                    >
                        <FontAwesomeIcon icon={faMicrophone} />
                        <span>Калибровка</span>
                    </button>
                    <button
                        className="header-control"
                        type="button"
                        onClick={openExerciseSettings}
                        aria-label="Open exercise settings"
                        aria-expanded={settingsOpen}
                    >
                        <FontAwesomeIcon icon={faGear} />
                        <span>Exercise</span>
                    </button>
                    <div className="tempo-control">
                        <button
                            className="header-control"
                            type="button"
                            onClick={() => setTempoOpen((open) => !open)}
                            aria-expanded={tempoOpen}
                            aria-label="Change tempo"
                        >
                            <span className="tempo-value">{displayedBpm}</span>
                            <span>BPM</span>
                        </button>
                        {tempoOpen ? (
                            <div className="tempo-popover">
                                <label>
                                    Tempo <output>{displayedBpm} BPM</output>
                                    <input
                                        type="range"
                                        min={MIN_BPM}
                                        max={MAX_BPM}
                                        step="1"
                                        value={bpm}
                                        style={rangeStyle(bpm, MIN_BPM, MAX_BPM)}
                                        onChange={(event) => setBpm(Number(event.target.value))}
                                        disabled={state === 'count-in' || state === 'playing'}
                                    />
                                </label>
                                <label>
                                    Tempo program
                                    <select
                                        value={tempoProgram}
                                        onChange={(event) => {
                                            const nextProgram = event.target.value as typeof tempoProgram
                                            setTempoProgram(nextProgram)
                                            if (nextProgram !== 'steady') {
                                                isLoopingRef.current = true
                                                setIsLooping(true)
                                            }
                                        }}
                                        disabled={state === 'count-in' || state === 'playing'}
                                    >
                                        <option value="steady">Keep tempo</option>
                                        <option value="increase">Increase on each loop</option>
                                        <option value="increase-and-return">
                                            Increase, then return
                                        </option>
                                    </select>
                                </label>
                                {tempoProgram !== 'steady' ? (
                                    <>
                                        <label>
                                            Change per pass <output>{tempoStep} BPM</output>
                                            <input
                                                type="range"
                                                min={MIN_TEMPO_STEP}
                                                max={MAX_TEMPO_STEP}
                                                step="1"
                                                value={tempoStep}
                                                style={rangeStyle(
                                                    tempoStep,
                                                    MIN_TEMPO_STEP,
                                                    MAX_TEMPO_STEP,
                                                )}
                                                onChange={(event) =>
                                                    setTempoStep(Number(event.target.value))
                                                }
                                                disabled={
                                                    state === 'count-in' || state === 'playing'
                                                }
                                            />
                                        </label>
                                        <label>
                                            Maximum <output>{tempoCeiling} BPM</output>
                                            <input
                                                className="tempo-ceiling-slider"
                                                type="range"
                                                min={MIN_BPM}
                                                max={MAX_BPM}
                                                step="1"
                                                value={tempoCeiling}
                                                style={
                                                    {
                                                        ...rangeStyle(
                                                            tempoCeiling,
                                                            MIN_BPM,
                                                            MAX_BPM,
                                                        ),
                                                        '--tempo-minimum-position': `${
                                                            ((bpm - MIN_BPM) /
                                                                (MAX_BPM - MIN_BPM)) *
                                                            100
                                                        }%`,
                                                    } as CSSProperties
                                                }
                                                onChange={(event) =>
                                                    setTempoCeiling(Number(event.target.value))
                                                }
                                                disabled={
                                                    state === 'count-in' || state === 'playing'
                                                }
                                            />
                                        </label>
                                    </>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            </header>
            <div className="app-body grid min-h-0 overflow-hidden">
                <section
                    className="relative grid min-h-0 min-w-0 overflow-hidden bg-slate-950"
                    onClick={() => setTempoOpen(false)}
                >
                    <div className="notation-scroll p-5 md:p-7" ref={notationScroll}>
                        <div className="flex min-w-0 flex-wrap content-start pb-36">
                            {Array.from({ length: measures }, (_, index) => (
                                <Measure
                                    key={index}
                                    index={index}
                                    slots={spec.slots}
                                    signature={signature}
                                    notes={exercise.filter((n) => n.measure === index)}
                                    hits={measureHits(index)}
                                    measureMs={measureMs}
                                    selected={selectedMeasure === index}
                                    isActive={
                                        (state === 'playing' || previewing !== null) &&
                                        activeMeasure === index
                                    }
                                    activeSlot={
                                        (state === 'playing' || previewing !== null) &&
                                        activeMeasure === index
                                            ? activeSlot
                                            : -1
                                    }
                                    onClick={() =>
                                        setSelectedMeasure(selectedMeasure === index ? null : index)
                                    }
                                />
                            ))}
                        </div>
                    </div>
                    {state === 'count-in' ? (
                        <div
                            className="count-in-overlay"
                            aria-live="assertive"
                            aria-atomic="true"
                            role="status"
                        >
                            <span className="count-in-label">Get ready</span>
                            <strong className="count-in-beat" key={countInBeat}>
                                {countInBeat || 1}
                            </strong>
                            <span className="count-in-dots" aria-hidden="true">
                                {Array.from({ length: countInBeats }, (_, index) => (
                                    <i
                                        className={index < countInBeat ? 'is-complete' : ''}
                                        key={index}
                                    />
                                ))}
                            </span>
                        </div>
                    ) : null}
                </section>
            </div>
            <footer className="relative z-10 flex items-center justify-between gap-4 border-t border-slate-800 bg-slate-900 px-4 md:px-7">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    {selectedMeasure !== null ? (
                        <TimingDetail
                            measure={selectedMeasure}
                            notes={exercise.filter((n) => n.measure === selectedMeasure)}
                            hits={timingHits(hits, selectedMeasure)}
                            previousHits={loopRuns.map((run) =>
                                timingHits(run, selectedMeasure),
                            )}
                            slots={spec.slots}
                            beats={spec.beats}
                            measureMs={measureMs}
                            onPreview={() => previewPattern(selectedMeasure)}
                            isPreviewing={previewing === selectedMeasure}
                            onEdit={openMeasureEditor}
                            isEditingDisabled={state === 'count-in' || state === 'playing'}
                        />
                    ) : null}
                </div>
                <div className="flex items-end gap-3 border-l border-slate-700 pl-4">
                    <div className="flex flex-col items-center gap-1">
                        <button
                            className="icon-button"
                            type="button"
                            onClick={toggleLooping}
                            disabled={isTempoLoop}
                            aria-label={
                                isTempoLoop
                                    ? 'Loop is required by the tempo program'
                                    : isLooping
                                      ? 'Disable exercise loop'
                                      : 'Enable exercise loop'
                            }
                            aria-pressed={isLooping}
                            title={
                                isTempoLoop
                                    ? 'Loop is required by the tempo program'
                                    : isLooping
                                      ? 'Disable exercise loop'
                                      : 'Loop exercise'
                            }
                        >
                            <FontAwesomeIcon icon={faRepeat} />
                        </button>
                        <span className="text-[10px] font-medium text-slate-400">Loop</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <button
                            className="icon-button"
                            onClick={() => previewPattern()}
                            disabled={state === 'count-in' || state === 'playing'}
                            aria-label={
                                previewing === 'all' ? 'Stop full preview' : 'Preview exercise'
                            }
                            title={previewing === 'all' ? 'Stop preview' : 'Preview exercise'}
                        >
                            <FontAwesomeIcon icon={previewing === 'all' ? faStop : faVolumeHigh} />
                        </button>
                        <span className="text-[10px] font-medium text-slate-400">Listen</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <button
                            className="icon-button"
                            onClick={() => reset()}
                            disabled={state === 'ready'}
                            aria-label="Repeat exercise"
                            title="Repeat exercise"
                        >
                            <FontAwesomeIcon icon={faRotateRight} />
                        </button>
                        <span className="text-[10px] font-medium text-slate-400">Restart</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <button
                            className="icon-button primary"
                            onClick={
                                state === 'count-in' || state === 'playing'
                                    ? () => reset(false)
                                    : startExercise
                            }
                            aria-label={
                                state === 'count-in' || state === 'playing'
                                    ? 'Stop exercise'
                                    : state === 'finished'
                                      ? 'Play exercise again'
                                      : 'Start exercise'
                            }
                            title={
                                state === 'count-in' || state === 'playing'
                                    ? 'Stop exercise'
                                    : state === 'finished'
                                      ? 'Play exercise again'
                                      : 'Start exercise'
                            }
                        >
                            <FontAwesomeIcon
                                icon={state === 'count-in' || state === 'playing' ? faStop : faPlay}
                            />
                        </button>
                        <span className="text-[10px] font-semibold text-indigo-300">
                            {state === 'count-in' || state === 'playing' ? 'Stop' : 'Start'}
                        </span>
                    </div>
                </div>
            </footer>
            {editorMeasure !== null ? (
                <MeasureEditor
                    measure={editorMeasure}
                    signature={signature}
                    steps={editorSteps}
                    strokes={editorStrokes}
                    isPreviewing={previewing === editorMeasure}
                    onChange={setEditorStep}
                    onPreview={() =>
                        previewPattern(
                            editorMeasure,
                            stepsToNotes(editorSteps, editorMeasure, editorStrokes),
                        )
                    }
                    onStrokeChange={setEditorStroke}
                    onSave={saveMeasureEditor}
                    onClose={() => {
                        stopPreview()
                        setEditorMeasure(null)
                    }}
                />
            ) : null}
            {calibrationOpen ? (
                <AudioCalibrationModal onClose={() => setCalibrationOpen(false)} />
            ) : null}
            {settingsOpen ? (
                <ExerciseSettingsModal
                    measures={measures}
                    signature={signature}
                    options={generationOptions}
                    onClose={() => setSettingsOpen(false)}
                    manualSteps={notesToSteps(
                        exercise.filter((note) => note.measure === 0),
                        spec.slots,
                    )}
                    manualStrokes={notesToStrokes(
                        exercise.filter((note) => note.measure === 0),
                        spec.slots,
                    )}
                    isManualPreviewing={previewing === 0}
                    onManualPreview={(steps, strokes) =>
                        previewPattern(0, stepsToNotes(steps, 0, strokes))
                    }
                    onManualSave={saveManualMeasure}
                    onPreset={choosePreset}
                    onGenerate={generateFromSettings}
                />
            ) : null}
        </main>
    )
}

export default App
