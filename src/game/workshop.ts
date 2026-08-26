/** Canonical generic upgrades: Workshop cycle levels, Sortie temp levels, permanent unlocks. */

import type { GameState, GenericUpgradeUnlocks, RunUpgradeCategory, RunUpgradeId, WorkshopState } from './types'
import { ACT1_CADENCE } from './cadence'
import { shopBulkTenUnlocked, shopBuyMaxUnlocked, shopReadoutUnlocked } from './disclosure'
import { careerBestWave } from './waves'

export type { RunUpgradeCategory, RunUpgradeId, WorkshopState }

export type UpgradeCurveFamily =
  | 'throughput'
  | 'cycle'
  | 'chance'
  | 'crit-factor'
  | 'penetration'
  | 'targeting'
  | 'protection'
  | 'sustain'
  | 'economy-flat'
  | 'economy-chance'
  | 'economy-yield'

export interface RunUpgradeDef {
  id: RunUpgradeId
  name: string
  category: RunUpgradeCategory
  blurb: string
  family: UpgradeCurveFamily
  workshopMax: number
  sortieMax: number
  chainIndex: number
}

/**
 * Curve-family caps (balance seeds, not one universal 80-level model):
 * - throughput: Workshop 40 / Sortie 30 — Weapon Power, Hull, Shield, Salvage/Kill
 * - cycle: 25 / 20
 * - chance: 12 / 8 (crit chance +2%/level, hard cap 40%)
 * - crit-factor: 15 / 10 (base 1.5× + 0.04/level)
 * - penetration: 20 / 15
 * - targeting: 12 / 8 (slew only; preserves Heavy Lance identity)
 * - protection: Armor 20/15; Damage Control 12/8 (DR cap 24%)
 * - sustain: 20 / 15
 * - economy-flat: 25 / 20
 * - economy-chance / yield: 20 / 15
 */
export const RUN_UPGRADES: RunUpgradeDef[] = [
  { id: 'weapon-power', name: 'Weapon Power', category: 'attack', blurb: 'Weapon-Core output.', family: 'throughput', workshopMax: 40, sortieMax: 30, chainIndex: 0 },
  { id: 'cycle-rate', name: 'Cycle Rate', category: 'attack', blurb: 'Weapons complete cycles faster.', family: 'cycle', workshopMax: 25, sortieMax: 20, chainIndex: 1 },
  { id: 'crit-chance', name: 'Critical Chance', category: 'attack', blurb: 'Direct Crit chance.', family: 'chance', workshopMax: 12, sortieMax: 8, chainIndex: 2 },
  { id: 'crit-factor', name: 'Critical Factor', category: 'attack', blurb: 'Direct Crit damage multiplier.', family: 'crit-factor', workshopMax: 15, sortieMax: 10, chainIndex: 3 },
  { id: 'armor-pen', name: 'Armor Penetration', category: 'attack', blurb: 'Reduces effective target Armor.', family: 'penetration', workshopMax: 20, sortieMax: 15, chainIndex: 4 },
  { id: 'targeting-servos', name: 'Targeting Servos', category: 'attack', blurb: 'Weapon-Core Slew Rate only.', family: 'targeting', workshopMax: 12, sortieMax: 8, chainIndex: 5 },
  { id: 'hull', name: 'Hull', category: 'defense', blurb: 'Maximum Hull.', family: 'throughput', workshopMax: 40, sortieMax: 30, chainIndex: 0 },
  { id: 'shield', name: 'Shield Capacity', category: 'defense', blurb: 'Maximum Shield.', family: 'throughput', workshopMax: 40, sortieMax: 30, chainIndex: 1 },
  { id: 'shield-regen', name: 'Shield Regeneration', category: 'defense', blurb: 'In-combat Shield recovery.', family: 'sustain', workshopMax: 20, sortieMax: 15, chainIndex: 2 },
  { id: 'armor', name: 'Armor', category: 'defense', blurb: 'Armor.', family: 'protection', workshopMax: 20, sortieMax: 15, chainIndex: 3 },
  { id: 'repair-rate', name: 'Repair Rate', category: 'defense', blurb: 'In-combat Hull repair.', family: 'sustain', workshopMax: 20, sortieMax: 15, chainIndex: 4 },
  { id: 'damage-control', name: 'Damage Control', category: 'defense', blurb: 'Bounded damage reduction, distinct from Armor.', family: 'protection', workshopMax: 12, sortieMax: 8, chainIndex: 5 },
  { id: 'salvage-kill', name: 'Salvage / Kill', category: 'economy', blurb: 'Combat Salvage from kills.', family: 'throughput', workshopMax: 40, sortieMax: 30, chainIndex: 0 },
  { id: 'salvage-wave', name: 'Salvage / Wave', category: 'economy', blurb: 'Salvage when a Wave package is Secured.', family: 'economy-flat', workshopMax: 25, sortieMax: 20, chainIndex: 1 },
  { id: 'scrap-kill', name: 'Scrap / Kill', category: 'economy', blurb: 'Combat Scrap from kills.', family: 'economy-flat', workshopMax: 25, sortieMax: 20, chainIndex: 2 },
  { id: 'scrap-wave', name: 'Scrap / Wave', category: 'economy', blurb: 'Scrap when a Wave package is Secured.', family: 'economy-flat', workshopMax: 25, sortieMax: 20, chainIndex: 3 },
  { id: 'fragment-find', name: 'Fragment Find', category: 'economy', blurb: 'Eligible Blueprint-fragment recovery chance.', family: 'economy-chance', workshopMax: 20, sortieMax: 15, chainIndex: 4 },
  { id: 'ash-recovery', name: 'Ash Recovery', category: 'economy', blurb: 'Combat Ash recovery. Requires Furnace.', family: 'economy-yield', workshopMax: 20, sortieMax: 15, chainIndex: 5 },
]

