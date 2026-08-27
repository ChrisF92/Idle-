/**
 * Event-driven onboarding. Lessons react to gameplay state, not page history.
 * Persist complete/skipped only — never temporary visual/queue state.
 */

import { ACT1_CADENCE } from './cadence'
import { practicedCoreWork } from './corePractice'
import { targetCapableLoadoutCores } from './coreTargeting'
import { firstRebuildAvailable, hasHullLostOnce, isSystemUnlocked } from './progression'
import { firstAffordableProcessNode } from './process'
import { anyMatterPurchaseOwned, MATTER_SHOP } from './matter'
import { canBuyMatterShop } from './catalog'
import { foundryMaterialCount } from './foundry'
import { ownedWorkers } from './workers'
import type { GameState, TabId } from './types'
import { addRelicInstance, createEmptyRelicState } from './relics'
import { workshopCost, workshopLevel } from './workshop'

export const ONBOARDING_ENABLED = true

export const ONBOARDING_LESSON_IDS = [
  'opening.salvage',
  'first-defeat.workshop',
  'foundry.processing',
  'foundry.blueprint',
  'workers.assignment',
  'directives.choice',
  'rebuild.preview',
  'rebuild.matter',
  'extraction.first-use',
  'relic.install',
  'furnace.channel',
  'research.project',
  'process.capability',
  'challenges.start',
  'reinforce',
  'combat-overlay.ranges',
] as const

export type OnboardingLessonId = (typeof ONBOARDING_LESSON_IDS)[number]

export type OnboardingStatus = 'unseen' | 'active' | 'complete' | 'skipped'

export type PersistedOnboardingStatus = 'complete' | 'skipped'

export type OnboardingRegistry = Partial<Record<OnboardingLessonId, PersistedOnboardingStatus>>

export const SEMANTIC_TARGET_IDS = [
  'onboarding.salvage.weapon-power',
  'onboarding.workshop.weapon-power',
  'onboarding.foundry.processor',
  'onboarding.foundry.blueprint',
  'onboarding.workers.salvage',
  'onboarding.rebuild.preview',
  'onboarding.rebuild.matter',
  'onboarding.extraction.first-use',
  'onboarding.research.available-node',
  'onboarding.process.first-capability',
  'onboarding.directives.choice',
  'onboarding.relic.install',
  'onboarding.furnace.channel',
  'onboarding.challenges.list',
  'onboarding.reinforce.cta',
  'onboarding.combat-overlay.core-selector',
] as const

export type SemanticTargetId = (typeof SEMANTIC_TARGET_IDS)[number]

export type OnboardingPane =
  | 'home'
  | 'loadout'
  | 'workshop'
  | 'rebuild'
  | 'processing'
  | 'fabrication'
  | 'mastery'
  | 'blueprints'
  | 'hub'

export interface OnboardingNav {
  tab: TabId
  pane?: OnboardingPane
  systemsView?: 'hub' | 'foundry'
  shop?: 'attack' | 'defense'
}

export type LessonActivation = 'auto' | 'visit'

export interface OnboardingLesson {
  id: OnboardingLessonId
  title: string
  body: string | string[] | ((state: GameState) => string[])
  actionLabel?: string
  payoff?: string | string[] | ((state: GameState) => string[])
  target: SemanticTargetId
  nav: OnboardingNav
  pause: boolean
  skippable: boolean
  required: boolean
  activation: LessonActivation
  availableWhen: (state: GameState) => boolean
  completeWhen: (state: GameState) => boolean
}

export interface PresentationUi {
  tab: TabId
  reportOpen?: boolean
  hangarOpen?: boolean
  blockingModal?: boolean
  combatOverlayOpen?: boolean
  combatOverlaySelectedCoreId?: string | null
}

export interface ResolvedLesson {
  id: OnboardingLessonId
  title: string
  body: string[]
  actionLabel?: string
  target: SemanticTargetId
  nav: OnboardingNav
  pause: boolean
  skippable: boolean
  required: boolean
  phase: 'action' | 'payoff'
  payoff?: string[]
  completeOnTap: boolean
}

