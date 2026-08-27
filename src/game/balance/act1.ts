/**
 * Act 1 pacing windows and career snapshots.
 *
 * Named curves live in `src/game/balance/curves.ts`. This file does not retune
 * them — it labels engaged-player windows for the simulator.
 *
 * Windows are **engaged active time** unless labelled calendar.
 * Casual sessions stretch the same beats across offline catch-up.
 *
 * GDD §155 pads (first defeat 3–5 min, Rebuild 2–4 h, Process 24–36 h,
 * W300 70–100 h) are the live CI windows. Tune one named curve at a time.
 */

import { droneCap, prestigeMomentumDamageBonus } from '../catalog'
import { furnaceActiveCount, furnaceChannelSlots, furnaceDamageMult } from '../furnace'
import { foundrySlotCount, FOUNDRY_RECIPES } from '../foundry'
import {
  hiveResearchDamageMult,
  isResearchBreakthroughIndex,
} from '../hiveResearch'
import { PRESTIGE_MIN_SECTOR } from '../progression'
import { processEarned, PROCESS_ACCUMULATION } from '../process'
import { PROTOCOL_UNLOCK_SECTOR } from '../protocols'
import { ECHO_UNLOCK_SECTOR } from '../echo'
import type { GameState } from '../types'
import { ACT1_CADENCE, ACT1_FINAL_WAVE } from '../cadence'
import { reportedBestWave } from '../waves'
import type { Act1Contribution, Act1Snapshot, BalanceTarget } from '../simulation/types'
import { coreStartingLevelAtSlot } from '../coreProgression'

/** Ten-wave bands in Act 1 (W300 → 30). Leftover estimators still speak in bands. */
export const ACT1_SECTOR = 30

/** Career doors — Wave numbers from GDD §102. */
export const ACT1_UNLOCKS = {
  foundry: ACT1_CADENCE.foundry,
  workers: ACT1_CADENCE.workers,
  reliquary: ACT1_CADENCE.reliquary,
  rebuildAvailable: PRESTIGE_MIN_SECTOR,
  furnace: ACT1_CADENCE.furnace,
  codex: ACT1_CADENCE.codex,
  research: ACT1_CADENCE.research,
  process: ACT1_CADENCE.process,
  protocols: PROTOCOL_UNLOCK_SECTOR,
  echo: ECHO_UNLOCK_SECTOR,
  act1: ACT1_FINAL_WAVE,
} as const

/**
 * Engaged-player windows. First hour is dense; later beats lengthen.
 * Walls should point at another system, not an 8-hour wait on the same shop.
 *
 * CI gates Casual / Balanced first-Rebuild and Furnace lighting.
 * Research / Process / W300 SKIP until a long run actually reaches them.
 */
