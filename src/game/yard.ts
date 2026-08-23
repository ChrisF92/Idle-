/** Foundry construction — GDD §65. Facilities are fabricated; bonuses apply immediately. */

import type { FacilityId, GameState, YardArmId, YardBuildingId, YardGoodId, YardState } from './types'
import { ACT1_CADENCE } from './cadence'
import { foundryOwnedCount, getFacility } from './foundry'
import { careerBestWave } from './waves'

export const YARD_START_SIZE = 3
export const YARD_EXPANDED_SIZE = 4
export const YARD_MAX_SIZE = 7
export const YARD_ARM_MAX = 20
export const YARD_STARTER_ORE = 8
export const CONSTRUCTION_EFFICIENT = 4
export const CONSTRUCTION_HARD_CAP = 8
export const CONSTRUCTION_SPEED_PER_EFFICIENT = 0.12
export const CONSTRUCTION_SPEED_PER_EXTRA = 0.04

export const YARD_EXPAND_WAVE = ACT1_CADENCE.furnace
export const YARD_EXPAND_WAVE_2 = ACT1_CADENCE.process
export const YARD_EXPAND_WAVE_3 = ACT1_CADENCE.echo
export const YARD_EXPAND_WAVE_4 = ACT1_CADENCE.reinforce
export const YARD_EXPAND_SECTOR = YARD_EXPAND_WAVE
export const YARD_EXPAND_SECTOR_2 = YARD_EXPAND_WAVE_2
export const YARD_EXPAND_SECTOR_3 = YARD_EXPAND_WAVE_3
export const YARD_EXPAND_SECTOR_4 = YARD_EXPAND_WAVE_4

export const YARD_GOOD_LABELS: Record<YardGoodId, string> = {
  ore: 'Ore',
  flux: 'Flux',
  ingot: 'Ingot',
}

export const YARD_BUILDINGS: Array<{
  id: YardBuildingId
  name: string
  blurb: string
  produces: YardGoodId
  rate: number
  cost: Partial<Record<YardGoodId, number>>
}> = []

export const YARD_ARMS: Array<{
  id: YardArmId
  name: string
  blurb: string
  costIngots: number
  bonus: number
}> = []

export function createEmptyYardState(): YardState {
  return {
    cells: [],
    goods: { ore: 0, flux: 0, ingot: 0 },
    pending: {},
    armed: {},
  }
}

export function getYardBuilding(id: string) {
  return YARD_BUILDINGS.find((row) => row.id === id)
}

export function getYardArm(id: string) {
  return YARD_ARMS.find((row) => row.id === id)
}

export function isConstructionUnlocked(state: GameState): boolean {
  if ((state.foundry?.facilities ?? []).length > 0) return true
  if ((state.foundry?.pendingFacilities ?? []).length > 0) return true
  return careerBestWave(state) >= ACT1_CADENCE.foundryAdvanced
}

export function isYardUnlocked(state: GameState): boolean {
  return isConstructionUnlocked(state)
}

export function yardGridSize(_state: GameState): number {
  return 0
}

export function constructionSpeedMult(state: GameState): number {
  const assigned = Math.max(0, Math.floor(Number(state.base?.assignments?.construction ?? 0) || 0))
  const drones = Math.min(CONSTRUCTION_HARD_CAP, assigned)
  const efficient = Math.min(CONSTRUCTION_EFFICIENT, drones)
  const extra = Math.max(0, drones - CONSTRUCTION_EFFICIENT)
  return 1 + efficient * CONSTRUCTION_SPEED_PER_EFFICIENT + extra * CONSTRUCTION_SPEED_PER_EXTRA
}

export function tickYard(_state: GameState, _dtSeconds: number): void {
  // Construction is a Fabrication job. Facilities do not tick a leftover grid.
}

export function yardGood(_state: GameState, _id: YardGoodId): number {
  return 0
}

export function yardArmed(state: GameState, id: string): number {
  return foundryOwnedCount(state, id as FacilityId)
}

export function yardDamageMult(_state: GameState): number {
  return 1
}

export function yardShieldMult(_state: GameState): number {
  return 1
}

export function yardSalvageMult(_state: GameState): number {
  return 1
}

export function yardNetworkMult(_state: GameState): number {
  return 1
}

export function placeYardBuilding(state: GameState, _index: number, _buildingId: YardBuildingId): GameState {
  return state
}

export function clearYardBuilding(state: GameState, _index: number): GameState {
  return state
}

export function buyYardArm(state: GameState, _id: YardArmId): GameState {
  return state
}

export function buyMaxYardArms(state: GameState): GameState {
  return state
}

export function armYardOnRebuild(yard: YardState): YardState {
  return yard
}

export function canBuyYardArm(
  _state: GameState,
  _id: YardArmId,
): { ok: boolean; reason?: string } {
  return { ok: false, reason: 'Construction uses Foundry Fabrication' }
}

export function yardArmCost(_state: GameState, _id: YardArmId): number {
  return Infinity
}

export function yardPending(_state: GameState, _id: YardArmId): number {
  return 0
}

export function yardPendingSummary(state: GameState): string {
  const n = state.foundry?.pendingFacilities?.length ?? 0
  return n > 0 ? `${n} facilities waiting to apply` : 'No facilities pending'
}

export function yardArmEffect(id: string): string {
  return getFacility(id)?.blurb ?? ''
}