const LEGACY_LESSON_MAP: Record<string, OnboardingLessonId> = {
  'guide-salvage-first': 'opening.salvage',
  'guide-sortie-field': 'opening.salvage',
  'guide-sortie-guns': 'opening.salvage',
  'guide-sortie-hull': 'opening.salvage',
  'guide-sortie-fire': 'opening.salvage',
  'guide-sortie-salvage': 'opening.salvage',
  'guide-salvage-lesson': 'opening.salvage',
  'guide-cores-sheet': 'opening.salvage',
  'guide-upgrade-pulse': 'opening.salvage',
  'guide-upgrade-plate': 'opening.salvage',
  'guide-core-run': 'opening.salvage',
  'guide-workshop': 'first-defeat.workshop',
  'guide-cores-inspect': 'first-defeat.workshop',
  'guide-cores-persist': 'first-defeat.workshop',
  'guide-core-mastery': 'first-defeat.workshop',
  'guide-foundry-recipe': 'foundry.processing',
  'guide-foundry': 'foundry.processing',
  'guide-foundry-smelt': 'foundry.processing',
  'guide-foundry-what': 'foundry.processing',
  'guide-foundry-mastery': 'foundry.processing',
  'guide-network-strike': 'workers.assignment',
  'guide-drone-cap': 'workers.assignment',
  'guide-network-make': 'workers.assignment',
  'guide-network-assign': 'workers.assignment',
  'guide-network-ward': 'workers.assignment',
  'guide-directive': 'directives.choice',
  'guide-relic-install': 'relic.install',
  'guide-furnace-light': 'furnace.channel',
  'guide-furnace': 'furnace.channel',
  'guide-furnace-v2-ash': 'furnace.channel',
  'guide-furnace-v2-activate': 'furnace.channel',
  'guide-research-focus': 'research.project',
  'guide-research-tab': 'research.project',
  'guide-research-xp': 'research.project',
  'guide-research-focus-how': 'research.project',
  'guide-process-first': 'process.capability',
  'guide-challenge': 'challenges.start',
  'guide-rebuild': 'rebuild.preview',
  'guide-rebuild-matter': 'rebuild.preview',
  'guide-reinforce': 'reinforce',
}

const STARTER_LESSON_IDS: OnboardingLessonId[] = ['opening.salvage', 'first-defeat.workshop']

const LEGACY_TOUR_MARKERS = [
  'guide-drone-cap',
  'guide-network-make',
  'guide-foundry-what',
  'guide-furnace-v2-ash',
  'guide-research-xp',
  'guide-process-v2-what',
  'guide-protocol-restrict',
  'guide-reliquary-slots',
  'guide-prestige-hangar',
] as const

function emptyRegistry(): OnboardingRegistry {
  return {}
}

export function ensureOnboardingRegistry(state: GameState): OnboardingRegistry {
  if (!state.meta.onboarding) state.meta.onboarding = emptyRegistry()
  return state.meta.onboarding
}

export function lessonStatus(state: GameState, id: OnboardingLessonId): OnboardingStatus {
  const persisted = state.meta.onboarding?.[id]
  if (persisted === 'complete' || persisted === 'skipped') return persisted
  if ((state.meta.seenOnboarding ?? []).includes(id)) return 'complete'
  return 'unseen'
}

export function lessonFinished(state: GameState, id: OnboardingLessonId): boolean {
  const status = lessonStatus(state, id)
  return status === 'complete' || status === 'skipped'
}

function setLessonStatus(state: GameState, id: OnboardingLessonId, status: PersistedOnboardingStatus): boolean {
  const registry = ensureOnboardingRegistry(state)
  if (registry[id] === status) return false
  registry[id] = status
  syncSeenOnboardingShadow(state)
  return true
}

function syncSeenOnboardingShadow(state: GameState): void {
  const registry = ensureOnboardingRegistry(state)
  const fromRegistry = ONBOARDING_LESSON_IDS.filter((id) => registry[id] === 'complete' || registry[id] === 'skipped')
  const extras = (state.meta.seenOnboarding ?? []).filter((id) => !ONBOARDING_LESSON_IDS.includes(id as OnboardingLessonId))
  state.meta.seenOnboarding = [...new Set([...extras, ...fromRegistry])]
}

export function anyRunUpgradeBought(state: GameState): boolean {
  return Object.values(state.combat.runUpgrades ?? {}).some((n) => (n ?? 0) > 0)
}

export function canAffordFirstSalvageBuy(state: GameState): boolean {
  return (state.resources.salvage ?? 0) >= 8
}

function anyRelicOwned(state: GameState): boolean {
  return (state.relics?.instances.length ?? 0) > 0
}

function anyRelicFitted(state: GameState): boolean {
  for (const slots of Object.values(state.relics?.coreFits ?? {})) {
    if (Array.isArray(slots) && slots.some(Boolean)) return true
  }
  return false
}

export function foundryFirstJobReady(state: GameState): boolean {
  if (!isSystemUnlocked(state, 'foundry')) return false
  if ((state.foundry?.slots ?? []).some((slot) => slot.recipeId)) return false
  const stock = foundryMaterialCount(state, 'recovered-stock')
  if (stock >= 1) return false
  return (state.resources.scrap ?? 0) >= 8
}

function foundryFirstJobDone(state: GameState): boolean {
  if ((state.foundry?.materials?.['recovered-stock'] ?? 0) >= 1) return true
  return (state.foundry?.slots ?? []).some((slot) => slot.recipeId === 'recovered-stock')
}

