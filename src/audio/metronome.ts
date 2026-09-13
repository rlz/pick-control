export class Metronome {
    private context: AudioContext | null = null
    private timer: number | null = null
    private runId = 0

    private ensureContext() {
        this.context ??= new AudioContext()
        if (this.context.state === 'suspended') void this.context.resume()
        return this.context
    }

    click(accent = false) {
        const context = this.ensureContext()
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.frequency.value = accent ? 1100 : 760
        gain.gain.setValueAtTime(0.0001, context.currentTime)
        gain.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.14, context.currentTime + 0.004)
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.06)
        oscillator.connect(gain).connect(context.destination)
        oscillator.start()
        oscillator.stop(context.currentTime + 0.07)
    }

    start(intervalMs: number | (() => number), onBeat: (beat: number) => void) {
        this.stop()
        const runId = ++this.runId
        let beat = 0
        const tick = () => {
            if (runId !== this.runId) return
            this.click(beat % 4 === 0)
            onBeat(beat++)
            if (runId !== this.runId) return
            const nextInterval = typeof intervalMs === 'function' ? intervalMs() : intervalMs
            this.timer = window.setTimeout(tick, nextInterval)
        }
        tick()
    }

    stop() {
        this.runId++
        if (this.timer !== null) window.clearTimeout(this.timer)
        this.timer = null
    }
}
