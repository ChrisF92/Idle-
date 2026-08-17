/** Act 1 spine, system gates, achievements, and guided onboarding. */

import type { GameState, Resources, TabId } from './types'
import { taskListComplete } from './tasks'

export {
  WAVES_PER_SECTOR,
  isSectorBossWave,
  trashWavesForSector,
  wavesForSector,
} from './sectors'

/** Soft campaign climax — first Act 1 clear beat (sector 30). */
export const ACT1_FINAL_SECTOR = 30

/** Rebuild hangar becomes available mid–Act 1 (sector 4). */
export const PRESTIGE_MIN_SECTOR = 4

export type SystemId = Exclude<
  TabId,
  'dock' | 'combat' | 'cores' | 'network' | 'foundry' | 'shipyard' | 'stats'
>

export interface SystemUnlockDef {
  id: SystemId
  /** Career highest sector cleared required (0 = always). Ignored for AI. */
  requiresSectorEver: number
  /** Optional research gate after the sector gate. */
  requiresResearch?: string
  label: string
  tip: string
}

/**
 * Whole systems unlock by career progress. Locked More stations stay listed with requirements.
 * Dock and Sortie are always available. Salvage, Network, and More wait for the first hull loss.
 * Process unlocks on First Blood.
 */
export const SYSTEM_UNLOCKS: SystemUnlockDef[] = [
  {
    id: 'base',
    requiresSectorEver: 4,
    label: 'Base',
    tip: 'Worker drones manufacture over time. Assign them to named stations for production.',
  },
  {
    id: 'reliquary',
    requiresSectorEver: 3,
    label: 'Reliquary',
    tip: 'Fit shards into colour slots. Red and orange at 3; pink at 6.',
  },
  {
    id: 'furnace',
    requiresSectorEver: 5,
    label: 'Furnace',
    tip: 'Choir-ash feeds a live Heat tank. Light Furnace Channels for temporary system boosts.',
  },
  {
    id: 'yard',
    requiresSectorEver: 0,
    label: 'Yard Grid',
    tip: 'Place buildings. Spend Ingots on arms that apply on the next Rebuild.',
  },
  {
    id: 'slag',
    requiresSectorEver: 0,
    label: 'Slag Bank',
    tip: 'Spend Rebuild Matter on permanent hangar ranks. Ranks beat banking.',
  },
  {
    id: 'protocols',
    requiresSectorEver: 18,
    label: 'Protocols',
    tip: 'Restricted sorties. Clear the goal sector to rank the muted system.',
  },
  {
    id: 'echo',
    requiresSectorEver: 22,
    label: 'Echo Runs',
    tip: 'Short authored gauntlets. Echo points buy a small skill tree.',
  },
  {
    id: 'process',
    requiresSectorEver: 0,
    label: 'Process',
    tip: 'Achievements grant Process points. Spend them on automation, QoL, and lifetime Accumulation.',
  },
  {
    id: 'specialists',
    requiresSectorEver: 51,
    label: 'Specialists',
    tip: 'Print Gunner, Warden, and Scavenger. Ranks persist across Rebuild.',
  },
  {
    id: 'tasks',
    requiresSectorEver: 72,
    label: 'Task List',
    tip: 'Finish the checklist. Capital does not open on a sector number alone.',
  },
  {
    id: 'capital',
    requiresSectorEver: 75,
    label: 'Capital',
    tip: 'Second combat scale on the ship. Broadside / Bulkhead / Hold. Task List first.',
  },
  {
    id: 'reinforce',
    requiresSectorEver: 80,
    label: 'Reinforce',
    tip: 'Second prestige layer. Keeps the foundry. Starts the lane again.',
  },
  {
    id: 'logs',
    requiresSectorEver: 0,
    label: 'Foundry Logs',
    tip: 'Short industrial notes as doors open.',
  },
  {
    id: 'research',
    requiresSectorEver: 7,
    label: 'Research',
    tip: 'Three kill-fed branches. Focus one — the others still run, just slower.',
  },
  {
    id: 'codex',
    requiresSectorEver: 6,
    label: 'Codex',
    tip: 'Enemy families and hull roles. Soft counters for the loadout. Opens at sector 6.',
  },
  {
    id: 'core',
    requiresSectorEver: 8,
    requiresResearch: 'core-training',
    label: 'Core',
    tip: 'Assign workers to training stations to raise Core attributes. Ranks wipe on prestige.',
  },
  {
    id: 'ai',
    requiresSectorEver: 0,
    label: 'Process',
    tip: 'Achievements grant Process points. Spend them on automation, QoL, and lifetime Accumulation.',
  },
  {
    id: 'prestige',
    requiresSectorEver: 4,
    label: 'Rebuild',
    tip: 'Rebuild from sector 4 to swap hull and Cores. Protocols open after Act 1 (sector 30).',
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
    description: 'Clear sector 1. Unlocks Process.',
    rewardAiPoints: 4,
    condition: { type: 'sector-ever', sector: 1 },
  },
  {
    id: 'chip-drawer',
    name: 'Chip Drawer',
    description: 'Clear sector 3. Reliquary is open.',
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
    description: 'Clear sector 7. Research is open.',
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
    name: 'Shard Seated',
    description: 'Fit a Reliquary shard.',
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
    name: 'Protocol Cleared',
    description: 'Complete any Protocol.',
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
    case 'reliquary-fitted':
      return Object.values(state.reliquary?.slots ?? {}).filter(Boolean).length
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
  if (systemId === 'network' || systemId === 'stats') {
    return hasHullLostOnce(state)
  }
  if (systemId === 'cores') {
    return false
  }
  if (systemId === 'foundry') {
    return careerHighestSector(state) >= 2
  }
  if (systemId === 'yard' || systemId === 'slag') {
    return (state.prestige.prestigeCount ?? 0) >= 1
  }
  if (systemId === 'capital') {
    return careerHighestSector(state) >= 75 && taskListComplete(state)
  }
  if (systemId === 'logs') {
    return true
  }
  if (systemId === 'ai' || systemId === 'process') {
    return state.meta.aiUnlocked || state.meta.completedAchievements.length > 0
  }
  if (systemId === 'codex') {
    return careerHighestSector(state) >= 6
  }
  const def = SYSTEM_UNLOCKS.find((s) => s.id === systemId)
  if (!def) return true
  if (careerHighestSector(state) < def.requiresSectorEver) return false
  if (def.requiresResearch && !state.research.unlocked.includes(def.requiresResearch)) {
    return false
  }
  return true
}

export function systemUnlockRequirement(systemId: TabId): string | null {
  if (systemId === 'combat' || systemId === 'shipyard') {
    return null
  }
  if (systemId === 'network' || systemId === 'stats') {
    return 'Dock after hull loss'
  }
  if (systemId === 'foundry') {
    return 'Clear sector 2'
  }
  if (systemId === 'yard' || systemId === 'slag') {
    return 'Rebuild once'
  }
  if (systemId === 'capital') {
    return 'Clear sector 75 · finish the Task List'
  }
  if (systemId === 'logs') {
    return null
  }
  if (systemId === 'ai' || systemId === 'process') {
    return 'Complete First Blood (clear sector 1)'
  }
  if (systemId === 'codex') {
    return 'Clear sector 6'
  }
  const def = SYSTEM_UNLOCKS.find((s) => s.id === systemId)
  if (!def) return null
  const parts: string[] = []
  if (def.requiresSectorEver > 0) {
    parts.push(`Clear sector ${def.requiresSectorEver}`)
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
  if (state.prestige.activeChallengeId) return false
  return state.combat.sector >= PRESTIGE_MIN_SECTOR
}

/**
 * Challenges + Challenge shop unlock after the first Act 1 clear (sector 30).
 * Stay visible while a challenge is already running so Abandon remains available.
 */
export function challengesContentUnlocked(state: GameState): boolean {
  if (state.prestige.activeChallengeId) return true
  return state.meta.act1Cleared || careerHighestSector(state) >= ACT1_FINAL_SECTOR
}

/** Grant Base starter drones; update career flags; check achievements. */
export function maybeGrantSystemUnlocks(state: GameState): void {
  const ever = careerHighestSector(state)
  if (ever > state.meta.highestSectorEver) {
    state.meta.highestSectorEver = ever
  }

  if (ever >= 6 && !state.meta.codexUnlocked) {
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

  if (ever >= ACT1_FINAL_SECTOR && !state.meta.act1Cleared) {
    state.meta.act1Cleared = true
    state.combat.log = [
      `Act 1 complete — sector ${ACT1_FINAL_SECTOR} cleared. Prestige, Ascension, and challenges are the long game.`,
      ...state.combat.log,
    ].slice(0, 40)
  }

  tryCompleteAchievements(state)
}

/* ---------- Guided onboarding (spotlight + directed clicks) ---------- */

export interface GuideStep {
  id: string
  title: string
  body: string | string[]
  /** Matches data-guide="…" on UI elements. */
  target: string
  /** Switch the player to this tab when the step becomes active. */
  tab?: TabId
  /**
   * Screen this lesson belongs to. While the player is parked on a system
   * screen, only that screen's lessons may show — the next door waits.
   */
  screen?: TabId
  /** Skip dismisses every unseen step that shares this group. */
  group?: string
  availableWhen: (state: GameState) => boolean
  /** Optional: auto-complete when predicate becomes true. */
  completeWhen?: (state: GameState, tab: TabId) => boolean
  /**
   * Required lessons hide Skip and block clicks outside the spotlight
   * until completeWhen (or the highlighted control) finishes the step.
   */
  required?: boolean
  /**
   * Player must tap the highlighted control. Continue is hidden.
   * Default: true for tab/station/launch/upgrade/completeWhen steps.
   */
  tap?: boolean
}

export function guideBodyLines(step: GuideStep): string[] {
  return Array.isArray(step.body) ? step.body : [step.body]
}

const TAP_TARGETS = new Set([
  'launch',
  'cores-sheet',
  'rebuild-btn',
  'hangar-confirm',
  'furnace-bank',
  'furnace-channel-weapons',
  'reinforce-go',
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

/** More / Foundry / Network screens that must finish their own tour first. */
const TOUR_PARK_TABS: ReadonlySet<TabId> = new Set([
  'network',
  'foundry',
  'reliquary',
  'furnace',
  'research',
  'codex',
  'yard',
  'slag',
  'protocols',
  'echo',
  'process',
  'specialists',
  'tasks',
  'capital',
  'reinforce',
  'logs',
])

function stepLessonScreen(step: GuideStep): TabId | undefined {
  return step.screen ?? step.tab
}

/** Battlefield lessons may run during a live sortie, even on other screens. */
export function isLiveSortieLesson(step: GuideStep): boolean {
  return step.group === 'sortie'
}

/** True if this lesson is allowed to interrupt the current tab. */
export function stepAllowedOnTab(step: GuideStep, tab: TabId): boolean {
  if (isLiveSortieLesson(step)) return true
  const home = stepLessonScreen(step)
  if (TOUR_PARK_TABS.has(tab)) {
    if (home === tab) return true
    if (step.target === `${tab}-tab` || step.target === `station-${tab}`) return true
    return false
  }
  // Dock / More / Sortie: door openers only. In-screen lessons wait until that screen.
  if (home && TOUR_PARK_TABS.has(home) && home !== tab) {
    return step.target === `${home}-tab` || step.target === `station-${home}`
  }
  return true
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'guide-shipyard-tab',
    title: 'Dock',
    body: 'Home. Scout Hull is fitted. Launch a sortie — stay on this fight until hull loss. Salvage and Network open after you dock.',
    target: 'dock-tab',
    tab: 'dock',
    tap: false,
    availableWhen: (s) =>
      s.combat.docked && !s.shipyard.frameLocked && !guideSeen(s, 'guide-shipyard-tab'),
  },
  {
    id: 'guide-frame-select',
    title: 'Your hull',
    body: 'Scout Hull is fitted. After hull loss, Salvage ranks Cores. Rebuild later to swap the hull.',
    target: 'dock-tab',
    tab: 'dock',
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-shipyard-tab') &&
      !guideSeen(s, 'guide-frame-select') &&
      s.combat.docked &&
      !s.shipyard.frameLocked,
    completeWhen: () => true,
  },
  {
    id: 'guide-launch',
    title: 'Launch',
    body: 'Tap Launch sortie. Stay on Sortie until hull loss — Salvage and Network unlock after you dock.',
    target: 'launch',
    tab: 'dock',
    availableWhen: (s) =>
      guideSeen(s, 'guide-shipyard-tab') &&
      !guideSeen(s, 'guide-launch') &&
      s.combat.docked &&
      !s.shipyard.frameLocked,
    completeWhen: (s) => s.shipyard.frameLocked || !s.combat.docked,
  },
  {
    id: 'guide-sortie-field',
    title: 'The lane',
    body: [
      'Your hull sits at the bottom. Waves close in from the far side.',
      'This screen is the fight. Hull and Shield live in the header. Cores is a button under the field.',
    ],
    target: 'sortie-canvas',
    tab: 'combat',
    screen: 'combat',
    group: 'sortie',
    required: true,
    availableWhen: (s) =>
      !s.combat.docked &&
      (s.combat.defeatLeft ?? 0) <= 0 &&
      (s.meta.starterCombatLesson ?? 0) === 2 &&
      !guideSeen(s, 'guide-sortie-field'),
  },
  {
    id: 'guide-sortie-guns',
    title: 'Guns fire themselves',
    body: [
      'You do not tap to shoot. Pulse Cannon fires on its own.',
      'Watch the lane. After hull loss you will spend Salvage on Pulse and Plate.',
    ],
    target: 'sortie-canvas',
    tab: 'combat',
    screen: 'combat',
    group: 'sortie',
    required: true,
    availableWhen: (s) =>
      !s.combat.docked &&
      (s.combat.defeatLeft ?? 0) <= 0 &&
      guideSeen(s, 'guide-sortie-field') &&
      !guideSeen(s, 'guide-sortie-guns'),
  },
  {
    id: 'guide-sortie-hull',
    title: 'Shield, then Hull',
    body: [
      'Incoming fire eats Shield first, then Hull.',
      'Advance keeps pushing sectors. Hold sector or Hold wave to farm. Hull lost docks you — Salvage and Network open after that.',
    ],
    target: 'sortie-hull',
    tab: 'combat',
    screen: 'combat',
    group: 'sortie',
    required: true,
    availableWhen: (s) =>
      !s.combat.docked &&
      (s.combat.defeatLeft ?? 0) <= 0 &&
      guideSeen(s, 'guide-sortie-guns') &&
      !guideSeen(s, 'guide-sortie-hull'),
  },
  {
    id: 'guide-salvage-lesson',
    title: 'Salvage recovered',
    body: [
      'Open Sortie. Salvage ranks Cores — tap Cores, then Pulse (gun) and Plate (shield).',
      'Tap a Core name later for every stat and the next Salvage cost.',
    ],
    target: 'combat-tab',
    group: 'cores',
    required: true,
    availableWhen: (s) =>
      s.combat.docked &&
      hasHullLostOnce(s) &&
      (s.meta.starterCombatLesson ?? 0) === 2 &&
      s.resources.salvage > 0 &&
      ((s.shipyard.moduleLevels['pulse-cannon'] ?? 0) < 1 ||
        (s.shipyard.moduleLevels['plate-layer'] ?? 0) < 1) &&
      !guideSeen(s, 'guide-salvage-lesson'),
  },
  {
    id: 'guide-cores-sheet',
    title: 'Cores',
    body: [
      'Pulse Cannon is the gun. Plate Layer is the shield. Salvage buys run levels on both.',
      'Rank them here, even mid-fight. Drones do not live on this sheet — they live on Network.',
    ],
    target: 'cores-sheet',
    tab: 'combat',
    screen: 'combat',
    group: 'cores',
    required: true,
    availableWhen: (s) =>
      s.combat.docked &&
      hasHullLostOnce(s) &&
      (s.meta.starterCombatLesson ?? 0) === 2 &&
      guideSeen(s, 'guide-salvage-lesson') &&
      !guideSeen(s, 'guide-cores-sheet'),
  },
  {
    id: 'guide-upgrade-pulse',
    title: 'Upgrade Pulse',
    body: 'Spend Salvage to raise Pulse Cannon one run level. Levels wipe on Rebuild — cheap power now.',
    target: 'upgrade-pulse-cannon',
    tab: 'combat',
    screen: 'combat',
    group: 'cores',
    required: true,
    availableWhen: (s) =>
      s.combat.docked &&
      hasHullLostOnce(s) &&
      guideSeen(s, 'guide-cores-sheet') &&
      (s.meta.starterCombatLesson ?? 0) === 2 &&
      (s.shipyard.moduleLevels['pulse-cannon'] ?? 0) < 1 &&
      !guideSeen(s, 'guide-upgrade-pulse'),
    completeWhen: (s) => (s.shipyard.moduleLevels['pulse-cannon'] ?? 0) >= 1,
  },
  {
    id: 'guide-upgrade-plate',
    title: 'Upgrade Plate',
    body: 'Upgrade Plate Layer next. Both Cores should be Salvage-ranked before you launch again.',
    target: 'upgrade-plate-layer',
    tab: 'combat',
    screen: 'combat',
    group: 'cores',
    required: true,
    availableWhen: (s) =>
      s.combat.docked &&
      hasHullLostOnce(s) &&
      (s.meta.starterCombatLesson ?? 0) === 2 &&
      (s.shipyard.moduleLevels['pulse-cannon'] ?? 0) >= 1 &&
      (s.shipyard.moduleLevels['plate-layer'] ?? 0) < 1 &&
      !guideSeen(s, 'guide-upgrade-plate'),
    completeWhen: (s) => (s.shipyard.moduleLevels['plate-layer'] ?? 0) >= 1,
  },
  {
    id: 'guide-cores-inspect',
    title: 'Tap a Core name',
    body: [
      'Tap Pulse Cannon or Plate Layer for live stats, the next Salvage cost, and milestone nodes.',
      'The one-line preview is the short version. The sheet is the full picture.',
    ],
    target: 'core-pulse-cannon',
    tab: 'combat',
    screen: 'combat',
    group: 'cores',
    required: true,
    availableWhen: (s) =>
      s.combat.docked &&
      hasHullLostOnce(s) &&
      (s.meta.starterCombatLesson ?? 0) === 2 &&
      guideSeen(s, 'guide-cores-sheet') &&
      ((s.shipyard.moduleLevels['pulse-cannon'] ?? 0) >= 1 ||
        guideSeen(s, 'guide-upgrade-pulse')) &&
      ((s.shipyard.moduleLevels['plate-layer'] ?? 0) >= 1 ||
        guideSeen(s, 'guide-upgrade-plate')) &&
      !guideSeen(s, 'guide-cores-inspect'),
  },
  {
    id: 'guide-cores-persist',
    title: 'What the loadout keeps',
    body: [
      'Core levels and Salvage stay after hull loss — you just dock and relaunch.',
      'Rebuild wipes Salvage and Core levels so you can swap the hull. That is later, from Dock.',
    ],
    target: 'cores-sheet',
    tab: 'combat',
    screen: 'combat',
    group: 'cores',
    required: true,
    tap: false,
    availableWhen: (s) =>
      s.combat.docked &&
      hasHullLostOnce(s) &&
      guideSeen(s, 'guide-cores-inspect') &&
      !guideSeen(s, 'guide-cores-persist'),
  },
  {
    id: 'guide-drone-cap',
    title: 'Drone Network',
    body: [
      'Tap Network. Drones are a finite workforce — they manufacture and fill bars. They never fly on Sortie.',
      'The corps is already growing. Idle drones are unused potential. Assign them before the next launch.',
    ],
    target: 'network-tab',
    screen: 'network',
    group: 'network',
    required: true,
    availableWhen: (s) =>
      s.combat.docked &&
      hasHullLostOnce(s) &&
      s.base.workerDrones > 0 &&
      !guideSeen(s, 'guide-drone-cap'),
    completeWhen: (_s, tab) => tab === 'network',
  },
  {
    id: 'guide-network-make',
    title: 'The corps grows',
    body: [
      'This bar prints hulls up to the corps cap. Idle drones wait here until you assign them — they do nothing until they have a bar.',
      'You can reassign any time. You do not need a perfect mix. Corps racks (under Links) raise the cap.',
    ],
    target: 'network-manufacture',
    tab: 'network',
    screen: 'network',
    group: 'network',
    required: true,
    availableWhen: (s) =>
      guideSeen(s, 'guide-drone-cap') && !guideSeen(s, 'guide-network-make'),
  },
  {
    id: 'guide-network-assign',
    title: 'Assign Strike and Ward',
    body: [
      'Idle hulls do nothing until you tap +. Strike raises sortie damage. Ward raises the shield ceiling.',
      'Different bars help different jobs. Split the corps. − returns a hull to idle. Close is good enough.',
    ],
    target: 'network-strike',
    tab: 'network',
    screen: 'network',
    group: 'network',
    required: true,
    availableWhen: (s) =>
      guideSeen(s, 'guide-network-make') &&
      !guideSeen(s, 'guide-network-assign') &&
      (s.base.assignments['strike'] ?? 0) + (s.base.assignments['ward'] ?? 0) === 0,
    completeWhen: (s) =>
      (s.base.assignments['strike'] ?? 0) + (s.base.assignments['ward'] ?? 0) > 0,
  },
  {
    id: 'guide-network-sortie',
    title: 'Never on Sortie',
    body: [
      'The corps line is the pool: total hulls, cap, and idle. Sortie never shows these drones.',
      'They only fill bars on this screen. Combat is the hull you launched.',
    ],
    target: 'network-corps',
    tab: 'network',
    screen: 'network',
    group: 'network',
    required: true,
    availableWhen: (s) =>
      guideSeen(s, 'guide-network-make') &&
      (guideSeen(s, 'guide-network-assign') ||
        (s.base.assignments['strike'] ?? 0) + (s.base.assignments['ward'] ?? 0) > 0) &&
      !guideSeen(s, 'guide-network-sortie'),
  },
  {
    id: 'guide-network-bars',
    title: 'Bars, not ships',
    body: [
      'Each assigned drone fills its bar. A completed cycle raises that bar’s level.',
      'Strike is damage. Ward is shields. Yield is salvage. Loom is manufacture. Archive is Research data. Shift the corps when the job changes.',
      'Tap a bar name for live numbers. Levels reset on Rebuild. The corps stays.',
    ],
    target: 'network-strike',
    tab: 'network',
    screen: 'network',
    group: 'network',
    required: true,
    availableWhen: (s) =>
      guideSeen(s, 'guide-network-sortie') &&
      !guideSeen(s, 'guide-network-bars') &&
      ((s.base.assignments['strike'] ?? 0) + (s.base.assignments['ward'] ?? 0) > 0 ||
        s.base.workerDrones > 0),
  },
  {
    id: 'guide-network-links',
    title: 'Link power',
    body: [
      'Link power is assigned drones times efficiency. More Link power fills every bar faster.',
      'Corps racks hang extra hulls. Drone acuity makes each hull count for more. Cycle speed turns the clock up.',
      'Racks cost scrap until the Furnace; then Heat. Acuity and cycle wait for sector 5. Those ranks persist on Rebuild.',
    ],
    target: 'network-links',
    tab: 'network',
    screen: 'network',
    group: 'network',
    required: true,
    availableWhen: (s) =>
      guideSeen(s, 'guide-network-bars') && !guideSeen(s, 'guide-network-links'),
  },
  {
    id: 'guide-network-relay',
    title: 'Strike Relay',
    body: [
      'You are now improving the infrastructure behind Strike — not buying another damage shop.',
      'Strike Relay raises Strike fill speed, how hard each Strike level hits, and Strike’s fill cap. Overflow drones belong here when Strike is capped.',
    ],
    target: 'network-strike-relay',
    tab: 'network',
    screen: 'network',
    group: 'network-relay',
    tap: false,
    availableWhen: (s) =>
      careerHighestSector(s) >= 8 &&
      hasHullLostOnce(s) &&
      guideSeen(s, 'guide-network-links') &&
      !guideSeen(s, 'guide-network-relay'),
  },
  {
    id: 'guide-network-relay-parent',
    title: 'The original bar',
    body: [
      'This is still Strike. The Relay does not replace it. Drones on Strike fill Strike. Drones on the Relay make those Strike drones worth more.',
      'Read fill speed and fill cap on the row. That is the whole trick.',
    ],
    target: 'network-strike',
    tab: 'network',
    screen: 'network',
    group: 'network-relay',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-network-relay') && !guideSeen(s, 'guide-network-relay-parent'),
  },
  {
    id: 'guide-network-lattice',
    title: 'Strike Lattice',
    body: [
      'Lattice improves the Relay that improves Strike. Higher-order Network.',
      'It raises Relay strength, Strike’s scaling exponent, and how much each Strike drone counts.',
    ],
    target: 'network-strike-lattice',
    tab: 'network',
    screen: 'network',
    group: 'network-lattice',
    tap: false,
    availableWhen: (s) =>
      careerHighestSector(s) >= 20 &&
      hasHullLostOnce(s) &&
      guideSeen(s, 'guide-network-links') &&
      !guideSeen(s, 'guide-network-lattice'),
  },
  {
    id: 'guide-network-presets',
    title: 'Network presets',
    body: [
      'Push, Defence, Farm, Industry, Research, Balanced. One tap writes visible weights and redistributes the corps.',
      'There is no hidden best mix. You can still assign by hand.',
    ],
    target: 'network-presets',
    tab: 'network',
    screen: 'network',
    group: 'network-presets',
    tap: false,
    availableWhen: (s) =>
      Boolean(s.process?.purchased.includes('network-presets')) && !guideSeen(s, 'guide-network-presets'),
  },
  {
    id: 'guide-network-auto',
    title: 'Network Auto Optimise',
    body: [
      'When a new drone finishes, Auto Optimise redistributes the corps using your preset. It does not invent a secret mix.',
      'Turn it off and pick the preset under Process → Network. Sortie Bias (if owned) leans the same preset while you fly.',
    ],
    target: 'process-config',
    tab: 'process',
    screen: 'process',
    group: 'network-auto',
    tap: false,
    availableWhen: (s) =>
      Boolean(s.process?.purchased.includes('network-balance')) &&
      !guideSeen(s, 'guide-network-auto') &&
      guideSeen(s, 'guide-process-v2-buy'),
  },
  {
    id: 'guide-foundry',
    title: 'Foundry',
    body: [
      'Tap Foundry. This is the shop floor — smelt wreck into stock, then into bits you can fit.',
      'Smelters run while you fly or sit docked.',
    ],
    target: 'foundry-tab',
    screen: 'foundry',
    group: 'foundry',
    required: true,
    availableWhen: (s) => isSystemUnlocked(s, 'foundry') && !guideSeen(s, 'guide-foundry'),
    completeWhen: (_s, tab) => tab === 'foundry',
  },
  {
    id: 'guide-foundry-smelt',
    title: 'Queue a smelter',
    body: [
      'Pick Slag Ingot or Filament on an idle slot. The bar fills on its own.',
      'Finished crafts make Foundry Points and raise the recipe level. Tap a recipe name for cost and time.',
    ],
    target: 'foundry-smelters',
    tab: 'foundry',
    screen: 'foundry',
    group: 'foundry',
    availableWhen: (s) => guideSeen(s, 'guide-foundry') && !guideSeen(s, 'guide-foundry-smelt'),
  },
  {
    id: 'guide-foundry-keep',
    title: 'What Rebuild keeps',
    body: [
      'Recipe levels, stock, and Foundry Points persist when you Rebuild. Fitted bits come off so you can print them again.',
      'You are done here. Launch when you want — the next door waits until you leave this screen.',
    ],
    target: 'foundry-recipes',
    tab: 'foundry',
    screen: 'foundry',
    group: 'foundry',
    availableWhen: (s) =>
      guideSeen(s, 'guide-foundry-smelt') && !guideSeen(s, 'guide-foundry-keep'),
  },
  {
    id: 'guide-relaunch-upgraded',
    title: 'Resume push',
    body: 'Cores ranked and the Network is running. Launch again — bars fill while you fly.',
    target: 'launch',
    tab: 'dock',
    required: true,
    availableWhen: (s) =>
      hasHullLostOnce(s) &&
      (s.meta.starterCombatLesson ?? 0) === 2 &&
      (s.shipyard.moduleLevels['pulse-cannon'] ?? 0) >= 1 &&
      (s.shipyard.moduleLevels['plate-layer'] ?? 0) >= 1 &&
      s.combat.docked &&
      !guideSeen(s, 'guide-relaunch-upgraded'),
    completeWhen: (s) => !s.combat.docked,
  },
  {
    id: 'guide-reliquary',
    title: 'Reliquary',
    body: [
      'A new station on More. Open Reliquary.',
      'Kills drop shards. You fit them here — they are not guns on the field.',
    ],
    target: 'station-reliquary',
    tab: 'stats',
    group: 'reliquary',
    availableWhen: (s) => isSystemUnlocked(s, 'reliquary') && !guideSeen(s, 'guide-reliquary'),
    completeWhen: (_s, tab) => tab === 'reliquary',
  },
  {
    id: 'guide-reliquary-slots',
    title: 'One shard per colour',
    body: [
      'Red and orange open first. Pink, blue, and green wait on later sectors.',
      'Fit one shard in each colour. Tap a slot name for owned copies and the live bonus.',
      'Remove is free. Swap whenever you are docked.',
    ],
    target: 'reliquary-slots',
    tab: 'reliquary',
    screen: 'reliquary',
    group: 'reliquary',
    availableWhen: (s) =>
      guideSeen(s, 'guide-reliquary') && !guideSeen(s, 'guide-reliquary-slots'),
  },
  {
    id: 'guide-reliquary-resonance',
    title: 'Resonance',
    body: [
      'Extra copies of the fitted shard charge resonance and raise the same bonus. Duplicates are not wasted.',
      'Shards persist when you Rebuild. They keep dropping from kills after this door is open.',
      'Stay and look around. The next station will wait until you go back to More or Dock.',
    ],
    target: 'reliquary-copies',
    tab: 'reliquary',
    screen: 'reliquary',
    group: 'reliquary',
    availableWhen: (s) =>
      guideSeen(s, 'guide-reliquary-slots') && !guideSeen(s, 'guide-reliquary-resonance'),
  },
  {
    id: 'guide-prestige-tab',
    title: 'Rebuild is ready',
    body: [
      'Open Dock. You reached sector 4 — Rebuild hangar can swap hull and Cores for Rebuild Matter.',
      'The live loadout stays until you Rebuild. Rebuild is the swap, not a game-over.',
    ],
    target: 'dock-tab',
    tab: 'dock',
    group: 'rebuild',
    availableWhen: (s) => firstRebuildAvailable(s) && !guideSeen(s, 'guide-prestige-tab'),
    completeWhen: (_s, tab) => tab === 'dock',
  },
  {
    id: 'guide-prestige-ready',
    title: 'Open the hangar',
    body: [
      'Tap Rebuild hangar. Salvage and Core levels wipe on confirm. Network, Foundry recipes, Reliquary shards, and Furnace upgrades stay. Heat in the tank resets unless Ember Lock is ranked.',
    ],
    target: 'rebuild-btn',
    tab: 'dock',
    group: 'rebuild',
    required: true,
    availableWhen: (s) =>
      firstRebuildAvailable(s) &&
      guideSeen(s, 'guide-prestige-tab') &&
      !guideSeen(s, 'guide-prestige-ready'),
  },
  {
    id: 'guide-prestige-hangar',
    title: 'Pick the next hull',
    body: [
      'Scout is fine. Frigate unlocks when you clear sector 4 — extra weapon slot.',
      'This is how you change guns. Confirming wipes unspent Salvage and Core ranks so the new kit starts clean.',
    ],
    target: 'hangar-hull',
    tab: 'dock',
    group: 'rebuild',
    availableWhen: (s) =>
      firstRebuildAvailable(s) &&
      guideSeen(s, 'guide-prestige-ready') &&
      !guideSeen(s, 'guide-prestige-hangar'),
    completeWhen: (s) => s.prestige.prestigeCount > 0,
  },
  {
    id: 'guide-prestige-confirm',
    title: 'Confirm Rebuild',
    body: [
      'Tap Confirm Rebuild. You earn Rebuild Matter. Yard Grid and Slag Bank open on the other side.',
    ],
    target: 'hangar-confirm',
    tab: 'dock',
    group: 'rebuild',
    required: true,
    availableWhen: (s) =>
      firstRebuildAvailable(s) &&
      guideSeen(s, 'guide-prestige-hangar') &&
      !guideSeen(s, 'guide-prestige-confirm'),
    completeWhen: (s) => s.prestige.prestigeCount > 0,
  },
  {
    id: 'guide-furnace',
    title: 'Furnace',
    body: [
      'Open More and tap Furnace. Choir-ash has been collecting from kills since sector 5.',
      'You do not tap wrecks for ash. Flares collect themselves.',
    ],
    target: 'station-furnace',
    tab: 'stats',
    group: 'furnace',
    availableWhen: (s) => isSystemUnlocked(s, 'furnace') && !guideSeen(s, 'guide-furnace'),
    completeWhen: (_s, tab) => tab === 'furnace',
  },
  {
    id: 'guide-furnace-v2-ash',
    title: 'Ash feeds the fire',
    body: [
      'Choir-ash is fuel, not a score. Kills drop it on their own after sector 5.',
      'The Furnace burns ash into Heat. You are not buying a permanent +2% shop anymore.',
    ],
    target: 'furnace-ash',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-v2',
    tap: false,
    availableWhen: (s) =>
      isSystemUnlocked(s, 'furnace') &&
      !guideSeen(s, 'guide-furnace-v2-ash') &&
      (guideSeen(s, 'guide-furnace') ||
        (s.meta.seenOnboarding ?? []).includes('guide-furnace-ranks') ||
        (s.meta.seenOnboarding ?? []).includes('guide-furnace-bank')),
  },
  {
    id: 'guide-furnace-v2-heat',
    title: 'Heat is live',
    body: [
      'Heat generates while ash remains and a small Hearth trickle always runs.',
      'Bank dumps ash into the tank now. Auto Feed later does that tap for you.',
    ],
    target: 'furnace-heat',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-furnace-v2-ash') && !guideSeen(s, 'guide-furnace-v2-heat'),
  },
  {
    id: 'guide-furnace-v2-cap',
    title: 'Capacity',
    body: [
      'The tank has a ceiling. Extra generation is wasted once Heat is full — ash stops burning so you do not throw fuel away.',
      'Cistern upgrades raise the ceiling. Network Links still spend stored Heat as a lump.',
    ],
    target: 'furnace-cap',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-furnace-v2-heat') && !guideSeen(s, 'guide-furnace-v2-cap'),
  },
  {
    id: 'guide-furnace-v2-rate',
    title: 'Heat per second',
    body: [
      'GENERATING is ash feed plus Hearth. CONSUMING is every lit channel. NET is the difference.',
      'Positive NET fills the tank. Negative NET drains it. Read NET before you light a second fire.',
    ],
    target: 'furnace-net',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-furnace-v2-cap') && !guideSeen(s, 'guide-furnace-v2-rate'),
  },
  {
    id: 'guide-furnace-v2-channel',
    title: 'Furnace Channels',
    body: [
      'A channel is a temporary system boost you choose to power: Weapons, Shielding, Network, Foundry, Research, Recovery.',
      'The question is what you want to power right now — not which permanent rank to buy.',
    ],
    target: 'furnace-channels',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-furnace-v2-rate') && !guideSeen(s, 'guide-furnace-v2-channel'),
  },
  {
    id: 'guide-furnace-v2-consume',
    title: 'Channels spend Heat',
    body: [
      'Every lit channel consumes Heat every second. If NET is negative, the tank drains.',
      'When the tank hits your reserve (or empty), the lowest-priority channel drops a level. That is starvation — it is shown, not a silent shutdown.',
    ],
    target: 'furnace-channels',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-furnace-v2-channel') && !guideSeen(s, 'guide-furnace-v2-consume'),
  },
  {
    id: 'guide-furnace-v2-levels',
    title: 'Stronger costs more',
    body: [
      'Weapons I is a modest damage boost. Weapons II and III cost several times the Heat.',
      'Do not light III because the number looks bigger. Light what the tank can hold.',
    ],
    target: 'furnace-channels',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-furnace-v2-consume') && !guideSeen(s, 'guide-furnace-v2-levels'),
  },
  {
    id: 'guide-furnace-v2-limit',
    title: 'Not everything at once',
    body: [
      'Early Furnace lights one channel. Extra Taps, a Rebuild, and Process Accumulation raise that cap.',
      'You will not power Weapons, Shielding, and Foundry together on day one. Pick the job.',
    ],
    target: 'furnace-slots',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-furnace-v2-levels') && !guideSeen(s, 'guide-furnace-v2-limit'),
  },
  {
    id: 'guide-furnace-v2-bank',
    title: 'Fund Heat',
    body: [
      'Tap Bank if you have a pile of ash. That fills the tank now so a channel has something to burn.',
      'If Heat is already in the tank, this step lets go.',
    ],
    target: 'furnace-bank',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-v2',
    required: true,
    availableWhen: (s) =>
      guideSeen(s, 'guide-furnace-v2-limit') && !guideSeen(s, 'guide-furnace-v2-bank'),
    completeWhen: (s) => (s.resources.heat ?? 0) > 0,
  },
  {
    id: 'guide-furnace-v2-activate',
    title: 'Light Weapons I',
    body: [
      'Tap Weapons I. Damage rises while the channel is lit and Heat starts to drain.',
      'You can darken it later. One channel is the whole early puzzle.',
    ],
    target: 'furnace-channel-weapons',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-v2',
    required: true,
    availableWhen: (s) =>
      guideSeen(s, 'guide-furnace-v2-bank') && !guideSeen(s, 'guide-furnace-v2-activate'),
    completeWhen: (s) => Object.values(s.furnace?.wanted ?? {}).some((n) => n > 0),
  },
  {
    id: 'guide-furnace-v2-net',
    title: 'Read NET',
    body: [
      'GENERATING minus CONSUMING is NET. If it is red, the tank is shrinking.',
      'That is the Furnace. Come back when you want a second channel, a preset, or the Manager.',
    ],
    target: 'furnace-net',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-furnace-v2-activate') && !guideSeen(s, 'guide-furnace-v2-net'),
  },
  {
    id: 'guide-furnace-v2-second',
    title: 'Second channel',
    body: [
      'You can light two channels at once now. Priority decides which one starves last.',
      'NET still rules. Two Level I fires are cheaper than one Level III.',
    ],
    target: 'furnace-slots',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-second',
    tap: false,
    availableWhen: (s) =>
      isSystemUnlocked(s, 'furnace') &&
      guideSeen(s, 'guide-furnace-v2-net') &&
      !guideSeen(s, 'guide-furnace-v2-second') &&
      (s.furnace?.upgrades?.taps ?? 0) + (s.prestige?.prestigeCount ?? 0) + ((s.process?.earned ?? 0) >= 150 ? 1 : 0) >= 1,
  },
  {
    id: 'guide-furnace-presets',
    title: 'Furnace presets',
    body: [
      'Push, Farm, Industry, and Research are starting mixes. They do not invent a hidden best fire.',
      'You can still set channels by hand. Presets only write the wanted lights.',
    ],
    target: 'furnace-presets',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-presets',
    tap: false,
    availableWhen: (s) =>
      Boolean(s.process?.purchased.includes('furnace-presets')) && !guideSeen(s, 'guide-furnace-presets'),
  },
  {
    id: 'guide-furnace-manager',
    title: 'Furnace Manager',
    body: [
      'The manager keeps your wanted channels lit while Heat lasts. It will not spend below the reserve you set.',
      'Priority is the starve order. Auto Channel may raise or drop levels to stay sustainable, then recover when the tank is healthy.',
    ],
    target: 'furnace-manager',
    tab: 'furnace',
    screen: 'furnace',
    group: 'furnace-manager',
    tap: false,
    availableWhen: (s) =>
      Boolean(s.process?.purchased.includes('furnace-auto')) && !guideSeen(s, 'guide-furnace-manager'),
  },
  {
    id: 'guide-research-tab',
    title: 'Research',
    body: [
      'Open More and tap Research. Kills write Material, Energy, and Observation whether you sit here or not.',
      'Focus one branch for a large bonus. The other two still crawl.',
    ],
    target: 'station-research',
    tab: 'stats',
    group: 'research',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'research') && !guideSeen(s, 'guide-research-tab'),
    completeWhen: (_s, tab) => tab === 'research',
  },
  {
    id: 'guide-research-focus',
    title: 'Pick a focus',
    body: [
      'Material is a safe first focus. Nodes persist when you Rebuild — you are not spending Salvage here.',
      'Archive on the Network still drips Research data. This screen is the kill-fed tree.',
    ],
    target: 'research-focus',
    tab: 'research',
    screen: 'research',
    group: 'research',
    availableWhen: (s) =>
      guideSeen(s, 'guide-research-tab') && !guideSeen(s, 'guide-research-focus'),
  },
  {
    id: 'guide-yard',
    title: 'Yard Grid',
    body: [
      'Open More and tap Yard. Buildings run even while you are docked.',
      'They make Ore, Flux, and Ingots. This is a second idle layer, not combat.',
    ],
    target: 'station-yard',
    tab: 'stats',
    group: 'yard',
    availableWhen: (s) => isSystemUnlocked(s, 'yard') && !guideSeen(s, 'guide-yard'),
    completeWhen: (_s, tab) => tab === 'yard',
  },
  {
    id: 'guide-yard-arms',
    title: 'Place, then arm',
    body: [
      'Place buildings on empty cells. Spend Ingots on arms.',
      'Arms apply on the next Rebuild, not this hull. Pending arms wait until you hang a new kit.',
    ],
    target: 'yard-grid',
    tab: 'yard',
    screen: 'yard',
    group: 'yard',
    availableWhen: (s) => guideSeen(s, 'guide-yard') && !guideSeen(s, 'guide-yard-arms'),
  },
  {
    id: 'guide-slag',
    title: 'Slag Bank',
    body: [
      'Open More and tap Slag Bank. Rebuild Matter buys hangar ranks that persist.',
      'Unspent matter still banks a small bonus in the header. Ranks beat banking.',
    ],
    target: 'station-slag',
    tab: 'stats',
    group: 'slag',
    availableWhen: (s) => isSystemUnlocked(s, 'slag') && !guideSeen(s, 'guide-slag'),
    completeWhen: (_s, tab) => tab === 'slag',
  },
  {
    id: 'guide-slag-ranks',
    title: 'Spend the slag',
    body: [
      'Slag Edge, Forge, and Plate are the early ranks — damage, production, hull.',
      'This is where Rebuild Matter goes. Challenge Marks stay in the bank for later.',
    ],
    target: 'slag-ranks',
    tab: 'slag',
    screen: 'slag',
    group: 'slag',
    availableWhen: (s) => guideSeen(s, 'guide-slag') && !guideSeen(s, 'guide-slag-ranks'),
  },
  {
    id: 'guide-protocols',
    title: 'Protocols',
    body: [
      'Open More and tap Protocols. Optional restricted sorties — one system is muted.',
      'Clear the goal sector to rank what you starved. Cores and Salvage wipe when a Protocol starts.',
    ],
    target: 'station-protocols',
    tab: 'stats',
    group: 'protocols',
    availableWhen: (s) => isSystemUnlocked(s, 'protocols') && !guideSeen(s, 'guide-protocols'),
    completeWhen: (_s, tab) => tab === 'protocols',
  },
  {
    id: 'guide-protocols-run',
    title: 'How a Protocol works',
    body: [
      'Pick one card. The muted system sits idle until you clear the goal.',
      'Ranks persist. You can abandon from this screen. Not required until the Task List asks.',
    ],
    target: 'protocols-list',
    tab: 'protocols',
    screen: 'protocols',
    group: 'protocols',
    availableWhen: (s) =>
      guideSeen(s, 'guide-protocols') && !guideSeen(s, 'guide-protocols-run'),
  },
  {
    id: 'guide-echo',
    title: 'Echo Runs',
    body: [
      'Open More and tap Echo. Short gauntlets. The ship keeps its Cores.',
      'Echo points buy a tree that persists. Launch the run from Dock after you queue it here.',
    ],
    target: 'station-echo',
    tab: 'stats',
    group: 'echo',
    availableWhen: (s) => isSystemUnlocked(s, 'echo') && !guideSeen(s, 'guide-echo'),
    completeWhen: (_s, tab) => tab === 'echo',
  },
  {
    id: 'guide-echo-tree',
    title: 'Gauntlet, then tree',
    body: [
      'Queue an Echo, Launch from Dock, finish the waves, spend points on the tree.',
      'The lane you left is saved. Abandon returns you. Opens at sector 22.',
    ],
    target: 'echo-tree',
    tab: 'echo',
    screen: 'echo',
    group: 'echo',
    availableWhen: (s) => guideSeen(s, 'guide-echo') && !guideSeen(s, 'guide-echo-tree'),
  },
  {
    id: 'guide-specialists',
    title: 'Specialists',
    body: [
      'Open More and tap Specialists. Print Gunner, Warden, and Scavenger.',
      'They are not on the battlefield. Ranks persist when the hull does not.',
    ],
    target: 'station-specialists',
    tab: 'stats',
    group: 'specialists',
    availableWhen: (s) => isSystemUnlocked(s, 'specialists') && !guideSeen(s, 'guide-specialists'),
    completeWhen: (_s, tab) => tab === 'specialists',
  },
  {
    id: 'guide-specialists-rank',
    title: 'Print and rank',
    body: [
      'Gunner is damage, Warden is shield, Scavenger is salvage. Spend Salvage and Heat here.',
      'Mastery from ranks feeds the ship. They never appear as extra hulls on Sortie.',
    ],
    target: 'specialists-list',
    tab: 'specialists',
    screen: 'specialists',
    group: 'specialists',
    availableWhen: (s) =>
      guideSeen(s, 'guide-specialists') && !guideSeen(s, 'guide-specialists-rank'),
  },
  {
    id: 'guide-tasks',
    title: 'Task List',
    body: [
      'Open More and tap Task List. A checklist — Capital does not open for a sector number alone.',
      'Finish the work, then Capital can light.',
    ],
    target: 'station-tasks',
    tab: 'stats',
    group: 'tasks',
    availableWhen: (s) => isSystemUnlocked(s, 'tasks') && !guideSeen(s, 'guide-tasks'),
    completeWhen: (_s, tab) => tab === 'tasks',
  },
  {
    id: 'guide-tasks-list',
    title: 'The checklist',
    body: [
      'Each row is a gate. Done stays done across Rebuild.',
      'Capital waits on this list and sector 75. Do not skip rows hoping the door opens anyway.',
    ],
    target: 'tasks-list',
    tab: 'tasks',
    screen: 'tasks',
    group: 'tasks',
    availableWhen: (s) => guideSeen(s, 'guide-tasks') && !guideSeen(s, 'guide-tasks-list'),
  },
  {
    id: 'guide-capital',
    title: 'Capital',
    body: [
      'Open More and tap Capital. Second combat scale on this ship: Broadside, Bulkhead, Hold.',
      'No fighters. No towers. Needs sector 75 and a finished Task List.',
    ],
    target: 'station-capital',
    tab: 'stats',
    group: 'capital',
    availableWhen: (s) => isSystemUnlocked(s, 'capital') && !guideSeen(s, 'guide-capital'),
    completeWhen: (_s, tab) => tab === 'capital',
  },
  {
    id: 'guide-capital-tracks',
    title: 'On the ship',
    body: [
      'Broadside is damage, Bulkhead is hull, Hold is salvage. Rank them with Salvage and Heat.',
      'These persist. They are not extra ships on the lane.',
    ],
    target: 'capital-tracks',
    tab: 'capital',
    screen: 'capital',
    group: 'capital',
    availableWhen: (s) =>
      guideSeen(s, 'guide-capital') && !guideSeen(s, 'guide-capital-tracks'),
  },
  {
    id: 'guide-reinforce',
    title: 'Reinforce',
    body: [
      'Open More and tap Reinforce. Second prestige. Rebuild swaps guns. Reinforce keeps the foundry.',
      'The lane starts again, meaner. Opens at sector 80.',
    ],
    target: 'station-reinforce',
    tab: 'stats',
    group: 'reinforce',
    availableWhen: (s) => isSystemUnlocked(s, 'reinforce') && !guideSeen(s, 'guide-reinforce'),
    completeWhen: (_s, tab) => tab === 'reinforce',
  },
  {
    id: 'guide-reinforce-go',
    title: 'Keeps the shop',
    body: [
      'Reinforce spends a Rebuild-like reset but keeps Foundry stock and recipe levels.',
      'Future kits grow. Use it when the current hull has nothing left to teach you.',
    ],
    target: 'reinforce-go',
    tab: 'reinforce',
    screen: 'reinforce',
    group: 'reinforce',
    availableWhen: (s) =>
      guideSeen(s, 'guide-reinforce') && !guideSeen(s, 'guide-reinforce-go'),
  },
  {
    id: 'guide-salvage',
    title: 'Salvage',
    body: [
      'Sorties keep dropping Salvage. Open Cores anytime to raise run levels.',
      'Hull lost keeps those levels. Rebuild wipes them so you can swap the loadout. Tap a Core name for every stat.',
    ],
    target: 'salvage-stat',
    tab: 'combat',
    availableWhen: (s) =>
      guideSeen(s, 'guide-upgrade-plate') &&
      (s.resources.salvage > 0 || careerHighestSector(s) >= 1) &&
      !guideSeen(s, 'guide-salvage'),
  },
  {
    id: 'guide-part-drop',
    title: 'Foundry stock',
    body: [
      'The Foundry is online. Open Foundry and queue a recipe — wrecks feed the smelters.',
      'Skip this if you already walked the Foundry tour.',
    ],
    target: 'foundry-tab',
    screen: 'foundry',
    group: 'foundry',
    availableWhen: (s) =>
      (s.meta.discoveredModules?.length ?? 0) > 0 &&
      !guideSeen(s, 'guide-part-drop') &&
      !guideSeen(s, 'guide-foundry'),
    completeWhen: (_s, tab) => tab === 'foundry' || guideSeen(_s, 'guide-foundry'),
  },
  {
    id: 'guide-codex-tab',
    title: 'Codex',
    body: [
      'Open More and tap Codex. Encounter memory — families you have actually fought.',
      'This is a reference, not a shop. Nothing to spend.',
    ],
    target: 'station-codex',
    tab: 'stats',
    group: 'codex',
    availableWhen: (s) => isSystemUnlocked(s, 'codex') && !guideSeen(s, 'guide-codex-tab'),
    completeWhen: (_s, tab) => tab === 'codex',
  },
  {
    id: 'guide-codex-families',
    title: 'Families',
    body: [
      'Each family you have seen lists a soft counter for the loadout you are flying.',
      'Unknown signatures stay sealed until that hull shows up on the lane.',
    ],
    target: 'codex-families',
    tab: 'codex',
    screen: 'codex',
    group: 'codex',
    availableWhen: (s) =>
      guideSeen(s, 'guide-codex-tab') && !guideSeen(s, 'guide-codex-families'),
  },
  {
    id: 'guide-codex-roles',
    title: 'Hull roles',
    body: [
      'Fighter, skirmisher, sniper, and the rest are stand-off classes. Silhouettes on the lane match these names.',
      'Use this when a wave feels unfair — it usually names the counter. The next door waits until you leave.',
    ],
    target: 'codex-roles',
    tab: 'codex',
    screen: 'codex',
    group: 'codex',
    availableWhen: (s) =>
      guideSeen(s, 'guide-codex-families') && !guideSeen(s, 'guide-codex-roles'),
  },
  {
    id: 'guide-ai-tab',
    title: 'Process',
    body: [
      'Open More and tap Process. The hangar is learning the chores you already know how to do.',
      'Achievements grant Process points. Opens after First Blood (clear sector 1).',
    ],
    target: 'station-process',
    tab: 'stats',
    group: 'process',
    availableWhen: (s) => isSystemUnlocked(s, 'process') && !guideSeen(s, 'guide-ai-tab'),
    completeWhen: (_s, tab) => tab === 'process',
  },
  {
    id: 'guide-process-v2-what',
    title: 'What Process is',
    body: [
      'Process is the account learning your jobs. It is not a scarce one-off build pick.',
      'Over time you can own most of the board. Automation copies work you have already done by hand.',
    ],
    target: 'process-available',
    tab: 'process',
    screen: 'process',
    group: 'process-v2',
    tap: false,
    availableWhen: (s) =>
      isSystemUnlocked(s, 'process') &&
      !guideSeen(s, 'guide-process-v2-what') &&
      (guideSeen(s, 'guide-ai-tab') ||
        (s.process?.purchased.length ?? 0) > 0 ||
        (s.meta.completedAchievements ?? []).includes('first-blood')),
  },
  {
    id: 'guide-process-v2-earn',
    title: 'How points arrive',
    body: [
      'Process Points come from mastery: sector records, Cores, Network, Foundry, Research, Rebuilds, and unusual firsts.',
      'Repeating a solved loop is a poor farm. The Log pane lists what still pays.',
    ],
    target: 'process-earned',
    tab: 'process',
    screen: 'process',
    group: 'process-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      isSystemUnlocked(s, 'process') &&
      guideSeen(s, 'guide-process-v2-what') &&
      !guideSeen(s, 'guide-process-v2-earn'),
  },
  {
    id: 'guide-process-v2-ledger',
    title: 'Available vs Earned',
    body: [
      'Process Available is what you can spend right now.',
      'Process Earned is lifetime points. It never drops when you buy a node.',
    ],
    target: 'process-earned',
    tab: 'process',
    screen: 'process',
    group: 'process-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-process-v2-earn') && !guideSeen(s, 'guide-process-v2-ledger'),
  },
  {
    id: 'guide-process-v2-automation',
    title: 'Automation',
    body: [
      'Automation nodes add helpers, then settings, then full loops.',
      'They expose controls. They should not silently pick a build for you.',
    ],
    target: 'process-automation',
    tab: 'process',
    screen: 'process',
    group: 'process-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-process-v2-ledger') && !guideSeen(s, 'guide-process-v2-automation'),
  },
  {
    id: 'guide-process-v2-qol',
    title: 'QoL',
    body: [
      'QoL nodes make the sitting kinder: longer offline, faster combat sim, and similar comforts.',
      'They are not the same as Automation. Buy them when the sitting needs them.',
    ],
    target: 'process-qol',
    tab: 'process',
    screen: 'process',
    group: 'process-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-process-v2-automation') && !guideSeen(s, 'guide-process-v2-qol'),
  },
  {
    id: 'guide-process-v2-accumulation',
    title: 'Accumulation',
    body: [
      'Lifetime Process Earned unlocks permanent account milestones: Salvage, Network speed, offline cap, and more.',
      'Spending points does not slow Accumulation. Only Earned counts.',
    ],
    target: 'process-accumulation',
    tab: 'process',
    screen: 'process',
    group: 'process-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-process-v2-qol') && !guideSeen(s, 'guide-process-v2-accumulation'),
  },
  {
    id: 'guide-process-v2-understand',
    title: 'Learn it first',
    body: [
      'Unlock automation after you understand the underlying system.',
      'Cores Buy Max waits until you have ranked a Core. Network Optimise waits until you have assigned drones.',
    ],
    target: 'process-automation',
    tab: 'process',
    screen: 'process',
    group: 'process-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-process-v2-accumulation') && !guideSeen(s, 'guide-process-v2-understand'),
  },
  {
    id: 'guide-process-v2-buy',
    title: 'First purchase',
    body: [
      'Buy a cheap helper that matches work you already do. Core Buy Max or Network Optimise if you can afford them.',
      'Spending Available does not reduce Earned.',
    ],
    target: 'process-first-buy',
    tab: 'process',
    screen: 'process',
    group: 'process-v2',
    required: true,
    tap: false,
    availableWhen: (s) =>
      guideSeen(s, 'guide-process-v2-understand') && !guideSeen(s, 'guide-process-v2-buy'),
    completeWhen: (s) => (s.process?.purchased.length ?? 0) > 0,
  },
  {
    id: 'guide-process-network',
    title: 'Network helper',
    body: [
      'Network Optimise is a manual tap. It applies the mix you chose — Push, Defence, Farm, Industry, Research, Balanced, or custom ratios.',
      'Auto Optimise comes later. It will not invent a hidden best allocation.',
    ],
    target: 'network-optimise-btn',
    tab: 'network',
    screen: 'network',
    group: 'process-network',
    tap: false,
    availableWhen: (s) =>
      isSystemUnlocked(s, 'process') &&
      isSystemUnlocked(s, 'network') &&
      !guideSeen(s, 'guide-process-network') &&
      guideSeen(s, 'guide-process-v2-buy') &&
      !s.process?.purchased.includes('network-balance') &&
      (s.process?.purchased.includes('network-optimise') ||
        (s.resources.aiPoints >= 4 &&
          Object.values(s.shipyard.moduleLevels ?? {}).some((n) => n > 0))),
  },
  {
    id: 'guide-process-queue',
    title: 'Queues',
    body: [
      'A queue is an ordered list you write. Smelters or Research pull the next item you lined up.',
      'Turn Auto on only after the queue shows the work you want repeated.',
    ],
    target: 'process-foundry-queue',
    tab: 'process',
    screen: 'process',
    group: 'process-queue',
    tap: false,
    availableWhen: (s) =>
      isSystemUnlocked(s, 'foundry') &&
      !guideSeen(s, 'guide-process-queue') &&
      (s.process?.purchased.includes('foundry-queue') || s.process?.purchased.includes('research-queue')) &&
      !s.process?.purchased.includes('foundry-auto') &&
      !s.process?.purchased.includes('research-focus'),
  },
  {
    id: 'guide-process-config',
    title: 'Priorities live here',
    body: [
      'Configurable automation is useless if you cannot see the knobs.',
      'Core priorities, Network presets, and keep/scrap rules sit on the Process node after you buy them.',
    ],
    target: 'process-config',
    tab: 'process',
    screen: 'process',
    group: 'process-config',
    tap: false,
    availableWhen: (s) =>
      !guideSeen(s, 'guide-process-config') &&
      (s.process?.purchased.includes('core-priority') ||
        s.process?.purchased.includes('network-presets') ||
        s.process?.purchased.includes('reliquary-keep')),
  },
  {
    id: 'guide-challenges',
    title: 'Protocols unlocked',
    body: [
      'Sector 18 — open More and tap Protocols. Restricted sorties buff one system. Optional.',
    ],
    target: 'station-protocols',
    tab: 'stats',
    group: 'protocols',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'protocols') &&
      !s.protocols?.activeId &&
      !guideSeen(s, 'guide-challenges') &&
      !guideSeen(s, 'guide-protocols'),
    completeWhen: (_s, tab) => tab === 'protocols' || guideSeen(_s, 'guide-protocols'),
  },
  {
    id: 'guide-logs',
    title: 'Foundry Logs',
    body: [
      'Open More and tap Foundry Logs. Short industrial notes as doors and bosses open.',
      'Flavour, not a system you have to spend in.',
    ],
    target: 'station-logs',
    tab: 'stats',
    group: 'logs',
    availableWhen: (s) =>
      guideSeen(s, 'guide-furnace') &&
      (s.prestige.prestigeCount ?? 0) >= 1 &&
      !guideSeen(s, 'guide-logs'),
    completeWhen: (_s, tab) => tab === 'logs',
  },
]
/** Dock/launch/sortie/cores tips that must not reappear after the first soft reset. */
export const STARTER_GUIDE_IDS = [
  'guide-shipyard-tab',
  'guide-frame-select',
  'guide-launch',
  'guide-sortie-field',
  'guide-sortie-guns',
  'guide-sortie-hull',
  'guide-sortie-salvage',
  'guide-salvage-lesson',
  'guide-cores-sheet',
  'guide-upgrade-pulse',
  'guide-upgrade-plate',
  'guide-cores-inspect',
  'guide-cores-persist',
  'guide-relaunch-upgraded',
] as const

