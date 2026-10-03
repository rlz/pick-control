import { faPlay, faStop } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ExerciseNote, PlayerHit } from '../types'
import { useTranslation } from 'react-i18next'

type Props = {
    measure: number
    notes: ExerciseNote[]
    runs: Array<{ hits: PlayerHit[]; measureMs: number; bpm: number }>
    slots: number
    beats: number
    measureMs: number
    onPreview: () => void
    isPreviewing: boolean
}

export function TimingDetail({
    measure,
    notes,
    runs,
    slots,
    beats,
    measureMs,
    onPreview,
    isPreviewing,
}: Props) {
    const { t } = useTranslation()
    const edgeAllowanceMs = 120
    const timelineWidthMs = measureMs + edgeAllowanceMs
    const timelineStart = (edgeAllowanceMs / timelineWidthMs) * 100
    const timelineSpan = (measureMs / timelineWidthMs) * 100
    // History may contain attempts at other tempi. Normalize each one to the
    // same visual measure so its beat positions still meet the score's grid.
    const markerPosition = (hit: PlayerHit, hitMeasureMs = measureMs) =>
        timelineStart + ((hit.time - measure * hitMeasureMs) / hitMeasureMs) * timelineSpan
    const isOnTime = (hit: PlayerHit, hitMeasureMs = measureMs) =>
        notes
            .filter((note) => !note.isRest)
            .some(
                (note) =>
                    Math.abs(
                        hit.time - measure * hitMeasureMs - (note.position / slots) * hitMeasureMs,
                    ) < 150,
            )
    const showRunBpm = new Set(runs.map((run) => run.bpm)).size > 1

    return (
        <section className="flex h-full w-full min-w-0 items-center gap-3">
            <div className="flex items-center gap-2">
                <p className="m-0 font-mono text-xs font-medium text-indigo-300">
                    {String(measure + 1).padStart(2, '0')}
                </p>
                <button
                    className="grid size-10 place-items-center rounded-lg border border-slate-700 bg-slate-800 font-mono text-xs text-slate-200 transition hover:border-indigo-400 hover:text-indigo-200"
                    onClick={onPreview}
                    aria-label={isPreviewing ? t('stopMeasurePreview') : t('playMeasure')}
                    title={isPreviewing ? t('stopMeasurePreview') : t('playMeasure')}
                >
                    <FontAwesomeIcon icon={isPreviewing ? faStop : faPlay} />
                </button>
            </div>
            <div className="min-w-28 flex-1 pb-4 sm:min-w-35">
                <div className={`timeline ${showRunBpm ? 'with-tempo' : ''}`}>
                    <div className="axis">
                        {Array.from({ length: beats + 1 }, (_, index) => (
                            <span
                                key={index}
                                style={{
                                    left: `${timelineStart + (index / beats) * timelineSpan}%`,
                                }}
                            >
                                {index + 1}
                            </span>
                        ))}
                    </div>
                    {Array.from({ length: slots + 1 }, (_, index) => (
                        <i
                            key={index}
                            className={`subdivision ${index % 4 === 0 ? 'beat' : index % 2 === 0 ? 'eighth' : 'sixteenth'}`}
                            style={{ left: `${timelineStart + (index / slots) * timelineSpan}%` }}
                        />
                    ))}
                    {notes
                        .filter((note) => !note.isRest)
                        .map((note) => (
                            <span
                                className={`rhythm-bar ${note.palmMuted ? 'palm-muted' : ''}`}
                                key={note.id}
                                style={{
                                    left: `${timelineStart + (note.position / slots) * timelineSpan}%`,
                                    width: `${(note.duration / slots) * timelineSpan}%`,
                                }}
                                title={t('targetBeat', {
                                    mute: note.palmMuted ? `${t('palmMute')} · ` : '',
                                    target: ((note.position / slots) * 4 + 1).toFixed(2),
                                })}
                            />
                        ))}
                </div>
                {runs.map((run, runIndex) => (
                    <div
                        className={`loop-timeline ${showRunBpm ? 'with-tempo' : ''}`}
                        key={runIndex}
                    >
                        <span>
                            #{runIndex + 1}
                            {showRunBpm ? ` · ${run.bpm} BPM` : ''}
                        </span>
                        <div>
                            {run.hits.map((hit, hitIndex) => (
                                <i
                                    className={
                                        isOnTime(hit, run.measureMs) ? 'correct' : 'incorrect'
                                    }
                                    key={hitIndex}
                                    style={{
                                        left: `${markerPosition(hit, run.measureMs)}%`,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}
