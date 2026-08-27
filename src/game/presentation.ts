/**
 * Single presentation queue: events → eligibility → priority → display one → resolve.
 * Onboarding, unlocks, action toasts, and minor toasts all go through here.
 */

import { blueprintProgress, getModule, listFarmableCores } from './catalog'
import {
  activeOnboardingLesson,
  lessonPausesSimulation,
  type OnboardingNav,
  type PresentationUi,
  type ResolvedLesson,
  type SemanticTargetId,
} from './onboarding'
import { ACHIEVEMENTS, firstRebuildAvailable, hasHullLostOnce, isSystemUnlocked } from './progression'
import { HIVE_RESEARCH_BRANCHES, HIVE_RESEARCH_NODES, hiveResearchCompleted } from './hiveResearch'
import type { GameState, HiveResearchBranch, TabId } from './types'

export const TOAST_TTL_MS = 6000
export const ACTION_TOAST_TTL_MS = 10000
export const TOAST_MAX_QUEUE = 8

export type PresentationClass = 'critical' | 'blocking' | 'major' | 'action' | 'minor'

export const PRESENTATION_PRIORITY: Record<PresentationClass, number> = {
  critical: 100,
  blocking: 80,
  major: 60,
  action: 40,
  minor: 20,
}

export type PresentationNav =
  | { kind: 'tab'; tab: TabId; pane?: OnboardingNav['pane']; focus?: string }
  | { kind: 'cores'; moduleId?: string }
  | { kind: 'rebuild' }
  | { kind: 'inventory'; moduleId?: string }

export type ToastNav = PresentationNav

export interface PresentationAction {
  label: string
  nav: PresentationNav
}

export interface PresentationItem {
  id: string
  class: PresentationClass
  priority: number
  title: string
  body: string[]
  kicker?: string
  actionLabel?: string
  required?: boolean
  target?: SemanticTargetId
  action?: PresentationAction
  dismissible: boolean
  skippable: boolean
  lessonId?: string
  dedupeKey: string
  timestamp: number
  order: number
  pause: boolean
  nav?: OnboardingNav
  kind: 'onboarding' | 'toast'
  phase?: 'action' | 'payoff'
  expiresAt?: number
  completeOnTap?: boolean
}

export interface ToastSpec {
  id: string
  category: string
  title: string
  body: string
  tier?: 'minor' | 'action' | 'major'
  action?: { label: string; nav: PresentationNav }
}

export interface QueuedToast extends ToastSpec {
  key: number
  createdAt: number
}

export interface ToastSnapshot {
  hullLost: boolean
  systems: Partial<Record<TabId, boolean>>
  rebuildReady: boolean
  rebuildCycle: number
  act1Cleared: boolean
  bestWave: number
  completePrints: string[]
  ownedCoreIds: string[]
  ownedFacilities: string[]
  researchCompleted: Partial<Record<HiveResearchBranch, number>>
  researchActive: boolean
  fabricatorBusy: boolean
  achievements: string[]
  docked: boolean
}

const TRACKED_SYSTEMS: TabId[] = [
  'foundry',
  'network',
  'reliquary',
  'furnace',
  'research',
  'protocols',
  'process',
  'reinforce',
]

const SYSTEM_TOAST: Partial<
  Record<TabId, { title: string; body: string; label: string; nav: PresentationNav; duringCombat?: string }>
