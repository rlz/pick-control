export class Metronome {
    private context: AudioContext | null = null
    private timer: number | null = null

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

    start(intervalMs: number, onBeat: (beat: number) => void) {
        this.stop()
        let beat = 0
        this.click(true)
        onBeat(beat++)
        this.timer = window.setInterval(() => {
            this.click(beat % 4 === 0)
            onBeat(beat++)
        }, intervalMs)
    }

    stop() {
        if (this.timer !== null) window.clearInterval(this.timer)
        this.timer = null
    }
}
