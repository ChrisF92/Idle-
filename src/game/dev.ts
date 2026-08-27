/** Lightweight cheats for local / ?dev=1 testing. Never required for normal play. */

import type { GameState, Resources } from './types'
import { AI_NODES, RESEARCH, SHIP_FRAMES, SHIP_MODULES, trimModulesToFrame } from './catalog'
import { usableCoreSlots } from './coreSlots'
import {
  ACT1_CADENCE,
  ACT1_FINAL_WAVE,
  CHALLENGE_MIN_REBUILDS,
  PROCESS_MIN_REBUILDS,
  PROCESS_MIN_RESEARCH,
} from './cadence'
import {
  ACHIEVEMENTS,
  maybeGrantSystemUnlocks,
  tryCompleteAchievements,
} from './progression'
import { prepOnboardingDoor, resetOnboardingRegistry, skipAllLessons, type OnboardingLessonId } from './onboarding'
import { REBUILD_MIN_SORTIES } from './rebuild'
import { syncPersistedHullCaps } from './state'
import { CORE_MASTERY_CAP } from './coreProgression'
import { createDefaultProcessProfiles } from './processProfiles'
import { noteCareerWave } from './playtest'
import { reconcileEquippedCoreIds } from './coreInstances'

export const DEV_FLAG_KEY = 'cosmic-idle-dev'

