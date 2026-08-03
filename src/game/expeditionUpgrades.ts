/**
 * Phase 2 — temporary Expedition ship-system upgrades (Salvage store).
 * Reset on Extract / Defeat / Prestige.
 */

import type { GameState } from './types'
import { getModule, moduleLevel, MAX_MODULE_LEVEL, moduleUpgradeCost } from './catalog'

export type UpgradeCategory = 'offence' | 'defence' | 'economy' | 'utility' | 'modules'

export type BulkBuyMode = 1 | 10 | 'max'

export interface ExpeditionUpgradeDef {
  id: string
  name: string
  category: Exclude<UpgradeCategory, 'modules'>
  description: string
  /** Salvage cost at rank 0 → 1. */
  baseCost: number
  /** cost = baseCost × growth^rank */
  growth: number
  cap: number
  /**
   * Career highest wave required to unlock (0 = from start).
   * Once unlocked, remains available after Prestige.
   */
  unlockWave: number
  /** Short effect label for the card, e.g. "+5% damage / rank". */
  effectPerRank: string
}

/** Phase 2 starter + early career unlocks. */
export const EXPEDITION_UPGRADES: readonly ExpeditionUpgradeDef[] = [
  {
    id: 'weapon-damage',
    name: 'Weapon Damage',
    category: 'offence',
    description: 'Increases all flagship and escort weapon damage.',
    baseCost: 8,
    growth: 1.15,
    cap: 50,
    unlockWave: 0,
    effectPerRank: '+5% damage',
  },
  {
    id: 'fire-rate',
    name: 'Fire Rate',
    category: 'offence',
    description: 'Shortens weapon cooldowns.',
    baseCost: 10,
    growth: 1.16,
    cap: 50,
    unlockWave: 0,
    effectPerRank: '+3% fire rate',
  },
  {
    id: 'boss-damage',
    name: 'Boss Damage',
    category: 'offence',
    description: 'Extra damage against bosses and Entity targets.',
    baseCost: 14,
    growth: 1.2,
    cap: 20,
    unlockWave: 0,
    effectPerRank: '+6% boss damage',
  },
  {
    id: 'max-hull',
    name: 'Maximum Hull',
    category: 'defence',
    description: 'Raises flagship hull capacity.',
    baseCost: 9,
    growth: 1.15,
    cap: 50,
    unlockWave: 0,
    effectPerRank: '+4% hull',
  },
  {
    id: 'max-shield',
    name: 'Maximum Shield',
    category: 'defence',
    description: 'Raises shield capacity.',
    baseCost: 11,
    growth: 1.16,
    cap: 50,
    unlockWave: 0,
    effectPerRank: '+5% shields',
  },
  {
    id: 'armour',
    name: 'Armour',
    category: 'defence',
    description: 'Flat damage reduction after shields.',
    baseCost: 12,
    growth: 1.17,
    cap: 50,
    unlockWave: 0,
    effectPerRank: '+0.4 armour',
  },
  {
    id: 'salvage-per-kill',
    name: 'Salvage per Kill',
    category: 'economy',
    description: 'Salvage fragments from destroyed enemies.',
    baseCost: 10,
    growth: 1.18,
    cap: 50,
    unlockWave: 0,
    effectPerRank: '+0.15 salvage / kill',
  },
  {
    id: 'salvage-per-wave',
    name: 'Salvage per Wave',
    category: 'economy',
    description: 'Increases Salvage awarded on wave clear.',
    baseCost: 12,
    growth: 1.18,
    cap: 50,
    unlockWave: 0,
    effectPerRank: '+4% wave salvage',
  },
  {
    id: 'weapon-range',
    name: 'Weapon Range',
    category: 'utility',
    description: 'Extends engagement range for all weapons.',
    baseCost: 11,
    growth: 1.17,
    cap: 50,
    unlockWave: 0,
    effectPerRank: '+2% range',
  },
  // Early unlocks — still Phase 2, gated by career best wave
  {
    id: 'crit-chance',
    name: 'Critical Chance',
    category: 'offence',
    description: 'Chance for weapons to deal critical damage.',
    baseCost: 16,
    growth: 1.2,
    cap: 20,
    unlockWave: 10,
    effectPerRank: '+1% crit chance',
  },
  {
    id: 'crit-damage',
    name: 'Critical Damage',
    category: 'offence',
    description: 'Damage multiplier on critical hits.',
    baseCost: 18,
    growth: 1.22,
    cap: 20,
    unlockWave: 15,
    effectPerRank: '+8% crit damage',
  },
  {
    id: 'evasion',
    name: 'Evasion',
    category: 'defence',
    description: 'Chance to ignore an incoming hit.',
    baseCost: 15,
    growth: 1.2,
    cap: 20,
    unlockWave: 10,
    effectPerRank: '+0.4% evasion',
  },
  {
    id: 'elite-reward',
    name: 'Elite Reward',
    category: 'economy',
    description: 'Bonus Salvage from elite wave clears.',
    baseCost: 20,
    growth: 1.22,
    cap: 20,
    unlockWave: 15,
    effectPerRank: '+8% elite salvage',
  },
] as const

