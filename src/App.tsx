import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faGear,
    faPlay,
    faRepeat,
    faRotateRight,
    faStop,
    faVolumeHigh,
} from '@fortawesome/free-solid-svg-icons'
import { useSnapshot } from 'valtio'
import { Metronome, listenForOnsets, playRhythmPattern } from './audio'
import { Measure } from './components/Measure'
import { MeasureEditor } from './components/MeasureEditor'
import { ExerciseSettingsModal } from './components/ExerciseSettingsModal'
import { notesToSteps, notesToStrokes, stepsToNotes } from './domain/measureSteps'
import type { StepKind } from './domain/measureSteps'
import { TimingDetail } from './components/TimingDetail'
import { signatures } from './domain/exercise'
import type { GenerationOptions } from './domain/exercise'
import {
    exerciseStore,
    generateExerciseWithSettings,
    replaceMeasureNotes,
    setPresetExercise,
} from './store/exerciseStore'
import type { ExerciseNote, PickStroke, PlayerHit, TimeSignature } from './types'
import { presetToExercise, type StickControlPreset } from './domain/stickControlPresets'

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
    const [isLooping, setIsLooping] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [tempoOpen, setTempoOpen] = useState(false)
    const [editorMeasure, setEditorMeasure] = useState<number | null>(null)
    const [editorSteps, setEditorSteps] = useState<StepKind[]>([])
    const [editorStrokes, setEditorStrokes] = useState<(PickStroke | undefined)[]>([])
    const [manualSteps, setManualSteps] = useState<StepKind[]>([])
    const [manualStrokes, setManualStrokes] = useState<(PickStroke | undefined)[]>([])
    const cleanup = useRef<null | (() => void)>(null)
    const metronome = useRef(new Metronome())
    const startedAt = useRef(0)
    const timer = useRef<number | null>(null)
    const isLoopingRef = useRef(false)
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
    function updateExerciseSettings(nextMeasures: number, nextSignature: TimeSignature) {
        if (state === 'count-in' || state === 'playing') return
        exerciseStore.measures = nextMeasures
        exerciseStore.signature = nextSignature
        const nextSlots = signatures[nextSignature].slots
        if (nextSignature !== signature) {
            exerciseStore.exercise = Array.from({ length: nextMeasures }, (_, measure) =>
                silentMeasure(measure, nextSlots),
            ).flat()
            setManualSteps(Array.from({ length: nextSlots }, () => 'rest'))
            setManualStrokes(Array.from({ length: nextSlots }))
        } else {
            exerciseStore.exercise = Array.from({ length: nextMeasures }, (_, measure) => {
                const existing = exercise.filter((note) => note.measure === measure)
                return existing.length ? existing : silentMeasure(measure, nextSlots)
            }).flat()
        }
        setHits([])
        setSelectedMeasure(null)
        setState('ready')
    }
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
        const measureNotes = exercise.filter((note) => note.measure === 0)
        setManualSteps(notesToSteps(measureNotes, spec.slots))
        setManualStrokes(notesToStrokes(measureNotes, spec.slots))
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
    function setManualStroke(step: number, stroke: PickStroke) {
        setManualStrokes((previous) => {
            const next = [...previous]
            next[step] = stroke
            return next
        })
    }
    function setManualStep(step: number, kind: StepKind) {
        const wasRest = manualSteps[step] === 'rest'
        setManualSteps((previous) => {
            const next = [...previous]
            next[step] = kind
            return next
        })
        if (kind === 'rest') {
            setManualStrokes((previous) => {
                const next = [...previous]
                next[step] = undefined
                return next
            })
            return
        }
        if (!wasRest || kind === 'continue') return
        setManualStrokes((previous) => {
            const next = [...previous]
            let previousStroke: PickStroke | undefined
            for (let index = step - 1; index >= 0; index--) {
                if (previous[index]) {
                    previousStroke = previous[index]
                    break
                }
            }
            next[step] = previousStroke === 'down' ? 'up' : 'down'
            return next
        })
    }
    function saveManualMeasure() {
        const replacement = stepsToNotes(manualSteps, 0, manualStrokes)
        exerciseStore.exercise = Array.from({ length: measures }, (_, measure) =>
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
    async function previewPattern(measure?: number, notes = exercise) {
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
            scheduleExerciseEnd()
        } catch {
            setState('ready')
            alert('Microphone permission is needed to listen to your playing.')
        }
    }
    function scheduleExerciseEnd() {
        timer.current = window.setTimeout(() => {
            if (isLoopingRef.current) {
                setHits([])
                startedAt.current = currentTime()
                setActiveMeasure(0)
                setActiveSlot(-1)
                showProgress(startedAt.current, 0, measures)
                scheduleExerciseEnd()
                return
            }
            metronome.current.stop()
            cleanup.current?.()
            if (progressFrame.current) cancelAnimationFrame(progressFrame.current)
            setState('finished')
            setActiveSlot(-1)
            setActiveMeasure(-1)
        }, totalMs + 30)
    }
    function toggleLooping() {
        setIsLooping((previous) => {
            const next = !previous
            isLoopingRef.current = next
            return next
        })
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
                <div className="ml-auto flex items-center gap-2">
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
                <button className="header-control" type="button" onClick={() => setTempoOpen((open) => !open)} aria-expanded={tempoOpen} aria-label="Change tempo"><span className="tempo-value">{bpm}</span><span>BPM</span></button>
                </div>
                {tempoOpen ? <div className="tempo-popover"><label>Tempo <output>{bpm} BPM</output><input type="range" min="45" max="180" value={bpm} onChange={(event) => (exerciseStore.bpm = Number(event.target.value))} /></label></div> : null}
            </header>
            <div className="app-body grid min-h-0 overflow-hidden">
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
                            aria-label={
                                isLooping ? 'Disable exercise loop' : 'Enable exercise loop'
                            }
                            aria-pressed={isLooping}
                            title={isLooping ? 'Disable exercise loop' : 'Loop exercise'}
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
            {settingsOpen ? <ExerciseSettingsModal measures={measures} signature={signature} options={generationOptions} onClose={() => setSettingsOpen(false)} onSettingsChange={updateExerciseSettings} manualSteps={manualSteps} manualStrokes={manualStrokes} isManualPreviewing={previewing === 0} onManualChange={setManualStep} onManualStrokeChange={setManualStroke} onManualPreview={() => previewPattern(0, stepsToNotes(manualSteps, 0, manualStrokes))} onManualSave={saveManualMeasure} onPreset={choosePreset} onGenerate={generateFromSettings} /> : null}
        </main>
    )
}

function silentMeasure(measure: number, slots: number): ExerciseNote[] {
    return [{ id: `${measure}-0`, measure, position: 0, duration: slots, isRest: true }]
}

export default App
