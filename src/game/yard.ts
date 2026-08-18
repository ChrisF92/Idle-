/** Yard Grid — USI Bases analogue. Buildings persist; bonuses arm on Rebuild. */

import type {
  GameState,
  YardArmId,
  YardBuildingId,
  YardCell,
  YardGoodId,
  YardState,
} from './types'
import { careerHighestSector } from './progression'
import { processIndustrySpeedMult } from './process'
import { noteSystemAction } from './playtest'

export const YARD_START_SIZE = 3
export const YARD_EXPAND_SECTOR = 14
export const YARD_EXPANDED_SIZE = 4
export const YARD_EXPAND_SECTOR_2 = 27
export const YARD_EXPAND_SECTOR_3 = 40
export const YARD_EXPAND_SECTOR_4 = 55
export const YARD_MAX_SIZE = 7
export const YARD_ARM_MAX = 20
export const YARD_STARTER_ORE = 8

export interface YardBuildingDef {
  id: YardBuildingId
  name: string
  blurb: string
  produces: YardGoodId
  rate: number
  cost: Partial<Record<YardGoodId, number>>
}

export interface YardArmDef {
  id: YardArmId
  name: string
  blurb: string
  costIngots: number
  bonus: number
}

export const YARD_GOOD_LABELS: Record<YardGoodId, string> = {
  ore: 'Ore',
  flux: 'Flux',
  ingot: 'Ingot',
}

export const YARD_BUILDINGS: YardBuildingDef[] = [
  {
    id: 'slag-heap',
    name: 'Slag Heap',
    blurb: 'Piles Choir wreck into Ore.',
    produces: 'ore',
    rate: 0.2,
    cost: {},
  },
  {
    id: 'flux-still',
    name: 'Flux Still',
    blurb: 'Draws Flux from slag vapour.',
    produces: 'flux',
    rate: 0.1,
    cost: { ore: 20 },
  },
  {
    id: 'ingot-press',
    name: 'Ingot Press',
    blurb: 'Presses Yard Ingots for the next Rebuild.',
    produces: 'ingot',
    rate: 0.05,
    cost: { ore: 12, flux: 8 },
  },
  {
    id: 'choir-sieve',
    name: 'Choir Sieve',
    blurb: 'Sifts extra Flux from wreck vapour.',
    produces: 'flux',
    rate: 0.08,
    cost: { ore: 28, flux: 6 },
  },
]

export const YARD_ARMS: YardArmDef[] = [
  { id: 'damage', name: 'Strike Arm', blurb: 'Sortie damage next Rebuild.', costIngots: 12, bonus: 0.03 },
  { id: 'shield', name: 'Ward Arm', blurb: 'Max shield next Rebuild.', costIngots: 12, bonus: 0.03 },
  { id: 'salvage', name: 'Yield Arm', blurb: 'Salvage from kills next Rebuild.', costIngots: 10, bonus: 0.05 },
  { id: 'network', name: 'Loom Arm', blurb: 'Network fill next Rebuild.', costIngots: 10, bonus: 0.04 },
]

export function createEmptyYardState(): YardState {
  return {
    cells: emptyCells(YARD_START_SIZE),
    goods: { ore: YARD_STARTER_ORE, flux: 0, ingot: 0 },
    pending: { damage: 0, shield: 0, salvage: 0, network: 0 },
    armed: { damage: 0, shield: 0, salvage: 0, network: 0 },
  }
}

function emptyCells(size: number): YardCell[] {
  return Array.from({ length: size * size }, () => ({ buildingId: null }))
}

export function getYardBuilding(id: string): YardBuildingDef | undefined {
  return YARD_BUILDINGS.find((b) => b.id === id)
}

export function getYardArm(id: string): YardArmDef | undefined {
  return YARD_ARMS.find((a) => a.id === id)
}

export function isYardUnlocked(state: GameState): boolean {
  return (state.prestige.prestigeCount ?? 0) >= 1
}

export function yardGridSize(state: GameState): number {
  const ever = careerHighestSector(state)
  if (ever >= YARD_EXPAND_SECTOR_4) return YARD_MAX_SIZE
  if (ever >= YARD_EXPAND_SECTOR_3) return 6
  if (ever >= YARD_EXPAND_SECTOR_2) return 5
  if (ever >= YARD_EXPAND_SECTOR) return YARD_EXPANDED_SIZE
  return YARD_START_SIZE
}

export function ensureYardGrid(state: GameState): void {
  if (!state.yard) state.yard = createEmptyYardState()
  const size = yardGridSize(state)
  const need = size * size
  if (state.yard.cells.length < need) {
    const extra = emptyCells(size).slice(state.yard.cells.length)
    state.yard.cells = [...state.yard.cells, ...extra]
  }
}

export function yardGood(state: GameState, id: YardGoodId): number {
  return Math.max(0, state.yard?.goods[id] ?? 0)
}

export function yardPending(state: GameState, id: YardArmId): number {
  return Math.max(0, Math.floor(state.yard?.pending[id] ?? 0))
}