> = {
  foundry: {
    title: 'Foundry online',
    body: 'Recovered material can now be processed.',
    label: 'OPEN',
    nav: { kind: 'tab', tab: 'foundry', pane: 'processing' },
    duringCombat: 'View after this Sortie, or open now.',
  },
  network: {
    title: 'Worker Drones unlocked',
    body: 'Assign drones to Salvage, fabrication, and research jobs.',
    label: 'OPEN',
    nav: { kind: 'tab', tab: 'network' },
  },
  reliquary: {
    title: 'Relic sockets unlocked',
    body: 'Matching sockets on fitted Cores. Spare copies upgrade in Fabrication.',
    label: 'VIEW LOADOUT',
    nav: { kind: 'tab', tab: 'dock', pane: 'loadout' },
  },
  furnace: {
    title: 'Furnace online',
    body: 'Ash becomes Heat. Light temporary channels this Sortie.',
    label: 'OPEN',
    nav: { kind: 'tab', tab: 'furnace' },
  },
  research: {
    title: 'Research online',
    body: 'Start one long-term project. It keeps running offline.',
    label: 'VIEW RESEARCH',
    nav: { kind: 'tab', tab: 'research' },
  },
  protocols: {
    title: 'Challenges unlocked',
    body: 'Restriction, goal, reward, and disabled systems are listed before launch.',
    label: 'VIEW CHALLENGES',
    nav: { kind: 'tab', tab: 'protocols' },
  },
  process: {
    title: 'Process online',
    body: 'Spend banked Process to automate the chores you already know.',
    label: 'OPEN',
    nav: { kind: 'tab', tab: 'process' },
  },
  reinforce: {
    title: 'Reinforce unlocked',
    body: 'Rebuild has reached the limit of this loop. Reinforce changes the Hive’s starting architecture.',
    label: 'OPEN',
    nav: { kind: 'tab', tab: 'reinforce' },
  },
}

function alreadyAcked(state: GameState, key: string): boolean {
  return (state.meta.acknowledgedEvents ?? []).includes(key)
}

export function acknowledgeEvent(state: GameState, key: string): GameState {
  if (alreadyAcked(state, key)) return state
  const next = structuredClone(state)
  next.meta.acknowledgedEvents = [...(next.meta.acknowledgedEvents ?? []), key]
  return next
}

export function snapshotsEqual(a: ToastSnapshot, b: ToastSnapshot): boolean {
  if (a.hullLost !== b.hullLost || a.rebuildReady !== b.rebuildReady || a.rebuildCycle !== b.rebuildCycle) {
    return false
  }
  if (a.act1Cleared !== b.act1Cleared || a.bestWave !== b.bestWave) return false
  if (a.researchActive !== b.researchActive || a.fabricatorBusy !== b.fabricatorBusy || a.docked !== b.docked) {
    return false
  }
  if (a.completePrints.length !== b.completePrints.length) return false
  if (a.ownedCoreIds.length !== b.ownedCoreIds.length) return false
  if (a.ownedFacilities.length !== b.ownedFacilities.length) return false
  if (a.achievements.length !== b.achievements.length) return false
  for (const id of TRACKED_SYSTEMS) {
    if (a.systems[id] !== b.systems[id]) return false
  }
  for (const branch of HIVE_RESEARCH_BRANCHES) {
    if (a.researchCompleted[branch.id] !== b.researchCompleted[branch.id]) return false
  }
  const same = (x: string[], y: string[]) => x.every((v, i) => v === y[i])
  return (
    same(a.completePrints, b.completePrints) &&
    same(a.ownedCoreIds, b.ownedCoreIds) &&
    same(a.ownedFacilities, b.ownedFacilities) &&
    same(a.achievements, b.achievements)
  )
}

function fabricatorBusy(state: GameState): boolean {
  return (state.foundry?.fabrication ?? []).some((slot) => slot.kind)
}

function completePrintIds(state: GameState): string[] {
  return listFarmableCores(state)
    .filter((print) => Boolean(blueprintProgress(state, print.id)?.complete))
    .map((print) => print.id)
}

