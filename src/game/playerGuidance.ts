/** Contextual player guidance helpers — next-step hints, reset lists, save migration. */

import { idleWorkers } from './catalog'
import { practicedCoreWork } from './corePractice'
import { foundryMaterialCount, foundryRecipeLevel } from './foundry'
import { prestigeGainFor } from './actions'
import { firstAffordableProcessNode } from './process'
import { isSystemUnlocked } from './progression'
import type { GameState } from './types'

export interface ConsequenceLists {
  gain: string[]
  keep: string[]
  reset: string[]
  change: string[]
}

const LEGACY_TOUR_MARKERS = [
  'guide-drone-cap',
  'guide-network-make',
  'guide-foundry-what',
  'guide-furnace-v2-ash',
  'guide-research-xp',
  'guide-process-v2-what',
  'guide-protocol-restrict',
  'guide-reliquary-slots',
  'guide-prestige-hangar',
] as const

const LEGACY_TO_CURRENT: Record<string, string> = {
  'guide-shipyard-tab': 'guide-launch',
  'guide-frame-select': 'guide-launch',
  'guide-sortie-field': 'guide-salvage-first',
  'guide-sortie-guns': 'guide-salvage-first',
  'guide-sortie-hull': 'guide-salvage-first',
  'guide-sortie-fire': 'guide-salvage-first',
  'guide-sortie-salvage': 'guide-salvage-first',
  'guide-salvage-lesson': 'guide-salvage-first',
  'guide-cores-sheet': 'guide-salvage-first',
  'guide-upgrade-pulse': 'guide-salvage-first',
  'guide-upgrade-plate': 'guide-salvage-first',
  'guide-core-run': 'guide-salvage-first',
  'guide-cores-inspect': 'guide-workshop',
  'guide-cores-persist': 'guide-workshop',
  'guide-core-mastery': 'guide-workshop',
  'guide-relaunch-upgraded': 'guide-second-sortie',
  'guide-relaunch': 'guide-second-sortie',
  'guide-drone-cap': 'guide-network-strike',
  'guide-network-make': 'guide-network-strike',
  'guide-network-assign': 'guide-network-strike',
  'guide-network-ward': 'guide-network-strike',
  'guide-foundry': 'guide-foundry-recipe',
  'guide-foundry-smelt': 'guide-foundry-recipe',
  'guide-foundry-what': 'guide-foundry-recipe',
  'guide-furnace': 'guide-furnace-light',
  'guide-furnace-v2-ash': 'guide-furnace-light',
  'guide-furnace-v2-activate': 'guide-furnace-light',
  'guide-research-tab': 'guide-research-focus',
  'guide-research-xp': 'guide-research-focus',
  'guide-research-focus-how': 'guide-research-focus',
}

/** First-run overlay ids. Established careers skip these on load. */
export const BEGINNER_GUIDE_IDS = [
  'guide-launch',
  'guide-salvage-first',
  'guide-defense',
  'guide-workshop',
  'guide-second-sortie',
  'guide-network-strike',
  'guide-foundry-recipe',
  'guide-foundry-mastery',
  'guide-furnace-light',
  'guide-research-focus',
  'guide-process-first',
  'guide-relic-install',
  'guide-directive',
  'guide-challenge',
] as const

export function isEstablishedCareer(state: GameState): boolean {
  if ((state.prestige.prestigeCount ?? 0) > 0) return true
  if ((state.meta.ascensionCount ?? 0) > 0) return true
  if ((state.meta.highestSectorEver ?? 0) >= 5) return true
  const seen = state.meta.seenOnboarding ?? []
  if (seen.length >= 15) return true
  if (seen.some((id) => (LEGACY_TOUR_MARKERS as readonly string[]).includes(id))) return true
  return practicedCoreWork(state) >= 4
}

export function migrateOnboardingState(state: GameState): void {
  const seen = new Set(state.meta.seenOnboarding ?? [])
  for (const [legacy, current] of Object.entries(LEGACY_TO_CURRENT)) {
    if (seen.has(legacy)) seen.add(current)
  }
  if (!isEstablishedCareer(state)) {
    state.meta.seenOnboarding = [...seen]
    return
  }
  for (const id of BEGINNER_GUIDE_IDS) seen.add(id)
  if ((state.base.assignments.strike ?? 0) > 0 || (state.base.assignments['scrap-field'] ?? 0) > 0) {
    seen.add('guide-network-strike')
    seen.add('guide-network-ward')
  }
  if (foundryRecipeLevel(state, 'slag-ingot') > 0 || foundryMaterialCount(state, 'slag-ingot') > 0) {
    seen.add('guide-foundry-recipe')
    seen.add('guide-foundry-mastery')
  }
  if (Object.values(state.furnace?.wanted ?? {}).some((lv) => lv > 0)) {
    seen.add('guide-furnace-light')
  }
  const hive = state.hiveResearch
  if (
    hive &&
    (hive.active ||
      (hive.completedIds?.length ?? 0) > 0 ||
      Object.values(hive.xp ?? {}).some((n) => n > 0) ||
      Object.values(hive.completed ?? {}).some((n) => n > 0))
  ) {
    seen.add('guide-research-focus')
  }
  state.meta.seenOnboarding = [...seen]
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
    'Core Levels',
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
    reset: ['Salvage', 'Run upgrades', 'Current sortie'],
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
  if (isSystemUnlocked(state, 'furnace') && (state.furnace?.wanted.shielding ?? 0) <= 0) {
    items.push('Spend Heat on Ward')
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