export function getExpeditionUpgrade(id: string): ExpeditionUpgradeDef | undefined {
  return EXPEDITION_UPGRADES.find((u) => u.id === id)
}

export function upgradeRank(
  upgrades: Record<string, number> | undefined,
  id: string,
): number {
  return Math.max(0, Math.floor(upgrades?.[id] ?? 0))
}

export function isUpgradeUnlocked(state: GameState, def: ExpeditionUpgradeDef): boolean {
  const career = Math.max(state.meta.highestWaveEver ?? 0, state.combat.bestWaveThisRun)
  return career >= def.unlockWave
}

export function upgradeCostAtRank(def: ExpeditionUpgradeDef, rank: number): number {
  if (rank < 0) return def.baseCost
  return Math.ceil(def.baseCost * Math.pow(def.growth, rank))
}

/** Total Salvage to buy `count` ranks starting from `fromRank`. */
export function upgradeCostForRanks(
  def: ExpeditionUpgradeDef,
  fromRank: number,
  count: number,
): number {
  let total = 0
  const maxCount = Math.max(0, Math.min(count, def.cap - fromRank))
  for (let i = 0; i < maxCount; i += 1) {
    total += upgradeCostAtRank(def, fromRank + i)
  }
  return total
}

/** How many ranks can be afforded from `fromRank` with `salvage`. */
export function maxAffordableRanks(
  def: ExpeditionUpgradeDef,
  fromRank: number,
  salvage: number,
): number {
  let spent = 0
  let ranks = 0
  while (fromRank + ranks < def.cap) {
    const cost = upgradeCostAtRank(def, fromRank + ranks)
    if (spent + cost > salvage) break
    spent += cost
    ranks += 1
  }
  return ranks
}

export function resolveBuyCount(
  def: ExpeditionUpgradeDef,
  fromRank: number,
  salvage: number,
  mode: BulkBuyMode,
): number {
  const room = Math.max(0, def.cap - fromRank)
  if (room <= 0) return 0
  if (mode === 'max') return maxAffordableRanks(def, fromRank, salvage)
  const want = mode === 10 ? 10 : 1
  const capped = Math.min(want, room)
  // Only buy ranks we can fully afford in sequence
  return Math.min(capped, maxAffordableRanks(def, fromRank, salvage))
}

/** Aggregated combat modifiers from temporary Expedition upgrades. */
export interface ExpeditionUpgradeBonuses {
  damageMult: number
  fireRateMult: number
  bossDamageMult: number
  hullMult: number
  shieldMult: number
  armorFlat: number
  rangeMult: number
  salvagePerKill: number
  salvageWaveMult: number
  eliteSalvageMult: number
  critChance: number
  critDamageMult: number
  evasionFlat: number
}

export function emptyUpgradeBonuses(): ExpeditionUpgradeBonuses {
  return {
    damageMult: 1,
    fireRateMult: 1,
    bossDamageMult: 1,
    hullMult: 1,
    shieldMult: 1,
    armorFlat: 0,
    rangeMult: 1,
    salvagePerKill: 0,
    salvageWaveMult: 1,
    eliteSalvageMult: 1,
    critChance: 0,
    critDamageMult: 1.5,
    evasionFlat: 0,
  }
}