export const GENERIC_UNLOCK_COSTS = [75, 250, 750, 2000] as const
export const STARTER_KNOWN_PER_CATEGORY = 2
export const TUTORIAL_SORTIE_UPGRADE_IDS: RunUpgradeId[] = ['weapon-power', 'hull', 'salvage-kill']

export const WORKSHOP_WEAPON_POWER_PER_LEVEL = 0.08
export const WORKSHOP_CYCLE_RATE_PER_LEVEL = 0.03
export const WORKSHOP_HULL_PER_LEVEL = 0.08
export const WORKSHOP_SHIELD_PER_LEVEL = 0.1
export const WORKSHOP_SALVAGE_KILL_PER_LEVEL = 0.08
export const RUN_UPGRADE_POWER_SCALE = 0.36
export const RUN_UPGRADE_OPENING_RANKS = 4
export const RUN_UPGRADE_POWER_SCALE_OPENING = 0.7

export const BASE_CRIT_FACTOR = 1.5
export const CRIT_CHANCE_PER_LEVEL = 0.02
export const CRIT_CHANCE_CAP = 0.4
export const CRIT_FACTOR_PER_LEVEL = 0.04
export const ARMOR_PEN_PER_LEVEL = 0.05
export const ARMOR_PER_LEVEL = 0.45
export const SHIELD_REGEN_PER_LEVEL = 0.004
export const HULL_REPAIR_PER_LEVEL = 0.0035
export const DAMAGE_CONTROL_PER_LEVEL = 0.012
export const DAMAGE_CONTROL_CAP = 0.24
export const TARGETING_SERVOS_SLEW_PER_LEVEL = 0.03
export const SCRAP_KILL_PER_LEVEL = 0.35
export const FRAGMENT_FIND_PER_LEVEL = 0.06
export const ASH_RECOVERY_PER_LEVEL = 0.08

export function getRunUpgrade(id: RunUpgradeId): RunUpgradeDef | undefined {
  return RUN_UPGRADES.find((row) => row.id === id)
}

export function upgradesInCategory(category: RunUpgradeCategory): RunUpgradeDef[] {
  return RUN_UPGRADES.filter((row) => row.category === category).sort((a, b) => a.chainIndex - b.chainIndex)
}

