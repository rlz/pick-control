import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faGear,
    faPlay,
    faRotateRight,
    faStop,
    faVolumeHigh,
    faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useSnapshot } from 'valtio'
import { Metronome, listenForOnsets, playRhythmPattern } from './audio'
import { Measure } from './components/Measure'
import { TimingDetail } from './components/TimingDetail'
import { generateExercise, signatures } from './domain/exercise'
import type { GenerationOptions } from './domain/exercise'
import { exerciseStore, setGenerationOptions } from './store/exerciseStore'
import type { ExerciseNote, PlayerHit, TimeSignature } from './types'

const currentTime = () => performance.now()

function App() {
    const storedExercise = useSnapshot(exerciseStore)
    const { measures, generationOptions, signature, bpm } = storedExercise
    const exercise: ExerciseNote[] = storedExercise.exercise.map((note) => ({ ...note }))
    const [hits, setHits] = useState<PlayerHit[]>([])
    const [state, setState] = useState<'ready' | 'count-in' | 'playing' | 'finished'>('ready')
    const [selectedMeasure, setSelectedMeasure] = useState<number | null>(null)
    const [activeSlot, setActiveSlot] = useState(-1)
    const [activeMeasure, setActiveMeasure] = useState(-1)
    const [previewing, setPreviewing] = useState<'all' | number | null>(null)
    const [settingsOpen, setSettingsOpen] = useState(false)
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
        exerciseStore.exercise = generateExercise(measures, generationOptions, signature)
        setHits([])
        setState('ready')
        setSelectedMeasure(null)
    }
    function updateExerciseSettings(nextMeasures: number, nextSignature: TimeSignature) {
        if (state === 'count-in' || state === 'playing') return
        exerciseStore.measures = nextMeasures
        exerciseStore.signature = nextSignature
        exerciseStore.exercise = generateExercise(nextMeasures, generationOptions, nextSignature)
        setHits([])
        setSelectedMeasure(null)
        setState('ready')
    }
    function updateGenerationOption(option: keyof GenerationOptions, enabled: boolean) {
        if (state === 'count-in' || state === 'playing') return
        const nextOptions = { ...generationOptions, [option]: enabled }
        setGenerationOptions(nextOptions)
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
        previewTimer.current = window.setTimeout(stopPreview, 80 + measureCount * measureMs + 170)
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
            startedAt.current = currentTime()
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
        <main className="grid h-dvh grid-rows-[3.5rem_minmax(0,1fr)_5.5rem] overflow-hidden bg-slate-950 text-slate-100 md:grid-rows-[4rem_minmax(0,1fr)_6rem]">
            <header className="relative flex items-center border-b border-slate-800 bg-slate-900/90 px-5 backdrop-blur md:px-7">
                <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-indigo-300">
                    <span className="grid size-8 place-items-center rounded-lg bg-indigo-400/15 text-xl">
                        ◒
                    </span>
                    <span>TaktControl</span>
                </div>
                <h1 className="absolute left-1/2 m-0 hidden -translate-x-1/2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm font-medium text-slate-300 sm:block">
                    {signature} <span className="px-1 text-slate-500">·</span> {measures} measures
                </h1>
                <button
                    className="settings-toggle ml-auto"
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    aria-label="Open exercise settings"
                    aria-expanded={settingsOpen}
                    aria-controls="exercise-settings"
                >
                    <FontAwesomeIcon icon={faGear} />
                </button>
            </header>
            <div className="app-body grid min-h-0 overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
                <aside
                    className={`control-panel ${settingsOpen ? 'settings-open' : ''} flex min-h-0 flex-col gap-6 overflow-y-auto border-r border-slate-800 bg-slate-900 p-5 md:p-6`}
                    id="exercise-settings"
                    aria-label="Exercise settings"
                >
                    <div className="settings-panel-heading items-center justify-between text-base font-bold text-indigo-300">
                        <span>Exercise settings</span>
                        <button
                            className="settings-close"
                            type="button"
                            onClick={() => setSettingsOpen(false)}
                            aria-label="Close exercise settings"
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>
                    <div className="grid gap-5">
                        <label>
                            Measures
                            <select
                                value={measures}
                                onChange={(e) =>
                                    updateExerciseSettings(Number(e.target.value), signature)
                                }
                            >
                                {[2, 3, 4, 6, 8, 12, 16, 24, 32].map((n) => (
                                    <option key={n}>{n}</option>
                                ))}
                            </select>
                        </label>
                        <fieldset className="generation-options">
                            <legend>Allowed elements</legend>
                            {(
                                [
                                    ['rests', 'Rests'],
                                    ['eighths', 'Eighth notes'],
                                    ['sixteenths', 'Sixteenth notes'],
                                    ['palmMutes', 'Palm mute'],
                                    ['triplets', 'Triplets'],
                                ] as [keyof GenerationOptions, string][]
                            ).map(([option, label]) => (
                                <label className="generation-option" key={option}>
                                    <input
                                        type="checkbox"
                                        checked={generationOptions[option]}
                                        onChange={(event) =>
                                            updateGenerationOption(option, event.target.checked)
                                        }
                                    />
                                    <span>{label}</span>
                                </label>
                            ))}
                        </fieldset>
                        <label>
                            Time signature
                            <select
                                value={signature}
                                onChange={(e) =>
                                    updateExerciseSettings(
                                        measures,
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
                </aside>
                <section className="grid min-h-0 min-w-0 overflow-hidden bg-slate-950">
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
                </section>
            </div>
            <footer className="relative z-10 flex items-center justify-between gap-4 border-t border-slate-800 bg-slate-900 px-4 md:px-7">
                <div className="flex min-w-0 flex-1 items-center gap-3">
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
                <div className="flex items-end gap-3 border-l border-slate-700 pl-4">
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
                            onClick={reset}
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
                        <span className="text-[10px] font-semibold text-indigo-300">
                            {state === 'count-in' || state === 'playing' ? 'Stop' : 'Start'}
                        </span>
                    </div>
                </div>
            </footer>
        </main>
    )
}

export default App
