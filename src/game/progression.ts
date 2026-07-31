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
    case 'alloys':
    case 'energy':
    case 'salvage':
      return true
    case 'data':
      return isSystemUnlocked(state, 'research')
    case 'essence':
      return careerHighestSector(state) >= 5
    case 'aiPoints':
      return isSystemUnlocked(state, 'ai')
    case 'prestigeMatter':
    case 'challengePoints':
      return isSystemUnlocked(state, 'prestige')
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
    'aiPoints',
    'salvage',
  ]
  return order.filter((id) => isResourceVisible(state, id))
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
      s.combat.docked &&
      !s.shipyard.frameLocked &&
      !s.meta.seenOnboarding.includes('guide-shipyard-tab'),
    completeWhen: (_s, tab) => tab === 'shipyard',
  },
  {
    id: 'guide-frame-select',
    title: 'Your frame',
    body: 'Scout Frame is fine for now. Tap it to continue, then you will Launch from Combat.',
    target: 'frame-scout',
    tab: 'shipyard',
    availableWhen: (s) =>
      s.meta.seenOnboarding.includes('guide-shipyard-tab') &&
      !s.meta.seenOnboarding.includes('guide-frame-select') &&
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
      s.meta.seenOnboarding.includes('guide-frame-select') &&
      !s.meta.seenOnboarding.includes('guide-launch') &&
      s.combat.docked &&
      !s.shipyard.frameLocked,
    completeWhen: (s) => s.shipyard.frameLocked || !s.combat.docked,
  },
  {
    id: 'guide-base-tab',
    title: 'Base unlocked',
    body: 'Tap Base. Assign worker drones to stations to produce resources.',
    target: 'base-tab',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'base') && !s.meta.seenOnboarding.includes('guide-base-tab'),
    completeWhen: (_s, tab) => tab === 'base',
  },
  {
    id: 'guide-assign-scrap',
    title: 'Assign workers',
    body: 'Tap + on Scrap Field to assign an idle worker.',
    target: 'station-scrap-field-plus',
    tab: 'base',
    availableWhen: (s) =>
      s.meta.seenOnboarding.includes('guide-base-tab') &&
      !s.meta.seenOnboarding.includes('guide-assign-scrap') &&
      isSystemUnlocked(s, 'base') &&
      s.base.workerDrones > 0,
    completeWhen: (s) => (s.base.assignments['scrap-field'] ?? 0) > 0,
  },
  {
    id: 'guide-research-tab',
    title: 'Research unlocked',
    body: 'Tap Research. Spend Data to unlock stations and combat bonuses.',
    target: 'research-tab',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'research') &&
      !s.meta.seenOnboarding.includes('guide-research-tab'),
    completeWhen: (_s, tab) => tab === 'research',
  },
  {
    id: 'guide-prestige-tab',
    title: 'Prestige unlocked',
    body: 'Tap Prestige. Soft-reset becomes available from sector 8 for Prestige Matter and challenges.',
    target: 'prestige-tab',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'prestige') &&
      !s.meta.seenOnboarding.includes('guide-prestige-tab'),
    completeWhen: (_s, tab) => tab === 'prestige',
  },
  {
    id: 'guide-prestige-ready',
    title: 'Ready to Prestige',
    body: 'You reached the prestige threshold. Tap Prestige to soft-reset and earn Prestige Matter. Challenges open after your first prestige.',
    target: 'prestige-btn',
    tab: 'prestige',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'prestige') &&
      s.combat.sector >= PRESTIGE_MIN_SECTOR &&
      !s.prestige.activeChallengeId &&
      s.prestige.prestigeCount === 0 &&
      !s.meta.seenOnboarding.includes('guide-prestige-ready'),
    completeWhen: (s) => s.prestige.prestigeCount > 0,
  },
  {
    id: 'guide-ai-tab',
    title: 'AI Network unlocked',
    body: 'Tap AI. Achievements grant AI Points for automation and doctrines.',
    target: 'ai-tab',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'ai') && !s.meta.seenOnboarding.includes('guide-ai-tab'),
    completeWhen: (_s, tab) => tab === 'ai',
  },
  {
    id: 'guide-achievements',
    title: 'Achievements',
    body: 'Tap Achievements to review progress and AI Point rewards.',
    target: 'achievements-btn',
    tab: 'ai',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'ai') &&
      s.meta.seenOnboarding.includes('guide-ai-tab') &&
      !s.meta.seenOnboarding.includes('guide-achievements'),
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