export function emptyGenericUpgradeUnlocks(): GenericUpgradeUnlocks {
  return {
    attack: STARTER_KNOWN_PER_CATEGORY,
    defense: STARTER_KNOWN_PER_CATEGORY,
    economy: STARTER_KNOWN_PER_CATEGORY,
  }
}

export function genericUnlocks(state: GameState): GenericUpgradeUnlocks {
  const raw = state.meta?.genericUpgradeUnlocks
  return {
    attack: Math.max(STARTER_KNOWN_PER_CATEGORY, Math.floor(Number(raw?.attack ?? STARTER_KNOWN_PER_CATEGORY) || STARTER_KNOWN_PER_CATEGORY)),
    defense: Math.max(STARTER_KNOWN_PER_CATEGORY, Math.floor(Number(raw?.defense ?? STARTER_KNOWN_PER_CATEGORY) || STARTER_KNOWN_PER_CATEGORY)),
    economy: Math.max(STARTER_KNOWN_PER_CATEGORY, Math.floor(Number(raw?.economy ?? STARTER_KNOWN_PER_CATEGORY) || STARTER_KNOWN_PER_CATEGORY)),
  }
}

export function ensureGenericUnlocks(state: GameState): GenericUpgradeUnlocks {
  const next = genericUnlocks(state)
  state.meta.genericUpgradeUnlocks = next
  return next
}

export function knownCountFor(state: GameState, category: RunUpgradeCategory): number {
  return genericUnlocks(state)[category]
}

export function furnaceAvailable(state: GameState): boolean {
  return careerBestWave(state) >= ACT1_CADENCE.furnace
}

export function isUpgradePermanentlyKnown(state: GameState, id: RunUpgradeId): boolean {
  const def = getRunUpgrade(id)
  if (!def) return false
  if (def.chainIndex >= knownCountFor(state, def.category)) return false
  if (def.id === 'ash-recovery' && !furnaceAvailable(state)) return false
  return true
}

export function nextUnlockDef(state: GameState, category: RunUpgradeCategory): RunUpgradeDef | null {
  const known = knownCountFor(state, category)
  const chain = upgradesInCategory(category)
  if (known >= chain.length) return null
  return chain[known] ?? null
}

export function nextUnlockCost(state: GameState, category: RunUpgradeCategory): number | null {
  const next = nextUnlockDef(state, category)
  if (!next) return null
  const step = next.chainIndex - STARTER_KNOWN_PER_CATEGORY
  return GENERIC_UNLOCK_COSTS[step] ?? null
}

export function canUnlockNextGeneric(state: GameState, category: RunUpgradeCategory): { ok: true; cost: number; def: RunUpgradeDef } | { ok: false; reason: string } {
  if (!state.combat.docked) return { ok: false, reason: 'Dock to unlock upgrades' }
  const def = nextUnlockDef(state, category)
  const cost = nextUnlockCost(state, category)
  if (!def || cost == null) return { ok: false, reason: 'Category complete' }
  if (def.id === 'ash-recovery' && !furnaceAvailable(state)) {
    return { ok: false, reason: `Requires Furnace · W${ACT1_CADENCE.furnace}` }
  }
  if ((state.resources.scrap ?? 0) < cost) return { ok: false, reason: `Need ${cost} Scrap` }
  return { ok: true, cost, def }
}

export function tutorialSortieShopActive(state: GameState): boolean {
  return !state.meta.hullLostOnce
}

export function createEmptyWorkshop(): WorkshopState {
  return { levels: {}, coreStarts: {} }
}

export function runPurchasedLevel(state: GameState, id: RunUpgradeId): number {
  return Math.max(0, Math.floor(state.combat.runUpgrades?.[id] ?? 0))
}

export function workshopLevel(state: GameState, id: RunUpgradeId): number {
  return Math.max(0, Math.floor(state.workshop?.levels?.[id] ?? 0))
}

export function workshopCap(id: RunUpgradeId): number {
  return getRunUpgrade(id)?.workshopMax ?? 0
}

export function sortieCap(id: RunUpgradeId): number {
  return getRunUpgrade(id)?.sortieMax ?? 0
}

