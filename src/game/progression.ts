/** Act 1 spine, system gates, achievements, and guided onboarding. */

import type { GameState, Resources, TabId } from './types'
import { taskListComplete } from './tasks'
import { noteHighestSector } from './playtest'
import {
  ACT1_CADENCE,
  ACT1_FINAL_WAVE,
  PROCESS_MIN_REBUILDS,
  PROCESS_MIN_RESEARCH,
} from './cadence'
import { careerBestWave, meetsWave } from './waves'
import { rebuildDoorMet } from './rebuild'

export {
  WAVES_PER_SECTOR,
  isSectorBossWave,
  trashWavesForSector,
  wavesForSector,
} from './sectors'

export { careerBestWave, meetsWave, ACT1_FINAL_WAVE }

/** Soft campaign climax — W300 maps to 30 ten-wave bands for leftover sector gates. */
export const ACT1_FINAL_SECTOR = 30

/** Rebuild gate is career best Wave (GDD §102). Name kept for import churn. */
export const PRESTIGE_MIN_SECTOR = ACT1_CADENCE.rebuild
export const FOUNDRY_UNLOCK_SECTOR = ACT1_CADENCE.foundry

export type SystemId = Exclude<
  TabId,
  'dock' | 'combat' | 'cores' | 'network' | 'foundry' | 'shipyard' | 'stats'
>

export interface SystemUnlockDef {
  id: SystemId
  /** Career best Wave required (0 = always). */
  requiresSectorEver: number
  /** Optional research gate after the sector gate. */
  requiresResearch?: string
  label: string
  tip: string
}

/**
 * Whole systems unlock by career progress. Locked More stations stay listed with requirements.
 * Dock and Sortie are always available. Salvage and More wait for the first hull loss.
 * Foundry, Worker Drones, Furnace, Research, and Process share Systems.
 */
export const SYSTEM_UNLOCKS: SystemUnlockDef[] = [
  {
    id: 'base',
    requiresSectorEver: ACT1_CADENCE.workers,
    label: 'Worker Drones',
    tip: 'Assign Worker Drones to industrial jobs.',
  },
  {
    id: 'reliquary',
    requiresSectorEver: ACT1_CADENCE.reliquary,
    label: 'Relics',
    tip: 'Relics install into fitted Cores while Docked.',
  },
  {
    id: 'furnace',
    requiresSectorEver: ACT1_CADENCE.furnace,
    label: 'Furnace',
    tip: 'Spend Heat on temporary ship boosts.',
  },
  {
    id: 'yard',
    requiresSectorEver: ACT1_CADENCE.yard,
    label: 'Construction',
    tip: 'Foundry construction. Place processing gear; arms apply on the next Rebuild.',
  },
  {
    id: 'slag',
    requiresSectorEver: 0,
    label: 'Matter',
    tip: 'Spend Rebuild Matter inside the Rebuild hangar.',
  },
  {
    id: 'protocols',
    requiresSectorEver: ACT1_CADENCE.protocols,
    label: 'Challenges',
    tip: 'Solve a modified version of the normal Sortie rules.',
  },
  {
    id: 'echo',
    requiresSectorEver: 999,
    label: 'Echo Runs',
    tip: 'Retired. Challenges cover alternate combat tests.',
  },
  {
    id: 'process',
    requiresSectorEver: ACT1_CADENCE.process,
    label: 'Process',
    tip: 'Automate behaviours you have already learned.',
  },
  {
    id: 'specialists',
    requiresSectorEver: ACT1_CADENCE.specialists,
    label: 'Specialists',
    tip: 'Deferred from Act 1. Frame, Core, and Relic identity is enough.',
  },
  {
    id: 'tasks',
    requiresSectorEver: ACT1_CADENCE.tasks,
    label: 'Task List',
    tip: 'Deferred from Act 1. Capital stays shut until this list exists.',
  },
  {
    id: 'capital',
    requiresSectorEver: ACT1_CADENCE.capital,
    label: 'Capital',
    tip: 'Upgrade Broadside, Bulkhead, and Hold with Salvage and Heat.',
  },
  {
    id: 'reinforce',
    requiresSectorEver: ACT1_CADENCE.reinforce,
    label: 'Reinforce',
    tip: 'Clear Wave 300. Rebuild has reached the limit of this loop.',
  },
  {
    id: 'logs',
    requiresSectorEver: 0,
    label: 'Foundry Logs',
    tip: 'Short industrial notes as doors open.',
  },
  {
    id: 'research',
    requiresSectorEver: ACT1_CADENCE.research,
    label: 'Research',
    tip: 'Start one Research project. Sensor Net drones speed it up.',
  },
  {
    id: 'codex',
    requiresSectorEver: ACT1_CADENCE.codex,
    label: 'Codex',
    tip: 'Optional reference for enemy families and hull roles.',
  },
  {
    id: 'core',
    requiresSectorEver: ACT1_CADENCE.research + 2,
    requiresResearch: 'core-training',
    label: 'Core',
    tip: 'Assign workers to training stations to raise Core attributes. Ranks wipe on prestige.',
  },
  {
    id: 'ai',
    requiresSectorEver: ACT1_CADENCE.process,
    label: 'Process',
    tip: 'Spend Process Points on automation and quality-of-life upgrades.'
  },
  {
    id: 'prestige',
    requiresSectorEver: ACT1_CADENCE.rebuild,
    label: 'Rebuild',
    tip: 'Rebuild to swap hull and Cores. Permanent systems stay.',
  },
]

export type AchievementCondition =
  | { type: 'sector-ever'; sector: number }
  | { type: 'research-count'; min: number }
  | { type: 'prestige-count'; min: number }
  | { type: 'ai-purchase-count'; min: number }
  | { type: 'act1-cleared' }
  | { type: 'ascension-count'; min: number }
  | { type: 'challenge-clears-total'; min: number }
  | { type: 'modules-unlocked'; min: number }
  | { type: 'core-rank-sum'; min: number }
  | { type: 'lifetime-sectors'; min: number }
  | { type: 'lifetime-waves'; min: number }
  | { type: 'lifetime-fab-crafts'; min: number }
  | { type: 'lifetime-core-merges'; min: number }
  | { type: 'module-level-sum'; min: number }
  | { type: 'network-level-sum'; min: number }
  | { type: 'foundry-recipe-level'; recipeId: string; min: number }
  | { type: 'furnace-rank-sum'; min: number }
  | { type: 'reliquary-fitted'; min: number }
  | { type: 'hive-research-nodes'; min: number }
  | { type: 'protocol-rank-sum'; min: number }
  | { type: 'echo-clear-sum'; min: number }
  | { type: 'yard-building-count'; min: number }

