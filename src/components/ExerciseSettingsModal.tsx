import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faStop, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useRef, useState } from 'react'
import type { GenerationOptions } from '../domain/exercise'
import type { ExerciseSource, FavoriteExercise } from '../store/exerciseStore'
import {
    presetToExercise,
    stickControlPresets,
    type StickControlPreset,
} from '../domain/stickControlPresets'
import type { PickStroke, TimeSignature } from '../types'
import type { StepKind } from '../domain/measureSteps'
import { MeasureEditor } from './MeasureEditor'
import { EngravedMeasure } from './EngravedMeasure'

type Tab = 'manual' | 'presets' | 'generator' | 'favorites'

type Props = {
    measures: number
    signature: TimeSignature
    options: GenerationOptions
    source: ExerciseSource
    selectedPresetNumber?: number
    favorites: FavoriteExercise[]
    onClose: () => void
    manualSteps: StepKind[]
    manualStrokes: (PickStroke | undefined)[]
    isManualPreviewing: boolean
    onManualPreview: (steps: StepKind[], strokes: (PickStroke | undefined)[]) => void
    onManualSave: (
        measures: number,
        signature: TimeSignature,
        steps: StepKind[],
        strokes: (PickStroke | undefined)[],
    ) => void
    onPreset: (preset: StickControlPreset) => void
    onGenerate: (measures: number, options: GenerationOptions, signature: TimeSignature) => void
    onFavorite: (favorite: FavoriteExercise) => void
    onRemoveFavorite: (id: string) => void
}

const tabs: { id: Tab; label: string }[] = [
    { id: 'manual', label: 'Manual' },
    { id: 'presets', label: 'Presets' },
    { id: 'generator', label: 'Generator' },
    { id: 'favorites', label: 'Favorites' },
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
                    <EngravedMeasure
                        measureNumber={measure + 1}
                        showMeasureNumber={false}
                        notes={notes.filter((note) => note.measure === measure)}
                        signature="4/4"
                        width={measureWidth}
                        scale={1}
                        activeSlot={-1}
                    />
                </span>
            ))}
        </span>
    )
}

function FavoriteNotationPreview({ favorite }: { favorite: FavoriteExercise }) {
    const element = useRef<HTMLDivElement>(null)
    const [measureWidth, setMeasureWidth] = useState(180)
    const previewMeasures = Math.min(favorite.measures, 3)

    useEffect(() => {
        const container = element.current
        if (!container) return

        const updateWidth = () =>
            setMeasureWidth(Math.max(96, Math.floor(container.clientWidth / previewMeasures)))
        updateWidth()
        const observer = new ResizeObserver(updateWidth)
        observer.observe(container)
        return () => observer.disconnect()
    }, [previewMeasures])

    return (
        <div
            className="exercise-notation-preview"
            ref={element}
            aria-label="Exercise notation preview"
        >
            {Array.from({ length: previewMeasures }, (_, measure) => (
                <EngravedMeasure
                    key={measure}
                    measureNumber={measure + 1}
                    showMeasureNumber={false}
                    notes={favorite.exercise.filter((note) => note.measure === measure)}
                    signature={favorite.signature}
                    width={measureWidth}
                    scale={1}
                    activeSlot={-1}
                />
            ))}
        </div>
    )
}

