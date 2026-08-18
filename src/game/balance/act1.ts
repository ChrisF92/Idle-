/**
 * Act 1 economy / pacing source of truth.
 *
 * Human-readable formulas, targets, and simulator assumptions:
 * `docs/act1-balance.md`.
 *
 * Targets are authored for the current Hiveworks systems (Process 2.0,
 * Furnace 2.0, Network layers, Protocols, Foundry depth, Research
 * breakthroughs). They are not a copy of the old USI/ITRTG calendar.
 *
 * Windows are **engaged active time** unless labelled calendar.
 * Casual sessions stretch the same beats across offline catch-up.
 */

import { droneCap, moduleLevel, prestigeMomentumDamageBonus } from '../catalog'
import { furnaceActiveCount, furnaceChannelSlots, furnaceDamageMult } from '../furnace'
import { foundrySlotCount, FOUNDRY_RECIPES } from '../foundry'
import {
  hiveResearchDamageMult,
  isResearchBreakthroughIndex,
} from '../hiveResearch'
import { NETWORK_BARS, networkStrikeMult } from '../network'
import { PRESTIGE_MIN_SECTOR } from '../progression'
import { processEarned, PROCESS_ACCUMULATION } from '../process'
import { PROTOCOL_UNLOCK_SECTOR } from '../protocols'
import { ECHO_UNLOCK_SECTOR } from '../echo'
import { reliquaryDamageMult } from '../reliquary'
import type { GameState } from '../types'
import type { Act1Contribution, Act1Snapshot, BalanceTarget } from '../simulation/types'

export const ACT1_SECTOR = 30

/** Career doors — keep in lockstep with progression / system files. */
export const ACT1_UNLOCKS = {
  foundry: 2,
  reliquary: 3,
  rebuildAvailable: PRESTIGE_MIN_SECTOR,
  furnace: 5,
  codex: 6,
  research: 7,
  process: 1,
  protocols: PROTOCOL_UNLOCK_SECTOR,
  echo: ECHO_UNLOCK_SECTOR,
  act1: ACT1_SECTOR,
} as const

/**
 * Engaged-player windows. First hour is dense; later beats lengthen.
 * Walls should point at another system, not an 8-hour wait on the same shop.
 */
export const ACT1_TARGETS: BalanceTarget[] = [
  {
    id: 'sector-1',
    label: 'Sector 1',
    min: 20,
    max: 4 * 60,
    warningPad: 45,
    milestoneId: 'sector-1',
    kind: 'milestone-time',
  },
  {
    id: 'foundry-unlock',
    label: 'Foundry unlock',
    min: 45,
    max: 8 * 60,
    warningPad: 90,
    milestoneId: 'foundry-unlock',
    kind: 'milestone-time',
  },
  {
    id: 'reliquary-unlock',
    label: 'Reliquary unlock',
    min: 90,
    max: 14 * 60,
    warningPad: 2 * 60,
    milestoneId: 'reliquary-unlock',
    kind: 'milestone-time',
  },
  {
    id: 'first-rebuild',
    label: 'First Rebuild',
    min: 8 * 60,
    max: 50 * 60,
    warningPad: 10 * 60,
    milestoneId: 'first-rebuild',
    kind: 'milestone-time',
  },
  {
    id: 'furnace-unlock',
    label: 'Furnace unlock',
    min: 4 * 60,
    max: 22 * 60,
    warningPad: 4 * 60,
    milestoneId: 'furnace-unlock',
    kind: 'milestone-time',
  },
  {
    id: 'hive-research-unlock',
    label: 'Research unlock',
    min: 8 * 60,
    max: 40 * 60,
    warningPad: 6 * 60,
    milestoneId: 'hive-research-unlock',
    kind: 'milestone-time',
  },
  {
    id: 'first-research-bt',
    label: 'First Research breakthrough',
    min: 16 * 60,
    max: 90 * 60,
    warningPad: 15 * 60,
    milestoneId: 'first-research-bt',
    kind: 'milestone-time',
  },
  {
    id: 'sector-10',
    label: 'Sector 10',
    min: 18 * 60,
    max: 90 * 60,
    warningPad: 15 * 60,
    milestoneId: 'sector-10',
    kind: 'milestone-time',
  },
  {
    id: 'protocols-unlock',
    label: 'Protocols',
    min: 50 * 60,
    max: 6 * 60 * 60,
    warningPad: 40 * 60,
    milestoneId: 'unlock-protocols',
    kind: 'milestone-time',
  },
  {
    id: 'echo-unlock',
    label: 'Echo',
    min: 80 * 60,
    max: 10 * 60 * 60,
    warningPad: 90 * 60,
    milestoneId: 'unlock-echo',
    kind: 'milestone-time',
  },
  {
    id: 'sector-30',
    label: 'Sector 30 (Act 1)',
    min: 3 * 60 * 60,
    max: 16 * 60 * 60,
    warningPad: 2 * 60 * 60,
    milestoneId: 'sector-30',
    kind: 'milestone-time',
  },
]

