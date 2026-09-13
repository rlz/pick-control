import { useEffect, useRef } from 'react'
import {
    Barline,
    Annotation,
    Beam,
    Dot,
    Formatter,
    Renderer,
    Stave,
    StaveNote,
    Stem,
    TextBracket,
    Tuplet,
    Voice,
} from 'vexflow'
import type { ExerciseNote, TimeSignature } from '../types'
import type { NoteFeedback } from '../domain/noteFeedback'

type Props = {
    measureNumber: number
    showMeasureNumber?: boolean
    notes: ExerciseNote[]
    signature: TimeSignature
    width: number
    scale: number
    activeSlot: number
    noteFeedback?: Map<string, NoteFeedback>
}

export function EngravedMeasure({
    measureNumber,
    showMeasureNumber = true,
    notes,
    signature,
    width,
    scale,
    activeSlot,
    noteFeedback,
}: Props) {
    const element = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!element.current) return

        const height = 120
        element.current.replaceChildren()
        const renderer = new Renderer(element.current, Renderer.Backends.SVG)
        renderer.resize(width, height)
        const context = renderer.getContext()
        const stave = new Stave(0, 24, width - 2)
            .setBegBarType(Barline.type.SINGLE)
            .setEndBarType(Barline.type.SINGLE)
        if (showMeasureNumber) stave.setMeasure(measureNumber)
        stave.setStyle({ fillStyle: '#94a3b8', strokeStyle: '#cbd5e1' })
        stave.setContext(context).drawWithStyle()

        const tickables = notes.map((note) => {
            const notation = notationDuration(note.duration, note.isRest, note.isTriplet)
            const staveNote = new StaveNote({ keys: ['b/4'], duration: notation.duration })
            staveNote.setStemDirection(Stem.DOWN)
            const isActive =
                !note.isRest &&
                activeSlot >= note.position &&
                activeSlot < note.position + note.duration
            const feedback = noteFeedback?.get(note.id)
            const noteColor = note.isRest
                ? '#94a3b8'
                : feedback
                  ? {
                        pending: '#94a3b8',
                        accurate: '#4ade80',
                        'slightly-off': '#facc15',
                        off: '#f87171',
                    }[feedback]
                  : isActive
                    ? '#22d3ee'
                    : '#818cf8'
            staveNote.setStyle({
                fillStyle: noteColor,
                strokeStyle: noteColor,
            })
            if (notation.dotted) Dot.buildAndAttach([staveNote], { all: true })
            if (note.stroke) {
                const stroke = new Annotation(note.stroke === 'down' ? '↓' : '↑')
                stroke.setVerticalJustification(Annotation.VerticalJustify.TOP)
                // Keep picking directions instantly distinguishable in compact scores.
                const strokeColor = note.stroke === 'down' ? '#f3bb56' : '#78c7b2'
                stroke.setStyle({ fillStyle: strokeColor, strokeStyle: strokeColor })
                staveNote.addModifier(stroke, 0)
            }
            return staveNote
        })
        if (!tickables.length) return

        const [beats, beatValue] = signature.split('/').map(Number)
        const voice = new Voice({ numBeats: beats, beatValue }).setStrict(false)
        const tripletGroups = groupTriplets(notes, tickables)
        tripletGroups.forEach((group) => {
            new Tuplet(group, { numNotes: 3, notesOccupied: 2, bracketed: true })
        })
        voice.addTickables(tickables)
        const beams = [
            ...beamsWithoutTriplets(notes, tickables),
            ...tripletGroups.map((group) => new Beam(group, false)),
        ]
        const beamColor = noteFeedback ? '#94a3b8' : '#818cf8'
        beams.forEach((beam) => beam.setStyle({ fillStyle: beamColor, strokeStyle: beamColor }))
        new Formatter().joinVoices([voice]).format([voice], width - 18)
        voice.draw(context, stave)
        beams.forEach((beam) => beam.setContext(context).drawWithStyle())
        // Creating Tuplet attaches VexFlow's 3:2 tick multiplier, which keeps the
        // group inside one beat. Draw the visible mark ourselves: VexFlow's tuplet
        // glyph has disappeared in this compact, manually-beamed score before.
        // The text bracket is intentionally drawn after beams, so the 3 is never
        // obscured by their SVG paths.
        tripletGroups.forEach((group) => {
            const bracket = new TextBracket({
                start: group[0],
                stop: group[2],
                text: '3',
                position: TextBracket.Position.TOP,
            })
            bracket.setContext(context)
            bracket.setFont({ family: 'DM Mono', size: '8px', weight: 500, style: 'normal' })
            bracket.setDashed(false)
            bracket.renderOptions.color = '#94a3b8'
            bracket.renderOptions.showBracket = true
            bracket.applyStyle(context)
            bracket.draw()
        })
        palmMuteGroups(notes).forEach(({ startIndex, endIndex }) => {
            const bracket = new TextBracket({
                start: tickables[startIndex],
                stop: tickables[endIndex],
                text: 'pm',
                position: TextBracket.Position.TOP,
            })
            bracket.setContext(context)
            bracket.setFont({ family: 'DM Mono', size: '8px', weight: 500, style: 'normal' })
            bracket.setDashed(false)
            bracket.renderOptions.color = '#94a3b8'
            bracket.renderOptions.showBracket = false
            bracket.applyStyle(context)
            bracket.draw()
        })
        const svg = element.current.querySelector('svg')
        if (svg) {
            const scaledWidth = width * scale
            const scaledHeight = height * scale
            element.current.style.position = 'relative'
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
            svg.setAttribute('preserveAspectRatio', 'xMinYMid meet')
            svg.style.position = 'absolute'
            svg.style.width = `${scaledWidth}px`
            svg.style.height = `${scaledHeight}px`
            svg.style.left = '0'
            svg.style.top = `${(height - scaledHeight) / 2}px`
        }
    }, [activeSlot, measureNumber, noteFeedback, notes, scale, showMeasureNumber, signature, width])

    return <div className="vexflow-measure" ref={element} aria-hidden="true" />
}

