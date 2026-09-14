import type { DetectorParameters } from './calibration'

export type AudioFrame = {
    time: number
    strength: number
    attackStrength: number
}

export type DetectedAttack = AudioFrame & {
    baselineRatio: number
    riseRatio: number
}

/** Stateful onset detector shared by live input and calibration recordings. */
export class OnsetDetector {
    private lastOnset = -Infinity
    private lastAttackPeak = 0
    private ringingPeak = 0
    private waitingForRelease = false
    private releaseFrames = 0
    private previousAttackStrength = 0
    private candidate: DetectedAttack | null = null
    private attackHistory: number[] = []

    reset() {
        this.lastOnset = -Infinity
        this.lastAttackPeak = 0
        this.ringingPeak = 0
        this.waitingForRelease = false
        this.releaseFrames = 0
        this.previousAttackStrength = 0
        this.candidate = null
        this.attackHistory = []
    }

    process(frame: AudioFrame, parameters: DetectorParameters): DetectedAttack | null {
        const recentFloor = this.attackHistory.length
            ? Math.min(...this.attackHistory.slice(-8))
            : Math.max(parameters.minimumAttackStrength * 0.5, 0.000001)
        const baseline = this.attackHistory.length
            ? [...this.attackHistory].sort((left, right) => left - right)[
                  Math.floor((this.attackHistory.length - 1) * 0.2)
              ]
            : recentFloor
        const attack: DetectedAttack = {
            ...frame,
            baselineRatio: frame.attackStrength / Math.max(baseline, 0.000001),
            riseRatio: frame.attackStrength / Math.max(recentFloor, 0.000001),
        }
        let detected: DetectedAttack | null = null

        if (frame.attackStrength >= this.previousAttackStrength) {
            this.candidate =
                !this.candidate || frame.attackStrength >= this.candidate.attackStrength
                    ? attack
                    : this.candidate
        } else if (this.candidate) {
            const hasFreshTransient =
                this.candidate.baselineRatio > parameters.baselineRatio &&
                this.candidate.riseRatio > parameters.riseRatio
            const isAttack =
                this.candidate.attackStrength > parameters.minimumAttackStrength &&
                hasFreshTransient &&
                // Never let a diminishing resonance become another hit merely
                // because its local baseline also fell. This applies to both
                // the normal and delayed-rearm paths.
                (!this.ringingPeak || this.candidate.attackStrength > this.ringingPeak * 0.65)
            const hasReleased = this.waitingForRelease
                ? this.candidate.attackStrength > this.ringingPeak * 0.65
                : this.candidate.attackStrength > this.lastAttackPeak * 0.45
            if (
                isAttack &&
                hasReleased &&
                this.candidate.time - this.lastOnset > parameters.minIntervalMs
            ) {
                this.lastOnset = this.candidate.time
                this.lastAttackPeak = this.candidate.attackStrength
                this.ringingPeak = Math.max(this.ringingPeak, this.candidate.attackStrength)
                this.waitingForRelease = true
                detected = this.candidate
            }
            this.candidate = null
        }

        if (this.waitingForRelease) {
            this.releaseFrames =
                frame.attackStrength < this.lastAttackPeak * 0.35 ? this.releaseFrames + 1 : 0
            if (this.releaseFrames >= 8) {
                this.waitingForRelease = false
                this.releaseFrames = 0
                this.ringingPeak = 0
            }
        }
        this.attackHistory.push(frame.attackStrength)
        if (this.attackHistory.length > 36) this.attackHistory.shift()
        this.previousAttackStrength = frame.attackStrength
        return detected
    }
}
