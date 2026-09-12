import type { Player } from 'soundfont-player'

type PreviewNote = { measure: number; position: number; isRest?: boolean; palmMuted?: boolean }

let context: AudioContext | null = null
let guitar: Promise<Player> | null = null
let input: AudioNode | null = null

function getInput(audioContext: AudioContext) {
    if (input) return input
    const cabinet = audioContext.createBiquadFilter()
    cabinet.type = 'lowpass'
    cabinet.frequency.value = 4600
    cabinet.Q.value = 0.7
    const compressor = audioContext.createDynamicsCompressor()
    compressor.threshold.value = -24
    compressor.knee.value = 8
    compressor.ratio.value = 5
    compressor.attack.value = 0.003
    compressor.release.value = 0.09
    const output = audioContext.createGain()
    output.gain.value = 0.7
    cabinet.connect(compressor).connect(output).connect(audioContext.destination)
    input = cabinet
    return input
}

async function getGuitar() {
    context ??= new AudioContext()
    if (context.state === 'suspended') await context.resume()
    guitar ??= import('soundfont-player').then(({ instrument }) =>
        instrument(context!, 'distortion_guitar', {
            soundfont: 'FluidR3_GM',
            destination: getInput(context!),
        }),
    )
    return { context, player: await guitar }
}

export async function playRhythmPattern(
    notes: PreviewNote[],
    bpm: number,
    beatsPerMeasure: number,
    slotsPerMeasure: number,
    measureStart = 0,
    measureCount?: number,
) {
    const { context: audioContext, player } = await getGuitar()
    const scheduledNotes: Player[] = []
    const beatSeconds = 60 / bpm
    const startAt = audioContext.currentTime + 0.08
    const lastMeasure =
        measureStart + (measureCount ?? Math.max(...notes.map((note) => note.measure), 0) + 1)

    notes
        .filter(
            (note) => !note.isRest && note.measure >= measureStart && note.measure < lastMeasure,
        )
        .forEach((note) => {
            const time =
                startAt +
                (note.measure - measureStart) * beatsPerMeasure * beatSeconds +
                (note.position / slotsPerMeasure) * beatsPerMeasure * beatSeconds
            const strings = note.palmMuted ? ['G2', 'D3'] : ['G2', 'D3', 'G3']
            strings.forEach((pitch, stringIndex) => {
                scheduledNotes.push(
                    player.play(pitch, time + stringIndex * 0.007, {
                        gain: note.palmMuted ? 0.15 : 0.12,
                        duration: note.palmMuted ? 0.13 : 0.42,
                    }),
                )
            })
        })
    return {
        startsAt: performance.now() + 80,
        stop: () => scheduledNotes.forEach((note) => note.stop(audioContext.currentTime)),
    }
}
