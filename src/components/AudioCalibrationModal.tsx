import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowsRotate, faMicrophone, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useRef, useState } from 'react'
import {
    Metronome,
    getAudioCalibration,
    listenForOnsets,
    saveAudioCalibration,
    type AudioLevel,
    type DetectedAttack,
    type DetectorParameters,
} from '../audio'
import { analyseCalibrationRecording } from '../audio/calibrationAnalysis'
import { OnsetDetector } from '../audio/detector'

type InputDevice = Pick<MediaDeviceInfo, 'deviceId' | 'label'>

type DetectionEvent = {
    id: number
    time: number
    strength: number
}

type Props = {
    onClose: () => void
}

type CalibrationState = 'idle' | 'count-in' | 'running' | 'analysing' | 'complete'

type CalibrationSummary = {
    matched: number
    missed: number
    falsePositives: number
    latencyMs: number
    saved: boolean
    error?: string
}

const meterFloorDb = -60
const timelineWindowMs = 4000
const calibrationBpm = 90
const calibrationBeats = 16
const countInBeats = 4
const initialMatchWindowMs = 300
const alignedMatchWindowMs = 220
const calibrationDetector = {
    // Be deliberately permissive while learning the player's quietest useful
    // attack. The saved profile below is calculated from beats that actually
    // matched the metronome, so noise does not become a reference level.
    minimumAttackStrength: 0.00002,
    baselineRatio: 1.001,
    riseRatio: 1.001,
    minIntervalMs: 70,
}

function toDecibels(value: number) {
    return Math.max(meterFloorDb, 20 * Math.log10(Math.max(value, 0.000001)))
}

function toMeterPercent(value: number) {
    return Math.min(100, Math.max(0, ((toDecibels(value) - meterFloorDb) / -meterFloorDb) * 100))
}

