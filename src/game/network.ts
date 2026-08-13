/** Drone Network — USI Compute reskin. Drones fill idle bars; bars do not fight. */

import type { GameState, NetworkBarId, NetworkState } from './types'
import { dronePower } from './catalog'
import { reliquaryNetworkMult } from './reliquary'
import { hiveResearchDataMult, hiveResearchNetworkMult } from './hiveResearch'

function careerEver(state: GameState): number {
  return Math.max(state.meta.highestSectorEver ?? 0, state.combat.highestSector ?? 0)
}

export interface NetworkBarDef {
  id: NetworkBarId
  name: string
  blurb: string
  /** Career sector cleared to unlock. 0 = from the dock. */
  requiresSectorEver: number
}

/** Seconds of 1-drone work for the first fill. Extra drones shorten this. */
export const NETWORK_FILL_COST = 6
/** Soft growth so later fills take slightly longer. */
export const NETWORK_FILL_COST_GROWTH = 0.025
/** USI-style fills/sec cap (their default is 20). */
export const NETWORK_FILL_CAP_PER_SEC = 8
/** Starting corps size — enough to split Strike / Ward. */
export const NETWORK_STARTING_DRONES = 4

export const NETWORK_BARS: NetworkBarDef[] = [
  { id: 'strike', name: 'Strike', blurb: 'Sortie damage', requiresSectorEver: 0 },
  { id: 'ward', name: 'Ward', blurb: 'Max shield', requiresSectorEver: 0 },
  { id: 'yield', name: 'Yield', blurb: 'Salvage + scrap', requiresSectorEver: 2 },
  { id: 'loom', name: 'Loom', blurb: 'Foundry / manufacture', requiresSectorEver: 2 },
  { id: 'archive', name: 'Archive', blurb: 'Research data', requiresSectorEver: 7 },
]

/** Later bars speed the ones before them (USI Cap+ analogue). */
const BOOSTS_FROM: Record<NetworkBarId, NetworkBarId[]> = {
  strike: ['yield', 'loom', 'archive'],
  ward: ['yield', 'loom', 'archive'],
  yield: ['loom', 'archive'],
  loom: ['archive'],
  archive: [],
}

export function createEmptyNetworkState(): NetworkState {
  return {
    bars: {
      strike: { progress: 0, levels: 0 },
      ward: { progress: 0, levels: 0 },
      yield: { progress: 0, levels: 0 },
      loom: { progress: 0, levels: 0 },
      archive: { progress: 0, levels: 0 },
    },
  }
}

export function isNetworkBarId(id: string): id is NetworkBarId {
  return NETWORK_BARS.some((b) => b.id === id)
}

export function getNetworkBar(id: string): NetworkBarDef | undefined {
  return NETWORK_BARS.find((b) => b.id === id)
}

export function isNetworkBarUnlocked(state: GameState, id: NetworkBarId): boolean {
  const def = getNetworkBar(id)
  if (!def) return false
  return careerEver(state) >= def.requiresSectorEver
}

export function networkLevels(state: GameState, id: NetworkBarId): number {
  return Math.max(0, state.network?.bars[id]?.levels ?? 0)
}

export function networkProgress(state: GameState, id: NetworkBarId): number {
  const p = state.network?.bars[id]?.progress ?? 0
  return Math.max(0, Math.min(0.999, p))
}

export function networkFillCost(levels: number): number {
  return NETWORK_FILL_COST * (1 + NETWORK_FILL_COST_GROWTH * Math.max(0, levels))
}

export function networkChainBoost(state: GameState, id: NetworkBarId): number {
  let mult = 1
  for (const src of BOOSTS_FROM[id]) {
    if (!isNetworkBarUnlocked(state, src)) continue
    const lv = networkLevels(state, src)
    if (lv > 0) mult *= 1 + 0.025 * Math.sqrt(lv)
  }
  return mult
}

