/** Session-only progression toasts. Never persisted on the save. */

import { blueprintProgress, getModule, listFarmableCores, moduleLevel } from './catalog'
import { pendingMilestone } from './milestones'
import {
  ACHIEVEMENTS,
  firstRebuildAvailable,
  hasHullLostOnce,
  isSystemUnlocked,
} from './progression'
import { foundryMaterialCount, foundryRecipeLevel } from './foundry'
import { processCoreHintReady } from './playerGuidance'
import type { GameState, TabId } from './types'

export const TOAST_TTL_MS = 5000
export const TOAST_MAX_QUEUE = 5
export const TOAST_MAX_VISIBLE = 2

export type ToastNav =
  | { kind: 'tab'; tab: TabId; focus?: string }
  | { kind: 'cores'; moduleId?: string }
  | { kind: 'rebuild' }

export type ToastTier = 'minor' | 'action' | 'major'

export interface ToastSpec {
  /** Coalesce key — duplicate ids refresh the existing toast instead of stacking. */
  id: string
  category: string
  title: string
  body: string
  /** minor expires; action deep-links; major waits for a tap (GDD §124). */
  tier?: ToastTier
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
  foundrySlag: number
  foundrySlagLevel: number
  foundryFitReady: boolean
  assembledPrints: string[]
  trackedPrintId: string | null
  processCoreHint: boolean
  protocolRankSum: number
  frontierNoticeSeq: number
}

const TRACKED_SYSTEMS: TabId[] = [
  'foundry',
  'reliquary',
  'furnace',
  'research',
  'codex',
  'protocols',
  'process',
  'yard',
  'slag',
  'capital',
  'reinforce',
]

const STATION_TOAST: Partial<
  Record<TabId, { category: string; title: string; body: string; label: string }>
> = {
  foundry: {
    category: 'SYSTEM ONLINE',
    title: 'Foundry unlocked',
    body: 'Choose a Core to track and decide what Processing makes next.',
    label: 'OPEN',
  },
  reliquary: {
    category: 'SYSTEM ONLINE',
    title: 'Relic sockets unlocked',
    body: 'Matching sockets on fitted Cores. Mastery 5 or Wave 275 adds Universal. Spare copies upgrade I–III with Slag Ingots.',
    label: 'OPEN DOCK',
  },
  furnace: {
    category: 'SYSTEM ONLINE',
    title: 'Furnace unlocked',
    body: 'Ash now becomes a push budget. Choose which temporary channels stay lit.',
    label: 'OPEN',
  },
  research: {
    category: 'SYSTEM ONLINE',
    title: 'Research unlocked',
    body: 'Choose one long-term branch to focus; breakthroughs unlock mechanics.',
    label: 'OPEN',
  },
  codex: {
    category: 'SYSTEM ONLINE',
    title: 'Codex unlocked',
    body: 'Optional reference for enemy families and hull roles.',
    label: 'OPEN',
  },
  protocols: {
    category: 'SYSTEM ONLINE',
    title: 'Challenges unlocked',
    body: 'Solve a modified version of the normal rules. Restriction, goal, reward, and disabled systems are listed before you launch.',
    label: 'OPEN',
  },
  process: {
    category: 'SYSTEM ONLINE',
    title: 'Process unlocked',
    body: 'You know the manual loops now. Spend banked Process to automate the chores.',
    label: 'OPEN',
  },
  slag: {
    category: 'REBUILD',
    title: 'Matter shop unlocked',
    body: 'Spend Rebuild Matter on large permanent ranks. Key growth ranks compound.',
    label: 'OPEN',
  },
  specialists: {
    category: 'SYSTEM ONLINE',
    title: 'Specialists unlocked',
    body: 'Rank specialists for permanent ship bonuses.',
    label: 'OPEN',
  },
  tasks: {
    category: 'SYSTEM ONLINE',
    title: 'Task List unlocked',
    body: 'Finish the checklist to open Capital.',
    label: 'OPEN',
  },
  capital: {
    category: 'SYSTEM ONLINE',
    title: 'Capital unlocked',
    body: 'Upgrade Broadside, Bulkhead, and Hold with Salvage and Heat.',
    label: 'OPEN',
  },
  reinforce: {
    category: 'SYSTEM ONLINE',
    title: 'Reinforce unlocked',
    body: 'Rebuild has reached the limit of this loop. Reinforce changes the starting architecture of the Hive.',
    label: 'OPEN',
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
  if (a.foundrySlag !== b.foundrySlag || a.foundrySlagLevel !== b.foundrySlagLevel) return false
  if (a.foundryFitReady !== b.foundryFitReady) return false
  if (a.trackedPrintId !== b.trackedPrintId) return false
  if (a.assembledPrints.length !== b.assembledPrints.length) return false
  if (a.processCoreHint !== b.processCoreHint || a.protocolRankSum !== b.protocolRankSum) return false
  if (a.frontierNoticeSeq !== b.frontierNoticeSeq) return false
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
    same(a.assembledPrints, b.assembledPrints) &&
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
    networkBars: [],
    farmablePrints: listFarmableCores(state).map((m) => m.id),
    completePrints: completePrintIds(state),
    pendingMilestones: pendingCoreIds(state),
    rebuildReady: firstRebuildAvailable(state),
    routeB: false,
    act1Cleared: Boolean(state.meta.act1Cleared),
    achievements: [...(state.meta.completedAchievements ?? [])],
    foundrySlag: foundryMaterialCount(state, 'slag-ingot'),
    foundrySlagLevel: foundryRecipeLevel(state, 'slag-ingot'),
    foundryFitReady: false,
    assembledPrints: listFarmableCores(state)
      .filter((print) => state.shipyard.unlockedModules.includes(print.id))
      .map((print) => print.id),
    trackedPrintId: state.foundry.trackedPrintId ?? null,
    processCoreHint: processCoreHintReady(state),
    protocolRankSum: Object.values(state.protocols?.ranks ?? {}).reduce((n, v) => n + v, 0),
    frontierNoticeSeq: state.combat.frontierNotice?.seq ?? 0,
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
    tier: 'major',
    action: { label: copy.label, nav: { kind: 'tab', tab: id } },
  }
}

