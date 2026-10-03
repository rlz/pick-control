import type { RefObject } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faStar, faTrash } from '@fortawesome/free-solid-svg-icons'
import { Measure } from './Measure'
import { ExerciseComment } from './ExerciseComment'
import type { SessionPhase } from '../store/sessionStore'
import type { ExerciseNote, TimeSignature } from '../types'
import { useTranslation } from 'react-i18next'

type Props = {
    signature: TimeSignature
    measures: number
    notes: ExerciseNote[]
    sourceLabel: string
    comment: string
    isFavorite: boolean
    favoriteId?: string
    selectedMeasure: number | null
    activeMeasure: number
    activeSlot: number
    phase: SessionPhase
    previewing: 'all' | number | null
    countInBeat: number
    countInBeats: number
    notationScroll: RefObject<HTMLDivElement | null>
    onTempoClose: () => void
    onSignature: (signature: TimeSignature) => void
    onAddMeasure: () => void
    onClear: () => void
    onCommentInteraction: () => void
    onCommentSave: (comment: string) => void
    onFavorite: () => void
    onSelectMeasure: (index: number) => void
    onEdit: () => void
    onDuplicate: (index: number) => void
    onMove: (index: number, direction: -1 | 1) => void
    onDelete: (index: number) => void
}

export function ExerciseWorkspace(props: Props) {
    const { t } = useTranslation()
    const running = props.phase === 'playing' || props.previewing !== null
    return (
        <div className="app-body grid min-h-0 overflow-hidden">
            <section
                className="relative grid min-h-0 min-w-0 overflow-hidden bg-slate-950"
                onClick={props.onTempoClose}
            >
                <div className="absolute right-5 top-5 z-20 flex items-center gap-1 md:right-7 md:top-7">
                    <div className="relative">
                        <select
                            className="h-10 appearance-none rounded-md border border-slate-600 bg-slate-800 px-3 py-0 font-mono text-xs font-semibold text-indigo-200 hover:border-indigo-400"
                            value={props.signature}
                            onChange={(event) =>
                                props.onSignature(event.target.value as TimeSignature)
                            }
                            aria-label={t('changeTimeSignature')}
                            title={t('changeTimeSignature')}
                        >
                            <option>4/4</option>
                            <option>3/4</option>
                            <option>6/8</option>
                        </select>
                        <svg
                            className="pointer-events-none absolute right-3 top-1/2 h-1.5 w-2.5 -translate-y-1/2 text-indigo-200"
                            viewBox="0 0 10 6"
                            fill="none"
                            aria-hidden="true"
                        >
                            <path d="m1 1 4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                    </div>
                    <button
                        className="grid size-10 place-items-center rounded-md border border-slate-600 bg-slate-800 text-indigo-200 transition hover:border-indigo-400 hover:bg-slate-700"
                        type="button"
                        onClick={props.onAddMeasure}
                        aria-label={t('addEmptyMeasure')}
                        title={t('addEmptyMeasure')}
                    >
                        <FontAwesomeIcon icon={faPlus} />
                    </button>
                    <button
                        className="grid size-10 place-items-center rounded-md border border-red-900 bg-slate-800 text-rose-300 transition hover:border-rose-400 hover:bg-rose-950"
                        type="button"
                        onClick={props.onClear}
                        aria-label={t('clearExercise')}
                        title={t('clearExercise')}
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
                <div
                    className="min-h-0 overflow-x-hidden overflow-y-auto p-5 md:p-7"
                    ref={props.notationScroll}
                >
                    <div
                        className="mb-3 ml-1 font-mono text-xs font-semibold uppercase tracking-wider text-slate-500"
                        aria-label={t('exerciseSource', { source: props.sourceLabel })}
                    >
                        <span className="text-indigo-300">{props.sourceLabel}</span>
                    </div>
                    <div className="mb-4 ml-1 flex items-center gap-2 max-sm:flex-col max-sm:items-stretch">
                        <ExerciseComment
                            value={props.comment}
                            onInteraction={props.onCommentInteraction}
                            onSave={props.onCommentSave}
                        />
                        <button
                            type="button"
                            className={`whitespace-nowrap rounded-md border px-2 py-2 text-xs font-semibold transition hover:bg-slate-700 ${props.isFavorite ? 'border-amber-400 bg-amber-950 text-amber-300 hover:border-amber-300' : 'border-slate-600 bg-slate-800 text-indigo-200 hover:border-indigo-400'}`}
                            onClick={props.onFavorite}
                            aria-label={props.favoriteId ? t('removeFavorite') : t('addFavorite')}
                            title={props.favoriteId ? t('removeFavorite') : t('addFavorite')}
                        >
                            <FontAwesomeIcon icon={faStar} />
                        </button>
                    </div>
                    <div className="flex min-w-0 flex-wrap content-start pb-36">
                        {Array.from({ length: props.measures }, (_, index) => (
                            <Measure
                                key={index}
                                index={index}
                                signature={props.signature}
                                notes={props.notes.filter((note) => note.measure === index)}
                                selected={props.selectedMeasure === index}
                                isActive={running && props.activeMeasure === index}
                                activeSlot={
                                    running && props.activeMeasure === index ? props.activeSlot : -1
                                }
                                onClick={() => props.onSelectMeasure(index)}
                                onEdit={props.onEdit}
                                onDuplicate={() => props.onDuplicate(index)}
                                onMove={(direction) => props.onMove(index, direction)}
                                onDelete={() => props.onDelete(index)}
                                isEditingDisabled={false}
                                canDelete={props.measures > 1}
                                canMoveRight={index < props.measures - 1}
                            />
                        ))}
                    </div>
                </div>
                {props.phase === 'count-in' ? (
                    <div
                        className="pointer-events-none absolute left-1/2 top-1/2 z-20 grid min-w-36 -translate-x-1/2 -translate-y-1/2 place-items-center gap-2 rounded-2xl border border-indigo-400/50 bg-slate-900/90 px-5 py-4 text-indigo-50 shadow-2xl ring-4 ring-indigo-400/10"
                        aria-live="assertive"
                        aria-atomic="true"
                        role="status"
                    >
                        <span className="font-mono text-xs font-medium uppercase tracking-widest text-indigo-200">
                            {t('getReady')}
                        </span>
                        <strong
                            className="min-w-8 text-center text-6xl font-bold leading-none text-indigo-300"
                            key={props.countInBeat}
                        >
                            {props.countInBeat || 1}
                        </strong>
                        <span className="flex gap-1" aria-hidden="true">
                            {Array.from({ length: props.countInBeats }, (_, index) => (
                                <i
                                    className={`size-2 rounded-full transition ${index < props.countInBeat ? 'scale-110 bg-indigo-300' : 'bg-slate-600'}`}
                                    key={index}
                                />
                            ))}
                        </span>
                    </div>
                ) : null}
            </section>
        </div>
    )
}
