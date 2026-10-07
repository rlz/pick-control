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
import { useTranslation } from 'react-i18next'

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
    const { t } = useTranslation()
    const running = props.phase === 'count-in' || props.phase === 'playing'
    return (
        <footer className="relative z-10 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-t border-slate-800 bg-slate-900 px-4 py-2 md:flex md:justify-between md:gap-4 md:px-7">
            {props.children}
            <div className="col-start-2 row-start-2 flex items-end justify-end gap-2 md:col-auto md:row-auto md:gap-3 md:border-l md:border-slate-700 md:pl-4">
                <div className="flex flex-col items-center gap-1">
                    <button
                        className="grid size-10 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition hover:border-indigo-400 aria-pressed:border-indigo-400 aria-pressed:bg-indigo-800 aria-pressed:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-40"
                        type="button"
                        onClick={props.onToggleLoop}
                        disabled={props.isTempoLoop}
                        aria-label={
                            props.isTempoLoop
                                ? t('loopRequired')
                                : props.isLooping
                                  ? t('disableLoop')
                                  : t('enableLoop')
                        }
                        aria-pressed={props.isLooping}
                        title={
                            props.isTempoLoop
                                ? t('loopRequired')
                                : props.isLooping
                                  ? t('disableLoop')
                                  : t('loopExercise')
                        }
                    >
                        <FontAwesomeIcon icon={faRepeat} />
                    </button>
                    <span className="text-xs font-medium text-slate-400">{t('loop')}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <button
                        className="grid size-10 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition hover:border-indigo-400"
                        onClick={props.onPreview}
                        aria-label={
                            props.previewing === 'all' ? t('stopFullPreview') : t('previewExercise')
                        }
                        title={props.previewing === 'all' ? t('stopPreview') : t('previewExercise')}
                    >
                        <FontAwesomeIcon
                            icon={props.previewing === 'all' ? faStop : faVolumeHigh}
                        />
                    </button>
                    <span className="text-xs font-medium text-slate-400">{t('listen')}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <button
                        className="grid size-10 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={props.onReset}
                        disabled={props.phase === 'ready'}
                        aria-label={t('repeatExercise')}
                        title={t('repeatExercise')}
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                    </button>
                    <span className="text-xs font-medium text-slate-400">{t('restart')}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <button
                        className="grid size-10 place-items-center rounded-lg border border-indigo-400 bg-indigo-300 text-indigo-950 transition hover:bg-indigo-200"
                        onClick={props.onStart}
                        aria-label={
                            running
                                ? t('stopExercise')
                                : props.phase === 'finished'
                                  ? t('playAgain')
                                  : t('startExercise')
                        }
                        title={
                            running
                                ? t('stopExercise')
                                : props.phase === 'finished'
                                  ? t('playAgain')
                                  : t('startExercise')
                        }
                    >
                        <FontAwesomeIcon icon={running ? faStop : faPlay} />
                    </button>
                    <span className="text-xs font-semibold text-indigo-300">
                        {running ? t('stop') : t('start')}
                    </span>
                </div>
            </div>
        </footer>
    )
}