function median(values: number[]) {
    const sorted = [...values].sort((left, right) => left - right)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function percentile(values: number[], position: number) {
    const sorted = [...values].sort((left, right) => left - right)
    return sorted[Math.floor((sorted.length - 1) * position)]
}

export function AudioCalibrationModal({ onClose }: Props) {
    const [savedCalibration, setSavedCalibration] = useState(getAudioCalibration)
    const [devices, setDevices] = useState<InputDevice[]>([])
    const [deviceId, setDeviceId] = useState(savedCalibration?.deviceId ?? '')
    const [level, setLevel] = useState<AudioLevel>({ rms: 0, peak: 0 })
    const [events, setEvents] = useState<DetectionEvent[]>([])
    const [timelineNow, setTimelineNow] = useState(0)
    const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting')
    const [calibrationState, setCalibrationState] = useState<CalibrationState>('idle')
    const [countInBeat, setCountInBeat] = useState(0)
    const [summary, setSummary] = useState<CalibrationSummary | null>(null)
    const cleanup = useRef<null | (() => void)>(null)
    const eventId = useRef(0)
    const metronome = useRef(new Metronome())
    const calibrationRunning = useRef(false)
    const calibrationActive = useRef(false)
    const resetDetector = useRef(false)
    const beatTimes = useRef<number[]>([])
    const audioStream = useRef<MediaStream | null>(null)
    const recorder = useRef<MediaRecorder | null>(null)
    const recordingChunks = useRef<Blob[]>([])
    const recordingStartedAt = useRef(0)
    const finishTimer = useRef<number | null>(null)
    const detector = useRef<Partial<DetectorParameters>>(
        savedCalibration?.detector ?? calibrationDetector,
    )

    useEffect(() => {
        let active = true
        const activeMetronome = metronome.current

        void listenForOnsets(() => undefined, {
            deviceId: deviceId || undefined,
            getDetector: () => detector.current,
            onStream: (stream) => {
                audioStream.current = stream
            },
            consumeResetDetector: () => {
                if (!resetDetector.current) return false
                resetDetector.current = false
                return true
            },
            onAttack: (attack) => {
                if (!active) return
                setEvents((previous) =>
                    [
                        {
                            id: eventId.current++,
                            time: attack.time,
                            strength: attack.strength,
                        },
                        ...previous,
                    ].slice(0, 50),
                )
            },
            isDetecting: () => !calibrationActive.current,
            onLevel: (nextLevel) => active && setLevel(nextLevel),
        })
            .then((stop) => {
                if (!active) {
                    stop()
                    return
                }
                cleanup.current = stop
                setStatus('ready')
                return navigator.mediaDevices.enumerateDevices()
            })
            .then((available) => {
                if (!active || !available) return
                const inputs = available
                    .filter((device) => device.kind === 'audioinput')
                    .map(({ deviceId: id, label }) => ({ deviceId: id, label }))
                setDevices(inputs)
                if (deviceId && !inputs.some((input) => input.deviceId === deviceId)) {
                    setDeviceId('')
                }
            })
            .catch(() => active && setStatus('error'))

        return () => {
            active = false
            calibrationRunning.current = false
            calibrationActive.current = false
            activeMetronome.stop()
            if (finishTimer.current !== null) clearTimeout(finishTimer.current)
            if (recorder.current?.state === 'recording') recorder.current.stop()
            cleanup.current?.()
            cleanup.current = null
        }
    }, [deviceId])

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    useEffect(() => {
        let frame = 0
        const update = (now: number) => {
            setTimelineNow(now)
            frame = requestAnimationFrame(update)
        }
        frame = requestAnimationFrame(update)
        return () => cancelAnimationFrame(frame)
    }, [])

    async function finishCalibration() {
        calibrationRunning.current = false
        metronome.current.stop()
        setCalibrationState('analysing')
        const activeRecorder = recorder.current
        if (activeRecorder?.state === 'recording') {
            await new Promise<void>((resolve) => {
                activeRecorder.addEventListener('stop', () => resolve(), { once: true })
                activeRecorder.stop()
            })
        }
        calibrationActive.current = false
        const firstBeat = beatTimes.current[0] ?? 0
        const lastBeat = beatTimes.current.at(-1) ?? 0
        const recording = new Blob(recordingChunks.current, {
            type: recorder.current?.mimeType || 'audio/webm',
        })
        const recordedFrames = recording.size
            ? await analyseCalibrationRecording(recording, recordingStartedAt.current)
            : []
        const recordingWindow = recordedFrames.filter(
            (frame) =>
                frame.time >= firstBeat - initialMatchWindowMs &&
                frame.time <= lastBeat + initialMatchWindowMs,
        )
        // Players commonly anticipate a click by a few milliseconds. Associate
        // each detected attack with only one metronome beat, then centre the
        // stricter pass around the measured latency instead of assuming the
        // attack must happen after the click.
        const matchBeats = (
            detected: DetectedAttack[],
            latencyMs: number,
            windowMs: number,
        ) => {
            const usedAttackTimes = new Set<number>()
            return beatTimes.current
                .map((beatTime) => {
                    const expectedTime = beatTime + latencyMs
                    const matches = detected.filter(
                        (attack) =>
                            !usedAttackTimes.has(attack.time) &&
                            Math.abs(attack.time - expectedTime) <= windowMs,
                    )
                    if (!matches.length) return null
                    const attack = matches.reduce((nearest, candidate) =>
                        Math.abs(candidate.time - expectedTime) <
                        Math.abs(nearest.time - expectedTime)
                            ? candidate
                            : nearest,
                    )
                    usedAttackTimes.add(attack.time)
                    return { beatTime, attack }
                })
                .filter(
                    (match): match is { beatTime: number; attack: DetectedAttack } =>
                        match !== null,
                )
        }

        const thresholds = (get: (frame: { attackStrength: number }) => number, minimum: number) =>
            recordingWindow.length
                ? [0.08, 0.25, 0.45, 0.65, 0.82].map((point) =>
                      Math.max(minimum, percentile(recordingWindow.map(get), point) * 0.98),
                  )
                : [minimum]
        const profiles = thresholds((attack) => attack.attackStrength, 0.00002).flatMap(
            (minimumAttackStrength) =>
                [1.001, 1.05, 1.1, 1.2, 1.35].flatMap((baselineRatio) =>
                    [1.001, 1.03, 1.07, 1.15, 1.3].flatMap((riseRatio) =>
                        [100, 160, 220, 300].map((minIntervalMs) => ({
                            minimumAttackStrength,
                            baselineRatio,
                            riseRatio,
                            minIntervalMs,
                        })),
                    ),
                ),
        )
        const evaluate = (profile: DetectorParameters) => {
            const sharedDetector = new OnsetDetector()
            const detected = recordedFrames.flatMap((frame) => {
                const attack = sharedDetector.process(frame, profile)
                if (!attack || attack.time < firstBeat - initialMatchWindowMs || attack.time > lastBeat + initialMatchWindowMs) {
                    return []
                }
                return [attack]
            })
            const rough = matchBeats(detected, 0, initialMatchWindowMs)
            const latency = rough.length
                ? median(rough.map(({ attack, beatTime }) => attack.time - beatTime))
                : 0
            const aligned = matchBeats(detected, latency, alignedMatchWindowMs)
            const matchedIds = new Set(aligned.map(({ attack }) => attack.time))
            return {
                profile,
                aligned,
                latency,
                falsePositives: detected.filter((attack) => !matchedIds.has(attack.time)).length,
            }
        }
        const best = profiles.map(evaluate).reduce(
            (winner, attempt) =>
                attempt.aligned.length * 100 - attempt.falsePositives * 30 >
                winner.aligned.length * 100 - winner.falsePositives * 30
                    ? attempt
                    : winner,
            evaluate(calibrationDetector),
        )
        const latencyMs = Math.round(best.latency)
        const matched = best.aligned.length
        const falsePositives = best.falsePositives
        const saved = matched === calibrationBeats && falsePositives === 0

        if (saved) {
            const calibration = {
                deviceId,
                latencyMs,
                detector: best.profile,
                calibratedAt: Date.now(),
            }
            saveAudioCalibration(calibration)
            detector.current = calibration.detector
            setSavedCalibration(calibration)
        }

        setSummary({
            matched,
            missed: calibrationBeats - matched,
            falsePositives,
            latencyMs,
            saved,
        })
        setCalibrationState('complete')
    }

    function startCalibration() {
        if (status !== 'ready') return
        setEvents([])
        setSummary(null)
        recordingChunks.current = []
        beatTimes.current = []
        detector.current = calibrationDetector
        resetDetector.current = true
        calibrationActive.current = true
        const stream = audioStream.current
        if (!stream || typeof MediaRecorder === 'undefined') {
            calibrationActive.current = false
            setSummary({
                matched: 0,
                missed: calibrationBeats,
                falsePositives: 0,
                latencyMs: 0,
                saved: false,
                error: !stream
                    ? 'Аудиовход ещё не готов. Подождите появления уровня сигнала и повторите.'
                    : 'Этот браузер не поддерживает запись, нужную для калибровки.',
            })
            setCalibrationState('complete')
            return
        }
        const nextRecorder = new MediaRecorder(stream)
        nextRecorder.addEventListener('dataavailable', (event) => {
            if (event.data.size) recordingChunks.current.push(event.data)
        })
        recorder.current = nextRecorder
        recordingStartedAt.current = performance.now()
        nextRecorder.start()
        calibrationRunning.current = false
        setCountInBeat(0)
        setCalibrationState('count-in')
        metronome.current.start(60000 / calibrationBpm, (beat) => {
            if (beat < countInBeats) {
                setCountInBeat(beat + 1)
                return
            }

            const calibrationBeat = beat - countInBeats
            if (calibrationBeat === 0) {
                calibrationRunning.current = true
                setCalibrationState('running')
            }
            beatTimes.current.push(performance.now())
            if (calibrationBeat === calibrationBeats - 1) {
                metronome.current.stop()
                finishTimer.current = window.setTimeout(() => void finishCalibration(), 500)
            }
        })
    }

    const rmsPercent = toMeterPercent(level.rms)
    const peakPercent = toMeterPercent(level.peak)
    const rmsDb = toDecibels(level.rms)
    const visibleEvents = events.filter((event) => timelineNow - event.time <= timelineWindowMs)
    const recentlyDetected = visibleEvents.some((event) => timelineNow - event.time < 500)

    return (
        <div className="calibration-backdrop" role="presentation" onMouseDown={onClose}>
            <section
                className="calibration-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="calibration-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="calibration-header">
                    <div>
                        <span className="calibration-eyebrow">
                            <FontAwesomeIcon icon={faMicrophone} /> Входной сигнал
                        </span>
                        <h2 id="calibration-title">Калибровка детектора</h2>
                    </div>
                    <button
                        className="editor-close"
                        type="button"
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </header>

                <div className="calibration-content">
                    <label className="calibration-device">
                        Аудиовход
                        <select
                            value={deviceId}
                            onChange={(event) => setDeviceId(event.target.value)}
                            disabled={
                                calibrationState === 'count-in' || calibrationState === 'running'
                            }
                        >
                            <option value="">Системный вход по умолчанию</option>
                            {devices.map((device, index) => (
                                <option value={device.deviceId} key={device.deviceId}>
                                    {device.label || `Аудиовход ${index + 1}`}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="signal-panel">
                        <div className="signal-panel-heading">
                            <span>Уровень</span>
                            <output>{rmsDb.toFixed(0)} dBFS</output>
                        </div>
                        <div className="level-meter" aria-label="Текущий уровень входного сигнала">
                            <b style={{ width: `${rmsPercent}%` }} />
                            <em style={{ left: `${peakPercent}%` }} />
                        </div>
                        <p>
                            {status === 'connecting'
                                ? 'Подключаемся к входу…'
                                : status === 'error'
                                  ? 'Нет доступа к микрофону. Разрешите его в браузере и попробуйте снова.'
                                  : 'Шкала показывает громкость, а детектор реагирует на резкие атаки струн.'}
                        </p>
                    </div>

                    {calibrationState === 'idle' ? (
                        <div className="calibration-start">
                            <p>
                                После четырёхдольного отсчёта сыграйте 16 ровных ударов под метроном
                                90 BPM. Мы отсеем лишние срабатывания, измерим задержку и сохраним
                                профиль.
                            </p>
                            <button
                                className="secondary calibration-action"
                                type="button"
                                onClick={startCalibration}
                            >
                                <FontAwesomeIcon
                                    icon={savedCalibration ? faArrowsRotate : faPlay}
                                />{' '}
                                {savedCalibration ? 'Перекалибровать' : 'Начать калибровку'}
                            </button>
                        </div>
                    ) : null}
                    <div className="detection-log" aria-live="polite">
                        {calibrationState === 'idle' || calibrationState === 'complete' ? (
                            <>
                                <div className="detection-log-heading">
                                    <span>Удары за последние 4 секунды</span>
                                    <span
                                        className={
                                            recentlyDetected
                                                ? 'detector-status active'
                                                : 'detector-status'
                                        }
                                    >
                                        <i />{' '}
                                        {recentlyDetected ? 'Удар определён' : 'Ожидание удара'}
                                    </span>
                                </div>
                                <div
                                    className="detection-timeline"
                                    role="img"
                                    aria-label="Временная шкала распознанных ударов; новые появляются справа и движутся влево"
                                >
                                    <div className="detection-timeline-axis" aria-hidden="true">
                                        {[4, 3, 2, 1, 0].map((seconds) => (
                                            <span
                                                key={seconds}
                                                style={{ left: `${(4 - seconds) * 25}%` }}
                                            >
                                                {seconds ? `−${seconds} с` : 'сейчас'}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="detection-timeline-track">
                                        {[0, 25, 50, 75, 100].map((position) => (
                                            <i key={position} style={{ left: `${position}%` }} />
                                        ))}
                                        {visibleEvents.map((event) => (
                                            <b
                                                className="detection-timeline-hit"
                                                key={event.id}
                                                style={{
                                                    left: `${Math.max(
                                                        0,
                                                        100 -
                                                            ((timelineNow - event.time) /
                                                                timelineWindowMs) *
                                                                100,
                                                    )}%`,
                                                }}
                                                title={`Удар: ${event.strength.toFixed(3)}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : null}
                        {calibrationState === 'count-in' ? (
                            <div className="calibration-count-in" aria-live="assertive">
                                <span>Приготовьтесь</span>
                                <div aria-label={`Отсчёт: ${countInBeat} из ${countInBeats}`}>
                                    {Array.from({ length: countInBeats }, (_, index) => (
                                        <b
                                            className={index < countInBeat ? 'active' : undefined}
                                            key={index}
                                        >
                                            {index + 1}
                                        </b>
                                    ))}
                                </div>
                            </div>
                        ) : calibrationState === 'running' ? (
                            <p className="calibration-progress">
                                Калибровка идёт: держите ровный пульс.
                            </p>
                        ) : calibrationState === 'analysing' ? (
                            <p className="calibration-progress">Анализируем запись…</p>
                        ) : summary ? (
                            <div
                                className={
                                    summary.saved
                                        ? 'calibration-result saved'
                                        : 'calibration-result'
                                }
                            >
                                <span>
                                    {summary.saved
                                        ? `Ритм найден: ${summary.matched}/${calibrationBeats} ударов.`
                                        : summary.error ||
                                          `Калибровка не прошла: ${summary.matched}/${calibrationBeats} ударов; пропусков: ${summary.missed}.`}
                                </span>
                                <span>Задержка: {summary.latencyMs} мс</span>
                                <span>Лишних атак: {summary.falsePositives}</span>
                                <button
                                    className="secondary calibration-action"
                                    type="button"
                                    onClick={startCalibration}
                                >
                                    <FontAwesomeIcon icon={faArrowsRotate} /> Перекалибровать
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </section>
        </div>
    )
}