export interface AchievementDef {
  id: string
  name: string
  description: string
  rewardAiPoints: number
  condition: AchievementCondition
  /** Claimable repeatedly as the counter climbs. */
  repeatable?: boolean
  /** Added to the base threshold per prior completion (defaults to base threshold). */
  repeatStep?: number
  /** Optional hard cap on repeatable tiers. */
  maxCompletions?: number
}

/** AI Points come from achievements, not combat drops. */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-blood',
    name: 'First Blood',
    description: 'Clear sector 1. Starts banking Process Points for later automation.',
    rewardAiPoints: 4,
    condition: { type: 'sector-ever', sector: 1 },
  },
  {
    id: 'chip-drawer',
    name: 'Chip Drawer',
    description: 'Clear sector 3. Shard signatures are now detectable.',
    rewardAiPoints: 2,
    condition: { type: 'sector-ever', sector: 3 },
  },
  {
    id: 'hangar-opened',
    name: 'Hangar Opened',
    description: 'Clear sector 4.',
    rewardAiPoints: 2,
    condition: { type: 'sector-ever', sector: 4 },
  },
  {
    id: 'first-boss',
    name: 'First Titan',
    description: 'Clear sector 5 (first boss sector).',
    rewardAiPoints: 2,
    condition: { type: 'sector-ever', sector: 5 },
  },
  {
    id: 'archive-open',
    name: 'Archive Open',
    description: 'Clear sector 7. Archive telemetry begins accumulating.',
    rewardAiPoints: 2,
    condition: { type: 'sector-ever', sector: 7 },
  },
  {
    id: 'first-research',
    name: 'Archive Seed',
    description: 'Complete any research project.',
    rewardAiPoints: 1,
    condition: { type: 'research-count', min: 1 },
  },
  {
    id: 'neural-link',
    name: 'Neural Link',
    description: 'Purchase any Process node.',
    rewardAiPoints: 1,
    condition: { type: 'ai-purchase-count', min: 1 },
  },
  {
    id: 'first-prestige',
    name: 'Soft Reset',
    description: 'Rebuild hangar for the first time.',
    rewardAiPoints: 2,
    condition: { type: 'prestige-count', min: 1 },
  },
  {
    id: 'sector-10',
    name: 'Deep Push',
    description: 'Clear sector 10.',
    rewardAiPoints: 2,
    condition: { type: 'sector-ever', sector: 10 },
  },
  {
    id: 'sector-15',
    name: 'Combat Corps',
    description: 'Clear sector 15.',
    rewardAiPoints: 2,
    condition: { type: 'sector-ever', sector: 15 },
  },
  {
    id: 'sector-20',
    name: 'Void Line',
    description: 'Clear sector 20.',
    rewardAiPoints: 2,
    condition: { type: 'sector-ever', sector: 20 },
  },
  {
    id: 'sector-25',
    name: 'Outer Rim',
    description: 'Clear sector 25.',
    rewardAiPoints: 3,
    condition: { type: 'sector-ever', sector: 25 },
  },
  {
    id: 'act1-clear',
    name: 'Exodus Gate',
    description: 'Clear sector 30 and finish Act 1.',
    rewardAiPoints: 3,
    condition: { type: 'act1-cleared' },
  },
  {
    id: 'first-ascension',
    name: 'Second Horizon',
    description: 'Ascend for the first time after Act 1.',
    rewardAiPoints: 5,
    condition: { type: 'ascension-count', min: 1 },
  },
  {
    id: 'prestiges-5',
    name: 'Reset Rhythm',
    description: 'Rebuild hangar 5 times.',
    rewardAiPoints: 3,
    condition: { type: 'prestige-count', min: 5 },
  },
  {
    id: 'prestiges-10',
    name: 'Matter Engine',
    description: 'Rebuild hangar 10 times.',
    rewardAiPoints: 4,
    condition: { type: 'prestige-count', min: 10 },
  },
  {
    id: 'modules-4',
    name: 'Loadout Kit',
    description: 'Unlock 4 ship modules.',
    rewardAiPoints: 2,
    condition: { type: 'modules-unlocked', min: 4 },
  },
  {
    id: 'modules-8',
    name: 'Arsenal Wing',
    description: 'Unlock 8 ship modules.',
    rewardAiPoints: 3,
    condition: { type: 'modules-unlocked', min: 8 },
  },
  {
    id: 'core-sum-10',
    name: 'Neural Bloom',
    description: 'Reach 10 total Core attribute ranks in a run.',
    rewardAiPoints: 2,
    condition: { type: 'core-rank-sum', min: 10 },
  },
  {
    id: 'core-sum-25',
    name: 'Neural Cascade',
    description: 'Reach 25 total Core attribute ranks in a run.',
    rewardAiPoints: 3,
    condition: { type: 'core-rank-sum', min: 25 },
  },
  {
    id: 'challenge-first',
    name: 'Trial Runner',
    description: 'Complete any challenge once.',
    rewardAiPoints: 3,
    condition: { type: 'challenge-clears-total', min: 1 },
  },
  {
    id: 'challenge-5',
    name: 'Trial Circuit',
    description: 'Complete 5 challenge clears (any mix).',
    rewardAiPoints: 4,
    condition: { type: 'challenge-clears-total', min: 5 },
  },
  {
    id: 'fab-first',
    name: 'Bay Online',
    description: 'Complete one Fabrication Bay craft.',
    rewardAiPoints: 2,
    condition: { type: 'lifetime-fab-crafts', min: 1 },
  },
  {
    id: 'merge-first',
    name: 'Signal Fold',
    description: 'Merge Signal Cores once.',
    rewardAiPoints: 2,
    condition: { type: 'lifetime-core-merges', min: 1 },
  },
  {
    id: 'core-hands',
    name: 'Hands On Cores',
    description: 'Rank Cores to a combined 2 run levels.',
    rewardAiPoints: 2,
    condition: { type: 'module-level-sum', min: 2 },
  },
  {
    id: 'network-cycle',
    name: 'First Cycle',
    description: 'Reach 4 total Network bar levels.',
    rewardAiPoints: 2,
    condition: { type: 'network-level-sum', min: 4 },
  },
  {
    id: 'foundry-stock',
    name: 'Stock Plate',
    description: 'Raise Slag Ingot to rank 4.',
    rewardAiPoints: 2,
    condition: { type: 'foundry-recipe-level', recipeId: 'slag-ingot', min: 4 },
  },
  {
    id: 'foundry-plate',
    name: 'Plate Line',
    description: 'Raise Slag Ingot to rank 8.',
    rewardAiPoints: 3,
    condition: { type: 'foundry-recipe-level', recipeId: 'slag-ingot', min: 8 },
  },
  {
    id: 'furnace-lit',
    name: 'Heat Lit',
    description: 'Light a Furnace Channel or buy a Furnace upgrade.',
    rewardAiPoints: 2,
    condition: { type: 'furnace-rank-sum', min: 1 },
  },
  {
    id: 'shard-seat',
    name: 'Relic Seated',
    description: 'Install a Relic into a Core.',
    rewardAiPoints: 2,
    condition: { type: 'reliquary-fitted', min: 1 },
  },
  {
    id: 'archive-three',
    name: 'Archive Habit',
    description: 'Complete 3 Research nodes.',
    rewardAiPoints: 3,
    condition: { type: 'hive-research-nodes', min: 3 },
  },
  {
    id: 'protocol-clear',
    name: 'Challenge Cleared',
    description: 'Complete any Challenge.',
    rewardAiPoints: 3,
    condition: { type: 'protocol-rank-sum', min: 1 },
  },
  {
    id: 'echo-clear',
    name: 'Echo Mapped',
    description: 'Complete an Echo run.',
    rewardAiPoints: 3,
    condition: { type: 'echo-clear-sum', min: 1 },
  },
  {
    id: 'yard-plot',
    name: 'Yard Plot',
    description: 'Place a Yard building.',
    rewardAiPoints: 2,
    condition: { type: 'yard-building-count', min: 1 },
  },
  // --- Repeatables (long AIP sink) ---
  {
    id: 'sector-grind',
    name: 'Sector Patrol',
    description: 'Every 50 lifetime sector clears. Repeatable.',
    rewardAiPoints: 1,
    condition: { type: 'lifetime-sectors', min: 50 },
    repeatable: true,
    repeatStep: 50,
  },
  {
    id: 'wave-grind',
    name: 'Wave Battery',
    description: 'Every 200 lifetime wave clears. Repeatable.',
    rewardAiPoints: 1,
    condition: { type: 'lifetime-waves', min: 200 },
    repeatable: true,
    repeatStep: 200,
  },
  {
    id: 'prestige-grind',
    name: 'Rebuild Loop',
    description: 'Every 3 Rebuilds. Repeatable.',
    rewardAiPoints: 2,
    condition: { type: 'prestige-count', min: 3 },
    repeatable: true,
    repeatStep: 3,
  },
  {
    id: 'fab-grind',
    name: 'Assembly Line',
    description: 'Every 5 Fabrication Bay crafts. Repeatable.',
    rewardAiPoints: 1,
    condition: { type: 'lifetime-fab-crafts', min: 5 },
    repeatable: true,
    repeatStep: 5,
  },
  {
    id: 'merge-grind',
    name: 'Collider Duty',
    description: 'Every 8 Signal Core merges. Repeatable.',
    rewardAiPoints: 1,
    condition: { type: 'lifetime-core-merges', min: 8 },
    repeatable: true,
    repeatStep: 8,
  },
  {
    id: 'challenge-grind',
    name: 'Trial Spiral',
    description: 'Every 3 challenge clears. Repeatable.',
    rewardAiPoints: 3,
    condition: { type: 'challenge-clears-total', min: 3 },
    repeatable: true,
    repeatStep: 3,
  },
]

