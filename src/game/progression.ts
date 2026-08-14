/** Act 1 spine, system gates, achievements, and guided onboarding. */

import type { GameState, Resources, TabId } from './types'

export {
  WAVES_PER_SECTOR,
  isSectorBossWave,
  trashWavesForSector,
  wavesForSector,
} from './sectors'

/** Soft campaign climax — first Act 1 clear beat (ITRTG “first Baal” analogue). */
export const ACT1_FINAL_SECTOR = 30

/**
 * Prestige becomes available mid–Act 1.
 * Maps nearer ITRTG’s first Hyperion soft-reset (~1h real), not first Baal.
 */
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
 * Whole systems unlock by career progress. Tabs stay visible with requirements.
 * Combat, Shipyard, and Stats are always available.
 * AI unlocks when the first achievement is completed.
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
    tip: 'Choir-ash from kills becomes Heat. Spend Heat on always-on system ranks.',
  },
  {
    id: 'yard',
    requiresSectorEver: 0,
    label: 'Yard Grid',
    tip: 'Place buildings. Spend Ingots on arms that apply on the next Rebuild.',
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
    tip: 'Achievements grant Process points. Spend them on automation and QoL.',
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
    requiresResearch: 'tactical-codex',
    label: 'Codex',
    tip: 'Enemy families remember soft counters. Fit modules to match the sector. Unlock once — permanent.',
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
    label: 'AI',
    tip: 'Achievements grant AI Points. Spend them on automation, QoL, and doctrines.',
  },
  {
    id: 'prestige',
    requiresSectorEver: 8,
    label: 'Prestige',
    tip: 'Rebuild from sector 4 to swap hull and Cores. Challenges open after Act 1 (sector 30).',
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
    description: 'Clear sector 1. Unlocks the AI Network.',
    rewardAiPoints: 1,
    condition: { type: 'sector-ever', sector: 1 },
  },
  {
    id: 'hangar-opened',
    name: 'Hangar Opened',
    description: 'Clear sector 4 and unlock Base.',
    rewardAiPoints: 1,
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
    id: 'first-research',
    name: 'Archive Seed',
    description: 'Complete any research project.',
    rewardAiPoints: 1,
    condition: { type: 'research-count', min: 1 },
  },
  {
    id: 'neural-link',
    name: 'Neural Link',
    description: 'Purchase any AI automation, QoL, or doctrine.',
    rewardAiPoints: 1,
    condition: { type: 'ai-purchase-count', min: 1 },
  },
  {
    id: 'first-prestige',
    name: 'Soft Reset',
    description: 'Prestige for the first time.',
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
    description: 'Prestige 5 times.',
    rewardAiPoints: 3,
    condition: { type: 'prestige-count', min: 5 },
  },
  {
    id: 'prestiges-10',
    name: 'Matter Engine',
    description: 'Prestige 10 times.',
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
  // --- Repeatables (long AIP sink) ---
  {
    id: 'sector-grind',
    name: 'Sector Patrol',
    description: 'Every 25 lifetime sector clears. Repeatable.',
    rewardAiPoints: 2,
    condition: { type: 'lifetime-sectors', min: 25 },
    repeatable: true,
    repeatStep: 25,
  },
  {
    id: 'wave-grind',
    name: 'Wave Battery',
    description: 'Every 100 lifetime wave clears. Repeatable.',
    rewardAiPoints: 2,
    condition: { type: 'lifetime-waves', min: 100 },
    repeatable: true,
    repeatStep: 100,
  },
  {
    id: 'prestige-grind',
    name: 'Prestige Loop',
    description: 'Every 3 prestiges. Repeatable.',
    rewardAiPoints: 2,
    condition: { type: 'prestige-count', min: 3 },
    repeatable: true,
    repeatStep: 3,
  },
  {
    id: 'fab-grind',
    name: 'Assembly Line',
    description: 'Every 3 Fabrication Bay crafts. Repeatable.',
    rewardAiPoints: 2,
    condition: { type: 'lifetime-fab-crafts', min: 3 },
    repeatable: true,
    repeatStep: 3,
  },
  {
    id: 'merge-grind',
    name: 'Collider Duty',
    description: 'Every 5 Signal Core merges. Repeatable.',
    rewardAiPoints: 2,
    condition: { type: 'lifetime-core-merges', min: 5 },
    repeatable: true,
    repeatStep: 5,
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
      return state.ai.purchased.length
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

export function isSystemUnlocked(state: GameState, systemId: TabId): boolean {
  if (
    systemId === 'dock' ||
    systemId === 'combat' ||
    systemId === 'network' ||
    systemId === 'shipyard' ||
    systemId === 'stats'
  ) {
    return true
  }
  if (systemId === 'cores') {
    return false
  }
  if (systemId === 'foundry') {
    return careerHighestSector(state) >= 2
  }
  if (systemId === 'yard') {
    return (state.prestige.prestigeCount ?? 0) >= 1
  }
  if (systemId === 'ai' || systemId === 'process') {
    return state.meta.aiUnlocked || state.meta.completedAchievements.length > 0
  }
  if (systemId === 'codex') {
    if (careerHighestSector(state) < 6) return false
    return (
      state.meta.codexUnlocked === true ||
      state.research.unlocked.includes('tactical-codex')
    )
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
  if (systemId === 'combat' || systemId === 'shipyard' || systemId === 'stats') {
    return null
  }
  if (systemId === 'foundry') {
    return 'Clear sector 2'
  }
  if (systemId === 'yard') {
    return 'Rebuild once'
  }
  if (systemId === 'ai' || systemId === 'process') {
    return 'Complete First Blood (clear sector 1)'
  }
  if (systemId === 'codex') {
    return 'Clear sector 6 · Research tactical-codex (once)'
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
      return true
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

  if (ever >= 4 && !state.shipyard.unlockedFrames.includes('line-frame')) {
    state.shipyard.unlockedFrames = [...state.shipyard.unlockedFrames, 'line-frame']
  }
  if (ever >= 8 && !state.shipyard.unlockedFrames.includes('cruiser-frame')) {
    state.shipyard.unlockedFrames = [...state.shipyard.unlockedFrames, 'cruiser-frame']
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
  body: string
  /** Matches data-guide="…" on UI elements. */
  target: string
  /** Switch the player to this tab when the step becomes active. */
  tab?: TabId
  availableWhen: (state: GameState) => boolean
  /** Optional: auto-complete when predicate becomes true. */
  completeWhen?: (state: GameState, tab: TabId) => boolean
  /**
   * Required lessons hide Skip and block clicks outside the spotlight
   * until completeWhen (or the highlighted control) finishes the step.
   */
  required?: boolean
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'guide-shipyard-tab',
    title: 'Dock',
    body: 'This is the hangar. Hull and Cores live here. Launch starts a sortie of waves.',
    target: 'dock-tab',
    tab: 'dock',
    availableWhen: (s) =>
      s.combat.docked && !s.shipyard.frameLocked && !guideSeen(s, 'guide-shipyard-tab'),
  },
  {
    id: 'guide-frame-select',
    title: 'Your hull',
    body: 'Scout Hull is fitted. Salvage levels Cores during a sortie. Rebuild later to swap.',
    target: 'dock-tab',
    tab: 'dock',
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
    body: 'Tap Launch sortie. Combat keeps running even if you open Dock, Network, or Foundry.',
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
    id: 'guide-after-death',
    title: 'Docked for repairs',
    body: 'That fight ended with a hull breach — you are docked. Open Shipyard and buy Plate Layer with your scrap.',
    target: 'shipyard-tab',
    required: true,
    availableWhen: (s) =>
      (s.meta.starterCombatLesson ?? 0) === 1 &&
      !s.shipyard.unlockedModules.includes('plate-layer') &&
      !guideSeen(s, 'guide-after-death'),
    completeWhen: (_s, tab) => tab === 'shipyard',
  },
  {
    id: 'guide-modules-tab',
    title: 'Modules',
    body: 'Switch to Modules to unlock and fit defenses.',
    target: 'shipyard-modules-tab',
    tab: 'shipyard',
    required: true,
    availableWhen: (s) =>
      guideSeen(s, 'guide-after-death') &&
      (s.meta.starterCombatLesson ?? 0) === 1 &&
      !s.shipyard.unlockedModules.includes('plate-layer') &&
      !guideSeen(s, 'guide-modules-tab'),
  },
  {
    id: 'guide-unlock-plate',
    title: 'Plate Layer',
    body: 'Unlock Plate Layer. Extra hull and armor are the difference between a short flight and a real push.',
    target: 'unlock-plate-layer',
    tab: 'shipyard',
    required: true,
    availableWhen: (s) =>
      (s.meta.starterCombatLesson ?? 0) === 1 &&
      !s.shipyard.unlockedModules.includes('plate-layer') &&
      guideSeen(s, 'guide-modules-tab') &&
      !guideSeen(s, 'guide-unlock-plate'),
    completeWhen: (s) => s.shipyard.unlockedModules.includes('plate-layer'),
  },
  {
    id: 'guide-fit-plate',
    title: 'Fit Plate',
    body: 'Fit Plate Layer into your empty defense slot.',
    target: 'fit-plate-layer',
    tab: 'shipyard',
    required: true,
    availableWhen: (s) =>
      (s.meta.starterCombatLesson ?? 0) === 1 &&
      s.shipyard.unlockedModules.includes('plate-layer') &&
      !s.shipyard.modules.includes('plate-layer') &&
      !guideSeen(s, 'guide-fit-plate'),
    completeWhen: (s) => s.shipyard.modules.includes('plate-layer'),
  },
  {
    id: 'guide-relaunch-plated',
    title: 'Launch again',
    body: 'Plate is fitted. Launch and push again — the next breach will teach you Salvage upgrades.',
    target: 'launch-btn',
    tab: 'combat',
    required: true,
    availableWhen: (s) =>
      (s.meta.starterCombatLesson ?? 0) === 1 &&
      s.shipyard.modules.includes('plate-layer') &&
      s.combat.docked &&
      !guideSeen(s, 'guide-relaunch-plated'),
    completeWhen: (s) => !s.combat.docked || (s.meta.starterCombatLesson ?? 0) >= 2,
  },
  {
    id: 'guide-salvage-lesson',
    title: 'Salvage recovered',
    body: 'The wreck left Salvage. Open Shipyard and upgrade both fitted modules before you Resume.',
    target: 'shipyard-tab',
    required: true,
    availableWhen: (s) =>
      (s.meta.starterCombatLesson ?? 0) === 2 &&
      ((s.shipyard.moduleLevels['pulse-cannon'] ?? 0) < 1 ||
        (s.shipyard.moduleLevels['plate-layer'] ?? 0) < 1) &&
      !guideSeen(s, 'guide-salvage-lesson'),
    completeWhen: (_s, tab) => tab === 'shipyard',
  },
  {
    id: 'guide-upgrade-pulse',
    title: 'Upgrade Pulse',
    body: 'Spend Salvage to raise Pulse Cannon one run level. This resets on prestige — cheap power now.',
    target: 'upgrade-pulse-cannon',
    tab: 'shipyard',
    required: true,
    availableWhen: (s) =>
      guideSeen(s, 'guide-salvage-lesson') &&
      (s.meta.starterCombatLesson ?? 0) === 2 &&
      (s.shipyard.moduleLevels['pulse-cannon'] ?? 0) < 1 &&
      !guideSeen(s, 'guide-upgrade-pulse'),
    completeWhen: (s) => (s.shipyard.moduleLevels['pulse-cannon'] ?? 0) >= 1,
  },
  {
    id: 'guide-upgrade-plate',
    title: 'Upgrade Plate',
    body: 'Upgrade Plate Layer next. Both modules should be Salvage-ranked before you return to combat.',
    target: 'upgrade-plate-layer',
    tab: 'shipyard',
    required: true,
    availableWhen: (s) =>
      (s.meta.starterCombatLesson ?? 0) === 2 &&
      (s.shipyard.moduleLevels['pulse-cannon'] ?? 0) >= 1 &&
      (s.shipyard.moduleLevels['plate-layer'] ?? 0) < 1 &&
      !guideSeen(s, 'guide-upgrade-plate'),
    completeWhen: (s) => (s.shipyard.moduleLevels['plate-layer'] ?? 0) >= 1,
  },
  {
    id: 'guide-relaunch-upgraded',
    title: 'Resume push',
    body: 'Loadout upgraded. Resume combat — Base unlocks after you clear sector 4.',
    target: 'launch-btn',
    tab: 'combat',
    required: true,
    availableWhen: (s) =>
      (s.meta.starterCombatLesson ?? 0) === 2 &&
      (s.shipyard.moduleLevels['pulse-cannon'] ?? 0) >= 1 &&
      (s.shipyard.moduleLevels['plate-layer'] ?? 0) >= 1 &&
      s.combat.docked &&
      !guideSeen(s, 'guide-relaunch-upgraded') &&
      !isSystemUnlocked(s, 'base'),
    completeWhen: (s) => !s.combat.docked || isSystemUnlocked(s, 'base'),
  },
  {
    id: 'guide-base-tab',
    title: 'Base unlocked',
    body: 'Tap Base. Assign worker drones to stations to produce resources.',
    target: 'base-tab',
    availableWhen: (s) => isSystemUnlocked(s, 'base') && !guideSeen(s, 'guide-base-tab'),
    completeWhen: (_s, tab) => tab === 'base',
  },
  {
    id: 'guide-assign-scrap',
    title: 'Assign workers',
    body: 'Tap + on Scrap Field to assign an idle worker. Fill toward black-bar — extra bodies past BB do nothing.',
    target: 'station-scrap-field-plus',
    tab: 'base',
    availableWhen: (s) =>
      guideSeen(s, 'guide-base-tab') &&
      !guideSeen(s, 'guide-assign-scrap') &&
      isSystemUnlocked(s, 'base') &&
      s.base.workerDrones > 0,
    completeWhen: (s) => (s.base.assignments['scrap-field'] ?? 0) > 0,
  },
  {
    id: 'guide-drone-cap',
    title: 'Drone Network',
    body: 'Tap Network. Assign idle drones to Strike (damage) and Ward (shield). They fill bars over time — they do not fight.',
    target: 'network-tab',
    availableWhen: (s) =>
      s.base.workerDrones > 0 &&
      !guideSeen(s, 'guide-drone-cap') &&
      (s.base.assignments['strike'] ?? 0) + (s.base.assignments['ward'] ?? 0) === 0,
    completeWhen: (s) =>
      (s.base.assignments['strike'] ?? 0) + (s.base.assignments['ward'] ?? 0) > 0,
  },
  {
    id: 'guide-power-grid',
    title: 'Energy',
    body: 'Assign a worker to Power Grid. Energy appears in the header and pays for advanced modules.',
    target: 'station-power-grid-plus',
    tab: 'base',
    availableWhen: (s) =>
      guideSeen(s, 'guide-assign-scrap') &&
      !guideSeen(s, 'guide-power-grid') &&
      isSystemUnlocked(s, 'base'),
    completeWhen: (s) => (s.base.assignments['power-grid'] ?? 0) > 0,
  },
  {
    id: 'guide-reliquary',
    title: 'Reliquary',
    body: 'Open More and tap Reliquary. Kills drop shards — fit one per colour slot. Extra copies fill resonance.',
    target: 'station-reliquary',
    tab: 'stats',
    availableWhen: (s) => isSystemUnlocked(s, 'reliquary') && !guideSeen(s, 'guide-reliquary'),
    completeWhen: (_s, tab) => tab === 'reliquary',
  },
  {
    id: 'guide-furnace',
    title: 'Furnace',
    body: 'Open More and tap Furnace. Choir-ash collects itself. Bank it into Heat, then buy Attack / Defense / Lab / Workshop.',
    target: 'station-furnace',
    tab: 'stats',
    availableWhen: (s) => isSystemUnlocked(s, 'furnace') && !guideSeen(s, 'guide-furnace'),
    completeWhen: (_s, tab) => tab === 'furnace',
  },
  {
    id: 'guide-research-tab',
    title: 'Research unlocked',
    body: 'Open More and tap Research. Kills feed Material, Energy, and Observation — focus one for a large bonus.',
    target: 'station-research',
    tab: 'stats',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'research') && !guideSeen(s, 'guide-research-tab'),
    completeWhen: (_s, tab) => tab === 'research',
  },
  {
    id: 'guide-yard',
    title: 'Yard Grid',
    body: 'Open More and tap Yard. Buildings make Ore, Flux, and Ingots even while you are docked. Spend Ingots on arms — they apply on the next Rebuild.',
    target: 'station-yard',
    tab: 'stats',
    availableWhen: (s) => isSystemUnlocked(s, 'yard') && !guideSeen(s, 'guide-yard'),
    completeWhen: (_s, tab) => tab === 'yard',
  },
  {
    id: 'guide-protocols',
    title: 'Protocols',
    body: 'Open More and tap Protocols. Restricted sorties rank one muted system. Cores wipe on start.',
    target: 'station-protocols',
    tab: 'stats',
    availableWhen: (s) => isSystemUnlocked(s, 'protocols') && !guideSeen(s, 'guide-protocols'),
    completeWhen: (_s, tab) => tab === 'protocols',
  },
  {
    id: 'guide-echo',
    title: 'Echo Runs',
    body: 'Open More and tap Echo. Short gauntlets grant Echo points for a skill tree. Cores stay.',
    target: 'station-echo',
    tab: 'stats',
    availableWhen: (s) => isSystemUnlocked(s, 'echo') && !guideSeen(s, 'guide-echo'),
    completeWhen: (_s, tab) => tab === 'echo',
  },
  {
    id: 'guide-sensor-net',
    title: 'Farm Data',
    body: 'Assign workers to Sensor Net on Base to earn Data for more research.',
    target: 'station-sensor-net-plus',
    tab: 'base',
    availableWhen: (s) =>
      guideSeen(s, 'guide-research-tab') &&
      !guideSeen(s, 'guide-sensor-net') &&
      isSystemUnlocked(s, 'research'),
    completeWhen: (s) => (s.base.assignments['sensor-net'] ?? 0) > 0,
  },
  {
    id: 'guide-alloy-foundry',
    title: 'Alloys',
    body: 'Alloy Foundry converts scrap into Alloys for module unlocks. Assign a worker when you can afford the upkeep.',
    target: 'station-alloy-foundry-plus',
    tab: 'base',
    availableWhen: (s) =>
      s.research.unlocked.includes('alloy-smelting') &&
      !guideSeen(s, 'guide-alloy-foundry'),
    completeWhen: (s) => (s.base.assignments['alloy-foundry'] ?? 0) > 0,
  },
  {
    id: 'guide-salvage',
    title: 'Salvage',
    body: 'Combat keeps dropping Salvage. Spend it in Shipyard anytime to raise run levels on owned modules.',
    target: 'salvage-stat',
    tab: 'shipyard',
    availableWhen: (s) =>
      guideSeen(s, 'guide-upgrade-plate') &&
      (s.resources.salvage > 0 || careerHighestSector(s) >= 1) &&
      !guideSeen(s, 'guide-salvage'),
  },
  {
    id: 'guide-part-drop',
    title: 'First blueprint fragment',
    body: 'The Foundry is online — enemies can now drop module parts. This fragment unlocks a blueprint in Shipyard; gather casings, cores, and lenses for the Fab Bay.',
    target: 'combat-tab',
    availableWhen: (s) =>
      (s.meta.discoveredModules?.length ?? 0) > 0 && !guideSeen(s, 'guide-part-drop'),
    completeWhen: (_s, tab) => tab === 'combat',
  },
  {
    id: 'guide-module-fab',
    title: 'Fabrication Bay',
    body: 'Tap Fabrication on Base. Deposit parts and assign Fab Bay workers to craft permanent modules.',
    target: 'fab-bay-btn',
    tab: 'base',
    availableWhen: (s) =>
      s.research.unlocked.includes('module-fab') && !guideSeen(s, 'guide-module-fab'),
  },
  {
    id: 'guide-essence',
    title: 'Essence',
    body: 'Bosses drop Essence. Bind permanent constructs at the bottom of Research.',
    target: 'essence-constructs',
    tab: 'research',
    availableWhen: (s) =>
      (s.resources.essence > 0 || careerHighestSector(s) >= 5) &&
      !guideSeen(s, 'guide-essence'),
  },
  {
    id: 'guide-codex-tab',
    title: 'Codex',
    body: 'Tap Codex. It remembers enemy families and soft counters for your loadout.',
    target: 'codex-tab',
    availableWhen: (s) => isSystemUnlocked(s, 'codex') && !guideSeen(s, 'guide-codex-tab'),
    completeWhen: (_s, tab) => tab === 'codex',
  },
  {
    id: 'guide-core-tab',
    title: 'Core training',
    body: 'Tap Core. Assign workers to training stations to raise attributes that wipe on prestige.',
    target: 'core-tab',
    availableWhen: (s) => isSystemUnlocked(s, 'core') && !guideSeen(s, 'guide-core-tab'),
    completeWhen: (_s, tab) => tab === 'core',
  },
  {
    id: 'guide-train-logistics',
    title: 'Logistics',
    body: 'Train Logistics — it speeds industry, Fab Bay, and blueprint part drops.',
    target: 'core-train-logistics-plus',
    tab: 'core',
    availableWhen: (s) =>
      guideSeen(s, 'guide-core-tab') &&
      s.research.unlocked.includes('core-training') &&
      !guideSeen(s, 'guide-train-logistics'),
    completeWhen: (s) => (s.base.assignments['train-logistics'] ?? 0) > 0,
  },
  {
    id: 'guide-ai-tab',
    title: 'Process',
    body: 'Open More and tap Process. Achievements grant Process points for automation.',
    target: 'station-process',
    tab: 'stats',
    availableWhen: (s) => isSystemUnlocked(s, 'process') && !guideSeen(s, 'guide-ai-tab'),
    completeWhen: (_s, tab) => tab === 'process',
  },
  {
    id: 'guide-achievements',
    title: 'Achievements',
    body: 'Process lists one-off and repeatable achievements. They fund automation nodes.',
    target: 'station-process',
    tab: 'stats',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'process') &&
      guideSeen(s, 'guide-ai-tab') &&
      !guideSeen(s, 'guide-achievements'),
    completeWhen: (_s, tab) => tab === 'process',
  },
  {
    id: 'guide-prestige-tab',
    title: 'Prestige unlocked',
    body: 'Tap Prestige. Soft-reset from sector 10 for Prestige Matter. Challenges open after clearing Act 1 (sector 30).',
    target: 'prestige-tab',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'prestige') && !guideSeen(s, 'guide-prestige-tab'),
    completeWhen: (_s, tab) => tab === 'prestige',
  },
  {
    id: 'guide-prestige-ready',
    title: 'Ready to Prestige',
    body: 'You reached the prestige threshold. Tap Prestige to soft-reset and earn Prestige Matter.',
    target: 'prestige-btn',
    tab: 'prestige',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'prestige') &&
      guideSeen(s, 'guide-prestige-tab') &&
      s.combat.sector >= PRESTIGE_MIN_SECTOR &&
      !s.prestige.activeChallengeId &&
      s.prestige.prestigeCount === 0 &&
      !guideSeen(s, 'guide-prestige-ready'),
    completeWhen: (s) => s.prestige.prestigeCount > 0,
  },
  {
    id: 'guide-matter-shop',
    title: 'Matter shop',
    body: 'Spend Prestige Matter on permanent ranks. Fragment Magnet boosts scarce blueprint part drops.',
    target: 'matter-shop',
    tab: 'prestige',
    availableWhen: (s) =>
      (s.prestige.prestigeCount > 0 || s.resources.prestigeMatter > 0) &&
      !guideSeen(s, 'guide-matter-shop'),
  },
  {
    id: 'guide-signal-cores',
    title: 'Signal Cores',
    body: 'Signal Cores drop in combat after prestige (or career sector 10). Equip them on the Core tab.',
    target: 'signal-cores-subtab',
    tab: 'core',
    availableWhen: (s) =>
      (s.prestige.prestigeCount >= 1 || careerHighestSector(s) >= 10) &&
      isSystemUnlocked(s, 'core') &&
      !guideSeen(s, 'guide-signal-cores'),
  },
  {
    id: 'guide-challenges',
    title: 'Protocols unlocked',
    body: 'Sector 18 — open More and tap Protocols. Restricted sorties buff one system. Optional.',
    target: 'station-protocols',
    tab: 'stats',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'protocols') &&
      !s.protocols?.activeId &&
      !guideSeen(s, 'guide-challenges'),
    completeWhen: (_s, tab) => tab === 'protocols' || guideSeen(_s, 'guide-protocols'),
  },
  {
    id: 'guide-challenge-shop',
    title: 'Challenge shop',
    body: 'Spend Challenge Points here. Loot Protocols permanently boost blueprint part drops. Challenges stay optional.',
    target: 'challenge-shop',
    tab: 'prestige',
    availableWhen: (s) =>
      challengesContentUnlocked(s) &&
      guideSeen(s, 'guide-challenges') &&
      !guideSeen(s, 'guide-challenge-shop'),
  },
  {
    id: 'guide-ascension',
    title: 'Ascension',
    body: 'After Act 1, Ascend at sector 30+ to boost Prestige Matter gains, unlock deep shop ranks, and open Ascension-entry challenges.',
    target: 'ascend-btn',
    tab: 'prestige',
    availableWhen: (s) => s.meta.act1Cleared && !guideSeen(s, 'guide-ascension'),
  },
]

