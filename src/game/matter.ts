/** Canonical Act 1 Matter shop, Time Compression unlocks, and purchased-node effects. */

import type { GameState } from './types'

function shopRank(ranks: Record<string, number> | undefined, id: string): number {
  return Math.max(0, ranks?.[id] ?? 0)
}

export type MatterShopCategory =
  | 'offensive'
  | 'defensive'
  | 'industrial'
  | 'foundation'
  | 'temporal'

export const MATTER_SHOP_CATEGORIES: { id: MatterShopCategory; name: string }[] = [
  { id: 'offensive', name: 'Offensive' },
  { id: 'defensive', name: 'Defensive' },
  { id: 'industrial', name: 'Industrial' },
  { id: 'foundation', name: 'Foundation' },
  { id: 'temporal', name: 'Temporal' },
]

export type MatterNodeId =
  | 'weapon-calibration'
  | 'traverse-actuators'
  | 'structural-memory'
  | 'field-memory'
  | 'recovery-charter'
  | 'foundry-throughput'
  | 'worker-racks'
  | 'reconstitution-cache'
  | 'sortie-provisioning'
  | 'time-compression-1'
  | 'time-compression-2'
  | 'time-compression-3'

export interface MatterShopDef {
  id: MatterNodeId
  name: string
  description: string
  category: MatterShopCategory
  maxRank: number
  /** Explicit next-rank costs, index 0 = rank 0→1. */
  costs: number[]
  requiresId?: MatterNodeId
  effectLine: (rank: number) => string
}

/**
 * Non-temporal cost seeds (canonical §30.7):
 * - ordinary stat nodes: base 4, ×1.8 per rank → 4, 8, 15, 27, 49
 * - industrial/foundation: base 5, ×1.8 → 5, 9, 17, 31, 56
 * Time Compression: 8 / 35 / 120
 */
const STAT_COSTS = [4, 8, 15, 27, 49]
const INDUSTRY_COSTS = [5, 9, 17, 31, 56]

export const TIME_COMPRESSION_I_COST = 8
export const TIME_COMPRESSION_II_COST = 35
export const TIME_COMPRESSION_III_COST = 120

export const TIME_COMPRESSION_I_SPEED = 1.5
export const TIME_COMPRESSION_II_SPEED = 2
export const TIME_COMPRESSION_III_SPEED = 3

/** +4% weapon-Core output per Weapon Calibration rank. */
export const WEAPON_CALIBRATION_PER_RANK = 0.04
/** +5% weapon-Core slew per Traverse Actuators rank. */
export const TRAVERSE_ACTUATORS_PER_RANK = 0.05
/** +4% max Hull per Structural Memory rank. */
export const STRUCTURAL_MEMORY_PER_RANK = 0.04
/** +4% max Shield per Field Memory rank. */
export const FIELD_MEMORY_PER_RANK = 0.04
/** +6% combat Scrap per Recovery Charter rank. Does not affect Worker Scrap. */
export const RECOVERY_CHARTER_PER_RANK = 0.06
/** +8% Processing and Fabrication speed per Foundry Throughput rank. */
export const FOUNDRY_THROUGHPUT_PER_RANK = 0.08
/** +1 Worker capacity per Worker Racks rank. Does not fabricate the Worker. */
export const WORKER_RACKS_PER_RANK = 1
/** Starting Scrap after Rebuild: 24 per Reconstitution Cache rank. */
export const RECONSTITUTION_SCRAP_PER_RANK = 24
/** Starting Salvage at normal Sortie launch: 8 per Sortie Provisioning rank. */
export const SORTIE_PROVISIONING_PER_RANK = 8

function pctLine(label: string, perRank: number, rank: number, nextRank: number, maxRank: number): string {
  const now = rank <= 0 ? '—' : `+${Math.round(perRank * rank * 100)}%`
  if (rank >= maxRank) return `${label} ${now}`
  const next = `+${Math.round(perRank * nextRank * 100)}%`
  return `${label} ${now} → ${next}`
}

