import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useRef, useState } from 'react'
import type { GenerationOptions } from '../domain/exercise'
import type { ExerciseSource, FavoriteExercise } from '../store/exerciseStore'
import {
    presetToExercise,
    stickControlPresets,
    type StickControlPreset,
} from '../domain/stickControlPresets'
import type { TimeSignature } from '../types'
import { EngravedMeasure } from './EngravedMeasure'
import { useTranslation } from 'react-i18next'

type Tab = 'presets' | 'generator' | 'favorites'

type Props = {
    measures: number
    signature: TimeSignature
    options: GenerationOptions
    source: ExerciseSource
    selectedPresetNumber?: number
    favorites: FavoriteExercise[]
    onClose: () => void
    onPreset: (preset: StickControlPreset) => void
    onGenerate: (measures: number, options: GenerationOptions, signature: TimeSignature) => void
    onFavorite: (favorite: FavoriteExercise) => void
    onRemoveFavorite: (id: string) => void
}

const tabs: Tab[] = ['presets', 'generator', 'favorites']

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

function FavoriteNotationPreview({
    favorite,
    label,
}: {
    favorite: FavoriteExercise
    label: string
}) {
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
        <div className="exercise-notation-preview" ref={element} aria-label={label}>
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
    onPreset,
    onGenerate,
    onFavorite,
    onRemoveFavorite,
}: Props) {
    const { t, i18n } = useTranslation()
    const [tab, setTab] = useState<Tab>(() =>
        source === 'preset'
            ? 'presets'
            : source === 'generator'
              ? 'generator'
              : source === 'favorite'
                ? 'favorites'
                : 'presets',
    )
    const [generatorMeasures, setGeneratorMeasures] = useState(measures)
    const [generatorSignature, setGeneratorSignature] = useState(signature)
    const [generatorOptions, setGeneratorOptions] = useState(options)
    const presetElements = useRef(new Map<number, HTMLButtonElement>())

    useEffect(() => {
        if (tab !== 'presets' || selectedPresetNumber === undefined) return

        presetElements.current
            .get(selectedPresetNumber)
            ?.scrollIntoView({ block: 'center', behavior: 'auto' })
    }, [selectedPresetNumber, tab])

    function selectTab(nextTab: Tab) {
        if (nextTab === 'generator' && tab !== 'generator') {
            setGeneratorMeasures(measures)
            setGeneratorSignature(signature)
            setGeneratorOptions(options)
        }
        setTab(nextTab)
    }
    return (
        <div
            className="fixed inset-0 z-40 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
            role="presentation"
            onMouseDown={onClose}
        >
            <section
                className="flex h-5/6 max-h-screen w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-label={t('settings')}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="relative flex h-16 shrink-0 items-center justify-between border-b border-slate-800 px-5 pt-4">
                    <div className="flex gap-1 self-end" role="tablist">
                        {tabs.map((id) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={tab === id}
                                className={`border-0 border-b-2 px-3 py-2 text-sm font-semibold ${tab === id ? 'border-indigo-300 text-indigo-100' : 'border-transparent text-slate-400'}`}
                                onClick={() => selectTab(id)}
                            >
                                {t(id)}
                            </button>
                        ))}
                    </div>
                    <button
                        className="absolute right-5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-400"
                        type="button"
                        onClick={onClose}
                        aria-label={t('closeSettings')}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    {tab === 'presets' ? (
                        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
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
                                    aria-label={t('choosePreset', { number: preset.number })}
                                    aria-pressed={selectedPresetNumber === preset.number}
                                    className={`flex min-h-32 items-center gap-3 rounded-lg border px-3 py-2 text-left text-slate-300 transition hover:border-indigo-400 hover:bg-slate-700 ${selectedPresetNumber === preset.number ? 'border-indigo-300 bg-indigo-950 ring-1 ring-indigo-400' : 'border-slate-700 bg-slate-800'}`}
                                >
                                    <strong className="w-8 shrink-0 font-mono text-sm font-medium text-indigo-300">
                                        {preset.number}
                                    </strong>
                                    <span className="min-w-0 flex-1">
                                        <PresetNotation preset={preset} />
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : null}
                    {tab === 'generator' ? (
                        <div className="grid gap-5">
                            <div className="grid grid-cols-2 gap-4">
                                <label className="grid gap-2 font-mono text-xs font-medium uppercase tracking-wider text-slate-400">
                                    {t('timeSignature')}
                                    <select
                                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-sans text-sm normal-case tracking-normal text-slate-200"
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
                                <label className="grid gap-2 font-mono text-xs font-medium uppercase tracking-wider text-slate-400">
                                    {t('measuresLabel')}
                                    <select
                                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-sans text-sm normal-case tracking-normal text-slate-200"
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
                            <fieldset className="grid gap-2 border-0 p-0">
                                <legend className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-slate-400">
                                    {t('allowedElements')}
                                </legend>
                                {(
                                    [
                                        ['rests', t('rests')],
                                        ['eighths', t('eighthNotes')],
                                        ['sixteenths', t('sixteenthNotes')],
                                        ['palmMutes', t('palmMute')],
                                        ['triplets', t('triplets')],
                                    ] as [keyof GenerationOptions, string][]
                                ).map(([option, label]) => (
                                    <label
                                        className="flex items-center gap-2 text-sm font-medium text-slate-300"
                                        key={option}
                                    >
                                        <input
                                            className="size-4 accent-indigo-400"
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
                        <div className="grid gap-2 p-5">
                            {favorites.length ? (
                                favorites.map((favorite) => (
                                    <div
                                        className="relative flex w-full items-stretch gap-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 hover:border-indigo-400"
                                        key={favorite.id}
                                    >
                                        <button
                                            className="grid flex-1 gap-1 p-4 pr-14 text-left text-slate-200 hover:bg-slate-700"
                                            type="button"
                                            onClick={() => onFavorite(favorite)}
                                        >
                                            <strong>
                                                {favorite.comment || t('untitledExercise')}
                                            </strong>
                                            <span className="text-xs text-slate-400">
                                                {favorite.signature} ·{' '}
                                                {t('measureCount', { count: favorite.measures })}·{' '}
                                                {t(`source.${favorite.source}`)}
                                            </span>
                                            <small className="text-xs text-slate-500">
                                                {t('addedDate', {
                                                    date: new Date(
                                                        favorite.addedAt,
                                                    ).toLocaleDateString(i18n.language),
                                                })}{' '}
                                                ·{' '}
                                                {t('lastUsedDate', {
                                                    date: new Date(
                                                        favorite.lastUsedAt,
                                                    ).toLocaleDateString(i18n.language),
                                                })}
                                            </small>
                                            <FavoriteNotationPreview
                                                favorite={favorite}
                                                label={t('notationPreview')}
                                            />
                                        </button>
                                        <button
                                            className="absolute right-3 top-3 rounded-md border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-rose-300 hover:border-indigo-400 hover:bg-slate-700"
                                            type="button"
                                            onClick={() => onRemoveFavorite(favorite.id)}
                                            aria-label={t('removeFavoriteExercise')}
                                            title={t('removeFavorite')}
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="m-0 text-center text-sm text-slate-400">
                                    {t('noFavorites')}
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>
                {tab === 'generator' ? (
                    <footer className="mt-0 flex justify-end gap-3 border-t border-slate-800 p-4">
                        <button
                            className="rounded-lg border border-indigo-400 bg-indigo-300 px-4 py-3 text-sm font-semibold text-indigo-950"
                            type="button"
                            onClick={() =>
                                onGenerate(generatorMeasures, generatorOptions, generatorSignature)
                            }
                        >
                            {t('generate')}
                        </button>
                    </footer>
                ) : null}
            </section>
        </div>
    )
}
