import { EngravedMeasure } from './EngravedMeasure'
import { getNoteFeedback } from '../domain/noteFeedback'
import { useEffect, useState } from 'react'
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
    const [viewportWidth, setViewportWidth] = useState<number | null>(null)

    useEffect(() => {
        const updateViewportWidth = () => setViewportWidth(window.innerWidth)
        updateViewportWidth()
        window.addEventListener('resize', updateViewportWidth)
        return () => window.removeEventListener('resize', updateViewportWidth)
    }, [])

    const minimumWidth =
        viewportWidth !== null && viewportWidth <= 480
            ? 170
            : viewportWidth !== null && viewportWidth <= 1023
              ? 190
              : viewportWidth !== null && viewportWidth <= 1200
                ? 200
                : 230
    const notationScale =
        viewportWidth !== null && viewportWidth <= 480
            ? 0.7
            : viewportWidth !== null && viewportWidth <= 1023
              ? 0.8
              : viewportWidth !== null && viewportWidth <= 1200
                ? 0.9
                : 1
    const measureWidth = Math.min(
        350,
        Math.max(
            minimumWidth,
            215 +
                notes.length * 9 +
                notes.filter((note) => !note.isRest && note.duration < 4).length * 11,
        ),
    )
    const displayWidth = Math.round(measureWidth * notationScale)
    const noteFeedback = getNoteFeedback(notes, hits, slots, measureMs)

    return (
        <button
            className={`measure ${selected ? 'selected' : ''} ${isActive ? 'active' : ''} relative min-h-48 flex-[0_0_var(--measure-width)] border-0 bg-transparent p-0 text-left text-inherit transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400`}
            onClick={onClick}
            aria-label={`Open measure ${index + 1} timing`}
            data-measure={index}
            style={{ '--measure-width': `${displayWidth}px` } as CSSProperties}
        >
            <div className="engraved-score">
                <EngravedMeasure
                    measureNumber={index + 1}
                    notes={notes}
                    signature={signature}
                    width={measureWidth}
                    scale={notationScale}
                    activeSlot={activeSlot}
                    noteFeedback={noteFeedback}
                />
            </div>
            <span className="tap">inspect timing</span>
        </button>
    )
}
