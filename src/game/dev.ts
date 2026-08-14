/** Lightweight cheats for local / ?dev=1 testing. Never required for normal play. */

import type { GameState, Resources, YardGoodId } from './types'
import { AI_NODES, MAX_MODULE_LEVEL, RESEARCH, SHIP_FRAMES, SHIP_MODULES } from './catalog'
import {
  ACHIEVEMENTS,
  GUIDE_STEPS,
  maybeGrantSystemUnlocks,
  tryCompleteAchievements,
} from './progression'
import { syncPersistedHullCaps } from './state'
import { enemyForSector } from './combat'
import { wavesForRun, createEmptyEchoState } from './echo'
import { wavesForSector } from './sectors'
import { ensureYardGrid } from './yard'

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
  | { type: 'add-yard-goods'; amounts: Partial<Record<YardGoodId, number>> }
  | { type: 'unlock-catalog' }
  | { type: 'clear-guides' }
  | { type: 'set-prestige-count'; count: number }
  | { type: 'fill-workers'; count: number }
  | { type: 'dock-heal' }
  | { type: 'force-boss-wave' }
  | { type: 'grant-achievements' }
  | { type: 'skip-guides' }
  | { type: 'set-wave'; wave: number }
  | { type: 'set-module-levels'; levels: Record<string, number> }
  | { type: 'seed-late-game' }

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
    case 'add-yard-goods': {
      ensureYardGrid(next)
      for (const [key, amount] of Object.entries(action.amounts)) {
        const k = key as YardGoodId
        next.yard.goods[k] = (next.yard.goods[k] ?? 0) + (amount ?? 0)
      }
      next.combat.log = ['[dev] Yard goods granted.', ...next.combat.log].slice(0, 40)
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
      next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, 80)
      next.combat.highestSector = Math.max(next.combat.highestSector, 80)
      maybeGrantSystemUnlocks(next)
      tryCompleteAchievements(next)
      next.combat.log = ['[dev] Catalog unlocked through sector 80.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'clear-guides': {
      next.meta.seenOnboarding = []
      next.combat.log = ['[dev] Onboarding guides reset.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'skip-guides': {
      const ids = GUIDE_STEPS.map((s) => s.id)
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
      const sector = Math.max(1, next.combat.sector)
      const wave = wavesForSector(sector)
      next.combat.sector = sector
      next.combat.wave = wave
      next.combat.highestSector = Math.max(next.combat.highestSector, sector - 1)
      next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, sector - 1)
      next.combat.docked = false
      next.combat.inFight = false
      next.combat.enemyUnits = []
      next.combat.playerUnits = []
      next.combat.projectiles = []
      next.combat.fx = []
      const enc = enemyForSector(sector, wave)
      next.combat.log = [
        `[dev] Forced boss setup — sector ${sector} W${wave} (${enc.name}).`,
        ...next.combat.log,
      ].slice(0, 40)
      maybeGrantSystemUnlocks(next)
      break
    }
    case 'grant-achievements': {
      next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, 80)
      next.combat.highestSector = Math.max(next.combat.highestSector, 80)
      next.research.unlocked = [...new Set([...next.research.unlocked, 'basic-optics'])]
      if (next.prestige.prestigeCount < 1) next.prestige.prestigeCount = 1
      next.ai.purchased = [...new Set([...next.ai.purchased, 'auto-engage'])]
      tryCompleteAchievements(next)
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
      const max = wavesForRun(next)
      next.combat.wave = Math.max(1, Math.min(max, Math.floor(action.wave)))
      next.combat.inFight = false
      next.combat.enemyUnits = []
      next.combat.log = [`[dev] Wave set to ${next.combat.wave}.`, ...next.combat.log].slice(
        0,
        40,
      )
      break
    }
    case 'set-module-levels': {
      const nextLevels = { ...next.shipyard.moduleLevels }
      for (const [id, level] of Object.entries(action.levels)) {
        nextLevels[id] = Math.max(0, Math.min(MAX_MODULE_LEVEL, Math.floor(level)))
      }
      next.shipyard.moduleLevels = nextLevels
      syncPersistedHullCaps(next)
      next.combat.log = ['[dev] Core levels set.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'seed-late-game': {
      if (next.prestige.prestigeCount < 1) next.prestige.prestigeCount = 1
      next.resources.heat = Math.max(next.resources.heat ?? 0, 20)
      next.resources.salvage = Math.max(next.resources.salvage ?? 0, 400)
      if (!next.specialists) next.specialists = { ranks: { gunner: 0, warden: 0, scavenger: 0 } }
      next.specialists.ranks.gunner = Math.max(next.specialists.ranks.gunner ?? 0, 1)
      if (!next.echo) next.echo = createEmptyEchoState()
      next.echo.clears = { ...next.echo.clears, rift: Math.max(next.echo.clears.rift ?? 0, 1) }
      if (!next.protocols) next.protocols = { activeId: null, ranks: {} }
      next.protocols.ranks = { ...next.protocols.ranks, 'mute-network': Math.max(next.protocols.ranks['mute-network'] ?? 0, 1) }
      next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, 75)
      next.combat.highestSector = Math.max(next.combat.highestSector, 75)
      maybeGrantSystemUnlocks(next)
      next.combat.log = ['[dev] Late-game Task List seeded.', ...next.combat.log].slice(0, 40)
      break
    }
    default:
      break
  }

  return next
}