function recoveredScrap(state: GameState): number {
  const fromReport = state.combat.lastSortie?.scrapEarned
  if (typeof fromReport === 'number' && fromReport > 0) return Math.floor(fromReport)
  return Math.floor(state.resources.scrap ?? 0)
}

function linesOf(value: string | string[] | ((state: GameState) => string[]), state: GameState): string[] {
  if (typeof value === 'function') return value(state)
  return Array.isArray(value) ? value : [value]
}

function tabMatchesVisit(nav: OnboardingNav, tab: TabId): boolean {
  if (nav.tab === tab) return true
  if (nav.tab === 'foundry' && tab === 'foundry') return true
  if (nav.tab === 'network' && tab === 'network') return true
  return false
}

export const ONBOARDING_LESSONS: OnboardingLesson[] = [
  {
    id: 'opening.salvage',
    title: 'Salvage',
    body: [
      'Enemies drop Salvage during a Sortie.',
      'Spend it now — any unspent Salvage is lost when the Sortie ends.',
    ],
    actionLabel: 'Buy Weapon Power',
    target: 'onboarding.salvage.weapon-power',
    nav: { tab: 'combat', shop: 'attack' },
    pause: true,
    skippable: true,
    required: true,
    activation: 'auto',
    availableWhen: (s) =>
      !s.combat.docked &&
      (s.combat.defeatLeft ?? 0) <= 0 &&
      canAffordFirstSalvageBuy(s) &&
      !anyRunUpgradeBought(s),
    completeWhen: anyRunUpgradeBought,
  },
  {
    id: 'first-defeat.workshop',
    title: 'Scrap survives Sorties',
    body: (s) => [
      `You recovered ${recoveredScrap(s)} Scrap.`,
      'Workshop levels use Scrap. They survive Sortie end and reset on Rebuild.',
      'Permanent NEXT UPGRADE unlocks also use Scrap, survive Rebuild, and grant zero levels.',
    ],
    actionLabel: 'Buy Weapon Power',
    payoff: (s) => {
      const lv = workshopLevel(s, 'weapon-power')
      const prev = Math.max(0, lv - 1)
      return [`START Lv${prev} → Lv${lv}`, 'Next Sortie starts stronger.']
    },
    target: 'onboarding.workshop.weapon-power',
    nav: { tab: 'dock', pane: 'workshop' },
    pause: false,
    skippable: true,
    required: true,
    activation: 'auto',
    availableWhen: (s) =>
      hasHullLostOnce(s) &&
      s.combat.docked &&
      (s.resources.scrap ?? 0) >= workshopCost(0) &&
      workshopLevel(s, 'weapon-power') < 1,
    completeWhen: (s) => workshopLevel(s, 'weapon-power') >= 1,
  },
  {
    id: 'foundry.processing',
    title: 'Processing',
    body: [
      'Processing consumes inputs and produces a persistent material.',
      'Start one Recovered Stock cycle. The output stays after Rebuild.',
    ],
    actionLabel: 'Start Recovered Stock',
    payoff: 'You now have Recovered Stock. Processing cycles also raise that material\'s Mastery.',
    target: 'onboarding.foundry.processor',
    nav: { tab: 'foundry', pane: 'processing', systemsView: 'foundry' },
    pause: false,
    skippable: true,
    required: false,
    activation: 'visit',
    availableWhen: foundryFirstJobReady,
    completeWhen: foundryFirstJobDone,
  },
  {
    id: 'foundry.blueprint',
    title: 'Blueprint is a design',
    body: [
      'A discovered Blueprint is a design, not a physical Core.',
      'Fabrication creates the actual item in inventory.',
    ],
    actionLabel: 'Open Blueprints',
    payoff: 'You can see design-known versus owned. Fabrication is a separate step.',
    target: 'onboarding.foundry.blueprint',
    nav: { tab: 'foundry', pane: 'blueprints', systemsView: 'foundry' },
    pause: false,
    skippable: true,
    required: false,
    activation: 'visit',
    availableWhen: (s) => isSystemUnlocked(s, 'foundry') && foundryFirstJobDone(s),
    completeWhen: (s) => Boolean(s.foundry?.trackedPrintId) || (s.foundry?.discovered?.length ?? 0) > 2,
  },
  {
    id: 'workers.assignment',
    title: 'Assign a Worker',
    body: [
      'Workers are permanent. Capacity is not ownership.',
      'Assign 1 owned Worker to Salvage ops. Buying Worker Racks only raises capacity.',
    ],
    actionLabel: 'Assign to Salvage',
    payoff: 'That Worker is now producing between Sorties.',
    target: 'onboarding.workers.salvage',
    nav: { tab: 'network', systemsView: 'hub' },
    pause: false,
    skippable: true,
    required: false,
    activation: 'visit',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'foundry') && ownedWorkers(s) >= 1 && (s.base.assignments['scrap-field'] ?? 0) < 1,
    completeWhen: (s) => (s.base.assignments['scrap-field'] ?? 0) >= 1,
  },
  {
    id: 'directives.choice',
    title: 'Directive',
    body: [
      'One benefit. One trade-off. Lasts this Sortie only.',
      'Pick one of the three cards.',
    ],
    actionLabel: 'Choose a Directive',
    target: 'onboarding.directives.choice',
    nav: { tab: 'combat' },
    pause: true,
    skippable: false,
    required: true,
    activation: 'auto',
    availableWhen: (s) => !s.combat.docked && (s.combat.directiveOffer?.length ?? 0) >= 3,
    completeWhen: (s) => (s.combat.directives?.length ?? 0) > 0,
  },
  {
    id: 'rebuild.preview',
    title: 'Rebuild',
    body: [
      'Projected Matter comes from this cycle’s Best Wave and Scrap generated.',
      'Rebuild resets Scrap, Workshop levels, Core Levels, and Ash. Matter, Cores, Foundry, and unlocks stay.',
    ],
    actionLabel: 'Confirm Rebuild',
    payoff: 'Matter awarded. Next: buy a permanent Matter rank.',
    target: 'onboarding.rebuild.preview',
    nav: { tab: 'dock', pane: 'rebuild' },
    pause: false,
    skippable: true,
    required: false,
    activation: 'visit',
    availableWhen: (s) => s.combat.docked && firstRebuildAvailable(s),
    completeWhen: (s) => (s.prestige.prestigeCount ?? 0) > 0,
  },
  {
    id: 'rebuild.matter',
    title: 'Matter shop',
    body: [
      'Unspent Matter has no power. Buy a permanent rank.',
      'Any affordable node completes this step.',
    ],
    actionLabel: 'Buy a Matter rank',
    payoff: 'Permanent effect unlocked. Launch remains manual.',
    target: 'onboarding.rebuild.matter',
    nav: { tab: 'dock', pane: 'rebuild' },
    pause: false,
    skippable: true,
    required: false,
    activation: 'auto',
    availableWhen: (s) =>
      s.combat.docked &&
      (s.prestige.prestigeCount ?? 0) > 0 &&
      !anyMatterPurchaseOwned(s) &&
      MATTER_SHOP.some((item) => canBuyMatterShop(s, item.id).ok),
    completeWhen: (s) => anyMatterPurchaseOwned(s),
  },
  {
    id: 'extraction.first-use',
    title: 'Extraction',
    body: [
      'Extract is a safe Sortie end. You keep persistent rewards.',
      'Bonus is Scrap only. This is not a Rebuild. No Matter is awarded.',
    ],
    actionLabel: 'Review Extract',
    target: 'onboarding.extraction.first-use',
    nav: { tab: 'combat' },
    pause: true,
    skippable: true,
    required: false,
    activation: 'visit',
    availableWhen: (s) =>
      !s.combat.docked &&
      Boolean(s.combat.inFight) &&
      Boolean(s.combat.sortiePaused) &&
      (s.meta.bestWave ?? 0) >= ACT1_CADENCE.rebuild &&
      !s.meta.extractionExplained,
    completeWhen: (s) => Boolean(s.meta.extractionExplained),
  },
  {
    id: 'relic.install',
    title: 'Relic',
    body: [
      'Relics are physical items. Each one fits one socket on one physical Core.',
      'Socket class must match, or the socket must be Universal. A Core may fit only one Behavioural Relic. Fitting is free while Docked.',
    ],
    actionLabel: 'Install Relic',
    target: 'onboarding.relic.install',
    nav: { tab: 'dock', pane: 'loadout' },
    pause: false,
    skippable: true,
    required: false,
    activation: 'visit',
    availableWhen: (s) =>
      s.combat.docked && isSystemUnlocked(s, 'reliquary') && anyRelicOwned(s) && !anyRelicFitted(s),
    completeWhen: anyRelicFitted,
  },
  {
    id: 'furnace.channel',
    title: 'Ash and Heat',
    body: [
      'Ash persists across Sorties this cycle. Convert it to Heat, then light Weapons.',
      'Heat is this Sortie only and dumps when you Dock.',
    ],
    actionLabel: 'Light Weapons',
    target: 'onboarding.furnace.channel',
    nav: { tab: 'furnace', systemsView: 'hub' },
    pause: false,
    skippable: true,
    required: false,
    activation: 'visit',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'furnace') &&
      ((s.resources.heat ?? 0) >= 8 || (s.resources.choirAsh ?? 0) >= 80) &&
      (s.furnace?.wanted?.weapons ?? 0) < 1,
    completeWhen: (s) => (s.furnace?.wanted?.weapons ?? 0) >= 1,
  },
  {
    id: 'research.project',
    title: 'Research',
    body: 'Start this project. It has a duration, keeps running offline, and permanently changes the Hive.',
    actionLabel: 'Start project',
    target: 'onboarding.research.available-node',
    nav: { tab: 'research', systemsView: 'hub' },
    pause: false,
    skippable: true,
    required: false,
    activation: 'visit',
    availableWhen: (s) => isSystemUnlocked(s, 'research') && !s.hiveResearch?.active,
    completeWhen: (s) => Boolean(s.hiveResearch?.active) || Object.values(s.hiveResearch?.completed ?? {}).some((n) => (n ?? 0) > 0),
  },
  {
    id: 'process.capability',
    title: 'Process',
    body: 'You have already done this work by hand. Buy one quality-of-life node.',
    actionLabel: 'Buy a capability',
    target: 'onboarding.process.first-capability',
    nav: { tab: 'process', systemsView: 'hub' },
    pause: false,
    skippable: true,
    required: false,
    activation: 'visit',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'process') &&
      (s.process?.purchased?.length ?? 0) < 1 &&
      Boolean(firstAffordableProcessNode(s)),
    completeWhen: (s) => (s.process?.purchased?.length ?? 0) >= 1,
  },
  {
    id: 'challenges.start',
    title: 'Challenge',
    body: 'Restriction, goal, reward, disabled systems, and current best are listed. Confirm before launch.',
    target: 'onboarding.challenges.list',
    nav: { tab: 'protocols' },
    pause: false,
    skippable: true,
    required: false,
    activation: 'visit',
    availableWhen: (s) => isSystemUnlocked(s, 'protocols') && !s.protocols?.activeId,
    completeWhen: (s) => Boolean(s.protocols?.activeId),
  },
  {
    id: 'reinforce',
    title: 'Reinforce',
    body: 'Rebuild has reached the limit of this loop. Reinforce changes the starting architecture of the Hive.',
    target: 'onboarding.reinforce.cta',
    nav: { tab: 'reinforce' },
    pause: false,
    skippable: true,
    required: false,
    activation: 'visit',
    availableWhen: (s) => isSystemUnlocked(s, 'reinforce') && (s.meta.ascensionCount ?? 0) < 1,
    completeWhen: (s) => (s.meta.ascensionCount ?? 0) > 0,
  },
  {
    id: 'combat-overlay.ranges',
    title: 'Combat Overlay',
    body: [
      'Fire Range is how far this Core can shoot.',
      'Acquisition Range is how far it can lock and pre-slew.',
      'Firing Arc is the legal cone around current heading.',
      'Slew is how quickly the Core turns onto a target.',
      'Select a physical Core from the stationary list.',
    ],
    actionLabel: 'Select a Core',
    target: 'onboarding.combat-overlay.core-selector',
    nav: { tab: 'combat' },
    pause: true,
    skippable: false,
    required: true,
    activation: 'auto',
    availableWhen: (s) =>
      !s.combat.docked && Boolean(s.combat.inFight) && targetCapableLoadoutCores(s).length > 0,
    completeWhen: () => false,
  },
]

