/** Drone Network — USI Compute reskin. Drones fill idle bars; bars do not fight. */

import type { GameState, NetworkBarId, NetworkLinkId, NetworkState } from './types'
import {
  dronePower,
  NETWORK_ACUITY_PER_RANK,
  NETWORK_RACK_CAP_PER_RANK,
} from './catalog'
import { reliquaryNetworkMult } from './reliquary'
import { hiveResearchDataMult, hiveResearchNetworkMult } from './hiveResearch'
import { yardNetworkMult } from './yard'
import { protocolBonusMult, protocolMutes } from './protocols'
import { echoNetworkMult } from './echo'
import { processNetworkSpeedMult } from './process'
import { FURNACE_UNLOCK_SECTOR, furnaceNetworkMult } from './furnace'

function careerEver(state: GameState): number {
  return Math.max(state.meta.highestSectorEver ?? 0, state.combat.highestSector ?? 0)
}

export interface NetworkBarDef {
  id: NetworkBarId
  name: string
  blurb: string
  /** Career sector cleared to unlock. 0 = from the dock. */
  requiresSectorEver: number
  detail: string[]
}

export interface NetworkLinkDef {
  id: NetworkLinkId
  name: string
  blurb: string
  detail: string[]
  maxRank: number
  /** Heat cost once the Furnace is lit. */
  heatBase: number
  /** Scrap cost for Corps racks before sector 5. */
  scrapBase?: number
  requiresFurnace?: boolean
}

/** Seconds of 1-drone work for the first fill. Extra drones shorten this. */
export const NETWORK_FILL_COST = 6
/** Soft growth so later fills take slightly longer. */
export const NETWORK_FILL_COST_GROWTH = 0.025
/** USI-style fills/sec cap (their default is 20). */
export const NETWORK_FILL_CAP_PER_SEC = 8
/** Starting corps size — enough to split Strike / Ward. */
export const NETWORK_STARTING_DRONES = 4
export const NETWORK_CYCLE_PER_RANK = 0.12

export const NETWORK_BARS: NetworkBarDef[] = [
  {
    id: 'strike',
    name: 'Strike',
    blurb: 'Each cycle raises sortie damage.',
    requiresSectorEver: 0,
    detail: [
      'Assign drones here to cycle Strike. Each completed cycle raises the damage of every Core on the ship.',
      'More drones, sharper drones, and faster cycles all shorten the time to the next level.',
      'Strike levels reset on Rebuild. The drones and Link ranks stay.',
    ],
  },
  {
    id: 'ward',
    name: 'Ward',
    blurb: 'Each cycle raises max shield.',
    requiresSectorEver: 0,
    detail: [
      'Ward cycles thicken the flagship’s shield bank. Shield regenerates in the fight; Ward raises the ceiling.',
      'Split the corps with Strike until Yield and Loom open.',
      'Ward levels reset on Rebuild.',
    ],
  },
  {
    id: 'yield',
    name: 'Yield',
    blurb: 'Salvage from wrecks, plus a trickle of scrap.',
    requiresSectorEver: 2,
    detail: [
      'Yield makes wrecks worth more Salvage and drips scrap into the hangar.',
      'It also slightly speeds Strike and Ward — later bars feed the earlier ones.',
      'Opens after you clear sector 2.',
    ],
  },
  {
    id: 'loom',
    name: 'Loom',
    blurb: 'Faster drone manufacture and Foundry crafts.',
    requiresSectorEver: 2,
    detail: [
      'Loom is the shop floor. Cycles speed how fast new drones print and how fast smelters run.',
      'It also slightly speeds Strike, Ward, and Yield.',
      'Opens after you clear sector 2.',
    ],
  },
  {
    id: 'archive',
    name: 'Archive',
    blurb: 'A trickle of Research data.',
    requiresSectorEver: 7,
    detail: [
      'Archive writes Research data while you fly or sit docked. It also slightly speeds every bar before it.',
      'Opens with Research at sector 7.',
    ],
  },
]

