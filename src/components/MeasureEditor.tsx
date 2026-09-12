import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faStop, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { TimeSignature } from '../types'
import type { StepKind } from '../domain/measureSteps'

type Props = {
    measure: number
    signature: TimeSignature
    steps: StepKind[]
    isPreviewing: boolean
    onChange: (step: number, kind: StepKind) => void
    onPreview: () => void
    onSave: () => void
    onClose: () => void
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
    isPreviewing,
    onChange,
    onPreview,
    onSave,
    onClose,
}: Props) {
    const beatSlots = signature === '6/8' ? 6 : 4

    return (
        <div className="measure-editor-backdrop" role="presentation" onMouseDown={onClose}>
            <section
                className="measure-editor"
                role="dialog"
                aria-modal="true"
                aria-labelledby="measure-editor-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="measure-editor-header">
                    <div>
                        <p>Measure {measure + 1}</p>
                        <h2 id="measure-editor-title">Rhythm editor · {signature}</h2>
                    </div>
                    <button
                        className="editor-close"
                        type="button"
                        onClick={onClose}
                        aria-label="Close editor"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </header>
                <p className="editor-help">
                    Pick a state from its row. Continue cells after a triplet set its length.
                </p>
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
                </div>
                <footer className="measure-editor-actions">
                    <button className="editor-preview" type="button" onClick={onPreview}>
                        <FontAwesomeIcon icon={isPreviewing ? faStop : faPlay} />
                        {isPreviewing ? 'Stop' : 'Listen'}
                    </button>
                    <div>
                        <button className="editor-cancel" type="button" onClick={onClose}>
                            Cancel
                        </button>
                        <button className="editor-save" type="button" onClick={onSave}>
                            Save measure
                        </button>
                    </div>
                </footer>
            </section>
        </div>
    )
}
