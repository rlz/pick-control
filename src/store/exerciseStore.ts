import { proxy, subscribe } from 'valtio'
import { generateExercise } from '../domain/exercise'
import type { ExerciseNote, TimeSignature } from '../types'

const STORAGE_KEY = 'rithme.exercise.v1'

type StoredExercise = {
    measures: number
    difficulty: number
    signature: TimeSignature
    bpm: number
    exercise: ExerciseNote[]
}

const defaults = (): StoredExercise => ({
    measures: 4,
    difficulty: 2,
    signature: '4/4',
    bpm: 92,
    exercise: generateExercise(4, 2, '4/4'),
})

function isStoredExercise(value: unknown): value is StoredExercise {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<StoredExercise>
    return (
        typeof candidate.measures === 'number' &&
        typeof candidate.difficulty === 'number' &&
        (candidate.signature === '4/4' || candidate.signature === '3/4' || candidate.signature === '6/8') &&
        typeof candidate.bpm === 'number' &&
        Array.isArray(candidate.exercise)
    )
}

function loadExercise(): StoredExercise {
    if (typeof window === 'undefined') return defaults()
    try {
        const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
        return isStoredExercise(saved) ? saved : defaults()
    } catch {
        return defaults()
    }
}

export const exerciseStore = proxy<StoredExercise>(loadExercise())

subscribe(exerciseStore, () => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exerciseStore))
    } catch {
        // The exercise remains usable if storage is unavailable or full.
    }
})