export function ExerciseSettingsModal({
    measures,
    signature,
    options,
    source,
    selectedPresetNumber,
    favorites,
    onClose,
    manualSteps,
    manualStrokes,
    isManualPreviewing,
    onManualPreview,
    onManualSave,
    onPreset,
    onGenerate,
    onFavorite,
    onRemoveFavorite,
}: Props) {
    const [tab, setTab] = useState<Tab>(() =>
        source === 'preset'
            ? 'presets'
            : source === 'generator'
              ? 'generator'
              : source === 'favorite'
                ? 'favorites'
                : 'manual',
    )
    const [generatorMeasures, setGeneratorMeasures] = useState(measures)
    const [generatorSignature, setGeneratorSignature] = useState(signature)
    const [generatorOptions, setGeneratorOptions] = useState(options)
    const [manualMeasures, setManualMeasures] = useState(measures)
    const [manualSignature, setManualSignature] = useState(signature)
    const [draftManualSteps, setDraftManualSteps] = useState(manualSteps)
    const [draftManualStrokes, setDraftManualStrokes] = useState(manualStrokes)
    const presetElements = useRef(new Map<number, HTMLButtonElement>())

    useEffect(() => {
        if (tab !== 'presets' || selectedPresetNumber === undefined) return

        presetElements.current
            .get(selectedPresetNumber)
            ?.scrollIntoView({ block: 'center', behavior: 'auto' })
    }, [selectedPresetNumber, tab])

    function changeManualSignature(nextSignature: TimeSignature) {
        const slots = nextSignature === '6/8' ? 12 : Number(nextSignature[0]) * 4
        setManualSignature(nextSignature)
        setDraftManualSteps((previous) =>
            Array.from({ length: slots }, (_, step) => previous[step] ?? 'rest'),
        )
        setDraftManualStrokes((previous) =>
            Array.from({ length: slots }, (_, step) => previous[step]),
        )
    }

    function changeManualStep(step: number, kind: StepKind) {
        const wasRest = draftManualSteps[step] === 'rest'
        setDraftManualSteps((previous) => {
            const next = [...previous]
            next[step] = kind
            return next
        })
        if (kind === 'rest') {
            setDraftManualStrokes((previous) => {
                const next = [...previous]
                next[step] = undefined
                return next
            })
            return
        }
        if (!wasRest || kind === 'continue') return
        setDraftManualStrokes((previous) => {
            const next = [...previous]
            let previousStroke: PickStroke | undefined
            for (let index = step - 1; index >= 0; index--) {
                if (previous[index]) {
                    previousStroke = previous[index]
                    break
                }
            }
            next[step] = previousStroke === 'down' ? 'up' : 'down'
            return next
        })
    }

    function changeManualStroke(step: number, stroke: PickStroke) {
        setDraftManualStrokes((previous) => {
            const next = [...previous]
            next[step] = stroke
            return next
        })
    }

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
            <section
                className="exercise-settings-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Exercise settings"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="settings-tab-bar">
                    <div className="settings-tabs" role="tablist">
                        {tabs.map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={tab === id}
                                className={tab === id ? 'active' : ''}
                                onClick={() => selectTab(id)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <button
                        className="editor-close"
                        type="button"
                        onClick={onClose}
                        aria-label="Close settings"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
                <div className="settings-tab-content">
                    {tab === 'manual' ? (
                        <div className="settings-editor-tab">
                            <div className="settings-fields">
                                <label>
                                    Time signature
                                    <select
                                        value={manualSignature}
                                        onChange={(event) =>
                                            changeManualSignature(
                                                event.target.value as TimeSignature,
                                            )
                                        }
                                    >
                                        <option>4/4</option>
                                        <option>3/4</option>
                                        <option>6/8</option>
                                    </select>
                                </label>
                                <label>
                                    Measures
                                    <select
                                        value={manualMeasures}
                                        onChange={(event) =>
                                            setManualMeasures(Number(event.target.value))
                                        }
                                    >
                                        {[2, 3, 4, 6, 8, 12, 16, 24, 32].map((count) => (
                                            <option key={count}>{count}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <MeasureEditor
                                measure={0}
                                signature={manualSignature}
                                steps={draftManualSteps}
                                strokes={draftManualStrokes}
                                isPreviewing={isManualPreviewing}
                                onChange={changeManualStep}
                                onStrokeChange={changeManualStroke}
                                onPreview={() =>
                                    onManualPreview(draftManualSteps, draftManualStrokes)
                                }
                                onSave={() =>
                                    onManualSave(
                                        manualMeasures,
                                        manualSignature,
                                        draftManualSteps,
                                        draftManualStrokes,
                                    )
                                }
                                onClose={onClose}
                                embedded
                            />
                        </div>
                    ) : null}
                    {tab === 'presets' ? (
                        <div className="preset-grid">
                            {stickControlPresets.map((preset) => (
                                <button
                                    type="button"
                                    key={preset.number}
                                    ref={(element) => {
                                        if (element)
                                            presetElements.current.set(preset.number, element)
                                        else presetElements.current.delete(preset.number)
                                    }}
                                    onClick={() => onPreset(preset)}
                                    aria-label={'Choose preset ' + preset.number}
                                    aria-pressed={selectedPresetNumber === preset.number}
                                    className={
                                        selectedPresetNumber === preset.number ? 'selected' : ''
                                    }
                                >
                                    <strong>{preset.number}</strong>
                                    <PresetNotation preset={preset} />
                                </button>
                            ))}
                        </div>
                    ) : null}
                    {tab === 'generator' ? (
                        <div className="generator-tab">
                            <div className="settings-fields">
                                <label>
                                    Time signature
                                    <select
                                        value={generatorSignature}
                                        onChange={(event) =>
                                            setGeneratorSignature(
                                                event.target.value as TimeSignature,
                                            )
                                        }
                                    >
                                        <option>4/4</option>
                                        <option>3/4</option>
                                        <option>6/8</option>
                                    </select>
                                </label>
                                <label>
                                    Measures
                                    <select
                                        value={generatorMeasures}
                                        onChange={(event) =>
                                            setGeneratorMeasures(Number(event.target.value))
                                        }
                                    >
                                        {[2, 3, 4, 6, 8, 12, 16, 24, 32].map((count) => (
                                            <option key={count}>{count}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <fieldset className="generation-options">
                                <legend>Allowed elements</legend>
                                {(
                                    [
                                        ['rests', 'Rests'],
                                        ['eighths', 'Eighth notes'],
                                        ['sixteenths', 'Sixteenth notes'],
                                        ['palmMutes', 'Palm mute'],
                                        ['triplets', 'Triplets'],
                                    ] as [keyof GenerationOptions, string][]
                                ).map(([option, label]) => (
                                    <label className="generation-option" key={option}>
                                        <input
                                            type="checkbox"
                                            checked={generatorOptions[option]}
                                            onChange={(event) =>
                                                setGeneratorOptions((previous) => ({
                                                    ...previous,
                                                    [option]: event.target.checked,
                                                }))
                                            }
                                        />
                                        <span>{label}</span>
                                    </label>
                                ))}
                            </fieldset>
                        </div>
                    ) : null}
                    {tab === 'favorites' ? (
                        <div className="favorites-list">
                            {favorites.length ? (
                                favorites.map((favorite) => (
                                    <div className="favorite-exercise" key={favorite.id}>
                                        <button
                                            className="favorite-exercise-open"
                                            type="button"
                                            onClick={() => onFavorite(favorite)}
                                        >
                                            <strong>
                                                {favorite.comment || 'Untitled exercise'}
                                            </strong>
                                            <span>
                                                {favorite.signature} · {favorite.measures} measures
                                                · {favorite.source}
                                            </span>
                                            <small>
                                                Added{' '}
                                                {new Date(favorite.addedAt).toLocaleDateString()} ·
                                                Last used{' '}
                                                {new Date(favorite.lastUsedAt).toLocaleDateString()}
                                            </small>
                                            <FavoriteNotationPreview favorite={favorite} />
                                        </button>
                                        <button
                                            className="favorite-remove"
                                            type="button"
                                            onClick={() => onRemoveFavorite(favorite.id)}
                                            aria-label="Remove favorite exercise"
                                            title="Remove from favorites"
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="favorites-empty">No favorite exercises yet.</p>
                            )}
                        </div>
                    ) : null}
                </div>
                {tab === 'manual' ? (
                    <footer className="measure-editor-actions manual-editor-actions">
                        <button
                            className="editor-preview"
                            type="button"
                            onClick={() => onManualPreview(draftManualSteps, draftManualStrokes)}
                        >
                            <FontAwesomeIcon icon={isManualPreviewing ? faStop : faPlay} />
                            {isManualPreviewing ? 'Stop' : 'Listen'}
                        </button>
                        <button
                            className="editor-save"
                            type="button"
                            onClick={() =>
                                onManualSave(
                                    manualMeasures,
                                    manualSignature,
                                    draftManualSteps,
                                    draftManualStrokes,
                                )
                            }
                        >
                            Apply
                        </button>
                    </footer>
                ) : null}
                {tab === 'generator' ? (
                    <footer className="measure-editor-actions generator-actions">
                        <button
                            className="editor-save"
                            type="button"
                            onClick={() =>
                                onGenerate(generatorMeasures, generatorOptions, generatorSignature)
                            }
                        >
                            Generate
                        </button>
                    </footer>
                ) : null}
            </section>
        </div>
    )
}
