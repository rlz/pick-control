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
        <section className="detail">
            <div>
                <p className="eyebrow">
                    MEASURE {String(measure + 1).padStart(2, '0')} · TIMING MAP
                </p>
                <h3>Where the attacks land</h3>
                <button
                    className="detail-preview"
                    onClick={onPreview}
                    aria-label={isPreviewing ? 'Stop measure preview' : 'Play measure'}
                    title={isPreviewing ? 'Stop measure preview' : 'Play measure'}
                >
                    <FontAwesomeIcon icon={isPreviewing ? faStop : faPlay} />
                </button>
            </div>
            <div className="timeline">
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
            <p className="detail-copy">
                Gold markers are the written attacks. Teal markers are attacks detected from your
                microphone. A hit is counted within ±150 ms.
            </p>
        </section>
    )
}
