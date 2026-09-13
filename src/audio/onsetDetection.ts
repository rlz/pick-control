import { defaultDetectorParameters, type DetectorParameters } from './calibration'
import { OnsetDetector, type DetectedAttack } from './detector'

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
    onOnset: (strength: number) => void,
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
    const attackAnalyser = context.createAnalyser()
    attackAnalyser.fftSize = 512
    source.connect(levelAnalyser)
    source.connect(attackFilter).connect(attackAnalyser)

    const values = new Uint8Array(levelAnalyser.fftSize)
    const attackValues = new Uint8Array(attackAnalyser.fftSize)
    const onsetDetector = new OnsetDetector()
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

        attackAnalyser.getByteTimeDomainData(attackValues)
        let attackEnergy = 0
        for (const value of attackValues) {
            const normalized = (value - 128) / 128
            attackEnergy += normalized * normalized
        }
        const attackStrength = Math.sqrt(attackEnergy / attackValues.length)
        const now = performance.now()
        if (consumeResetDetector?.() || (isDetecting && !isDetecting())) {
            onsetDetector.reset()
            requestAnimationFrame(loop)
            return
        }
        const parameters = {
            ...defaultDetectorParameters,
            ...detector,
            ...getDetector?.(),
        }
        const attack = onsetDetector.process(
            {
            time: now,
            strength,
            attackStrength,
            },
            parameters,
        )
        if (attack) {
            onOnset(attack.strength)
            onAttack?.(attack)
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
