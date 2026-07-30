import type { GameState, Resources, ShipCombatStats } from './types'
import {
  getFrame,
  getModule,
  metaDamageMultiplier,
  researchDamageMultiplier,
} from './catalog'

export const SAVE_VERSION = 2
export const SAVE_KEY = 'cosmic-idle-save'

export const RESOURCE_LABELS: Record<keyof Resources, string> = {
  scrap: 'Scrap',
  alloys: 'Alloys',
  energy: 'Energy',
  data: 'Data',
  essence: 'Essence',
  aiPoints: 'AI Points',
  prestigeMatter: 'Prestige Matter',
  challengePoints: 'Challenge Points',
}

export function createInitialState(now = Date.now()): GameState {
  const hullMax = 100
  return {
    version: SAVE_VERSION,
    lastTickAt: now,
    resources: {
      scrap: 25,
      alloys: 5,
      energy: 10,
      data: 0,
      essence: 0,
      aiPoints: 0,
      prestigeMatter: 0,
      challengePoints: 0,
    },
    shipyard: {
      frameId: 'scout-frame',
      modules: ['pulse-cannon'],
      unlockedFrames: ['scout-frame'],
      unlockedModules: ['pulse-cannon'],
    },
    combat: {
      sector: 1,
      highestSector: 1,
      inFight: false,
      playerHull: hullMax,
      playerHullMax: hullMax,
      enemyName: 'None',
      enemyHull: 0,
      enemyHullMax: 0,
      log: ['Systems online. Awaiting sector engagement.'],
    },
    base: {
      buildings: {
        scrapYard: 1,
        powerCell: 1,
      },
    },
    research: {
      unlocked: [],
    },
    ai: {
      purchased: [],
    },
    prestige: {
      prestigeCount: 0,
      activeChallengeId: null,
      completedChallenges: [],
    },
  }
}

/** Derive combat stats from frame, modules, research, meta, and challenges. */
export function computeShipStats(state: GameState): ShipCombatStats {
  const frame = getFrame(state.shipyard.frameId) ?? getFrame('scout-frame')!
  let damage = frame.baseDamage
  let hullMax = frame.baseHull
  let damageTakenMult = 1

  for (const moduleId of state.shipyard.modules) {
    const mod = getModule(moduleId)
    if (!mod) continue
    damage += mod.damageBonus
    hullMax += mod.hullBonus
    damageTakenMult *= mod.damageTakenMult
  }

  damage *= researchDamageMultiplier(state.research.unlocked)
  damage *= metaDamageMultiplier(
    state.resources.prestigeMatter,
    state.resources.challengePoints,
  )

  if (state.prestige.activeChallengeId === 'thin-hull') {
    hullMax *= 0.5
  }

  return {
    damage,
    hullMax,
    damageTakenMult,
  }
}