/** Diff session snapshots. Empty on first load if prev is seeded from the same state. */
export function diffToasts(prev: ToastSnapshot, next: ToastSnapshot, state: GameState): ToastSpec[] {
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
      title: 'Workshop unlocked',
      body: 'Scrap survives. Spend it so the next Sortie starts stronger.',
      tier: 'major',
      action: { label: 'OPEN DOCK', nav: { kind: 'tab', tab: 'dock' } },
    })
  }

  if (next.frontierNoticeSeq > prev.frontierNoticeSeq) {
    const notice = state.combat.frontierNotice
    if (notice?.kind === 'repelled' && !notice.first) {
      const fallback =
        notice.fallback === notice.sector
          ? `Holding Wave ${notice.fallback * 10}.`
          : `Falling back to Wave ${notice.fallback * 10}.`
      push({
        id: `frontier:repel:${notice.seq}`,
        category: 'REPULSED',
        title: `Repelled — Wave ${notice.sector * 10}`,
        body: fallback,
        action: { label: 'SORTIE', nav: { kind: 'tab', tab: 'combat' } },
      })
    }
    if (notice?.kind === 'cleared') {
      push({
        id: `frontier:clear:${notice.seq}`,
        category: 'FRONTIER',
        title: `Frontier cleared — Wave ${notice.sector * 10}`,
        body: 'Advance resumes.',
        action: { label: 'SORTIE', nav: { kind: 'tab', tab: 'combat' } },
      })
    }
  }

  for (const id of TRACKED_SYSTEMS) {
    if (!next.systems[id] || prev.systems[id]) continue
    if (id === 'yard') {
      push({
        id: 'sys:yard',
        category: 'SYSTEM ONLINE',
        title: 'Construction unlocked',
        body: 'Foundry construction is open. Place processing gear; arms apply on the next Rebuild.',
        tier: 'major',
        action: { label: 'OPEN', nav: { kind: 'tab', tab: 'foundry', focus: 'foundry-build' } },
      })
      continue
    }
    if (id === 'reliquary') {
      push({
        id: 'sys:reliquary',
        category: 'SYSTEM ONLINE',
        title: 'Relic sockets unlocked',
        body: 'Matching sockets on fitted Cores. Power, Optical, Ballistic, Shield, Industrial — then Universal at Mastery 5 or Wave 275. Spare copies upgrade I–III with Slag Ingots.',
        tier: 'major',
        action: { label: 'OPEN DOCK', nav: { kind: 'tab', tab: 'dock' } },
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
      body: 'Preview RESET, KEEP, and GAIN. Confirm only when you are ready.',
      tier: 'major',
      action: { label: 'VIEW REBUILD', nav: { kind: 'rebuild' } },
    })
  }

  if (next.act1Cleared && !prev.act1Cleared) {
    push({
      id: 'sys:act1',
      category: 'CAMPAIGN',
      title: 'Act 1 complete',
      body: 'Wave 300 is down. Reinforce is open on More.',
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

  const firstPrintReady = prev.completePrints.length === 0
  for (const printId of next.completePrints) {
    if (prev.completePrints.includes(printId)) continue
    const mod = getModule(printId)
    if (!mod) continue
    if (firstPrintReady) {
      push({
        id: `assemble:${printId}`,
        category: 'CORE PRINT COMPLETE',
        title: `${mod.name} is ready to assemble.`,
        body: 'Open Fabrication to lock it in.',
        action: {
          label: 'OPEN FABRICATION',
          nav: { kind: 'tab', tab: 'foundry', focus: `print-${printId}` },
        },
      })
    } else {
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
  }

  for (const printId of next.assembledPrints) {
    if (prev.assembledPrints.includes(printId)) continue
    const mod = getModule(printId)
    if (!mod) continue
    const live = !state.combat.docked
    const tracked = prev.trackedPrintId === printId
    push({
      id: tracked ? `tracked-assembled:${printId}` : `assembled:${printId}`,
      category: 'FOUNDRY',
      title: `${mod.name} assembled`,
      body: live
        ? `${mod.name} is available next Sortie.`
        : tracked
          ? 'Choose another tracked print. Fit it at Dock.'
          : 'Fit it at Dock.',
      action: {
        label: live ? 'OPEN DOCK' : 'FIT AT DOCK',
        nav: { kind: 'tab', tab: 'dock' },
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

  if (next.foundryFitReady && !prev.foundryFitReady) {
    push({
      id: 'foundry:module-ready',
      category: 'MODULE READY',
      title: 'You can now build your first ship module.',
      body: 'Fit it in the Foundry while docked.',
      action: {
        label: 'OPEN FOUNDRY',
        nav: { kind: 'tab', tab: 'foundry', focus: 'foundry-fit' },
      },
    })
  }

  if (next.foundrySlag > 0 && prev.foundrySlag <= 0) {
    push({
      id: 'foundry:slag',
      category: 'FOUNDRY',
      title: 'Slag Ingot produced',
      body: 'Stock is ready. Keep smelting to raise recipe level.',
      action: { label: 'OPEN', nav: { kind: 'tab', tab: 'foundry' } },
    })
  }

  if (next.foundrySlagLevel > 0 && prev.foundrySlagLevel <= 0) {
    push({
      id: 'foundry:mastery',
      category: 'FOUNDRY',
      title: 'Recipe level increased',
      body: 'Repeated crafting makes this recipe faster.',
      action: { label: 'OPEN', nav: { kind: 'tab', tab: 'foundry' } },
    })
  }

  if (next.processCoreHint && !prev.processCoreHint) {
    push({
      id: 'process:cores',
      category: 'PROCESS',
      title: 'Doing this often?',
      body: 'Process can automate Core upgrades.',
      action: { label: 'SHOW ME', nav: { kind: 'tab', tab: 'process', focus: 'process-first-buy' } },
    })
  }

  if (next.protocolRankSum > 0 && prev.protocolRankSum <= 0) {
    push({
      id: 'protocol:rank1',
      category: 'PROTOCOL',
      title: 'Protocol cleared — Rank 1',
      body: 'The muted system now scales better. Rank 2 has a harder target.',
      action: { label: 'OPEN', nav: { kind: 'tab', tab: 'protocols' } },
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

export function toastTier(spec: Pick<ToastSpec, 'tier' | 'action'>): ToastTier {
  if (spec.tier) return spec.tier
  if (spec.action) return 'action'
  return 'minor'
}

export function expireToasts(queue: QueuedToast[], now: number, ttl = TOAST_TTL_MS): QueuedToast[] {
  return queue.filter((t) => toastTier(t) === 'major' || now - t.createdAt < ttl)
}