export function careerHighestSector(state: GameState): number {
  return Math.max(state.meta.highestSectorEver, state.combat.highestSector)
}

export function isAchievementUnlocked(state: GameState, id: string): boolean {
  return state.meta.completedAchievements.includes(id)
}

export function achievementCompletions(state: GameState, id: string): number {
  return Math.max(0, state.meta.achievementCompletions?.[id] ?? 0)
}

export function achievementBaseThreshold(condition: AchievementCondition): number {
  switch (condition.type) {
    case 'sector-ever':
      return condition.sector
    case 'act1-cleared':
      return 1
    case 'research-count':
    case 'prestige-count':
    case 'ai-purchase-count':
    case 'ascension-count':
    case 'challenge-clears-total':
    case 'modules-unlocked':
    case 'core-rank-sum':
    case 'lifetime-sectors':
    case 'lifetime-waves':
    case 'lifetime-fab-crafts':
    case 'lifetime-core-merges':
    case 'module-level-sum':
    case 'network-level-sum':
    case 'furnace-rank-sum':
    case 'reliquary-fitted':
    case 'hive-research-nodes':
    case 'protocol-rank-sum':
    case 'echo-clear-sum':
    case 'yard-building-count':
      return condition.min
    case 'foundry-recipe-level':
      return condition.min
  }
}

export function achievementProgressValue(
  state: GameState,
  condition: AchievementCondition,
): number {
  switch (condition.type) {
    case 'sector-ever':
      return careerHighestSector(state)
    case 'research-count':
      return state.research.unlocked.length
    case 'prestige-count':
      return state.prestige.prestigeCount
    case 'ai-purchase-count':
      return state.ai.purchased.length + (state.process?.purchased.length ?? 0)
    case 'act1-cleared':
      return state.meta.act1Cleared || careerHighestSector(state) >= ACT1_FINAL_SECTOR
        ? 1
        : 0
    case 'ascension-count':
      return state.meta.ascensionCount ?? 0
    case 'challenge-clears-total':
      return Object.values(state.prestige.challengeClears).reduce((a, b) => a + b, 0)
    case 'modules-unlocked':
      return state.shipyard.unlockedModules.length
    case 'core-rank-sum':
      return Object.values(state.core?.ranks ?? {}).reduce((a, b) => a + b, 0)
    case 'lifetime-sectors':
      return state.meta.lifetimeSectorClears ?? 0
    case 'lifetime-waves':
      return state.meta.lifetimeWaveClears ?? 0
    case 'lifetime-fab-crafts':
      return state.meta.lifetimeFabCrafts ?? 0
    case 'lifetime-core-merges':
      return state.meta.lifetimeCoreMerges ?? 0
    case 'module-level-sum':
      return Object.values(state.shipyard.moduleLevels ?? {}).reduce((a, b) => a + b, 0)
    case 'network-level-sum':
      return Object.values(state.network?.bars ?? {}).reduce((a, b) => a + (b?.levels ?? 0), 0)
    case 'foundry-recipe-level':
      return state.foundry?.recipeLevels?.[condition.recipeId] ?? 0
    case 'furnace-rank-sum':
      return (
        Object.values(state.furnace?.upgrades ?? {}).reduce((a, b) => a + b, 0) +
        Object.values(state.furnace?.wanted ?? {}).reduce((a, b) => a + b, 0)
      )
    case 'reliquary-fitted': {
      let n = 0
      for (const slots of Object.values(state.reliquary?.coreFits ?? {})) {
        if (Array.isArray(slots)) n += slots.filter(Boolean).length
        else if (slots) n += 1
      }
      return n
    }
    case 'hive-research-nodes':
      return Object.values(state.hiveResearch?.completed ?? {}).reduce((a, b) => a + b, 0)
    case 'protocol-rank-sum':
      return Object.values(state.protocols?.ranks ?? {}).reduce((a, b) => a + b, 0)
    case 'echo-clear-sum':
      return Object.values(state.echo?.clears ?? {}).reduce((a, b) => a + b, 0)
    case 'yard-building-count':
      return (state.yard?.cells ?? []).filter((c) => c.buildingId).length
  }
}