export function activeGuideStep(
  state: GameState,
  tabOrUi: TabId | PresentationUi,
  _held?: string | null,
  extra?: { hangarOpen?: boolean },
): ResolvedLesson | null {
  const tab = typeof tabOrUi === 'string' ? tabOrUi : tabOrUi.tab
  const reportOpen = typeof tabOrUi === 'object' ? tabOrUi.reportOpen : undefined
  const hangarOpen = typeof tabOrUi === 'object' ? tabOrUi.hangarOpen : extra?.hangarOpen
  const blockingModal = typeof tabOrUi === 'object' ? tabOrUi.blockingModal : undefined
  return activeOnboardingLesson(state, {
    tab,
    reportOpen,
    hangarOpen,
    blockingModal,
    combatOverlayOpen: typeof tabOrUi === 'object' ? tabOrUi.combatOverlayOpen : undefined,
    combatOverlaySelectedCoreId: typeof tabOrUi === 'object' ? tabOrUi.combatOverlaySelectedCoreId : undefined,
  })
}

function lessonById(id: string): OnboardingLesson | undefined {
  const mapped = LEGACY_LESSON_MAP[id] ?? id
  return ONBOARDING_LESSONS.find((lesson) => lesson.id === mapped)
}

export function guideBodyLines(step: { body: OnboardingLesson['body'] }, state?: GameState): string[] {
  if (typeof step.body === 'function') return state ? step.body(state) : []
  return Array.isArray(step.body) ? step.body : [step.body]
}

