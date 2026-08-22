/** Lightweight cheats for local / ?dev=1 testing. Never required for normal play. */

import type { GameState, Resources, YardGoodId } from './types'
import { AI_NODES, RESEARCH, SHIP_FRAMES, SHIP_MODULES, trimModulesToFrame } from './catalog'
import {
  ACT1_CADENCE,
  ACT1_FINAL_WAVE,
  CHALLENGE_MIN_REBUILDS,
  PROCESS_MIN_REBUILDS,
  PROCESS_MIN_RESEARCH,
} from './cadence'
import {
  ACHIEVEMENTS,
  GUIDE_STEPS,
  maybeGrantSystemUnlocks,
  tryCompleteAchievements,
} from './progression'
import { REBUILD_MIN_SORTIES } from './rebuild'
import { syncPersistedHullCaps } from './state'
import { encounterForWave } from './combat'
import { CORE_MASTERY_CAP, CORE_RUN_LEVEL_CAP, setCoreRunLevel } from './coreProgression'
import { isBossWave, powerSectorForWave, bandsClearedForWave } from './waves'

export const DEV_FLAG_KEY = 'cosmic-idle-dev'

export const GDD_DOOR_PRESETS = [
  { wave: ACT1_CADENCE.foundry, label: 'W20 Foundry' },
  { wave: ACT1_CADENCE.workers, label: 'W30 Workers' },
  { wave: ACT1_CADENCE.directives, label: 'W50 Directives' },
  { wave: ACT1_CADENCE.rebuild, label: 'W70 Rebuild' },
  { wave: ACT1_CADENCE.reliquary, label: 'W110 Relics' },
  { wave: ACT1_CADENCE.furnace, label: 'W140 Furnace' },
  { wave: ACT1_CADENCE.research, label: 'W170 Research' },
  { wave: ACT1_CADENCE.process, label: 'W210 Process' },
  { wave: ACT1_CADENCE.protocols, label: 'W250 Challenges' },
  { wave: ACT1_CADENCE.reinforce, label: 'W300 Reinforce' },
] as const

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
  | { type: 'set-best-wave'; wave: number }
  | { type: 'prep-gdd-door'; wave: number }
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
  | { type: 'set-core-run-levels'; levels: Record<number, number> }
  | { type: 'set-core-mastery'; ranks: Record<string, number> }
  | { type: 'reset-onboarding' }
  | { type: 'seed-late-game' }
  | { type: 'wipe-career' }
  | { type: 'select-frame'; frameId: string }

export function grantCareerBestWave(state: GameState, wave: number): void {
  const w = Math.max(0, Math.floor(wave))
  state.meta.bestWave = Math.max(state.meta.bestWave ?? 0, w)
  state.combat.bestWave = Math.max(state.combat.bestWave ?? 0, w)
  if (!state.prestige.cycle) state.prestige.cycle = { bestWave: 0, sorties: 0, scrapEarned: 0 }
  state.prestige.cycle.bestWave = Math.max(state.prestige.cycle.bestWave ?? 0, w)
  const bands = bandsClearedForWave(w)
  state.meta.highestSectorEver = Math.max(state.meta.highestSectorEver ?? 0, bands)
  state.combat.highestSector = Math.max(state.combat.highestSector ?? 0, bands)
  if (w >= ACT1_CADENCE.rebuild) {
    state.prestige.cycle.sorties = Math.max(state.prestige.cycle.sorties ?? 0, REBUILD_MIN_SORTIES)
  }
}

function armProcessGates(state: GameState): void {
  state.prestige.prestigeCount = Math.max(state.prestige.prestigeCount ?? 0, PROCESS_MIN_REBUILDS)
  const done = Object.values(state.hiveResearch.completed ?? {}).filter((n) => n > 0).length
  if (done < PROCESS_MIN_RESEARCH) {
    state.hiveResearch.completed.energy = Math.max(state.hiveResearch.completed.energy ?? 0, 1)
  }
}

