/** Voluntary Extraction eligibility and qualifying-Scrap bonus. */

import type { GameState } from './types'
import { ACT1_CADENCE } from './cadence'
import { isChallengeSortie } from './frontier'
import { careerBestWave } from './waves'

export const EXTRACTION_UNLOCK_WAVE = ACT1_CADENCE.rebuild
export const EXTRACTION_SCRAP_BONUS = 0.125

export function sortieGrossScrapGenerated(state: GameState): number {
  return Math.max(0, state.combat.sortieMark?.grossScrapGenerated ?? 0)
}

export function projectedExtractionBonus(grossScrap: number): number {
  const n = Math.max(0, grossScrap)
  if (n <= 0) return 0
  return Math.floor(n * EXTRACTION_SCRAP_BONUS)
}

export function extractionBonusFor(state: GameState): number {
  return projectedExtractionBonus(sortieGrossScrapGenerated(state))
}

function liveHiveHull(state: GameState): number {
  const flag = state.combat.playerUnits.find((unit) => unit.isFlagship)
  const flagshipHull = flag != null ? flag.hull : 0
  const aggregateHull = state.combat.playerHull
  return Math.min(flagshipHull, aggregateHull)
}

export function extractionLockedReason(state: GameState): string | null {
  if (state.combat.docked || !state.combat.inFight) return 'No active Sortie'
  if (liveHiveHull(state) <= 0) return 'Hive destroyed'
  if ((state.combat.defeatLeft ?? 0) > 0) return 'Defeat sequence'
  if (isChallengeSortie(state)) return 'Challenges cannot Extract'
  if (careerBestWave(state) < EXTRACTION_UNLOCK_WAVE) {
    return `Unlocks at Best Wave ${EXTRACTION_UNLOCK_WAVE}`
  }
  return null
}

export function canExtract(state: GameState): boolean {
  return extractionLockedReason(state) == null
}