export function yardArmed(state: GameState, id: YardArmId): number {
  return Math.max(0, Math.floor(state.yard?.armed[id] ?? 0))
}

function canPayGoods(state: GameState, cost: Partial<Record<YardGoodId, number>>): boolean {
  for (const [id, n] of Object.entries(cost)) {
    if ((n ?? 0) > yardGood(state, id as YardGoodId)) return false
  }
  return true
}

function payGoods(state: GameState, cost: Partial<Record<YardGoodId, number>>): void {
  for (const [id, n] of Object.entries(cost)) {
    if (!n) continue
    const key = id as YardGoodId
    state.yard.goods[key] = Math.max(0, yardGood(state, key) - n)
  }
}

export function placeYardBuilding(
  state: GameState,
  index: number,
  buildingId: YardBuildingId,
): GameState {
  if (!isYardUnlocked(state)) return state
  const def = getYardBuilding(buildingId)
  if (!def) return state
  const next = structuredClone(state)
  ensureYardGrid(next)
  const cell = next.yard.cells[index]
  if (!cell || cell.buildingId) return state
  if (!canPayGoods(next, def.cost)) return state
  payGoods(next, def.cost)
  cell.buildingId = buildingId
  noteSystemAction(next, 'yard')
  return next
}

export function clearYardBuilding(state: GameState, index: number): GameState {
  if (!isYardUnlocked(state)) return state
  const next = structuredClone(state)
  ensureYardGrid(next)
  const cell = next.yard.cells[index]
  if (!cell?.buildingId) return state
  cell.buildingId = null
  return next
}

export function yardArmCost(state: GameState, id: YardArmId): number {
  const def = getYardArm(id)
  if (!def) return 999
  const rank = yardPending(state, id) + yardArmed(state, id)
  return Math.ceil(def.costIngots * Math.pow(1.25, rank))
}

export function canBuyYardArm(
  state: GameState,
  id: YardArmId,
): { ok: boolean; reason?: string } {
  if (!isYardUnlocked(state)) return { ok: false, reason: 'Rebuild once' }
  const def = getYardArm(id)
  if (!def) return { ok: false, reason: 'Unknown' }
  const total = yardPending(state, id) + yardArmed(state, id)
  if (total >= YARD_ARM_MAX) return { ok: false, reason: 'Maxed' }
  const cost = yardArmCost(state, id)
  if (yardGood(state, 'ingot') < cost) return { ok: false, reason: `Need ${cost} Ingots` }
  return { ok: true }
}

export function buyYardArm(state: GameState, id: YardArmId): GameState {
  if (!canBuyYardArm(state, id).ok) return state
  const next = structuredClone(state)
  if (!next.yard) next.yard = createEmptyYardState()
  const cost = yardArmCost(next, id)
  next.yard.goods.ingot = yardGood(next, 'ingot') - cost
  next.yard.pending[id] = yardPending(next, id) + 1
  return next
}

/** Move pending ranks onto the current run. Buildings and goods stay. */
export function armYardOnRebuild(yard: YardState): YardState {
  const next: YardState = {
    cells: yard.cells.map((c) => ({ buildingId: c.buildingId })),
    goods: { ...yard.goods },
    pending: { damage: 0, shield: 0, salvage: 0, network: 0 },
    armed: { ...yard.armed },
  }
  for (const id of Object.keys(yard.pending) as YardArmId[]) {
    next.armed[id] = (next.armed[id] ?? 0) + (yard.pending[id] ?? 0)
  }
  return next
}

export function tickYard(state: GameState, dtSeconds: number): void {
  if (!isYardUnlocked(state)) return
  if (!state.yard) state.yard = createEmptyYardState()
  ensureYardGrid(state)
  for (const cell of state.yard.cells) {
    if (!cell.buildingId) continue
    const def = getYardBuilding(cell.buildingId)
    if (!def) continue
    state.yard.goods[def.produces] = yardGood(state, def.produces) + def.rate * dtSeconds * processIndustrySpeedMult(state)
  }
}

export function yardDamageMult(state: GameState): number {
  const def = getYardArm('damage')
  return 1 + yardArmed(state, 'damage') * (def?.bonus ?? 0)
}

export function yardShieldMult(state: GameState): number {
  const def = getYardArm('shield')
  return 1 + yardArmed(state, 'shield') * (def?.bonus ?? 0)
}

export function yardSalvageMult(state: GameState): number {
  const def = getYardArm('salvage')
  return 1 + yardArmed(state, 'salvage') * (def?.bonus ?? 0)
}

export function yardNetworkMult(state: GameState): number {
  const def = getYardArm('network')
  return 1 + yardArmed(state, 'network') * (def?.bonus ?? 0)
}

export function yardPendingSummary(state: GameState): string {
  const bits = YARD_ARMS.filter((a) => yardPending(state, a.id) > 0).map(
    (a) => `${a.name} +${yardPending(state, a.id)}`,
  )
  return bits.length > 0 ? bits.join(' · ') : 'Nothing queued'
}