/** Casual calendar: ~1.5–2.5h engagement per day. */
export const ACT1_CASUAL_CALENDAR = {
  firstRebuildDays: [0, 1] as const,
  sector10Days: [0, 2] as const,
  sector30Days: [4, 14] as const,
}

/** Expected engaged-player system levels at key career doors (bands, not rails). */
export const ACT1_EXPECTED_AT: Record<
  string,
  {
    pulse: [number, number]
    plate: [number, number]
    drones: [number, number]
    strike: [number, number]
    foundryRecipes: [number, number]
    researchNodes: [number, number]
    rebuilds: [number, number]
    processEarned: [number, number]
  }
> = {
  'sector-4': {
    pulse: [2, 8],
    plate: [1, 6],
    drones: [4, 6],
    strike: [1, 8],
    foundryRecipes: [0, 4],
    researchNodes: [0, 0],
    rebuilds: [0, 1],
    processEarned: [4, 12],
  },
  'sector-10': {
    pulse: [4, 14],
    plate: [3, 12],
    drones: [4, 10],
    strike: [4, 20],
    foundryRecipes: [2, 8],
    researchNodes: [1, 8],
    rebuilds: [1, 4],
    processEarned: [8, 40],
  },
  'sector-30': {
    pulse: [8, 28],
    plate: [6, 24],
    drones: [6, 16],
    strike: [10, 40],
    foundryRecipes: [6, 16],
    researchNodes: [6, 20],
    rebuilds: [3, 12],
    processEarned: [25, 120],
  },
}

export function act1Contribution(state: GameState): Act1Contribution {
  return {
    networkDamage: networkStrikeMult(state) - 1,
    furnaceDamage: furnaceDamageMult(state) - 1,
    reliquaryDamage: reliquaryDamageMult(state) - 1,
    researchDamage: hiveResearchDamageMult(state) - 1,
    rebuildMomentum: prestigeMomentumDamageBonus(state.prestige.prestigeCount, state.meta.ascensionCount ?? 0),
  }
}

export function captureAct1Snapshot(
  state: GameState,
  at: string,
  activeSeconds: number,
  calendarSeconds: number,
  salvageEarned = 0,
): Act1Snapshot {
  const research = state.hiveResearch?.completed ?? { material: 0, energy: 0, observation: 0 }
  const material = research.material ?? 0
  const energy = research.energy ?? 0
  const observation = research.observation ?? 0
  let bts = 0
  for (const n of [material, energy, observation]) {
    for (let i = 0; i < n; i++) if (isResearchBreakthroughIndex(i)) bts += 1
  }
  const relays = NETWORK_BARS.filter((b) => b.layer !== 'primary').reduce(
    (n, b) => n + (state.network?.bars[b.id]?.levels ?? 0),
    0,
  )
  const recipes = FOUNDRY_RECIPES.filter((r) => (state.foundry.recipeLevels[r.id] ?? 0) > 0).length
  const protocolRanks = Object.values(state.protocols?.ranks ?? {}).reduce((s, n) => s + (n ?? 0), 0)
  return {
    at,
    activeSeconds,
    calendarSeconds,
    sector: state.combat.sector,
    highestEver: Math.max(state.meta.highestSectorEver ?? 0, state.combat.highestSector ?? 0),
    salvage: state.resources.salvage,
    salvageEarned,
    pulse: moduleLevel(state.shipyard.moduleLevels, 'pulse-cannon'),
    plate: moduleLevel(state.shipyard.moduleLevels, 'plate-layer'),
    drones: state.base.workerDrones,
    droneCap: droneCap(state),
    strike: state.network?.bars.strike.levels ?? 0,
    ward: state.network?.bars.ward.levels ?? 0,
    yield: state.network?.bars.yield.levels ?? 0,
    loom: state.network?.bars.loom.levels ?? 0,
    archive: state.network?.bars.archive.levels ?? 0,
    relays,
    foundrySlots: foundrySlotCount(state),
    foundryPoints: state.foundry.points,
    foundryRecipes: recipes,
    foundryInfinite: state.foundry.infinite.length,
    furnaceSlots: furnaceChannelSlots(state),
    furnaceLit: furnaceActiveCount(state),
    heat: state.resources.heat ?? 0,
    research: {
      material,
      energy,
      observation,
      focus: state.hiveResearch?.focus ?? 'material',
    },
    researchBreakthroughs: bts,
    processEarned: processEarned(state),
    processAvailable: state.resources.aiPoints,
    processPurchased: state.process?.purchased.length ?? 0,
    rebuilds: state.prestige.prestigeCount,
    protocolRanks,
    echoNodes: state.echo?.tree?.length ?? 0,
    contribution: act1Contribution(state),
  }
}

export function inBand(value: number, band: [number, number]): boolean {
  return value >= band[0] && value <= band[1]
}

export function firstProcessQolCost(): number {
  return 4
}

export function earlyAccumulationAts(): number[] {
  return PROCESS_ACCUMULATION.slice(0, 4).map((a) => a.atEarned)
}
