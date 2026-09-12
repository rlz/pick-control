import { faPlay, faStop } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ExerciseNote, PlayerHit } from '../types'

type Props = {
    measure: number
    notes: ExerciseNote[]
    hits: PlayerHit[]
    slots: number
    beats: number
    measureMs: number
    onPreview: () => void
    isPreviewing: boolean
}

export function TimingDetail({
    measure,
    notes,
    hits,
    slots,
    beats,
    measureMs,
    onPreview,
    isPreviewing,
}: Props) {
    const isOnTime = (hit: PlayerHit) =>
        notes
            .filter((note) => !note.isRest)
            .some(
                (note) =>
                    Math.abs((hit.time % measureMs) - (note.position / slots) * measureMs) < 150,
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
            <div className="timeline min-w-28 flex-1 sm:min-w-35">
                <div className="axis">
                    {Array.from({ length: beats + 1 }, (_, index) => (
                        <span key={index} style={{ left: `${(index / beats) * 100}%` }}>
                            {index + 1}
                        </span>
                    ))}
                </div>
                {Array.from({ length: slots + 1 }, (_, index) => (
                    <i
                        key={index}
                        className={`subdivision ${index % 4 === 0 ? 'beat' : index % 2 === 0 ? 'eighth' : 'sixteenth'}`}
                        style={{ left: `${(index / slots) * 100}%` }}
                    />
                ))}
                {notes
                    .filter((note) => !note.isRest)
                    .map((note) => (
                        <span
                            className={`rhythm-bar ${note.palmMuted ? 'palm-muted' : ''}`}
                            key={note.id}
                            style={{
                                left: `${(note.position / slots) * 100}%`,
                                width: `${(note.duration / slots) * 100}%`,
                            }}
                            title={`${note.palmMuted ? 'Palm mute · ' : ''}Target: ${((note.position / slots) * 4 + 1).toFixed(2)}`}
                        />
                    ))}
                {hits.map((hit, hitIndex) => (
                    <span
                        className={`marker player ${isOnTime(hit) ? 'correct' : 'incorrect'}`}
                        key={hitIndex}
                        style={{ left: `${((hit.time % measureMs) / measureMs) * 100}%` }}
                        title={isOnTime(hit) ? 'On time' : 'Off beat'}
                    />
                ))}
            </div>
        </section>
    )
}
