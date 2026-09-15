import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowUp, faPlay, faStop, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { PickStroke, TimeSignature } from '../types'
import { stepsToNotes, type StepKind } from '../domain/measureSteps'
import { signatures } from '../domain/exercise'

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

const labels: Record<StepKind, string> = {
    note: 'Note',
    mute: 'Palm mute',
    triplet: 'Triplet',
    continue: 'Continue',
    rest: 'Rest',
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
    const beatSlots = signature === '6/8' ? 6 : 4
    const spec = signatures[signature]
    const previewNotes = stepsToNotes(steps, measure, strokes)
    const timelineStart = 0
    const timelineSpan = 100

    const editor = (
            <section
                className={embedded ? 'measure-editor embedded' : 'measure-editor'}
                role={embedded ? undefined : 'dialog'}
                aria-modal={embedded ? undefined : true}
                aria-label={embedded ? undefined : `Measure ${measure + 1} editor, ${signature}`}
            >
                {!embedded ? <header className="measure-editor-header">
                    <h2>Measure {measure + 1}</h2>
                    <button
                        className="editor-close"
                        type="button"
                        onClick={onClose}
                        aria-label="Close editor"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </header> : null}
                <div className="editor-matrix">
                    <section className="editor-result-row" aria-label="Live rhythm preview">
                        <span aria-hidden="true" />
                        <div
                            className="editor-result-track"
                            style={{
                                gridTemplateColumns: `repeat(${steps.length}, var(--editor-cell-size))`,
                            }}
                        >
                            <div className="timeline">
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
                    <div className="editor-state-row">
                        <span className="editor-row-label">Stroke</span>
                        <div
                            className="editor-cells"
                            style={{
                                gridTemplateColumns: `repeat(${steps.length}, var(--editor-cell-size))`,
                            }}
                        >
                            {steps.map((kind, step) => {
                                const stroke = strokes[step]
                                const playable = kind !== 'rest' && kind !== 'continue'
                                const nextStroke =
                                    stroke === undefined ? 'down' : stroke === 'down' ? 'up' : undefined
                                return (
                                    <button
                                        className={`rhythm-cell stroke ${stroke ?? 'unset'}`}
                                        disabled={!playable}
                                        key={step}
                                        type="button"
                                        onClick={() => onStrokeChange(step, nextStroke)}
                                        aria-label={`Cycle stroke at step ${step + 1}`}
                                        title="Cycle stroke: down, up, not set"
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
                        <div className="editor-state-row" key={kind}>
                            <span className="editor-row-label">{labels[kind]}</span>
                            <div
                                className="editor-cells"
                                style={{
                                    gridTemplateColumns: `repeat(${steps.length}, var(--editor-cell-size))`,
                                }}
                            >
                                {steps.map((selectedKind, step) => {
                                    const selected = selectedKind === kind
                                    return (
                                        <button
                                            className={`rhythm-cell ${kind} ${selected ? 'selected' : ''} ${
                                                step % beatSlots === 0 ? 'beat-start' : ''
                                            }`}
                                            key={step}
                                            type="button"
                                            onClick={() => onChange(step, kind)}
                                            aria-label={`Set step ${step + 1} to ${labels[kind]}`}
                                            aria-pressed={selected}
                                            title={`Set step ${step + 1} to ${labels[kind]}`}
                                        >
                                            {selected ? <span aria-hidden="true">●</span> : null}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                {!embedded ? <footer className="measure-editor-actions">
                    <button className="editor-preview" type="button" onClick={onPreview}>
                        <FontAwesomeIcon icon={isPreviewing ? faStop : faPlay} />
                        {isPreviewing ? 'Stop' : 'Listen'}
                    </button>
                    <div>
                        {!embedded ? <button className="editor-cancel" type="button" onClick={onClose}>
                            Cancel
                        </button> : null}
                        <button className="editor-save" type="button" onClick={onSave}>
                            {embedded ? 'Apply to exercise' : 'Save measure'}
                        </button>
                    </div>
                </footer>
                : null}
            </section>
    )
    return embedded ? editor : (
        <div className="measure-editor-backdrop" role="presentation" onMouseDown={onClose}>
            <div className="measure-editor-shell" onMouseDown={(event) => event.stopPropagation()}>{editor}</div>
        </div>
    )
}
