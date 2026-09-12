import type { ExerciseNote } from '../types'

export type StepKind = 'note' | 'mute' | 'triplet' | 'continue' | 'rest'

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
            steps[start] = note.isRest
                ? 'rest'
                : note.palmMuted
                  ? 'mute'
                  : note.isTriplet
                    ? 'triplet'
                    : 'note'
            for (let position = start + 1; position < Math.min(slots, start + length); position++) {
                steps[position] = 'continue'
            }
        })

    return steps
}

export function stepsToNotes(steps: StepKind[], measure: number): ExerciseNote[] {
    const notes: ExerciseNote[] = []
    let lastNote: ExerciseNote | undefined

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
                }
                notes.push(note)
                lastNote = note
            }
            position = end
            continue
        }

        const note: ExerciseNote = {
            id: `${measure}-${position}`,
            measure,
            position,
            duration: 1,
            isRest: kind === 'rest',
            palmMuted: kind === 'mute',
        }
        notes.push(note)
        lastNote = note
        position++
    }
    return notes
}
