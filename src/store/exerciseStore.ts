import { proxy, subscribe } from 'valtio'
import { defaultGenerationOptions, generateExercise } from '../domain/exercise'
import type { GenerationOptions } from '../domain/exercise'
import type { ExerciseNote, PickStroke, TimeSignature } from '../types'

const STORAGE_KEY = 'taktcontrol.exercise.v1'
const LEGACY_STORAGE_KEY = 'rithme.exercise.v1'
export const MIN_BPM = 45
export const MAX_BPM = 180

type StoredExercise = {
    measures: number
    generationOptions: GenerationOptions
    signature: TimeSignature
    bpm: number
    exercise: ExerciseNote[]
}

const defaults = (): StoredExercise => ({
    measures: 4,
    generationOptions: { ...defaultGenerationOptions },
    signature: '4/4',
    bpm: 92,
    exercise: generateExercise(4, defaultGenerationOptions, '4/4'),
})

function isStoredExercise(value: unknown): value is StoredExercise {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<StoredExercise>
    return (
        typeof candidate.measures === 'number' &&
        typeof candidate.generationOptions === 'object' &&
        candidate.generationOptions !== null &&
        (candidate.signature === '4/4' ||
            candidate.signature === '3/4' ||
            candidate.signature === '6/8') &&
        typeof candidate.bpm === 'number' &&
        Array.isArray(candidate.exercise)
    )
}

function normalizeBpm(value: number) {
    if (!Number.isFinite(value)) return defaults().bpm
    return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)))
}

function loadExercise(): StoredExercise {
    if (typeof window === 'undefined') return defaults()
    try {
        const saved = JSON.parse(
            window.localStorage.getItem(STORAGE_KEY) ??
                window.localStorage.getItem(LEGACY_STORAGE_KEY) ??
                'null',
        )
        return isStoredExercise(saved)
            ? withStrokes({ ...saved, bpm: normalizeBpm(saved.bpm) })
            : defaults()
    } catch {
        return defaults()
    }
}

/** Adds pick directions to exercises saved before strokes were introduced. */
function withStrokes(stored: StoredExercise): StoredExercise {
    const nextStrokeByMeasure = new Map<number, PickStroke>()
    const exercise = [...stored.exercise]
        .sort((left, right) => left.measure - right.measure || left.position - right.position)
        .map((note) => {
            if (note.isRest) return note
            const nextStroke = nextStrokeByMeasure.get(note.measure) ?? 'down'
            nextStrokeByMeasure.set(note.measure, nextStroke === 'down' ? 'up' : 'down')
            return note.stroke ? note : { ...note, stroke: nextStroke }
        })
    return { ...stored, exercise }
}

export const exerciseStore = proxy<StoredExercise>(loadExercise())

export function setBpm(bpm: number) {
    exerciseStore.bpm = normalizeBpm(bpm)
}

export function setGenerationOptions(options: GenerationOptions) {
    exerciseStore.generationOptions = options
    exerciseStore.exercise = generateExercise(
        exerciseStore.measures,
        options,
        exerciseStore.signature,
    )
}

export function regenerateExercise(
    measures: number,
    options: GenerationOptions,
    signature: TimeSignature,
) {
    exerciseStore.exercise = generateExercise(measures, options, signature)
}

export function generateExerciseWithSettings(
    measures: number,
    options: GenerationOptions,
    signature: TimeSignature,
) {
    exerciseStore.measures = measures
    exerciseStore.generationOptions = options
    exerciseStore.signature = signature
    exerciseStore.exercise = generateExercise(measures, options, signature)
}

export function setPresetExercise(exercise: ExerciseNote[]) {
    exerciseStore.measures = 2
    exerciseStore.signature = '4/4'
    exerciseStore.exercise = exercise
}

export function replaceMeasureNotes(measure: number, notes: ExerciseNote[]) {
    exerciseStore.exercise = [
        ...exerciseStore.exercise.filter((note) => note.measure !== measure),
        ...notes,
    ].sort((left, right) => left.measure - right.measure || left.position - right.position)
}

subscribe(exerciseStore, () => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exerciseStore))
    } catch {
        // The exercise remains usable if storage is unavailable or full.
    }
})
