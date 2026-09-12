import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faRotateRight, faStop } from '@fortawesome/free-solid-svg-icons'
import { useSnapshot } from 'valtio'
import { Metronome, listenForOnsets, playRhythmPattern } from './audio'
import { Measure } from './components/Measure'
import { TimingDetail } from './components/TimingDetail'
import { generateExercise, signatures } from './domain/exercise'
import { exerciseStore } from './store/exerciseStore'
import type { ExerciseNote, PlayerHit, TimeSignature } from './types'

function App() {
    const storedExercise = useSnapshot(exerciseStore)
    const { measures, difficulty, signature, bpm } = storedExercise
    const exercise: ExerciseNote[] = storedExercise.exercise.map((note) => ({ ...note }))
    const [hits, setHits] = useState<PlayerHit[]>([])
    const [state, setState] = useState<'ready' | 'count-in' | 'playing' | 'finished'>('ready')
    const [selectedMeasure, setSelectedMeasure] = useState<number | null>(null)
    const [activeSlot, setActiveSlot] = useState(-1)
    const [activeMeasure, setActiveMeasure] = useState(-1)
    const [previewing, setPreviewing] = useState<'all' | number | null>(null)
    const cleanup = useRef<null | (() => void)>(null)
    const metronome = useRef(new Metronome())
    const startedAt = useRef(0)
    const timer = useRef<number | null>(null)
    const previewStop = useRef<null | (() => void)>(null)
    const previewTimer = useRef<number | null>(null)
    const progressFrame = useRef<number | null>(null)
    const previewRequest = useRef(0)
    const notationScroll = useRef<HTMLDivElement>(null)
    const spec = signatures[signature]
    const beatMs = 60000 / bpm
    const measureMs = beatMs * spec.beats
    const totalMs = measureMs * measures

    useEffect(
        () => () => {
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
    function regenerate() {
        if (state !== 'ready' && state !== 'finished') return
        exerciseStore.exercise = generateExercise(measures, difficulty, signature)
        setHits([])
        setState('ready')
        setSelectedMeasure(null)
    }
    function updateExerciseSettings(
        nextMeasures: number,
        nextDifficulty: number,
        nextSignature: TimeSignature,
    ) {
        if (state === 'count-in' || state === 'playing') return
        exerciseStore.measures = nextMeasures
        exerciseStore.difficulty = nextDifficulty
        exerciseStore.signature = nextSignature
        exerciseStore.exercise = generateExercise(nextMeasures, nextDifficulty, nextSignature)
        setHits([])
        setSelectedMeasure(null)
        setState('ready')
    }
    function reset() {
        stopPreview()
        cleanup.current?.()
        cleanup.current = null
        metronome.current.stop()
        if (timer.current) clearTimeout(timer.current)
        setHits([])
        setState('ready')
        setActiveSlot(-1)
        setActiveMeasure(-1)
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
    function showProgress(startAt: number, measureStart: number, measureCount: number) {
        const update = () => {
            const elapsed = performance.now() - startAt
            if (elapsed < 0) {
                progressFrame.current = requestAnimationFrame(update)
                return
            }
            const measureOffset = Math.min(Math.floor(elapsed / measureMs), measureCount - 1)
            const elapsedInMeasure = elapsed - measureOffset * measureMs
            setActiveMeasure(measureStart + measureOffset)
            setActiveSlot(
                Math.min(spec.slots - 1, Math.floor((elapsedInMeasure / measureMs) * spec.slots)),
            )
            if (elapsed < measureCount * measureMs) {
                progressFrame.current = requestAnimationFrame(update)
            }
        }
        progressFrame.current = requestAnimationFrame(update)
    }
    async function previewPattern(measure?: number) {
        if (state === 'count-in' || state === 'playing') return
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
                exercise,
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
        previewTimer.current = window.setTimeout(
            stopPreview,
            80 + measureCount * measureMs + 170,
        )
    }
    async function startExercise() {
        reset()
        setState('count-in')
        let count = 0
        metronome.current.start(beatMs, () => {
            count++
            if (count === 4) {
                metronome.current.stop()
                beginRecording()
            }
        })
    }
    async function beginRecording() {
        try {
            cleanup.current = await listenForOnsets((strength) => {
                const time = performance.now() - startedAt.current
                if (time < totalMs) setHits((previous) => [...previous, { time, strength }])
            })
            startedAt.current = performance.now()
            setState('playing')
            showProgress(startedAt.current, 0, measures)
            metronome.current.start(beatMs, () => undefined)
            timer.current = window.setTimeout(() => {
                metronome.current.stop()
                cleanup.current?.()
                if (progressFrame.current) cancelAnimationFrame(progressFrame.current)
                setState('finished')
                setActiveSlot(-1)
                setActiveMeasure(-1)
            }, totalMs + 30)
        } catch {
            setState('ready')
            alert('Microphone permission is needed to listen to your playing.')
        }
    }
    const measureHits = (i: number) =>
        hits.filter((hit) => hit.time >= i * measureMs && hit.time < (i + 1) * measureMs)
    return (
        <main className="app-shell">
            <header className="topbar">
                <div className="brand">
                    <span className="logo">◒</span>
                    <span>TaktControl</span>
                </div>
                <h1 className="exercise-summary">
                    {signature} <span>·</span> {measures} measures
                </h1>
            </header>
            <div className="app-body">
                <aside className="control-panel" aria-label="Exercise settings">
                    <div className="setting-stack">
                        <label>
                            Measures
                            <select
                                value={measures}
                                onChange={(e) =>
                                    updateExerciseSettings(
                                        Number(e.target.value),
                                        difficulty,
                                        signature,
                                    )
                                }
                            >
                                {[2, 3, 4, 6, 8, 12, 16, 24, 32].map((n) => (
                                    <option key={n}>{n}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Difficulty
                            <select
                                value={difficulty}
                                onChange={(e) =>
                                    updateExerciseSettings(
                                        measures,
                                        Number(e.target.value),
                                        signature,
                                    )
                                }
                            >
                                <option value="1">Easy</option>
                                <option value="2">Medium</option>
                                <option value="3">Hard</option>
                            </select>
                        </label>
                        <label>
                            Time signature
                            <select
                                value={signature}
                                onChange={(e) =>
                                    updateExerciseSettings(
                                        measures,
                                        difficulty,
                                        e.target.value as TimeSignature,
                                    )
                                }
                            >
                                <option>4/4</option>
                                <option>3/4</option>
                                <option>6/8</option>
                            </select>
                        </label>
                        <label className="bpm">
                            Tempo{' '}
                            <output>
                                {bpm} <small>BPM</small>
                            </output>
                            <input
                                type="range"
                                min="45"
                                max="180"
                                value={bpm}
                                onChange={(e) => (exerciseStore.bpm = Number(e.target.value))}
                            />
                        </label>
                    </div>
                    <button className="secondary" onClick={regenerate}>
                        Generate
                    </button>
                    <button
                        className="secondary"
                        onClick={() => previewPattern()}
                        disabled={state === 'count-in' || state === 'playing'}
                    >
                        {previewing === 'all' ? 'Stop' : 'Play'}
                    </button>
                </aside>
                <section className="workspace">
                    <div className="notation-scroll" ref={notationScroll}>
                        <div className="notation-strip">
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
                </section>
            </div>
            <footer className="transport">
                <div className="transport-info">
                    {selectedMeasure !== null ? (
                        <TimingDetail
                            measure={selectedMeasure}
                            notes={exercise.filter((n) => n.measure === selectedMeasure)}
                            hits={measureHits(selectedMeasure)}
                            slots={spec.slots}
                            beats={spec.beats}
                            measureMs={measureMs}
                            onPreview={() => previewPattern(selectedMeasure)}
                            isPreviewing={previewing === selectedMeasure}
                        />
                    ) : null}
                </div>
                <div className="actions">
                    <button
                        className="icon-button"
                        onClick={reset}
                        disabled={state === 'ready'}
                        aria-label="Repeat exercise"
                        title="Repeat exercise"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                    </button>
                    <button
                        className="icon-button primary"
                        onClick={
                            state === 'count-in' || state === 'playing' ? reset : startExercise
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
                </div>
            </footer>
        </main>
    )
}

export default App
