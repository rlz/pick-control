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

type InputDevice = Pick<MediaDeviceInfo, 'deviceId' | 'label'>

type DetectionEvent = {
    id: number
    time: number
    strength: number
}

type Props = {
    onClose: () => void
}

type CalibrationState = 'idle' | 'count-in' | 'running' | 'complete'

type CalibrationSummary = {
    matched: number
    falsePositives: number
    latencyMs: number
    saved: boolean
}

const meterFloorDb = -60
const timelineWindowMs = 4000
const calibrationBpm = 90
const calibrationBeats = 16
const countInBeats = 4
const initialMatchWindowMs = 300
const alignedMatchWindowMs = 220
const calibrationDetector = {
    minimumAttackStrength: 0.00035,
    baselineRatio: 1.25,
    riseRatio: 1.05,
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
    return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * position))]
}

function clamp(value: number, minimum: number, maximum: number) {
    return Math.min(maximum, Math.max(minimum, value))
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
    const beatTimes = useRef<number[]>([])
    const attacks = useRef<DetectedAttack[]>([])
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
            onAttack: (attack) => {
                if (!active) return
                if (calibrationRunning.current) attacks.current.push(attack)
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
            })
            .catch(() => active && setStatus('error'))

        return () => {
            active = false
            calibrationRunning.current = false
            activeMetronome.stop()
            if (finishTimer.current !== null) clearTimeout(finishTimer.current)
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

    function finishCalibration() {
        calibrationRunning.current = false
        metronome.current.stop()
        const firstBeat = beatTimes.current[0] ?? 0
        const lastBeat = beatTimes.current.at(-1) ?? 0
        const candidates = attacks.current.filter(
            (attack) =>
                attack.time >= firstBeat - initialMatchWindowMs &&
                attack.time <= lastBeat + initialMatchWindowMs,
        )
        // Players commonly anticipate a click by a few milliseconds. Associate
        // each detected attack with only one metronome beat, then centre the
        // stricter pass around the measured latency instead of assuming the
        // attack must happen after the click.
        const matchBeats = (latencyMs: number, windowMs: number) => {
            const usedAttackTimes = new Set<number>()
            return beatTimes.current
                .map((beatTime) => {
                    const expectedTime = beatTime + latencyMs
                    const matches = candidates.filter(
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

        const roughMatches = matchBeats(0, initialMatchWindowMs)
        const initialLatency = roughMatches.length
            ? median(roughMatches.map(({ attack, beatTime }) => attack.time - beatTime))
            : 0
        const selected = matchBeats(initialLatency, alignedMatchWindowMs)
        const latencyMs = selected.length
            ? Math.round(median(selected.map(({ attack, beatTime }) => attack.time - beatTime)))
            : 0
        const aligned = selected.filter(({ attack, beatTime }) => {
            return Math.abs(attack.time - beatTime - latencyMs) < alignedMatchWindowMs
        })
        const selectedIds = new Set(aligned.map(({ attack }) => attack.time))
        const rejected = candidates.filter((attack) => !selectedIds.has(attack.time))
        const falsePositives = rejected.length
        const saved = aligned.length >= 10

        if (saved) {
            const attackFloor = Math.max(
                percentile(
                    aligned.map(({ attack }) => attack.attackStrength),
                    0.15,
                ) * 0.6,
                rejected.length
                    ? percentile(
                          rejected.map((attack) => attack.attackStrength),
                          0.9,
                      ) * 1.05
                    : 0,
            )
            const baselineRatio = Math.max(
                percentile(
                    aligned.map(({ attack }) => attack.baselineRatio),
                    0.15,
                ) * 0.78,
                rejected.length
                    ? percentile(
                          rejected.map((attack) => attack.baselineRatio),
                          0.9,
                      ) * 1.05
                    : 0,
            )
            const riseRatio = Math.max(
                percentile(
                    aligned.map(({ attack }) => attack.riseRatio),
                    0.15,
                ) * 0.78,
                rejected.length
                    ? percentile(
                          rejected.map((attack) => attack.riseRatio),
                          0.9,
                      ) * 1.05
                    : 0,
            )
            const calibration = {
                deviceId,
                latencyMs,
                detector: {
                    minimumAttackStrength: clamp(attackFloor, 0.0002, 0.02),
                    baselineRatio: clamp(baselineRatio, 1.15, 2.2),
                    riseRatio: clamp(riseRatio, 1.05, 1.8),
                    minIntervalMs: 160,
                },
                calibratedAt: Date.now(),
            }
            saveAudioCalibration(calibration)
            detector.current = calibration.detector
            setSavedCalibration(calibration)
        }

        setSummary({ matched: aligned.length, falsePositives, latencyMs, saved })
        setCalibrationState('complete')
    }

    function startCalibration() {
        if (status !== 'ready') return
        setEvents([])
        setSummary(null)
        attacks.current = []
        beatTimes.current = []
        detector.current = calibrationDetector
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
                finishTimer.current = window.setTimeout(finishCalibration, 500)
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
                        <div className="detection-log-heading">
                            <span>Удары за последние 4 секунды</span>
                            <span
                                className={
                                    recentlyDetected ? 'detector-status active' : 'detector-status'
                                }
                            >
                                <i /> {recentlyDetected ? 'Удар определён' : 'Ожидание удара'}
                            </span>
                        </div>
                        <div
                            className="detection-timeline"
                            role="img"
                            aria-label="Временная шкала распознанных ударов; новые появляются справа и движутся влево"
                        >
                            <div className="detection-timeline-axis" aria-hidden="true">
                                {[4, 3, 2, 1, 0].map((seconds) => (
                                    <span key={seconds} style={{ left: `${(4 - seconds) * 25}%` }}>
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
                                        : `Недостаточно совпадений: ${summary.matched}/${calibrationBeats}.`}
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
