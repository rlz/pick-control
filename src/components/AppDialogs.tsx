import { forwardRef, useImperativeHandle, useRef } from 'react'
import { AudioCalibrationModal } from './AudioCalibrationModal'
import { ConfirmationDialog, type ConfirmationDialogHandle, type ConfirmationRequest } from './ConfirmationDialog'
import { ExerciseSettingsModal } from './ExerciseSettingsModal'
import { MeasureEditorDialog } from './MeasureEditorDialog'
import type { GenerationOptions } from '../domain/exercise'
import type { FavoriteExercise } from '../store/exerciseStore'
import type { ExerciseNote, TimeSignature } from '../types'
import type { StickControlPreset } from '../domain/stickControlPresets'
import type { ExerciseSource } from '../store/exerciseStore'

export type AppDialogsHandle = { requestConfirmation: (value: ConfirmationRequest) => void }
type Props = {
    editorMeasure: number | null
    signature: TimeSignature
    exercise: ExerciseNote[]
    previewing: 'all' | number | null
    onPreview: (measure: number, notes: ExerciseNote[]) => void
    onSaveMeasure: (measure: number, notes: ExerciseNote[]) => void
    onCloseEditor: () => void
    calibrationOpen: boolean
    onCloseCalibration: () => void
    settingsOpen: boolean
    measures: number
    options: GenerationOptions
    source: ExerciseSource
    selectedPresetNumber?: number
    favorites: FavoriteExercise[]
    onCloseSettings: () => void
    onPreset: (preset: StickControlPreset) => void
    onGenerate: (measures: number, options: GenerationOptions, signature: TimeSignature) => void
    onFavorite: (favorite: FavoriteExercise) => void
    onRemoveFavorite: (id: string) => void
}

export const AppDialogs = forwardRef<AppDialogsHandle, Props>(function AppDialogs(props, ref) {
    const confirmationRef = useRef<ConfirmationDialogHandle>(null)
    useImperativeHandle(ref, () => ({ requestConfirmation: (value) => confirmationRef.current?.request(value) }), [])
    return <>
        {props.editorMeasure !== null ? <MeasureEditorDialog
            measure={props.editorMeasure}
            signature={props.signature}
            notes={props.exercise.filter((note) => note.measure === props.editorMeasure)}
            isPreviewing={props.previewing === props.editorMeasure}
            onPreview={(notes) => props.onPreview(props.editorMeasure!, notes)}
            onSave={props.onSaveMeasure}
            onClose={props.onCloseEditor}
        /> : null}
        {props.calibrationOpen ? <AudioCalibrationModal onClose={props.onCloseCalibration} /> : null}
        {props.settingsOpen ? <ExerciseSettingsModal
            measures={props.measures}
            signature={props.signature}
            options={props.options}
            source={props.source}
            selectedPresetNumber={props.selectedPresetNumber}
            favorites={props.favorites}
            onClose={props.onCloseSettings}
            onPreset={props.onPreset}
            onGenerate={props.onGenerate}
            onFavorite={props.onFavorite}
            onRemoveFavorite={props.onRemoveFavorite}
        /> : null}
        <ConfirmationDialog ref={confirmationRef} />
    </>
})
