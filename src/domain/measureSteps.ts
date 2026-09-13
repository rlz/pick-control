import type { ExerciseNote, PickStroke } from '../types'

export type StepKind = 'note' | 'mute' | 'triplet' | 'continue' | 'rest'

export function notesToStrokes(notes: ExerciseNote[], slots: number): (PickStroke | undefined)[] {
    const strokes: (PickStroke | undefined)[] = Array.from({ length: slots })
    notes.forEach((note) => {
        if (Math.abs(note.position - Math.round(note.position)) > 0.01) return
        const position = Math.round(note.position)
        if (position >= 0 && position < slots && !note.isRest) strokes[position] = note.stroke
    })
    return strokes
}

export function notesToSteps(notes: ExerciseNote[], slots: number): StepKind[] {
    const steps: StepKind[] = Array.from({ length: slots }, () => 'rest')
    const groupedTriplets = new Set<ExerciseNote>()

    for (let index = 0; index < notes.length - 2; index++) {
        const group = notes.slice(index, index + 3)
        if (!group.every((note) => note.isTriplet)) continue

        const duration = group[0].duration
        const isSequential = group.every(
            (note, groupIndex) =>
                Math.abs(note.position - (group[0].position + duration * groupIndex)) < 0.01 &&
                Math.abs(note.duration - duration) < 0.01,
        )
        if (!isSequential) continue

        const start = Math.max(0, Math.round(group[0].position))
        const span = Math.max(1, Math.round(duration * 3))
        if (start + span > slots) continue

        steps[start] = 'triplet'
        steps.fill('continue', start + 1, start + span)
        group.forEach((note) => groupedTriplets.add(note))
        index += 2
    }

    notes
        .filter((note) => !groupedTriplets.has(note))
        .forEach((note) => {
            const start = Math.max(0, Math.round(note.position))
            const length = Math.max(1, Math.round(note.duration))
            if (start >= slots) return
            if (note.isRest) {
                steps.fill('rest', start, Math.min(slots, start + length))
                return
            }
            steps[start] = note.palmMuted ? 'mute' : note.isTriplet ? 'triplet' : 'note'
            for (let position = start + 1; position < Math.min(slots, start + length); position++) {
                steps[position] = 'continue'
            }
        })

    return steps
}

export function stepsToNotes(
    steps: StepKind[],
    measure: number,
    strokes: (PickStroke | undefined)[] = [],
): ExerciseNote[] {
    const notes: ExerciseNote[] = []
    let lastNote: ExerciseNote | undefined
    let nextStroke: PickStroke = 'down'

    const strokeFor = (position: number) => {
        const selected = strokes[Math.round(position)]
        const stroke = selected ?? nextStroke
        nextStroke = stroke === 'down' ? 'up' : 'down'
        return stroke
    }

    for (let position = 0; position < steps.length;) {
        const kind = steps[position]
        if (kind === 'continue') {
            if (lastNote) lastNote.duration += 1
            position++
            continue
        }
        if (kind === 'triplet') {
            let end = position + 1
            while (end < steps.length && steps[end] === 'continue') end++
            const duration = (end - position) / 3
            for (let index = 0; index < 3; index++) {
                const tripletPosition = position + duration * index
                const note: ExerciseNote = {
                    id: `${measure}-${tripletPosition}`,
                    measure,
                    position: tripletPosition,
                    duration,
                    isTriplet: true,
                    stroke: strokeFor(tripletPosition),
                }
                notes.push(note)
                lastNote = note
            }
            position = end
            continue
        }
        if (kind === 'rest') {
            let end = position + 1
            while (end < steps.length && steps[end] === 'rest') end++
            const rests = restNotes(position, end, measure)
            notes.push(...rests)
            lastNote = rests.at(-1)
            position = end
            continue
        }

        const note: ExerciseNote = {
            id: `${measure}-${position}`,
            measure,
            position,
            duration: 1,
            isRest: false,
            palmMuted: kind === 'mute',
            stroke: strokeFor(position),
        }
        notes.push(note)
        lastNote = note
        position++
    }
    return notes
}

/** Uses the largest notation-friendly rest values while preserving the silent span. */
function restNotes(start: number, end: number, measure: number): ExerciseNote[] {
    const notes: ExerciseNote[] = []
    const durations = [16, 12, 8, 6, 4, 3, 2, 1]
    let position = start

    while (position < end) {
        const duration = durations.find((candidate) => candidate <= end - position) ?? 1
        notes.push({
            id: `${measure}-${position}`,
            measure,
            position,
            duration,
            isRest: true,
        })
        position += duration
    }

    return notes
}
