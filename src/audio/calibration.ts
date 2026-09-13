export type DetectorParameters = {
    minimumAttackStrength: number
    baselineRatio: number
    riseRatio: number
    minIntervalMs: number
}

export type AudioCalibration = {
    deviceId: string
    latencyMs: number
    detector: DetectorParameters
    calibratedAt: number
}

export const defaultDetectorParameters: DetectorParameters = {
    minimumAttackStrength: 0.0007,
    baselineRatio: 1.8,
    riseRatio: 1.25,
    minIntervalMs: 160,
}

const storageKey = 'taktcontrol.audio-calibration.v1'

export function getAudioCalibration(): AudioCalibration | null {
    try {
        const value = window.localStorage.getItem(storageKey)
        return value ? (JSON.parse(value) as AudioCalibration) : null
    } catch {
        return null
    }
}

export function saveAudioCalibration(calibration: AudioCalibration) {
    window.localStorage.setItem(storageKey, JSON.stringify(calibration))
}
