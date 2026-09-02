/**
 * Act 1 pacing windows and career snapshots.
 *
 * Named curves live in `src/game/balance/curves.ts`. This file does not retune
 * them — it labels engaged-player windows for the simulator.
 *
 * Windows are **engaged active time** unless labelled calendar.
 * Casual sessions stretch the same beats across offline catch-up.
 *
 * Canonical pads (first defeat 3–5 min, Rebuild after the W210-era gate, Process 24–36 h,
 * W1000 80–100 h) are the live acceptance windows. Tune one named curve at a time.
 */

import { droneCap } from '../catalog'
import { furnaceChannelLimit, furnaceDamageMult, furnaceSelectedCount } from '../furnace'
import { foundrySlotCount, FOUNDRY_RECIPES } from '../foundry'
import {
  hiveResearchDamageMult,
  isResearchBreakthroughIndex,
} from '../hiveResearch'
import { PRESTIGE_MIN_SECTOR } from '../progression'
import { processEarned, PROCESS_ACCUMULATION } from '../process'
import { CHALLENGE_UNLOCK_WAVE } from '../challenges'
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
  challenges: CHALLENGE_UNLOCK_WAVE,
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
    min: 0,
    max: 5,
    warningPad: 5,
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
    min: 6 * 60 * 60,
    max: 12 * 60 * 60,
    warningPad: 2 * 60 * 60,
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
    min: 2 * 60 * 60,
    max: 4 * 60 * 60,
    warningPad: 60 * 60,
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
    milestoneId: 'unlock-challenges',
    kind: 'milestone-time',
  },
  {
    id: 'wave-200', label: 'Wave 200', min: 6 * 60 * 60, max: 10 * 60 * 60,
    warningPad: 2 * 60 * 60, milestoneId: 'wave-200', kind: 'milestone-time',
  },
  {
    id: 'wave-300', label: 'Wave 300', min: 12 * 60 * 60, max: 18 * 60 * 60,
    warningPad: 3 * 60 * 60, milestoneId: 'wave-300', kind: 'milestone-time',
  },
  {
    id: 'wave-400', label: 'Wave 400', min: 20 * 60 * 60, max: 28 * 60 * 60,
    warningPad: 4 * 60 * 60, milestoneId: 'wave-400', kind: 'milestone-time',
  },
  {
    id: 'wave-500', label: 'Wave 500', min: 30 * 60 * 60, max: 40 * 60 * 60,
    warningPad: 5 * 60 * 60, milestoneId: 'wave-500', kind: 'milestone-time',
  },
  {
    id: 'wave-600', label: 'Wave 600', min: 42 * 60 * 60, max: 54 * 60 * 60,
    warningPad: 6 * 60 * 60, milestoneId: 'wave-600', kind: 'milestone-time',
  },
  {
    id: 'wave-700', label: 'Wave 700', min: 52 * 60 * 60, max: 66 * 60 * 60,
    warningPad: 7 * 60 * 60, milestoneId: 'wave-700', kind: 'milestone-time',
  },
  {
    id: 'wave-800', label: 'Wave 800', min: 62 * 60 * 60, max: 78 * 60 * 60,
    warningPad: 8 * 60 * 60, milestoneId: 'wave-800', kind: 'milestone-time',
  },
  {
    id: 'wave-900', label: 'Wave 900', min: 72 * 60 * 60, max: 90 * 60 * 60,
    warningPad: 9 * 60 * 60, milestoneId: 'wave-900', kind: 'milestone-time',
  },
  {
    id: 'w1000',
    label: 'Wave 1000',
    min: 80 * 60 * 60,
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
  }
}

export function captureAct1Snapshot(
  state: GameState,
  at: string,
  activeSeconds: number,
  calendarSeconds: number,
  salvageEarned = 0,
): Act1Snapshot {
  const research = state.hiveResearch?.completed ?? { material: 0, energy: 0, observation: 0, computation: 0 }
  const material = research.material ?? 0
  const energy = research.energy ?? 0
  const observation = research.observation ?? 0
  const computation = research.computation ?? 0
  let bts = 0
  for (const n of [material, energy, observation, computation]) {
    for (let i = 0; i < n; i++) if (isResearchBreakthroughIndex(i)) bts += 1
  }
  const relays = 0
  const recipes = FOUNDRY_RECIPES.filter((r) => (state.foundry.masteryXp[r.id] ?? 0) > 0).length
  const challengeMedals = Object.values(state.challenges?.medals ?? {}).reduce((s, n) => s + (n ?? 0), 0)
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
    furnaceSlots: furnaceChannelLimit(state),
    furnaceLit: state.furnace.ignited ? furnaceSelectedCount(state.furnace.channels) : 0,
    heat: state.resources.heat ?? 0,
    research: {
      material,
      energy,
      observation,
      computation,
      focus: state.hiveResearch?.focus ?? 'material',
    },
    researchBreakthroughs: bts,
    processEarned: processEarned(state),
    processAvailable: state.resources.aiPoints,
    processPurchased: state.process?.purchased.length ?? 0,
    rebuilds: state.prestige.prestigeCount,
    challengeMedals,
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
