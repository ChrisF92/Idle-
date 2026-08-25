/** Contextual player guidance helpers — next-step hints, reset lists, save migration. */

import { idleWorkers } from './catalog'
import { practicedCoreWork } from './corePractice'
import { foundryRecipeLevel } from './foundry'
import { prestigeGainFor } from './actions'
import { firstAffordableProcessNode } from './process'
import { isSystemUnlocked } from './progression'
import { isEstablishedCareer, migrateOnboardingRegistry, ONBOARDING_LESSON_IDS } from './onboarding'
import type { GameState } from './types'

export { isEstablishedCareer }

export const BEGINNER_GUIDE_IDS = ONBOARDING_LESSON_IDS

export function migrateOnboardingState(state: GameState): void {
  migrateOnboardingRegistry(state)
}

export interface ConsequenceLists {
  gain: string[]
  keep: string[]
  reset: string[]
  change: string[]
}

export function rebuildConsequenceLists(state: GameState): ConsequenceLists {
  const gain = [
    `+${prestigeGainFor(state)} Rebuild Matter`,
    'Rebuild trades current-cycle development for permanent growth.',
  ]
  const keep: string[] = [
    'Career Best Wave',
    'Unlocked systems',
    'Hive Frames and Core unlocks',
    'Core Mastery',
    'Rebuild Matter',
    'Long-term statistics',
  ]
  const reset = [
    'Current Sortie',
    'Salvage',
    'Run upgrades',
    'Directives',
    'Scrap',
    'Workshop',
  ]
  const change: string[] = []

  if (isSystemUnlocked(state, 'foundry')) {
    keep.push('Foundry recipes, stock, and facilities')
  }
  if (isSystemUnlocked(state, 'reliquary')) keep.push('Relics')
  if (isSystemUnlocked(state, 'research')) keep.push('Research')
  if (isSystemUnlocked(state, 'furnace')) {
    reset.push('Ash', 'Heat')
  } else {
    reset.push('Heat')
  }
  if (isSystemUnlocked(state, 'process')) keep.push('Process')
  if (isSystemUnlocked(state, 'yard')) keep.push('Foundry construction')
  if (isSystemUnlocked(state, 'protocols')) keep.push('Challenge ranks')

  return { gain, keep, reset, change }
}

export function reinforceConsequenceLists(state: GameState): ConsequenceLists {
  const lists = rebuildConsequenceLists(state)
  const gain = [
    `+${Math.max(1, Math.floor(prestigeGainFor(state) * 0.5))} Rebuild Matter`,
    'Future Rebuild kits grow',
    'The starting architecture of the Hive and the loop itself begins to shift',
  ]
  return {
    gain,
    keep: lists.keep,
    reset: lists.reset,
    change: ['Rebuild is no longer the top of the ladder', ...lists.change],
  }
}

export function protocolStartLists(def: { reward: string }): ConsequenceLists {
  return {
    gain: [def.reward],
    keep: ['Foundry', 'Relics', 'Research', 'Process', 'Challenge ranks'],
    reset: ['Salvage', 'Run upgrades', 'Network bar levels', 'Current sortie'],
    change: [],
  }
}

export function isFirstDefeatReport(state: GameState): boolean {
  if (isEstablishedCareer(state)) return false
  if ((state.prestige.prestigeCount ?? 0) > 0) return false
  return practicedCoreWork(state) < 1
}

export function sortieNextHints(state: GameState): string[] {
  if (isFirstDefeatReport(state)) return []
  const items: string[] = []
  const idle = idleWorkers(state)

  if (isSystemUnlocked(state, 'network') && idle > 0) {
    items.push(`${idle} drone${idle === 1 ? '' : 's'} idle — assign under Systems`)
  }
  items.push('Spend Salvage on Cores or global upgrades next Sortie')
  if (isSystemUnlocked(state, 'network') && (state.base.assignments['scrap-field'] ?? 0) === 0) {
    items.push('Assign Worker Drones under Systems')
  }
  if (isSystemUnlocked(state, 'research') && !state.hiveResearch?.active) {
    items.push('Start a Research project')
  }
  if (isSystemUnlocked(state, 'furnace') && (state.furnace?.wanted.shielding ?? 0) <= 0) {
    items.push('Spend Heat on Shielding')
  }
  if (isSystemUnlocked(state, 'foundry')) {
    const slag = foundryRecipeLevel(state, 'slag-ingot')
    const queued = state.foundry.slots.some((s) => s.recipeId === 'slag-ingot')
    if (slag < 2 && !queued) items.push('Start a Foundry craft')
  }
  if (isSystemUnlocked(state, 'process') && firstAffordableProcessNode(state)) {
    items.push('Buy a Process automation')
  }
  return items.slice(0, 3)
}

export function processCoreHintReady(state: GameState): boolean {
  void state
  return false
}
