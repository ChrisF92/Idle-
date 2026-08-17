/** Session-only progression toasts. Never persisted on the save. */

import { blueprintProgress, getModule, listFarmableCores, moduleLevel } from './catalog'
import { pendingMilestone } from './milestones'
import { NETWORK_BARS, isNetworkBarUnlocked } from './network'
import {
  ACHIEVEMENTS,
  careerHighestSector,
  firstRebuildAvailable,
  hasHullLostOnce,
  isSystemUnlocked,
} from './progression'
import { isRouteBUnlocked } from './sectors'
import type { GameState, TabId } from './types'

export const TOAST_TTL_MS = 5000
export const TOAST_MAX_QUEUE = 5
export const TOAST_MAX_VISIBLE = 2

export type ToastNav =
  | { kind: 'tab'; tab: TabId; focus?: string }
  | { kind: 'cores'; moduleId?: string }
  | { kind: 'rebuild' }

export interface ToastSpec {
  /** Coalesce key — duplicate ids refresh the existing toast instead of stacking. */
  id: string
  category: string
  title: string
  body: string
  action?: { label: string; nav: ToastNav }
}

export interface QueuedToast extends ToastSpec {
  key: number
  createdAt: number
}

export interface ToastSnapshot {
  hullLost: boolean
  systems: Partial<Record<TabId, boolean>>
  networkBars: string[]
  farmablePrints: string[]
  completePrints: string[]
  pendingMilestones: string[]
  rebuildReady: boolean
  routeB: boolean
  act1Cleared: boolean
  achievements: string[]
}

const TRACKED_SYSTEMS: TabId[] = [
  'foundry',
  'reliquary',
  'furnace',
  'research',
  'codex',
  'protocols',
  'echo',
  'process',
  'yard',
  'slag',
  'specialists',
  'tasks',
  'capital',
  'reinforce',
]

const STATION_TOAST: Partial<
  Record<TabId, { category: string; title: string; body: string; label: string }>
> = {
  foundry: {
    category: 'SYSTEM ONLINE',
    title: 'Foundry unlocked',
    body: 'Smelters and recipes are online.',
    label: 'OPEN FOUNDRY',
  },
  reliquary: {
    category: 'SYSTEM ONLINE',
    title: 'Reliquary unlocked',
    body: 'Shard colour slots are now available.',
    label: 'OPEN RELIQUARY',
  },
  furnace: {
    category: 'SYSTEM ONLINE',
    title: 'Furnace unlocked',
    body: 'Choir-ash feeds Heat. Light channels for the job you want powered.',
    label: 'OPEN FURNACE',
  },
  research: {
    category: 'SYSTEM ONLINE',
    title: 'Research unlocked',
    body: 'Permanent Hive Research is now available.',
    label: 'OPEN RESEARCH',
  },
  codex: {
    category: 'SYSTEM ONLINE',
    title: 'Codex unlocked',
    body: 'Enemy families and hull roles are indexed.',
    label: 'OPEN CODEX',
  },
  protocols: {
    category: 'SYSTEM ONLINE',
    title: 'Protocols unlocked',
    body: 'Restricted sorties are now available.',
    label: 'OPEN PROTOCOLS',
  },
  echo: {
    category: 'SYSTEM ONLINE',
    title: 'Echo unlocked',
    body: 'Short gauntlets and the Echo tree are online.',
    label: 'OPEN ECHO',
  },
  process: {
    category: 'SYSTEM ONLINE',
    title: 'Process unlocked',
    body: 'The hangar can learn chores you already know. Achievements fund Process.',
    label: 'OPEN PROCESS',
  },
  specialists: {
    category: 'SYSTEM ONLINE',
    title: 'Specialists unlocked',
    body: 'Gunner, Warden, and Scavenger ranks are online.',
    label: 'OPEN SPECIALISTS',
  },
  tasks: {
    category: 'SYSTEM ONLINE',
    title: 'Task List unlocked',
    body: 'Finish the checklist to open Capital.',
    label: 'OPEN TASKS',
  },
  capital: {
    category: 'SYSTEM ONLINE',
    title: 'Capital unlocked',
    body: 'Second combat scale is online.',
    label: 'OPEN CAPITAL',
  },
  reinforce: {
    category: 'SYSTEM ONLINE',
    title: 'Reinforce unlocked',
    body: 'Second prestige. Keeps the foundry.',
    label: 'OPEN REINFORCE',
  },
}

