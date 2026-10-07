import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPen } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'

type Props = { value: string; onSave: (value: string) => void; onInteraction: () => void }

export function ExerciseComment({ value, onSave, onInteraction }: Props) {
    const { t } = useTranslation()
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')
    const startEditing = () => {
        onInteraction()
        setDraft(value)
        setEditing(true)
    }
    return (
        <>
            {editing ? (
                <>
                    <input
                        className="w-full min-w-0 max-w-lg rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none"
                        type="text"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={t('commentPlaceholder')}
                        autoFocus
                    />
                    <button
                        type="button"
                        className="whitespace-nowrap rounded-md border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-indigo-200 transition hover:border-indigo-400 hover:bg-slate-700"
                        onClick={() => {
                            onInteraction()
                            onSave(draft)
                            setEditing(false)
                        }}
                    >
                        {t('save')}
                    </button>
                </>
            ) : value ? (
                <>
                    <p className="m-0 min-h-5 max-w-lg text-sm text-slate-300">{value}</p>
                    <button
                        type="button"
                        className="whitespace-nowrap rounded-md border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-indigo-200 transition hover:border-indigo-400 hover:bg-slate-700"
                        onClick={startEditing}
                        aria-label={t('editComment')}
                        title={t('editComment')}
                    >
                        <FontAwesomeIcon icon={faPen} />
                    </button>
                </>
            ) : (
                <button
                    type="button"
                    className="whitespace-nowrap rounded-md border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-indigo-200 transition hover:border-indigo-400 hover:bg-slate-700"
                    onClick={startEditing}
                    aria-label={t('addComment')}
                >
                    {t('addComment')}
                </button>
            )}
        </>
    )
}
