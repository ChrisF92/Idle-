/** Systems hub status cards (GDD §120). Only unlocked industrial systems appear. */

import {
  assignedWorkers,
  blueprintProgress,
  droneCap,
  getModule,
  idleWorkers,
  PART_TYPES,
} from './catalog'
import { FOUNDRY_RECIPES, foundryRecipeLevel } from './foundry'
import {
  formatResearchDuration,
  hiveResearchActive,
  hiveResearchActiveNode,
  hiveResearchCompleted,
  hiveResearchNodeCost,
  hiveResearchSpeed,
  hiveResearchXp,
} from './hiveResearch'
import { firstAffordableProcessNode, processAvailable, processConfig } from './process'
import { workerAllocationSummary } from './workers'
import { foundryAttention, furnaceAttention, processAttention, researchAttention, type AttentionFlags } from './hubAttention'
import { isSystemUnlocked } from './progression'
import type { GameState, TabId } from './types'

export type SystemsHubId = Extract<TabId, 'foundry' | 'network' | 'furnace' | 'research' | 'process'>

export interface SystemsHubCard {
  id: SystemsHubId
  name: string
  status: string[]
  spend: boolean
  fresh: boolean
}

export function showSystemsHub(state: GameState): boolean {
  return isSystemUnlocked(state, 'network')
}

function recipeName(id: string): string {
  return FOUNDRY_RECIPES.find((recipe) => recipe.id === id)?.name ?? id
}

function printFragmentPct(state: GameState, moduleId: string): number | null {
  const progress = blueprintProgress(state, moduleId)
  if (!progress) return null
  const owned = PART_TYPES.reduce((sum, part) => sum + progress.owned[part], 0)
  const need = PART_TYPES.reduce((sum, part) => sum + progress.need[part], 0)
  if (need <= 0) return 100
  return Math.min(100, Math.round((owned / need) * 100))
}

export function foundryHubStatus(state: GameState): string[] {
  const lines: string[] = []
  let top: { name: string; level: number } | null = null
  for (const recipe of FOUNDRY_RECIPES) {
    const level = foundryRecipeLevel(state, recipe.id)
    if (level <= 0) continue
    if (!top || level > top.level) top = { name: recipe.name, level }
  }
  if (top) lines.push(`${top.name} Mastery ${top.level}`)

  const running = state.foundry.slots.filter((slot) => slot.recipeId)
  if (running.length === 0) {
    const idle = state.foundry.slots.length
    lines.push(idle <= 1 ? 'Smelter idle' : `${idle} smelters idle`)
  } else {
    for (const slot of running.slice(0, 2)) {
      const pct = Math.round((slot.progress ?? 0) * 100)
      lines.push(`${recipeName(slot.recipeId ?? '')}: ${pct}%`)
    }
  }

  const tracked = state.foundry.trackedPrintId
  if (tracked) {
    const name = getModule(tracked)?.name ?? 'Print'
    const pct = printFragmentPct(state, tracked)
    lines.push(pct == null ? `Tracking ${name}` : `${name}: ${pct}%`)
  }

  const workers = workerAllocationSummary(state).foundry
  if (workers > 0) lines.push(`${workers} workers`)
  return lines.slice(0, 3)
}

export function workersHubStatus(state: GameState): string[] {
  const cap = droneCap(state)
  const assigned = assignedWorkers(state.base.assignments)
  const idle = idleWorkers(state)
  const lines = [`${assigned} / ${cap} assigned`]
  if (idle > 0) lines.push(`${idle} idle`)
  return lines
}

export function furnaceHubStatus(state: GameState): string[] {
  const ash = Math.floor(state.resources.choirAsh ?? 0)
  const heat = Math.floor(state.resources.heat ?? 0)
  const lines = [`Ash ${ash}`, `Heat ${heat}`]
  const lit = (['weapons', 'shielding', 'recovery'] as const)
    .map((id) => {
      const lv = Math.max(0, Math.floor(state.furnace?.active?.[id] ?? 0))
      if (lv <= 0) return null
      const name = id === 'weapons' ? 'Weapons' : id === 'shielding' ? 'Shielding' : 'Recovery'
      return `${name} ${lv === 1 ? 'I' : lv === 2 ? 'II' : 'III'}`
    })
    .filter((line): line is string => Boolean(line))
  if (lit[0]) lines.push(lit[0])
  return lines.slice(0, 3)
}

export function researchHubStatus(state: GameState): string[] {
  if (!hiveResearchActive(state)) return ['No project']
  const node = hiveResearchActiveNode(state)
  const branch = state.hiveResearch?.focus ?? 'energy'
  const done = hiveResearchCompleted(state, branch)
  const need = hiveResearchNodeCost(done, state)
  const xp = hiveResearchXp(state, branch)
  const speed = hiveResearchSpeed(state)
  const left = speed > 0 ? Math.max(0, (need - xp) / speed) : 0
  const pct = need > 0 ? Math.min(100, Math.round((100 * xp) / need)) : 0
  const lines = [node?.name ?? 'Researching', `${pct}%`]
  if (left > 0) lines.push(`${formatResearchDuration(left)} left`)
  const workers = workerAllocationSummary(state).research
  if (workers > 0) lines.push(`${workers} workers`)
  return lines.slice(0, 3)
}

export function processHubStatus(state: GameState): string[] {
  const bought = state.process?.purchased?.length ?? 0
  const cfg = processConfig(state)
  let running = 0
  if (cfg.core.enabled) running += 1
  if (cfg.network.enabled) running += 1
  if (cfg.foundry.autoBuy) running += 1
  if (cfg.reliquary.autoEquip || cfg.reliquary.autoMerge) running += 1
  if (cfg.furnace.autoFeed || cfg.furnace.autoChannel) running += 1
  if (cfg.research.autoResearch) running += 1
  const next = firstAffordableProcessNode(state)
  const lines =
    bought > 0 && running > 0 ? [`${running} automations active`] : [`${bought} capabilities`]
  if (processAvailable(state) > 0) lines.push(`${Math.floor(processAvailable(state))} Process Points available`)
  else if (next) lines.push(`Next: ${next.name}`)
  else if (running <= 0) lines.push('No purchase yet')
  return lines.slice(0, 3)
}

function card(
  id: SystemsHubId,
  name: string,
  status: string[],
  flags: AttentionFlags,
): SystemsHubCard {
  return { id, name, status, spend: flags.spend, fresh: flags.fresh }
}

export function systemsHubCards(state: GameState): SystemsHubCard[] {
  const cards: SystemsHubCard[] = []
  if (isSystemUnlocked(state, 'foundry')) {
    cards.push(card('foundry', 'Foundry', foundryHubStatus(state), foundryAttention(state)))
  }
  if (isSystemUnlocked(state, 'furnace')) {
    cards.push(card('furnace', 'Furnace', furnaceHubStatus(state), furnaceAttention(state)))
  }
  if (isSystemUnlocked(state, 'research')) {
    cards.push(card('research', 'Research', researchHubStatus(state), researchAttention(state)))
  }
  if (isSystemUnlocked(state, 'process')) {
    cards.push(card('process', 'Process', processHubStatus(state), processAttention(state)))
  }
  return cards
}
