import type { ExerciseNote, PlayerHit } from '../types'

export type NoteFeedback = 'pending' | 'accurate' | 'slightly-off' | 'off'

const ACCURATE_WINDOW_MS = 50
const SLIGHT_DEVIATION_WINDOW_MS = 150
const STRONG_DEVIATION_WINDOW_MS = 300

/**
 * Match each detected attack to at most one note, so a single hit cannot colour
 * several close sixteenth notes. Attacks outside the feedback window are ignored.
 */
export function getNoteFeedback(
    notes: ExerciseNote[],
    hits: PlayerHit[],
    slots: number,
    measureMs: number,
): Map<string, NoteFeedback> {
    const playableNotes = notes.filter((note) => !note.isRest)
    const candidates = playableNotes
        .flatMap((note, noteIndex) => {
            const expectedTime = (note.position / slots) * measureMs
            return hits
                .map((hit, hitIndex) => ({
                    noteIndex,
                    hitIndex,
                    deviation: Math.abs((hit.time % measureMs) - expectedTime),
                }))
                .filter(({ deviation }) => deviation <= STRONG_DEVIATION_WINDOW_MS)
        })
        .sort((first, second) => first.deviation - second.deviation)

    const matchedNotes = new Set<number>()
    const matchedHits = new Set<number>()
    const feedback = new Map<string, NoteFeedback>()

    candidates.forEach(({ noteIndex, hitIndex, deviation }) => {
        if (matchedNotes.has(noteIndex) || matchedHits.has(hitIndex)) return
        matchedNotes.add(noteIndex)
        matchedHits.add(hitIndex)
        feedback.set(
            playableNotes[noteIndex].id,
            deviation <= ACCURATE_WINDOW_MS
                ? 'accurate'
                : deviation <= SLIGHT_DEVIATION_WINDOW_MS
                  ? 'slightly-off'
                  : 'off',
        )
    })

    playableNotes.forEach((note) => {
        if (!feedback.has(note.id)) feedback.set(note.id, 'pending')
    })

    return feedback
}
