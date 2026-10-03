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
import type { ExerciseNote, TimeSignature } from '../types'
import { useTranslation } from 'react-i18next'

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
    const { t } = useTranslation()
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
            className={`relative min-h-48 flex-none border-0 p-0 text-left text-inherit outline-none transition-colors focus-visible:outline-none ${selected ? 'bg-indigo-400/5' : isActive ? 'bg-cyan-400/5' : 'bg-transparent'}`}
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onClick()
                }
            }}
            aria-label={t('selectMeasure', { number: index + 1 })}
            data-measure={index}
            style={{ width: displayWidth }}
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
                <div
                    className="absolute right-1 top-1 z-10 flex gap-1 rounded-lg border border-slate-700 bg-slate-900/90 p-1 shadow-lg"
                    aria-label={t('measureActions', { number: index + 1 })}
                >
                    <button
                        className="grid size-8 place-items-center rounded-md border border-transparent text-slate-300 transition hover:border-indigo-400 hover:bg-indigo-900/30 hover:text-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            onEdit()
                        }}
                        disabled={isEditingDisabled}
                        aria-label={t('editMeasure')}
                        title={t('editMeasure')}
                    >
                        <FontAwesomeIcon icon={faPenToSquare} />
                    </button>
                    <button
                        className="grid size-8 place-items-center rounded-md border border-transparent text-slate-300 transition hover:border-indigo-400 hover:bg-indigo-900/30 hover:text-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            onDuplicate()
                        }}
                        disabled={isEditingDisabled}
                        aria-label={t('duplicateMeasure')}
                        title={t('duplicateMeasure')}
                    >
                        <FontAwesomeIcon icon={faClone} />
                    </button>
                    <button
                        className="grid size-8 place-items-center rounded-md border border-transparent text-slate-300 transition hover:border-indigo-400 hover:bg-indigo-900/30 hover:text-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            onMove(-1)
                        }}
                        disabled={isEditingDisabled || index === 0}
                        aria-label={t('moveMeasureLeft')}
                        title={t('moveMeasureLeft')}
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                    <button
                        className="grid size-8 place-items-center rounded-md border border-transparent text-slate-300 transition hover:border-indigo-400 hover:bg-indigo-900/30 hover:text-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            onMove(1)
                        }}
                        disabled={isEditingDisabled || !canMoveRight}
                        aria-label={t('moveMeasureRight')}
                        title={t('moveMeasureRight')}
                    >
                        <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                    <button
                        type="button"
                        className="grid size-8 place-items-center rounded-md border border-transparent text-rose-300 transition hover:border-rose-400 hover:bg-rose-950/50 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={(event) => {
                            event.stopPropagation()
                            onDelete()
                        }}
                        disabled={isEditingDisabled || !canDelete}
                        aria-label={t('deleteMeasure')}
                        title={t('deleteMeasure')}
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            ) : null}
        </div>
    )
}
