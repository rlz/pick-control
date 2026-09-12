import { EngravedMeasure } from './EngravedMeasure'
import type { CSSProperties } from 'react'
import type { ExerciseNote, PlayerHit, TimeSignature } from '../types'

type Props = {
    index: number
    slots: number
    signature: TimeSignature
    notes: ExerciseNote[]
    hits: PlayerHit[]
    measureMs: number
    selected: boolean
    isActive: boolean
    activeSlot: number
    onClick: () => void
}

export function Measure({
    index,
    slots,
    signature,
    notes,
    hits,
    measureMs,
    selected,
    isActive,
    activeSlot,
    onClick,
}: Props) {
    const measureWidth = Math.min(
        350,
        Math.max(
            230,
            215 + notes.length * 9 + notes.filter((note) => !note.isRest && note.duration < 4).length * 11,
        ),
    )
    const isOnTime = (hit: PlayerHit) =>
        notes
            .filter((note) => !note.isRest)
            .some(
                (note) =>
                    Math.abs((hit.time % measureMs) - (note.position / slots) * measureMs) < 150,
            )

    return (
        <button
            className={`measure ${selected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
            onClick={onClick}
            aria-label={`Open measure ${index + 1} timing`}
            data-measure={index}
            style={{ '--measure-width': `${measureWidth}px` } as CSSProperties}
        >
            <div className="engraved-score">
                <EngravedMeasure
                    measureNumber={index + 1}
                    notes={notes}
                    signature={signature}
                    width={measureWidth}
                    activeSlot={activeSlot}
                />
                {hits.map((hit, hitIndex) => (
                    <b
                        className={`player-hit ${isOnTime(hit) ? 'correct' : 'incorrect'}`}
                        key={hitIndex}
                        style={{ left: `${((hit.time % measureMs) / measureMs) * 100}%` }}
                        title={isOnTime(hit) ? 'On time' : 'Off beat'}
                    />
                ))}
            </div>
            <span className="tap">click to inspect</span>
        </button>
    )
}
