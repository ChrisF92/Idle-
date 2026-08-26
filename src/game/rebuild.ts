/** Canonical Rebuild cycle, Matter formula, gross Scrap accounting, and reset policy. */

import type { GameState, RebuildCycleState } from './types'
import { ACT1_CADENCE } from './cadence'
import { isChallengeSortie } from './frontier'
import { reconstitutionStartingScrap } from './matter'
import { careerBestWave } from './waves'
import { createEmptyWorkshop, emptyGenericUpgradeUnlocks } from './workshop'

export const REBUILD_MIN_WAVE = ACT1_CADENCE.rebuild
export const REBUILD_FIRST_MIN_SORTIES = 3
export const REBUILD_MIN_SORTIES = REBUILD_FIRST_MIN_SORTIES
export const REBUILD_LATER_MIN_SORTIES = 1

export const MATTER_WAVE_DIVISOR = 25
export const MATTER_WAVE_EXPONENT = 1.25
export const MATTER_SCRAP_DIVISOR = 250
export const MATTER_SCRAP_CAP_FRACTION = 0.3

export type ScrapGenerationSource =
  | 'combat-kill'
  | 'combat-wave'
  | 'extraction'
  | 'industry'
  | 'other'

const CYCLE_EXCLUDED: ScrapGenerationSource[] = []

export function emptyRebuildCycle(): RebuildCycleState {
  return { bestWave: 0, normalSortiesCompleted: 0, scrapGenerated: 0 }
}

export function rebuildCycle(state: GameState): RebuildCycleState {
  const raw = state.prestige?.cycle
  return {
    bestWave: Math.max(0, Math.floor(Number(raw?.bestWave ?? 0) || 0)),
    normalSortiesCompleted: Math.max(
      0,
      Math.floor(Number(raw?.normalSortiesCompleted ?? 0) || 0),
    ),
    scrapGenerated: Math.max(0, Number(raw?.scrapGenerated ?? 0) || 0),
  }
}

export function ensureRebuildCycle(state: GameState): RebuildCycleState {
  if (!state.prestige.cycle) state.prestige.cycle = emptyRebuildCycle()
  const cycle = state.prestige.cycle
  if (cycle.normalSortiesCompleted == null) cycle.normalSortiesCompleted = 0
  if (cycle.scrapGenerated == null) cycle.scrapGenerated = 0
  return cycle
}

/** Highest Wave this Rebuild cycle. Before the first Rebuild, unsynced career Best counts as the current cycle. */
export function cycleBestWave(state: GameState): number {
  const cycle = rebuildCycle(state).bestWave
  if (cycle > 0) return cycle
  if ((state.prestige.prestigeCount ?? 0) > 0) return 0
  return careerBestWave(state)
}

export function cycleScrapGenerated(state: GameState): number {
  return rebuildCycle(state).scrapGenerated
}

export function cycleNormalSorties(state: GameState): number {
  return rebuildCycle(state).normalSortiesCompleted
}

export function noteRebuildCycleWave(state: GameState, wave: number): void {
  if (isChallengeSortie(state)) return
  const cycle = ensureRebuildCycle(state)
  cycle.bestWave = Math.max(cycle.bestWave, Math.max(0, Math.floor(wave)))
}

export function noteRebuildCycleSortie(state: GameState): void {
  if (isChallengeSortie(state)) return
  const cycle = ensureRebuildCycle(state)
  cycle.normalSortiesCompleted += 1
}

export function noteScrapGenerated(state: GameState, amount: number, source: ScrapGenerationSource): void {
  const n = Number(amount)
  if (!(n > 0)) return
  if (isChallengeSortie(state)) return
  if (CYCLE_EXCLUDED.includes(source)) return
  const cycle = ensureRebuildCycle(state)
  cycle.scrapGenerated += n
  if ((source === 'combat-kill' || source === 'combat-wave') && state.combat.sortieMark) {
    state.combat.sortieMark.grossScrapGenerated =
      (state.combat.sortieMark.grossScrapGenerated ?? 0) + n
  }
}

export function grantGeneratedScrap(state: GameState, amount: number, source: ScrapGenerationSource): number {
  const n = Math.max(0, amount)
  if (!(n > 0)) return 0
  state.resources.scrap = (state.resources.scrap ?? 0) + n
  noteScrapGenerated(state, n, source)
  return n
}

export function clearRebuildCycle(state: GameState): void {
  state.prestige.cycle = emptyRebuildCycle()
}

export function rebuildWaveNeed(_state?: GameState): number {
  return REBUILD_MIN_WAVE
}

export interface MatterGainBreakdown {
  cycleBestWave: number
  cycleScrapGenerated: number
  waveScore: number
  scrapScore: number
  total: number
}