export function achievementConditionMet(
  state: GameState,
  condition: AchievementCondition,
  thresholdOverride?: number,
): boolean {
  const need = thresholdOverride ?? achievementBaseThreshold(condition)
  return achievementProgressValue(state, condition) >= need
}

/** Next threshold for a (possibly repeatable) achievement. */
export function achievementNextThreshold(
  state: GameState,
  def: AchievementDef,
): number {
  const base = achievementBaseThreshold(def.condition)
  if (!def.repeatable) return base
  const done = achievementCompletions(state, def.id)
  const step = def.repeatStep ?? base
  return base + done * step
}

function grantAchievementTier(state: GameState, def: AchievementDef): void {
  if (!state.meta.achievementCompletions) state.meta.achievementCompletions = {}
  const prev = state.meta.achievementCompletions[def.id] ?? 0
  state.meta.achievementCompletions[def.id] = prev + 1
  if (!state.meta.completedAchievements.includes(def.id)) {
    state.meta.completedAchievements = [...state.meta.completedAchievements, def.id]
  }
  state.resources.aiPoints += def.rewardAiPoints
  if (state.process) {
    state.process.earned = (state.process.earned ?? 0) + def.rewardAiPoints
  }
  if (!state.meta.aiUnlocked) state.meta.aiUnlocked = true
  const tier = state.meta.achievementCompletions[def.id]
  const label = def.repeatable ? `${def.name} ×${tier}` : def.name
  state.combat.log = [
    `Achievement: ${label} (+${def.rewardAiPoints} Process).`,
    ...state.combat.log,
  ].slice(0, 40)
}

/** Grant newly completed achievements (mutates). Returns newly completed ids. */
export function tryCompleteAchievements(state: GameState): string[] {
  const newly: string[] = []
  for (const def of ACHIEVEMENTS) {
    if (def.repeatable) {
      let guard = 0
      while (guard++ < 20) {
        const done = achievementCompletions(state, def.id)
        if (def.maxCompletions != null && done >= def.maxCompletions) break
        const need = achievementNextThreshold(state, def)
        if (!achievementConditionMet(state, def.condition, need)) break
        grantAchievementTier(state, def)
        newly.push(def.id)
      }
      continue
    }
    if (state.meta.completedAchievements.includes(def.id)) continue
    if (!achievementConditionMet(state, def.condition)) continue
    grantAchievementTier(state, def)
    newly.push(def.id)
  }
  return newly
}

/** First hull-loss dock — Salvage, Cores spend, Network, and More wait for this. */
export function hasHullLostOnce(state: GameState): boolean {
  return state.meta.hullLostOnce === true || state.combat.lastSortie?.outcome === 'defeat'
}

/** Hub tabs the player may open. First live sortie stays on Sortie until hull loss. */
export function isHubTabOpen(state: GameState, systemId: TabId): boolean {
  if (
    !hasHullLostOnce(state) &&
    !state.combat.docked &&
    (state.combat.defeatLeft ?? 0) <= 0 &&
    systemId !== 'combat'
  ) {
    return false
  }
  return isSystemUnlocked(state, systemId)
}

export function isSystemUnlocked(state: GameState, systemId: TabId): boolean {
  if (systemId === 'dock' || systemId === 'combat' || systemId === 'shipyard') {
    return true
  }
  if (systemId === 'stats') {
    return hasHullLostOnce(state)
  }
  if (systemId === 'network') {
    return meetsWave(state, ACT1_CADENCE.workers)
  }
  if (systemId === 'cores') {
    return false
  }
  if (systemId === 'foundry') {
    const used =
      Object.values(state.foundry?.recipeLevels ?? {}).some((n) => n > 0) ||
      Object.values(state.foundry?.materials ?? {}).some((n) => n > 0) ||
      (state.foundry?.equipped?.length ?? 0) > 0
    return used || meetsWave(state, ACT1_CADENCE.foundry)
  }
  if (systemId === 'slag') {
    return (state.prestige.prestigeCount ?? 0) >= 1 || Object.keys(state.prestige.matterShop ?? {}).length > 0
  }
  if (systemId === 'yard') {
    const used = (state.yard?.cells ?? []).some((cell) => Boolean(cell.buildingId))
    return used || careerBestWave(state) >= ACT1_CADENCE.foundryAdvanced
  }
  if (systemId === 'capital') {
    return meetsWave(state, ACT1_CADENCE.capital) && taskListComplete(state)
  }
  if (systemId === 'logs') {
    return true
  }
  if (systemId === 'ai' || systemId === 'process') {
    const used = (state.process?.purchased?.length ?? 0) > 0 || state.ai.purchased.length > 0
    const researchProgress =
      state.research.unlocked.length +
      Object.values(state.hiveResearch?.completed ?? {}).filter((n) => n > 0).length
    return used || (
      careerBestWave(state) >= ACT1_CADENCE.process &&
      (state.prestige.prestigeCount ?? 0) >= PROCESS_MIN_REBUILDS &&
      researchProgress >= PROCESS_MIN_RESEARCH
    )
  }
  if (systemId === 'codex') {
    return meetsWave(state, ACT1_CADENCE.codex)
  }
  if (systemId === 'research') {
    const used =
      state.research.unlocked.length > 0 ||
      Object.values(state.hiveResearch?.completed ?? {}).some((n) => n > 0)
    return used || meetsWave(state, ACT1_CADENCE.research)
  }
  if (systemId === 'protocols') {
    const used = Boolean(state.protocols?.activeId) || Object.values(state.protocols?.ranks ?? {}).some((n) => n > 0)
    return used || (
      meetsWave(state, ACT1_CADENCE.protocols) &&
      isSystemUnlocked(state, 'process')
    )
  }
  if (systemId === 'echo') {
    return false
  }
  if (systemId === 'reinforce') {
    const used = (state.meta.ascensionCount ?? 0) > 0
    return used || Boolean(state.meta.act1Cleared)
  }
  const def = SYSTEM_UNLOCKS.find((s) => s.id === systemId)
  if (!def) return true
  if (careerBestWave(state) < def.requiresSectorEver) return false
  if (def.requiresResearch && !state.research.unlocked.includes(def.requiresResearch)) {
    return false
  }
  return true
}

