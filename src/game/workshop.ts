/** GDD Workshop + temporary Sortie upgrades. Cycle-level starts; run purchases on top. */

import type { GameState, RunUpgradeCategory, RunUpgradeId, WorkshopState } from './types'
import { matterShopReclaimBonus } from './catalog'
import { shopBulkTenUnlocked, shopBuyMaxUnlocked } from './disclosure'

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

export function runPurchasedLevel(state: GameState, id: RunUpgradeId): number {
  return Math.max(0, Math.floor(state.combat.runUpgrades?.[id] ?? 0))
}

export function runUpgradeLevel(state: GameState, id: RunUpgradeId): number {
  return workshopLevel(state, id) + runPurchasedLevel(state, id)
}

export function workshopLevel(state: GameState, id: RunUpgradeId): number {
  return Math.max(0, Math.floor(state.workshop?.levels?.[id] ?? 0))
}

export function effectiveUpgradeLevel(state: GameState, id: RunUpgradeId): number {
  return Math.min(RUN_UPGRADE_CAP, runUpgradeLevel(state, id))
}

/**
 * Temporary Sortie purchase cost uses only the run-purchase counter.
 * Workshop starting levels raise effective power but do not consume the cheap
 * early-run ladder.
 */
export function runUpgradeCost(purchasedLevel: number): number {
  return Math.floor(8 * Math.pow(1.18, Math.max(0, purchasedLevel)))
}

export function nextRunUpgradeCost(state: GameState, id: RunUpgradeId): number {
  return runUpgradeCost(runPurchasedLevel(state, id))
}

export function runUpgradeBulkCost(state: GameState, id: RunUpgradeId, count: number): number {
  const start = runPurchasedLevel(state, id)
  const room = Math.max(0, RUN_UPGRADE_CAP - runUpgradeLevel(state, id))
  const n = Math.min(Math.max(0, Math.floor(count)), room)
  let total = 0
  for (let i = 0; i < n; i += 1) total += runUpgradeCost(start + i)
  return total
}

export function maxAffordableRunPurchases(state: GameState, id: RunUpgradeId): number {
  let salvage = state.resources.salvage ?? 0
  let bought = runPurchasedLevel(state, id)
  let effective = runUpgradeLevel(state, id)
  let n = 0
  while (effective < RUN_UPGRADE_CAP) {
    const cost = runUpgradeCost(bought)
    if (salvage < cost) break
    salvage -= cost
    bought += 1
    effective += 1
    n += 1
  }
  return n
}

export function workshopCost(currentLevel: number): number {
  return Math.floor(12 * Math.pow(1.22, Math.max(0, currentLevel)))
}

export function workshopBulkCost(currentLevel: number, count: number): number {
  const n = Math.min(Math.max(0, Math.floor(count)), Math.max(0, RUN_UPGRADE_CAP - currentLevel))
  let total = 0
  for (let i = 0; i < n; i += 1) total += workshopCost(currentLevel + i)
  return total
}

export function maxAffordableWorkshopPurchases(state: GameState, id: RunUpgradeId): number {
  let scrap = state.resources.scrap ?? 0
  let level = workshopLevel(state, id)
  let n = 0
  while (level < RUN_UPGRADE_CAP) {
    const cost = workshopCost(level)
    if (scrap < cost) break
    scrap -= cost
    level += 1
    n += 1
  }
  return n
}

export type BuyMode = 1 | 10 | 'max'

/** ×1 is always available. ×10 / MAX wait for Process (GDD §122). */
export function unlockedBuyModes(state: GameState): BuyMode[] {
  const modes: BuyMode[] = [1]
  if (shopBulkTenUnlocked(state)) modes.push(10)
  if (shopBuyMaxUnlocked(state)) modes.push('max')
  return modes
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

/** GDD §114 Current / Next values for Sortie and Workshop cards. */
export function runUpgradePreview(
  state: GameState,
  id: RunUpgradeId,
): { current: string; next: string } {
  const level = effectiveUpgradeLevel(state, id)
  const fmt = (per: number) => ({
    current: `×${Math.pow(1 + per, level).toFixed(2)}`,
    next: `×${Math.pow(1 + per, level + 1).toFixed(2)}`,
  })
  switch (id) {
    case 'weapon-power':
      return fmt(0.08)
    case 'cycle-rate':
      return fmt(0.03)
    case 'hull':
      return fmt(0.08)
    case 'shield':
      return fmt(0.1)
    case 'salvage-kill':
      return fmt(0.08)
    case 'salvage-wave': {
      const next = Math.floor(4 * (level + 1) * Math.pow(1.06, level + 1))
      return { current: `+${salvageWaveBonus(state)}`, next: `+${next}` }
    }
  }
}

export function visibleRunUpgrades(bestWave: number, category?: RunUpgradeCategory): RunUpgradeDef[] {
  return RUN_UPGRADES.filter(
    (def) => (category ? def.category === category : true) && bestWave >= def.minBestWave,
  )
}

export function applyWorkshopCoreStarts(state: GameState): void {
  if (!state.workshop) state.workshop = createEmptyWorkshop()
  state.workshop.coreStarts = {}
  state.shipyard.moduleLevels = {}
}

export function snapshotWorkshopCoreStarts(state: GameState): void {
  if (!state.workshop) state.workshop = createEmptyWorkshop()
  state.workshop.coreStarts = {}
}

/** After a Sortie, temporary Salvage ranks and Core Run Levels clear. */
export function resetRunCoreLevels(state: GameState): void {
  state.shipyard.moduleLevels = {}
  state.combat.coreRunLevels = {}
  state.combat.coreSalvageSpent = {}
  state.combat.coreMasteryStart = {}
  state.combat.coreMasteryXp = {}
  state.combat.coreBossClears = {}
  state.combat.coreNewBest = {}
  state.combat.coreMilestones = {}
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
  const matter = 1 + matterShopReclaimBonus(state.prestige?.matterShop ?? {})
  return Math.min(4, (1 + 0.5 * Math.floor((best - wave) / 10)) * matter)
}

