import { EngravedMeasure } from './EngravedMeasure'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faClone,
    faPenToSquare,
    faTrash,
    faArrowLeft,
    faArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ExerciseNote, TimeSignature } from '../types'

type Props = {
    index: number
    signature: TimeSignature
    notes: ExerciseNote[]
    selected: boolean
    isActive: boolean
    activeSlot: number
    onClick: () => void
    onEdit: () => void
    onDuplicate: () => void
    onMove: (direction: -1 | 1) => void
    onDelete: () => void
    isEditingDisabled: boolean
    canDelete: boolean
    canMoveRight: boolean
}

export function Measure({
    index,
    signature,
    notes,
    selected,
    isActive,
    activeSlot,
    onClick,
    onEdit,
    onDuplicate,
    onMove,
    onDelete,
    isEditingDisabled,
    canDelete,
    canMoveRight,
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
    return (
        <div
            role="button"
            tabIndex={0}
            className={`measure ${selected ? 'selected' : ''} ${isActive ? 'active' : ''} relative min-h-48 flex-[0_0_var(--measure-width)] border-0 bg-transparent p-0 text-left text-inherit transition-colors`}
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onClick()
                }
            }}
            aria-label={`Select measure ${index + 1}`}
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
                />
            </div>
            {selected ? (
                <div className="measure-actions" aria-label={`Measure ${index + 1} actions`}>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            onEdit()
                        }}
                        disabled={isEditingDisabled}
                        aria-label="Edit measure"
                        title="Edit measure"
                    >
                        <FontAwesomeIcon icon={faPenToSquare} />
                    </button>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            onDuplicate()
                        }}
                        disabled={isEditingDisabled}
                        aria-label="Duplicate measure"
                        title="Duplicate measure"
                    >
                        <FontAwesomeIcon icon={faClone} />
                    </button>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            onMove(-1)
                        }}
                        disabled={isEditingDisabled || index === 0}
                        aria-label="Move measure left"
                        title="Move measure left"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            onMove(1)
                        }}
                        disabled={isEditingDisabled || !canMoveRight}
                        aria-label="Move measure right"
                        title="Move measure right"
                    >
                        <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                    <button
                        type="button"
                        className="danger"
                        onClick={(event) => {
                            event.stopPropagation()
                            onDelete()
                        }}
                        disabled={isEditingDisabled || !canDelete}
                        aria-label="Delete measure"
                        title="Delete measure"
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            ) : null}
        </div>
    )
}
