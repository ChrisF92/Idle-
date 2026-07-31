/** Lightweight cheats for local / ?dev=1 testing. Never required for normal play. */

import type { GameState, Resources } from './types'
import { SHIP_FRAMES, SHIP_MODULES } from './catalog'
import { maybeGrantSystemUnlocks } from './progression'
import { syncPersistedHullCaps } from './state'

export const DEV_FLAG_KEY = 'cosmic-idle-dev'

export function isDevToolsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.has('dev')) {
      localStorage.setItem(DEV_FLAG_KEY, '1')
    }
    if (params.get('dev') === '0') {
      localStorage.removeItem(DEV_FLAG_KEY)
      return false
    }
  } catch {
    // ignore
  }
  if (import.meta.env.DEV) return true
  try {
    return localStorage.getItem(DEV_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

export type DevAction =
  | { type: 'jump-sector'; sector: number }
  | { type: 'add-resources'; amounts: Partial<Resources> }
  | { type: 'unlock-catalog' }
  | { type: 'clear-guides' }
  | { type: 'set-prestige-count'; count: number }
  | { type: 'fill-workers'; count: number }
  | { type: 'dock-heal' }

export function applyDevAction(state: GameState, action: DevAction): GameState {
  const next = structuredClone(state)

  switch (action.type) {
    case 'jump-sector': {
      const sector = Math.max(1, Math.floor(action.sector))
      next.combat.sector = sector
      next.combat.highestSector = Math.max(next.combat.highestSector, sector - 1)
      next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, sector - 1)
      maybeGrantSystemUnlocks(next)
      next.combat.log = [`[dev] Jumped to sector ${sector}.`, ...next.combat.log].slice(0, 40)
      break
    }
    case 'add-resources': {
      for (const [key, amount] of Object.entries(action.amounts)) {
        const k = key as keyof Resources
        next.resources[k] = (next.resources[k] ?? 0) + (amount ?? 0)
      }
      next.combat.log = ['[dev] Resources granted.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'unlock-catalog': {
      next.shipyard.unlockedFrames = SHIP_FRAMES.map((f) => f.id)
      next.shipyard.unlockedModules = SHIP_MODULES.map((m) => m.id)
      next.research.unlocked = [
        ...new Set([
          ...next.research.unlocked,
          'basic-optics',
          'alloy-smelting',
          'drone-logistics',
          'tactical-codex',
          'entity-anatomy',
          'boss-harvester',
        ]),
      ]
      next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, 30)
      next.combat.highestSector = Math.max(next.combat.highestSector, 30)
      maybeGrantSystemUnlocks(next)
      next.combat.log = ['[dev] Catalog unlocked.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'clear-guides': {
      next.meta.seenOnboarding = []
      next.combat.log = ['[dev] Onboarding guides reset.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'set-prestige-count': {
      next.prestige.prestigeCount = Math.max(0, Math.floor(action.count))
      next.combat.log = [
        `[dev] Prestige count = ${next.prestige.prestigeCount}.`,
        ...next.combat.log,
      ].slice(0, 40)
      break
    }
    case 'fill-workers': {
      const n = Math.max(0, Math.floor(action.count))
      next.base.workerDrones = Math.max(next.base.workerDrones, n)
      // Ensure Base gate so stations are usable after jump testing.
      next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, 3)
      maybeGrantSystemUnlocks(next)
      next.combat.log = [`[dev] Worker drones ≥ ${n}.`, ...next.combat.log].slice(0, 40)
      break
    }
    case 'dock-heal': {
      next.combat.docked = true
      next.combat.inFight = false
      next.combat.enemyUnits = []
      next.combat.playerUnits = []
      next.combat.projectiles = []
      next.combat.fx = []
      syncPersistedHullCaps(next)
      next.combat.playerHull = next.combat.playerHullMax
      next.combat.playerShield = next.combat.playerShieldMax
      next.combat.log = ['[dev] Docked and repaired.', ...next.combat.log].slice(0, 40)
      break
    }
    default:
      break
  }

  return next
}