function pendingCoreIds(state: GameState): string[] {
  const ids: string[] = []
  for (const moduleId of state.shipyard.modules) {
    const level = moduleLevel(state.shipyard.moduleLevels, moduleId)
    if (pendingMilestone(moduleId, level, state.shipyard.corePicks?.[moduleId])) {
      ids.push(moduleId)
    }
  }
  return ids
}

function completePrintIds(state: GameState): string[] {
  return listFarmableCores(state)
    .filter((print) => {
      if (state.shipyard.unlockedModules.includes(print.id)) return false
      return Boolean(blueprintProgress(state, print.id)?.complete)
    })
    .map((print) => print.id)
}

export function snapshotsEqual(a: ToastSnapshot, b: ToastSnapshot): boolean {
  if (a.hullLost !== b.hullLost || a.rebuildReady !== b.rebuildReady || a.routeB !== b.routeB) {
    return false
  }
  if (a.act1Cleared !== b.act1Cleared) return false
  if (a.networkBars.length !== b.networkBars.length) return false
  if (a.farmablePrints.length !== b.farmablePrints.length) return false
  if (a.completePrints.length !== b.completePrints.length) return false
  if (a.pendingMilestones.length !== b.pendingMilestones.length) return false
  if (a.achievements.length !== b.achievements.length) return false
  for (const id of TRACKED_SYSTEMS) {
    if (a.systems[id] !== b.systems[id]) return false
  }
  const same = (x: string[], y: string[]) => x.every((v, i) => v === y[i])
  return (
    same(a.networkBars, b.networkBars) &&
    same(a.farmablePrints, b.farmablePrints) &&
    same(a.completePrints, b.completePrints) &&
    same(a.pendingMilestones, b.pendingMilestones) &&
    same(a.achievements, b.achievements)
  )
}

export function captureToastSnapshot(state: GameState): ToastSnapshot {
  const systems: ToastSnapshot['systems'] = {}
  for (const id of TRACKED_SYSTEMS) {
    systems[id] = isSystemUnlocked(state, id)
  }
  return {
    hullLost: hasHullLostOnce(state),
    systems,
    networkBars: NETWORK_BARS.filter((bar) => isNetworkBarUnlocked(state, bar.id)).map((b) => b.id),
    farmablePrints: listFarmableCores(state).map((m) => m.id),
    completePrints: completePrintIds(state),
    pendingMilestones: pendingCoreIds(state),
    rebuildReady: firstRebuildAvailable(state),
    routeB: isRouteBUnlocked(careerHighestSector(state)),
    act1Cleared: Boolean(state.meta.act1Cleared),
    achievements: [...(state.meta.completedAchievements ?? [])],
  }
}

function systemToast(id: TabId): ToastSpec | null {
  const copy = STATION_TOAST[id]
  if (!copy) return null
  return {
    id: `sys:${id}`,
    category: copy.category,
    title: copy.title,
    body: copy.body,
    action: { label: copy.label, nav: { kind: 'tab', tab: id } },
  }
}

