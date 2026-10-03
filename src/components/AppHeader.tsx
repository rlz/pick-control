import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faArrowTrendUp,
    faArrowsRotate,
    faEquals,
    faGear,
    faMicrophone,
} from '@fortawesome/free-solid-svg-icons'
import {
    MAX_BPM,
    MIN_BPM,
    MAX_TEMPO_STEP,
    MIN_TEMPO_STEP,
    type TempoProgram,
} from '../store/exerciseStore'
import type { SessionPhase } from '../store/sessionStore'
import type { TimeSignature } from '../types'
import { useTranslation } from 'react-i18next'

type Props = {
    signature: TimeSignature
    measures: number
    calibrationOpen: boolean
    settingsOpen: boolean
    tempoOpen: boolean
    displayedBpm: number
    bpm: number
    tempoProgram: TempoProgram
    tempoStep: number
    tempoCeiling: number
    phase: SessionPhase
    onCalibration: () => void
    onSettings: () => void
    onToggleTempo: () => void
    onBpm: (value: number) => void
    onTempoProgram: (value: TempoProgram) => void
    onTempoStep: (value: number) => void
    onTempoCeiling: (value: number) => void
}

export function AppHeader(props: Props) {
    const { t } = useTranslation()
    const running = props.phase === 'count-in' || props.phase === 'playing'
    return (
        <header className="relative z-30 flex items-center overflow-visible border-b border-slate-800 bg-slate-900/90 px-5 backdrop-blur md:px-7">
            <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-indigo-300">
                <img
                    src={`${import.meta.env.BASE_URL}icon.svg`}
                    alt=""
                    className="size-8 shrink-0 rounded-lg"
                />
                <span>Pick Control</span>
            </div>
            <h1 className="absolute left-1/2 m-0 hidden -translate-x-1/2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm font-medium text-slate-300 sm:block">
                {props.signature} <span className="px-1 text-slate-500">·</span> {props.measures}{' '}
                {t('measures')}
            </h1>
            <div className="ml-auto flex items-center gap-2">
                <button
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-400"
                    type="button"
                    onClick={props.onCalibration}
                    aria-label={t('openCalibration')}
                    aria-expanded={props.calibrationOpen}
                >
                    <FontAwesomeIcon icon={faMicrophone} />
                    <span className="max-sm:hidden">{t('calibration')}</span>
                </button>
                <button
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-400"
                    type="button"
                    onClick={props.onSettings}
                    aria-label={t('settings')}
                    aria-expanded={props.settingsOpen}
                >
                    <FontAwesomeIcon icon={faGear} />
                    <span className="max-sm:hidden">{t('exercise')}</span>
                </button>
                <div className="relative">
                    <button
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-400"
                        type="button"
                        onClick={props.onToggleTempo}
                        aria-expanded={props.tempoOpen}
                        aria-label={t('changeTempo')}
                    >
                        <span className="font-mono text-indigo-300">{props.displayedBpm}</span>
                        <span>BPM</span>
                    </button>
                    {props.tempoOpen ? (
                        <div className="absolute right-0 top-full z-10 mt-2 grid w-72 max-w-xs gap-4 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
                            <label className="grid gap-2 font-mono text-xs font-medium uppercase tracking-wider text-slate-400">
                                {t('tempo')}{' '}
                                <output className="font-sans text-lg font-bold normal-case tracking-normal text-indigo-300">
                                    {props.displayedBpm} BPM
                                </output>
                                <input
                                    className="accent-indigo-400"
                                    type="range"
                                    min={MIN_BPM}
                                    max={MAX_BPM}
                                    step="1"
                                    value={props.bpm}
                                    onChange={(event) => props.onBpm(Number(event.target.value))}
                                    disabled={running}
                                />
                            </label>
                            <div className="grid gap-2 font-mono text-xs font-medium uppercase tracking-wider text-slate-400">
                                <span>{t('tempoProgram')}</span>
                                <div className="flex gap-1" role="group" aria-label={t('tempoProgram')}>
                                    {([
                                        ['steady', 'keepTempo', faEquals],
                                        ['increase', 'increaseEachLoop', faArrowTrendUp],
                                        ['increase-and-return', 'increaseThenReturn', faArrowsRotate],
                                    ] as const).map(([program, label, icon]) => {
                                        const selected = props.tempoProgram === program
                                        return (
                                            <button
                                                key={program}
                                                className={`size-10 rounded-lg border font-sans text-sm normal-case tracking-normal transition ${selected ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/50' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700'}`}
                                                type="button"
                                                aria-pressed={selected}
                                                aria-label={t(label)}
                                                title={t(label)}
                                                onClick={() => props.onTempoProgram(program as TempoProgram)}
                                                disabled={running}
                                            >
                                                <FontAwesomeIcon icon={icon} aria-hidden="true" />
                                            </button>
                                        )
                                    })}
                                </div>
                                <p className="m-0 font-sans text-xs font-normal normal-case tracking-normal text-slate-400">
                                    {t(
                                        props.tempoProgram === 'steady'
                                            ? 'steadyTempoHelp'
                                            : props.tempoProgram === 'increase'
                                              ? 'increasingTempoHelp'
                                              : 'returningTempoHelp',
                                    )}
                                </p>
                            </div>
                            {props.tempoProgram !== 'steady' ? (
                                <>
                                    <label className="grid gap-2 font-mono text-xs font-medium normal-case tracking-normal text-slate-400">
                                        {t('changePerPass')}{' '}
                                        <output className="font-sans text-lg font-bold normal-case tracking-normal text-indigo-300">
                                            {props.tempoStep} BPM
                                        </output>
                                        <input
                                            className="accent-indigo-400"
                                            type="range"
                                            min={MIN_TEMPO_STEP}
                                            max={MAX_TEMPO_STEP}
                                            step="1"
                                            value={props.tempoStep}
                                            onChange={(event) =>
                                                props.onTempoStep(Number(event.target.value))
                                            }
                                            disabled={running}
                                        />
                                    </label>
                                    <label className="grid gap-2 font-mono text-xs font-medium uppercase tracking-wider text-slate-400">
                                        {t('maximum')}{' '}
                                        <output className="font-sans text-lg font-bold normal-case tracking-normal text-indigo-300">
                                            {props.tempoCeiling} BPM
                                        </output>
                                        <input
                                            className="accent-indigo-400"
                                            type="range"
                                            min={MIN_BPM}
                                            max={MAX_BPM}
                                            step="1"
                                            value={props.tempoCeiling}
                                            onChange={(event) =>
                                                props.onTempoCeiling(Number(event.target.value))
                                            }
                                            disabled={running}
                                        />
                                    </label>
                                </>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>
        </header>
    )
}
