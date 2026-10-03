import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPen } from '@fortawesome/free-solid-svg-icons'

type Props = { value: string; onSave: (value: string) => void; onInteraction: () => void }

export function ExerciseComment({ value, onSave, onInteraction }: Props) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')
    const startEditing = () => { onInteraction(); setDraft(value); setEditing(true) }
    return <>
        {editing ? <>
            <input type="text" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a note about this exercise" autoFocus />
            <button type="button" className="comment-save" onClick={() => { onInteraction(); onSave(draft); setEditing(false) }}>Save</button>
        </> : value ? <>
            <p>{value}</p>
            <button type="button" className="comment-edit" onClick={startEditing} aria-label="Edit exercise comment" title="Edit comment"><FontAwesomeIcon icon={faPen} /></button>
        </> : <button type="button" className="comment-edit" onClick={startEditing} aria-label="Add exercise comment">Add comment</button>}
    </>
}