function clearFight(state: GameState): void {
  state.combat.inFight = false
  state.combat.enemyUnits = []
  state.combat.playerUnits = []
  state.combat.projectiles = []
  state.combat.beams = []
  state.combat.fx = []
}

function prepGddDoor(state: GameState, wave: number): void {
  const w = Math.max(1, Math.floor(wave))
  state.meta.hullLostOnce = true
  grantCareerBestWave(state, w)
  if (w >= ACT1_CADENCE.process) armProcessGates(state)
  if (w >= ACT1_CADENCE.protocols) {
    state.prestige.prestigeCount = Math.max(state.prestige.prestigeCount ?? 0, CHALLENGE_MIN_REBUILDS)
  }
  if (w >= ACT1_CADENCE.reinforce) {
    state.meta.act1Cleared = true
    armProcessGates(state)
  }
  maybeGrantSystemUnlocks(state)
  tryCompleteAchievements(state)
}

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
      next.combat.log = [`[dev] Legacy jump-sector ${sector} (use Best Wave).`, ...next.combat.log].slice(0, 40)
      break
    }
    case 'set-best-wave': {
      const wave = Math.max(0, Math.floor(action.wave))
      grantCareerBestWave(next, wave)
      maybeGrantSystemUnlocks(next)
      tryCompleteAchievements(next)
      next.combat.log = [`[dev] Best Wave ${wave}.`, ...next.combat.log].slice(0, 40)
      break
    }
    case 'prep-gdd-door': {
      prepGddDoor(next, action.wave)
      next.combat.log = [`[dev] Opened GDD door at W${Math.floor(action.wave)}.`, ...next.combat.log].slice(0, 40)
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
      for (const [key, amount] of Object.entries(action.amounts)) {
        const k = key as YardGoodId
        next.yard.goods[k] = (next.yard.goods[k] ?? 0) + (amount ?? 0)
      }
      next.combat.log = ['[dev] Construction goods granted.', ...next.combat.log].slice(0, 40)
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
      grantCareerBestWave(next, ACT1_FINAL_WAVE)
      next.meta.hullLostOnce = true
      maybeGrantSystemUnlocks(next)
      tryCompleteAchievements(next)
      next.combat.log = ['[dev] Catalog unlocked through Wave 300.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'clear-guides': {
      next.meta.seenOnboarding = []
      next.combat.log = ['[dev] Onboarding guides reset.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'reset-onboarding': {
      next.meta.seenOnboarding = []
      next.meta.hullLostOnce = false
      next.meta.starterCombatLesson = 2
      next.combat.log = ['[dev] First-run onboarding flags cleared.', ...next.combat.log].slice(0, 40)
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
        `[dev] Rebuild count = ${next.prestige.prestigeCount}.`,
        ...next.combat.log,
      ].slice(0, 40)
      break
    }
    case 'fill-workers': {
      const n = Math.max(0, Math.floor(action.count))
      next.base.workerDrones = Math.max(next.base.workerDrones, n)
      grantCareerBestWave(next, ACT1_CADENCE.workers)
      maybeGrantSystemUnlocks(next)
      next.combat.log = [`[dev] Worker drones ≥ ${n}.`, ...next.combat.log].slice(0, 40)
      break
    }
    case 'dock-heal': {
      next.combat.docked = true
      clearFight(next)
      syncPersistedHullCaps(next)
      next.combat.playerHull = next.combat.playerHullMax
      next.combat.playerShield = next.combat.playerShieldMax
      next.combat.log = ['[dev] Docked and repaired.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'force-boss-wave': {
      const current = Math.max(1, next.combat.wave || 1)
      const wave = isBossWave(current) ? current : Math.ceil(current / 10) * 10
      next.combat.wave = wave
      next.combat.sector = powerSectorForWave(wave)
      next.combat.docked = false
      clearFight(next)
      const enc = encounterForWave(wave)
      next.combat.log = [
        `[dev] Forced boss — Wave ${wave} (${enc.name}).`,
        ...next.combat.log,
      ].slice(0, 40)
      maybeGrantSystemUnlocks(next)
      break
    }
    case 'grant-achievements': {
      grantCareerBestWave(next, ACT1_FINAL_WAVE)
      next.research.unlocked = [...new Set([...next.research.unlocked, 'basic-optics'])]
      if (next.prestige.prestigeCount < 1) next.prestige.prestigeCount = 1
      next.ai.purchased = [...new Set([...next.ai.purchased, 'auto-engage'])]
      tryCompleteAchievements(next)
      for (const def of ACHIEVEMENTS) {
        if (!next.meta.completedAchievements.includes(def.id)) {
          next.meta.completedAchievements = [...next.meta.completedAchievements, def.id]
          next.resources.aiPoints += def.rewardAiPoints
          if (next.process) next.process.earned = (next.process.earned ?? 0) + def.rewardAiPoints
        }
      }
      next.meta.aiUnlocked = true
      next.meta.act1Cleared = true
      next.combat.log = ['[dev] All achievements granted.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'set-wave': {
      const wave = Math.max(1, Math.min(ACT1_FINAL_WAVE, Math.floor(action.wave)))
      next.combat.wave = wave
      next.combat.sector = powerSectorForWave(wave)
      clearFight(next)
      next.combat.log = [`[dev] Live Wave set to ${wave} (career unchanged).`, ...next.combat.log].slice(
        0,
        40,
      )
      break
    }
    case 'set-module-levels': {
      if (!next.meta.moduleMastery) next.meta.moduleMastery = {}
      for (const [id, level] of Object.entries(action.levels)) {
        next.meta.moduleMastery[id] = Math.max(0, Math.min(CORE_MASTERY_CAP, Math.floor(level)))
      }
      syncPersistedHullCaps(next)
      next.combat.log = ['[dev] Core Mastery set.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'set-core-run-levels': {
      for (const [slot, level] of Object.entries(action.levels)) {
        setCoreRunLevel(next, Number(slot), Math.max(0, Math.min(CORE_RUN_LEVEL_CAP, Math.floor(level))))
      }
      next.combat.log = ['[dev] Core Run Levels set.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'set-core-mastery': {
      if (!next.meta.moduleMastery) next.meta.moduleMastery = {}
      for (const [id, rank] of Object.entries(action.ranks)) {
        next.meta.moduleMastery[id] = Math.max(0, Math.min(CORE_MASTERY_CAP, Math.floor(rank)))
      }
      syncPersistedHullCaps(next)
      next.combat.log = ['[dev] Core Mastery set.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'seed-late-game': {
      prepGddDoor(next, ACT1_FINAL_WAVE)
      next.resources.heat = Math.max(next.resources.heat ?? 0, 20)
      next.resources.salvage = Math.max(next.resources.salvage ?? 0, 400)
      next.resources.choirAsh = Math.max(next.resources.choirAsh ?? 0, 80)
      next.combat.log = ['[dev] Wave 300 / Reinforce seeded.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'wipe-career': {
      next.combat.log = ['[dev] Wipe from More → Settings (hard reset).', ...next.combat.log].slice(0, 40)
      break
    }
    case 'select-frame': {
      const frame = SHIP_FRAMES.find((f) => f.id === action.frameId)
      if (frame) {
        if (!next.shipyard.unlockedFrames.includes(frame.id)) {
          next.shipyard.unlockedFrames = [...next.shipyard.unlockedFrames, frame.id]
        }
        next.shipyard.frameId = frame.id
        next.shipyard.modules = trimModulesToFrame(next.shipyard.modules, frame)
        next.combat.log = [`[dev] Equipped ${frame.name}.`, ...next.combat.log].slice(0, 40)
        if (!next.combat.inFight) syncPersistedHullCaps(next)
      }
      break
    }
    default:
      break
  }

  return next
}
