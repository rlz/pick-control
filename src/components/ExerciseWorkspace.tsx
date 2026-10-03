import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faPlus, faStar, faTrash } from '@fortawesome/free-solid-svg-icons'
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

export function ExerciseWorkspace({ notationScroll, ...props }: Props) {
    const { t } = useTranslation()
    const running = props.phase === 'playing' || props.previewing !== null
    const [signatureOpen, setSignatureOpen] = useState(false)
    const signatureSelector = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!signatureOpen) return
        const closeOnOutsideClick = (event: PointerEvent) => {
            if (!signatureSelector.current?.contains(event.target as Node)) {
                setSignatureOpen(false)
            }
        }
        document.addEventListener('pointerdown', closeOnOutsideClick)
        return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
    }, [signatureOpen])

    function moveSignatureFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
        const options = signatureSelector.current?.querySelectorAll<HTMLButtonElement>(
            '[role="option"]',
        )
        if (!options?.length) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            options[(index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length].focus()
        } else if (event.key === 'Escape') {
            setSignatureOpen(false)
            signatureSelector.current?.querySelector('button')?.focus()
        }
    }

    return (
        <div className="app-body grid min-h-0 overflow-hidden">
            <section
                className="relative grid min-h-0 min-w-0 overflow-hidden bg-slate-950"
                onClick={props.onTempoClose}
            >
                <div className="absolute right-5 top-5 z-20 flex items-center gap-1 md:right-7 md:top-7">
                    <div className="relative" ref={signatureSelector}>
                        <button
                            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-3 font-mono text-xs font-semibold text-indigo-200 hover:border-indigo-400"
                            type="button"
                            onClick={() => setSignatureOpen((open) => !open)}
                            onKeyDown={(event) => {
                                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                    event.preventDefault()
                                    setSignatureOpen(true)
                                    requestAnimationFrame(() =>
                                        signatureSelector.current
                                            ?.querySelector<HTMLButtonElement>(`[data-signature="${props.signature}"]`)
                                            ?.focus(),
                                    )
                                }
                            }}
                            aria-label={t('changeTimeSignature')}
                            aria-haspopup="listbox"
                            aria-expanded={signatureOpen}
                            title={t('changeTimeSignature')}
                        >
                            <span>{props.signature}</span>
                            <FontAwesomeIcon icon={faChevronDown} className="size-2.5 shrink-0" aria-hidden="true" />
                        </button>
                        {signatureOpen ? (
                            <div className="absolute right-0 top-full z-30 mt-1 min-w-full overflow-hidden rounded-md border border-slate-600 bg-slate-800 p-1 shadow-xl" role="listbox" aria-label={t('changeTimeSignature')}>
                                {(['4/4', '3/4', '6/8'] as const).map((signature, index) => (
                                    <button
                                        key={signature}
                                        className={`block w-full rounded px-2 py-2 text-left font-mono text-xs font-semibold ${signature === props.signature ? 'bg-indigo-600/30 text-indigo-100' : 'text-slate-200 hover:bg-slate-700'}`}
                                        type="button"
                                        role="option"
                                        aria-selected={signature === props.signature}
                                        data-signature={signature}
                                        onClick={() => {
                                            setSignatureOpen(false)
                                            props.onSignature(signature as TimeSignature)
                                        }}
                                        onKeyDown={(event) => moveSignatureFocus(event, index)}
                                    >
                                        {signature}
                                    </button>
                                ))}
                            </div>
                        ) : null}
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
                    ref={notationScroll}
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