export const ACT1_TARGETS: BalanceTarget[] = [
  {
    id: 'first-wave',
    label: 'First Wave',
    min: 20,
    max: 4 * 60,
    warningPad: 45,
    milestoneId: 'wave-1',
    kind: 'milestone-time',
  },
  {
    id: 'first-defeat',
    label: 'First defeat',
    min: 3 * 60,
    max: 5 * 60,
    warningPad: 2 * 60,
    milestoneId: 'first-defeat',
    kind: 'milestone-time',
  },
  {
    id: 'foundry-unlock',
    label: 'Foundry',
    min: 45,
    max: 60 * 60,
    warningPad: 15 * 60,
    milestoneId: 'foundry-unlock',
    kind: 'milestone-time',
  },
  {
    id: 'workers-unlock',
    label: 'Workers',
    min: 8 * 60,
    max: 90 * 60,
    warningPad: 20 * 60,
    milestoneId: 'workers-unlock',
    kind: 'milestone-time',
  },
  {
    id: 'reliquary-unlock',
    label: 'Relics',
    min: 60 * 60,
    max: 8 * 60 * 60,
    warningPad: 60 * 60,
    milestoneId: 'reliquary-unlock',
    kind: 'milestone-time',
  },
  {
    id: 'first-rebuild',
    label: 'First Rebuild',
    min: 2 * 60 * 60,
    max: 4 * 60 * 60,
    warningPad: 45 * 60,
    milestoneId: 'first-rebuild',
    kind: 'milestone-time',
  },
  {
    id: 'furnace-unlock',
    label: 'Furnace',
    min: 3 * 60 * 60,
    max: 18 * 60 * 60,
    warningPad: 2 * 60 * 60,
    milestoneId: 'furnace-unlock',
    kind: 'milestone-time',
  },
  {
    id: 'hive-research-unlock',
    label: 'Research',
    min: 5 * 60 * 60,
    max: 24 * 60 * 60,
    warningPad: 3 * 60 * 60,
    milestoneId: 'hive-research-unlock',
    kind: 'milestone-time',
  },
  {
    id: 'first-research-bt',
    label: 'First Research breakthrough',
    min: 6 * 60 * 60,
    max: 30 * 60 * 60,
    warningPad: 4 * 60 * 60,
    milestoneId: 'first-research-bt',
    kind: 'milestone-time',
  },
  {
    id: 'wave-100',
    label: 'Wave 100',
    min: 3 * 60 * 60,
    max: 12 * 60 * 60,
    warningPad: 2 * 60 * 60,
    milestoneId: 'wave-100',
    kind: 'milestone-time',
  },
  {
    id: 'process-unlock',
    label: 'Process',
    min: 24 * 60 * 60,
    max: 36 * 60 * 60,
    warningPad: 8 * 60 * 60,
    milestoneId: 'process-unlock',
    kind: 'milestone-time',
  },
  {
    id: 'challenges-unlock',
    label: 'Challenges',
    min: 10 * 60 * 60,
    max: 3 * 24 * 60 * 60,
    warningPad: 6 * 60 * 60,
    milestoneId: 'unlock-protocols',
    kind: 'milestone-time',
  },
  {
    id: 'w1000',
    label: 'Wave 1000',
    min: 70 * 60 * 60,
    max: 100 * 60 * 60,
    warningPad: 20 * 60 * 60,
    milestoneId: 'wave-1000',
    kind: 'milestone-time',
  },
]

/** Casual calendar: ~1.5–2.5h engagement per day. */
export const ACT1_CASUAL_CALENDAR = {
  firstRebuildDays: [0, 1] as const,
  wave100Days: [0, 2] as const,
  w300Days: [4, 14] as const,
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
  'wave-40': {
    pulse: [2, 8],
    plate: [1, 6],
    drones: [4, 6],
    strike: [1, 8],
    foundryRecipes: [0, 4],
    researchNodes: [0, 0],
    rebuilds: [0, 1],
    processEarned: [4, 12],
  },
  'wave-100': {
    pulse: [4, 14],
    plate: [3, 12],
    drones: [4, 10],
    strike: [4, 20],
    foundryRecipes: [2, 8],
    researchNodes: [1, 8],
    rebuilds: [1, 4],
    processEarned: [8, 40],
  },
  'wave-300': {
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

ACT1_EXPECTED_AT['sector-4'] = ACT1_EXPECTED_AT['wave-40']!
ACT1_EXPECTED_AT['sector-10'] = ACT1_EXPECTED_AT['wave-100']!
ACT1_EXPECTED_AT['sector-30'] = ACT1_EXPECTED_AT['wave-300']!

export function act1Contribution(state: GameState): Act1Contribution {
  return {
    networkDamage: 0,
    furnaceDamage: furnaceDamageMult(state) - 1,
    reliquaryDamage: 0,
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
  const relays = 0
  const recipes = FOUNDRY_RECIPES.filter((r) => (state.foundry.masteryXp[r.id] ?? 0) > 0).length
  const protocolRanks = Object.values(state.protocols?.ranks ?? {}).reduce((s, n) => s + (n ?? 0), 0)
  return {
    at,
    activeSeconds,
    calendarSeconds,
    sector: state.combat.wave,
    bestWave: reportedBestWave(state),
    highestEver: Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0),
    salvage: state.resources.salvage,
    salvageEarned,
    pulse: coreStartingLevelAtSlot(state, 0),
    plate: coreStartingLevelAtSlot(state, 1),
    drones: state.base.workerDrones,
    droneCap: droneCap(state),
    strike: state.network?.bars.strike.levels ?? 0,
    ward: state.network?.bars.ward.levels ?? 0,
    yield: state.network?.bars.yield.levels ?? 0,
    loom: state.network?.bars.loom.levels ?? 0,
    archive: state.network?.bars.archive.levels ?? 0,
    relays,
    foundrySlots: foundrySlotCount(state),
    foundryPoints: 0,
    foundryRecipes: recipes,
    foundryInfinite: 0,
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
