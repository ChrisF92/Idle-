/** Systems hub status cards (GDD §120). Foundry is the parent industrial card. */

import {
  fabricationJobLabel,
  FOUNDRY_RECIPES,
  foundryFabSlotCount,
  foundrySlotCount,
} from './foundry'
import {
  formatResearchDuration,
  hiveResearchActive,
  hiveResearchActiveNode,
  hiveResearchHubIntel,
  hiveResearchNodeDuration,
  hiveResearchNodeEffectLine,
  hiveResearchProgress,
  hiveResearchRemaining,
  hiveResearchSpeed,
} from './hiveResearch'
import { firstAffordableProcessNode, processActiveAutomationCount, processAvailable } from './process'
import { workerAllocationSummary } from './workers'
import { foundryAttention, furnaceAttention, processAttention, researchAttention, type AttentionFlags } from './hubAttention'
import { isSystemUnlocked } from './progression'
import type { GameState, TabId } from './types'
import { droneCap } from './catalog'
import { furnaceLitLine } from './furnace'

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

export function foundryHubStatus(state: GameState): string[] {
  const workers = workerAllocationSummary(state)
  const foundryWorkers =
    (workers.jobs['alloy-foundry'] ?? 0) +
    (workers.jobs['fab-bay'] ?? 0) +
    (workers.jobs.construction ?? 0)
  const running = state.foundry.slots.filter((slot) => slot.recipeId)
  const processors = `Processors ${running.length}/${foundrySlotCount(state)}`
  const fab = (state.foundry.fabrication ?? []).find((slot) => slot.kind)
  const activeFabricators = state.foundry.fabrication.filter((slot) => slot.kind).length
  const fabricators = `Fabricators ${activeFabricators}/${foundryFabSlotCount(state)}`
  const summaries: string[] = []
  if (running[0]) {
    const slot = running[0]
    const pct = Math.round((slot.progress ?? 0) * 100)
    summaries.push(`Processing ${recipeName(slot.recipeId ?? '')} ${pct}%`)
  }
  if (fab) {
    const pct = Math.round((fab.progress ?? 0) * 100)
    const name = fabricationJobLabel(state, fab)
    summaries.push(fab.complete ? `${name} ready` : `Fabricating ${name} ${pct}%`)
  }
  return [
    `${foundryWorkers} Foundry worker${foundryWorkers === 1 ? '' : 's'}`,
    `${processors} · ${fabricators}`,
    summaries.join(' · ') || 'Foundry idle',
  ]
}

export function workersHubStatus(state: GameState): string[] {
  const summary = workerAllocationSummary(state)
  return [`${summary.assigned} assigned · ${summary.idle} idle · capacity ${droneCap(state)}`]
}

export function furnaceHubStatus(state: GameState): string[] {
  const ash = Math.floor(state.resources.choirAsh ?? 0)
  const heat = Math.floor(state.resources.heat ?? 0)
  return [`Ash ${ash}`, `Heat ${heat}`, furnaceLitLine(state)]
}

export function researchHubStatus(state: GameState): string[] {
  if (!hiveResearchActive(state)) return ['No project']
  const node = hiveResearchActiveNode(state)
  const need = node ? hiveResearchNodeDuration(node, state) : 0
  const xp = hiveResearchProgress(state)
  const speed = hiveResearchSpeed(state)
  const left = speed > 0 ? hiveResearchRemaining(state) / speed : 0
  const pct = need > 0 ? Math.min(100, Math.round((100 * xp) / need)) : 0
  const lines = [node?.name ?? 'Researching', `${pct}%`]
  if (left > 0) lines.push(`${formatResearchDuration(left)} left`)
  if (hiveResearchHubIntel(state) && node) {
    const effect = hiveResearchNodeEffectLine(node)
    if (effect) lines.splice(1, 0, effect)
  }
  const workers = workerAllocationSummary(state).jobs['sensor-net'] ?? 0
  if (workers > 0) lines.push(`${workers} workers`)
  return lines.slice(0, 3)
}

export function processHubStatus(state: GameState): string[] {
  const bought = state.process?.purchased?.length ?? 0
  const running = processActiveAutomationCount(state)
  const next = firstAffordableProcessNode(state)
  const lines = [`${bought} capabilities`]
  if (running > 0) lines.push(`${running} automations`)
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
