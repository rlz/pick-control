import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowUp, faPlay, faStop, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { CSSProperties } from 'react'
import type { PickStroke, TimeSignature } from '../types'
import { stepsToNotes, type StepKind } from '../domain/measureSteps'
import { signatures } from '../domain/exercise'
import { useTranslation } from 'react-i18next'

type Props = {
    measure: number
    signature: TimeSignature
    steps: StepKind[]
    strokes: (PickStroke | undefined)[]
    isPreviewing: boolean
    onChange: (step: number, kind: StepKind) => void
    onStrokeChange: (step: number, stroke: PickStroke | undefined) => void
    onPreview: () => void
    onSave: () => void
    onClose: () => void
    embedded?: boolean
}

const labelKeys: Record<StepKind, string> = {
    note: 'note',
    mute: 'palmMute',
    triplet: 'triplet',
    continue: 'continue',
    rest: 'rest',
}
const kinds: StepKind[] = ['note', 'triplet', 'continue', 'rest', 'mute']

export function MeasureEditor({
    measure,
    signature,
    steps,
    strokes,
    isPreviewing,
    onChange,
    onStrokeChange,
    onPreview,
    onSave,
    onClose,
    embedded = false,
}: Props) {
    const { t } = useTranslation()
    const beatSlots = signature === '6/8' ? 6 : 4
    const mobileColumns = signature === '6/8' ? 6 : 8
    const spec = signatures[signature]
    const previewNotes = stepsToNotes(steps, measure, strokes)
    const timelineStart = 0
    const timelineSpan = 100

    const editor = (
        <section
            className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl max-sm:h-dvh max-sm:rounded-none sm:h-auto ${embedded ? 'border-0 bg-transparent shadow-none' : ''}`}
            role={embedded ? undefined : 'dialog'}
            aria-modal={embedded ? undefined : true}
            aria-label={
                embedded ? undefined : t('measureEditorTitle', { number: measure + 1, signature })
            }
        >
            {!embedded ? (
                <header className="flex shrink-0 items-center justify-between p-4">
                    <h2 className="m-0 font-sans text-sm font-semibold text-slate-200">
                        {t('measureNumber', { number: measure + 1 })}
                    </h2>
                    <button
                        className="grid size-9 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-400"
                        type="button"
                        onClick={onClose}
                        aria-label={t('closeEditor')}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </header>
            ) : null}
            <div
                className={`min-h-0 flex-1 space-y-3 overflow-y-auto border-y border-slate-800 bg-slate-950/50 px-4 py-3 max-sm:h-0 ${embedded ? 'border-0 bg-transparent py-4' : ''}`}
            >
                <section
                    className="flex min-w-0 items-end gap-3"
                    aria-label={t('liveRhythmPreview')}
                >
                    <span className="hidden w-20 shrink-0 md:block" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                        <div className="timeline mt-5 mb-1.5">
                            <div className="axis">
                                {Array.from({ length: spec.beats + 1 }, (_, index) => (
                                    <span
                                        key={index}
                                        style={{
                                            left: `${timelineStart + (index / spec.beats) * timelineSpan}%`,
                                        }}
                                    >
                                        {index + 1}
                                    </span>
                                ))}
                            </div>
                            {Array.from({ length: spec.slots + 1 }, (_, index) => (
                                <i
                                    key={index}
                                    className={`subdivision ${index % beatSlots === 0 ? 'beat' : index % (beatSlots / 2) === 0 ? 'eighth' : 'sixteenth'}`}
                                    style={{
                                        left: `${timelineStart + (index / spec.slots) * timelineSpan}%`,
                                    }}
                                />
                            ))}
                            {previewNotes
                                .filter((note) => !note.isRest)
                                .map((note) => (
                                    <span
                                        className={`rhythm-bar ${note.palmMuted ? 'palm-muted' : ''}`}
                                        key={note.id}
                                        style={{
                                            left: `${timelineStart + (note.position / spec.slots) * timelineSpan}%`,
                                            width: `${(note.duration / spec.slots) * timelineSpan}%`,
                                        }}
                                    />
                                ))}
                        </div>
                    </div>
                </section>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                    <span className="text-xs font-medium text-slate-300 md:w-20 md:shrink-0">
                        {t('stroke')}
                    </span>
                    <div
                        className="measure-editor-cells min-w-0 flex-1"
                        style={{ '--mobile-step-columns': mobileColumns } as CSSProperties}
                    >
                        {steps.map((kind, step) => {
                            const stroke = strokes[step]
                            const playable = kind !== 'rest' && kind !== 'continue'
                            const nextStroke =
                                stroke === undefined ? 'down' : stroke === 'down' ? 'up' : undefined
                            return (
                                <button
                                    className={`grid aspect-square min-w-0 flex-1 place-items-center rounded-md border font-mono text-xs font-semibold transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-35 ${stroke === 'down' ? 'border-amber-400 bg-amber-950 text-amber-100' : stroke === 'up' ? 'border-cyan-400 bg-cyan-950 text-cyan-200' : 'border-dashed border-slate-600 bg-slate-900 text-transparent'}`}
                                    disabled={!playable}
                                    key={step}
                                    type="button"
                                    onClick={() => onStrokeChange(step, nextStroke)}
                                    aria-label={t('cycleStrokeAtStep', { step: step + 1 })}
                                    title={t('cycleStroke')}
                                >
                                    {stroke === 'down' ? (
                                        <FontAwesomeIcon icon={faArrowDown} />
                                    ) : stroke === 'up' ? (
                                        <FontAwesomeIcon icon={faArrowUp} />
                                    ) : null}
                                </button>
                            )
                        })}
                    </div>
                </div>
                {kinds.map((kind) => (
                    <div
                        className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3"
                        key={kind}
                    >
                        <span className="text-xs font-medium text-slate-300 md:w-20 md:shrink-0">
                            {t(labelKeys[kind])}
                        </span>
                        <div
                            className="measure-editor-cells min-w-0 flex-1"
                            style={{ '--mobile-step-columns': mobileColumns } as CSSProperties}
                        >
                            {steps.map((selectedKind, step) => {
                                const selected = selectedKind === kind
                                return (
                                    <button
                                        className={`grid aspect-square min-w-0 flex-1 place-items-center rounded-md border border-slate-600 bg-slate-900 font-mono text-xs font-semibold text-transparent transition hover:-translate-y-px hover:border-indigo-300 ${step % beatSlots === 0 ? 'border-l-slate-500' : ''} ${selected && kind === 'note' ? '!border-indigo-500 !bg-indigo-600/20 !text-indigo-100' : ''} ${selected && kind === 'triplet' ? '!border-cyan-400 !bg-cyan-600/20 !text-cyan-200' : ''} ${selected && kind === 'mute' ? '!border-slate-400 !bg-slate-600/50 !text-slate-100' : ''} ${selected && kind === 'continue' ? '!border-dashed !border-slate-500 !bg-slate-800 !text-slate-400' : ''} ${selected && kind === 'rest' ? '!border-slate-700 !bg-slate-900 !text-slate-500' : ''}`}
                                        key={step}
                                        type="button"
                                        onClick={() => onChange(step, kind)}
                                        aria-label={t('setStepTo', {
                                            step: step + 1,
                                            kind: t(labelKeys[kind]),
                                        })}
                                        aria-pressed={selected}
                                        title={t('setStepTo', {
                                            step: step + 1,
                                            kind: t(labelKeys[kind]),
                                        })}
                                    >
                                        {selected ? <span aria-hidden="true">●</span> : null}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
            {!embedded ? (
                <footer className="mt-auto flex shrink-0 items-center justify-between gap-3 border-t border-slate-800 bg-slate-900 p-4">
                    <button
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-sm font-semibold text-slate-200"
                        type="button"
                        onClick={onPreview}
                    >
                        <FontAwesomeIcon icon={isPreviewing ? faStop : faPlay} />
                        {isPreviewing ? t('stop') : t('listen')}
                    </button>
                    <div className="flex gap-2">
                        {!embedded ? (
                            <button
                                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-sm font-semibold text-slate-200"
                                type="button"
                                onClick={onClose}
                            >
                                {t('cancel')}
                            </button>
                        ) : null}
                        <button
                            className="rounded-lg border border-indigo-400 bg-indigo-300 px-3 py-3 text-sm font-semibold text-indigo-950"
                            type="button"
                            onClick={onSave}
                        >
                            {embedded ? t('applyToExercise') : t('saveMeasure')}
                        </button>
                    </div>
                </footer>
            ) : null}
        </section>
    )
    return embedded ? (
        editor
    ) : (
        <div
            className="fixed inset-0 z-40 grid place-items-center bg-slate-950/80 p-0 backdrop-blur-sm sm:p-4"
            role="presentation"
            onMouseDown={onClose}
        >
            <div
                className="h-full w-full max-w-4xl max-sm:h-dvh sm:h-auto"
                onMouseDown={(event) => event.stopPropagation()}
            >
                {editor}
            </div>
        </div>
    )
}