export const GDD_DOOR_PRESETS = [
  { wave: ACT1_CADENCE.foundry, label: 'W50 Foundry' },
  { wave: ACT1_CADENCE.workers, label: 'W50 Workers' },
  { wave: ACT1_CADENCE.directives, label: 'W50 Directives' },
  { wave: ACT1_CADENCE.rebuild, label: 'W210 Rebuild' },
  { wave: ACT1_CADENCE.reliquary, label: 'W320 Relics' },
  { wave: ACT1_CADENCE.furnace, label: 'W140 Furnace' },
  { wave: ACT1_CADENCE.research, label: 'W170 Research' },
  { wave: ACT1_CADENCE.process, label: 'W210 Process' },
  { wave: ACT1_CADENCE.protocols, label: 'W250 Challenges' },
  { wave: ACT1_CADENCE.reinforce, label: 'W1000 Reinforce' },
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
  | { type: 'set-best-wave'; wave: number }
  | { type: 'prep-gdd-door'; wave: number }
  | { type: 'add-resources'; amounts: Partial<Resources> }
  | { type: 'unlock-catalog' }
  | { type: 'clear-guides' }
  | { type: 'set-prestige-count'; count: number }
  | { type: 'fill-workers'; count: number }
  | { type: 'dock-heal' }
  | { type: 'grant-achievements' }
  | { type: 'skip-guides' }
  | { type: 'set-module-levels'; levels: Record<string, number> }
  | { type: 'set-core-mastery'; ranks: Record<string, number> }
  | { type: 'reset-onboarding' }
  | { type: 'prep-onboarding-door'; lessonId: string }
  | { type: 'seed-late-game' }
  | { type: 'wipe-career' }
  | { type: 'select-frame'; frameId: string }
  | { type: 'inject-process-profile'; profileId: 'farm' | 'push' | 'challenge' }

export function grantCareerBestWave(state: GameState, wave: number): void {
  const w = Math.max(0, Math.floor(wave))
  state.meta.bestWave = Math.max(state.meta.bestWave ?? 0, w)
  state.combat.bestWave = Math.max(state.combat.bestWave ?? 0, w)
  if (!state.prestige.cycle) state.prestige.cycle = { bestWave: 0, normalSortiesCompleted: 0, scrapGenerated: 0 }
  state.prestige.cycle.bestWave = Math.max(state.prestige.cycle.bestWave ?? 0, w)
  if (w >= ACT1_CADENCE.rebuild) {
    state.prestige.cycle.normalSortiesCompleted = Math.max(
      state.prestige.cycle.normalSortiesCompleted ?? 0,
      REBUILD_MIN_SORTIES,
    )
  }
  noteCareerWave(state, w)
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
      next.meta.hullLostOnce = true
      maybeGrantSystemUnlocks(next)
      tryCompleteAchievements(next)
      next.combat.log = ['[dev] Catalog unlocked (career Best Wave unchanged).', ...next.combat.log].slice(0, 40)
      break
    }
    case 'clear-guides': {
      return resetOnboardingRegistry(next)
    }
    case 'reset-onboarding': {
      const cleared = resetOnboardingRegistry(next)
      cleared.meta.hullLostOnce = false
      cleared.meta.starterCombatLesson = 2
      cleared.combat.log = ['[dev] First-run onboarding flags cleared.', ...cleared.combat.log].slice(0, 40)
      return cleared
    }
    case 'skip-guides': {
      const skipped = skipAllLessons(next)
      skipped.combat.log = ['[dev] Guides skipped.', ...skipped.combat.log].slice(0, 40)
      return skipped
    }
    case 'prep-onboarding-door': {
      return prepOnboardingDoor(next, action.lessonId as OnboardingLessonId)
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
      next.combat.log = [`[dev] Worker drones ≥ ${n}.`, ...next.combat.log].slice(0, 40)
      break
    }
    case 'dock-heal': {
      next.combat.docked = true
      next.shipyard.frameLocked = false
      clearFight(next)
      syncPersistedHullCaps(next)
      next.combat.playerHull = next.combat.playerHullMax
      next.combat.playerShield = next.combat.playerShieldMax
      next.combat.log = ['[dev] Docked and repaired.', ...next.combat.log].slice(0, 40)
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
    case 'set-module-levels': {
      if (!next.meta.moduleMastery) next.meta.moduleMastery = {}
      for (const [id, level] of Object.entries(action.levels)) {
        next.meta.moduleMastery[id] = Math.max(0, Math.min(CORE_MASTERY_CAP, Math.floor(level)))
      }
      syncPersistedHullCaps(next)
      next.combat.log = ['[dev] Core Mastery set.', ...next.combat.log].slice(0, 40)
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
      next.combat.log = ['[dev] Wave 1000 / Reinforce seeded.', ...next.combat.log].slice(0, 40)
      break
    }
    case 'wipe-career': {
      next.combat.log = ['[dev] Wipe from More → Settings (hard reset).', ...next.combat.log].slice(0, 40)
      break
    }
    case 'select-frame': {
      const frame = SHIP_FRAMES.find((f) => f.id === action.frameId)
      if (frame) {
        const previousModules = [...next.shipyard.modules]
        const previousCoreIds = [...(next.shipyard.equippedCoreIds ?? [])]
        if (!next.shipyard.unlockedFrames.includes(frame.id)) {
          next.shipyard.unlockedFrames = [...next.shipyard.unlockedFrames, frame.id]
        }
        next.shipyard.frameId = frame.id
        next.shipyard.modules = trimModulesToFrame(next.shipyard.modules, usableCoreSlots(next, frame.id))
        reconcileEquippedCoreIds(next.shipyard, previousModules, previousCoreIds)
        next.combat.log = [`[dev] Equipped ${frame.name}.`, ...next.combat.log].slice(0, 40)
        if (!next.combat.inFight) syncPersistedHullCaps(next)
      }
      break
    }
    case 'inject-process-profile': {
      prepGddDoor(next, ACT1_CADENCE.process)
      const nodes = ['buy-ten', 'auto-shop', 'spend-ratios', 'rule-builder', 'run-profiles']
      next.process.purchased = [...new Set([...(next.process.purchased ?? []), ...nodes])]
      if (!next.process.config.profiles.length) {
        next.process.config.profiles = createDefaultProcessProfiles()
      }
      next.process.config.activeProfileId = action.profileId
      next.resources.aiPoints = Math.max(next.resources.aiPoints ?? 0, 40)
      next.combat.log = [`[dev] Process ${action.profileId} profile injected.`, ...next.combat.log].slice(0, 40)
      break
    }
    default:
      break
  }

  return next
}