export function systemUnlockRequirement(systemId: TabId): string | null {
  if (systemId === 'combat' || systemId === 'shipyard') {
    return null
  }
  if (systemId === 'stats') {
    return 'First hull loss'
  }
  if (systemId === 'network') {
    return `Reach Wave ${ACT1_CADENCE.workers}`
  }
  if (systemId === 'foundry') {
    return `Reach Wave ${ACT1_CADENCE.foundry}`
  }
  if (systemId === 'slag') {
    return 'Rebuild once'
  }
  if (systemId === 'yard') {
    return `Reach Wave ${ACT1_CADENCE.foundryAdvanced}`
  }
  if (systemId === 'capital') {
    return `Reach Wave ${ACT1_CADENCE.capital} · finish the Task List`
  }
  if (systemId === 'logs') {
    return null
  }
  if (systemId === 'ai' || systemId === 'process') {
    return `Reach Wave ${ACT1_CADENCE.process} · Rebuild ${PROCESS_MIN_REBUILDS} times · complete any Research`
  }
  if (systemId === 'protocols') {
    return `Reach Wave ${ACT1_CADENCE.protocols} · Process online`
  }
  if (systemId === 'codex') {
    return `Reach Wave ${ACT1_CADENCE.codex}`
  }
  if (systemId === 'echo') {
    return null
  }
  if (systemId === 'reinforce') {
    return `Clear Wave ${ACT1_CADENCE.reinforce}`
  }
  const def = SYSTEM_UNLOCKS.find((s) => s.id === systemId)
  if (!def) return null
  const parts: string[] = []
  if (def.requiresSectorEver > 0) {
    parts.push(`Reach Wave ${def.requiresSectorEver}`)
  }
  if (def.requiresResearch) {
    parts.push(`Research ${def.requiresResearch}`)
  }
  return parts.join(' · ') || null
}

/** Which header resources are visible for the current career progress. */
export function isResourceVisible(state: GameState, id: keyof Resources): boolean {
  switch (id) {
    case 'scrap':
      return isSystemUnlocked(state, 'foundry')
    case 'alloys':
      return (
        isSystemUnlocked(state, 'base') ||
        state.resources.alloys > 0 ||
        state.research.unlocked.includes('alloy-smelting')
      )
    case 'energy':
      return isSystemUnlocked(state, 'base') || state.resources.energy > 0
    case 'salvage':
      return hasHullLostOnce(state)
    case 'choirAsh':
    case 'heat':
      return isSystemUnlocked(state, 'furnace') || state.resources[id] > 0
    case 'data':
      return isSystemUnlocked(state, 'research')
    case 'essence':
      return state.resources.essence > 0 || careerHighestSector(state) >= 5
    case 'aiPoints':
      return isSystemUnlocked(state, 'process') || isSystemUnlocked(state, 'ai')
    case 'prestigeMatter':
      return (
        state.prestige.prestigeCount > 0 ||
        state.resources.prestigeMatter > 0 ||
        (state.meta.ascensionCount ?? 0) > 0
      )
    case 'challengePoints':
      return (
        state.resources.challengePoints > 0 ||
        Object.values(state.prestige.challengeClears).some((n) => n > 0)
      )
    default:
      return true
  }
}

export function visibleResourceIds(state: GameState): (keyof Resources)[] {
  const order: (keyof Resources)[] = [
    'salvage',
    'choirAsh',
    'heat',
    'scrap',
    'alloys',
    'energy',
    'data',
    'essence',
    'aiPoints',
    'prestigeMatter',
    'challengePoints',
  ]
  return order.filter((id) => isResourceVisible(state, id))
}

function guideSeen(state: GameState, id: string): boolean {
  return state.meta.seenOnboarding.includes(id)
}

/** Dock Rebuild button is live and this career has never Rebuilt. */
export function firstRebuildAvailable(state: GameState): boolean {
  if ((state.prestige.prestigeCount ?? 0) > 0) return false
  return rebuildDoorMet(state)
}

/**
 * Challenges + Challenge shop unlock after the first Act 1 clear (sector 30).
 * Stay visible while a challenge is already running so Abandon remains available.
 */
export function challengesContentUnlocked(state: GameState): boolean {
  if (state.prestige.activeChallengeId) return true
  return state.meta.act1Cleared || meetsWave(state, ACT1_FINAL_WAVE) || careerHighestSector(state) >= ACT1_FINAL_SECTOR
}

/** Grant Base starter drones; update career flags; check achievements. */
export function maybeGrantSystemUnlocks(state: GameState): void {
  const ever = careerHighestSector(state)
  if (ever > state.meta.highestSectorEver) {
    state.meta.highestSectorEver = ever
  }
  noteHighestSector(state, ever)

  if (meetsWave(state, ACT1_CADENCE.codex) && !state.meta.codexUnlocked) {
    state.meta.codexUnlocked = true
  }

  if (ever >= 4 && !state.shipyard.unlockedFrames.includes('line-frame')) {
    state.shipyard.unlockedFrames = [...state.shipyard.unlockedFrames, 'line-frame']
  }
  if (ever >= 8 && !state.shipyard.unlockedFrames.includes('cruiser-frame')) {
    state.shipyard.unlockedFrames = [...state.shipyard.unlockedFrames, 'cruiser-frame']
  }
  if (ever >= 24 && !state.shipyard.unlockedFrames.includes('heavy-cruiser-frame')) {
    state.shipyard.unlockedFrames = [...state.shipyard.unlockedFrames, 'heavy-cruiser-frame']
  }
  if (ever >= 41 && !state.shipyard.unlockedFrames.includes('battlecruiser-frame')) {
    state.shipyard.unlockedFrames = [...state.shipyard.unlockedFrames, 'battlecruiser-frame']
  }
  if (
    ever >= 75 &&
    taskListComplete(state) &&
    !state.shipyard.unlockedFrames.includes('capital-frame')
  ) {
    state.shipyard.unlockedFrames = [...state.shipyard.unlockedFrames, 'capital-frame']
  }

  tryCompleteAchievements(state)
}

/** Clearing the Wave 300 climax reveals Reinforce (GDD §164). */
export function completeAct1(state: GameState): void {
  if (state.meta.act1Cleared) return
  state.meta.act1Cleared = true
  state.combat.log = [
    `Act 1 complete — Wave ${ACT1_FINAL_WAVE}. Rebuild has reached the limit of this loop. Reinforce is open on More.`,
    ...state.combat.log,
  ].slice(0, 40)
}

