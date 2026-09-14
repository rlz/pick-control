import type { AudioFrame } from './detector'

/**
 * Recreate the detector's envelope from a recorded microphone take. This keeps
 * calibration independent of whichever thresholds happened to be active while
 * the player was recording.
 */
export async function analyseCalibrationRecording(blob: Blob, startedAt: number) {
    const context = new AudioContext()
    try {
        const decoded = await context.decodeAudioData(await blob.arrayBuffer())
        const offline = new OfflineAudioContext(1, decoded.length, decoded.sampleRate)
        const source = offline.createBufferSource()
        source.buffer = decoded
        const filter = offline.createBiquadFilter()
        filter.type = 'highpass'
        filter.frequency.value = 1200
        filter.Q.value = 0.7
        source.connect(filter).connect(offline.destination)
        source.start()
        const filtered = await offline.startRendering()
        const samples = filtered.getChannelData(0)
        const sourceSamples = decoded.getChannelData(0)
        const frameSize = 1024
        // The live analyser is sampled once per animation frame, close to 60 Hz.
        const hopSize = Math.max(frameSize, Math.round(decoded.sampleRate / 60))
        const frames: AudioFrame[] = []

        for (let offset = 0; offset + frameSize <= samples.length; offset += hopSize) {
            let energy = 0
            let sourceEnergy = 0
            for (let index = offset; index < offset + frameSize; index += 1) {
                energy += samples[index] * samples[index]
                sourceEnergy += sourceSamples[index] * sourceSamples[index]
            }
            const attackStrength = Math.sqrt(energy / frameSize)
            frames.push({
                time: startedAt + (offset / samples.length) * decoded.duration * 1000,
                strength: Math.sqrt(sourceEnergy / frameSize),
                attackStrength,
            })
        }
        return frames
    } finally {
        void context.close()
    }
}