export function captureToastSnapshot(state: GameState): ToastSnapshot {
  const systems: ToastSnapshot['systems'] = {}
  for (const id of TRACKED_SYSTEMS) systems[id] = isSystemUnlocked(state, id)
  const researchCompleted: ToastSnapshot['researchCompleted'] = {}
  for (const branch of HIVE_RESEARCH_BRANCHES) {
    researchCompleted[branch.id] = hiveResearchCompleted(state, branch.id)
  }
  return {
    hullLost: hasHullLostOnce(state),
    systems,
    rebuildReady: firstRebuildAvailable(state),
    rebuildCycle: state.prestige.prestigeCount ?? 0,
    act1Cleared: Boolean(state.meta.act1Cleared),
    bestWave: Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0),
    completePrints: completePrintIds(state),
    ownedCoreIds: (state.shipyard.coreInstances ?? []).map((row) => row.id),
    ownedFacilities: [...(state.foundry.facilities ?? [])],
    researchCompleted,
    researchActive: Boolean(state.hiveResearch?.active),
    fabricatorBusy: fabricatorBusy(state),
    achievements: [...(state.meta.completedAchievements ?? [])],
    docked: state.combat.docked,
  }
}

function pushUnique(out: ToastSpec[], spec: ToastSpec | null, seen: Set<string>): void {
  if (!spec || seen.has(spec.id)) return
  seen.add(spec.id)
  out.push(spec)
}

export function diffToasts(prev: ToastSnapshot, next: ToastSnapshot, state: GameState): ToastSpec[] {
  const out: ToastSpec[] = []
  const seen = new Set<string>()
  const live = !next.docked

  for (const id of TRACKED_SYSTEMS) {
    if (!next.systems[id] || prev.systems[id]) continue
    const copy = SYSTEM_TOAST[id]
    if (!copy) continue
    const key = `sys:${id}`
    if (alreadyAcked(state, key)) continue
    pushUnique(
      out,
      {
        id: key,
        category: 'SYSTEM ONLINE',
        title: copy.title,
        body: live && copy.duringCombat ? copy.duringCombat : copy.body,
        tier: live ? 'action' : 'major',
        action: { label: live ? 'OPEN' : copy.label, nav: copy.nav },
      },
      seen,
    )
  }

  if (next.rebuildReady && !prev.rebuildReady) {
    const key = `rebuild-ready:${next.rebuildCycle}`
    if (!alreadyAcked(state, key)) {
      pushUnique(
        out,
        {
          id: key,
          category: 'HANGAR',
          title: 'Rebuild ready',
          body: 'Preview RESET, KEEP, and GAIN. Confirm only when you are ready.',
          tier: 'action',
          action: { label: 'VIEW REBUILD', nav: { kind: 'rebuild' } },
        },
        seen,
      )
    }
  }

  if (next.act1Cleared && !prev.act1Cleared && !alreadyAcked(state, 'sys:act1')) {
    pushUnique(
      out,
      {
        id: 'sys:act1',
        category: 'CAMPAIGN',
        title: 'Act 1 complete',
        body: 'The Choir Crown is destroyed. Reinforce is open on More.',
        tier: 'major',
        action: { label: 'OPEN', nav: { kind: 'tab', tab: 'reinforce' } },
      },
      seen,
    )
  }

  if (next.bestWave > prev.bestWave && next.docked && prev.bestWave > 0) {
    pushUnique(
      out,
      {
        id: `best:${next.bestWave}`,
        category: 'NEW BEST',
        title: `Wave ${next.bestWave}`,
        body: '',
        tier: 'minor',
      },
      seen,
    )
  }

  for (const printId of next.completePrints) {
    if (prev.completePrints.includes(printId)) continue
    const mod = getModule(printId)
    if (!mod) continue
    pushUnique(
      out,
      {
        id: `blueprint-complete:${printId}`,
        category: 'BLUEPRINT COMPLETE',
        title: mod.name,
        body: 'Design known — fabrication still required.',
        tier: 'action',
        action: {
          label: 'VIEW PROJECT',
          nav: { kind: 'tab', tab: 'foundry', pane: 'fabrication', focus: `project-core-${printId}` },
        },
      },
      seen,
    )
  }

  for (const coreId of next.ownedCoreIds) {
    if (prev.ownedCoreIds.includes(coreId)) continue
    const moduleId = coreId.split(':')[0] ?? coreId
    const mod = getModule(moduleId)
    if (!mod) continue
    pushUnique(
      out,
      {
        id: `fab-core:${coreId}`,
        category: 'FABRICATION',
        title: `${mod.name.toUpperCase()} FABRICATED`,
        body: 'Physical copy owned. Fit it from the loadout when Docked.',
        tier: 'action',
        action: {
          label: 'VIEW CORE',
          nav: { kind: 'cores', moduleId },
        },
      },
      seen,
    )
  }

  for (const facilityId of next.ownedFacilities) {
    if (prev.ownedFacilities.includes(facilityId)) continue
    pushUnique(
      out,
      {
        id: `fab-facility:${facilityId}`,
        category: 'FOUNDRY',
        title: 'INFRASTRUCTURE COMPLETE',
        body: 'Bonus is live.',
        tier: 'action',
        action: { label: 'VIEW INFRASTRUCTURE', nav: { kind: 'tab', tab: 'foundry', pane: 'fabrication', focus: 'foundry-build' } },
      },
      seen,
    )
  }

  for (const branch of HIVE_RESEARCH_BRANCHES) {
    const was = prev.researchCompleted[branch.id] ?? 0
    const now = next.researchCompleted[branch.id] ?? 0
    if (now <= was) continue
    const def = HIVE_RESEARCH_NODES[branch.id]?.[was]
    const name = def?.name ?? branch.name
    pushUnique(
      out,
      {
        id: `research:${branch.id}:${now}`,
        category: 'RESEARCH COMPLETE',
        title: name,
        body: def?.blurb ?? 'Project complete.',
        tier: 'action',
        action: { label: 'VIEW RESEARCH', nav: { kind: 'tab', tab: 'research' } },
      },
      seen,
    )
  }

  if (prev.fabricatorBusy && !next.fabricatorBusy && isSystemUnlocked(state, 'foundry')) {
    const key = 'foundry:idle'
    if (!alreadyAcked(state, key)) {
      pushUnique(
        out,
        {
          id: key,
          category: 'FOUNDRY',
          title: 'Fabricator idle',
          body: 'A fabrication slot is free.',
          tier: 'action',
          action: { label: 'VIEW PROJECT', nav: { kind: 'tab', tab: 'foundry', pane: 'fabrication' } },
        },
        seen,
      )
    }
  }

  const leftoverAchievements = next.achievements.filter((id) => !prev.achievements.includes(id))
  for (const id of leftoverAchievements) {
    if (id === 'first-blood' && seen.has('sys:process')) continue
    if (id === 'chip-drawer' && seen.has('sys:reliquary')) continue
    if (id === 'hangar-opened' && (seen.has(`rebuild-ready:${next.rebuildCycle}`) || seen.has('sys:rebuild'))) continue
    if (id === 'first-boss' && seen.has('sys:furnace')) continue
    if (id === 'archive-open' && seen.has('sys:research')) continue
    const def = ACHIEVEMENTS.find((a) => a.id === id)
    if (!def) continue
    pushUnique(
      out,
      {
        id: `ach:${def.id}`,
        category: 'MILESTONE',
        title: def.name,
        body: def.description,
        tier: 'minor',
      },
      seen,
    )
  }

  return out
}

