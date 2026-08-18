/** Reliquary — USI V-Device analogue. Colour slots, shards, resonance. */

import type { GameState, ReliquaryColor, ReliquaryState } from './types'
import { careerHighestSector } from './progression'
import { protocolBonusMult, protocolModifiers, protocolMutes } from './protocols'
import { hiveResearchUnlocksReliquary } from './hiveResearch'
import { noteSystemAction } from './playtest'

export interface ShardDef {
  id: string
  name: string
  color: ReliquaryColor
  blurb: string
  /** Extra career gate beyond the colour slot. */
  requiresSectorEver?: number
  damage?: number
  salvage?: number
  shield?: number
  networkFill?: number
  foundrySpeed?: number
  researchXp?: number
  ash?: number
}

export interface ReliquarySlotDef {
  color: ReliquaryColor
  name: string
  requiresSectorEver: number
}

export const RELIQUARY_UNLOCK_SECTOR = 3
/** Extra copies of an inserted shard to fill resonance. */
export const RELIQUARY_RESONANCE_NEED = 12
export const RELIQUARY_DROP_CHANCE = 0.1
export const RELIQUARY_BOSS_DROP_CHANCE = 0.35

export const RELIQUARY_SLOTS: ReliquarySlotDef[] = [
  { color: 'red', name: 'Red', requiresSectorEver: 3 },
  { color: 'orange', name: 'Orange', requiresSectorEver: 3 },
  { color: 'pink', name: 'Pink', requiresSectorEver: 6 },
  { color: 'blue', name: 'Blue', requiresSectorEver: 19 },
  { color: 'green', name: 'Green', requiresSectorEver: 32 },
]

export const SHARDS: ShardDef[] = [
  {
    id: 'battle-chip',
    name: 'Battle Chip',
    color: 'red',
    blurb: 'Choir-cut damage lattice.',
    damage: 0.08,
  },
  {
    id: 'keel-chip',
    name: 'Keel Chip',
    color: 'red',
    blurb: 'Damage with a little plate. Sector 6.',
    requiresSectorEver: 6,
    damage: 0.06,
    shield: 0.04,
  },
  {
    id: 'pulse-chip',
    name: 'Pulse Chip',
    color: 'red',
    blurb: 'Tunes the fitted weapon Core.',
    damage: 0.05,
    foundrySpeed: 0.04,
  },
  {
    id: 'salvage-chip',
    name: 'Salvage Chip',
    color: 'orange',
    blurb: 'Marks wrecks for the Yield bar.',
    salvage: 0.1,
  },
  {
    id: 'cycle-chip',
    name: 'Cycle Chip',
    color: 'orange',
    blurb: 'Keeps bars turning. Sector 5.',
    requiresSectorEver: 5,
    salvage: 0.06,
    networkFill: 0.06,
  },
  {
    id: 'plate-chip',
    name: 'Plate Chip',
    color: 'orange',
    blurb: 'Hardens the shield envelope.',
    shield: 0.08,
  },
  {
    id: 'compute-chip',
    name: 'Link Chip',
    color: 'pink',
    blurb: 'Network bars fill faster.',
    networkFill: 0.1,
  },
  {
    id: 'spark-chip',
    name: 'Spark Chip',
    color: 'pink',
    blurb: 'A little extra bite. Sector 8.',
    requiresSectorEver: 8,
    damage: 0.07,
  },
  {
    id: 'ward-chip',
    name: 'Ward Chip',
    color: 'pink',
    blurb: 'Second-layer plating.',
    shield: 0.06,
  },
  {
    id: 'flux-chip',
    name: 'Flux Chip',
    color: 'blue',
    blurb: 'Feeds Observation notes. Later sector.',
    researchXp: 0.1,
  },
  {
    id: 'choir-chip',
    name: 'Choir Chip',
    color: 'green',
    blurb: 'Draws extra ash. Later sector.',
    ash: 0.12,
  },
  {
    id: 'loom-chip',
    name: 'Loom Chip',
    color: 'blue',
    blurb: 'Foundry crafts run faster.',
    foundrySpeed: 0.08,
  },
  {
    id: 'hold-chip',
    name: 'Hold Chip',
    color: 'green',
    blurb: 'Marks wrecks for the Hold.',
    salvage: 0.08,
  },
  {
    id: 'overdraw-chip',
    name: 'Overdraw Chip',
    color: 'red',
    blurb: 'Late damage lattice. Sector 12.',
    requiresSectorEver: 12,
    damage: 0.1,
  },
  {
    id: 'assay-chip',
    name: 'Assay Chip',
    color: 'red',
    blurb: 'Foundry pull with a bite. Sector 10.',
    requiresSectorEver: 10,
    damage: 0.05,
    foundrySpeed: 0.06,
  },
  {
    id: 'yield-chip',
    name: 'Yield Chip',
    color: 'orange',
    blurb: 'Heavier wreck marks. Sector 8.',
    requiresSectorEver: 8,
    salvage: 0.12,
  },
  {
    id: 'archive-chip',
    name: 'Archive Chip',
    color: 'pink',
    blurb: 'Observation notes. Sector 14.',
    requiresSectorEver: 14,
    researchXp: 0.08,
  },
  {
    id: 'warp-chip',
    name: 'Warp Chip',
    color: 'blue',
    blurb: 'Echo-side Foundry pull. Sector 22.',
    requiresSectorEver: 22,
    foundrySpeed: 0.1,
    salvage: 0.05,
  },
  {
    id: 'reactor-chip',
    name: 'Reactor Chip',
    color: 'green',
    blurb: 'Choir-ash and a little damage. Sector 32.',
    requiresSectorEver: 32,
    ash: 0.15,
    damage: 0.04,
  },
]

