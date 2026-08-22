import {
  MAX_MODULE_LEVEL,
  blueprintProgress,
  idleWorkers,
  listFarmableCores,
  moduleLevel,
  moduleUpgradeCost,
  getModule,
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
import { hiveResearchActive, hiveResearchCompleted, HIVE_RESEARCH_NODES } from './hiveResearch'
import { MORE_STATIONS } from './moreStations'
import { pendingMilestone } from './milestones'
import { NETWORK_BARS, NETWORK_LINKS, canBuyNetworkLink, isNetworkBarUnlocked } from './network'
import { protocolCoreScalingAdd } from './protocols'
import { canBuyProcessNode, processVisibleNodes } from './process'
import { hasHullLostOnce, isSystemUnlocked } from './progression'
import type { GameState, TabId } from './types'
import {
  RUN_UPGRADE_CAP,
  effectiveUpgradeLevel,
  runPurchasedLevel,
  runUpgradeCost,
  visibleRunUpgrades,
} from './workshop'
import { noteSystemOpen } from './playtest'

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
    if (isSystemUnlocked(state, 'yard')) keys.push('sys:yard')
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
  const opened: string[] = []
  let changed = false
  for (const key of keys) {
    if (seen.has(key)) continue
    seen.add(key)
    changed = true
    if (key.startsWith('sys:')) opened.push(key.slice(4))
  }
  if (!changed) return state
  const next: GameState = {
    ...state,
    meta: { ...state.meta, seenContent: [...seen] },
  }
  for (const system of opened) noteSystemOpen(next, system)
  return next
}

function hasUnseen(state: GameState, keys: string[]): boolean {
  if (keys.length === 0) return false
  if (isLegacySave(state)) return false
  const seen = seenSet(state)
  return keys.some((k) => !seen.has(k))
}

function coresSpend(state: GameState): boolean {
  if (!state.combat.docked) return false
  if (!hasHullLostOnce(state)) return false
  const scrap = state.resources.scrap ?? 0
  for (const moduleId of state.shipyard.modules) {
    const level = moduleLevel(state.shipyard.moduleLevels, moduleId)
    if (pendingMilestone(moduleId, level, state.shipyard.corePicks?.[moduleId])) return true
    if (level < MAX_MODULE_LEVEL && moduleUpgradeCost(level, moduleId, protocolCoreScalingAdd(state, getModule(moduleId)?.role)) <= scrap) return true
  }
  return false
}

function coresFresh(state: GameState): boolean {
  return hasUnseen(state, contentKeys(state, 'cores'))
}

export function coresAttention(state: GameState): AttentionFlags {
  return { spend: coresSpend(state), fresh: coresFresh(state) }
}

export function networkAttention(state: GameState): AttentionFlags {
  return { spend: networkSpend(state), fresh: hasUnseen(state, contentKeys(state, 'network')) }
}

export function foundryAttention(state: GameState): AttentionFlags {
  return { spend: foundrySpend(state), fresh: hasUnseen(state, contentKeys(state, 'foundry')) }
}

export function furnaceAttention(state: GameState): AttentionFlags {
  return { spend: furnaceSpend(state), fresh: hasUnseen(state, contentKeys(state, 'furnace')) }
}

export function researchAttention(state: GameState): AttentionFlags {
  return { spend: researchSpend(state), fresh: hasUnseen(state, contentKeys(state, 'research')) }
}

export function processAttention(state: GameState): AttentionFlags {
  return { spend: processSpend(state), fresh: hasUnseen(state, contentKeys(state, 'process')) }
}

/** Bottom-nav Systems pip — Foundry plus Worker Drones, Furnace, Research, and Process once those doors are open. */
export function systemsTabAttention(state: GameState): AttentionFlags {
  const foundry = foundryAttention(state)
  const workers = isSystemUnlocked(state, 'network')
    ? networkAttention(state)
    : { spend: false, fresh: false }
  const furnace = isSystemUnlocked(state, 'furnace')
    ? furnaceAttention(state)
    : { spend: false, fresh: false }
  const research = isSystemUnlocked(state, 'research')
    ? researchAttention(state)
    : { spend: false, fresh: false }
  const process = isSystemUnlocked(state, 'process')
    ? processAttention(state)
    : { spend: false, fresh: false }
  return {
    spend: foundry.spend || workers.spend || furnace.spend || research.spend || process.spend,
    fresh: foundry.fresh || workers.fresh || furnace.fresh || research.fresh || process.fresh,
  }
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
  if (isSystemUnlocked(state, 'yard') && !(state.yard?.cells ?? []).some((cell) => cell.buildingId)) {
    return true
  }
  return listFarmableCores(state).some((print) => {
    if (state.shipyard.unlockedModules.includes(print.id)) return false
    return Boolean(blueprintProgress(state, print.id)?.complete)
  })
}

function furnaceSpend(state: GameState): boolean {
  if (!isSystemUnlocked(state, 'furnace')) return false
  return (state.resources.choirAsh ?? 0) >= ASH_PER_HEAT
}

function researchSpend(state: GameState): boolean {
  if (!isSystemUnlocked(state, 'research')) return false
  if (hiveResearchActive(state)) return false
  return Object.keys(HIVE_RESEARCH_NODES).some((id) => {
    const branch = id as keyof typeof HIVE_RESEARCH_NODES
    return hiveResearchCompleted(state, branch) < HIVE_RESEARCH_NODES[branch].length
  })
}

function processSpend(state: GameState): boolean {
  if (!isSystemUnlocked(state, 'process')) return false
  return processVisibleNodes(state).some((n) => canBuyProcessNode(state, n.id).ok)
}

export function moreStationAttention(state: GameState, id: TabId): AttentionFlags {
  if (!isSystemUnlocked(state, id)) return { spend: false, fresh: false }
  const fresh = hasUnseen(state, contentKeys(state, id))
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

function runUpgradeSpend(state: GameState): boolean {
  if (state.combat.docked) return false
  const best = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0, state.combat.wave ?? 1)
  for (const def of visibleRunUpgrades(best)) {
    const level = effectiveUpgradeLevel(state, def.id)
    if (level >= RUN_UPGRADE_CAP) continue
    if (runUpgradeCost(runPurchasedLevel(state, def.id)) <= (state.resources.salvage ?? 0)) return true
  }
  return false
}

export function tabAttention(state: GameState, tab: TabId): AttentionFlags {
  switch (tab) {
    case 'combat':
      return { spend: runUpgradeSpend(state), fresh: coresFresh(state) }
    case 'dock':
      return { spend: coresSpend(state), fresh: false }
    case 'network':
      return networkAttention(state)
    case 'foundry':
      return foundryAttention(state)
    case 'stats':
      return { spend: moreSpend(state), fresh: moreFresh(state) }
    case 'research':
      return researchAttention(state)
    case 'furnace':
      return furnaceAttention(state)
    case 'process':
      return processAttention(state)
    default:
      return { spend: false, fresh: false }
  }
}
