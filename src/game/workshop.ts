/** GDD Workshop + temporary Sortie upgrades. Cycle-level starts; run purchases on top. */

import type { GameState, RunUpgradeCategory, RunUpgradeId, WorkshopState } from './types'
import { matterShopReclaimBonus } from './catalog'
import { shopBulkTenUnlocked, shopBuyMaxUnlocked, shopReadoutUnlocked } from './disclosure'

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
  {
    id: 'crit-chance',
    name: 'Critical Chance',
    category: 'attack',
    blurb: 'Hive weapons sometimes land a heavier hit.',
    minBestWave: 50,
  },
  {
    id: 'shield-regen',
    name: 'Shield Regeneration',
    category: 'defense',
    blurb: 'The Hive shield bank refills faster between hits.',
    minBestWave: 70,
  },
  {
    id: 'scrap-kill',
    name: 'Scrap / Kill',
    category: 'economy',
    blurb: 'Wrecks drop a little Scrap during the Sortie.',
    minBestWave: 70,
  },
  {
    id: 'armor-pen',
    name: 'Armor Penetration',
    category: 'attack',
    blurb: 'Shots cut through armored hulls more cleanly.',
    minBestWave: 110,
  },
  {
    id: 'armor',
    name: 'Armor',
    category: 'defense',
    blurb: 'The Hive shrugs off more hull damage.',
    minBestWave: 110,
  },
  {
    id: 'fragment-chance',
    name: 'Fragment Chance',
    category: 'economy',
    blurb: 'Wrecks drop Core Blueprint fragments more often.',
    minBestWave: 110,
  },
  {
    id: 'ash-yield',
    name: 'Ash Yield',
    category: 'economy',
    blurb: 'Kills bank more Choir-ash for the Furnace.',
    minBestWave: 140,
  },
]

export const RUN_UPGRADE_CAP = 80
export const EXTRACTION_SCRAP_BONUS = 0.12
/** Workshop starting-power curve — change only this layer in a later balance PR. */
export const WORKSHOP_WEAPON_POWER_PER_LEVEL = 0.08
export const WORKSHOP_CYCLE_RATE_PER_LEVEL = 0.03
export const WORKSHOP_HULL_PER_LEVEL = 0.08
export const WORKSHOP_SHIELD_PER_LEVEL = 0.1
export const WORKSHOP_SALVAGE_KILL_PER_LEVEL = 0.08
/** Temporary Salvage ranks are weaker per level than Workshop starts. */
export const RUN_UPGRADE_POWER_SCALE = 0.36

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
export const RUN_UPGRADE_COST_BASE = 8
export const RUN_UPGRADE_COST_GROWTH = 1.3

export function runUpgradeCost(purchasedLevel: number): number {
  return Math.floor(RUN_UPGRADE_COST_BASE * Math.pow(RUN_UPGRADE_COST_GROWTH, Math.max(0, purchasedLevel)))
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
  const start = workshopLevel(state, id)
  const run = runPurchasedLevel(state, id)
  return Math.pow(1 + perLevel, start) * Math.pow(1 + perLevel * RUN_UPGRADE_POWER_SCALE, run)
}

export function weaponPowerMult(state: GameState): number {
  return runUpgradeMult(state, 'weapon-power', WORKSHOP_WEAPON_POWER_PER_LEVEL)
}

export function cycleRateMult(state: GameState): number {
  return runUpgradeMult(state, 'cycle-rate', WORKSHOP_CYCLE_RATE_PER_LEVEL)
}

export function runHullMult(state: GameState): number {
  return runUpgradeMult(state, 'hull', WORKSHOP_HULL_PER_LEVEL)
}

export function runShieldMult(state: GameState): number {
  return runUpgradeMult(state, 'shield', WORKSHOP_SHIELD_PER_LEVEL)
}

export function salvageKillMult(state: GameState): number {
  return runUpgradeMult(state, 'salvage-kill', WORKSHOP_SALVAGE_KILL_PER_LEVEL)
}