export function matterScoresFrom(cycleBest: number, cycleScrap: number): MatterGainBreakdown {
  const best = Math.max(0, cycleBest)
  const scrap = Math.max(0, cycleScrap)
  const waveScore = Math.floor(Math.pow(best / MATTER_WAVE_DIVISOR, MATTER_WAVE_EXPONENT))
  const scrapRaw = Math.floor(Math.sqrt(scrap / MATTER_SCRAP_DIVISOR))
  const scrapCap = Math.floor(waveScore * MATTER_SCRAP_CAP_FRACTION)
  const scrapScore = Math.min(scrapRaw, scrapCap)
  const total = Math.max(1, waveScore + scrapScore)
  return {
    cycleBestWave: best,
    cycleScrapGenerated: scrap,
    waveScore,
    scrapScore,
    total,
  }
}

export function matterGainBreakdown(state: GameState): MatterGainBreakdown {
  return matterScoresFrom(cycleBestWave(state), cycleScrapGenerated(state))
}

/** Canonical Matter payout. No protocol, workshop, rebuild-count, or Ascension multipliers. */
export function matterGainFor(state: GameState): number {
  return matterGainBreakdown(state).total
}

/** @deprecated Use matterGainFor. Same canonical formula; name retained for existing UI imports. */
export function prestigeGainFor(state: GameState): number {
  return matterGainFor(state)
}

export function rebuildIneligibleReason(state: GameState): string | null {
  if (state.prestige.activeChallengeId) return 'Finish or abandon the active Challenge first'
  if (!state.combat.docked) return 'Dock to Rebuild'
  const sorties = cycleNormalSorties(state)
  const first = (state.prestige.prestigeCount ?? 0) === 0
  if (first) {
    if (careerBestWave(state) < REBUILD_MIN_WAVE) {
      return `Reach Best Wave ${REBUILD_MIN_WAVE}`
    }
    if (sorties < REBUILD_FIRST_MIN_SORTIES) {
      return `Complete ${REBUILD_FIRST_MIN_SORTIES} normal Sorties this cycle (${sorties}/${REBUILD_FIRST_MIN_SORTIES})`
    }
  } else if (sorties < REBUILD_LATER_MIN_SORTIES) {
    return 'Complete 1 normal Sortie this cycle'
  }
  if (matterGainFor(state) <= 0) return 'Projected Matter must be positive'
  return null
}

/**
 * Cycle is worth resetting. Ignores Dock so toasts can fire before hangar.
 * W210 is a first-Rebuild discovery door, not a per-cycle frontier requirement.
 */
export function rebuildDoorMet(state: GameState): boolean {
  if (state.prestige.activeChallengeId) return false
  const sorties = cycleNormalSorties(state)
  const first = (state.prestige.prestigeCount ?? 0) === 0
  if (first) {
    if (careerBestWave(state) < REBUILD_MIN_WAVE) return false
    if (sorties < REBUILD_FIRST_MIN_SORTIES) return false
  } else if (sorties < REBUILD_LATER_MIN_SORTIES) {
    return false
  }
  return matterGainFor(state) > 0
}

export function canOpenRebuildHangar(state: GameState): boolean {
  if ((state.prestige.prestigeCount ?? 0) > 0) return true
  if (Object.keys(state.prestige.matterShop ?? {}).length > 0) return true
  return careerBestWave(state) >= REBUILD_MIN_WAVE
}

export function canRebuild(state: GameState): boolean {
  return Boolean(state.combat.docked) && rebuildDoorMet(state)
}

export const REBUILD_RESETS = [
  'Scrap',
  'Salvage',
  'Workshop levels',
  'Core Levels',
  'Ash',
  'active Sortie resources/state',
] as const

export const REBUILD_KEEPS = [
  'Matter',
  'Cores + Mastery',
  'Frames / Relics',
  'Foundry / Research',
  'Workers',
  'permanent unlocks',
] as const

export function applyReconstitutionCache(state: GameState): void {
  const grant = reconstitutionStartingScrap(state)
  if (grant > 0) state.resources.scrap = (state.resources.scrap ?? 0) + grant
}

export function resetPhysicalCoreLevels(state: GameState): void {
  if (!state.workshop) state.workshop = createEmptyWorkshop()
  state.workshop.coreStarts = {}
  state.shipyard.moduleLevels = {}
}

export function resetWorkshopCycleLevels(state: GameState): void {
  const cores = { ...(state.workshop?.coreStarts ?? {}) }
  state.workshop = createEmptyWorkshop()
  state.workshop.coreStarts = cores
}

/** Ensure permanent unlocks exist on meta and are not stored in Workshop. */
export function preserveGenericUnlocks(state: GameState): void {
  state.meta.genericUpgradeUnlocks = {
    ...(state.meta.genericUpgradeUnlocks ?? emptyGenericUpgradeUnlocks()),
  }
}
