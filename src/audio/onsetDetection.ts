import { defaultDetectorParameters, type DetectorParameters } from './calibration'
import { OnsetDetector, type AudioFrame, type DetectedAttack } from './detector'

export type AudioLevel = {
    rms: number
    peak: number
}

export type { DetectedAttack } from './detector'

export type OnsetDetectionOptions = {
    deviceId?: string
    onLevel?: (level: AudioLevel) => void
    onAttack?: (attack: DetectedAttack) => void
    onStream?: (stream: MediaStream) => void
    detector?: Partial<DetectorParameters>
    getDetector?: () => Partial<DetectorParameters> | undefined
    /** Consume a request to discard the previous note's envelope state. */
    consumeResetDetector?: () => boolean
    isDetecting?: () => boolean
}

export async function listenForOnsets(
    onOnset: (strength: number, time: number) => void,
    {
        deviceId,
        onLevel,
        onAttack,
        onStream,
        detector,
        getDetector,
        consumeResetDetector,
        isDetecting,
    }: OnsetDetectionOptions = {},
) {
    const audioConstraints = {
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
    }
    let stream: MediaStream
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                ...audioConstraints,
                ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
            },
        })
    } catch (error) {
        // Audio interfaces can be unplugged between calibrations. A stale saved
        // device ID must not make the built-in/default microphone inaccessible.
        if (!deviceId) throw error
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
    }
    const context = new AudioContext()
    const source = context.createMediaStreamSource(stream)
    onStream?.(stream)
    const levelAnalyser = context.createAnalyser()
    levelAnalyser.fftSize = 512
    const attackFilter = context.createBiquadFilter()
    attackFilter.type = 'highpass'
    // Guitar notes keep their low frequencies for a long time, while the pick
    // attack has more upper-mid energy. 2.5 kHz proved too narrow for a single
    // plucked string: its transient can be strong around 1–2 kHz but nearly
    // absent above 2.5 kHz. Keeping the filter above the fundamentals still
    // rejects most of the ringing note without throwing that transient away.
    attackFilter.frequency.value = 1200
    attackFilter.Q.value = 0.7
    // ScriptProcessor gives fixed, contiguous audio buffers. Keeping them for
    // a moment before processing avoids making onset decisions mid-transient.
    const frameProcessor = context.createScriptProcessor(1024, 1, 1)
    const silentOutput = context.createGain()
    silentOutput.gain.value = 0
    source.connect(levelAnalyser)
    source.connect(attackFilter).connect(frameProcessor).connect(silentOutput).connect(context.destination)

    const values = new Uint8Array(levelAnalyser.fftSize)
    const onsetDetector = new OnsetDetector()
    const bufferedFrames: AudioFrame[] = []
    let nextBufferedFrame = 0
    const analysisDelayMs = 1000
    frameProcessor.onaudioprocess = (event) => {
        const samples = event.inputBuffer.getChannelData(0)
        let energy = 0
        for (const sample of samples) energy += sample * sample
        const attackStrength = Math.sqrt(energy / samples.length)
        bufferedFrames.push({
            time: performance.now(),
            strength: attackStrength,
            attackStrength,
        })
    }
    let running = true
    const loop = () => {
        if (!running) return
        levelAnalyser.getByteTimeDomainData(values)
        let energy = 0
        let peak = 0
        for (const value of values) {
            const normalized = (value - 128) / 128
            energy += normalized * normalized
            peak = Math.max(peak, Math.abs(normalized))
        }
        const strength = Math.sqrt(energy / values.length)
        onLevel?.({ rms: strength, peak })

        const now = performance.now()
        if (consumeResetDetector?.() || (isDetecting && !isDetecting())) {
            onsetDetector.reset()
            bufferedFrames.length = 0
            nextBufferedFrame = 0
            requestAnimationFrame(loop)
            return
        }
        const parameters = {
            ...defaultDetectorParameters,
            ...detector,
            ...getDetector?.(),
        }
        while (
            nextBufferedFrame < bufferedFrames.length &&
            bufferedFrames[nextBufferedFrame].time <= now - analysisDelayMs
        ) {
            const attack = onsetDetector.process(bufferedFrames[nextBufferedFrame++], parameters)
            if (attack) {
                onOnset(attack.strength, attack.time)
                onAttack?.(attack)
            }
        }
        if (nextBufferedFrame > 256) {
            bufferedFrames.splice(0, nextBufferedFrame)
            nextBufferedFrame = 0
        }
        requestAnimationFrame(loop)
    }
    loop()

    return () => {
        running = false
        stream.getTracks().forEach((track) => track.stop())
        void context.close()
    }
}
