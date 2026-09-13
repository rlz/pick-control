import { defaultDetectorParameters, type DetectorParameters } from './calibration'

export type AudioLevel = {
    rms: number
    peak: number
}

export type DetectedAttack = {
    time: number
    strength: number
    attackStrength: number
    baselineRatio: number
    riseRatio: number
}

export type OnsetDetectionOptions = {
    deviceId?: string
    onLevel?: (level: AudioLevel) => void
    onAttack?: (attack: DetectedAttack) => void
    detector?: Partial<DetectorParameters>
    getDetector?: () => Partial<DetectorParameters> | undefined
    isDetecting?: () => boolean
}

export async function listenForOnsets(
    onOnset: (strength: number) => void,
    { deviceId, onLevel, onAttack, detector, getDetector, isDetecting }: OnsetDetectionOptions = {},
) {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
    })
    const context = new AudioContext()
    const source = context.createMediaStreamSource(stream)
    const levelAnalyser = context.createAnalyser()
    levelAnalyser.fftSize = 512
    const attackFilter = context.createBiquadFilter()
    attackFilter.type = 'highpass'
    // Guitar notes keep their low frequencies for a long time. The pick attack,
    // however, briefly adds energy above roughly 2.5 kHz.
    attackFilter.frequency.value = 2500
    attackFilter.Q.value = 0.7
    const attackAnalyser = context.createAnalyser()
    attackAnalyser.fftSize = 512
    source.connect(levelAnalyser)
    source.connect(attackFilter).connect(attackAnalyser)

    const values = new Uint8Array(levelAnalyser.fftSize)
    const attackValues = new Uint8Array(attackAnalyser.fftSize)
    let lastOnset = -Infinity
    let lastAttackPeak = 0
    let waitingForRelease = false
    let releaseFrames = 0
    let previousAttackStrength = 0
    let candidate: DetectedAttack | null = null
    const attackHistory: number[] = []
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
        if (isDetecting && !isDetecting()) {
            lastOnset = -Infinity
            lastAttackPeak = 0
            waitingForRelease = false
            releaseFrames = 0
            previousAttackStrength = 0
            candidate = null
            attackHistory.length = 0
            requestAnimationFrame(loop)
            return
        }
        const parameters = {
            ...defaultDetectorParameters,
            ...detector,
            ...getDetector?.(),
        }
        // A plucked string keeps ringing after the initial attack. Comparing every
        // animation frame to the preceding one consequently turns its natural
        // vibration into several "attacks". Keep a short history to estimate the
        // local floor, then emit only the top of a rising envelope.
        const recentFloor = attackHistory.length
            ? Math.min(...attackHistory.slice(-8))
            : Math.max(parameters.minimumAttackStrength * 0.5, 0.000001)
        const baseline = attackHistory.length
            ? [...attackHistory].sort((left, right) => left - right)[
                  Math.floor((attackHistory.length - 1) * 0.2)
              ]
            : recentFloor
        const attack: DetectedAttack = {
            time: now,
            strength,
            attackStrength,
            baselineRatio: attackStrength / Math.max(baseline, 0.000001),
            riseRatio: attackStrength / Math.max(recentFloor, 0.000001),
        }

        if (attackStrength >= previousAttackStrength) {
            candidate =
                !candidate || attackStrength >= candidate.attackStrength ? attack : candidate
        } else if (candidate) {
            const isAttack =
                candidate.attackStrength > parameters.minimumAttackStrength &&
                candidate.baselineRatio > parameters.baselineRatio &&
                candidate.riseRatio > parameters.riseRatio
            // A fresh attack must either follow the decay of the prior note or be
            // materially stronger than it. This is what rejects repeated peaks in
            // a single ringing string while allowing deliberately accented notes.
            const hasReleased =
                !waitingForRelease || candidate.attackStrength > lastAttackPeak * 1.35
            if (isAttack && hasReleased && candidate.time - lastOnset > parameters.minIntervalMs) {
                lastOnset = candidate.time
                lastAttackPeak = candidate.attackStrength
                waitingForRelease = true
                onOnset(candidate.strength)
                onAttack?.(candidate)
            }
            candidate = null
        }

        if (waitingForRelease) {
            releaseFrames = attackStrength < lastAttackPeak * 0.65 ? releaseFrames + 1 : 0
            if (releaseFrames >= 3) {
                waitingForRelease = false
                releaseFrames = 0
            }
        }
        attackHistory.push(attackStrength)
        if (attackHistory.length > 36) attackHistory.shift()
        previousAttackStrength = attackStrength
        requestAnimationFrame(loop)
    }
    loop()

    return () => {
        running = false
        stream.getTracks().forEach((track) => track.stop())
        void context.close()
    }
}
