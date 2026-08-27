/** Legacy Network bars stay on the save; Worker jobs own live industrial bonuses. */

import type { GameState, NetworkBarId, NetworkBarState, NetworkLinkId, NetworkState } from './types'
import { NETWORK_BAR_IDS } from './types'
import {
  droneCap,
  dronePower,
  idleWorkers,
  NETWORK_ACUITY_PER_RANK,
  NETWORK_RACK_CAP_PER_RANK,
} from './catalog'
import { hiveResearchDroneEffMult, hiveResearchNetworkMult, hiveResearchUnlocksRelay } from './hiveResearch'
import { protocolBonusMult, protocolModifiers } from './protocols'
import { echoNetworkMult } from './echo'
import { processNetworkSpeedMult } from './process'
import { FURNACE_UNLOCK_SECTOR, furnaceNetworkMult } from './furnace'
import { careerBestWave } from './progression'
import { WORKER_JOB_IDS } from './workers'

export type NetworkBarLayer = 'primary' | 'relay' | 'lattice'

export interface NetworkBarDef {
  id: NetworkBarId
  name: string
  blurb: string
  /** Career best Wave required to unlock. 0 = from the dock. */
  requiresBestWave: number
  layer: NetworkBarLayer
  /** Primary bar this Relay / Lattice improves. */
  parent?: NetworkBarId
  /** Seconds of 1-drone work for the first fill. */
  fillBase: number
  /** Short line for the row: what this infrastructure changes. */
  improves?: string
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

/** Seconds of 1-drone work for a primary bar's first fill. */
export const NETWORK_FILL_COST = 12
/** Soft growth so later fills take longer without dead-zoning. */
export const NETWORK_FILL_COST_GROWTH = 0.18
/** Per-bar fill cap (levels / s) before Relays raise it. Extra drones on a capped bar waste work. */
export const NETWORK_FILL_CAP_PER_SEC = 0.085
/** Docked / offline crawl so a closed app is not a full Strike shift. */
export const NETWORK_DOCKED_FILL_MULT = 0.012
/** Starting corps size — enough to split Strike / Ward. */
export const NETWORK_STARTING_DRONES = 4
export const NETWORK_CYCLE_PER_RANK = 0.12

export const NETWORK_BARS: NetworkBarDef[] = [
  {
    id: 'strike',
    name: 'Strike',
    blurb: 'Each cycle raises sortie damage.',
    requiresBestWave: 0,
    layer: 'primary',
    fillBase: NETWORK_FILL_COST,
    detail: [
      'Assign drones here to cycle Strike. Each completed cycle raises the damage of every Core on the ship.',
      'More drones, sharper drones, and faster cycles all shorten the time to the next level.',
      'Strike Relays later improve this bar’s fill speed, level strength, and fill cap — not a second damage shop.',
      'Strike levels reset on Rebuild. The drones and Link ranks stay.',
    ],
  },
  {
    id: 'ward',
    name: 'Ward',
    blurb: 'Each cycle raises max shield.',
    requiresBestWave: 0,
    layer: 'primary',
    fillBase: NETWORK_FILL_COST,
    detail: [
      'Ward cycles thicken the Hive’s shield bank. Shield regenerates in the fight; Ward raises the ceiling.',
      'Split the corps with Strike until Yield and Loom open. Ward Relays later raise this bar’s machinery.',
      'Ward levels reset on Rebuild.',
    ],
  },
  {
    id: 'yield',
    name: 'Yield',
    blurb: 'Salvage from wrecks, plus a trickle of scrap.',
    requiresBestWave: 0,
    layer: 'primary',
    fillBase: NETWORK_FILL_COST,
    detail: [
      'Yield makes wrecks worth more Salvage and drips scrap into the hangar.',
      'It also slightly speeds Strike and Ward — later bars feed the earlier ones.',
      'Opens after Wave 40. Yield Relay later improves this bar’s fill and salvage scaling.',
    ],
  },
  {
    id: 'loom',
    name: 'Loom',
    blurb: 'Faster drone manufacture and Foundry crafts.',
    requiresBestWave: 0,
    layer: 'primary',
    fillBase: NETWORK_FILL_COST,
    detail: [
      'Loom is the shop floor. Cycles speed how fast new drones fabricate and how fast Processors run.',
      'It also slightly speeds Strike, Ward, and Yield.',
      'Opens after Wave 90. Loom Relay later improves manufacture machinery.',
    ],
  },
  {
    id: 'archive',
    name: 'Archive',
    blurb: 'A trickle of Research data.',
    requiresBestWave: 0,
    layer: 'primary',
    fillBase: NETWORK_FILL_COST,
    detail: [
      'Archive writes Research data while you fly or sit docked. It also slightly speeds every bar before it.',
      'Opens with Research at Wave 340. Archive Relay later improves data throughput.',
    ],
  },
  {
    id: 'strike-relay',
    name: 'Strike Relay',
    blurb: 'Infrastructure behind Strike.',
    requiresBestWave: 0,
    layer: 'relay',
    parent: 'strike',
    fillBase: 10,
    improves: 'Strike fill speed, Strike level strength, Strike fill cap',
    detail: [
      'Strike Relay does not add a flat damage shop. It improves the machinery that fills and pays Strike.',
      'Each Relay level raises Strike fill speed, how hard each Strike level hits, and how many fills Strike can take per second.',
      'Put overflow drones here when Strike is at cap. Levels reset on Rebuild.',
    ],
  },
  {
    id: 'ward-relay',
    name: 'Ward Relay',
    blurb: 'Infrastructure behind Ward.',
    requiresBestWave: 0,
    layer: 'relay',
    parent: 'ward',
    fillBase: 10,
    improves: 'Ward fill speed, Ward level strength, Ward fill cap',
    detail: [
      'Ward Relay improves Ward’s fill speed, shield-per-level, and fill cap.',
      'It is not a second shield shop. Overflow drones belong here when Ward is capped.',
    ],
  },
  {
    id: 'yield-relay',
    name: 'Yield Relay',
    blurb: 'Infrastructure behind Yield.',
    requiresBestWave: 0,
    layer: 'relay',
    parent: 'yield',
    fillBase: 11,
    improves: 'Yield fill speed, salvage scaling, scrap trickle, Yield fill cap',
    detail: [
      'Yield Relay improves how fast Yield cycles, how much each Yield level is worth, and Yield’s fill cap.',
      'Farm presets lean on Yield then this Relay once it opens.',
    ],
  },
  {
    id: 'loom-relay',
    name: 'Loom Relay',
    blurb: 'Infrastructure behind Loom.',
    requiresBestWave: 0,
    layer: 'relay',
    parent: 'loom',
    fillBase: 11,
    improves: 'Loom fill speed, manufacture scaling, Loom fill cap',
    detail: [
      'Loom Relay improves Loom fill, drone fabrication / Foundry speed per Loom level, and Loom’s fill cap.',
      'Industry presets lean on Loom then this Relay.',
    ],
  },
  {
    id: 'archive-relay',
    name: 'Archive Relay',
    blurb: 'Infrastructure behind Archive.',
    requiresBestWave: 0,
    layer: 'relay',
    parent: 'archive',
    fillBase: 12,
    improves: 'Archive fill speed, Research data rate, Archive fill cap',
    detail: [
      'Archive Relay improves Archive fill and how much data each Archive level writes.',
      'Research presets lean on Archive then this Relay.',
    ],
  },
  {
    id: 'strike-lattice',
    name: 'Strike Lattice',
    blurb: 'Infrastructure behind Strike Relay.',
    requiresBestWave: 0,
    layer: 'lattice',
    parent: 'strike',
    fillBase: 14,
    improves: 'Strike Relay strength, Strike scaling exponent, Strike drone efficiency',
    detail: [
      'Strike Lattice improves the Relay that improves Strike. Higher-order Network.',
      'It raises Relay effectiveness, Strike’s level-scaling exponent, and how much each Strike drone counts.',
      'Opens at Wave 440. Levels reset on Rebuild.',
    ],
  },
  {
    id: 'ward-lattice',
    name: 'Ward Lattice',
    blurb: 'Infrastructure behind Ward Relay.',
    requiresBestWave: 0,
    layer: 'lattice',
    parent: 'ward',
    fillBase: 14,
    improves: 'Ward Relay strength, Ward scaling exponent, Ward drone efficiency',
    detail: [
      'Ward Lattice improves the Relay that improves Ward.',
      'Opens at Wave 480. Same idea as Strike Lattice, for the shield bar.',
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
      'Before the Furnace, racks are jury-rigged with scrap. Once the Furnace opens, Heat from Choir-ash welds proper racks.',
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
      'Heat from the Furnace tunes the corps. Opens with the Furnace at Wave 140.',
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
      'Heat from the Furnace overclocks the link. Opens with the Furnace at Wave 140.',
      'Cycle speed persists on Rebuild.',
    ],
    maxRank: 20,
    heatBase: 6,
    requiresFurnace: true,
  },
]

/** Later primary bars speed the ones before them. Relays are not in this chain. */
const BOOSTS_FROM: Partial<Record<NetworkBarId, NetworkBarId[]>> = {
  strike: ['yield', 'loom', 'archive'],
  ward: ['yield', 'loom', 'archive'],
  yield: ['loom', 'archive'],
  loom: ['archive'],
  archive: [],
}

function emptyBars(): Record<NetworkBarId, NetworkBarState> {
  const bars = {} as Record<NetworkBarId, NetworkBarState>
  for (const id of NETWORK_BAR_IDS) bars[id] = { progress: 0, levels: 0 }
  return bars
}

export function createEmptyNetworkState(): NetworkState {
  return {
    bars: emptyBars(),
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
  const furnace = careerBestWave(state) >= FURNACE_UNLOCK_SECTOR
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
  if (def.requiresFurnace && careerBestWave(state) < FURNACE_UNLOCK_SECTOR) {
    return { ok: false, reason: `Furnace · Wave ${FURNACE_UNLOCK_SECTOR}` }
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
  if (hiveResearchUnlocksRelay(state, id)) return true
  return careerBestWave(state) >= def.requiresBestWave
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

export function networkPrimaryBars(): NetworkBarDef[] {
  return NETWORK_BARS.filter((b) => b.layer === 'primary')
}

export function networkInfraBars(): NetworkBarDef[] {
  return NETWORK_BARS.filter((b) => b.layer !== 'primary')
}

/** Unlocked Relays/Lattices, plus the next layer once it is twenty Waves away. */
export function networkInfraVisible(state: GameState, bar: NetworkBarDef): boolean {
  if (bar.layer === 'primary') return true
  if (isNetworkBarUnlocked(state, bar.id)) return true
  return careerBestWave(state) + 20 >= bar.requiresBestWave
}

export function networkInfraSectionVisible(state: GameState): boolean {
  return networkInfraBars().some((bar) => networkInfraVisible(state, bar))
}

export function networkRelayId(parent: NetworkBarId): NetworkBarId | null {
  return NETWORK_BARS.find((b) => b.layer === 'relay' && b.parent === parent)?.id ?? null
}

export function networkLatticeId(parent: NetworkBarId): NetworkBarId | null {
  return NETWORK_BARS.find((b) => b.layer === 'lattice' && b.parent === parent)?.id ?? null
}

/** Future Protocol rewards can multiply these without a Network rewrite. */
export interface NetworkFormulaHooks {
  fillGrowthMult: number
  droneEfficiencyMult: number
  relayEffectivenessMult: number
  exponentAdd: number
  fillCapMult: number
}

export function networkFormulaHooks(state: GameState): NetworkFormulaHooks {
  const mods = protocolModifiers(state)
  return {
    fillGrowthMult: mods.networkFillGrowthMult,
    droneEfficiencyMult: 1 + mods.networkDroneEffAdd,
    relayEffectivenessMult: 1 + mods.networkRelayAdd,
    exponentAdd: mods.networkExponentAdd,
    fillCapMult: 1,
  }
}

function parentOf(id: NetworkBarId): NetworkBarId {
  return getNetworkBar(id)?.parent ?? id
}

export function networkRelayLevels(state: GameState, parent: NetworkBarId): number {
  const id = networkRelayId(parent)
  return id ? networkLevels(state, id) : 0
}

export function networkLatticeLevels(state: GameState, parent: NetworkBarId): number {
  const id = networkLatticeId(parent)
  return id ? networkLevels(state, id) : 0
}

function infraStrength(state: GameState, parent: NetworkBarId): number {
  const hooks = networkFormulaHooks(state)
  const relay = Math.sqrt(networkRelayLevels(state, parent))
  const lattice = Math.sqrt(networkLatticeLevels(state, parent))
  return (1 + 0.12 * relay * (1 + 0.12 * lattice)) * hooks.relayEffectivenessMult
}

export function networkLevelEffectiveness(state: GameState, parent: NetworkBarId): number {
  const hooks = networkFormulaHooks(state)
  const relay = Math.sqrt(networkRelayLevels(state, parent))
  const lattice = Math.sqrt(networkLatticeLevels(state, parent))
  return 1 + 0.025 * relay * (1 + 0.1 * lattice) * hooks.relayEffectivenessMult
}

export function networkExponent(state: GameState, parent: NetworkBarId): number {
  const hooks = networkFormulaHooks(state)
  const lattice = Math.sqrt(networkLatticeLevels(state, parent))
  const ward = parent === 'ward' ? protocolModifiers(state).networkWardExponentAdd : 0
  return 0.5 + 0.02 * lattice + hooks.exponentAdd + ward
}

export function networkFillCost(state: GameState, id: NetworkBarId): number {
  const def = getNetworkBar(id)
  const base = def?.fillBase ?? NETWORK_FILL_COST
  const L = networkLevels(state, id)
  const hooks = networkFormulaHooks(state)
  let growth = NETWORK_FILL_COST_GROWTH * hooks.fillGrowthMult
  if (def?.layer === 'primary') growth /= infraStrength(state, id)
  return base * (1 + growth * Math.pow(Math.max(0, L), 1.08))
}

export function networkFillCap(state: GameState, id: NetworkBarId): number {
  const def = getNetworkBar(id)
  const hooks = networkFormulaHooks(state)
  let cap = NETWORK_FILL_CAP_PER_SEC
  if (def?.layer === 'relay') {
    cap = 0.07 * (1 + 0.04 * Math.sqrt(networkLatticeLevels(state, parentOf(id))))
  }
  if (def?.layer === 'lattice') cap = 0.055
  if (def?.layer === 'primary') cap *= infraStrength(state, id)
  return cap * hooks.fillCapMult
}

export function networkChainBoost(state: GameState, id: NetworkBarId): number {
  let mult = 1
  for (const src of BOOSTS_FROM[id] ?? []) {
    if (!isNetworkBarUnlocked(state, src)) continue
    const lv = networkLevels(state, src)
    if (lv > 0) mult *= 1 + 0.025 * Math.sqrt(lv)
  }
  return mult
}

export function networkRawFillRate(state: GameState, id: NetworkBarId): number {
  if (!isNetworkBarUnlocked(state, id)) return 0
  const assigned = Math.max(0, state.base.assignments[id] ?? 0)
  if (assigned <= 0) return 0
  const def = getNetworkBar(id)
  const parent = parentOf(id)
  const hooks = networkFormulaHooks(state)
  const cost = networkFillCost(state, id)
  const lattice = Math.sqrt(networkLatticeLevels(state, parent))
  const infra =
    def?.layer === 'primary'
      ? infraStrength(state, id)
      : def?.layer === 'relay'
        ? 1 + 0.04 * lattice
        : 1
  const droneBoost = def?.layer === 'primary' ? 1 + 0.02 * lattice : 1
  const activity = state.combat.docked ? NETWORK_DOCKED_FILL_MULT : 1
  return (
    (assigned *
      dronePower(state) *
      droneBoost *
      hooks.droneEfficiencyMult *
      networkCycleMult(state) *
      networkChainBoost(state, id) *
      infra *
      hiveResearchNetworkMult(state) *
      hiveResearchDroneEffMult(state) *
      protocolBonusMult(state, 'network') *
      echoNetworkMult(state) *
      processNetworkSpeedMult(state) *
      furnaceNetworkMult(state) *
      activity) /
    cost
  )
}

export function networkFillRate(state: GameState, id: NetworkBarId): number {
  return Math.min(networkFillCap(state, id), Math.max(0, networkRawFillRate(state, id)))
}

export function networkBarCapped(state: GameState, id: NetworkBarId): boolean {
  const raw = networkRawFillRate(state, id)
  return raw > networkFillCap(state, id) + 1e-6
}

export function networkStrikeMult(_state: GameState): number {
  return 1
}

export function networkWardMult(_state: GameState): number {
  return 1
}

/** @deprecated Worker Drones perform industry and never multiply combat rewards. */
export function networkSalvageMult(_state: GameState): number {
  return 1
}

/** @deprecated Each Worker Drone job now affects only its own real work. */
export function networkManufactureMult(_state: GameState): number {
  return 1
}

/** Extra hangar scrap drip retired — Scrap Field already produces scrap. */
export function networkScrapRate(_state: GameState): number {
  return 0
}

/** Extra Research data drip retired — Sensor Net already produces data. */
export function networkDataRate(_state: GameState): number {
  return 0
}

export function networkAssigned(state: GameState): number {
  return WORKER_JOB_IDS.reduce((n, id) => n + Math.max(0, state.base.assignments[id] ?? 0), 0)
}

/** Assigned drones × efficiency. */
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

export function networkRelayBonusLabel(state: GameState, parent: NetworkBarId): string {
  const fill = infraStrength(state, parent)
  const strength = networkLevelEffectiveness(state, parent)
  const cap = networkFillCap(state, parent)
  const exp = networkExponent(state, parent)
  return `fill ×${fill.toFixed(2)} · strength ×${strength.toFixed(2)} · cap ${cap.toFixed(1)}/s · exp ${exp.toFixed(2)}`
}

export function networkEffectLabel(state: GameState, id: NetworkBarId): string {
  const def = getNetworkBar(id)
  const L = networkLevels(state, id)
  const pct = (mult: number) => `×${mult.toFixed(2)}`
  if (def?.parent) {
    const live = L > 0 ? networkRelayBonusLabel(state, def.parent) : def.improves ?? def.blurb
    return live
  }
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
    default:
      return def?.blurb ?? id
  }
}

export interface NetworkDiagnostics {
  drones: number
  cap: number
  idle: number
  assigned: number
  levels: Record<NetworkBarId, number>
  fillRates: Partial<Record<NetworkBarId, number>>
  fillCaps: Partial<Record<NetworkBarId, number>>
  multipliers: {
    strike: number
    ward: number
    salvage: number
    manufacture: number
  }
}

export function networkDiagnostics(state: GameState): NetworkDiagnostics {
  const levels = {} as Record<NetworkBarId, number>
  const fillRates: Partial<Record<NetworkBarId, number>> = {}
  const fillCaps: Partial<Record<NetworkBarId, number>> = {}
  for (const bar of NETWORK_BARS) {
    levels[bar.id] = networkLevels(state, bar.id)
    if (isNetworkBarUnlocked(state, bar.id)) {
      fillRates[bar.id] = networkFillRate(state, bar.id)
      fillCaps[bar.id] = networkFillCap(state, bar.id)
    }
  }
  return {
    drones: state.base.workerDrones,
    cap: droneCap(state),
    idle: idleWorkers(state),
    assigned: networkAssigned(state),
    levels,
    fillRates,
    fillCaps,
    multipliers: {
      strike: networkStrikeMult(state),
      ward: networkWardMult(state),
      salvage: networkSalvageMult(state),
      manufacture: networkManufactureMult(state),
    },
  }
}

/**
 * Bars no longer fill. Worker jobs own industrial bonuses (see
 * `networkSalvageMult` / `networkManufactureMult`). Returns false so combat
 * stats are not refreshed on a phantom level-up.
 */
export function tickNetwork(state: GameState, _dtSeconds: number): boolean {
  if (!state.network) state.network = createEmptyNetworkState()
  for (const id of NETWORK_BAR_IDS) {
    if (state.base.assignments[id]) delete state.base.assignments[id]
  }
  return false
}