export const NETWORK_LINKS: NetworkLinkDef[] = [
  {
    id: 'racks',
    name: 'Corps racks',
    blurb: 'Hang more drone hulls. Raises corps cap.',
    detail: [
      'Racks are extra clamps in the hangar. Each rank adds one drone the corps may hold.',
      'Before the Furnace, racks are jury-rigged with scrap. After sector 5, Heat from Choir-ash welds proper racks.',
      'Racks persist on Rebuild.',
    ],
    maxRank: 30,
    heatBase: 4,
    scrapBase: 40,
  },
  {
    id: 'acuity',
    name: 'Drone acuity',
    blurb: 'Each drone thinks faster. Same bodies, more work.',
    detail: [
      'Acuity is drone efficiency. Each rank makes every assigned drone count as more Link power, so bars cycle with fewer bodies.',
      'Heat from the Furnace tunes the corps. Opens with the Furnace at sector 5.',
      'Acuity persists on Rebuild.',
    ],
    maxRank: 20,
    heatBase: 6,
    requiresFurnace: true,
  },
  {
    id: 'cycle',
    name: 'Cycle speed',
    blurb: 'The Network ticks faster. Bars fill sooner.',
    detail: [
      'Cycle speed is the clock. Each rank raises how fast every assigned bar completes a level.',
      'Heat from the Furnace overclocks the link. Opens with the Furnace at sector 5.',
      'Cycle speed persists on Rebuild.',
    ],
    maxRank: 20,
    heatBase: 6,
    requiresFurnace: true,
  },
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
    links: { racks: 0, acuity: 0, cycle: 0 },
  }
}

/** Keep Link ranks; wipe bar levels (Rebuild / Protocol). */
export function wipeNetworkBars(network: NetworkState | undefined): NetworkState {
  const next = createEmptyNetworkState()
  const links = network?.links
  if (!links) return next
  next.links = {
    racks: Math.max(0, Math.floor(links.racks ?? 0)),
    acuity: Math.max(0, Math.floor(links.acuity ?? 0)),
    cycle: Math.max(0, Math.floor(links.cycle ?? 0)),
  }
  return next
}

export function networkLinkRank(state: { network?: NetworkState }, id: NetworkLinkId): number {
  return Math.max(0, Math.floor(state.network?.links?.[id] ?? 0))
}

export function getNetworkLink(id: string): NetworkLinkDef | undefined {
  return NETWORK_LINKS.find((l) => l.id === id)
}

export function networkCycleMult(state: { network?: NetworkState }): number {
  return 1 + NETWORK_CYCLE_PER_RANK * networkLinkRank(state, 'cycle')
}

export function networkAcuityBonus(state: { network?: NetworkState }): number {
  return NETWORK_ACUITY_PER_RANK * networkLinkRank(state, 'acuity')
}

export function networkRackBonus(state: { network?: NetworkState }): number {
  return NETWORK_RACK_CAP_PER_RANK * networkLinkRank(state, 'racks')
}

export function networkLinkCost(
  state: GameState,
  id: NetworkLinkId,
): { resource: 'heat' | 'scrap'; amount: number } | null {
  const def = getNetworkLink(id)
  if (!def) return null
  const rank = networkLinkRank(state, id)
  const furnace = careerEver(state) >= FURNACE_UNLOCK_SECTOR
  if (def.requiresFurnace || furnace) {
    return { resource: 'heat', amount: Math.ceil(def.heatBase * Math.pow(1.32, rank)) }
  }
  if (def.scrapBase) {
    return { resource: 'scrap', amount: Math.ceil(def.scrapBase * Math.pow(1.4, rank)) }
  }
  return { resource: 'heat', amount: Math.ceil(def.heatBase * Math.pow(1.32, rank)) }
}