export function createEmptyReliquaryState(): ReliquaryState {
  return { owned: {}, slots: {} }
}

export function getShard(id: string): ShardDef | undefined {
  return SHARDS.find((s) => s.id === id)
}

export function getReliquarySlot(color: ReliquaryColor): ReliquarySlotDef | undefined {
  return RELIQUARY_SLOTS.find((s) => s.color === color)
}

export function isReliquarySlotUnlocked(state: GameState, color: ReliquaryColor): boolean {
  const def = getReliquarySlot(color)
  if (!def) return false
  if (hiveResearchUnlocksReliquary(state, color)) return true
  return careerHighestSector(state) >= def.requiresSectorEver
}

export function shardOwned(state: GameState, id: string): number {
  return Math.max(0, Math.floor(state.reliquary?.owned[id] ?? 0))
}

export function fittedShardId(state: GameState, color: ReliquaryColor): string | null {
  return state.reliquary?.slots[color] ?? null
}

/** Extra copies of the inserted shard, 0..1. */
export function shardResonance(state: GameState, id: string): number {
  const def = getShard(id)
  if (!def) return 0
  if (fittedShardId(state, def.color) !== id) return 0
  const extra = Math.max(0, shardOwned(state, id) - 1)
  return Math.min(1, extra / RELIQUARY_RESONANCE_NEED)
}

/** Inserted shards work at base; resonance doubles them at 100%. Extra copies fill faster if Protocols bend the curve. */
export function shardEffectScale(state: GameState, id: string): number {
  if (!getShard(id)) return 0
  const def = getShard(id)!
  if (fittedShardId(state, def.color) !== id) return 0
  const resonance = shardResonance(state, id)
  const exp = Math.max(0.45, 1 + protocolModifiers(state).reliquaryResonanceExpAdd)
  return 1 + Math.pow(resonance, exp)
}

interface ReliquaryBonuses {
  damage: number
  salvage: number
  shield: number
  networkFill: number
  foundrySpeed: number
  researchXp: number
  ash: number
}

function emptyBonuses(): ReliquaryBonuses {
  return {
    damage: 0,
    salvage: 0,
    shield: 0,
    networkFill: 0,
    foundrySpeed: 0,
    researchXp: 0,
    ash: 0,
  }
}

export function reliquaryBonuses(state: GameState): ReliquaryBonuses {
  const out = emptyBonuses()
  if (!state.reliquary) return out
  if (protocolMutes(state, 'reliquary')) return out
  const power = protocolBonusMult(state, 'reliquary')
  for (const slot of RELIQUARY_SLOTS) {
    const id = fittedShardId(state, slot.color)
    if (!id) continue
    const def = getShard(id)
    if (!def) continue
    const scale = shardEffectScale(state, id) * power
    out.damage += (def.damage ?? 0) * scale
    out.salvage += (def.salvage ?? 0) * scale
    out.shield += (def.shield ?? 0) * scale
    out.networkFill += (def.networkFill ?? 0) * scale
    out.foundrySpeed += (def.foundrySpeed ?? 0) * scale
    out.researchXp += (def.researchXp ?? 0) * scale
    out.ash += (def.ash ?? 0) * scale
  }
  return out
}

export function reliquaryDamageMult(state: GameState): number {
  return 1 + reliquaryBonuses(state).damage
}

