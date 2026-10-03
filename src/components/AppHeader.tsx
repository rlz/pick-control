import type { CSSProperties } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear, faMicrophone } from '@fortawesome/free-solid-svg-icons'
import { MAX_BPM, MIN_BPM, MAX_TEMPO_STEP, MIN_TEMPO_STEP, type TempoProgram } from '../store/exerciseStore'
import type { SessionPhase } from '../store/sessionStore'
import type { TimeSignature } from '../types'

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

function rangeStyle(value: number, min: number, max: number): CSSProperties {
    return { '--range-value-position': `${((value - min) / (max - min)) * 100}%` } as CSSProperties
}

export function AppHeader(props: Props) {
    const running = props.phase === 'count-in' || props.phase === 'playing'
    return (
        <header className="relative z-30 flex items-center overflow-visible border-b border-slate-800 bg-slate-900/90 px-5 backdrop-blur md:px-7">
            <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-indigo-300">
                <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="size-8 shrink-0 rounded-lg" />
                <span>Pick Control</span>
            </div>
            <h1 className="absolute left-1/2 m-0 hidden -translate-x-1/2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm font-medium text-slate-300 sm:block">
                {props.signature} <span className="px-1 text-slate-500">·</span> {props.measures} measures
            </h1>
            <div className="ml-auto flex items-center gap-2">
                <button className="header-control" type="button" onClick={props.onCalibration} aria-label="Открыть калибровку аудиовхода" aria-expanded={props.calibrationOpen}>
                    <FontAwesomeIcon icon={faMicrophone} /><span>Калибровка</span>
                </button>
                <button className="header-control" type="button" onClick={props.onSettings} aria-label="Open exercise settings" aria-expanded={props.settingsOpen}>
                    <FontAwesomeIcon icon={faGear} /><span>Exercise</span>
                </button>
                <div className="tempo-control">
                    <button className="header-control" type="button" onClick={props.onToggleTempo} aria-expanded={props.tempoOpen} aria-label="Change tempo">
                        <span className="tempo-value">{props.displayedBpm}</span><span>BPM</span>
                    </button>
                    {props.tempoOpen ? (
                        <div className="tempo-popover">
                            <label>Tempo <output>{props.displayedBpm} BPM</output><input type="range" min={MIN_BPM} max={MAX_BPM} step="1" value={props.bpm} style={rangeStyle(props.bpm, MIN_BPM, MAX_BPM)} onChange={(event) => props.onBpm(Number(event.target.value))} disabled={running} /></label>
                            <label>Tempo program<select value={props.tempoProgram} onChange={(event) => props.onTempoProgram(event.target.value as TempoProgram)} disabled={running}>
                                <option value="steady">Keep tempo</option><option value="increase">Increase on each loop</option><option value="increase-and-return">Increase, then return</option>
                            </select></label>
                            {props.tempoProgram !== 'steady' ? <>
                                <label>Change per pass <output>{props.tempoStep} BPM</output><input type="range" min={MIN_TEMPO_STEP} max={MAX_TEMPO_STEP} step="1" value={props.tempoStep} style={rangeStyle(props.tempoStep, MIN_TEMPO_STEP, MAX_TEMPO_STEP)} onChange={(event) => props.onTempoStep(Number(event.target.value))} disabled={running} /></label>
                                <label>Maximum <output>{props.tempoCeiling} BPM</output><input className="tempo-ceiling-slider" type="range" min={MIN_BPM} max={MAX_BPM} step="1" value={props.tempoCeiling} style={{ ...rangeStyle(props.tempoCeiling, MIN_BPM, MAX_BPM), '--tempo-minimum-position': `${((props.bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100}%` } as CSSProperties} onChange={(event) => props.onTempoCeiling(Number(event.target.value))} disabled={running} /></label>
                            </> : null}
                        </div>
                    ) : null}
                </div>
            </div>
        </header>
    )
}