export function salvageWaveBonus(state: GameState): number {
  const n = effectiveUpgradeLevel(state, 'salvage-wave')
  if (n <= 0) return 0
  return Math.floor(4 * n * Math.pow(1.06, n))
}

export function critChance(state: GameState): number {
  return Math.min(0.45, effectiveUpgradeLevel(state, 'crit-chance') * 0.02)
}

export function armorPenAdd(state: GameState): number {
  return effectiveUpgradeLevel(state, 'armor-pen') * 0.05
}

export function shopArmor(state: GameState): number {
  return effectiveUpgradeLevel(state, 'armor') * 0.45
}

export function shopShieldRegen(state: GameState): number {
  return effectiveUpgradeLevel(state, 'shield-regen') * 0.004
}

export function scrapKillBonus(state: GameState, isBoss = false): number {
  const n = effectiveUpgradeLevel(state, 'scrap-kill')
  if (n <= 0) return 0
  return (isBoss ? 2 : 0.35) * n
}

export function fragmentChanceMult(state: GameState): number {
  return 1 + effectiveUpgradeLevel(state, 'fragment-chance') * 0.06
}

export function ashYieldMult(state: GameState): number {
  return runUpgradeMult(state, 'ash-yield', 0.08)
}

/** GDD §114 Current / Next values for Sortie and Workshop cards. */
export function runUpgradePreview(
  state: GameState,
  id: RunUpgradeId,
  kind: 'workshop' | 'run' = 'run',
): { current: string; next: string } {
  const start = workshopLevel(state, id)
  const run = runPurchasedLevel(state, id)
  const level = effectiveUpgradeLevel(state, id)
  const fmt = (per: number) => {
    const current = runUpgradeMult(state, id, per)
    const next =
      kind === 'workshop'
        ? Math.pow(1 + per, start + 1) * Math.pow(1 + per * RUN_UPGRADE_POWER_SCALE, run)
        : Math.pow(1 + per, start) * Math.pow(1 + per * RUN_UPGRADE_POWER_SCALE, run + 1)
    return {
      current: `×${current.toFixed(2)}`,
      next: `×${next.toFixed(2)}`,
    }
  }
  switch (id) {
    case 'weapon-power':
      return fmt(WORKSHOP_WEAPON_POWER_PER_LEVEL)
    case 'cycle-rate':
      return fmt(WORKSHOP_CYCLE_RATE_PER_LEVEL)
    case 'hull':
      return fmt(WORKSHOP_HULL_PER_LEVEL)
    case 'shield':
      return fmt(WORKSHOP_SHIELD_PER_LEVEL)
    case 'salvage-kill':
      return fmt(WORKSHOP_SALVAGE_KILL_PER_LEVEL)
    case 'salvage-wave': {
      const next = Math.floor(4 * (level + 1) * Math.pow(1.06, level + 1))
      return { current: `+${salvageWaveBonus(state)}`, next: `+${next}` }
    }
    case 'crit-chance':
      return { current: `${Math.round(critChance(state) * 100)}%`, next: `${Math.min(45, (level + 1) * 2)}%` }
    case 'armor-pen':
      return { current: `+${armorPenAdd(state).toFixed(2)}`, next: `+${((level + 1) * 0.05).toFixed(2)}` }
    case 'shield-regen':
      return { current: `+${(shopShieldRegen(state) * 100).toFixed(1)}%/s`, next: `+${((level + 1) * 0.4).toFixed(1)}%/s` }
    case 'armor':
      return { current: `+${shopArmor(state).toFixed(1)}`, next: `+${((level + 1) * 0.45).toFixed(1)}` }
    case 'scrap-kill':
      return { current: `+${scrapKillBonus(state).toFixed(1)}`, next: `+${((level + 1) * 0.35).toFixed(1)}` }
    case 'fragment-chance':
      return { current: `×${fragmentChanceMult(state).toFixed(2)}`, next: `×${(1 + (level + 1) * 0.06).toFixed(2)}` }
    case 'ash-yield':
      return fmt(0.08)
  }
}