export function canBuyNetworkLink(
  state: GameState,
  id: NetworkLinkId,
): { ok: true; cost: { resource: 'heat' | 'scrap'; amount: number } } | { ok: false; reason: string } {
  const def = getNetworkLink(id)
  if (!def) return { ok: false, reason: 'Unknown link' }
  if (def.requiresFurnace && careerEver(state) < FURNACE_UNLOCK_SECTOR) {
    return { ok: false, reason: `Furnace · sector ${FURNACE_UNLOCK_SECTOR}` }
  }
  const rank = networkLinkRank(state, id)
  if (rank >= def.maxRank) return { ok: false, reason: 'Maxed' }
  const cost = networkLinkCost(state, id)
  if (!cost) return { ok: false, reason: 'Unknown link' }
  const have = cost.resource === 'heat' ? state.resources.heat ?? 0 : state.resources.scrap
  if (have < cost.amount) {
    return {
      ok: false,
      reason: `Need ${cost.amount} ${cost.resource === 'heat' ? 'Heat' : 'scrap'}`,
    }
  }
  return { ok: true, cost }
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

export function networkTotalLevels(state: GameState): number {
  return NETWORK_BARS.reduce((n, bar) => n + networkLevels(state, bar.id), 0)
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
      networkCycleMult(state) *
      networkChainBoost(state, id) *
      reliquaryNetworkMult(state) *
      hiveResearchNetworkMult(state) *
      yardNetworkMult(state) *
      protocolBonusMult(state, 'network') *
      echoNetworkMult(state) *
      processNetworkSpeedMult(state) *
      furnaceNetworkMult(state)) /
    cost
  return Math.min(NETWORK_FILL_CAP_PER_SEC, Math.max(0, raw))
}

/** USI Damage 1.1 shape: 1 + k*((8L+1)^0.5 − 1). L=0 → 1. */
function computeBonus(levels: number, k: number): number {
  const L = Math.max(0, levels)
  return 1 + k * (Math.pow(8 * L + 1, 0.5) - 1)
}

export function networkStrikeMult(state: GameState): number {
  if (protocolMutes(state, 'network')) return 1
  return computeBonus(networkLevels(state, 'strike'), 0.08)
}

export function networkWardMult(state: GameState): number {
  if (protocolMutes(state, 'network')) return 1
  return computeBonus(networkLevels(state, 'ward'), 0.08)
}

export function networkSalvageMult(state: GameState): number {
  if (protocolMutes(state, 'network')) return 1
  if (!isNetworkBarUnlocked(state, 'yield')) return 1
  return computeBonus(networkLevels(state, 'yield'), 0.05)
}

export function networkManufactureMult(state: GameState): number {
  if (protocolMutes(state, 'network')) return 1
  if (!isNetworkBarUnlocked(state, 'loom')) return 1
  return computeBonus(networkLevels(state, 'loom'), 0.04)
}

export function networkScrapRate(state: GameState): number {
  if (protocolMutes(state, 'network')) return 0
  if (!isNetworkBarUnlocked(state, 'yield')) return 0
  const L = networkLevels(state, 'yield')
  if (L <= 0) return 0
  return 0.12 * Math.pow(L, 0.7)
}

export function networkDataRate(state: GameState): number {
  if (protocolMutes(state, 'network')) return 0
  if (!isNetworkBarUnlocked(state, 'archive')) return 0
  const L = networkLevels(state, 'archive')
  if (L <= 0) return 0
  return 0.025 * Math.pow(L, 0.7) * hiveResearchDataMult(state)
}

export function networkAssigned(state: GameState): number {
  return NETWORK_BARS.reduce((n, bar) => n + Math.max(0, state.base.assignments[bar.id] ?? 0), 0)
}

/** Assigned drones × efficiency — the Compute Power analogue. */
export function networkLinkPower(state: GameState): number {
  return networkAssigned(state) * dronePower(state)
}

export function networkSecondsToLevel(state: GameState, id: NetworkBarId): number | null {
  const rate = networkFillRate(state, id)
  if (rate <= 0) return null
  const left = 1 - networkProgress(state, id)
  return left / rate
}

export { NETWORK_ACUITY_PER_RANK, NETWORK_RACK_CAP_PER_RANK } from './catalog'

export function networkLinkEffectLabel(state: GameState, id: NetworkLinkId): string {
  const rank = networkLinkRank(state, id)
  switch (id) {
    case 'racks':
      return `+${rank} corps cap`
    case 'acuity':
      return `+${Math.round(networkAcuityBonus(state) * 100)}% efficiency`
    case 'cycle':
      return `×${networkCycleMult(state).toFixed(2)} cycle`
  }
}

export function networkEffectLabel(state: GameState, id: NetworkBarId): string {
  const L = networkLevels(state, id)
  const pct = (mult: number) => `×${mult.toFixed(2)}`
  switch (id) {
    case 'strike':
      return `${pct(networkStrikeMult(state))} damage`
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
