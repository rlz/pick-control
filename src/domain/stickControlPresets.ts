import type { ExerciseNote, PickStroke } from '../types'

export type StickControlPreset = { number: number; sticking: string }

// Single Beat Combinations, Stick Control for the Snare Drummer, pp. 5-7.
// Every value contains both printed 4/4 bars: 16 eighth-note strokes.
const stickings = [
    'RLRL RLRL RLRL RLRL', 'LRLR LRLR LRLR LRLR', 'RRLL RRLL RRLL RRLL', 'LLRR LLRR LLRR LLRR',
    'RLRR LRLL RLRR LRLL', 'RLLR LRRL RLLR LRRL', 'RRLR LLRL RRLR LLRL', 'RLRL LRLR RLRL LRLR',
    'RRRL RRRL RRRL RRRL', 'LLLR LLLR LLLR LLLR', 'RLLL RLLL RLLL RLLL', 'LRRR LRRR LRRR LRRR',
    'RRRR LLLL RRRR LLLL', 'RLRL RRLL RLRL RRLL', 'LRLR LLRR LRLR LLRR', 'RLRL RLRR LRLR LRLL',
    'RLRL RLLR LRLR LRRL', 'RLRL RRLR LRLR LLRL', 'RLRL RRRL RLRL RRRL', 'LRLR LLLR LRLR LLLR',
    'RLRL RLLL RLRL RLLL', 'LRLR LRRR LRLR LRRR', 'RLRL RRRR LRLR LLLL', 'RRLL RLRR LLRR LRLL',
    'RRLL RLLR LLRR LRRL', 'RRLL RRLR LLRR LLRL', 'RRLL LLRR RRLL LLRR', 'RRLL RRRL RRLL RRRL',
    'LLRR LLLR LLRR LLLR', 'RRLL RLLL RRLL RLLL', 'LLRR LRRR LLRR LRRR', 'RRLL RRRR LLRR LLLL',
    'RLRR LRRL RLRR LRRL', 'LRLL RLLR LRLL RLLR', 'RLRR LLRL RLRR LLRL', 'LRLL RRLR LRLL RRLR',
    'RLRR RLRR RLRR RLRR', 'LRLL LRLL LRLL LRLL', 'RLRR LLLR LRLL RRRL', 'RLRR LRRR LRLL RLLL',
    'RLRR LLLL RLRR LLLL', 'LRLL RRRR LRLL RRRR', 'RLLR LLRL RLLR LLRL', 'LRRL RRLR LRRL RRLR',
    'RLLR RLLR RLLR RLLR', 'LRRL LRRL LRRL LRRL', 'RLLR LLLR LRRL RRRL', 'RLLR LRRR LRRL RLLL',
    'RLLR LLLL RLLR LLLL', 'LRRL RRRR LRRL RRRR', 'RRLR RRLR RRLR RRLR', 'LLRL LLRL LLRL LLRL',
    'RRLR LLLR LLRL RRRL', 'RRLR LRRR LLRL RLLL', 'RRLR LLLL LLRL LLLL', 'LLRL RRRR RRLR RRRR',
    'RRRL LLLR LLRL LLLR', 'RRRL RLLL RRRL RLLL', 'LLLR LRRR RRRL LRRR', 'RRRL RRRR LLLR LLLL',
    'RLLL LRRR LLLR LRRR', 'RLLL RRRR RLLL LLLL', 'RRRL LLRR LRRR RRRL', 'LLLR RRLL RLLL LLLR',
    'RRLR RLRR LRRR RLRL', 'LLRL LRLL LRRL LRLR', 'RLLR LLRL RLLR RLRL', 'LRRL RRLR LRLL LRLR',
    'RLRR LLLL RLRR LRLL', 'RRLL RLRR RRRR RRRR', 'LLRR LRLL LLLL LLLL', 'RRRR RRRR RRRR RLRL',
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
            stroke: (hand === 'R' ? 'down' : 'up') as PickStroke,
        })),
    ).flat()
}
