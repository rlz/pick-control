import { useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { replaceHits, selectMeasure, sessionStore, setCalibrationOpen, setSettingsOpen, setTempoOpen, toggleTempoOpen, uiStore } from './store/sessionStore'
import type { CompletedLoopRun } from './store/sessionStore'
import { AppHeader } from './components/AppHeader'
import { AppDialogs, type AppDialogsHandle } from './components/AppDialogs'
import { PlaybackControls } from './components/PlaybackControls'
import { ExerciseWorkspace } from './components/ExerciseWorkspace'
import { TimingDetail } from './components/TimingDetail'
import { signatures } from './domain/exercise'
import { useSessionController } from './hooks/useSessionController'
import type { GenerationOptions } from './domain/exercise'
import {
    addCurrentExerciseToFavorites,
    exerciseStore,
    favoritesStore,
    generateExerciseWithSettings,
    replaceMeasureNotes,
    setBpm,
    setExerciseComment,
    addEmptyMeasure,
    changeExerciseSignature,
    clearExercise,
    deleteMeasure,
    duplicateMeasure,
    moveMeasure,
    setPresetExercise,
    setTempoCeiling,
    setTempoProgram,
    setTempoStep,
    loadFavoriteExercise,
    removeFavoriteExercise,
} from './store/exerciseStore'
import type { FavoriteExercise } from './store/exerciseStore'
import type { ExerciseNote, PlayerHit, TimeSignature } from './types'
import { presetToExercise, type StickControlPreset } from './domain/stickControlPresets'

const exerciseSourceLabels = {
    manual: 'Editor',
    preset: 'Preset',
    generator: 'Random generation',
    favorite: 'Favorite',
} as const

function App() {
    const storedExercise = useSnapshot(exerciseStore)
    const storedFavorites = useSnapshot(favoritesStore)
    const session = useSnapshot(sessionStore)
    const ui = useSnapshot(uiStore)
    const { measures, generationOptions, signature, bpm, tempoCeiling, tempoProgram, tempoStep } =
        storedExercise
    const exerciseSourceLabel = exerciseSourceLabels[storedExercise.source]
    const exercise: ExerciseNote[] = storedExercise.exercise.map((note) => ({ ...note }))
    const favoriteExercises: FavoriteExercise[] = storedFavorites.exercises.map((favorite) => ({
        ...favorite,
        generationOptions: { ...favorite.generationOptions },
        exercise: favorite.exercise.map((note) => ({ ...note })),
    }))
    const controller = useSessionController({ bpm, measures, signature, tempoCeiling, tempoStep, tempoProgram, exercise })
    const { isLooping, forceLooping, isTempoLoop, displayedBpm, measureMs, countInBeats,
        stopForInteraction, reset, stopPreview, previewPattern, startExercise, toggleLooping, timingHits } = controller
    const spec = signatures[signature]
    const hits: PlayerHit[] = session.hits.map((hit) => ({ ...hit }))
    const loopRuns: CompletedLoopRun[] = session.loopRuns.map((run) => ({ ...run, hits: run.hits.map((hit) => ({ ...hit })) }))
    const { phase: state, countInBeat, activeSlot, activeMeasure, previewing, activeBpm } = session
    const { selectedMeasure, settingsOpen, tempoOpen, calibrationOpen } = ui
    const [editorMeasure, setEditorMeasure] = useState<number | null>(null)
    const confirmationDialog = useRef<AppDialogsHandle>(null)
    const notationScroll = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (selectedMeasure === null || settingsOpen || calibrationOpen || editorMeasure !== null || tempoOpen) return
        const selectAdjacentMeasure = (event: KeyboardEvent) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            if (event.metaKey || event.ctrlKey || event.altKey) return
            const target = event.target
            if (target instanceof HTMLElement && target.closest('input, select, textarea, [contenteditable="true"]')) return
            event.preventDefault()
            selectMeasure((current) => current === null ? current : Math.min(measures - 1, Math.max(0, current + (event.key === 'ArrowLeft' ? -1 : 1))))
        }
        window.addEventListener('keydown', selectAdjacentMeasure)
        return () => window.removeEventListener('keydown', selectAdjacentMeasure)
    }, [calibrationOpen, editorMeasure, measures, selectedMeasure, settingsOpen, tempoOpen])

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
        stopForInteraction()
        reset()
        generateExerciseWithSettings(nextMeasures, nextOptions, nextSignature)
        selectMeasure(null)
        setSettingsOpen(false)
    }
    function openMeasureEditor() {
        if (selectedMeasure === null) return
        stopForInteraction()
        stopPreview()
        setEditorMeasure(selectedMeasure)
    }
    function openExerciseSettings() {
        stopForInteraction()
        stopPreview()
        setSettingsOpen(true)
    }
    function saveMeasureEditor(measure: number, replacement: ExerciseNote[]) {
        replaceMeasureNotes(measure, replacement)
        replaceHits([])
        setEditorMeasure(null)
    }
    function changeNotation(action: () => void) {
        stopForInteraction()
        reset()
        action()
    }
    function addMeasure() {
        changeNotation(() => {
            addEmptyMeasure()
            selectMeasure(measures)
        })
    }
    function duplicateSelectedMeasure(measure: number) {
        changeNotation(() => {
            duplicateMeasure(measure)
            selectMeasure(measure + 1)
        })
    }
    function moveSelectedMeasure(measure: number, direction: -1 | 1) {
        changeNotation(() => {
            moveMeasure(measure, direction)
            selectMeasure(measure + direction)
        })
    }
    function deleteSelectedMeasure(measure: number) {
        changeNotation(() => {
            deleteMeasure(measure)
            selectMeasure(Math.min(measure, measures - 2))
        })
    }
    function requestClearExercise() {
        stopForInteraction()
        confirmationDialog.current?.requestConfirmation({
            title: 'Clear exercise?',
            description: 'All notes will be removed and the exercise will contain one empty measure.',
            confirmLabel: 'Clear',
            onConfirm: () => {
                changeNotation(clearExercise)
                selectMeasure(null)
            },
        })
    }
    function requestSignatureChange(nextSignature: TimeSignature) {
        if (nextSignature === signature) return
        stopForInteraction()
        confirmationDialog.current?.requestConfirmation({
            title: 'Change time signature?',
            description: `This will remove all notes and reset the exercise to one empty ${nextSignature} measure.`,
            confirmLabel: 'Change',
            onConfirm: () => {
                changeNotation(() => changeExerciseSignature(nextSignature))
                selectMeasure(null)
            },
        })
    }
    function choosePreset(preset: StickControlPreset) {
        stopForInteraction()
        reset()
        setPresetExercise(presetToExercise(preset), preset.number)
        selectMeasure(null)
        setSettingsOpen(false)
    }
    function chooseFavorite(favorite: FavoriteExercise) {
        stopForInteraction()
        reset()
        loadFavoriteExercise(favorite)
        selectMeasure(null)
        setSettingsOpen(false)
    }
    return (
        <main
            className={`grid h-dvh overflow-hidden bg-slate-950 text-slate-100 ${
                loopRuns.length
                    ? 'grid-rows-[3.5rem_minmax(0,1fr)_auto] md:grid-rows-[4rem_minmax(0,1fr)_auto]'
                    : 'grid-rows-[3.5rem_minmax(0,1fr)_5.5rem] md:grid-rows-[4rem_minmax(0,1fr)_6rem]'
            }`}
        >
            <AppHeader
                signature={signature}
                measures={measures}
                calibrationOpen={calibrationOpen}
                settingsOpen={settingsOpen}
                tempoOpen={tempoOpen}
                displayedBpm={displayedBpm}
                bpm={bpm}
                tempoProgram={tempoProgram}
                tempoStep={tempoStep}
                tempoCeiling={tempoCeiling}
                phase={state}
                onCalibration={() => {
                    stopForInteraction()
                    stopPreview()
                    setCalibrationOpen(true)
                }}
                onSettings={openExerciseSettings}
                onToggleTempo={() => {
                    stopForInteraction()
                    toggleTempoOpen()
                }}
                onBpm={setBpm}
                onTempoProgram={(nextProgram) => {
                    setTempoProgram(nextProgram)
                    if (nextProgram !== 'steady') {
                        forceLooping()
                    }
                }}
                onTempoStep={setTempoStep}
                onTempoCeiling={setTempoCeiling}
            />
            <ExerciseWorkspace
                signature={signature}
                measures={measures}
                notes={exercise}
                sourceLabel={exerciseSourceLabel}
                comment={storedExercise.comment}
                isFavorite={storedExercise.source === 'favorite'}
                favoriteId={storedExercise.favoriteId}
                selectedMeasure={selectedMeasure}
                activeMeasure={activeMeasure}
                activeSlot={activeSlot}
                phase={state}
                previewing={previewing}
                countInBeat={countInBeat}
                countInBeats={countInBeats}
                notationScroll={notationScroll}
                onTempoClose={() => setTempoOpen(false)}
                onSignature={requestSignatureChange}
                onAddMeasure={addMeasure}
                onClear={requestClearExercise}
                onCommentInteraction={stopForInteraction}
                onCommentSave={setExerciseComment}
                onFavorite={() => {
                    stopForInteraction()
                    if (storedExercise.favoriteId) removeFavoriteExercise(storedExercise.favoriteId)
                    else addCurrentExerciseToFavorites()
                }}
                onSelectMeasure={(index) => {
                    stopForInteraction()
                    selectMeasure(selectedMeasure === index ? null : index)
                }}
                onEdit={openMeasureEditor}
                onDuplicate={duplicateSelectedMeasure}
                onMove={moveSelectedMeasure}
                onDelete={deleteSelectedMeasure}
            />
            <PlaybackControls
                phase={state}
                isLooping={isLooping}
                isTempoLoop={isTempoLoop}
                previewing={previewing}
                onToggleLoop={toggleLooping}
                onPreview={() => previewPattern()}
                onReset={() => reset()}
                onStart={() => state === 'count-in' || state === 'playing' ? reset(false) : startExercise()}
            >
                {selectedMeasure !== null ? (
                    <TimingDetail
                        measure={selectedMeasure}
                        notes={exercise.filter((n) => n.measure === selectedMeasure)}
                        runs={[
                            ...loopRuns.map((run) => ({
                                hits: timingHits(run.hits, selectedMeasure, run.measureMs),
                                measureMs: run.measureMs,
                                bpm: run.bpm,
                            })).filter((run) => run.hits.length),
                            ...(timingHits(hits, selectedMeasure).length ? [{
                                hits: timingHits(hits, selectedMeasure), measureMs, bpm: displayedBpm,
                            }] : []),
                        ]}
                        slots={spec.slots}
                        beats={spec.beats}
                        measureMs={measureMs}
                        onPreview={() => previewPattern(selectedMeasure)}
                        isPreviewing={previewing === selectedMeasure}
                    />
                ) : null}
            </PlaybackControls>
            <AppDialogs
                ref={confirmationDialog}
                editorMeasure={editorMeasure}
                signature={signature}
                exercise={exercise}
                previewing={previewing}
                onPreview={(measure, notes) => previewPattern(measure, notes)}
                onSaveMeasure={saveMeasureEditor}
                onCloseEditor={() => { stopPreview(); setEditorMeasure(null) }}
                calibrationOpen={calibrationOpen}
                onCloseCalibration={() => setCalibrationOpen(false)}
                settingsOpen={settingsOpen}
                measures={measures}
                options={generationOptions}
                source={storedExercise.source}
                selectedPresetNumber={storedExercise.presetNumber}
                favorites={favoriteExercises}
                onCloseSettings={() => setSettingsOpen(false)}
                onPreset={choosePreset}
                onGenerate={generateFromSettings}
                onFavorite={chooseFavorite}
                onRemoveFavorite={removeFavoriteExercise}
            />
        </main>
    )
}

export default App
