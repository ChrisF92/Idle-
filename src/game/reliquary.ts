/** Relics — GDD §§25–31. Typed sockets on Cores, authored I–III tiers, Foundry upgrades. */

import type { GameState, RelicSocketClass, ReliquaryColor, ReliquaryState } from './types'
import { getModule, moduleMasteryRank } from './catalog'
import { careerBestWave, careerHighestSector } from './progression'
import { bandsClearedForWave, meetsWave } from './waves'
import { protocolBonusMult, protocolMutes } from './protocols'
import { hiveResearchUnlocksReliquary } from './hiveResearch'
import { noteSystemAction } from './playtest'
import { noteFrontierIntervention } from './frontier'
import { ACT1_CADENCE } from './cadence'

export interface ShardDef {
  id: string
  name: string
  color: ReliquaryColor
  blurb: string
  /** Extra career gate beyond the colour slot. */
  requiresSectorEver?: number
  socket?: RelicSocketClass
  tier?: 1 | 2 | 3
  upgradesTo?: string
  /** II / III are Foundry-upgraded, not wreck drops. */
  craftOnly?: boolean
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

export const RELIQUARY_UNLOCK_SECTOR = ACT1_CADENCE.reliquary
/** Extra copies of an inserted shard to fill leftover resonance. Unused by Core Relics. */
export const RELIQUARY_RESONANCE_NEED = 12
export const RELIQUARY_DROP_CHANCE = 0.1
export const RELIQUARY_BOSS_DROP_CHANCE = 0.35
/** GDD §26: Universal socket once Core Mastery is meaningful. Cap is 10. */
export const RELIC_UNIVERSAL_MASTERY = 5
export const RELIC_SOCKET_LABELS: Record<RelicSocketClass, string> = {
  power: 'Power',
  shield: 'Shield',
  industrial: 'Industrial',
  universal: 'Universal',
}

export const RELIQUARY_SLOTS: ReliquarySlotDef[] = [
  { color: 'red', name: 'Red', requiresSectorEver: bandsClearedForWave(ACT1_CADENCE.reliquary) },
  { color: 'orange', name: 'Orange', requiresSectorEver: bandsClearedForWave(ACT1_CADENCE.reliquary) },
  { color: 'pink', name: 'Pink', requiresSectorEver: 26 },
  { color: 'blue', name: 'Blue', requiresSectorEver: 40 },
  { color: 'green', name: 'Green', requiresSectorEver: 58 },
]

export const SHARDS: ShardDef[] = [
  {
    id: 'battle-chip',
    name: 'Capacitor Shard I',
    color: 'red',
    blurb: 'Choir-cut damage lattice.',
    socket: 'power',
    tier: 1,
    upgradesTo: 'battle-chip-ii',
    damage: 0.08,
  },
  {
    id: 'battle-chip-ii',
    name: 'Capacitor Shard II',
    color: 'red',
    blurb: 'Tuned capacitor. Foundry upgrade.',
    socket: 'power',
    tier: 2,
    upgradesTo: 'battle-chip-iii',
    craftOnly: true,
    damage: 0.12,
  },
  {
    id: 'battle-chip-iii',
    name: 'Capacitor Shard III',
    color: 'red',
    blurb: 'Overdrawn capacitor. Damage ×1.18.',
    socket: 'power',
    tier: 3,
    craftOnly: true,
    damage: 0.18,
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
    name: 'Salvage Matrix I',
    color: 'orange',
    blurb: 'Marks wrecks for extra Salvage.',
    socket: 'industrial',
    tier: 1,
    upgradesTo: 'salvage-chip-ii',
    salvage: 0.1,
  },
  {
    id: 'salvage-chip-ii',
    name: 'Salvage Matrix II',
    color: 'orange',
    blurb: 'Kills from this Hive drop more Salvage. Foundry upgrade.',
    socket: 'industrial',
    tier: 2,
    upgradesTo: 'salvage-chip-iii',
    craftOnly: true,
    salvage: 0.15,
  },
  {
    id: 'salvage-chip-iii',
    name: 'Salvage Matrix III',
    color: 'orange',
    blurb: 'Heavy wreck marks.',
    socket: 'industrial',
    tier: 3,
    craftOnly: true,
    salvage: 0.22,
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
    name: 'Aegis Plate I',
    color: 'orange',
    blurb: 'Hardens the shield envelope.',
    socket: 'shield',
    tier: 1,
    upgradesTo: 'plate-chip-ii',
    shield: 0.08,
  },
  {
    id: 'plate-chip-ii',
    name: 'Aegis Plate II',
    color: 'orange',
    blurb: 'Layered aegis. Foundry upgrade.',
    socket: 'shield',
    tier: 2,
    upgradesTo: 'plate-chip-iii',
    craftOnly: true,
    shield: 0.12,
  },
  {
    id: 'plate-chip-iii',
    name: 'Aegis Plate III',
    color: 'orange',
    blurb: 'Full-face aegis.',
    socket: 'shield',
    tier: 3,
    craftOnly: true,
    shield: 0.18,
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
  return { owned: {}, slots: {}, coreFits: {} }
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

export function isRelicsUnlocked(state: GameState): boolean {
  return meetsWave(state, RELIQUARY_UNLOCK_SECTOR)
}

export function hydrateCoreFits(raw: unknown): Record<string, Array<string | null>> {
  const out: Record<string, Array<string | null>> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [moduleId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.length > 0) {
      out[moduleId] = [value]
      continue
    }
    if (Array.isArray(value)) {
      out[moduleId] = value.map((id) => (typeof id === 'string' && id.length > 0 ? id : null))
    }
  }
  return out
}

export function relicSocketClass(def: ShardDef): RelicSocketClass {
  if (def.socket) return def.socket
  if ((def.shield ?? 0) > 0 && (def.damage ?? 0) <= 0) return 'shield'
  if (def.color === 'red') return 'power'
  return 'industrial'
}

export function relicFamilyId(id: string): string {
  return id.replace(/-ii$|-iii$/, '')
}

export function relicTier(def: ShardDef): 1 | 2 | 3 {
  return def.tier ?? 1
}

export function corePrimarySocket(moduleId: string): RelicSocketClass {
  const role = getModule(moduleId)?.role
  if (role === 'defense') return 'shield'
  if (role === 'utility') return 'industrial'
  return 'power'
}

export function coreSocketLayout(state: GameState, moduleId: string): RelicSocketClass[] {
  if (!isRelicsUnlocked(state)) return []
  if (!state.shipyard.modules.includes(moduleId)) return []
  const sockets: RelicSocketClass[] = [corePrimarySocket(moduleId)]
  const mastery = moduleMasteryRank(state, moduleId)
  if (mastery >= 20) {
    const extra = corePrimarySocket(moduleId) === 'power' ? 'industrial' : 'power'
    if (!sockets.includes(extra)) sockets.push(extra)
  }
  if (mastery >= RELIC_UNIVERSAL_MASTERY || meetsWave(state, ACT1_CADENCE.mastery)) {
    sockets.push('universal')
  }
  return sockets
}

export function relicSocketCount(state: GameState, moduleId: string): number {
  return coreSocketLayout(state, moduleId).length
}

export function relicFitsSocket(relic: RelicSocketClass, socket: RelicSocketClass): boolean {
  if (socket === 'universal' || relic === 'universal') return true
  return relic === socket
}

export function coreSocketRelics(state: GameState, moduleId: string): Array<string | null> {
  const raw = state.reliquary?.coreFits?.[moduleId]
  if (Array.isArray(raw)) return [...raw]
  return []
}

export function fittedRelicIds(state: GameState): string[] {
  const ids: string[] = []
  for (const slots of Object.values(state.reliquary?.coreFits ?? {})) {
    if (!Array.isArray(slots)) continue
    for (const id of slots) if (id) ids.push(id)
  }
  return ids
}

export function coreRelicId(state: GameState, moduleId: string): string | null {
  const id = coreSocketRelics(state, moduleId).find((slot) => typeof slot === 'string' && slot.length > 0)
  return id ?? null
}

function padCoreSockets(slots: Array<string | null>, count: number): Array<string | null> {
  const next = slots.slice(0, Math.max(slots.length, count))
  while (next.length < count) next.push(null)
  return next
}

function takeOwned(state: GameState, relicId: string, qty = 1): void {
  const have = shardOwned(state, relicId) - qty
  if (have <= 0) delete state.reliquary.owned[relicId]
  else state.reliquary.owned[relicId] = have
}

function giveOwned(state: GameState, relicId: string, qty = 1): void {
  state.reliquary.owned[relicId] = shardOwned(state, relicId) + qty
}

export function equipRelicOnCore(
  state: GameState,
  moduleId: string,
  relicId: string,
  socketIndex?: number,
): GameState {
  if (!state.combat.docked) return state
  const def = getShard(relicId)
  if (!def) return state
  const layout = coreSocketLayout(state, moduleId)
  if (layout.length < 1) return state
  if (shardOwned(state, relicId) < 1) return state
  const relicClass = relicSocketClass(def)
  const current = padCoreSockets(coreSocketRelics(state, moduleId), layout.length)
  const family = relicFamilyId(relicId)
  const occupiedFamily = current.some(
    (id) => id && relicFamilyId(id) === family,
  )
  let index = socketIndex
  if (index == null) {
    index = current.findIndex((id, i) => !id && relicFitsSocket(relicClass, layout[i]!))
  }
  if (index < 0 || index >= layout.length) return state
  const socket = layout[index]
  if (!socket || !relicFitsSocket(relicClass, socket)) return state
  const previous = current[index]
  if (occupiedFamily && relicFamilyId(previous ?? '') !== family) return state
  const next = structuredClone(state)
  if (!next.reliquary) next.reliquary = createEmptyReliquaryState()
  if (!next.reliquary.coreFits) next.reliquary.coreFits = {}
  const slots = padCoreSockets(coreSocketRelics(next, moduleId), layout.length)
  if (previous) giveOwned(next, previous)
  takeOwned(next, relicId)
  slots[index] = relicId
  next.reliquary.coreFits[moduleId] = slots
  noteSystemAction(next, 'reliquary')
  return next
}

export function removeRelicFromCore(
  state: GameState,
  moduleId: string,
  socketIndex?: number,
): GameState {
  if (!state.combat.docked) return state
  const slots = coreSocketRelics(state, moduleId)
  let index = socketIndex
  if (index == null) {
    index = -1
    for (let i = slots.length - 1; i >= 0; i -= 1) {
      if (slots[i]) {
        index = i
        break
      }
    }
  }
  const fitted = index >= 0 ? slots[index] : null
  if (!fitted) return state
  const next = structuredClone(state)
  if (!next.reliquary) next.reliquary = createEmptyReliquaryState()
  if (!next.reliquary.coreFits) next.reliquary.coreFits = {}
  const copy = [...coreSocketRelics(next, moduleId)]
  while (copy.length <= index) copy.push(null)
  copy[index] = null
  giveOwned(next, fitted)
  next.reliquary.coreFits[moduleId] = copy
  return next
}

export function relicUpgradeCost(nextTier: 2 | 3): { recipeId: string; amount: number } {
  return { recipeId: 'slag-ingot', amount: nextTier === 2 ? 4 : 10 }
}

export function canUpgradeRelic(
  state: GameState,
  relicId: string,
): { ok: boolean; reason?: string; nextId?: string; cost?: { recipeId: string; amount: number } } {
  const def = getShard(relicId)
  if (!def?.upgradesTo) return { ok: false, reason: 'No further tier' }
  const nextDef = getShard(def.upgradesTo)
  if (!nextDef) return { ok: false, reason: 'Unknown' }
  if (!state.combat.docked) return { ok: false, reason: 'Dock first' }
  const spare = shardOwned(state, relicId)
  if (spare < 1) return { ok: false, reason: 'Need a spare Relic' }
  const fittedCount = fittedRelicIds(state).filter((id) => id === relicId).length
  if (spare + fittedCount < 2) return { ok: false, reason: 'Need a spare Relic' }
  const cost = relicUpgradeCost(relicTier(nextDef) === 3 ? 3 : 2)
  const have = Math.max(0, Math.floor(Number(state.foundry?.materials?.[cost.recipeId] ?? 0) || 0))
  if (have < cost.amount) return { ok: false, reason: `Need ${cost.amount} Slag Ingots` }
  return { ok: true, nextId: def.upgradesTo, cost }
}

export function upgradeRelic(state: GameState, relicId: string): GameState {
  const check = canUpgradeRelic(state, relicId)
  if (!check.ok || !check.nextId || !check.cost) return state
  const next = structuredClone(state)
  if (!next.reliquary) next.reliquary = createEmptyReliquaryState()
  if (!next.reliquary.coreFits) next.reliquary.coreFits = {}
  if (!next.foundry.materials) next.foundry.materials = {}
  takeOwned(next, relicId)
  next.foundry.materials[check.cost.recipeId] = Math.max(
    0,
    Math.floor(Number(next.foundry.materials[check.cost.recipeId] ?? 0) || 0) - check.cost.amount,
  )
  let convertedFit = false
  for (const sockets of Object.values(next.reliquary.coreFits)) {
    if (!Array.isArray(sockets)) continue
    const idx = sockets.findIndex((id) => id === relicId)
    if (idx >= 0) {
      sockets[idx] = check.nextId
      convertedFit = true
      break
    }
  }
  if (!convertedFit) {
    takeOwned(next, relicId)
    giveOwned(next, check.nextId)
  }
  noteSystemAction(next, 'foundry')
  return next
}

/** Extra copies of the inserted shard, 0..1. Leftover colour-slot math. */
export function shardResonance(state: GameState, id: string): number {
  const def = getShard(id)
  if (!def) return 0
  const fittedSomewhere =
    fittedRelicIds(state).includes(id) || fittedShardId(state, def.color) === id
  if (!fittedSomewhere) return 0
  const extra = Math.max(0, shardOwned(state, id) - 1)
  return Math.min(1, extra / RELIQUARY_RESONANCE_NEED)
}

/** Core Relics use authored values. Hoarded copies do not scale the bonus. */
export function shardEffectScale(state: GameState, id: string): number {
  if (!getShard(id)) return 0
  if (!fittedRelicIds(state).includes(id) && fittedShardId(state, getShard(id)!.color) !== id) {
    return 0
  }
  return 1
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
  for (const id of fittedRelicIds(state)) {
    const def = getShard(id)
    if (!def) continue
    const scale = power
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
    if (s.craftOnly) return false
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
  const bits: string[] = [`${RELIC_SOCKET_LABELS[relicSocketClass(def)]} · T${relicTier(def)}`]
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
  if (careerBestWave(state) < RELIQUARY_UNLOCK_SECTOR) return 0
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
  if (careerBestWave(state) < RELIQUARY_UNLOCK_SECTOR) return null
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
  noteFrontierIntervention(next, 'reliquary', { n: def.name })
  return next
}

export function removeShard(state: GameState, color: ReliquaryColor): GameState {
  if (!fittedShardId(state, color)) return state
  const next = structuredClone(state)
  if (!next.reliquary) next.reliquary = createEmptyReliquaryState()
  next.reliquary.slots[color] = null
  return next
}
