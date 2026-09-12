import { useEffect, useRef } from 'react'
import {
    Barline,
    Beam,
    Dot,
    Formatter,
    Renderer,
    Stave,
    StaveNote,
    Stem,
    TextBracket,
    Voice,
} from 'vexflow'
import type { ExerciseNote, TimeSignature } from '../types'

type Props = {
    measureNumber: number
    notes: ExerciseNote[]
    signature: TimeSignature
    width: number
    scale: number
    activeSlot: number
}

export function EngravedMeasure({
    measureNumber,
    notes,
    signature,
    width,
    scale,
    activeSlot,
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
            .setMeasure(measureNumber)
            .setBegBarType(Barline.type.SINGLE)
            .setEndBarType(Barline.type.SINGLE)
        stave.setStyle({ fillStyle: '#94a3b8', strokeStyle: '#cbd5e1' })
        stave.setContext(context).drawWithStyle()

        const tickables = notes.map((note) => {
            const notation = notationDuration(note.duration, note.isRest)
            const staveNote = new StaveNote({ keys: ['b/4'], duration: notation.duration })
            staveNote.setStemDirection(Stem.DOWN)
            const isActive =
                !note.isRest &&
                activeSlot >= note.position &&
                activeSlot < note.position + note.duration
            staveNote.setStyle({
                fillStyle: isActive ? '#22d3ee' : '#818cf8',
                strokeStyle: isActive ? '#22d3ee' : '#818cf8',
            })
            if (notation.dotted) Dot.buildAndAttach([staveNote], { all: true })
            return staveNote
        })
        if (!tickables.length) return

        const [beats, beatValue] = signature.split('/').map(Number)
        const voice = new Voice({ numBeats: beats, beatValue }).setStrict(false)
        voice.addTickables(tickables)
        const beams = Beam.generateBeams(tickables, { stemDirection: Stem.DOWN })
        beams.forEach((beam) => beam.setStyle({ fillStyle: '#818cf8', strokeStyle: '#818cf8' }))
        new Formatter().joinVoices([voice]).format([voice], width - 18)
        voice.draw(context, stave)
        beams.forEach((beam) => beam.setContext(context).drawWithStyle())
        palmMuteGroups(notes).forEach(({ startIndex, endIndex }) => {
            const bracket = new TextBracket({
                start: tickables[startIndex],
                stop: tickables[endIndex],
                text: 'P.M.',
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
    }, [activeSlot, measureNumber, notes, scale, signature, width])

    return <div className="vexflow-measure" ref={element} aria-hidden="true" />
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

function notationDuration(duration: number, isRest = false) {
    const durations: Record<number, { duration: string; dotted?: boolean }> = {
        1: { duration: '16' },
        2: { duration: '8' },
        3: { duration: '8d', dotted: true },
        4: { duration: 'q' },
        6: { duration: 'qd', dotted: true },
        8: { duration: 'h' },
        12: { duration: 'hd', dotted: true },
        16: { duration: 'w' },
    }
    const notation = durations[duration] ?? { duration: '8' }
    return { ...notation, duration: `${notation.duration}${isRest ? 'r' : ''}` }
}
