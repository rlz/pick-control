import { proxy } from 'valtio'
import type { PlayerHit } from '../types'

export type SessionPhase = 'ready' | 'count-in' | 'playing' | 'finished'
export type CompletedLoopRun = {
    startedAt: number
    duration: number
    measureMs: number
    bpm: number
    hits: PlayerHit[]
}

export const sessionStore = proxy({
    hits: [] as PlayerHit[],
    loopRuns: [] as CompletedLoopRun[],
    phase: 'ready' as SessionPhase,
    countInBeat: 0,
    activeSlot: -1,
    activeMeasure: -1,
    previewing: null as 'all' | number | null,
    activeBpm: null as number | null,
})

export const uiStore = proxy({
    selectedMeasure: null as number | null,
    settingsOpen: false,
    tempoOpen: false,
    calibrationOpen: false,
})

export function setSessionPhase(phase: SessionPhase) { sessionStore.phase = phase }
export function setCountInBeat(beat: number) { sessionStore.countInBeat = beat }
export function setActivePosition(measure: number, slot: number) {
    sessionStore.activeMeasure = measure
    sessionStore.activeSlot = slot
}
export function setActiveBpm(bpm: number | null) { sessionStore.activeBpm = bpm }
export function setPreviewing(value: 'all' | number | null) { sessionStore.previewing = value }
export function replaceHits(hits: PlayerHit[]) { sessionStore.hits = hits }
export function appendHit(hit: PlayerHit) { sessionStore.hits.push(hit) }
export function replaceLoopRuns(runs: CompletedLoopRun[]) { sessionStore.loopRuns = runs }
export function appendLoopRun(run: CompletedLoopRun) { sessionStore.loopRuns.push(run) }
export function appendHistoricalHit(runIndex: number, hit: PlayerHit) {
    sessionStore.loopRuns[runIndex]?.hits.push(hit)
}
export function resetSession(clearHistory = true) {
    sessionStore.hits = []
    if (clearHistory) sessionStore.loopRuns = []
    sessionStore.phase = 'ready'
    sessionStore.countInBeat = 0
    sessionStore.activeSlot = -1
    sessionStore.activeMeasure = -1
    sessionStore.activeBpm = null
    sessionStore.previewing = null
}
export function selectMeasure(measure: number | null | ((current: number | null) => number | null)) {
    uiStore.selectedMeasure = typeof measure === 'function' ? measure(uiStore.selectedMeasure) : measure
}
export function setSettingsOpen(open: boolean) { uiStore.settingsOpen = open }
export function toggleSettingsOpen() { uiStore.settingsOpen = !uiStore.settingsOpen }
export function setTempoOpen(open: boolean) { uiStore.tempoOpen = open }
export function toggleTempoOpen() { uiStore.tempoOpen = !uiStore.tempoOpen }
export function setCalibrationOpen(open: boolean) { uiStore.calibrationOpen = open }