export function reliquaryShieldMult(state: GameState): number {
  return 1 + reliquaryBonuses(state).shield
}

export function reliquarySalvageMult(state: GameState): number {
  return 1 + reliquaryBonuses(state).salvage
}

export function reliquaryNetworkMult(state: GameState): number {
  return 1 + reliquaryBonuses(state).networkFill
}

export function reliquaryFoundrySpeedMult(state: GameState): number {
  return 1 + reliquaryBonuses(state).foundrySpeed
}

export function reliquaryResearchXpMult(state: GameState): number {
  return 1 + reliquaryBonuses(state).researchXp
}

export function reliquaryAshMult(state: GameState): number {
  return 1 + reliquaryBonuses(state).ash
}

export function unlockedShardPool(state: GameState): ShardDef[] {
  const ever = careerHighestSector(state)
  return SHARDS.filter((s) => {
    if (!isReliquarySlotUnlocked(state, s.color)) return false
    if ((s.requiresSectorEver ?? 0) > ever) return false
    return true
  })
}

/** Rough combat/idle value for Process Shard Seat. */
export function shardAutoScore(def: ShardDef): number {
  return (
    (def.damage ?? 0) * 1.25 +
    (def.shield ?? 0) +
    (def.salvage ?? 0) +
    (def.networkFill ?? 0) * 0.55 +
    (def.foundrySpeed ?? 0) * 0.5 +
    (def.researchXp ?? 0) * 0.5 +
    (def.ash ?? 0) * 0.4
  )
}

export function shardEffectBlurb(def: ShardDef): string {
  const bits: string[] = []
  if (def.damage) bits.push(`+${Math.round(def.damage * 100)}% damage`)
  if (def.shield) bits.push(`+${Math.round(def.shield * 100)}% shield`)
  if (def.salvage) bits.push(`+${Math.round(def.salvage * 100)}% salvage`)
  if (def.networkFill) bits.push(`+${Math.round(def.networkFill * 100)}% Network fill`)
  if (def.foundrySpeed) bits.push(`+${Math.round(def.foundrySpeed * 100)}% foundry`)
  if (def.researchXp) bits.push(`+${Math.round(def.researchXp * 100)}% research XP`)
  if (def.ash) bits.push(`+${Math.round(def.ash * 100)}% ash`)
  return bits.join(' · ')
}

export function reliquaryDropChance(
  state: GameState,
  isBoss: boolean,
  extraChance = 0,
): number {
  if (careerHighestSector(state) < RELIQUARY_UNLOCK_SECTOR) return 0
  const pool = unlockedShardPool(state)
  if (pool.length === 0) return 0
  const base = isBoss ? RELIQUARY_BOSS_DROP_CHANCE : RELIQUARY_DROP_CHANCE
  return Math.min(0.85, base + extraChance)
}

export function grantShard(state: GameState, id: string, qty = 1): void {
  if (!state.reliquary) state.reliquary = createEmptyReliquaryState()
  if (!getShard(id) || qty <= 0) return
  state.reliquary.owned[id] = shardOwned(state, id) + Math.floor(qty)
}

/** Mutates. `rng` is 0..1 — values below drop chance succeed. */
export function grantReliquaryKillLoot(
  state: GameState,
  isBoss: boolean,
  rng: () => number = Math.random,
  extraChance = 0,
): string | null {
  if (careerHighestSector(state) < RELIQUARY_UNLOCK_SECTOR) return null
  const pool = unlockedShardPool(state)
  if (pool.length === 0) return null
  const chance = reliquaryDropChance(state, isBoss, extraChance)
  if (rng() >= chance) return null
  const pick = pool[Math.floor(rng() * pool.length)]
  if (!pick) return null
  grantShard(state, pick.id, 1)
  return pick.id
}

export function insertShard(state: GameState, shardId: string): GameState {
  const def = getShard(shardId)
  if (!def) return state
  if (!isReliquarySlotUnlocked(state, def.color)) return state
  if ((def.requiresSectorEver ?? 0) > careerHighestSector(state)) return state
  if (shardOwned(state, shardId) < 1) return state
  const next = structuredClone(state)
  if (!next.reliquary) next.reliquary = createEmptyReliquaryState()
  next.reliquary.slots[def.color] = shardId
  noteSystemAction(next, 'reliquary')
  return next
}

export function removeShard(state: GameState, color: ReliquaryColor): GameState {
  if (!fittedShardId(state, color)) return state
  const next = structuredClone(state)
  if (!next.reliquary) next.reliquary = createEmptyReliquaryState()
  next.reliquary.slots[color] = null
  return next
}