export const MATTER_SHOP: MatterShopDef[] = [
  {
    id: 'weapon-calibration',
    name: 'Weapon Calibration',
    description: 'Modest permanent weapon-Core output. Does not become a global generic multiplier.',
    category: 'offensive',
    maxRank: 5,
    costs: STAT_COSTS,
    effectLine: (rank) => pctLine('Weapon-Core output', WEAPON_CALIBRATION_PER_RANK, rank, rank + 1, 5),
  },
  {
    id: 'traverse-actuators',
    name: 'Traverse Actuators',
    description: 'Permanent weapon-Core Slew. Does not change Doctrine, Acquisition, or Fire Range.',
    category: 'offensive',
    maxRank: 4,
    costs: STAT_COSTS.slice(0, 4),
    effectLine: (rank) => pctLine('Weapon-Core slew', TRAVERSE_ACTUATORS_PER_RANK, rank, rank + 1, 4),
  },
  {
    id: 'structural-memory',
    name: 'Structural Memory',
    description: 'Modest permanent maximum Hull.',
    category: 'defensive',
    maxRank: 5,
    costs: STAT_COSTS,
    effectLine: (rank) => pctLine('Max Hull', STRUCTURAL_MEMORY_PER_RANK, rank, rank + 1, 5),
  },
  {
    id: 'field-memory',
    name: 'Field Memory',
    description: 'Modest permanent maximum Shield.',
    category: 'defensive',
    maxRank: 5,
    costs: STAT_COSTS,
    effectLine: (rank) => pctLine('Max Shield', FIELD_MEMORY_PER_RANK, rank, rank + 1, 5),
  },
  {
    id: 'recovery-charter',
    name: 'Recovery Charter',
    description: 'Combat Scrap only. Does not raise Salvage, Ash, Worker Scrap, or Foundry Scrap.',
    category: 'industrial',
    maxRank: 5,
    costs: INDUSTRY_COSTS,
    effectLine: (rank) => pctLine('Combat Scrap', RECOVERY_CHARTER_PER_RANK, rank, rank + 1, 5),
  },
  {
    id: 'foundry-throughput',
    name: 'Foundry Throughput',
    description: 'Processing and Fabrication speed. Does not speed Research, combat, or Worker stations.',
    category: 'industrial',
    maxRank: 5,
    costs: INDUSTRY_COSTS,
    effectLine: (rank) => pctLine('Foundry speed', FOUNDRY_THROUGHPUT_PER_RANK, rank, rank + 1, 5),
  },
  {
    id: 'worker-racks',
    name: 'Worker Racks',
    description: '+1 Worker Drone capacity per rank. Does not fabricate the Worker.',
    category: 'industrial',
    maxRank: 4,
    costs: INDUSTRY_COSTS.slice(0, 4),
    effectLine: (rank) => {
      const now = rank <= 0 ? '—' : `+${rank} cap`
      if (rank >= 4) return `Worker capacity ${now}`
      return `Worker capacity ${now} → +${rank + 1} cap`
    },
  },
  {
    id: 'reconstitution-cache',
    name: 'Reconstitution Cache',
    description: 'Small starting Scrap after each Rebuild. Not counted as cycle Scrap generated.',
    category: 'foundation',
    maxRank: 5,
    costs: INDUSTRY_COSTS,
    effectLine: (rank) => {
      const now = rank <= 0 ? '—' : `+${RECONSTITUTION_SCRAP_PER_RANK * rank} Scrap`
      if (rank >= 5) return `Rebuild start ${now}`
      return `Rebuild start ${now} → +${RECONSTITUTION_SCRAP_PER_RANK * (rank + 1)} Scrap`
    },
  },
  {
    id: 'sortie-provisioning',
    name: 'Sortie Provisioning',
    description: 'Small starting Salvage at each normal Sortie launch. Not combat Salvage. Challenges suppress it.',
    category: 'foundation',
    maxRank: 5,
    costs: INDUSTRY_COSTS,
    effectLine: (rank) => {
      const now = rank <= 0 ? '—' : `+${SORTIE_PROVISIONING_PER_RANK * rank} Salvage`
      if (rank >= 5) return `Launch start ${now}`
      return `Launch start ${now} → +${SORTIE_PROVISIONING_PER_RANK * (rank + 1)} Salvage`
    },
  },
  {
    id: 'time-compression-1',
    name: 'Time Compression I',
    description: 'Unlocks 1.5× combat simulation speed.',
    category: 'temporal',
    maxRank: 1,
    costs: [TIME_COMPRESSION_I_COST],
    effectLine: (rank) => (rank >= 1 ? 'Unlocks 1.5×' : 'Unlocks 1.5× combat speed'),
  },
  {
    id: 'time-compression-2',
    name: 'Time Compression II',
    description: 'Unlocks 2× combat simulation speed.',
    category: 'temporal',
    maxRank: 1,
    costs: [TIME_COMPRESSION_II_COST],
    requiresId: 'time-compression-1',
    effectLine: (rank) => (rank >= 1 ? 'Unlocks 2×' : 'Requires Time Compression I · Unlocks 2×'),
  },
  {
    id: 'time-compression-3',
    name: 'Time Compression III',
    description: 'Unlocks 3× combat simulation speed.',
    category: 'temporal',
    maxRank: 1,
    costs: [TIME_COMPRESSION_III_COST],
    requiresId: 'time-compression-2',
    effectLine: (rank) => (rank >= 1 ? 'Unlocks 3×' : 'Requires Time Compression II · Unlocks 3×'),
  },
]

export function getMatterShopItem(id: string): MatterShopDef | undefined {
  return MATTER_SHOP.find((item) => item.id === id)
}

export function matterShopItemsIn(category: MatterShopCategory): MatterShopDef[] {
  return MATTER_SHOP.filter((item) => item.category === category)
}