function resolveLesson(lesson: OnboardingLesson, state: GameState, phase: 'action' | 'payoff'): ResolvedLesson {
  return {
    id: lesson.id,
    title: lesson.title,
    body: phase === 'payoff' && lesson.payoff ? linesOf(lesson.payoff, state) : linesOf(lesson.body, state),
    actionLabel: phase === 'payoff' ? undefined : lesson.actionLabel,
    target: lesson.target,
    nav: lesson.nav,
    pause: phase === 'payoff' ? false : lesson.pause,
    skippable: lesson.skippable,
    required: lesson.required,
    phase,
    payoff: lesson.payoff ? linesOf(lesson.payoff, state) : undefined,
    completeOnTap: false,
  }
}

function overlayRangesActionComplete(ui: PresentationUi): boolean {
  return Boolean(ui.combatOverlayOpen && ui.combatOverlaySelectedCoreId)
}

function lessonEligible(lesson: OnboardingLesson, state: GameState, ui: PresentationUi): boolean {
  if (!ONBOARDING_ENABLED) return false
  if (lessonFinished(state, lesson.id)) return false
  if (ui.reportOpen && lesson.id === 'first-defeat.workshop') return false
  if (ui.hangarOpen && lesson.id === 'rebuild.preview') return false
  if (lesson.id === 'combat-overlay.ranges' && !ui.combatOverlayOpen) return false
  if (lesson.id === 'combat-overlay.ranges' && overlayRangesActionComplete(ui)) return false
  if (!lesson.availableWhen(state) && !lesson.completeWhen(state)) return false
  if (lesson.activation === 'visit' && !tabMatchesVisit(lesson.nav, ui.tab)) {
    if (lesson.completeWhen(state) && lesson.payoff) return tabMatchesVisit(lesson.nav, ui.tab)
    if (lesson.completeWhen(state) && !lesson.payoff) return false
    return false
  }
  if (!lesson.availableWhen(state) && lesson.completeWhen(state) && !lesson.payoff) return false
  return lesson.availableWhen(state) || Boolean(lesson.completeWhen(state) && lesson.payoff)
}