export function toastTier(spec: Pick<ToastSpec, 'tier' | 'action'>): 'minor' | 'action' | 'major' {
  if (spec.tier) return spec.tier
  if (spec.action) return 'action'
  return 'minor'
}

export function enqueueToasts(queue: QueuedToast[], incoming: ToastSpec[], now: number): QueuedToast[] {
  let next = [...queue]
  for (const spec of incoming) {
    const existing = next.findIndex((t) => t.id === spec.id)
    if (existing >= 0) {
      next[existing] = { ...next[existing], ...spec, createdAt: now }
      continue
    }
    next.push({ ...spec, key: now + next.length, createdAt: now })
  }
  if (next.length > TOAST_MAX_QUEUE) next = next.slice(next.length - TOAST_MAX_QUEUE)
  return next
}

export function dismissToast(queue: QueuedToast[], id: string): QueuedToast[] {
  return queue.filter((t) => t.id !== id)
}

export function expireToasts(queue: QueuedToast[], now: number, ttl = TOAST_TTL_MS): QueuedToast[] {
  return queue.filter((t) => {
    const tier = toastTier(t)
    if (tier === 'major') return true
    const life = tier === 'action' ? ACTION_TOAST_TTL_MS : ttl
    return now - t.createdAt < life
  })
}

function toastToItem(spec: QueuedToast, order: number): PresentationItem {
  const cls = toastTier(spec) === 'major' ? 'major' : toastTier(spec) === 'action' ? 'action' : 'minor'
  return {
    id: spec.id,
    class: cls,
    priority: PRESENTATION_PRIORITY[cls],
    title: spec.title,
    body: spec.body ? [spec.body] : [],
    kicker: spec.category,
    action: spec.action,
    dismissible: true,
    skippable: true,
    dedupeKey: spec.id,
    timestamp: spec.createdAt,
    order,
    pause: false,
    kind: 'toast',
    expiresAt:
      cls === 'major'
        ? undefined
        : spec.createdAt + (cls === 'action' ? ACTION_TOAST_TTL_MS : TOAST_TTL_MS),
  }
}