function groupTriplets(notes: ExerciseNote[], tickables: StaveNote[]) {
    const groups: StaveNote[][] = []
    for (let index = 0; index < notes.length;) {
        const noteGroup = notes.slice(index, index + 3)
        if (noteGroup.length === 3 && noteGroup.every((note) => note.isTriplet)) {
            groups.push(tickables.slice(index, index + 3))
            index += 3
        } else {
            index++
        }
    }
    return groups
}

/**
 * VexFlow's automatic beaming groups eighth notes in pairs. Keep triplet notes
 * out of that pass, because each complete triplet gets its own three-note beam.
 */
function beamsWithoutTriplets(notes: ExerciseNote[], tickables: StaveNote[]) {
    const beams: Beam[] = []
    let run: StaveNote[] = []

    const addRun = () => {
        if (run.length) beams.push(...Beam.generateBeams(run, { stemDirection: Stem.DOWN }))
        run = []
    }

    notes.forEach((note, index) => {
        if (note.isTriplet) {
            addRun()
        } else {
            run.push(tickables[index])
        }
    })
    addRun()

    return beams
}

function palmMuteGroups(notes: ExerciseNote[]) {
    return notes.reduce<{ startIndex: number; endIndex: number; endPosition: number }[]>(
        (groups, note, index) => {
            if (!note.palmMuted) return groups
            const previous = groups.at(-1)
            if (previous && previous.endPosition === note.position) {
                previous.endIndex = index
                previous.endPosition += note.duration
            } else {
                groups.push({
                    startIndex: index,
                    endIndex: index,
                    endPosition: note.position + note.duration,
                })
            }
            return groups
        },
        [],
    )
}

function notationDuration(duration: number, isRest = false, isTriplet = false) {
    const durations: Record<number, { duration: string; dotted?: boolean }> = {
        0.5: { duration: '32' },
        1: { duration: '16' },
        1.5: { duration: '16d', dotted: true },
        2: { duration: '8' },
        3: { duration: '8d', dotted: true },
        4: { duration: 'q' },
        6: { duration: 'qd', dotted: true },
        8: { duration: 'h' },
        12: { duration: 'hd', dotted: true },
        16: { duration: 'w' },
    }
    // A 3:2 tuplet's written note is half of the group's total span.
    // `duration` here is one of the three performed notes, so its written
    // value is 3/2 of that duration: 16th, eighth, quarter, and so on.
    const notation = isTriplet
        ? (durations[duration * 1.5] ?? { duration: '8' })
        : (durations[duration] ?? { duration: '8' })
    return { ...notation, duration: `${notation.duration}${isRest ? 'r' : ''}` }
}