export function activeOnboardingLesson(state: GameState, ui: PresentationUi): ResolvedLesson | null {
  if (!ONBOARDING_ENABLED) return null
  for (const lesson of ONBOARDING_LESSONS) {
    if (!lessonEligible(lesson, state, ui)) continue
    const done = lesson.completeWhen(state)
    if (done && lesson.payoff) return resolveLesson(lesson, state, 'payoff')
    if (done) continue
    return resolveLesson(lesson, state, 'action')
  }
  return null
}

export function completeLesson(state: GameState, id: string): GameState {
  const lesson = lessonById(id)
  if (!lesson) {
    if (state.meta.seenOnboarding.includes(id)) return state
    const next = structuredClone(state)
    next.meta.seenOnboarding = [...next.meta.seenOnboarding, id]
    return next
  }
  if (lessonFinished(state, lesson.id)) return state
  const next = structuredClone(state)
  setLessonStatus(next, lesson.id, 'complete')
  return next
}

export function skipLesson(state: GameState, id: string): GameState {
  const lesson = lessonById(id)
  if (!lesson) return completeLesson(state, id)
  if (!lesson.skippable) return state
  if (lessonFinished(state, lesson.id)) return state
  const next = structuredClone(state)
  setLessonStatus(next, lesson.id, 'skipped')
  return next
}

/** Auto-complete lessons whose action already happened and that have no payoff overlay. */
export function syncCompletedLessons(state: GameState, _tab?: TabId): GameState {
  if (!ONBOARDING_ENABLED) return state
  let changed = false
  const next = structuredClone(state)
  for (const lesson of ONBOARDING_LESSONS) {
    if (lessonFinished(next, lesson.id)) continue
    if (!lesson.completeWhen(next)) continue
    if (lesson.payoff) continue
    setLessonStatus(next, lesson.id, 'complete')
    changed = true
  }
  return changed ? next : state
}

export function skipAllLessons(state: GameState): GameState {
  const next = structuredClone(state)
  for (const id of ONBOARDING_LESSON_IDS) setLessonStatus(next, id, 'skipped')
  return next
}

export function resetOnboardingRegistry(state: GameState): GameState {
  const next = structuredClone(state)
  next.meta.onboarding = emptyRegistry()
  next.meta.seenOnboarding = []
  next.meta.acknowledgedEvents = []
  return next
}

export function retirePostResetOnboarding(state: GameState): void {
  const prestiged = state.prestige.prestigeCount > 0
  const ascended = (state.meta.ascensionCount ?? 0) > 0
  if (!prestiged && !ascended) return
  ensureOnboardingRegistry(state)
  for (const id of STARTER_LESSON_IDS) {
    if (!lessonFinished(state, id)) setLessonStatus(state, id, 'complete')
  }
  if (ascended) {
    for (const id of ONBOARDING_LESSON_IDS) {
      if (!lessonFinished(state, id)) setLessonStatus(state, id, 'complete')
    }
  }
  if ((state.meta.starterCombatLesson ?? 0) < 2) state.meta.starterCombatLesson = 2
  if (!state.meta.hullLostOnce) state.meta.hullLostOnce = true
}

