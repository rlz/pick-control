import type { ExerciseNote, PickStroke, TimeSignature } from '../types'

export type SignatureSpec = { beats: number; unit: number; slots: number }
export type GenerationOptions = {
    rests: boolean
    eighths: boolean
    sixteenths: boolean
    palmMutes: boolean
    triplets: boolean
}

type RhythmEvent = { duration: number; isTriplet?: boolean }
type RhythmCell = readonly RhythmEvent[]
type MeasureEvent = RhythmEvent & { position: number; isRest: boolean }

export const signatures: Record<TimeSignature, SignatureSpec> = {
    '4/4': { beats: 4, unit: 4, slots: 16 },
    '3/4': { beats: 3, unit: 4, slots: 12 },
    '6/8': { beats: 2, unit: 8, slots: 12 },
}

export const defaultGenerationOptions: GenerationOptions = {
    rests: true,
    eighths: true,
    sixteenths: true,
    palmMutes: true,
    triplets: true,
}

/** Builds phrases from beat-sized cells selected by the enabled rhythm elements. */
export function generateExercise(
    measures: number,
    options: GenerationOptions,
    signature: TimeSignature,
): ExerciseNote[] {
    const spec = signatures[signature]
    const beatSlots = spec.slots / spec.beats
    const motif = createMotif(spec.beats, beatSlots, signature, options)
    const pattern: ExerciseNote[] = []

    for (let measure = 0; measure < measures; measure++) {
        const events = createMeasure(measure, spec.beats, beatSlots, signature, options, motif)
        const mutedRange = options.palmMutes ? choosePalmMuteRange(events, beatSlots) : null

        let nextStroke: PickStroke = 'down'
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
                isTriplet: event.isTriplet,
                stroke: event.isRest ? undefined : nextStroke,
            })
            if (!event.isRest) nextStroke = nextStroke === 'down' ? 'up' : 'down'
        })
    }

    return pattern
}

function createMotif(
    beats: number,
    beatSlots: number,
    signature: TimeSignature,
    options: GenerationOptions,
): RhythmCell[] {
    return Array.from({ length: beats }, () => chooseCell(beatSlots, signature, options))
}

function createMeasure(
    measure: number,
    beats: number,
    beatSlots: number,
    signature: TimeSignature,
    options: GenerationOptions,
    motif: RhythmCell[],
): MeasureEvent[] {
    const events: MeasureEvent[] = []

    for (let beat = 0; beat < beats; beat++) {
        const varyBeat = measure > 0 && (beat === beats - 1 || Math.random() < 0.2)
        const cell = varyBeat ? chooseCell(beatSlots, signature, options) : motif[beat]
        let offset = beat * beatSlots

        cell.forEach((event, index) => {
            const isDownbeat = beat === 0 && index === 0
            const canRest = !isDownbeat && index === 0 && event.duration >= 2 && !event.isTriplet
            events.push({
                ...event,
                position: offset,
                isRest: options.rests && canRest && Math.random() < 0.12,
            })
            offset += event.duration
        })
    }

    return events
}

function chooseCell(
    beatSlots: number,
    signature: TimeSignature,
    options: GenerationOptions,
): RhythmCell {
    const choices: [RhythmCell, number][] = [[[{ duration: beatSlots }], 4]]

    if (options.eighths) {
        choices.push([[{ duration: beatSlots / 2 }, { duration: beatSlots / 2 }], 5])
    }
    if (options.sixteenths) {
        choices.push([Array.from({ length: 4 }, () => ({ duration: beatSlots / 4 })), 3])
    }
    if (options.triplets) {
        choices.push([
            Array.from({ length: 3 }, () => ({ duration: beatSlots / 3, isTriplet: true })),
            2,
        ])
    }
    if (signature === '6/8' && options.triplets) {
        choices.push([Array.from({ length: 3 }, () => ({ duration: beatSlots / 3 })), 3])
    }

    return chooseWeighted(choices)
}

function choosePalmMuteRange(
    events: MeasureEvent[],
    beatSlots: number,
): { start: number; end: number } | null {
    if (Math.random() >= 0.2) return null
    const playableBeatStarts = events.filter(
        (event) => !event.isRest && event.position % beatSlots === 0,
    )
    const start = playableBeatStarts[Math.floor(Math.random() * playableBeatStarts.length)]
    if (!start) return null
    return {
        start: start.position,
        end: start.position + beatSlots * (Math.random() < 0.7 ? 1 : 2),
    }
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
