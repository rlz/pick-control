import { proxy, subscribe } from 'valtio'
import { defaultGenerationOptions, generateExercise } from '../domain/exercise'
import type { GenerationOptions } from '../domain/exercise'
import { findPresetNumber } from '../domain/stickControlPresets'
import type { ExerciseNote, PickStroke, TimeSignature } from '../types'

const STORAGE_KEY = 'pick-control.exercise.v1'
const LEGACY_STORAGE_KEYS = ['taktcontrol.exercise.v1', 'rithme.exercise.v1']
const FAVORITES_STORAGE_KEY = 'pick-control.favorite-exercises.v1'
const LEGACY_FAVORITES_STORAGE_KEY = 'taktcontrol.favorite-exercises.v1'
export const MIN_BPM = 45
export const MAX_BPM = 180
export const MIN_TEMPO_STEP = 1
export const MAX_TEMPO_STEP = 20

export type TempoProgram = 'steady' | 'increase' | 'increase-and-return'
export type ExerciseSource = 'manual' | 'preset' | 'generator' | 'favorite'
type FavoriteSource = Exclude<ExerciseSource, 'favorite'>

export type FavoriteExercise = {
    id: string
    comment: string
    addedAt: string
    lastUsedAt: string
    source: FavoriteSource
    measures: number
    generationOptions: GenerationOptions
    signature: TimeSignature
    exercise: ExerciseNote[]
}

type StoredExercise = {
    measures: number
    generationOptions: GenerationOptions
    signature: TimeSignature
    bpm: number
    tempoProgram: TempoProgram
    tempoStep: number
    tempoCeiling: number
    source: ExerciseSource
    favoriteId?: string
    presetNumber?: number
    comment: string
    exercise: ExerciseNote[]
}

const defaults = (): StoredExercise => ({
    measures: 4,
    generationOptions: { ...defaultGenerationOptions },
    signature: '4/4',
    bpm: 92,
    tempoProgram: 'steady',
    tempoStep: 4,
    tempoCeiling: 120,
    source: 'generator',
    comment: '',
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
        Array.isArray(candidate.exercise)
    )
}

function normalizeBpm(value: number) {
    if (!Number.isFinite(value)) return defaults().bpm
    return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)))
}

function normalizeTempoStep(value: number) {
    if (!Number.isFinite(value)) return defaults().tempoStep
    return Math.min(MAX_TEMPO_STEP, Math.max(MIN_TEMPO_STEP, Math.round(value)))
}

function normalizeTempoProgram(value: unknown): TempoProgram {
    return value === 'increase' || value === 'increase-and-return' ? value : 'steady'
}

function normalizeExerciseSource(value: unknown): ExerciseSource {
    return value === 'preset' || value === 'generator' || value === 'favorite' ? value : 'manual'
}