export function isEstablishedCareer(state: GameState): boolean {
  if ((state.prestige.prestigeCount ?? 0) > 0) return true
  if ((state.meta.ascensionCount ?? 0) > 0) return true
  if ((state.meta.bestWave ?? 0) >= 50) return true
  const seen = state.meta.seenOnboarding ?? []
  if (seen.length >= 12) return true
  if (seen.some((id) => (LEGACY_TOUR_MARKERS as readonly string[]).includes(id))) return true
  const registry = state.meta.onboarding ?? {}
  const finished = ONBOARDING_LESSON_IDS.filter((id) => registry[id] === 'complete' || registry[id] === 'skipped')
  if (finished.length >= 8) return true
  return practicedCoreWork(state) >= 4
}

export function migrateOnboardingRegistry(state: GameState): void {
  const registry = ensureOnboardingRegistry(state)
  const seen = new Set(state.meta.seenOnboarding ?? [])
  for (const [legacy, current] of Object.entries(LEGACY_LESSON_MAP)) {
    if (seen.has(legacy) && !registry[current]) registry[current] = 'complete'
  }
  for (const id of ONBOARDING_LESSON_IDS) {
    if (seen.has(id) && !registry[id]) registry[id] = 'complete'
  }
  // Launch-first tours are retired. Completing them must not skip Salvage.
  if (seen.has('guide-launch') || seen.has('guide-shipyard-tab') || seen.has('guide-frame-select')) {
    // no-op: those ids do not map to a live lesson
  }
  if (seen.has('guide-second-sortie') || seen.has('guide-relaunch') || seen.has('guide-relaunch-upgraded')) {
    if (!registry['first-defeat.workshop']) registry['first-defeat.workshop'] = 'complete'
  }
  if (isEstablishedCareer(state)) {
    for (const id of ONBOARDING_LESSON_IDS) {
      if (!registry[id]) registry[id] = 'complete'
    }
  }
  syncSeenOnboardingShadow(state)
}

export function lessonPausesSimulation(lesson: ResolvedLesson | null | undefined): boolean {
  return Boolean(lesson?.pause && lesson.phase === 'action')
}

export function targetSelector(id: SemanticTargetId): string {
  return `[data-onboarding="${id}"]`
}

export function targetElement(id: SemanticTargetId): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(targetSelector(id))
  return el instanceof HTMLElement ? el : null
}

export function targetIsVisible(el: HTMLElement | null): boolean {
  if (!el) return false
  const rect = el.getBoundingClientRect()
  if (rect.width < 2 || rect.height < 2) return false
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
  return true
}

