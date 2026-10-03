import type { RefObject } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faStar, faTrash } from '@fortawesome/free-solid-svg-icons'
import { Measure } from './Measure'
import { ExerciseComment } from './ExerciseComment'
import type { SessionPhase } from '../store/sessionStore'
import type { ExerciseNote, TimeSignature } from '../types'

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

export function ExerciseWorkspace(props: Props) {
    const running = props.phase === 'playing' || props.previewing !== null
    return <div className="app-body grid min-h-0 overflow-hidden">
        <section className="relative grid min-h-0 min-w-0 overflow-hidden bg-slate-950" onClick={props.onTempoClose}>
            <div className="workspace-top-actions">
                <select className="signature-control" value={props.signature} onChange={(event) => props.onSignature(event.target.value as TimeSignature)} aria-label="Change time signature" title="Change time signature">
                    <option>4/4</option><option>3/4</option><option>6/8</option>
                </select>
                <button className="workspace-action" type="button" onClick={props.onAddMeasure} aria-label="Add empty measure" title="Add empty measure"><FontAwesomeIcon icon={faPlus} /></button>
                <button className="workspace-action danger" type="button" onClick={props.onClear} aria-label="Clear exercise" title="Clear exercise"><FontAwesomeIcon icon={faTrash} /></button>
            </div>
            <div className="notation-scroll p-5 md:p-7" ref={props.notationScroll}>
                <div className="notation-source" aria-label={`Exercise source: ${props.sourceLabel}`}><span>{props.sourceLabel}</span></div>
                <div className="exercise-comment">
                    <ExerciseComment value={props.comment} onInteraction={props.onCommentInteraction} onSave={props.onCommentSave} />
                    <button type="button" className={`favorite-button ${props.isFavorite ? 'is-favorite' : ''}`} onClick={props.onFavorite} aria-label={props.favoriteId ? 'Remove from favorites' : 'Add to favorites'} title={props.favoriteId ? 'Remove from favorites' : 'Add to favorites'}><FontAwesomeIcon icon={faStar} /></button>
                </div>
                <div className="flex min-w-0 flex-wrap content-start pb-36">
                    {Array.from({ length: props.measures }, (_, index) => <Measure
                        key={index}
                        index={index}
                        signature={props.signature}
                        notes={props.notes.filter((note) => note.measure === index)}
                        selected={props.selectedMeasure === index}
                        isActive={running && props.activeMeasure === index}
                        activeSlot={running && props.activeMeasure === index ? props.activeSlot : -1}
                        onClick={() => props.onSelectMeasure(index)}
                        onEdit={props.onEdit}
                        onDuplicate={() => props.onDuplicate(index)}
                        onMove={(direction) => props.onMove(index, direction)}
                        onDelete={() => props.onDelete(index)}
                        isEditingDisabled={false}
                        canDelete={props.measures > 1}
                        canMoveRight={index < props.measures - 1}
                    />)}
                </div>
            </div>
            {props.phase === 'count-in' ? <div className="count-in-overlay" aria-live="assertive" aria-atomic="true" role="status">
                <span className="count-in-label">Get ready</span><strong className="count-in-beat" key={props.countInBeat}>{props.countInBeat || 1}</strong>
                <span className="count-in-dots" aria-hidden="true">{Array.from({ length: props.countInBeats }, (_, index) => <i className={index < props.countInBeat ? 'is-complete' : ''} key={index} />)}</span>
            </div> : null}
        </section>
    </div>
}
