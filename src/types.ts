export type TimeSignature = '4/4' | '3/4' | '6/8'
export type NoteResult = 'hit' | 'miss' | 'pending'
export type ExerciseNote = {
    id: string
    measure: number
    position: number
    duration: number
    isRest?: boolean
    palmMuted?: boolean
    isTriplet?: boolean
}
export type PlayerHit = { time: number; strength: number; result?: 'hit' | 'extra' }