export function computeExpeditionUpgradeBonuses(
  upgrades: Record<string, number> | undefined,
): ExpeditionUpgradeBonuses {
  const b = emptyUpgradeBonuses()
  const rank = (id: string) => upgradeRank(upgrades, id)

  b.damageMult = 1 + 0.05 * rank('weapon-damage')
  b.fireRateMult = 1 + 0.03 * rank('fire-rate')
  b.bossDamageMult = 1 + 0.06 * rank('boss-damage')
  b.hullMult = 1 + 0.04 * rank('max-hull')
  b.shieldMult = 1 + 0.05 * rank('max-shield')
  b.armorFlat = 0.4 * rank('armour')
  b.rangeMult = 1 + 0.02 * rank('weapon-range')
  b.salvagePerKill = 0.15 * rank('salvage-per-kill')
  b.salvageWaveMult = 1 + 0.04 * rank('salvage-per-wave')
  b.eliteSalvageMult = 1 + 0.08 * rank('elite-reward')
  b.critChance = 0.01 * rank('crit-chance')
  b.critDamageMult = 1.5 + 0.08 * rank('crit-damage')
  b.evasionFlat = 0.004 * rank('evasion')
  return b
}

export function listVisibleUpgrades(state: GameState): ExpeditionUpgradeDef[] {
  return EXPEDITION_UPGRADES.filter((def) => isUpgradeUnlocked(state, def))
}

export function listLockedUpgrades(state: GameState): ExpeditionUpgradeDef[] {
  return EXPEDITION_UPGRADES.filter((def) => !isUpgradeUnlocked(state, def))
}

/** Module rank card helpers for the store Modules filter. */
export function fittedModuleUpgradeRows(state: GameState): Array<{
  moduleId: string
  name: string
  rank: number
  cap: number
  cost: number
  capped: boolean
}> {
  const rows = []
  for (const moduleId of state.shipyard.modules) {
    const mod = getModule(moduleId)
    if (!mod) continue
    const rank = moduleLevel(state.shipyard.moduleLevels, moduleId)
    const capped = rank >= MAX_MODULE_LEVEL
    rows.push({
      moduleId,
      name: mod.name,
      rank,
      cap: MAX_MODULE_LEVEL,
      cost: capped ? 0 : moduleUpgradeCost(rank),
      capped,
    })
  }
  return rows
}

export function formatUpgradeEffect(
  def: ExpeditionUpgradeDef,
  rank: number,
): { current: string; next: string } {
  const describe = (r: number): string => {
    switch (def.id) {
      case 'weapon-damage':
        return `+${(r * 5).toFixed(0)}% damage`
      case 'fire-rate':
        return `+${(r * 3).toFixed(0)}% fire rate`
      case 'boss-damage':
        return `+${(r * 6).toFixed(0)}% boss damage`
      case 'max-hull':
        return `+${(r * 4).toFixed(0)}% hull`
      case 'max-shield':
        return `+${(r * 5).toFixed(0)}% shields`
      case 'armour':
        return `+${(r * 0.4).toFixed(1)} armour`
      case 'salvage-per-kill':
        return `+${(r * 0.15).toFixed(2)} salvage / kill`
      case 'salvage-per-wave':
        return `+${(r * 4).toFixed(0)}% wave salvage`
      case 'weapon-range':
        return `+${(r * 2).toFixed(0)}% range`
      case 'crit-chance':
        return `${(r * 1).toFixed(0)}% crit chance`
      case 'crit-damage':
        return `${(150 + r * 8).toFixed(0)}% crit damage`
      case 'evasion':
        return `+${(r * 0.4).toFixed(1)}% evasion`
      case 'elite-reward':
        return `+${(r * 8).toFixed(0)}% elite salvage`
      default:
        return def.effectPerRank
    }
  }
  return {
    current: describe(rank),
    next: rank >= def.cap ? 'Capped' : describe(rank + 1),
  }
}