/** Dock/launch tips that must not reappear after the first soft reset. */
export const STARTER_GUIDE_IDS = [
  'guide-shipyard-tab',
  'guide-frame-select',
  'guide-launch',
  'guide-after-death',
  'guide-modules-tab',
  'guide-unlock-plate',
  'guide-fit-plate',
  'guide-relaunch-plated',
  'guide-salvage-lesson',
  'guide-upgrade-pulse',
  'guide-upgrade-plate',
  'guide-relaunch-upgraded',
] as const

function markGuideSeen(seen: string[], id: string): boolean {
  if (seen.includes(id)) return false
  seen.push(id)
  return true
}

/**
 * After prestige / ascension, retire starter dock/launch tips.
 * Ascended careers skip the full onboarding catalog — they already cleared Act 1.
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
    if ((state.meta.starterCombatLesson ?? 0) < 2) {
      state.meta.starterCombatLesson = 2
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
    // Evaluate availability as if this step is still unseen.
    const probe: GameState = {
      ...state,
      meta: { ...state.meta, seenOnboarding: seen },
    }
    if (!step.availableWhen(probe)) continue
    if (!step.completeWhen?.(state, tab)) continue
    seen.push(step.id)
    changed = true
  }
  if (!changed) return state
  const next = structuredClone(state)
  next.meta.seenOnboarding = seen
  return next
}

export function activeGuideStep(state: GameState, tab: TabId): GuideStep | null {
  for (const step of GUIDE_STEPS) {
    if (state.meta.seenOnboarding.includes(step.id)) continue
    if (!step.availableWhen(state)) continue
    if (step.completeWhen?.(state, tab)) continue
    return step
  }
  return null
}

export function acknowledgeOnboarding(state: GameState, tipId: string): GameState {
  if (state.meta.seenOnboarding.includes(tipId)) return state
  const next = structuredClone(state)
  next.meta.seenOnboarding = [...next.meta.seenOnboarding, tipId]
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
