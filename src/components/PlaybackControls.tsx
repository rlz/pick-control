import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ReactNode } from 'react'
import {
    faPlay,
    faRepeat,
    faRotateRight,
    faStop,
    faVolumeHigh,
} from '@fortawesome/free-solid-svg-icons'
import type { SessionPhase } from '../store/sessionStore'

type Props = {
    phase: SessionPhase
    isLooping: boolean
    isTempoLoop: boolean
    previewing: 'all' | number | null
    onToggleLoop: () => void
    onPreview: () => void
    onReset: () => void
    onStart: () => void
    children?: ReactNode
}

export function PlaybackControls(props: Props) {
    const running = props.phase === 'count-in' || props.phase === 'playing'
    return (
        <footer className="relative z-10 flex items-center justify-between gap-4 border-t border-slate-800 bg-slate-900 px-4 md:px-7">
            <div className="flex min-w-0 flex-1 items-center gap-3">{props.children}</div>
            <div className="flex items-end gap-3 border-l border-slate-700 pl-4">
                <div className="flex flex-col items-center gap-1">
                    <button
                        className="grid size-10 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition hover:border-indigo-400 aria-pressed:border-indigo-400 aria-pressed:bg-indigo-800 aria-pressed:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-40"
                        type="button"
                        onClick={props.onToggleLoop}
                        disabled={props.isTempoLoop}
                        aria-label={
                            props.isTempoLoop
                                ? 'Loop is required by the tempo program'
                                : props.isLooping
                                  ? 'Disable exercise loop'
                                  : 'Enable exercise loop'
                        }
                        aria-pressed={props.isLooping}
                        title={
                            props.isTempoLoop
                                ? 'Loop is required by the tempo program'
                                : props.isLooping
                                  ? 'Disable exercise loop'
                                  : 'Loop exercise'
                        }
                    >
                        <FontAwesomeIcon icon={faRepeat} />
                    </button>
                    <span className="text-xs font-medium text-slate-400">Loop</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <button
                        className="grid size-10 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition hover:border-indigo-400"
                        onClick={props.onPreview}
                        aria-label={
                            props.previewing === 'all' ? 'Stop full preview' : 'Preview exercise'
                        }
                        title={props.previewing === 'all' ? 'Stop preview' : 'Preview exercise'}
                    >
                        <FontAwesomeIcon
                            icon={props.previewing === 'all' ? faStop : faVolumeHigh}
                        />
                    </button>
                    <span className="text-xs font-medium text-slate-400">Listen</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <button
                        className="grid size-10 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={props.onReset}
                        disabled={props.phase === 'ready'}
                        aria-label="Repeat exercise"
                        title="Repeat exercise"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                    </button>
                    <span className="text-xs font-medium text-slate-400">Restart</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <button
                        className="grid size-10 place-items-center rounded-lg border border-indigo-400 bg-indigo-300 text-indigo-950 transition hover:bg-indigo-200"
                        onClick={props.onStart}
                        aria-label={
                            running
                                ? 'Stop exercise'
                                : props.phase === 'finished'
                                  ? 'Play exercise again'
                                  : 'Start exercise'
                        }
                        title={
                            running
                                ? 'Stop exercise'
                                : props.phase === 'finished'
                                  ? 'Play exercise again'
                                  : 'Start exercise'
                        }
                    >
                        <FontAwesomeIcon icon={running ? faStop : faPlay} />
                    </button>
                    <span className="text-xs font-semibold text-indigo-300">
                        {running ? 'Stop' : 'Start'}
                    </span>
                </div>
            </div>
        </footer>
    )
}