export function matterShopRank(state: Pick<GameState, 'prestige'> | { prestige: { matterShop?: Record<string, number> } }, id: MatterNodeId | string): number {
  return shopRank(state.prestige.matterShop, id)
}

export function nextMatterCost(def: MatterShopDef, currentRank: number): number {
  const idx = Math.max(0, Math.floor(currentRank))
  return Math.max(0, Math.floor(def.costs[idx] ?? Infinity))
}

export type MatterBuyCheck =
  | { ok: true; cost: number; nextRank: number; maxRank: number }
  | { ok: false; reason: string; cost?: number; nextRank?: number; maxRank?: number }

export function canBuyMatterShop(state: GameState, itemId: string): MatterBuyCheck {
  const def = getMatterShopItem(itemId)
  if (!def) return { ok: false, reason: 'Unknown item' }
  const current = matterShopRank(state, def.id)
  const maxRank = def.maxRank
  const nextRank = current + 1
  const cost = nextMatterCost(def, current)
  if (current >= maxRank) {
    return { ok: false, reason: 'Max rank', cost, nextRank, maxRank }
  }
  if (def.requiresId && matterShopRank(state, def.requiresId) < 1) {
    const req = getMatterShopItem(def.requiresId)
    return { ok: false, reason: `Requires ${req?.name ?? def.requiresId}`, cost, nextRank, maxRank }
  }
  if ((state.resources.prestigeMatter ?? 0) < cost) {
    return { ok: false, reason: `Need ${cost} Matter`, cost, nextRank, maxRank }
  }
  return { ok: true, cost, nextRank, maxRank }
}

export function matterShopEffectBlurb(def: MatterShopDef, rank: number): string {
  return def.effectLine(rank)
}

function rankOf(state: { prestige?: { matterShop?: Record<string, number> } }, id: MatterNodeId): number {
  return Math.max(0, Math.floor(state.prestige?.matterShop?.[id] ?? 0))
}

export function weaponCalibrationMult(state: Pick<GameState, 'prestige'>): number {
  return 1 + WEAPON_CALIBRATION_PER_RANK * rankOf(state, 'weapon-calibration')
}

export function matterTraverseSlewMult(state: Pick<GameState, 'prestige'>): number {
  return 1 + TRAVERSE_ACTUATORS_PER_RANK * rankOf(state, 'traverse-actuators')
}

export function matterHullMult(state: Pick<GameState, 'prestige'>): number {
  return 1 + STRUCTURAL_MEMORY_PER_RANK * rankOf(state, 'structural-memory')
}

export function matterShieldMult(state: Pick<GameState, 'prestige'>): number {
  return 1 + FIELD_MEMORY_PER_RANK * rankOf(state, 'field-memory')
}

export function combatScrapMatterMult(state: Pick<GameState, 'prestige'>): number {
  return 1 + RECOVERY_CHARTER_PER_RANK * rankOf(state, 'recovery-charter')
}

export function foundryThroughputMult(state: Pick<GameState, 'prestige'>): number {
  return 1 + FOUNDRY_THROUGHPUT_PER_RANK * rankOf(state, 'foundry-throughput')
}

export function matterWorkerCapacityBonus(state: { prestige: { matterShop?: Record<string, number> } }): number {
  return WORKER_RACKS_PER_RANK * rankOf(state, 'worker-racks')
}

export function reconstitutionStartingScrap(state: Pick<GameState, 'prestige'>): number {
  return RECONSTITUTION_SCRAP_PER_RANK * rankOf(state, 'reconstitution-cache')
}

export function sortieProvisioningSalvage(state: Pick<GameState, 'prestige'>): number {
  return SORTIE_PROVISIONING_PER_RANK * rankOf(state, 'sortie-provisioning')
}

export function availableTimeCompressionSpeeds(state: Pick<GameState, 'prestige'>): number[] {
  const speeds = [1]
  if (rankOf(state, 'time-compression-1') >= 1) speeds.push(TIME_COMPRESSION_I_SPEED)
  if (rankOf(state, 'time-compression-2') >= 1) speeds.push(TIME_COMPRESSION_II_SPEED)
  if (rankOf(state, 'time-compression-3') >= 1) speeds.push(TIME_COMPRESSION_III_SPEED)
  return speeds
}

export function selectedTimeCompression(state: Pick<GameState, 'prestige' | 'meta'>): number {
  const avail = availableTimeCompressionSpeeds(state)
  const pref = state.meta?.sortieSpeed
  if (pref != null && avail.includes(pref)) return pref
  return 1
}

export function maxTimeCompressionSpeed(state: Pick<GameState, 'prestige'>): number {
  const speeds = availableTimeCompressionSpeeds(state)
  return speeds[speeds.length - 1] ?? 1
}

export function anyMatterPurchaseOwned(state: Pick<GameState, 'prestige'>): boolean {
  return Object.values(state.prestige?.matterShop ?? {}).some((n) => Math.max(0, Math.floor(n)) > 0)
}
