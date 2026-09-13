import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faStop, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { PickStroke, TimeSignature } from '../types'
import type { StepKind } from '../domain/measureSteps'

type Props = {
    measure: number
    signature: TimeSignature
    steps: StepKind[]
    strokes: (PickStroke | undefined)[]
    isPreviewing: boolean
    onChange: (step: number, kind: StepKind) => void
    onStrokeChange: (step: number, stroke: PickStroke) => void
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
const kinds: StepKind[] = ['note', 'mute', 'triplet', 'continue', 'rest']

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

    const editor = (
            <section className={embedded ? 'measure-editor embedded' : 'measure-editor'} role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : true} aria-label={embedded ? undefined : `Measure ${measure + 1} editor, ${signature}`}>
                {!embedded ? <header className="measure-editor-header">
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
                    <div className="editor-matrix-axis">
                        <span />
                        <div
                            style={{
                                gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
                            }}
                        >
                            {Array.from({ length: steps.length }, (_, step) => (
                                <i
                                    className={step % beatSlots === 0 ? 'beat-start' : ''}
                                    key={step}
                                >
                                    {step % beatSlots === 0 ? step / beatSlots + 1 : ''}
                                </i>
                            ))}
                        </div>
                    </div>
                    {kinds.map((kind) => (
                        <div className="editor-state-row" key={kind}>
                            <span className="editor-row-label">{labels[kind]}</span>
                            <div
                                className="editor-cells"
                                style={{
                                    gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
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
                    {(['down', 'up'] as PickStroke[]).map((stroke) => (
                        <div className="editor-state-row" key={stroke}>
                            <span className="editor-row-label">{stroke === 'down' ? 'Down ↓' : 'Up ↑'}</span>
                            <div
                                className="editor-cells"
                                style={{
                                    gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
                                }}
                            >
                                {steps.map((kind, step) => {
                                    const selected = strokes[step] === stroke
                                    const playable = kind !== 'rest' && kind !== 'continue'
                                    return (
                                        <button
                                            className={`rhythm-cell stroke ${selected ? 'selected' : ''} ${
                                                step % beatSlots === 0 ? 'beat-start' : ''
                                            }`}
                                            disabled={!playable}
                                            key={step}
                                            type="button"
                                            onClick={() => onStrokeChange(step, stroke)}
                                            aria-label={`Set step ${step + 1} to ${stroke} stroke`}
                                            aria-pressed={selected}
                                            title={`Set step ${step + 1} to ${stroke} stroke`}
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