function loadExercise(): StoredExercise {
    if (typeof window === 'undefined') return defaults()
    try {
        const saved = JSON.parse(
            window.localStorage.getItem(STORAGE_KEY) ??
                LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean) ??
                'null',
        )
        return isStoredExercise(saved)
            ? withStrokes({
                  ...saved,
                  bpm: normalizeBpm(saved.bpm ?? defaults().bpm),
                  tempoProgram: normalizeTempoProgram(saved.tempoProgram),
                  tempoStep: normalizeTempoStep(saved.tempoStep ?? defaults().tempoStep),
                  tempoCeiling: normalizeBpm(saved.tempoCeiling ?? defaults().tempoCeiling),
                  source: normalizeExerciseSource(saved.source),
                  favoriteId: typeof saved.favoriteId === 'string' ? saved.favoriteId : undefined,
                  presetNumber:
                      typeof saved.presetNumber === 'number'
                          ? saved.presetNumber
                          : saved.source === 'preset'
                            ? findPresetNumber(saved.exercise)
                            : undefined,
                  comment: typeof saved.comment === 'string' ? saved.comment : '',
              })
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

function isFavoriteExercise(value: unknown): value is FavoriteExercise {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<FavoriteExercise>
    return (
        typeof candidate.id === 'string' &&
        typeof candidate.comment === 'string' &&
        typeof candidate.addedAt === 'string' &&
        typeof candidate.lastUsedAt === 'string' &&
        (candidate.source === 'manual' ||
            candidate.source === 'preset' ||
            candidate.source === 'generator') &&
        typeof candidate.measures === 'number' &&
        typeof candidate.generationOptions === 'object' &&
        candidate.generationOptions !== null &&
        (candidate.signature === '4/4' ||
            candidate.signature === '3/4' ||
            candidate.signature === '6/8') &&
        Array.isArray(candidate.exercise)
    )
}

function loadFavorites(): FavoriteExercise[] {
    if (typeof window === 'undefined') return []
    try {
        const saved = JSON.parse(
            window.localStorage.getItem(FAVORITES_STORAGE_KEY) ??
                window.localStorage.getItem(LEGACY_FAVORITES_STORAGE_KEY) ??
                '[]',
        )
        return Array.isArray(saved) ? saved.filter(isFavoriteExercise) : []
    } catch {
        return []
    }
}

export const favoritesStore = proxy<{ exercises: FavoriteExercise[] }>({
    exercises: loadFavorites(),
})

function detachFavorite() {
    exerciseStore.favoriteId = undefined
}

function clearSelectedPreset() {
    exerciseStore.presetNumber = undefined
}

function clearComment() {
    exerciseStore.comment = ''
}

export function setBpm(bpm: number) {
    exerciseStore.bpm = normalizeBpm(bpm)
    exerciseStore.tempoCeiling = Math.max(exerciseStore.tempoCeiling, exerciseStore.bpm)
}

export function setTempoProgram(tempoProgram: TempoProgram) {
    exerciseStore.tempoProgram = tempoProgram
}

export function setTempoStep(tempoStep: number) {
    exerciseStore.tempoStep = normalizeTempoStep(tempoStep)
}

export function setTempoCeiling(tempoCeiling: number) {
    exerciseStore.tempoCeiling = Math.max(exerciseStore.bpm, normalizeBpm(tempoCeiling))
}

export function setGenerationOptions(options: GenerationOptions) {
    exerciseStore.generationOptions = options
    exerciseStore.exercise = generateExercise(
        exerciseStore.measures,
        options,
        exerciseStore.signature,
    )
    exerciseStore.source = 'generator'
    detachFavorite()
    clearSelectedPreset()
    clearComment()
}

export function regenerateExercise(
    measures: number,
    options: GenerationOptions,
    signature: TimeSignature,
) {
    exerciseStore.exercise = generateExercise(measures, options, signature)
    exerciseStore.source = 'generator'
    detachFavorite()
    clearSelectedPreset()
    clearComment()
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
    exerciseStore.source = 'generator'
    detachFavorite()
    clearSelectedPreset()
    clearComment()
}

export function setPresetExercise(exercise: ExerciseNote[], presetNumber: number) {
    exerciseStore.measures = 2
    exerciseStore.signature = '4/4'
    exerciseStore.exercise = exercise
    exerciseStore.source = 'preset'
    exerciseStore.presetNumber = presetNumber
    detachFavorite()
    clearComment()
}

export function replaceMeasureNotes(measure: number, notes: ExerciseNote[]) {
    exerciseStore.exercise = [
        ...exerciseStore.exercise.filter((note) => note.measure !== measure),
        ...notes,
    ].sort((left, right) => left.measure - right.measure || left.position - right.position)
    exerciseStore.source = 'manual'
    detachFavorite()
    clearSelectedPreset()
}

function setManualMeasures(measures: number, exercise: ExerciseNote[]) {
    exerciseStore.measures = measures
    exerciseStore.exercise = exercise
    exerciseStore.source = 'manual'
    detachFavorite()
    clearSelectedPreset()
}

function renumberNotes(notes: ExerciseNote[]): ExerciseNote[] {
    return notes
        .map((note) => ({ ...note, id: `${note.measure}-${note.position}` }))
        .sort((left, right) => left.measure - right.measure || left.position - right.position)
}

export function addEmptyMeasure() {
    setManualMeasures(exerciseStore.measures + 1, [...exerciseStore.exercise])
}

export function duplicateMeasure(measure: number) {
    if (measure < 0 || measure >= exerciseStore.measures) return
    const duplicate = exerciseStore.exercise
        .filter((note) => note.measure === measure)
        .map((note) => ({ ...note, measure: measure + 1 }))
    const shifted = exerciseStore.exercise.map((note) =>
        note.measure > measure ? { ...note, measure: note.measure + 1 } : note,
    )
    setManualMeasures(exerciseStore.measures + 1, renumberNotes([...shifted, ...duplicate]))
}

export function moveMeasure(measure: number, direction: -1 | 1) {
    const destination = measure + direction
    if (measure < 0 || destination < 0 || destination >= exerciseStore.measures) return
    const moved = exerciseStore.exercise.map((note) => {
        if (note.measure === measure) return { ...note, measure: destination }
        if (note.measure === destination) return { ...note, measure }
        return note
    })
    setManualMeasures(exerciseStore.measures, renumberNotes(moved))
}

export function deleteMeasure(measure: number) {
    if (exerciseStore.measures <= 1 || measure < 0 || measure >= exerciseStore.measures) return
    const remaining = exerciseStore.exercise
        .filter((note) => note.measure !== measure)
        .map((note) => (note.measure > measure ? { ...note, measure: note.measure - 1 } : note))
    setManualMeasures(exerciseStore.measures - 1, renumberNotes(remaining))
}

export function clearExercise() {
    setManualMeasures(1, [])
}

export function changeExerciseSignature(signature: TimeSignature) {
    exerciseStore.signature = signature
    setManualMeasures(1, [])
}

export function setManualExercise(
    measures: number,
    signature: TimeSignature,
    exercise: ExerciseNote[],
) {
    exerciseStore.measures = measures
    exerciseStore.signature = signature
    exerciseStore.exercise = exercise
    exerciseStore.source = 'manual'
    detachFavorite()
    clearSelectedPreset()
}

export function setExerciseComment(comment: string) {
    exerciseStore.comment = comment
    if (exerciseStore.source !== 'favorite' || !exerciseStore.favoriteId) return
    const favorite = favoritesStore.exercises.find((entry) => entry.id === exerciseStore.favoriteId)
    if (favorite) favorite.comment = comment
}

export function addCurrentExerciseToFavorites() {
    const now = new Date().toISOString()
    const currentFavorite = favoritesStore.exercises.find(
        (entry) => entry.id === exerciseStore.favoriteId,
    )
    if (currentFavorite) return
    const favorite: FavoriteExercise = {
        id: crypto.randomUUID(),
        comment: exerciseStore.comment,
        addedAt: now,
        lastUsedAt: now,
        source: exerciseStore.source === 'favorite' ? 'manual' : exerciseStore.source,
        measures: exerciseStore.measures,
        generationOptions: { ...exerciseStore.generationOptions },
        signature: exerciseStore.signature,
        exercise: exerciseStore.exercise.map((note) => ({ ...note })),
    }
    favoritesStore.exercises.unshift(favorite)
    exerciseStore.source = 'favorite'
    exerciseStore.favoriteId = favorite.id
    clearSelectedPreset()
}

export function removeFavoriteExercise(id: string) {
    favoritesStore.exercises = favoritesStore.exercises.filter((favorite) => favorite.id !== id)
    if (exerciseStore.favoriteId !== id) return
    exerciseStore.source = 'manual'
    detachFavorite()
    clearSelectedPreset()
}

export function loadFavoriteExercise(favorite: FavoriteExercise) {
    const now = new Date().toISOString()
    const storedFavorite = favoritesStore.exercises.find((entry) => entry.id === favorite.id)
    if (storedFavorite) storedFavorite.lastUsedAt = now
    exerciseStore.measures = favorite.measures
    exerciseStore.generationOptions = { ...favorite.generationOptions }
    exerciseStore.signature = favorite.signature
    exerciseStore.exercise = favorite.exercise.map((note) => ({ ...note }))
    exerciseStore.comment = favorite.comment
    exerciseStore.source = 'favorite'
    exerciseStore.favoriteId = favorite.id
    clearSelectedPreset()
}

subscribe(exerciseStore, () => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exerciseStore))
    } catch {
        // The exercise remains usable if storage is unavailable or full.
    }
})

subscribe(favoritesStore, () => {
    try {
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoritesStore.exercises))
    } catch {
        // Favorites remain usable for the current session if storage is unavailable or full.
    }
})