/* ---------- Guided onboarding (spotlight + directed clicks) ---------- */

/** Old coach-marks fight the GDD Sortie/Dock loop. Keep the catalog for a later rewrite. */
export const ONBOARDING_ENABLED = false

export type GuideKind = 'hint' | 'action' | 'critical'

export interface GuideStep {
  id: string
  title: string
  body: string | string[]
  /** Matches data-guide="…" on UI elements. */
  target: string
  /** Home tab for this lesson. Never auto-switched unless autoTab is set. */
  tab?: TabId
  /** Screen this lesson belongs to. Lessons only show on their home screen. */
  screen?: TabId
  /** Skip dismisses every unseen step that shares this group. */
  group?: string
  /**
   * hint — overlay, sim continues, no input lock.
   * action — spotlight, sim continues, optional required tap.
   * critical — pause + lock. Reserved for irreversible decisions.
   */
  kind?: GuideKind
  /** Override kind-based pause. Critical pauses unless this is false. */
  pause?: boolean
  /** Rare. Prefer toast OPEN / player navigation. */
  autoTab?: boolean
  availableWhen: (state: GameState) => boolean
  /** Optional: auto-complete when predicate becomes true. */
  completeWhen?: (state: GameState, tab: TabId) => boolean
  /** Required lessons hide Skip. */
  required?: boolean
  /** Player must tap the highlighted control. Continue is hidden. */
  tap?: boolean
}

export function guideKind(step: GuideStep): GuideKind {
  return step.kind ?? 'hint'
}

/** Idle sim should keep running for hints and guided actions. */
export function guidePausesSimulation(step: GuideStep | null | undefined): boolean {
  if (!step) return false
  if (step.pause === false) return false
  if (step.pause === true) return true
  return guideKind(step) === 'critical'
}

export function guideAutoTabs(step: GuideStep | null | undefined): boolean {
  return Boolean(step?.autoTab)
}

export function guideBodyLines(step: GuideStep): string[] {
  return Array.isArray(step.body) ? step.body : [step.body]
}

const TAP_TARGETS = new Set([
  'launch',
  'retry-frontier',
  'upgrade-pulse-cannon',
  'upgrade-plate-layer',
  'network-strike-plus',
  'network-ward-plus',
  'worker-scrap-field',
  'worker-power-grid',
  'foundry-recipe-slag-ingot',
  'furnace-channel-weapons',
  'research-focus',
])

/** True when the player must tap the spotlight instead of Continue. */
export function guideStepNeedsTap(step: GuideStep): boolean {
  if (typeof step.tap === 'boolean') return step.tap
  if (step.completeWhen) return true
  const t = step.target
  if (t.endsWith('-tab') || t.startsWith('station-')) return true
  if (t.startsWith('upgrade-') || t.startsWith('core-')) return true
  return TAP_TARGETS.has(t)
}

/** Cores modal should stay open for these spotlight targets. */
export function isCoresGuideTarget(step: GuideStep): boolean {
  const t = step.target
  if (t.startsWith('core-') || t.startsWith('upgrade-')) return true
  return t === 'cores-sheet' && step.id !== 'guide-cores-sheet'
}

function stepLessonScreen(step: GuideStep): TabId | undefined {
  return step.screen ?? step.tab
}

/** Battlefield lessons may run during a live sortie, even on other screens. */
export function isLiveSortieLesson(step: GuideStep): boolean {
  return step.group === 'sortie'
}