export function runUpgradeLevel(state: GameState, id: RunUpgradeId): number {
  return workshopLevel(state, id) + runPurchasedLevel(state, id)
}

export function effectiveUpgradeLevel(state: GameState, id: RunUpgradeId): number {
  const def = getRunUpgrade(id)
  if (!def) return 0
  const start = Math.min(def.workshopMax, workshopLevel(state, id))
  const run = Math.min(def.sortieMax, runPurchasedLevel(state, id))
  return start + run
}

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
  const room = Math.max(0, sortieCap(id) - start)
  const n = Math.min(Math.max(0, Math.floor(count)), room)
  let total = 0
  for (let i = 0; i < n; i += 1) total += runUpgradeCost(start + i)
  return total
}

export function maxAffordableRunPurchases(state: GameState, id: RunUpgradeId): number {
  let salvage = state.resources.salvage ?? 0
  let bought = runPurchasedLevel(state, id)
  const cap = sortieCap(id)
  let n = 0
  while (bought < cap) {
    const cost = runUpgradeCost(bought)
    if (salvage < cost) break
    salvage -= cost
    bought += 1
    n += 1
  }
  return n
}

export function workshopCost(currentLevel: number): number {
  return Math.floor(12 * Math.pow(1.22, Math.max(0, currentLevel)))
}

export function workshopBulkCost(currentLevel: number, count: number, id?: RunUpgradeId): number {
  const cap = id ? workshopCap(id) : 40
  const n = Math.min(Math.max(0, Math.floor(count)), Math.max(0, cap - currentLevel))
  let total = 0
  for (let i = 0; i < n; i += 1) total += workshopCost(currentLevel + i)
  return total
}

export function maxAffordableWorkshopPurchases(state: GameState, id: RunUpgradeId): number {
  let scrap = state.resources.scrap ?? 0
  let level = workshopLevel(state, id)
  const cap = workshopCap(id)
  let n = 0
  while (level < cap) {
    const cost = workshopCost(level)
    if (scrap < cost) break
    scrap -= cost
    level += 1
    n += 1
  }
  return n
}

export type BuyMode = 1 | 10 | 'max'

export function unlockedBuyModes(state: GameState): BuyMode[] {
  const modes: BuyMode[] = [1]
  if (shopBulkTenUnlocked(state)) modes.push(10)
  if (shopBuyMaxUnlocked(state)) modes.push('max')
  return modes
}

export function runUpgradeRunFactor(runRanks: number, perLevel: number): number {
  const run = Math.max(0, Math.floor(runRanks))
  const opening = Math.min(run, RUN_UPGRADE_OPENING_RANKS)
  const rest = Math.max(0, run - opening)
  return (
    Math.pow(1 + perLevel * RUN_UPGRADE_POWER_SCALE_OPENING, opening) *
    Math.pow(1 + perLevel * RUN_UPGRADE_POWER_SCALE, rest)
  )
}