/** In-screen Network lessons after the door. Replay if a career never opened Network. */
export const NETWORK_GUIDE_IDS = [
  'guide-drone-cap',
  'guide-network-make',
  'guide-network-assign',
  'guide-network-sortie',
  'guide-network-bars',
  'guide-network-links',
] as const

export const NETWORK_RELAY_GUIDE_IDS = [
  'guide-network-relay',
  'guide-network-relay-parent',
] as const

/** First-Rebuild hangar walkthrough. Skip dismisses the whole group. */
export const REBUILD_GUIDE_IDS = [
  'guide-prestige-tab',
  'guide-prestige-ready',
  'guide-prestige-hangar',
  'guide-prestige-confirm',
] as const

/** Furnace 2.0 tour after the door. Skip on the first step dismisses the group. */
export const FURNACE_V2_GUIDE_IDS = [
  'guide-furnace-v2-ash',
  'guide-furnace-v2-heat',
  'guide-furnace-v2-cap',
  'guide-furnace-v2-rate',
  'guide-furnace-v2-channel',
  'guide-furnace-v2-consume',
  'guide-furnace-v2-levels',
  'guide-furnace-v2-limit',
  'guide-furnace-v2-bank',
  'guide-furnace-v2-activate',
  'guide-furnace-v2-net',
] as const

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
export function guideQueueQuiet(state: GameState): boolean {
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
