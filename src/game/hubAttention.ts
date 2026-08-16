import {
  MAX_MODULE_LEVEL,
  blueprintProgress,
  idleWorkers,
  listFarmableCores,
  moduleLevel,
  moduleUpgradeCost,
} from './catalog'
import {
  FOUNDRY_MODULES,
  FOUNDRY_RECIPES,
  FOUNDRY_UPGRADES,
  canBuyFoundryUpgrade,
  isFoundryModuleUnlocked,
  isFoundryRecipeUnlocked,
} from './foundry'
import { ASH_PER_HEAT } from './furnace'
import { MORE_STATIONS } from './moreStations'
import { pendingMilestone } from './milestones'
import { NETWORK_BARS, NETWORK_LINKS, canBuyNetworkLink, isNetworkBarUnlocked } from './network'
import { PROCESS_NODES, canBuyProcessNode } from './process'
import { hasHullLostOnce, isSystemUnlocked } from './progression'
import type { GameState, TabId } from './types'

export type AttentionFlags = { spend: boolean; fresh: boolean }

/** Hydrated onto saves that predate `seenContent` so existing careers are not spammed with “new”. */
export const LEGACY_SEEN_CONTENT = 'legacy'

export type HubAttentionScope = TabId

function seenSet(state: GameState): Set<string> {
  return new Set(state.meta.seenContent ?? [])
}

function isLegacySave(state: GameState): boolean {
  return (state.meta.seenContent ?? []).includes(LEGACY_SEEN_CONTENT)
}

export function contentKeys(state: GameState, scope: HubAttentionScope): string[] {
  const keys: string[] = []
  if (scope === 'cores') {
    if (hasHullLostOnce(state)) keys.push('sys:cores')
    return keys
  }
  if (scope === 'network') {
    if (isSystemUnlocked(state, 'network')) keys.push('sys:network')
    for (const bar of NETWORK_BARS) {
      if (isNetworkBarUnlocked(state, bar.id)) keys.push(`netbar:${bar.id}`)
    }
    return keys
  }
  if (scope === 'foundry') {
    if (isSystemUnlocked(state, 'foundry')) keys.push('sys:foundry')
    for (const rec of FOUNDRY_RECIPES) {
      if (isFoundryRecipeUnlocked(state, rec.id)) keys.push(`recipe:${rec.id}`)
    }
    for (const bit of FOUNDRY_MODULES) {
      if (isFoundryModuleUnlocked(state, bit.id)) keys.push(`bit:${bit.id}`)
    }
    for (const print of listFarmableCores(state)) {
      keys.push(`print:${print.id}`)
    }
    return keys
  }
  if (scope === 'research') {
    if (isSystemUnlocked(state, 'research')) keys.push('sys:research')
    return keys
  }
  if (scope === 'furnace') {
    if (isSystemUnlocked(state, 'furnace')) keys.push('sys:furnace')
    return keys
  }
  if (scope === 'process') {
    if (isSystemUnlocked(state, 'process')) keys.push('sys:process')
    return keys
  }
  if (scope === 'stats') {
    if (isSystemUnlocked(state, 'stats')) keys.push('sys:more')
    return keys
  }
  if (MORE_STATIONS.some((s) => s.id === scope) || scope === 'logs') {
    if (isSystemUnlocked(state, scope)) keys.push(`sys:${scope}`)
    return keys
  }
  return keys
}

export function markHubSeen(state: GameState, scope: HubAttentionScope): GameState {
  const keys = contentKeys(state, scope)
  if (keys.length === 0) return state
  const seen = seenSet(state)
  let changed = false
  for (const key of keys) {
    if (seen.has(key)) continue
    seen.add(key)
    changed = true
  }
  if (!changed) return state
  return {
    ...state,
    meta: { ...state.meta, seenContent: [...seen] },
  }
}

function hasUnseen(state: GameState, keys: string[]): boolean {
  if (keys.length === 0) return false
  if (isLegacySave(state)) return false
  const seen = seenSet(state)
  return keys.some((k) => !seen.has(k))
}