/** Dev/test helper: put the career at the door for a specific lesson. */
export function prepOnboardingDoor(state: GameState, id: OnboardingLessonId): GameState {
  const next = structuredClone(state)
  next.meta.onboarding = emptyRegistry()
  next.meta.seenOnboarding = []
  next.meta.acknowledgedEvents = []
  next.meta.hullLostOnce = true
  next.meta.starterCombatLesson = 2
  next.combat.docked = true
  next.combat.inFight = false
  next.combat.defeatLeft = 0

  const waveFor: Partial<Record<OnboardingLessonId, number>> = {
    'foundry.processing': ACT1_CADENCE.foundry,
    'foundry.blueprint': ACT1_CADENCE.foundry,
    'workers.assignment': ACT1_CADENCE.workers,
    'directives.choice': ACT1_CADENCE.directives,
    'rebuild.preview': ACT1_CADENCE.rebuild,
    'rebuild.matter': ACT1_CADENCE.rebuild,
    'extraction.first-use': ACT1_CADENCE.rebuild,
    'relic.install': ACT1_CADENCE.reliquary,
    'furnace.channel': ACT1_CADENCE.furnace,
    'research.project': ACT1_CADENCE.research,
    'process.capability': ACT1_CADENCE.process,
    'challenges.start': ACT1_CADENCE.protocols,
    reinforce: ACT1_CADENCE.reinforce,
  }

  const wave = waveFor[id]
  if (wave) {
    next.meta.bestWave = Math.max(next.meta.bestWave ?? 0, wave)
    next.combat.bestWave = Math.max(next.combat.bestWave ?? 0, wave)
  }

  for (const lesson of ONBOARDING_LESSONS) {
    if (lesson.id === id) break
    setLessonStatus(next, lesson.id, 'complete')
  }

  switch (id) {
    case 'opening.salvage':
      next.meta.hullLostOnce = false
      next.combat.docked = false
      next.combat.inFight = true
      next.combat.wave = 1
      next.resources.salvage = 8
      next.combat.runUpgrades = {}
      break
    case 'first-defeat.workshop':
      next.combat.docked = true
      next.resources.scrap = Math.max(next.resources.scrap, workshopCost(0))
      next.workshop.levels = { ...(next.workshop.levels ?? {}), 'weapon-power': 0 }
      next.combat.lastSortie = {
        ...next.combat.lastSortie,
        outcome: 'defeat',
        scrapEarned: next.resources.scrap,
        wave: 3,
      }
      break
    case 'foundry.processing':
      next.resources.scrap = Math.max(next.resources.scrap, 12)
      next.foundry.slots = next.foundry.slots.map((slot) => ({ ...slot, recipeId: null, progress: 0, paid: false }))
      next.foundry.materials = { ...next.foundry.materials, 'recovered-stock': 0 }
      break
    case 'foundry.blueprint':
      next.foundry.materials = { ...next.foundry.materials, 'recovered-stock': 1 }
      next.foundry.discovered = [...new Set([...(next.foundry.discovered ?? []), 'flak-array'])]
      break
    case 'workers.assignment':
      next.base.assignments = { ...next.base.assignments, 'scrap-field': 0 }
      next.base.workerDrones = Math.max(next.base.workerDrones, 4)
      break
    case 'directives.choice':
      next.combat.docked = false
      next.combat.inFight = true
      next.combat.directiveOffer = ['overcharge', 'scavenger', 'reactive']
      next.combat.directives = []
      break
    case 'rebuild.preview':
      next.prestige.cycle = {
        ...(next.prestige.cycle ?? { bestWave: 0, normalSortiesCompleted: 0, scrapGenerated: 0 }),
        normalSortiesCompleted: Math.max(next.prestige.cycle?.normalSortiesCompleted ?? 0, 3),
        bestWave: Math.max(next.prestige.cycle?.bestWave ?? 0, ACT1_CADENCE.rebuild),
      }
      next.prestige.prestigeCount = 0
      next.combat.docked = true
      break
    case 'rebuild.matter':
      next.prestige.prestigeCount = Math.max(1, next.prestige.prestigeCount)
      next.resources.prestigeMatter = Math.max(next.resources.prestigeMatter, 8)
      next.prestige.matterShop = {}
      next.combat.docked = true
      break
    case 'extraction.first-use':
      next.combat.docked = false
      next.combat.inFight = true
      next.combat.sortiePaused = true
      next.meta.extractionExplained = false
      next.meta.bestWave = Math.max(next.meta.bestWave ?? 0, ACT1_CADENCE.rebuild)
      break
    case 'relic.install':
      next.relics = createEmptyRelicState()
      addRelicInstance(next, 'power-coupler', 1)
      break
    case 'furnace.channel':
      next.resources.choirAsh = Math.max(next.resources.choirAsh, 80)
      next.resources.heat = Math.max(next.resources.heat, 8)
      next.furnace.wanted = { ...(next.furnace.wanted ?? {}), weapons: 0 }
      break
    case 'research.project':
      if (next.hiveResearch) next.hiveResearch.active = false
      break
    case 'process.capability':
      next.resources.aiPoints = Math.max(next.resources.aiPoints, 8)
      next.process.purchased = []
      next.prestige.prestigeCount = Math.max(next.prestige.prestigeCount, 2)
      next.hiveResearch.completed = {
        ...next.hiveResearch.completed,
        energy: Math.max(next.hiveResearch.completed?.energy ?? 0, 1),
      }
      break
    case 'challenges.start':
      if (next.protocols) next.protocols.activeId = null
      next.prestige.prestigeCount = Math.max(next.prestige.prestigeCount, 2)
      next.hiveResearch.completed = {
        ...next.hiveResearch.completed,
        energy: Math.max(next.hiveResearch.completed?.energy ?? 0, 1),
      }
      break
    case 'reinforce':
      next.meta.act1Cleared = true
      break
    case 'combat-overlay.ranges':
      next.combat.docked = false
      next.combat.inFight = true
      next.combat.sortiePaused = true
      break
    default:
      break
  }
  return next
}

export const STARTER_GUIDE_IDS = STARTER_LESSON_IDS
export const NETWORK_GUIDE_IDS = ['workers.assignment'] as const
export const FOUNDRY_V2_GUIDE_IDS = ['foundry.processing', 'foundry.blueprint'] as const
export const RESEARCH_V2_GUIDE_IDS = ['research.project'] as const
export const FURNACE_V2_GUIDE_IDS = ['furnace.channel'] as const
export const REBUILD_GUIDE_IDS = ['rebuild.preview', 'rebuild.matter'] as const
export const NETWORK_RELAY_GUIDE_IDS = [] as const
export const PROTOCOL_V2_GUIDE_IDS = [] as const