export function networkFillRate(state: GameState, id: NetworkBarId): number {
  if (!isNetworkBarUnlocked(state, id)) return 0
  const assigned = Math.max(0, state.base.assignments[id] ?? 0)
  if (assigned <= 0) return 0
  const cost = networkFillCost(networkLevels(state, id))
  const raw =
    (assigned *
      dronePower(state) *
      networkChainBoost(state, id) *
      reliquaryNetworkMult(state) *
      hiveResearchNetworkMult(state)) /
    cost
  return Math.min(NETWORK_FILL_CAP_PER_SEC, Math.max(0, raw))
}

/** USI Damage 1.1 shape: 1 + k*((8L+1)^0.5 − 1). L=0 → 1. */
function computeBonus(levels: number, k: number): number {
  const L = Math.max(0, levels)
  return 1 + k * (Math.pow(8 * L + 1, 0.5) - 1)
}

export function networkStrikeMult(state: GameState): number {
  return computeBonus(networkLevels(state, 'strike'), 0.08)
}

export function networkWardMult(state: GameState): number {
  return computeBonus(networkLevels(state, 'ward'), 0.08)
}

export function networkSalvageMult(state: GameState): number {
  if (!isNetworkBarUnlocked(state, 'yield')) return 1
  return computeBonus(networkLevels(state, 'yield'), 0.05)
}

export function networkManufactureMult(state: GameState): number {
  if (!isNetworkBarUnlocked(state, 'loom')) return 1
  return computeBonus(networkLevels(state, 'loom'), 0.04)
}

export function networkScrapRate(state: GameState): number {
  if (!isNetworkBarUnlocked(state, 'yield')) return 0
  const L = networkLevels(state, 'yield')
  if (L <= 0) return 0
  return 0.12 * Math.pow(L, 0.7)
}

export function networkDataRate(state: GameState): number {
  if (!isNetworkBarUnlocked(state, 'archive')) return 0
  const L = networkLevels(state, 'archive')
  if (L <= 0) return 0
  return 0.025 * Math.pow(L, 0.7) * hiveResearchDataMult(state)
}

export function networkEffectLabel(state: GameState, id: NetworkBarId): string {
  const L = networkLevels(state, id)
  const pct = (mult: number) => `×${mult.toFixed(2)}`
  switch (id) {
    case 'strike':
      return `${pct(networkStrikeMult(state))} dmg`
    case 'ward':
      return `${pct(networkWardMult(state))} shield`
    case 'yield':
      return `${pct(networkSalvageMult(state))} salvage · ${networkScrapRate(state).toFixed(2)} scrap/s`
    case 'loom':
      return `${pct(networkManufactureMult(state))} manufacture`
    case 'archive':
      return L > 0 ? `${networkDataRate(state).toFixed(2)} data/s` : 'Research income'
  }
}

/**
 * Fill assigned bars. Returns true if any bar gained a level (combat stats should refresh).
 */
export function tickNetwork(state: GameState, dtSeconds: number): boolean {
  if (!state.network) state.network = createEmptyNetworkState()
  let leveled = false
  for (const bar of NETWORK_BARS) {
    if (!isNetworkBarUnlocked(state, bar.id)) continue
    const rec = state.network.bars[bar.id]
    if (!rec) {
      state.network.bars[bar.id] = { progress: 0, levels: 0 }
    }
    const slot = state.network.bars[bar.id]
    const rate = networkFillRate(state, bar.id)
    if (rate <= 0) continue
    slot.progress += dtSeconds * rate
    const gained = Math.floor(slot.progress)
    if (gained > 0) {
      slot.levels += gained
      slot.progress -= gained
      leveled = true
    }
  }

  const scrap = networkScrapRate(state) * dtSeconds
  if (scrap > 0) state.resources.scrap += scrap
  const data = networkDataRate(state) * dtSeconds
  if (data > 0) state.resources.data += data

  return leveled
}
