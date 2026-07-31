/** Lightweight cheats for local / ?dev=1 testing. Never required for normal play. */

import type { GameState, Resources } from './types'
import { AI_NODES, RESEARCH, SHIP_FRAMES, SHIP_MODULES } from './catalog'
import {
  ACHIEVEMENTS,
  maybeGrantSystemUnlocks,
  tryCompleteAchievements,
} from './progression'
import { syncPersistedHullCaps } from './state'
import { enemyForSector } from './combat'

export const DEV_FLAG_KEY = 'cosmic-idle-dev'

export function isDevToolsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.has('dev')) {
      if (params.get('dev') === '0') {
        localStorage.removeItem(DEV_FLAG_KEY)
        return false
      }
      localStorage.setItem(DEV_FLAG_KEY, '1')
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

export function setDevToolsEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(DEV_FLAG_KEY, '1')
    else localStorage.removeItem(DEV_FLAG_KEY)
  } catch {
    // ignore
  }
}

export type DevAction =
  | { type: 'jump-sector'; sector: number }
  | { type: 'add-resources'; amounts: Partial<Resources> }
  | { type: 'unlock-catalog' }
  | { type: 'clear-guides' }
  | { type: 'set-prestige-count'; count: number }
  | { type: 'fill-workers'; count: number }
  | { type: 'fill-combat-drones'; count: number }
  | { type: 'dock-heal' }
  | { type: 'force-boss-wave' }
  | { type: 'grant-achievements' }
  | { type: 'skip-guides' }
  | { type: 'set-wave'; wave: number }

export function applyDevAction(state: GameState, action: DevAction): GameState {
  const next = structuredClone(state)

  switch (action.type) {
    case 'jump-sector': {
      const sector = Math.max(1, Math.floor(action.sector))
      next.combat.sector = sector
      next.combat.wave = 1
      next.combat.highestSector = Math.max(next.combat.highestSector, sector - 1)
      next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, sector - 1)
      maybeGrantSystemUnlocks(next)
      tryCompleteAchievements(next)
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
      next.research.unlocked = [...new Set([...next.research.unlocked, ...RESEARCH.map((r) => r.id)])]
      next.ai.purchased = [
        ...new Set([
          ...next.ai.purchased,
          ...AI_NODES.filter((n) => n.permanent).map((n) => n.id),
        ]),
      ]
      next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, 30)
      next.combat.highestSector = Math.max(next.combat.highestSector, 30)
      maybeGrantSystemUnlocks(next)
      tryCompleteAchievements(next)
      next.combat.log = ['[dev] Catalog unlocked.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'clear-guides': {
      next.meta.seenOnboarding = []
      next.combat.log = ['[dev] Onboarding guides reset.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'skip-guides': {
      // Mark every known guide id as seen so spotlights stop.
      const ids = [
        'guide-shipyard-tab',
        'guide-frame-select',
        'guide-launch',
        'guide-base-tab',
        'guide-assign-scrap',
        'guide-research-tab',
        'guide-prestige-tab',
        'guide-prestige-ready',
        'guide-ai-tab',
        'guide-achievements',
        'base-unlock',
      ]
      next.meta.seenOnboarding = [...new Set([...next.meta.seenOnboarding, ...ids])]
      next.combat.log = ['[dev] Guides skipped.', ...next.combat.log].slice(0, 40)
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
      next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, 3)
      maybeGrantSystemUnlocks(next)
      next.combat.log = [`[dev] Worker drones ≥ ${n}.`, ...next.combat.log].slice(0, 40)
      break
    }
    case 'fill-combat-drones': {
      const n = Math.max(0, Math.floor(action.count))
      next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, 20)
      next.meta.combatDronesUnlocked = true
      next.base.combatDrones = Math.max(next.base.combatDrones, n)
      maybeGrantSystemUnlocks(next)
      next.combat.log = [`[dev] Combat drones ≥ ${n}.`, ...next.combat.log].slice(0, 40)
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
    case 'force-boss-wave': {
      // Jump to a boss sector final wave and undock so combat can engage.
      const sector = Math.max(5, Math.ceil(next.combat.sector / 5) * 5)
      next.combat.sector = sector
      next.combat.wave = 5
      next.combat.highestSector = Math.max(next.combat.highestSector, sector - 1)
      next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, sector - 1)
      next.combat.docked = false
      next.combat.inFight = false
      next.combat.enemyUnits = []
      next.combat.playerUnits = []
      next.combat.projectiles = []
      next.combat.fx = []
      const enc = enemyForSector(sector, 5)
      next.combat.log = [
        `[dev] Forced boss setup — sector ${sector} W5 (${enc.name}).`,
        ...next.combat.log,
      ].slice(0, 40)
      maybeGrantSystemUnlocks(next)
      break
    }
    case 'grant-achievements': {
      next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, 30)
      next.combat.highestSector = Math.max(next.combat.highestSector, 30)
      next.research.unlocked = [...new Set([...next.research.unlocked, 'basic-optics'])]
      if (next.prestige.prestigeCount < 1) next.prestige.prestigeCount = 1
      next.ai.purchased = [...new Set([...next.ai.purchased, 'auto-engage'])]
      tryCompleteAchievements(next)
      // Force-complete any still locked (e.g. act1 already flagged).
      for (const def of ACHIEVEMENTS) {
        if (!next.meta.completedAchievements.includes(def.id)) {
          next.meta.completedAchievements = [...next.meta.completedAchievements, def.id]
          next.resources.aiPoints += def.rewardAiPoints
        }
      }
      next.meta.aiUnlocked = true
      next.meta.act1Cleared = true
      next.combat.log = ['[dev] All achievements granted.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'set-wave': {
      next.combat.wave = Math.max(1, Math.min(5, Math.floor(action.wave)))
      next.combat.inFight = false
      next.combat.enemyUnits = []
      next.combat.log = [`[dev] Wave set to ${next.combat.wave}.`, ...next.combat.log].slice(
        0,
        40,
      )
      break
    }
    default:
      break
  }

  return next
}
