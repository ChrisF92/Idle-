/** Act 1 spine, system gates, achievements, and guided onboarding. */

import type { GameState, Resources, TabId } from './types'
import { noteHighestSector } from './playtest'
import {
  ACT1_CADENCE,
  ACT1_FINAL_WAVE,
  PROCESS_MIN_REBUILDS,
  PROCESS_MIN_RESEARCH,
} from './cadence'
import { careerBestWave, meetsWave } from './waves'
import { rebuildDoorMet } from './rebuild'
import { practicedCoreWork } from './corePractice'
import { SHIP_FRAMES, grantUnlockedFrame } from './catalog'

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
  requiresBestWave: number
  /** Optional research gate after the Wave door. */
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
    requiresBestWave: ACT1_CADENCE.workers,
    label: 'Worker Drones',
    tip: 'Assign Worker Drones to industrial jobs.',
  },
  {
    id: 'reliquary',
    requiresBestWave: ACT1_CADENCE.reliquary,
    label: 'Relics',
    tip: 'Relics install into fitted Cores while Docked.',
  },
  {
    id: 'furnace',
    requiresBestWave: ACT1_CADENCE.furnace,
    label: 'Furnace',
    tip: 'Spend Heat on temporary ship boosts.',
  },
  {
    id: 'yard',
    requiresBestWave: ACT1_CADENCE.yard,
    label: 'Construction',
    tip: 'Foundry construction. Fabricate facilities; bonuses apply as soon as the job finishes.',
  },
  {
    id: 'slag',
    requiresBestWave: 0,
    label: 'Matter',
    tip: 'Spend Rebuild Matter inside the Rebuild hangar.',
  },
  {
    id: 'protocols',
    requiresBestWave: ACT1_CADENCE.protocols,
    label: 'Challenges',
    tip: 'Solve a modified version of the normal Sortie rules.',
  },
  {
    id: 'echo',
    requiresBestWave: 999,
    label: 'Echo Runs',
    tip: 'Retired. Challenges cover alternate combat tests.',
  },
  {
    id: 'process',
    requiresBestWave: ACT1_CADENCE.process,
    label: 'Process',
    tip: 'Automate behaviours you have already learned.',
  },
  {
    id: 'specialists',
    requiresBestWave: ACT1_CADENCE.specialists,
    label: 'Specialists',
    tip: 'Deferred from Act 1. Frame, Core, and Relic identity is enough.',
  },
  {
    id: 'tasks',
    requiresBestWave: ACT1_CADENCE.tasks,
    label: 'Task List',
    tip: 'Deferred from Act 1. Capital stays shut until this list exists.',
  },
  {
    id: 'capital',
    requiresBestWave: ACT1_CADENCE.capital,
    label: 'Capital',
    tip: 'Upgrade Broadside, Bulkhead, and Hold with Salvage and Heat.',
  },
  {
    id: 'reinforce',
    requiresBestWave: ACT1_CADENCE.reinforce,
    label: 'Reinforce',
    tip: 'Clear Wave 300. Rebuild has reached the limit of this loop.',
  },
  {
    id: 'logs',
    requiresBestWave: 0,
    label: 'Foundry Logs',
    tip: 'Short industrial notes as doors open.',
  },
  {
    id: 'research',
    requiresBestWave: ACT1_CADENCE.research,
    label: 'Research',
    tip: 'Start one Research project. Sensor Net drones speed it up.',
  },
  {
    id: 'codex',
    requiresBestWave: ACT1_CADENCE.codex,
    label: 'Codex',
    tip: 'Optional reference for enemy families and hull roles.',
  },
  {
    id: 'core',
    requiresBestWave: ACT1_CADENCE.research + 2,
    requiresResearch: 'core-training',
    label: 'Core',
    tip: 'Assign workers to training stations to raise Core attributes. Ranks wipe on prestige.',
  },
  {
    id: 'ai',
    requiresBestWave: ACT1_CADENCE.process,
    label: 'Process',
    tip: 'Spend Process Points on automation and quality-of-life upgrades.'
  },
  {
    id: 'prestige',
    requiresBestWave: ACT1_CADENCE.rebuild,
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
    description: 'Reach Wave 10. Starts banking Process Points for later automation.',
    rewardAiPoints: 4,
    condition: { type: 'sector-ever', sector: 1 },
  },
  {
    id: 'chip-drawer',
    name: 'Chip Drawer',
    description: 'Reach Wave 30. Shard signatures are now detectable.',
    rewardAiPoints: 2,
    condition: { type: 'sector-ever', sector: 3 },
  },
  {
    id: 'hangar-opened',
    name: 'Hangar Opened',
    description: 'Reach Wave 40.',
    rewardAiPoints: 2,
    condition: { type: 'sector-ever', sector: 4 },
  },
  {
    id: 'first-boss',
    name: 'First Titan',
    description: 'Reach Wave 50 (first band boss).',
    rewardAiPoints: 2,
    condition: { type: 'sector-ever', sector: 5 },
  },
  {
    id: 'archive-open',
    name: 'Archive Open',
    description: 'Reach Wave 70. Archive telemetry begins accumulating.',
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
    description: 'Reach Wave 100.',
    rewardAiPoints: 2,
    condition: { type: 'sector-ever', sector: 10 },
  },
  {
    id: 'sector-15',
    name: 'Combat Corps',
    description: 'Reach Wave 150.',
    rewardAiPoints: 2,
    condition: { type: 'sector-ever', sector: 15 },
  },
  {
    id: 'sector-20',
    name: 'Void Line',
    description: 'Reach Wave 200.',
    rewardAiPoints: 2,
    condition: { type: 'sector-ever', sector: 20 },
  },
  {
    id: 'sector-25',
    name: 'Outer Rim',
    description: 'Reach Wave 250.',
    rewardAiPoints: 3,
    condition: { type: 'sector-ever', sector: 25 },
  },
  {
    id: 'act1-clear',
    name: 'Exodus Gate',
    description: 'Clear Wave 300 and finish Act 1.',
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
    description: 'Buy two Core Levels with Scrap at Dock.',
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
    name: 'Wave Patrol',
    description: 'Every 50 lifetime 10-wave clears. Repeatable.',
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
      return practicedCoreWork(state)
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
    return meetsWave(state, ACT1_CADENCE.foundry)
  }
  if (systemId === 'slag') {
    return (state.prestige.prestigeCount ?? 0) >= 1 || Object.keys(state.prestige.matterShop ?? {}).length > 0
  }
  if (systemId === 'yard') {
    return careerBestWave(state) >= ACT1_CADENCE.foundryAdvanced
  }
  if (systemId === 'capital' || systemId === 'specialists' || systemId === 'tasks') {
    return false
  }
  if (systemId === 'logs') {
    return true
  }
  if (systemId === 'ai' || systemId === 'process') {
    const used = (state.process?.purchased?.length ?? 0) > 0 || state.ai.purchased.length > 0
    const researchProgress = Object.values(state.hiveResearch?.completed ?? {}).filter((n) => n > 0).length
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
    return meetsWave(state, ACT1_CADENCE.research)
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
  if (careerBestWave(state) < def.requiresBestWave) return false
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
  if (def.requiresBestWave > 0) {
    parts.push(`Reach Wave ${def.requiresBestWave}`)
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
      return isSystemUnlocked(state, 'furnace')
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

  const best = careerBestWave(state)
  for (const frame of SHIP_FRAMES) {
    if (frame.unlockSource !== 'wave') continue
    if ((frame.requiresBestWave ?? 0) > best) continue
    grantUnlockedFrame(state, frame.id, `${frame.name} unlocked.`)
  }

  tryCompleteAchievements(state)
}

/** Clearing the Wave 300 climax reveals Reinforce (GDD §164). */
export function completeAct1(state: GameState): void {
  if (state.meta.act1Cleared) return
  state.meta.act1Cleared = true
  state.meta.act1FinalePending = true
  state.combat.log = [
    `Act 1 complete — Wave ${ACT1_FINAL_WAVE}. The Hive remembers this reconstruction. Reinforce is open on More.`,
    ...state.combat.log,
  ].slice(0, 40)
}

/** Player dismissed the first-clear Act 1 presentation. */
export function dismissAct1Finale(state: GameState): GameState {
  if (!state.meta.act1FinalePending) return state
  const next = structuredClone(state)
  next.meta.act1FinalePending = false
  return next
}


export {
  FOUNDRY_V2_GUIDE_IDS,
  FURNACE_V2_GUIDE_IDS,
  NETWORK_GUIDE_IDS,
  NETWORK_RELAY_GUIDE_IDS,
  ONBOARDING_ENABLED,
  ONBOARDING_LESSONS,
  ONBOARDING_LESSONS as GUIDE_STEPS,
  PROTOCOL_V2_GUIDE_IDS,
  REBUILD_GUIDE_IDS,
  RESEARCH_V2_GUIDE_IDS,
  STARTER_GUIDE_IDS,
  activeOnboardingLesson,
  activeGuideStep,
  completeLesson,
  completeLesson as acknowledgeOnboarding,
  guideBodyLines,
  lessonPausesSimulation,
  retirePostResetOnboarding,
  skipAllLessons,
  skipLesson,
  skipLesson as skipOnboarding,
  syncCompletedLessons,
  syncCompletedLessons as syncCompletedGuides,
} from './onboarding'

export function retireLiveSortieGuides(_state: GameState): void {}

export function pendingOnboardingTip(_state: GameState): null {
  return null
}

export function onboardingTipId(def: { id: string; label?: string }): string {
  return `${def.id}-unlock`
}

export function guidePausesSimulation(step: { pause?: boolean } | null | undefined): boolean {
  return Boolean(step?.pause)
}

export function guideAutoTabs(_step: unknown): boolean {
  return false
}

