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
import { foundryAttention, furnaceAttention, networkAttention, type AttentionFlags } from './hubAttention'
import { isSystemUnlocked } from './progression'
import type { GameState, TabId } from './types'

export type SystemsHubId = Extract<TabId, 'foundry' | 'network' | 'furnace'>

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
      const name = id === 'weapons' ? 'Weapons' : id === 'shielding' ? 'Ward' : 'Yield'
      return `${name} ${lv === 1 ? 'I' : lv === 2 ? 'II' : 'III'}`
    })
    .filter((line): line is string => Boolean(line))
  if (lit[0]) lines.push(lit[0])
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
  if (isSystemUnlocked(state, 'network')) {
    cards.push(card('network', 'Worker Drones', workersHubStatus(state), networkAttention(state)))
  }
  if (isSystemUnlocked(state, 'furnace')) {
    cards.push(card('furnace', 'Furnace', furnaceHubStatus(state), furnaceAttention(state)))
  }
  return cards
}
