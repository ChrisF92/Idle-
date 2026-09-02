/** Contextual player guidance helpers — next-step hints, reset lists, save migration. */

import { idleWorkers } from './catalog'
import { practicedCoreWork } from './corePractice'
import { firstAffordableProcessNode } from './process'
import { isSystemUnlocked } from './progression'
import { isEstablishedCareer, migrateOnboardingRegistry, ONBOARDING_LESSON_IDS } from './onboarding'
import { matterGainFor, REBUILD_KEEPS, REBUILD_RESETS } from './rebuild'
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
    `+${matterGainFor(state)} Rebuild Matter`,
    'Rebuild trades current-cycle development for permanent growth.',
  ]
  const keep: string[] = [...REBUILD_KEEPS]
  const reset = [...REBUILD_RESETS]
  const change: string[] = []

  if (isSystemUnlocked(state, 'foundry')) {
    keep.push('Foundry recipes, stock, and facilities')
  }
  if (isSystemUnlocked(state, 'reliquary')) keep.push('Relics')
  if (isSystemUnlocked(state, 'research')) keep.push('Research')
  if (isSystemUnlocked(state, 'process')) keep.push('Process')
  if (isSystemUnlocked(state, 'challenges')) keep.push('Challenge ranks')

  return { gain, keep, reset, change }
}

export function challengeStartLists(def: { reward: string }): ConsequenceLists {
  return {
    gain: [def.reward],
    keep: ['Foundry', 'Relics', 'Research', 'Process', 'Challenge medals'],
    reset: ['Salvage', 'temporary upgrades', 'Directives', 'Heat', 'current Sortie'],
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
  items.push('Spend Salvage on Attack, Defense, or Economy upgrades next Sortie')
  if (isSystemUnlocked(state, 'network') && (state.base.assignments['scrap-field'] ?? 0) === 0) {
    items.push('Assign Worker Drones under Systems')
  }
  if (isSystemUnlocked(state, 'research') && !state.hiveResearch?.active) {
    items.push('Start a Research project')
  }
  if (isSystemUnlocked(state, 'furnace') && !state.furnace.ignited) {
    items.push('Convert Ash and Ignite the Furnace during a live Sortie')
  }
  if (isSystemUnlocked(state, 'foundry')) {
    const queued = state.foundry.slots.some((s) => s.recipeId === 'recovered-stock')
    if (!queued) items.push('Start a Foundry craft')
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
