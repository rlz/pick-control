import normalSampleUrl from './normal-guitar.mp3'
import palmMutedSampleUrl from './palm-muted-guitar.mp3'

type PreviewNote = { measure: number; position: number; isRest?: boolean; palmMuted?: boolean }

let context: AudioContext | null = null
let samples: Promise<{ normal: AudioBuffer; palmMuted: AudioBuffer }> | null = null

async function decodeSample(audioContext: AudioContext, url: string) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Could not load guitar sample (${response.status})`)
    return audioContext.decodeAudioData(await response.arrayBuffer())
}

async function getSamples(audioContext: AudioContext) {
    samples ??= Promise.all([
        decodeSample(audioContext, normalSampleUrl),
        decodeSample(audioContext, palmMutedSampleUrl),
    ]).then(([normal, palmMuted]) => ({ normal, palmMuted }))
    try {
        return await samples
    } catch (error) {
        // A transient fetch or decode failure should not poison every later preview.
        samples = null
        throw error
    }
}

export async function playRhythmPattern(
    notes: PreviewNote[],
    bpm: number,
    beatsPerMeasure: number,
    slotsPerMeasure: number,
    measureStart = 0,
    measureCount?: number,
) {
    context ??= new AudioContext()
    const audioContext = context
    if (audioContext.state === 'suspended') await audioContext.resume()
    const { normal, palmMuted } = await getSamples(audioContext)
    const scheduledNotes = new Set<AudioBufferSourceNode>()
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
            const isPalmMuted = Boolean(note.palmMuted)
            const source = audioContext.createBufferSource()
            const gain = audioContext.createGain()
            const duration = isPalmMuted ? 0.125 : 0.42
            source.buffer = isPalmMuted ? palmMuted : normal
            gain.gain.setValueAtTime(0.55, time)
            gain.gain.setValueAtTime(0.55, time + duration - 0.025)
            gain.gain.linearRampToValueAtTime(0.0001, time + duration)
            source.connect(gain).connect(audioContext.destination)
            source.addEventListener('ended', () => scheduledNotes.delete(source), { once: true })
            source.start(time)
            source.stop(time + duration)
            scheduledNotes.add(source)
        })
    return {
        startsAt: performance.now() + 80,
        stop: () => scheduledNotes.forEach((note) => note.stop(audioContext.currentTime)),
    }
}
