import { useState } from 'react'
import { MeasureEditor } from './MeasureEditor'
import { notesToSteps, notesToStrokes, stepsToNotes } from '../domain/measureSteps'
import type { StepKind } from '../domain/measureSteps'
import type { ExerciseNote, PickStroke, TimeSignature } from '../types'
import { signatures } from '../domain/exercise'

type Props = {
    measure: number
    signature: TimeSignature
    notes: ExerciseNote[]
    isPreviewing: boolean
    onPreview: (notes: ExerciseNote[]) => void
    onSave: (measure: number, notes: ExerciseNote[]) => void
    onClose: () => void
}

export function MeasureEditorDialog(props: Props) {
    const slots = signatures[props.signature].slots
    const [steps, setSteps] = useState<StepKind[]>(() => notesToSteps(props.notes, slots))
    const [strokes, setStrokes] = useState<(PickStroke | undefined)[]>(() => notesToStrokes(props.notes, slots))
    const setStep = (index: number, kind: StepKind) => setSteps((current) => current.map((value, i) => i === index ? kind : value))
    const setStroke = (index: number, stroke: PickStroke | undefined) => setStrokes((current) => current.map((value, i) => i === index ? stroke : value))
    const notes = () => stepsToNotes(steps, props.measure, strokes)
    return <MeasureEditor
        measure={props.measure}
        signature={props.signature}
        steps={steps}
        strokes={strokes}
        isPreviewing={props.isPreviewing}
        onChange={setStep}
        onStrokeChange={setStroke}
        onPreview={() => props.onPreview(notes())}
        onSave={() => props.onSave(props.measure, notes())}
        onClose={props.onClose}
    />
}
