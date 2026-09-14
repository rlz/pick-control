import { faPenToSquare, faPlay, faStop } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ExerciseNote, PlayerHit } from '../types'

type Props = {
    measure: number
    notes: ExerciseNote[]
    hits: PlayerHit[]
    previousHits: PlayerHit[][]
    slots: number
    beats: number
    measureMs: number
    onPreview: () => void
    isPreviewing: boolean
    onEdit: () => void
    isEditingDisabled: boolean
}

export function TimingDetail({
    measure,
    notes,
    hits,
    previousHits,
    slots,
    beats,
    measureMs,
    onPreview,
    isPreviewing,
    onEdit,
    isEditingDisabled,
}: Props) {
    const edgeAllowanceMs = 120
    const timelineWidthMs = measureMs + edgeAllowanceMs * 2
    const timelineStart = (edgeAllowanceMs / timelineWidthMs) * 100
    const timelineSpan = (measureMs / timelineWidthMs) * 100
    const markerPosition = (hit: PlayerHit) =>
        ((hit.time - measure * measureMs + edgeAllowanceMs) / timelineWidthMs) * 100
    const isOnTime = (hit: PlayerHit) =>
        notes
            .filter((note) => !note.isRest)
            .some(
                (note) =>
                    Math.abs(hit.time - measure * measureMs - (note.position / slots) * measureMs) <
                    150,
            )

    return (
        <section className="flex h-full w-full min-w-0 items-center gap-3">
            <div className="flex items-center gap-2">
                <p className="m-0 font-mono text-[10px] font-medium text-indigo-300">
                    {String(measure + 1).padStart(2, '0')}
                </p>
                <button
                    className="grid size-10 place-items-center rounded-lg border border-slate-700 bg-slate-800 font-mono text-[10px] text-slate-200 transition hover:border-indigo-400 hover:text-indigo-200"
                    onClick={onPreview}
                    aria-label={isPreviewing ? 'Stop measure preview' : 'Play measure'}
                    title={isPreviewing ? 'Stop measure preview' : 'Play measure'}
                >
                    <FontAwesomeIcon icon={isPreviewing ? faStop : faPlay} />
                </button>
            </div>
            <div className="min-w-28 flex-1 sm:min-w-35">
                <div className="timeline">
                <div className="axis">
                    {Array.from({ length: beats + 1 }, (_, index) => (
                        <span
                            key={index}
                            style={{ left: `${timelineStart + (index / beats) * timelineSpan}%` }}
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
                            title={`${note.palmMuted ? 'Palm mute · ' : ''}Target: ${((note.position / slots) * 4 + 1).toFixed(2)}`}
                        />
                    ))}
                {hits.map((hit, hitIndex) => (
                    <span
                        className={`marker player ${isOnTime(hit) ? 'correct' : 'incorrect'}`}
                        key={hitIndex}
                        style={{ left: `${markerPosition(hit)}%` }}
                        title={isOnTime(hit) ? 'On time' : 'Off beat'}
                    />
                ))}
                </div>
                {previousHits.map((runHits, runIndex) => (
                    <div className="loop-timeline" key={runIndex}>
                        <span>#{runIndex + 1}</span>
                        <div>
                            {runHits.map((hit, hitIndex) => (
                                <i
                                    className={isOnTime(hit) ? 'correct' : 'incorrect'}
                                    key={hitIndex}
                                    style={{ left: `${markerPosition(hit)}%` }}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <button
                className="grid size-10 shrink-0 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition hover:border-indigo-400 hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                onClick={onEdit}
                disabled={isEditingDisabled}
                aria-label="Edit measure"
                title="Edit measure"
            >
                <FontAwesomeIcon icon={faPenToSquare} />
            </button>
        </section>
    )
}
