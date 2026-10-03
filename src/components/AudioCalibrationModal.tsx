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
const timelineLatestOffsetMs = 1000
const calibrationBpms = [90] as const
const calibrationBeatsPerTempo = 16
const calibrationTotalBeats = calibrationBpms.length * calibrationBeatsPerTempo
const countInBeats = 4
const initialMatchWindowMs = 180
const alignedMatchWindowMs = 90
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
    const [seriesIndex, setSeriesIndex] = useState(0)
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
        const matchBeats = (detected: DetectedAttack[], latencyMs: number, windowMs: number) => {
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
                if (
                    !attack ||
                    attack.time < firstBeat - initialMatchWindowMs ||
                    attack.time > lastBeat + initialMatchWindowMs
                ) {
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
        const evaluations = profiles.map(evaluate)
        const successfulProfiles = evaluations.filter(
            (attempt) =>
                attempt.aligned.length === calibrationTotalBeats && attempt.falsePositives === 0,
        )
        const best = (successfulProfiles.length ? successfulProfiles : evaluations).reduce(
            (winner, attempt) => {
                if (successfulProfiles.length) {
                    // All candidates here already have 64/64 hits and no
                    // extras. Prefer the one that leaves most headroom for a
                    // quieter follow-up stroke and permits the fastest series.
                    const sensitivity =
                        attempt.profile.minIntervalMs * 1000 +
                        attempt.profile.minimumAttackStrength * 100
                    const winnerSensitivity =
                        winner.profile.minIntervalMs * 1000 +
                        winner.profile.minimumAttackStrength * 100
                    return sensitivity < winnerSensitivity ? attempt : winner
                }
                const score = attempt.aligned.length * 100 - attempt.falsePositives * 30
                const winnerScore = winner.aligned.length * 100 - winner.falsePositives * 30
                if (score !== winnerScore) return score > winnerScore ? attempt : winner

                // A tie means both profiles explain the take equally well. Keep
                // the stricter one: otherwise the first (lowest) threshold in
                // the grid is saved and room noise can become a live "attack".
                const strictness =
                    attempt.profile.minimumAttackStrength * 1000 +
                    attempt.profile.baselineRatio +
                    attempt.profile.riseRatio
                const winnerStrictness =
                    winner.profile.minimumAttackStrength * 1000 +
                    winner.profile.baselineRatio +
                    winner.profile.riseRatio
                return strictness > winnerStrictness ? attempt : winner
            },
            evaluate(calibrationDetector),
        )
        const latencyMs = Math.round(best.latency)
        const matched = best.aligned.length
        const falsePositives = best.falsePositives
        const saved = matched === calibrationTotalBeats && falsePositives === 0

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
            missed: calibrationTotalBeats - matched,
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
                missed: calibrationTotalBeats,
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
        nextRecorder.addEventListener(
            'start',
            () => {
                recordingStartedAt.current = performance.now()
            },
            { once: true },
        )
        recorder.current = nextRecorder
        nextRecorder.start()
        calibrationRunning.current = false
        setSeriesIndex(0)
        runCalibrationSeries(0)
    }

    function runCalibrationSeries(nextSeriesIndex: number) {
        const bpm = calibrationBpms[nextSeriesIndex]
        setSeriesIndex(nextSeriesIndex)
        setCountInBeat(0)
        setCalibrationState('count-in')
        metronome.current.start(60000 / bpm, (beat) => {
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
            if (calibrationBeat === calibrationBeatsPerTempo - 1) {
                metronome.current.stop()
                calibrationRunning.current = false
                if (nextSeriesIndex === calibrationBpms.length - 1) {
                    finishTimer.current = window.setTimeout(() => void finishCalibration(), 500)
                }
            }
        })
    }

    const levelPercent = toMeterPercent(level.peak)
    const levelDb = toDecibels(level.peak)
    const visibleEvents = events.filter(
        (event) => timelineNow - event.time <= timelineWindowMs + timelineLatestOffsetMs,
    )
    const recentlyDetected = visibleEvents.some((event) => timelineNow - event.time < 500)

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
            role="presentation"
            onMouseDown={onClose}
        >
            <section
                className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="calibration-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="flex items-center justify-between gap-4 border-b border-slate-800 p-5">
                    <div>
                        <span className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-widest text-indigo-300">
                            <FontAwesomeIcon icon={faMicrophone} /> Входной сигнал
                        </span>
                        <h2 id="calibration-title" className="mb-0 mt-1 text-lg font-semibold">
                            Калибровка детектора
                        </h2>
                    </div>
                    <button
                        className="grid size-9 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-400"
                        type="button"
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </header>

                <div className="grid gap-4 overflow-y-auto p-5">
                    <label className="grid gap-2 font-mono text-xs font-medium uppercase tracking-wider text-slate-400">
                        Аудиовход
                        <select
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-sans text-sm normal-case tracking-normal text-slate-200"
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

                    <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-slate-300">Уровень</span>
                            <output className="font-mono text-xs font-medium text-indigo-300">
                                {levelDb.toFixed(0)} dBFS
                            </output>
                        </div>
                        <div
                            className="relative mt-4 h-3 overflow-hidden rounded-full bg-slate-800"
                            aria-label="Текущий уровень входного сигнала"
                        >
                            <b
                                className="absolute inset-y-0 left-0 rounded-full bg-indigo-400 transition-all"
                                style={{ width: `${levelPercent}%` }}
                            />
                        </div>
                        <p className="mb-0 mt-3 text-sm leading-relaxed text-slate-400">
                            {status === 'connecting'
                                ? 'Подключаемся к входу…'
                                : status === 'error'
                                  ? 'Нет доступа к микрофону. Разрешите его в браузере и попробуйте снова.'
                                  : 'Шкала показывает громкость, а детектор реагирует на резкие атаки струн.'}
                        </p>
                    </div>

                    {calibrationState === 'idle' ? (
                        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                            <p className="m-0 text-sm leading-relaxed text-slate-400">
                                После четырёхдольного отсчёта сыграйте 16 ровных ударов под метроном
                                90 BPM. Профиль сохранится только при 16 точных срабатываниях без
                                лишних.
                            </p>
                            <button
                                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-400 hover:bg-slate-700"
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
                    <div
                        className="rounded-xl border border-slate-700 bg-slate-950/50 p-4"
                        aria-live="polite"
                    >
                        {calibrationState === 'idle' || calibrationState === 'complete' ? (
                            <>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-semibold text-slate-300">
                                        Удары за последние 4 секунды
                                    </span>
                                    <span
                                        className={
                                            recentlyDetected
                                                ? 'inline-flex items-center gap-2 text-xs text-emerald-300'
                                                : 'inline-flex items-center gap-2 text-xs text-slate-500'
                                        }
                                    >
                                        <i
                                            className={`size-2 rounded-full ${recentlyDetected ? 'bg-emerald-300' : 'bg-slate-600'}`}
                                        />{' '}
                                        {recentlyDetected ? 'Удар определён' : 'Ожидание удара'}
                                    </span>
                                </div>
                                <div
                                    className="mt-4"
                                    role="img"
                                    aria-label="Временная шкала распознанных ударов; новые появляются справа и движутся влево"
                                >
                                    <div
                                        className="relative h-4 font-mono text-xs text-slate-500"
                                        aria-hidden="true"
                                    >
                                        {[5, 4, 3, 2, 1].map((seconds) => (
                                            <span
                                                className={`absolute whitespace-nowrap ${seconds === 5 ? '' : seconds === 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
                                                key={seconds}
                                                style={{ left: `${((5 - seconds) / 4) * 100}%` }}
                                            >
                                                −{seconds} с
                                            </span>
                                        ))}
                                    </div>
                                    <div className="relative h-14 overflow-hidden rounded-md bg-gradient-to-b from-slate-800 to-slate-950">
                                        {[0, 25, 50, 75, 100].map((position) => (
                                            <i
                                                className="absolute inset-y-0 border-l border-slate-700"
                                                key={position}
                                                style={{ left: `${position}%` }}
                                            />
                                        ))}
                                        {visibleEvents.map((event) => (
                                            <b
                                                className="absolute bottom-0 h-3/4 w-0.5 -translate-x-px rounded-t-full bg-cyan-400 shadow-lg"
                                                key={event.id}
                                                style={{
                                                    left: `${Math.min(
                                                        100,
                                                        Math.max(
                                                            0,
                                                            100 -
                                                                ((timelineNow -
                                                                    event.time -
                                                                    timelineLatestOffsetMs) /
                                                                    timelineWindowMs) *
                                                                    100,
                                                        ),
                                                    )}%`,
                                                }}
                                                title={`Удар: ${event.strength.toFixed(3)}`}
                                            >
                                                <i className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-cyan-200" />
                                            </b>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : null}
                        {calibrationState === 'count-in' ? (
                            <div
                                className="mt-3 flex items-center justify-between gap-4 font-mono text-xs font-medium uppercase tracking-wide text-indigo-200"
                                aria-live="assertive"
                            >
                                <span>Приготовьтесь</span>
                                <div
                                    className="flex gap-2"
                                    aria-label={`Отсчёт: ${countInBeat} из ${countInBeats}`}
                                >
                                    {Array.from({ length: countInBeats }, (_, index) => (
                                        <b
                                            className={`grid size-8 place-items-center rounded-full border border-slate-600 ${index < countInBeat ? 'border-indigo-400 bg-indigo-400 text-slate-950' : 'text-slate-400'}`}
                                            key={index}
                                        >
                                            {index + 1}
                                        </b>
                                    ))}
                                </div>
                            </div>
                        ) : calibrationState === 'running' ? (
                            <p className="mt-3 text-sm leading-relaxed text-indigo-200">
                                Идёт запись: {calibrationBpms[seriesIndex]} BPM, сыграйте{' '}
                                {calibrationBeatsPerTempo} ровных ударов.
                            </p>
                        ) : calibrationState === 'analysing' ? (
                            <p className="mt-3 text-sm leading-relaxed text-indigo-200">
                                Анализируем запись…
                            </p>
                        ) : summary ? (
                            <div
                                className={
                                    summary.saved
                                        ? 'grid gap-2 text-sm text-emerald-300'
                                        : 'grid gap-2 text-sm text-rose-300'
                                }
                            >
                                <span>
                                    {summary.saved
                                        ? `Ритм найден: ${summary.matched}/${calibrationTotalBeats} ударов.`
                                        : summary.error ||
                                          `Калибровка не прошла: ${summary.matched}/${calibrationTotalBeats} ударов; пропусков: ${summary.missed}.`}
                                </span>
                                <span>Задержка: {summary.latencyMs} мс</span>
                                <span>Лишних атак: {summary.falsePositives}</span>
                                <button
                                    className="mt-2 inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-400 hover:bg-slate-700"
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
