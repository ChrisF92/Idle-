/** Core attributes — worker-trained run bonuses with diminishing returns. */

import {
  getAiNode,
  getMatterShopItem,
  isStationUnlocked,
  matterShopEffectScale,
  RESEARCH,
} from './catalog'
import type { CoreAttrId, CoreState, GameState } from './types'

export const CORE_ATTR_IDS: CoreAttrId[] = [
  'reactors',
  'ballistics',
  'plating',
  'sensors',
  'logistics',
]

export const CORE_ATTR_LABELS: Record<CoreAttrId, string> = {
  reactors: 'Reactors',
  ballistics: 'Ballistics',
  plating: 'Plating',
  sensors: 'Sensors',
  logistics: 'Logistics',
}

/** Station id that trains each attribute. */
export const CORE_TRAIN_STATION: Record<CoreAttrId, string> = {
  reactors: 'train-reactors',
  ballistics: 'train-ballistics',
  plating: 'train-plating',
  sensors: 'train-sensors',
  logistics: 'train-logistics',
}

export const CORE_EFFECT_K = 30
/** Progress units contributed per worker per second at baseline efficiency. */
export const CORE_BASE_PER_WORKER = 1

export function createEmptyCoreState(): CoreState {
  return {
    ranks: {
      reactors: 0,
      ballistics: 0,
      plating: 0,
      sensors: 0,
      logistics: 0,
    },
    progress: {
      reactors: 0,
      ballistics: 0,
      plating: 0,
      sensors: 0,
      logistics: 0,
    },
  }
}

/** Soft-cap curve: early ranks matter, late ranks crawl toward 1. */
export function coreEffectMultiplier(rank: number): number {
  if (rank <= 0) return 0
  return rank / (rank + CORE_EFFECT_K)
}

export function secondsForNextRank(rank: number): number {
  return 45 * Math.pow(1.15, Math.max(0, rank))
}

export function ballisticsDamageMult(rank: number): number {
  return 1 + 0.75 * coreEffectMultiplier(rank)
}

export function platingHullMult(rank: number): number {
  return 1 + 0.55 * coreEffectMultiplier(rank)
}

export function platingArmorBonus(rank: number): number {
  return 12 * coreEffectMultiplier(rank)
}

export function reactorsShieldBonus(rank: number): number {
  return 50 * coreEffectMultiplier(rank)
}

export function reactorsRepairMult(rank: number): number {
  return 1 + 0.45 * coreEffectMultiplier(rank)
}

export function sensorsEvasionBonus(rank: number): number {
  return 0.14 * coreEffectMultiplier(rank)
}

export function sensorsMatchupBonus(rank: number): number {
  return 0.35 * coreEffectMultiplier(rank)
}

export function logisticsProdMult(rank: number): number {
  return 1 + 0.55 * coreEffectMultiplier(rank)
}

export function logisticsFabMult(state: { core: CoreState }): number {
  return 1 + 0.65 * coreEffectMultiplier(state.core.ranks.logistics)
}

/** Part-drop chance multiplier; capped at 1.75×. */
export function logisticsDropMult(state: { core: CoreState }): number {
  return Math.min(1.75, 1 + 0.6 * coreEffectMultiplier(state.core.ranks.logistics))
}

/** Logistics also accelerates all Core training (fewer workers needed at high rank). */
export function logisticsTrainingMult(state: { core: CoreState }): number {
  const r = state.core.ranks.logistics
  return 1 + 0.5 * (r / (r + 20))
}

export function trainingEfficiency(state: {
  research: { unlocked: string[] }
  ai: { purchased: string[] }
  prestige: { matterShop: Record<string, number> }
}): number {
  let eff = 1
  for (const id of state.research.unlocked) {
    eff += RESEARCH.find((r) => r.id === id)?.trainingBonus ?? 0
  }
  for (const id of state.ai.purchased) {
    eff += getAiNode(id)?.trainingBonus ?? 0
  }
  for (const [id, rank] of Object.entries(state.prestige.matterShop)) {
    const bonus = getMatterShopItem(id)?.trainingBonus ?? 0
    if (bonus) eff += bonus * matterShopEffectScale(rank)
  }
  return Math.max(0.05, eff)
}

export function coreTrainingSpeed(state: GameState, attrId: CoreAttrId): number {
  const stationId = CORE_TRAIN_STATION[attrId]
  if (!isStationUnlocked(state, stationId)) return 0
  const workers = state.base.assignments[stationId] ?? 0
  if (workers <= 0) return 0
  return (
    workers *
    CORE_BASE_PER_WORKER *
    trainingEfficiency(state) *
    logisticsTrainingMult(state)
  )
}

/** Advance Core training from assigned workers. Mutates state. */
export function tickCoreTraining(state: GameState, dtSeconds: number): void {
  if (dtSeconds <= 0) return
  if (!state.core) state.core = createEmptyCoreState()

  for (const attr of CORE_ATTR_IDS) {
    const speed = coreTrainingSpeed(state, attr)
    if (speed <= 0) continue
    let rank = state.core.ranks[attr] ?? 0
    let progress = state.core.progress[attr] ?? 0
    progress += (dtSeconds * speed) / secondsForNextRank(rank)
    while (progress >= 1) {
      progress -= 1
      rank += 1
    }
    state.core.ranks[attr] = rank
    state.core.progress[attr] = progress
  }
}

/** Short bonus blurb for the Core tab UI. */
export function coreAttrBonusSummary(attrId: CoreAttrId, rank: number): string {
  const m = coreEffectMultiplier(rank)
  if (m <= 0) return 'No bonus yet'
  switch (attrId) {
    case 'ballistics':
      return `+${((ballisticsDamageMult(rank) - 1) * 100).toFixed(1)}% fleet DPS`
    case 'plating':
      return `+${((platingHullMult(rank) - 1) * 100).toFixed(1)}% hull · +${platingArmorBonus(rank).toFixed(1)} armor`
    case 'reactors':
      return `+${reactorsShieldBonus(rank).toFixed(0)} shield · +${((reactorsRepairMult(rank) - 1) * 100).toFixed(1)}% repair`
    case 'sensors':
      return `+${(sensorsEvasionBonus(rank) * 100).toFixed(1)}% evasion · +${(sensorsMatchupBonus(rank) * 100).toFixed(1)}% matchup`
    case 'logistics':
      return `+${((logisticsProdMult(rank) - 1) * 100).toFixed(1)}% prod · +${((1 + 0.65 * m - 1) * 100).toFixed(1)}% fab · +${((Math.min(1.75, 1 + 0.6 * m) - 1) * 100).toFixed(1)}% drops`
  }
}
