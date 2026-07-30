import type { GameState, Resources, ShipCombatStats } from './types'
import {
  aiDoctrinesActive,
  essenceDamageMultiplier,
  essenceHullBonus,
  getFrame,
  getModule,
  matterShopHullBonus,
  metaDamageMultiplier,
  researchDamageMultiplier,
} from './catalog'

export const SAVE_VERSION = 7
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
      campaign: true,
      walled: false,
      repairTimer: 0,
      consecutiveLosses: 0,
      bossPhase: 0,
      playerHull: hullMax,
      playerHullMax: hullMax,
      enemyName: 'None',
      enemyFamily: '',
      enemyTags: [],
      enemyDamage: 0,
      isBoss: false,
      enemyHull: 0,
      enemyHullMax: 0,
      log: ['Systems online. Campaign armed — continuous push active.'],
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
    essence: {
      purchased: [],
    },
    prestige: {
      prestigeCount: 0,
      activeChallengeId: null,
      completedChallenges: [],
      shop: [],
      matterShop: [],
    },
  }
}

/** Derive combat stats from frame, modules, research, meta, essence, and challenges. */
export function computeShipStats(state: GameState): ShipCombatStats {
  const frame = getFrame(state.shipyard.frameId) ?? getFrame('scout-frame')!
  let damage = frame.baseDamage
  let hullMax =
    frame.baseHull +
    essenceHullBonus(state.essence.purchased) +
    matterShopHullBonus(state.prestige.matterShop)
  let damageTakenMult = 1

  for (const moduleId of state.shipyard.modules) {
    const mod = getModule(moduleId)
    if (!mod) continue
    damage += mod.damageBonus
    hullMax += mod.hullBonus
    damageTakenMult *= mod.damageTakenMult
  }

  damage *= researchDamageMultiplier(state.research.unlocked)
  damage *= essenceDamageMultiplier(state.essence.purchased)
  damage *= metaDamageMultiplier(
    state.resources.prestigeMatter,
    state.resources.challengePoints,
    state.prestige.shop,
    state.prestige.matterShop,
  )

  if (aiDoctrinesActive(state, 'focus-fire')) {
    damage *= 1.12
  }

  if (state.prestige.activeChallengeId === 'thin-hull') {
    hullMax *= 0.5
  }

  return {
    damage,
    hullMax,
    damageTakenMult,
  }
}
