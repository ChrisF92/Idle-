import type { GameState, Resources } from './types'

export const SAVE_VERSION = 1
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
  return {
    version: SAVE_VERSION,
    lastTickAt: now,
    resources: {
      scrap: 25,
      alloys: 0,
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
    },
    combat: {
      sector: 1,
      inFight: false,
      playerHull: 100,
      playerHullMax: 100,
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
