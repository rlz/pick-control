import type { ExerciseNote, PickStroke } from '../types'

export type StickControlPreset = { number: number; sticking: string }

// Single Beat Combinations, Stick Control for the Snare Drummer, pp. 5-7.
// Every value contains both printed 4/4 bars: 16 eighth-note strokes.
const stickings = [
    '0101 0101 0101 0101',
    '1010 1010 1010 1010',
    '0011 0011 0011 0011',
    '1100 1100 1100 1100',
    '0100 1011 0100 1011',
    '0110 1001 0110 1001',
    '0010 1101 0010 1101',
    '0101 1010 0101 1010',
    '0001 0001 0001 0001',
    '1110 1110 1110 1110',
    '0111 0111 0111 0111',
    '1000 1000 1000 1000',
    '0000 1111 0000 1111',
    '0101 0011 0101 0011',
    '1010 1100 1010 1100',
    '0101 0100 1010 1011',
    '0101 0110 1010 1001',
    '0101 0010 1010 1101',
    '0101 0001 0101 0001',
    '1010 1110 1010 1110',
    '0101 0111 0101 0111',
    '1010 1000 1010 1000',
    '0101 0000 1010 1111',
    '0011 0100 1100 1011',
    '0011 0110 1100 1001',
    '0011 0010 1100 1101',
    '0011 1100 0011 1100',
    '0011 0001 0011 0001',
    '1100 1110 1100 1110',
    '0011 0111 0011 0111',
    '1100 1000 1100 1000',
    '0011 0000 1100 1111',
    '0100 1001 0100 1001',
    '1011 0110 1011 0110',
    '0100 1101 0100 1101',
    '1011 0010 1011 0010',
    '0100 0100 0100 0100',
    '1011 1011 1011 1011',
    '0100 1110 1011 0001',
    '0100 1000 1011 0111',
    '0100 1111 0100 1111',
    '1011 0000 1011 0000',
    '0110 1101 0110 1101',
    '1001 0010 1001 0010',
    '0110 0110 0110 0110',
    '1001 1001 1001 1001',
    '0110 1110 1001 0001',
    '0110 1000 1001 0111',
    '0110 1111 0110 1111',
    '1001 0000 1001 0000',
    '0010 0010 0010 0010',
    '1101 1101 1101 1101',
    '0010 1110 1101 0001',
    '0010 1000 1101 0111',
    '0010 1111 1101 1111',
    '1101 0000 0010 0000',
    '0001 1110 1101 1110',
    '0001 0111 0001 0111',
    '1110 1000 0001 1000',
    '0001 0000 1110 1111',
    '0111 1000 1110 1000',
    '0111 0000 0111 1111',
    '0001 1100 1000 0001',
    '1110 0011 0111 1110',
    '0010 0100 1000 0101',
    '1101 1011 1001 1010',
    '0110 1101 0110 0101',
    '1001 0010 1011 1010',
    '0100 1111 0100 1011',
    '0011 0100 0000 0000',
    '1100 1011 1111 1111',
    '0000 0000 0000 0101',
].map((sticking) => sticking.replaceAll(' ', ''))

export const stickControlPresets: StickControlPreset[] = stickings.map((sticking, index) => ({
    number: index + 1,
    sticking,
}))

export function presetToExercise(preset: StickControlPreset): ExerciseNote[] {
    return Array.from({ length: 2 }, (_, measure) =>
        [...preset.sticking.slice(measure * 8, (measure + 1) * 8)].map((hand, index) => ({
            id: `${measure}-${index * 2}`,
            measure,
            position: index * 2,
            duration: 2,
            stroke: (hand === '0' ? 'down' : 'up') as PickStroke,
        })),
    ).flat()
}

export function findPresetNumber(exercise: ExerciseNote[]) {
    return stickControlPresets.find((preset) => {
        const presetExercise = presetToExercise(preset)
        return (
            exercise.length === presetExercise.length &&
            exercise.every((note, index) => {
                const presetNote = presetExercise[index]
                return (
                    note.measure === presetNote.measure &&
                    note.position === presetNote.position &&
                    note.duration === presetNote.duration &&
                    note.stroke === presetNote.stroke &&
                    !note.isRest
                )
            })
        )
    })?.number
}