/** Diff session snapshots. Empty on first load if prev is seeded from the same state. */
export function diffToasts(prev: ToastSnapshot, next: ToastSnapshot, _state: GameState): ToastSpec[] {
  const out: ToastSpec[] = []
  const seen = new Set<string>()
  const push = (spec: ToastSpec | null) => {
    if (!spec || seen.has(spec.id)) return
    seen.add(spec.id)
    out.push(spec)
  }

  if (next.hullLost && !prev.hullLost) {
    push({
      id: 'sys:network',
      category: 'SYSTEM ONLINE',
      title: 'Dock systems online',
      body: 'Salvage ranks Cores. Drones live on Network. More stations are listed.',
      action: { label: 'OPEN NETWORK', nav: { kind: 'tab', tab: 'network' } },
    })
  }

  for (const id of TRACKED_SYSTEMS) {
    if (id === 'slag') continue
    if (!next.systems[id] || prev.systems[id]) continue
    if (id === 'yard') {
      push({
        id: 'sys:yard',
        category: 'SYSTEM ONLINE',
        title: 'Yard unlocked',
        body: 'Yard Grid and Slag Bank are online after Rebuild.',
        action: { label: 'OPEN YARD', nav: { kind: 'tab', tab: 'yard' } },
      })
      continue
    }
    push(systemToast(id))
  }

  if (next.rebuildReady && !prev.rebuildReady) {
    push({
      id: 'sys:rebuild',
      category: 'HANGAR',
      title: 'Rebuild available',
      body: 'The hangar can rebuild the hull and swap Cores.',
      action: { label: 'VIEW REBUILD', nav: { kind: 'rebuild' } },
    })
  }

  if (next.routeB && !prev.routeB) {
    push({
      id: 'sys:route-b',
      category: 'NAV',
      title: 'Route B available',
      body: 'An alternate sector lane is open from Dock.',
      action: { label: 'OPEN DOCK', nav: { kind: 'tab', tab: 'dock' } },
    })
  }

  if (next.act1Cleared && !prev.act1Cleared) {
    push({
      id: 'sys:act1',
      category: 'CAMPAIGN',
      title: 'Act 1 complete',
      body: 'Prestige, Ascension, and challenges are the long game.',
    })
  }

  const researchJust = Boolean(next.systems.research && !prev.systems.research)
  const foundryJust = Boolean(next.systems.foundry && !prev.systems.foundry)
  for (const barId of next.networkBars) {
    if (prev.networkBars.includes(barId)) continue
    if (barId === 'strike' || barId === 'ward') continue
    if ((barId === 'yield' || barId === 'loom') && foundryJust) continue
    if (barId === 'archive' && researchJust) continue
    const bar = NETWORK_BARS.find((b) => b.id === barId)
    if (!bar) continue
    push({
      id: `netbar:${barId}`,
      category: 'NETWORK',
      title: `${bar.name} unlocked`,
      body: bar.blurb,
      action: { label: 'OPEN NETWORK', nav: { kind: 'tab', tab: 'network', focus: `network-${barId}` } },
    })
  }

  for (const printId of next.farmablePrints) {
    if (prev.farmablePrints.includes(printId)) continue
    const mod = getModule(printId)
    if (!mod) continue
    push({
      id: `print:${printId}`,
      category: 'FOUNDRY',
      title: 'Core Print available',
      body: `${mod.name} can now be farmed from wrecks.`,
      action: {
        label: 'VIEW PRINT',
        nav: { kind: 'tab', tab: 'foundry', focus: `print-${printId}` },
      },
    })
  }

  for (const printId of next.completePrints) {
    if (prev.completePrints.includes(printId)) continue
    const mod = getModule(printId)
    if (!mod) continue
    push({
      id: `assemble:${printId}`,
      category: 'FOUNDRY',
      title: 'Blueprint complete',
      body: `${mod.name} is ready to assemble.`,
      action: {
        label: 'ASSEMBLE',
        nav: { kind: 'tab', tab: 'foundry', focus: `print-${printId}` },
      },
    })
  }

  for (const moduleId of next.pendingMilestones) {
    if (prev.pendingMilestones.includes(moduleId)) continue
    const mod = getModule(moduleId)
    if (!mod) continue
    push({
      id: `milestone:${moduleId}`,
      category: 'CORES',
      title: 'Core milestone',
      body: `${mod.name} has a node to pick.`,
      action: { label: 'VIEW CORES', nav: { kind: 'cores', moduleId } },
    })
  }

  const newAchievements = next.achievements.filter((id) => !prev.achievements.includes(id))
  const coveredBySystem = newAchievements.filter((id) => {
    if (id === 'first-blood' && seen.has('sys:process')) return true
    if (id === 'chip-drawer' && seen.has('sys:reliquary')) return true
    if (id === 'hangar-opened' && seen.has('sys:rebuild')) return true
    if (id === 'first-boss' && seen.has('sys:furnace')) return true
    if (id === 'archive-open' && seen.has('sys:research')) return true
    return false
  })
  const leftover = newAchievements.filter((id) => !coveredBySystem.includes(id))
  if (leftover.length === 1) {
    const def = ACHIEVEMENTS.find((a) => a.id === leftover[0])
    if (def) {
      push({
        id: `ach:${def.id}`,
        category: 'PROCESS',
        title: def.name,
        body: def.description,
        action: { label: 'OPEN PROCESS', nav: { kind: 'tab', tab: 'process' } },
      })
    }
  } else if (leftover.length > 1) {
    push({
      id: 'ach:batch',
      category: 'PROCESS',
      title: `${leftover.length} processes logged`,
      body: leftover
        .map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name)
        .filter(Boolean)
        .slice(0, 3)
        .join(' · '),
      action: { label: 'OPEN PROCESS', nav: { kind: 'tab', tab: 'process' } },
    })
  }

  return out
}

export function enqueueToasts(
  queue: QueuedToast[],
  incoming: ToastSpec[],
  now: number,
): QueuedToast[] {
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
  return queue.filter((t) => now - t.createdAt < ttl)
}
