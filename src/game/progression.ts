/** Act 1 spine, system gates, achievements, and guided onboarding. */

import type { GameState, Resources, TabId } from './types'

/** Waves fought to clear one sector (Advance or Hold). */
export const WAVES_PER_SECTOR = 5

/** Soft campaign climax — first Act 1 clear beat. */
export const ACT1_FINAL_SECTOR = 30

/** Prestige becomes available around mid–Act 1 once waves slow the climb. */
export const PRESTIGE_MIN_SECTOR = 8

export type SystemId = Exclude<TabId, 'combat' | 'shipyard' | 'stats'>

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
    requiresSectorEver: 3,
    label: 'Base',
    tip: 'Worker drones manufacture over time. Assign them to named stations for production.',
  },
  {
    id: 'research',
    requiresSectorEver: 5,
    label: 'Research',
    tip: 'Spend Data on research. Alloy Smelting unlocks the Foundry station.',
  },
  {
    id: 'codex',
    requiresSectorEver: 5,
    requiresResearch: 'tactical-codex',
    label: 'Codex',
    tip: 'Enemy families remember soft counters. Fit modules to match the sector.',
  },
  {
    id: 'core',
    requiresSectorEver: 5,
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
    requiresSectorEver: 5,
    label: 'Prestige',
    tip: 'Soft-reset from sector 8+ for Prestige Matter. Challenges open after your first prestige.',
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
    description: 'Clear sector 3 and unlock Base.',
    rewardAiPoints: 1,
    condition: { type: 'sector-ever', sector: 3 },
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
    `Achievement: ${label} (+${def.rewardAiPoints} AI).`,
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
  if (systemId === 'combat' || systemId === 'shipyard' || systemId === 'stats') {
    return true
  }
  if (systemId === 'ai') {
    return state.meta.aiUnlocked || state.meta.completedAchievements.length > 0
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
  if (systemId === 'ai') {
    return 'Complete First Blood (clear sector 1)'
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
      return true
    case 'alloys':
      // Needed for early module unlocks; always show once Base exists, else if spent/gained.
      return (
        isSystemUnlocked(state, 'base') ||
        state.resources.alloys !== 5 ||
        state.research.unlocked.includes('alloy-smelting')
      )
    case 'energy':
      return isSystemUnlocked(state, 'base') || state.resources.energy !== 10
    case 'salvage':
      return state.resources.salvage > 0 || careerHighestSector(state) >= 1
    case 'data':
      return isSystemUnlocked(state, 'research')
    case 'essence':
      return state.resources.essence > 0 || careerHighestSector(state) >= 5
    case 'aiPoints':
      return isSystemUnlocked(state, 'ai')
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
    'scrap',
    'alloys',
    'energy',
    'data',
    'essence',
    'salvage',
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

  if (
    ever >= 3 &&
    !state.meta.seenOnboarding.includes('base-unlock') &&
    state.base.workerDrones < 2
  ) {
    state.base.workerDrones = Math.max(state.base.workerDrones, 2)
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
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'guide-shipyard-tab',
    title: 'Shipyard',
    body: 'Tap Shipyard to review your frame and modules before Launch.',
    target: 'shipyard-tab',
    availableWhen: (s) =>
      s.combat.docked && !s.shipyard.frameLocked && !guideSeen(s, 'guide-shipyard-tab'),
    completeWhen: (_s, tab) => tab === 'shipyard',
  },
  {
    id: 'guide-frame-select',
    title: 'Your frame',
    body: 'Scout Frame is fine for now. Tap it to continue, then you will Launch from Combat.',
    target: 'frame-scout',
    tab: 'shipyard',
    availableWhen: (s) =>
      guideSeen(s, 'guide-shipyard-tab') &&
      !guideSeen(s, 'guide-frame-select') &&
      s.combat.docked &&
      !s.shipyard.frameLocked,
  },
  {
    id: 'guide-launch',
    title: 'Launch',
    body: 'Tap Launch. This locks your frame for the run and starts Advance combat.',
    target: 'launch-btn',
    tab: 'combat',
    availableWhen: (s) =>
      guideSeen(s, 'guide-frame-select') &&
      !guideSeen(s, 'guide-launch') &&
      s.combat.docked &&
      !s.shipyard.frameLocked,
    completeWhen: (s) => s.shipyard.frameLocked || !s.combat.docked,
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
    body: 'Tap + on Scrap Field to assign an idle worker. Scrap is your basic industry income.',
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
    id: 'guide-research-tab',
    title: 'Research unlocked',
    body: 'Tap Research. Data now shows in the header — spend it on projects that open new stations.',
    target: 'research-tab',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'research') && !guideSeen(s, 'guide-research-tab'),
    completeWhen: (_s, tab) => tab === 'research',
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
    body: 'Combat drops Salvage. Spend it in Shipyard to upgrade owned modules.',
    target: 'salvage-stat',
    tab: 'shipyard',
    availableWhen: (s) =>
      (s.resources.salvage > 0 || careerHighestSector(s) >= 1) &&
      !guideSeen(s, 'guide-salvage'),
  },
  {
    id: 'guide-part-drop',
    title: 'Blueprint fragments',
    body: 'Enemies rarely drop module parts. Collect casings, cores, and lenses — then assemble them in the Fab Bay.',
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
    title: 'AI Network unlocked',
    body: 'Tap AI. Achievements grant AI Points for automation, combat speed, and doctrines.',
    target: 'ai-tab',
    availableWhen: (s) => isSystemUnlocked(s, 'ai') && !guideSeen(s, 'guide-ai-tab'),
    completeWhen: (_s, tab) => tab === 'ai',
  },
  {
    id: 'guide-achievements',
    title: 'Achievements',
    body: 'Tap Achievements to review one-offs and repeatable grinds that fund the AI Network.',
    target: 'achievements-btn',
    tab: 'ai',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'ai') &&
      guideSeen(s, 'guide-ai-tab') &&
      !guideSeen(s, 'guide-achievements'),
  },
  {
    id: 'guide-prestige-tab',
    title: 'Prestige unlocked',
    body: 'Tap Prestige. Soft-reset from sector 8 for Prestige Matter. Challenges open after your first prestige.',
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
    title: 'Challenges unlocked',
    body: 'Act 1 complete — tap Challenges. Optional restricted runs grant Challenge Points. Prestige stays available; challenges are never required.',
    target: 'challenges-subtab',
    tab: 'prestige',
    availableWhen: (s) =>
      challengesContentUnlocked(s) &&
      !s.prestige.activeChallengeId &&
      !guideSeen(s, 'guide-challenges'),
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
    body: 'After Act 1, Ascend at sector 30+ to permanently boost future Prestige Matter gains and unlock deep shop ranks.',
    target: 'ascend-btn',
    tab: 'prestige',
    availableWhen: (s) => s.meta.act1Cleared && !guideSeen(s, 'guide-ascension'),
  },
]

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
