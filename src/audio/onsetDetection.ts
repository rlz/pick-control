export async function listenForOnsets(onOnset: (strength: number) => void) {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: false, echoCancellation: false, noiseSuppression: false },
    })
    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    context.createMediaStreamSource(stream).connect(analyser)

    const values = new Uint8Array(analyser.fftSize)
    let lastOnset = 0
    let running = true
    const loop = () => {
        if (!running) return
        analyser.getByteTimeDomainData(values)
        let energy = 0
        for (const value of values) {
            const normalized = (value - 128) / 128
            energy += normalized * normalized
        }
        const strength = Math.sqrt(energy / values.length)
        const now = performance.now()
        if (strength > 0.055 && now - lastOnset > 95) {
            lastOnset = now
            onOnset(strength)
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