export function shopTimeToAfford(state: GameState, cost: number, bank: number): string | null {
  if (!shopReadoutUnlocked(state)) return null
  if (bank >= cost) return 'Affordable now'
  const elapsed = state.combat.fightElapsed ?? 0
  if (state.combat.docked || elapsed < 4) return null
  const spent = Object.values(state.combat.runUpgrades ?? {}).reduce((n, lv) => {
    let total = 0
    for (let i = 0; i < (lv ?? 0); i += 1) total += runUpgradeCost(i)
    return n + total
  }, 0)
  const earned = bank + spent
  const rate = earned / elapsed
  if (rate < 0.2) return null
  const wait = Math.ceil((cost - bank) / rate)
  return `~${wait}s`
}

/** Per-rank stat line for Workshop / Sortie shop details. */
export function runUpgradeEffectLine(id: RunUpgradeId): string {
  switch (id) {
    case 'weapon-power':
      return `Weapon damage ${`×${(1 + WORKSHOP_WEAPON_POWER_PER_LEVEL).toFixed(2)}`} per rank`
    case 'cycle-rate':
      return `Fire rate ${`×${(1 + WORKSHOP_CYCLE_RATE_PER_LEVEL).toFixed(2)}`} per rank`
    case 'hull':
      return `Hull ${`×${(1 + WORKSHOP_HULL_PER_LEVEL).toFixed(2)}`} per rank`
    case 'shield':
      return `Shield ${`×${(1 + WORKSHOP_SHIELD_PER_LEVEL).toFixed(2)}`} per rank`
    case 'salvage-kill':
      return `Salvage/kill ${`×${(1 + WORKSHOP_SALVAGE_KILL_PER_LEVEL).toFixed(2)}`} per rank`
    case 'salvage-wave':
      return 'Wave Salvage +4 × rank × 1.06^rank'
    case 'crit-chance':
      return 'Crit chance +2% per rank (cap 45%)'
    case 'armor-pen':
      return 'Armor pen +0.05 per rank'
    case 'shield-regen':
      return 'Shield regen +0.4%/s per rank'
    case 'armor':
      return 'Armor +0.45 per rank'
    case 'scrap-kill':
      return 'Scrap/kill +0.35 per rank'
    case 'fragment-chance':
      return 'Fragment chance +6% per rank'
    case 'ash-yield':
      return 'Ash yield ×1.08 per rank'
  }
}

export function shopEconomyRoi(state: GameState, id: RunUpgradeId): string | null {
  if (!shopReadoutUnlocked(state)) return null
  if (id !== 'salvage-kill' && id !== 'salvage-wave' && id !== 'scrap-kill' && id !== 'fragment-chance' && id !== 'ash-yield') {
    return null
  }
  const preview = runUpgradePreview(state, id)
  return `ROI ${preview.current} → ${preview.next}`
}

export function visibleRunUpgrades(bestWave: number, category?: RunUpgradeCategory): RunUpgradeDef[] {
  return RUN_UPGRADES.filter(
    (def) => (category ? def.category === category : true) && bestWave >= def.minBestWave,
  )
}

export function applyWorkshopCoreStarts(state: GameState): void {
  if (!state.workshop) state.workshop = createEmptyWorkshop()
  state.workshop.coreStarts = { ...(state.workshop.coreStarts ?? {}) }
  state.shipyard.moduleLevels = {}
}

export function snapshotWorkshopCoreStarts(state: GameState): void {
  if (!state.workshop) state.workshop = createEmptyWorkshop()
  state.workshop.coreStarts = { ...(state.workshop.coreStarts ?? {}) }
}

/** After a Sortie, global Salvage upgrades and retired per-Sortie Core fields clear. */
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