/** Lessons stay on their home screen. Live sortie hints may overlay any tab. */
export function stepAllowedOnTab(step: GuideStep, tab: TabId): boolean {
  if (isLiveSortieLesson(step)) return true
  const home = stepLessonScreen(step)
  if (!home) return true
  if (home === tab) return true
  if (step.target === 'launch' && (tab === 'dock' || tab === 'combat')) return true
  if (step.target === 'retry-frontier' && (tab === 'dock' || tab === 'combat')) return true
  return false
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'guide-launch',
    kind: 'hint',
    title: 'Scout ready',
    body: 'Your Scout is ready. Launch a sortie and see how far it gets.',
    target: 'launch',
    tab: 'dock',
    group: 'starter',
    tap: true,
    availableWhen: (s) => s.combat.docked && !s.meta.hullLostOnce && !guideSeen(s, 'guide-launch'),
    completeWhen: (s) => !s.combat.docked || Boolean(s.shipyard.frameLocked),
  },
  {
    id: 'guide-sortie-fire',
    kind: 'hint',
    title: 'Weapons live',
    body: 'Weapons fire automatically.',
    target: 'sortie-canvas',
    tab: 'combat',
    screen: 'combat',
    group: 'sortie',
    tap: false,
    availableWhen: (s) =>
      !s.combat.docked &&
      (s.combat.defeatLeft ?? 0) <= 0 &&
      (s.resources.salvage ?? 0) <= 0 &&
      !s.meta.hullLostOnce &&
      !guideSeen(s, 'guide-sortie-fire'),
    completeWhen: (s) => (s.resources.salvage ?? 0) > 0 || Boolean(s.meta.hullLostOnce),
  },
  {
    id: 'guide-salvage-first',
    kind: 'hint',
    title: 'Salvage recovered',
    body: 'Spend Salvage to strengthen this run. Tap Weapon Power.',
    target: 'run-upgrade-weapon-power',
    tab: 'combat',
    screen: 'combat',
    group: 'sortie',
    tap: false,
    availableWhen: (s) =>
      !s.combat.docked &&
      (s.combat.defeatLeft ?? 0) <= 0 &&
      (s.resources.salvage ?? 0) > 0 &&
      !s.meta.hullLostOnce &&
      !guideSeen(s, 'guide-salvage-first'),
    completeWhen: (s) => Boolean(s.meta.hullLostOnce) || (s.combat.wave ?? 1) >= 2,
  },
  {
    id: 'guide-upgrade-pulse',
    kind: 'action',
    title: 'Pulse Cannon',
    body: 'Rank Pulse at Dock with Scrap.',
    target: 'upgrade-pulse-cannon',
    tab: 'dock',
    screen: 'dock',
    group: 'cores',
    required: true,
    tap: true,
    availableWhen: (s) =>
      hasHullLostOnce(s) &&
      (s.shipyard.moduleLevels['pulse-cannon'] ?? 0) < 1 &&
      !guideSeen(s, 'guide-upgrade-pulse'),
    completeWhen: (s) => (s.shipyard.moduleLevels['pulse-cannon'] ?? 0) >= 1,
  },
  {
    id: 'guide-upgrade-plate',
    kind: 'action',
    title: 'Plate',
    body: 'Rank Plate at Dock with Scrap.',
    target: 'upgrade-plate-layer',
    tab: 'dock',
    screen: 'dock',
    group: 'cores',
    required: true,
    tap: true,
    availableWhen: (s) =>
      hasHullLostOnce(s) &&
      (s.shipyard.moduleLevels['pulse-cannon'] ?? 0) >= 1 &&
      (s.shipyard.moduleLevels['plate-layer'] ?? 0) < 1 &&
      !guideSeen(s, 'guide-upgrade-plate'),
    completeWhen: (s) => (s.shipyard.moduleLevels['plate-layer'] ?? 0) >= 1,
  },
  {
    id: 'guide-cores-persist',
    kind: 'hint',
    title: 'Cores last',
    body: 'Scrap ranks stay until Rebuild. Equip Cores at Dock, not mid-Sortie.',
    target: 'dock-cores',
    tab: 'dock',
    screen: 'dock',
    group: 'cores',
    tap: false,
    availableWhen: (s) =>
      hasHullLostOnce(s) &&
      (s.shipyard.moduleLevels['pulse-cannon'] ?? 0) >= 1 &&
      (s.shipyard.moduleLevels['plate-layer'] ?? 0) >= 1 &&
      !guideSeen(s, 'guide-cores-persist'),
  },
  {
    id: 'guide-relaunch',
    kind: 'action',
    title: 'Launch again',
    body: 'Every Sortie starts at Wave 1. Workshop levels raise the starting baseline; Sortie purchase costs still start cheap. Spend Scrap, then launch.',
    target: 'launch',
    tab: 'dock',
    screen: 'dock',
    group: 'starter',
    tap: true,
    availableWhen: (s) =>
      hasHullLostOnce(s) &&
      (s.shipyard.moduleLevels['pulse-cannon'] ?? 0) >= 1 &&
      !guideSeen(s, 'guide-relaunch') &&
      s.combat.docked,
    completeWhen: (s) => !s.combat.docked,
  },
  {
    id: 'guide-network-strike',
    kind: 'action',
    title: 'Assign Worker Drones',
    body: 'Put a Worker Drone on Scrap Field.',
    target: 'worker-scrap-field',
    tab: 'network',
    screen: 'network',
    group: 'network',
    tap: true,
    availableWhen: (s) =>
      hasHullLostOnce(s) &&
      (s.base.assignments['scrap-field'] ?? 0) < 1 &&
      !guideSeen(s, 'guide-network-strike'),
    completeWhen: (s) => (s.base.assignments['scrap-field'] ?? 0) >= 1,
  },
  {
    id: 'guide-network-ward',
    kind: 'hint',
    title: 'Split the corps',
    body: 'Jobs have a hard cap. Extra drones on a full job do nothing.',
    target: 'worker-power-grid',
    tab: 'network',
    screen: 'network',
    group: 'network',
    tap: true,
    availableWhen: (s) =>
      (s.base.assignments['scrap-field'] ?? 0) >= 1 &&
      (s.base.assignments['power-grid'] ?? 0) < 1 &&
      !guideSeen(s, 'guide-network-ward'),
    completeWhen: (s) => (s.base.assignments['power-grid'] ?? 0) >= 1,
  },
  {
    id: 'guide-foundry-recipe',
    kind: 'action',
    title: 'Smelt',
    body: 'Choose Slag Ingot.',
    target: 'foundry-recipe-slag-ingot',
    tab: 'foundry',
    screen: 'foundry',
    group: 'foundry',
    tap: true,
    availableWhen: (s) =>
      isSystemUnlocked(s, 'foundry') &&
      !(s.foundry?.slots ?? []).some((slot) => slot.recipeId) &&
      (s.foundry?.recipeLevels?.['slag-ingot'] ?? 0) < 1 &&
      !guideSeen(s, 'guide-foundry-recipe'),
    completeWhen: (s) =>
      (s.foundry?.slots ?? []).some((slot) => slot.recipeId === 'slag-ingot') ||
      (s.foundry?.recipeLevels?.['slag-ingot'] ?? 0) >= 1,
  },
  {
    id: 'guide-foundry-mastery',
    kind: 'hint',
    title: 'Recipe level increased',
    body: 'Repeated crafting makes this recipe faster.',
    target: 'foundry-recipe-slag-ingot',
    tab: 'foundry',
    screen: 'foundry',
    group: 'foundry',
    tap: false,
    availableWhen: (s) =>
      isSystemUnlocked(s, 'foundry') &&
      (s.foundry?.recipeLevels?.['slag-ingot'] ?? 0) >= 1 &&
      !guideSeen(s, 'guide-foundry-mastery'),
  },
  {
    id: 'guide-furnace-light',
    kind: 'action',
    title: 'Weapons I',
    body: 'Spend Heat to power a temporary damage boost.',
    target: 'furnace-channel-weapons',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace',
    tap: true,
    availableWhen: (s) =>
      isSystemUnlocked(s, 'furnace') &&
      (s.furnace?.wanted?.weapons ?? 0) < 1 &&
      !guideSeen(s, 'guide-furnace-light'),
    completeWhen: (s) => (s.furnace?.wanted?.weapons ?? 0) >= 1,
  },
  {
    id: 'guide-research-focus',
    kind: 'hint',
    title: 'Focus',
    body: 'Focus a branch to speed up its research.',
    target: 'research-focus',
    tab: 'research',
    screen: 'research',
    group: 'research',
    tap: true,
    availableWhen: (s) => isSystemUnlocked(s, 'research') && !guideSeen(s, 'guide-research-focus'),
  },
]

/** Dock/launch/sortie/cores tips that must not reappear after the first soft reset. */
export const STARTER_GUIDE_IDS = [
  'guide-launch',
  'guide-sortie-fire',
  'guide-salvage-first',
  'guide-upgrade-pulse',
  'guide-upgrade-plate',
  'guide-cores-persist',
  'guide-relaunch',
] as const

/** First Network assignment. Skip dismisses Strike and Ward. */
export const NETWORK_GUIDE_IDS = ['guide-network-strike', 'guide-network-ward'] as const

export const NETWORK_RELAY_GUIDE_IDS = [] as const

export const PROTOCOL_V2_GUIDE_IDS = [] as const

export const FOUNDRY_V2_GUIDE_IDS = ['guide-foundry-recipe', 'guide-foundry-mastery'] as const

export const RESEARCH_V2_GUIDE_IDS = ['guide-research-focus'] as const

/** Rebuild uses the hangar KEEP/RESET modal, not a spotlight tour. */
export const REBUILD_GUIDE_IDS = [] as const

export const FURNACE_V2_GUIDE_IDS = ['guide-furnace-light'] as const