function lessonToItem(lesson: ResolvedLesson, now: number): PresentationItem {
  return {
    id: `onboarding:${lesson.id}`,
    class: 'blocking',
    priority: PRESENTATION_PRIORITY.blocking,
    title: lesson.title,
    body: lesson.body,
    kicker: lesson.phase === 'payoff' ? 'Payoff' : lesson.actionLabel,
    actionLabel: lesson.actionLabel,
    required: lesson.required,
    target: lesson.target,
    dismissible: lesson.skippable,
    skippable: lesson.skippable,
    lessonId: lesson.id,
    dedupeKey: `onboarding:${lesson.id}`,
    timestamp: now,
    order: 0,
    pause: lessonPausesSimulation(lesson),
    nav: lesson.nav,
    kind: 'onboarding',
    phase: lesson.phase,
    completeOnTap: lesson.completeOnTap,
  }
}

export interface PresentationGate {
  updateBlocking?: boolean
  confirmOpen?: boolean
  reportOpen?: boolean
  blockingModal?: boolean
  finalePending?: boolean
}

/**
 * Pick the single item that may display. Higher-priority overlays cause the rest to wait.
 */
export function selectPresentation(
  state: GameState,
  ui: PresentationUi,
  toasts: QueuedToast[],
  gate: PresentationGate,
  now = Date.now(),
): PresentationItem | null {
  if (gate.updateBlocking || gate.confirmOpen || gate.finalePending) return null
  if (gate.reportOpen) return null

  const items: PresentationItem[] = []
  const lesson = activeOnboardingLesson(state, ui)
  if (lesson) items.push(lessonToItem(lesson, now))

  const liveToasts = expireToasts(toasts, now)
  liveToasts.forEach((toast, i) => items.push(toastToItem(toast, i + 1)))

  items.sort((a, b) => b.priority - a.priority || a.order - b.order || a.timestamp - b.timestamp)
  const top = items[0]
  if (!top) return null
  if (gate.blockingModal && top.kind === 'toast') return null
  if (top.class === 'minor' || top.class === 'action') {
    const blocking = items.find((item) => item.class === 'blocking' || item.class === 'major' || item.class === 'critical')
    if (blocking && blocking !== top) return blocking
  }
  return top
}

export function isSortieActive(state: GameState): boolean {
  return !state.combat.docked
}

/** Global DOCK | SYSTEMS | MORE is hidden on the combat screen during a live Sortie. */
export function showGlobalBottomNav(state: GameState, tab: string): boolean {
  if (!isSortieActive(state)) return true
  if (tab === 'combat') return false
  return Boolean(state.combat.sortiePaused)
}

/** Compact return control while browsing with a paused live Sortie. */
export function showSortieReturnControl(state: GameState, tab: string): boolean {
  return isSortieActive(state) && Boolean(state.combat.sortiePaused) && tab !== 'combat'
}
