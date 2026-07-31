/** Act 1 spine, system gates, and onboarding tips. */

import type { GameState, TabId } from './types'

/** Waves fought to clear one sector (Advance or Hold). */
export const WAVES_PER_SECTOR = 5

/** Soft campaign climax — first Act 1 clear beat. */
export const ACT1_FINAL_SECTOR = 30

/** Prestige becomes available around mid–Act 1 once waves slow the climb. */
export const PRESTIGE_MIN_SECTOR = 8

export type SystemId = Exclude<TabId, 'combat' | 'shipyard' | 'stats'>

export interface SystemUnlockDef {
  id: SystemId
  /** Career highest sector cleared required (0 = always). */
  requiresSectorEver: number
  /** Optional research gate after the sector gate. */
  requiresResearch?: string
  label: string
  tip: string
}

/**
 * Whole systems unlock by career progress. Tabs stay visible with requirements.
 * Combat, Shipyard, and Stats are always available.
 */
export const SYSTEM_UNLOCKS: SystemUnlockDef[] = [
  {
    id: 'base',
    requiresSectorEver: 3,
    label: 'Base',
    tip: 'Worker drones manufacture over time. Assign them to named stations for production.',
  },
  {
    id: 'research',
    requiresSectorEver: 5,
    label: 'Research',
    tip: 'Spend Data on research. Alloy Smelting unlocks the Foundry station.',
  },
  {
    id: 'codex',
    requiresSectorEver: 5,
    requiresResearch: 'tactical-codex',
    label: 'Codex',
    tip: 'Enemy families remember soft counters. Fit modules to match the sector.',
  },
  {
    id: 'ai',
    requiresSectorEver: 8,
    label: 'AI',
    tip: 'Buy permanent automation / QoL, plus per-run combat doctrines.',
  },
  {
    id: 'prestige',
    requiresSectorEver: 5,
    label: 'Prestige',
    tip: 'Soft-reset from sector 8+ for Prestige Matter. Challenges open after your first prestige.',
  },
]

export function careerHighestSector(state: GameState): number {
  return Math.max(state.meta.highestSectorEver, state.combat.highestSector)
}

export function isSystemUnlocked(state: GameState, systemId: TabId): boolean {
  if (systemId === 'combat' || systemId === 'shipyard' || systemId === 'stats') {
    return true
  }
  const def = SYSTEM_UNLOCKS.find((s) => s.id === systemId)
  if (!def) return true
  if (careerHighestSector(state) < def.requiresSectorEver) return false
  if (def.requiresResearch && !state.research.unlocked.includes(def.requiresResearch)) {
    return false
  }
  return true
}

export function systemUnlockRequirement(systemId: TabId): string | null {
  if (systemId === 'combat' || systemId === 'shipyard' || systemId === 'stats') {
    return null
  }
  const def = SYSTEM_UNLOCKS.find((s) => s.id === systemId)
  if (!def) return null
  const parts: string[] = []
  if (def.requiresSectorEver > 0) {
    parts.push(`Clear sector ${def.requiresSectorEver}`)
  }
  if (def.requiresResearch) {
    parts.push(`Research ${def.requiresResearch}`)
  }
  return parts.join(' · ') || null
}

/** Grant Base starter drones the first time the system unlocks. */
export function maybeGrantSystemUnlocks(state: GameState): void {
  const ever = careerHighestSector(state)
  if (ever > state.meta.highestSectorEver) {
    state.meta.highestSectorEver = ever
  }

  if (
    ever >= 3 &&
    !state.meta.seenOnboarding.includes('base-unlock') &&
    state.base.workerDrones < 2
  ) {
    state.base.workerDrones = Math.max(state.base.workerDrones, 2)
  }

  if (ever >= ACT1_FINAL_SECTOR && !state.meta.act1Cleared) {
    state.meta.act1Cleared = true
    state.combat.log = [
      `Act 1 complete — sector ${ACT1_FINAL_SECTOR} cleared. Prestige and challenges are the long game.`,
      ...state.combat.log,
    ].slice(0, 40)
  }
}

export function pendingOnboardingTip(state: GameState): SystemUnlockDef | null {
  for (const def of SYSTEM_UNLOCKS) {
    if (!isSystemUnlocked(state, def.id)) continue
    const tipId = `${def.id}-unlock`
    if (state.meta.seenOnboarding.includes(tipId)) continue
    return def
  }
  if (
    state.shipyard.frameLocked === false &&
    state.combat.docked &&
    !state.meta.seenOnboarding.includes('launch-lock')
  ) {
    return {
      id: 'base',
      requiresSectorEver: 0,
      label: 'Launch',
      tip: 'Dock → pick a frame in Shipyard → Launch locks that frame for the run. Modules can still be refit while Docked.',
    }
  }
  return null
}

export function acknowledgeOnboarding(state: GameState, tipId: string): GameState {
  if (state.meta.seenOnboarding.includes(tipId)) return state
  const next = structuredClone(state)
  next.meta.seenOnboarding = [...next.meta.seenOnboarding, tipId]
  return next
}

export function onboardingTipId(def: SystemUnlockDef): string {
  if (def.label === 'Launch') return 'launch-lock'
  return `${def.id}-unlock`
}