function markGuideSeen(seen: string[], id: string): boolean {
  if (seen.includes(id)) return false
  seen.push(id)
  return true
}

/**
 * After Rebuild / Reinforce, retire starter dock/launch tips.
 * Reinforced careers skip the full onboarding catalog — they already cleared Act 1.
 */
export function retirePostResetOnboarding(state: GameState): void {
  const seen = [...(state.meta.seenOnboarding ?? [])]
  let changed = false
  const prestiged = state.prestige.prestigeCount > 0
  const ascended = (state.meta.ascensionCount ?? 0) > 0

  if (prestiged || ascended) {
    for (const id of STARTER_GUIDE_IDS) {
      if (markGuideSeen(seen, id)) changed = true
    }
    for (const id of REBUILD_GUIDE_IDS) {
      if (markGuideSeen(seen, id)) changed = true
    }
    if ((state.meta.starterCombatLesson ?? 0) < 2) {
      state.meta.starterCombatLesson = 2
      changed = true
    }
    if (!state.meta.hullLostOnce) {
      state.meta.hullLostOnce = true
      changed = true
    }
  }

  if (ascended) {
    for (const step of GUIDE_STEPS) {
      if (markGuideSeen(seen, step.id)) changed = true
    }
  }

  if (changed) state.meta.seenOnboarding = seen
}

/**
 * Acknowledge guide steps whose completeWhen already holds so they do not
 * resurface after a run reset (docked again, empty assignments, etc.).
 */
export function syncCompletedGuides(state: GameState, tab: TabId): GameState {
  if (!ONBOARDING_ENABLED) return state
  const seen = [...(state.meta.seenOnboarding ?? [])]
  let changed = false
  for (const step of GUIDE_STEPS) {
    if (seen.includes(step.id)) continue
    if (!step.completeWhen?.(state, tab)) continue
    const probe: GameState = {
      ...state,
      meta: { ...state.meta, seenOnboarding: seen },
    }
    const dockedProbe: GameState = {
      ...probe,
      combat: { ...probe.combat, docked: true, defeatLeft: 0 },
    }
    // Launch/relaunch are available while docked and complete once flying.
    if (!step.availableWhen(probe) && !step.availableWhen(dockedProbe)) continue
    seen.push(step.id)
    changed = true
  }
  if (!changed) return state
  const next = structuredClone(state)
  next.meta.seenOnboarding = seen
  return next
}

/** Hangar-sheet lessons wait until Rebuild hangar is actually open. */
export function isHangarGuideStep(step: GuideStep): boolean {
  return step.group === 'rebuild' && step.target.startsWith('hangar-')
}

/** True while a sortie is live — station doors wait until Dock. Battlefield lessons may still start. */
/** True while a first live sortie is running — station doors wait until hull loss or Dock. */
export function guideQueueQuiet(state: GameState): boolean {
  if (hasHullLostOnce(state)) return false
  return !state.combat.docked || (state.combat.defeatLeft ?? 0) > 0
}

function guideStepReady(
  state: GameState,
  tab: TabId,
  step: GuideStep,
): boolean {
  if (guideSeen(state, step.id)) return false
  if (!step.availableWhen(state)) return false
  if (step.completeWhen?.(state, tab)) return false
  return true
}

/**
 * Next coach-mark. `heldId` keeps the visible step until it completes so a
 * new unlock (first Salvage, Foundry, Reliquary, …) cannot steal Continue.
 * Fresh station doors wait until the ship is docked. Battlefield lessons
 * (`group: 'sortie'`) may start during a live fight. A parked system screen
 * only shows that system's tour — the next door waits until More or Dock.
 */
export function activeGuideStep(
  state: GameState,
  tab: TabId,
  heldId?: string | null,
  ui?: { hangarOpen?: boolean },
): GuideStep | null {
  if (!ONBOARDING_ENABLED) return null
  const hangarOpen = Boolean(ui?.hangarOpen)
  const eligible = (step: GuideStep): boolean =>
    guideStepReady(state, tab, step) && stepAllowedOnTab(step, tab)
  const pick = (step: GuideStep): GuideStep | 'wait' | null => {
    if (!eligible(step)) return null
    if (isHangarGuideStep(step) && !hangarOpen) return 'wait'
    return step
  }
  if (heldId) {
    const held = GUIDE_STEPS.find((step) => step.id === heldId)
    if (held) {
      const picked = pick(held)
      if (picked === 'wait') return null
      if (
        picked &&
        (!guideQueueQuiet(state) ||
          isLiveSortieLesson(held) ||
          held.tab === 'combat')
      ) {
        return picked
      }
    }
  }
  if (guideQueueQuiet(state)) {
    for (const step of GUIDE_STEPS) {
      if (!isLiveSortieLesson(step)) continue
      const picked = pick(step)
      if (picked === 'wait') return null
      if (picked) return picked
    }
    return null
  }
  for (const step of GUIDE_STEPS) {
    const picked = pick(step)
    if (picked === 'wait') return null
    if (picked) return picked
  }
  return null
}

export function acknowledgeOnboarding(state: GameState, tipId: string): GameState {
  if (state.meta.seenOnboarding.includes(tipId)) return state
  const next = structuredClone(state)
  next.meta.seenOnboarding = [...next.meta.seenOnboarding, tipId]
  return next
}

/** First hull loss finishes the live-lane tour so it does not replay on the next sortie. */
export function retireLiveSortieGuides(state: GameState): void {
  const seen = [...(state.meta.seenOnboarding ?? [])]
  let changed = false
  for (const step of GUIDE_STEPS) {
    if (step.group !== 'sortie') continue
    if (seen.includes(step.id)) continue
    seen.push(step.id)
    changed = true
  }
  if (changed) state.meta.seenOnboarding = seen
}

/** Skip dismisses this step and every other unseen step in its group. */
export function skipOnboarding(state: GameState, tipId: string): GameState {
  const step = GUIDE_STEPS.find((s) => s.id === tipId)
  const ids = step?.group
    ? GUIDE_STEPS.filter((s) => s.group === step.group).map((s) => s.id)
    : [tipId]
  const seen = new Set(state.meta.seenOnboarding)
  let changed = false
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id)
      changed = true
    }
  }
  if (!changed) return state
  const next = structuredClone(state)
  next.meta.seenOnboarding = [...seen]
  return next
}

/** @deprecated tip-banner helpers — guided spotlight replaced these */
export function pendingOnboardingTip(_state: GameState): null {
  return null
}

export function onboardingTipId(def: { id: string; label?: string }): string {
  if (def.label === 'Launch') return 'launch-lock'
  return `${def.id}-unlock`
}
