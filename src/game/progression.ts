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

export interface AchievementDef {
  id: string
  name: string
  description: string
  rewardAiPoints: number
  condition: AchievementCondition
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
    id: 'act1-clear',
    name: 'Exodus Gate',
    description: 'Clear sector 30 and finish Act 1.',
    rewardAiPoints: 3,
    condition: { type: 'act1-cleared' },
  },
]

export function careerHighestSector(state: GameState): number {
  return Math.max(state.meta.highestSectorEver, state.combat.highestSector)
}

export function isAchievementUnlocked(state: GameState, id: string): boolean {
  return state.meta.completedAchievements.includes(id)
}

export function achievementConditionMet(
  state: GameState,
  condition: AchievementCondition,
): boolean {
  switch (condition.type) {
    case 'sector-ever':
      return careerHighestSector(state) >= condition.sector
    case 'research-count':
      return state.research.unlocked.length >= condition.min
    case 'prestige-count':
      return state.prestige.prestigeCount >= condition.min
    case 'ai-purchase-count':
      return state.ai.purchased.length >= condition.min
    case 'act1-cleared':
      return state.meta.act1Cleared || careerHighestSector(state) >= ACT1_FINAL_SECTOR
  }
}

/** Grant newly completed achievements (mutates). Returns newly completed ids. */
export function tryCompleteAchievements(state: GameState): string[] {
  const newly: string[] = []
  for (const def of ACHIEVEMENTS) {
    if (state.meta.completedAchievements.includes(def.id)) continue
    if (!achievementConditionMet(state, def.condition)) continue
    state.meta.completedAchievements = [...state.meta.completedAchievements, def.id]
    state.resources.aiPoints += def.rewardAiPoints
    newly.push(def.id)
    if (!state.meta.aiUnlocked) {
      state.meta.aiUnlocked = true
    }
    state.combat.log = [
      `Achievement: ${def.name} (+${def.rewardAiPoints} AI).`,
      ...state.combat.log,
    ].slice(0, 40)
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
      `Act 1 complete — sector ${ACT1_FINAL_SECTOR} cleared. Prestige and challenges are the long game.`,
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