function coresSpend(state: GameState): boolean {
  if (!hasHullLostOnce(state)) return false
  const salvage = state.resources.salvage
  for (const moduleId of state.shipyard.modules) {
    const level = moduleLevel(state.shipyard.moduleLevels, moduleId)
    if (pendingMilestone(moduleId, level, state.shipyard.corePicks?.[moduleId])) return true
    if (level < MAX_MODULE_LEVEL && moduleUpgradeCost(level, moduleId) <= salvage) return true
  }
  return false
}

function coresFresh(state: GameState): boolean {
  return hasUnseen(state, contentKeys(state, 'cores'))
}

export function coresAttention(state: GameState): AttentionFlags {
  return { spend: coresSpend(state), fresh: coresFresh(state) }
}

function networkSpend(state: GameState): boolean {
  if (!isSystemUnlocked(state, 'network')) return false
  if (idleWorkers(state) > 0) return true
  return NETWORK_LINKS.some((link) => canBuyNetworkLink(state, link.id).ok)
}

function foundrySpend(state: GameState): boolean {
  if (!isSystemUnlocked(state, 'foundry')) return false
  if (state.foundry.slots.some((s) => !s.recipeId)) return true
  if (FOUNDRY_UPGRADES.some((up) => canBuyFoundryUpgrade(state, up.id).ok)) return true
  return listFarmableCores(state).some((print) => {
    if (state.shipyard.unlockedModules.includes(print.id)) return false
    return Boolean(blueprintProgress(state, print.id)?.complete)
  })
}

function furnaceSpend(state: GameState): boolean {
  if (!isSystemUnlocked(state, 'furnace')) return false
  return (state.resources.choirAsh ?? 0) >= ASH_PER_HEAT
}

function processSpend(state: GameState): boolean {
  if (!isSystemUnlocked(state, 'process')) return false
  return PROCESS_NODES.some((n) => canBuyProcessNode(state, n.id).ok)
}

export function moreStationAttention(state: GameState, id: TabId): AttentionFlags {
  if (!isSystemUnlocked(state, id)) return { spend: false, fresh: false }
  const fresh = hasUnseen(state, contentKeys(state, id))
  if (id === 'furnace') return { spend: furnaceSpend(state), fresh }
  if (id === 'process') return { spend: processSpend(state), fresh }
  return { spend: false, fresh }
}

function moreSpend(state: GameState): boolean {
  return MORE_STATIONS.some((s) => moreStationAttention(state, s.id).spend)
}

function moreFresh(state: GameState): boolean {
  if (!isSystemUnlocked(state, 'stats')) return false
  if (hasUnseen(state, contentKeys(state, 'stats'))) return true
  return MORE_STATIONS.some((s) => moreStationAttention(state, s.id).fresh)
}

export function attentionAria(label: string, flags: AttentionFlags): string {
  const notes: string[] = []
  if (flags.spend) notes.push('ready to spend')
  if (flags.fresh) notes.push('new')
  return notes.length ? `${label}, ${notes.join(', ')}` : label
}

export function tabAttention(state: GameState, tab: TabId): AttentionFlags {
  switch (tab) {
    case 'combat':
      return { spend: coresSpend(state), fresh: coresFresh(state) }
    case 'network':
      return { spend: networkSpend(state), fresh: hasUnseen(state, contentKeys(state, 'network')) }
    case 'foundry':
      return { spend: foundrySpend(state), fresh: hasUnseen(state, contentKeys(state, 'foundry')) }
    case 'stats':
      return { spend: moreSpend(state), fresh: moreFresh(state) }
    case 'research':
      return { spend: false, fresh: hasUnseen(state, contentKeys(state, 'research')) }
    case 'furnace':
      return { spend: furnaceSpend(state), fresh: hasUnseen(state, contentKeys(state, 'furnace')) }
    case 'process':
      return { spend: processSpend(state), fresh: hasUnseen(state, contentKeys(state, 'process')) }
    default:
      return { spend: false, fresh: false }
  }
}
