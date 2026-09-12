import type { ExerciseNote, TimeSignature } from '../types'

export type SignatureSpec = { beats: number; unit: number; slots: number }

type RhythmCell = readonly number[]
type MeasureEvent = { position: number; duration: number; isRest: boolean }

export const signatures: Record<TimeSignature, SignatureSpec> = {
    '4/4': { beats: 4, unit: 4, slots: 16 },
    '3/4': { beats: 3, unit: 4, slots: 12 },
    '6/8': { beats: 2, unit: 8, slots: 12 },
}

/** Builds phrases from beat-sized cells, keeping attacks tied to the meter. */
export function generateExercise(
    measures: number,
    difficulty: number,
    signature: TimeSignature,
): ExerciseNote[] {
    const spec = signatures[signature]
    const beatSlots = spec.slots / spec.beats
    const motif = createMotif(spec.beats, difficulty, signature)
    const pattern: ExerciseNote[] = []

    for (let measure = 0; measure < measures; measure++) {
        const events = createMeasure(
            measure,
            spec.beats,
            beatSlots,
            difficulty,
            signature,
            motif,
        )
        const mutedRange = choosePalmMuteRange(events, beatSlots, difficulty)

        events.forEach((event) => {
            const palmMuted =
                !event.isRest &&
                mutedRange !== null &&
                event.position >= mutedRange.start &&
                event.position < mutedRange.end
            pattern.push({
                id: `${measure}-${event.position}`,
                measure,
                position: event.position,
                duration: event.duration,
                isRest: event.isRest,
                palmMuted,
            })
        })
    }

    return pattern
}

function createMotif(
    beats: number,
    difficulty: number,
    signature: TimeSignature,
): RhythmCell[] {
    return Array.from({ length: beats }, () => chooseCell(difficulty, signature))
}

function createMeasure(
    measure: number,
    beats: number,
    beatSlots: number,
    difficulty: number,
    signature: TimeSignature,
    motif: RhythmCell[],
): MeasureEvent[] {
    const events: MeasureEvent[] = []

    for (let beat = 0; beat < beats; beat++) {
        // Repetition gives the player a phrase to recognise; the last beat
        // is the natural place for a small turnaround.
        const varyBeat = measure > 0 && (beat === beats - 1 || Math.random() < 0.2)
        const cell = varyBeat ? chooseCell(difficulty, signature) : motif[beat]
        let offset = beat * beatSlots

        cell.forEach((duration, index) => {
            const isDownbeat = beat === 0 && index === 0
            const canRest = !isDownbeat && index === 0 && duration >= 2
            const restChance = difficulty === 1 ? 0.04 : difficulty === 2 ? 0.09 : 0.13
            // A gap at the beginning of a later beat feels intentional.
            const isRest = canRest && Math.random() < restChance
            events.push({ position: offset, duration, isRest })
            offset += duration
        })
    }

    return events
}

function chooseCell(difficulty: number, signature: TimeSignature): RhythmCell {
    if (signature === '6/8') return chooseWeighted(compoundCells(difficulty))
    return chooseWeighted(simpleCells(difficulty))
}

function simpleCells(difficulty: number): readonly [RhythmCell, number][] {
    if (difficulty === 1) {
        return [
            [[4], 7],
            [[2, 2], 3],
        ]
    }
    if (difficulty === 2) {
        return [
            [[4], 3],
            [[2, 2], 5],
            [[1, 1, 2], 2],
            [[2, 1, 1], 2],
        ]
    }
    return [
        [[4], 2],
        [[2, 2], 4],
        [[1, 1, 2], 3],
        [[2, 1, 1], 3],
        [[3, 1], 2],
        [[1, 3], 2],
        [[1, 1, 1, 1], 1],
    ]
}

function compoundCells(difficulty: number): readonly [RhythmCell, number][] {
    if (difficulty === 1) {
        return [
            [[6], 6],
            [[3, 3], 4],
        ]
    }
    if (difficulty === 2) {
        return [
            [[6], 2],
            [[3, 3], 5],
            [[2, 2, 2], 3],
            [[3, 1, 2], 2],
        ]
    }
    return [
        [[6], 1],
        [[3, 3], 4],
        [[2, 2, 2], 3],
        [[3, 1, 2], 3],
        [[2, 1, 3], 3],
        [[1, 2, 1, 2], 1],
    ]
}

function choosePalmMuteRange(
    events: MeasureEvent[],
    beatSlots: number,
    difficulty: number,
): { start: number; end: number } | null {
    const chance = difficulty === 1 ? 0.08 : difficulty === 2 ? 0.17 : 0.25
    if (Math.random() >= chance) return null

    const playableBeatStarts = events.filter(
        (event) => !event.isRest && event.position % beatSlots === 0,
    )
    const start = playableBeatStarts[Math.floor(Math.random() * playableBeatStarts.length)]
    if (!start) return null
    const length = beatSlots * (Math.random() < 0.7 ? 1 : 2)
    return { start: start.position, end: start.position + length }
}

function chooseWeighted<T>(choices: readonly [T, number][]): T {
    const total = choices.reduce((sum, [, weight]) => sum + weight, 0)
    let point = Math.random() * total
    for (const [value, weight] of choices) {
        point -= weight
        if (point < 0) return value
    }
    return choices[choices.length - 1][0]
}