export function runUpgradeMult(state: GameState, id: RunUpgradeId, perLevel: number): number {
  const start = workshopLevel(state, id)
  const run = runPurchasedLevel(state, id)
  return Math.pow(1 + perLevel, start) * runUpgradeRunFactor(run, perLevel)
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

export function scrapWaveBonus(state: GameState): number {
  const n = effectiveUpgradeLevel(state, 'scrap-wave')
  if (n <= 0) return 0
  return Math.floor(2 * n * Math.pow(1.05, n))
}

export function critChance(state: GameState): number {
  return Math.min(CRIT_CHANCE_CAP, effectiveUpgradeLevel(state, 'crit-chance') * CRIT_CHANCE_PER_LEVEL)
}

export function critFactor(state: GameState): number {
  return BASE_CRIT_FACTOR + effectiveUpgradeLevel(state, 'crit-factor') * CRIT_FACTOR_PER_LEVEL
}

export function armorPenAdd(state: GameState): number {
  return effectiveUpgradeLevel(state, 'armor-pen') * ARMOR_PEN_PER_LEVEL
}

export function shopArmor(state: GameState): number {
  return effectiveUpgradeLevel(state, 'armor') * ARMOR_PER_LEVEL
}

export function shopShieldRegen(state: GameState): number {
  return effectiveUpgradeLevel(state, 'shield-regen') * SHIELD_REGEN_PER_LEVEL
}

export function shopHullRepair(state: GameState): number {
  return effectiveUpgradeLevel(state, 'repair-rate') * HULL_REPAIR_PER_LEVEL
}

export function damageControlTakenMult(state: GameState): number {
  const reduction = Math.min(DAMAGE_CONTROL_CAP, effectiveUpgradeLevel(state, 'damage-control') * DAMAGE_CONTROL_PER_LEVEL)
  return Math.max(0.76, 1 - reduction)
}

export function targetingServosSlewMult(state: GameState): number {
  return 1 + effectiveUpgradeLevel(state, 'targeting-servos') * TARGETING_SERVOS_SLEW_PER_LEVEL
}

export function scrapKillBonus(state: GameState, isBoss = false): number {
  const n = effectiveUpgradeLevel(state, 'scrap-kill')
  if (n <= 0) return 0
  return (isBoss ? 2 : SCRAP_KILL_PER_LEVEL) * n
}

export function fragmentChanceMult(state: GameState): number {
  return 1 + effectiveUpgradeLevel(state, 'fragment-find') * FRAGMENT_FIND_PER_LEVEL
}

export function ashYieldMult(state: GameState): number {
  return runUpgradeMult(state, 'ash-recovery', ASH_RECOVERY_PER_LEVEL)
}

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
        ? Math.pow(1 + per, start + 1) * runUpgradeRunFactor(run, per)
        : Math.pow(1 + per, start) * runUpgradeRunFactor(run + 1, per)
    return { current: `×${current.toFixed(2)}`, next: `×${next.toFixed(2)}` }
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
    case 'scrap-wave': {
      const next = Math.floor(2 * (level + 1) * Math.pow(1.05, level + 1))
      return { current: `+${scrapWaveBonus(state)}`, next: `+${next}` }
    }
    case 'crit-chance':
      return {
        current: `${Math.round(critChance(state) * 100)}%`,
        next: `${Math.min(CRIT_CHANCE_CAP * 100, (level + 1) * 2)}%`,
      }
    case 'crit-factor':
      return {
        current: `×${critFactor(state).toFixed(2)}`,
        next: `×${(BASE_CRIT_FACTOR + (level + 1) * CRIT_FACTOR_PER_LEVEL).toFixed(2)}`,
      }
    case 'armor-pen':
      return { current: `+${armorPenAdd(state).toFixed(2)}`, next: `+${((level + 1) * ARMOR_PEN_PER_LEVEL).toFixed(2)}` }
    case 'targeting-servos':
      return {
        current: `×${targetingServosSlewMult(state).toFixed(2)} slew`,
        next: `×${(1 + (level + 1) * TARGETING_SERVOS_SLEW_PER_LEVEL).toFixed(2)} slew`,
      }
    case 'shield-regen':
      return {
        current: `+${(shopShieldRegen(state) * 100).toFixed(1)}%/s`,
        next: `+${((level + 1) * SHIELD_REGEN_PER_LEVEL * 100).toFixed(1)}%/s`,
      }
    case 'armor':
      return { current: `+${shopArmor(state).toFixed(1)}`, next: `+${((level + 1) * ARMOR_PER_LEVEL).toFixed(1)}` }
    case 'repair-rate':
      return {
        current: `+${(shopHullRepair(state) * 100).toFixed(1)}%/s`,
        next: `+${((level + 1) * HULL_REPAIR_PER_LEVEL * 100).toFixed(1)}%/s`,
      }
    case 'damage-control':
      return {
        current: `−${Math.round((1 - damageControlTakenMult(state)) * 100)}% taken`,
        next: `−${Math.round(Math.min(DAMAGE_CONTROL_CAP, (level + 1) * DAMAGE_CONTROL_PER_LEVEL) * 100)}% taken`,
      }
    case 'scrap-kill':
      return { current: `+${scrapKillBonus(state).toFixed(1)}`, next: `+${((level + 1) * SCRAP_KILL_PER_LEVEL).toFixed(1)}` }
    case 'fragment-find':
      return { current: `×${fragmentChanceMult(state).toFixed(2)}`, next: `×${(1 + (level + 1) * FRAGMENT_FIND_PER_LEVEL).toFixed(2)}` }
    case 'ash-recovery':
      return fmt(ASH_RECOVERY_PER_LEVEL)
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

export function runUpgradeEffectLine(id: RunUpgradeId): string {
  switch (id) {
    case 'weapon-power':
      return `Weapon-Core output ×${(1 + WORKSHOP_WEAPON_POWER_PER_LEVEL).toFixed(2)} per rank`
    case 'cycle-rate':
      return `Cycle rate ×${(1 + WORKSHOP_CYCLE_RATE_PER_LEVEL).toFixed(2)} per rank`
    case 'hull':
      return `Hull ×${(1 + WORKSHOP_HULL_PER_LEVEL).toFixed(2)} per rank`
    case 'shield':
      return `Shield ×${(1 + WORKSHOP_SHIELD_PER_LEVEL).toFixed(2)} per rank`
    case 'salvage-kill':
      return `Salvage/kill ×${(1 + WORKSHOP_SALVAGE_KILL_PER_LEVEL).toFixed(2)} per rank`
    case 'salvage-wave':
      return 'Secured-Wave Salvage +4 per rank × 1.06^rank'
    case 'scrap-wave':
      return 'Secured-Wave Scrap +2 per rank × 1.05^rank'
    case 'crit-chance':
      return `Crit chance +2% per rank (cap ${Math.round(CRIT_CHANCE_CAP * 100)}%)`
    case 'crit-factor':
      return `Crit factor +${CRIT_FACTOR_PER_LEVEL.toFixed(2)} per rank (base ${BASE_CRIT_FACTOR}×)`
    case 'armor-pen':
      return 'Armor pen +0.05 per rank'
    case 'targeting-servos':
      return `Slew +${Math.round(TARGETING_SERVOS_SLEW_PER_LEVEL * 100)}% per rank`
    case 'shield-regen':
      return 'Shield regen +0.4%/s per rank'
    case 'armor':
      return 'Armor +0.45 per rank'
    case 'repair-rate':
      return 'In-combat Hull repair +0.35%/s per rank'
    case 'damage-control':
      return `Damage taken −1.2% per rank (cap ${Math.round(DAMAGE_CONTROL_CAP * 100)}%)`
    case 'scrap-kill':
      return 'Scrap/kill +0.35 per rank'
    case 'fragment-find':
      return 'Fragment chance +6% per rank'
    case 'ash-recovery':
      return 'Ash recovery ×1.08 per rank'
  }
}

export function shopEconomyRoi(state: GameState, id: RunUpgradeId): string | null {
  if (!shopReadoutUnlocked(state)) return null
  if (
    id !== 'salvage-kill' &&
    id !== 'salvage-wave' &&
    id !== 'scrap-kill' &&
    id !== 'scrap-wave' &&
    id !== 'fragment-find' &&
    id !== 'ash-recovery'
  ) {
    return null
  }
  const preview = runUpgradePreview(state, id)
  return `ROI ${preview.current} → ${preview.next}`
}

export function visibleRunUpgrades(state: GameState, category?: RunUpgradeCategory): RunUpgradeDef[] {
  const tutorial = tutorialSortieShopActive(state) && !state.combat.docked
  return RUN_UPGRADES.filter((def) => {
    if (tutorial) return TUTORIAL_SORTIE_UPGRADE_IDS.includes(def.id)
    if (category && def.category !== category) return false
    return isUpgradePermanentlyKnown(state, def.id)
  })
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

/** After a Sortie, temporary Salvage upgrades clear. Physical Core Levels persist. */
export function resetRunCoreLevels(state: GameState): void {
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
 * Future Reclaim Routing / Reconstruction Accelerator extension point.
 * Not a player-facing combat-speed multiplier. Time Compression is canonical speed.
 */
export function reclaimSpeed(_state: GameState): number {
  return 1
}
