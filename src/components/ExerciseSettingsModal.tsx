import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faStop, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useRef, useState } from 'react'
import type { GenerationOptions } from '../domain/exercise'
import { presetToExercise, stickControlPresets, type StickControlPreset } from '../domain/stickControlPresets'
import type { PickStroke, TimeSignature } from '../types'
import type { StepKind } from '../domain/measureSteps'
import { MeasureEditor } from './MeasureEditor'
import { EngravedMeasure } from './EngravedMeasure'

type Tab = 'manual' | 'presets' | 'generator'

type Props = {
    measures: number
    signature: TimeSignature
    options: GenerationOptions
    onClose: () => void
    onSettingsChange: (measures: number, signature: TimeSignature) => void
    manualSteps: StepKind[]
    manualStrokes: (PickStroke | undefined)[]
    isManualPreviewing: boolean
    onManualChange: (step: number, kind: StepKind) => void
    onManualStrokeChange: (step: number, stroke: PickStroke) => void
    onManualPreview: () => void
    onManualSave: () => void
    onPreset: (preset: StickControlPreset) => void
    onGenerate: (measures: number, options: GenerationOptions, signature: TimeSignature) => void
}

const tabs: { id: Tab; label: string }[] = [
    { id: 'manual', label: 'Manual' },
    { id: 'presets', label: 'Presets' },
    { id: 'generator', label: 'Generator' },
]

function PresetNotation({ preset }: { preset: StickControlPreset }) {
    const notes = presetToExercise(preset)
    const element = useRef<HTMLSpanElement>(null)
    const [measureWidth, setMeasureWidth] = useState(124)

    useEffect(() => {
        const container = element.current
        if (!container) return

        const updateWidth = () => setMeasureWidth(Math.floor(container.clientWidth / 2))
        updateWidth()
        const observer = new ResizeObserver(updateWidth)
        observer.observe(container)
        return () => observer.disconnect()
    }, [])

    return (
        <span className="preset-notation" ref={element} aria-hidden="true">
            {[0, 1].map((measure) => (
                <span className="preset-notation-measure" key={measure}>
                    <EngravedMeasure measureNumber={measure + 1} showMeasureNumber={false} notes={notes.filter((note) => note.measure === measure)} signature="4/4" width={measureWidth} scale={1} activeSlot={-1} />
                </span>
            ))}
        </span>
    )
}

export function ExerciseSettingsModal({
    measures,
    signature,
    options,
    onClose,
    onSettingsChange,
    manualSteps,
    manualStrokes,
    isManualPreviewing,
    onManualChange,
    onManualStrokeChange,
    onManualPreview,
    onManualSave,
    onPreset,
    onGenerate,
}: Props) {
    const [tab, setTab] = useState<Tab>('manual')
    const [generatorMeasures, setGeneratorMeasures] = useState(measures)
    const [generatorSignature, setGeneratorSignature] = useState(signature)
    const [generatorOptions, setGeneratorOptions] = useState(options)

    function selectTab(nextTab: Tab) {
        if (nextTab === 'generator' && tab !== 'generator') {
            setGeneratorMeasures(measures)
            setGeneratorSignature(signature)
            setGeneratorOptions(options)
        }
        setTab(nextTab)
    }
    return (
        <div className="measure-editor-backdrop" role="presentation" onMouseDown={onClose}>
            <section className="exercise-settings-modal" role="dialog" aria-modal="true" aria-label="Exercise settings" onMouseDown={(event) => event.stopPropagation()}>
                <div className="settings-tab-bar">
                    <div className="settings-tabs" role="tablist">
                        {tabs.map(({ id, label }) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => selectTab(id)}>{label}</button>)}
                    </div>
                    <button className="editor-close" type="button" onClick={onClose} aria-label="Close settings"><FontAwesomeIcon icon={faXmark} /></button>
                </div>
                <div className="settings-tab-content">
                    {tab === 'manual' ? <div className="settings-editor-tab">
                        <div className="settings-fields">
                            <label>Time signature<select value={signature} onChange={(event) => onSettingsChange(measures, event.target.value as TimeSignature)}><option>4/4</option><option>3/4</option><option>6/8</option></select></label>
                            <label>Measures<select value={measures} onChange={(event) => onSettingsChange(Number(event.target.value), signature)}>{[2, 3, 4, 6, 8, 12, 16, 24, 32].map((count) => <option key={count}>{count}</option>)}</select></label>
                        </div>
                        <MeasureEditor measure={0} signature={signature} steps={manualSteps} strokes={manualStrokes} isPreviewing={isManualPreviewing} onChange={onManualChange} onStrokeChange={onManualStrokeChange} onPreview={onManualPreview} onSave={onManualSave} onClose={onClose} embedded />
                    </div> : null}
                    {tab === 'presets' ? <div className="preset-grid">{stickControlPresets.map((preset) => <button type="button" key={preset.number} onClick={() => onPreset(preset)} aria-label={'Choose preset ' + preset.number}><strong>{preset.number}</strong><PresetNotation preset={preset} /></button>)}</div> : null}
                    {tab === 'generator' ? <div className="generator-tab">
                        <div className="settings-fields">
                            <label>Time signature<select value={generatorSignature} onChange={(event) => setGeneratorSignature(event.target.value as TimeSignature)}><option>4/4</option><option>3/4</option><option>6/8</option></select></label>
                            <label>Measures<select value={generatorMeasures} onChange={(event) => setGeneratorMeasures(Number(event.target.value))}>{[2, 3, 4, 6, 8, 12, 16, 24, 32].map((count) => <option key={count}>{count}</option>)}</select></label>
                        </div>
                        <fieldset className="generation-options"><legend>Allowed elements</legend>{([['rests', 'Rests'], ['eighths', 'Eighth notes'], ['sixteenths', 'Sixteenth notes'], ['palmMutes', 'Palm mute'], ['triplets', 'Triplets']] as [keyof GenerationOptions, string][]).map(([option, label]) => <label className="generation-option" key={option}><input type="checkbox" checked={generatorOptions[option]} onChange={(event) => setGeneratorOptions((previous) => ({ ...previous, [option]: event.target.checked }))} /><span>{label}</span></label>)}</fieldset>
                    </div> : null}
                </div>
                {tab === 'manual' ? <footer className="measure-editor-actions manual-editor-actions">
                    <button className="editor-preview" type="button" onClick={onManualPreview}>
                        <FontAwesomeIcon icon={isManualPreviewing ? faStop : faPlay} />
                        {isManualPreviewing ? 'Stop' : 'Listen'}
                    </button>
                    <button className="editor-save" type="button" onClick={onManualSave}>Apply</button>
                </footer> : null}
                {tab === 'generator' ? <footer className="measure-editor-actions generator-actions">
                    <button className="editor-save" type="button" onClick={() => onGenerate(generatorMeasures, generatorOptions, generatorSignature)}>Generate</button>
                </footer> : null}
            </section>
        </div>
    )
}
