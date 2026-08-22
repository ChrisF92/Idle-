/** GDD Workshop + temporary Sortie upgrades. Cycle-level starts; run purchases on top. */

import type { GameState, RunUpgradeCategory, RunUpgradeId, WorkshopState } from './types'

export type { RunUpgradeCategory, RunUpgradeId, WorkshopState }

export interface RunUpgradeDef {
  id: RunUpgradeId
  name: string
  category: RunUpgradeCategory
  blurb: string
  /** Shown after the first Sortie; W10+ opens the rest of Attack/Defense. */
  minBestWave: number
}

export const RUN_UPGRADES: RunUpgradeDef[] = [
  {
    id: 'weapon-power',
    name: 'Weapon Power',
    category: 'attack',
    blurb: 'All Hive weapons deal more damage.',
    minBestWave: 0,
  },
  {
    id: 'cycle-rate',
    name: 'Cycle Rate',
    category: 'attack',
    blurb: 'Weapons fire more often.',
    minBestWave: 10,
  },
  {
    id: 'hull',
    name: 'Hull',
    category: 'defense',
    blurb: 'The Hive withstands more punishment.',
    minBestWave: 0,
  },
  {
    id: 'shield',
    name: 'Shield Capacity',
    category: 'defense',
    blurb: 'Larger shield pool before Hull is touched.',
    minBestWave: 10,
  },
  {
    id: 'salvage-kill',
    name: 'Salvage / Kill',
    category: 'economy',
    blurb: 'More Salvage from each wreck.',
    minBestWave: 0,
  },
  {
    id: 'salvage-wave',
    name: 'Salvage / Wave',
    category: 'economy',
    blurb: 'Bonus Salvage when a Wave is cleared.',
    minBestWave: 40,
  },
]

export const RUN_UPGRADE_CAP = 80
export const EXTRACTION_SCRAP_BONUS = 0.12

export function createEmptyWorkshop(): WorkshopState {
  return { levels: {}, coreStarts: {} }
}

export function runUpgradeLevel(state: GameState, id: RunUpgradeId): number {
  const bought = Math.max(0, Math.floor(state.combat.runUpgrades?.[id] ?? 0))
  return workshopLevel(state, id) + bought
}

export function workshopLevel(state: GameState, id: RunUpgradeId): number {
  return Math.max(0, Math.floor(state.workshop?.levels?.[id] ?? 0))
}

export function effectiveUpgradeLevel(state: GameState, id: RunUpgradeId): number {
  return Math.min(RUN_UPGRADE_CAP, runUpgradeLevel(state, id))
}

export function runUpgradeCost(effectiveLevel: number): number {
  return Math.floor(8 * Math.pow(1.18, Math.max(0, effectiveLevel)))
}

export function workshopCost(currentLevel: number): number {
  return Math.floor(12 * Math.pow(1.22, Math.max(0, currentLevel)))
}

export function runUpgradeMult(state: GameState, id: RunUpgradeId, perLevel: number): number {
  return Math.pow(1 + perLevel, effectiveUpgradeLevel(state, id))
}

export function weaponPowerMult(state: GameState): number {
  return runUpgradeMult(state, 'weapon-power', 0.08)
}

export function cycleRateMult(state: GameState): number {
  return runUpgradeMult(state, 'cycle-rate', 0.03)
}

export function runHullMult(state: GameState): number {
  return runUpgradeMult(state, 'hull', 0.08)
}

export function runShieldMult(state: GameState): number {
  return runUpgradeMult(state, 'shield', 0.1)
}

export function salvageKillMult(state: GameState): number {
  return runUpgradeMult(state, 'salvage-kill', 0.08)
}

export function salvageWaveBonus(state: GameState): number {
  const n = effectiveUpgradeLevel(state, 'salvage-wave')
  if (n <= 0) return 0
  return Math.floor(4 * n * Math.pow(1.06, n))
}

export function visibleRunUpgrades(bestWave: number, category?: RunUpgradeCategory): RunUpgradeDef[] {
  return RUN_UPGRADES.filter(
    (def) => (category ? def.category === category : true) && bestWave >= def.minBestWave,
  )
}

export function applyWorkshopCoreStarts(state: GameState): void {
  state.shipyard.moduleLevels = { ...(state.workshop?.coreStarts ?? {}) }
}

export function snapshotWorkshopCoreStarts(state: GameState): void {
  if (!state.workshop) state.workshop = createEmptyWorkshop()
  state.workshop.coreStarts = { ...state.shipyard.moduleLevels }
}

/** After a Sortie, temporary Salvage ranks clear. Core ranks stay at Dock starts. */
export function resetRunCoreLevels(state: GameState): void {
  applyWorkshopCoreStarts(state)
  state.combat.runUpgrades = {}
}

/**
 * GDD §72 — replaying solved Waves is time compression, not extra power.
 * +50% combat speed per 10 Waves behind career best, capped at 4×.
 */
export function reclaimSpeed(state: GameState): number {
  const best = Math.max(0, state.meta.bestWave ?? 0, state.combat.bestWave ?? 0)
  const wave = Math.max(1, state.combat.wave ?? 1)
  if (best <= wave) return 1
  return Math.min(4, 1 + 0.5 * Math.floor((best - wave) / 10))
}
