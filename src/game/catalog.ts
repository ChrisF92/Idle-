/** Game content catalogs — costs, unlocks, and placeholder effects. */

import type { Resources } from './types'

export type ResourceCost = Partial<Record<keyof Resources, number>>

export interface BuildingDef {
  id: string
  name: string
  description: string
  requiresResearch?: string
  baseCost: ResourceCost
  costScale: number
  rates: ResourceCost
  upkeepScrapPerLevel?: number
}

export interface ResearchDef {
  id: string
  name: string
  description: string
  costData: number
  damageBonus?: number
}

export interface AiNodeDef {
  id: string
  name: string
  description: string
  costAiPoints: number
}

export interface ChallengeDef {
  id: string
  name: string
  description: string
  restriction: string
  goalSector: number
  rewardChallengePoints: number
}

export interface ShipFrameDef {
  id: string
  name: string
  slots: number
  baseDamage: number
  baseHull: number
  unlockCost: ResourceCost
}

export interface ShipModuleDef {
  id: string
  name: string
  role: 'weapon' | 'defense' | 'utility'
  description: string
  damageBonus: number
  hullBonus: number
  /** Multiplier on incoming damage (0.9 = take 10% less). */
  damageTakenMult: number
  unlockCost: ResourceCost
}

export const PRESTIGE_MIN_SECTOR = 8

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'scrapYard',
    name: 'Scrap Yard',
    description: 'Passive scrap from debris fields.',
    baseCost: { scrap: 15 },
    costScale: 1.4,
    rates: { scrap: 0.5 },
  },
  {
    id: 'powerCell',
    name: 'Power Cell',
    description: 'Generates energy for operations.',
    baseCost: { scrap: 20, energy: 5 },
    costScale: 1.45,
    rates: { energy: 0.2 },
  },
  {
    id: 'sensorArray',
    name: 'Sensor Array',
    description: 'Collects research data from anomaly noise.',
    baseCost: { scrap: 30, energy: 10 },
    costScale: 1.5,
    rates: { data: 0.08 },
  },
  {
    id: 'foundry',
    name: 'Foundry',
    description: 'Burns scrap into alloys.',
    requiresResearch: 'alloy-smelting',
    baseCost: { scrap: 40, energy: 15 },
    costScale: 1.5,
    rates: { alloys: 0.15 },
    upkeepScrapPerLevel: 0.2,
  },
]

export const RESEARCH: ResearchDef[] = [
  {
    id: 'basic-optics',
    name: 'Basic Optics',
    description: 'Sharper target acquisition. +25% combat damage.',
    costData: 10,
    damageBonus: 0.25,
  },
  {
    id: 'alloy-smelting',
    name: 'Alloy Smelting',
    description: 'Unlocks the Foundry building.',
    costData: 25,
  },
  {
    id: 'entity-anatomy',
    name: 'Entity Anatomy',
    description: 'Study remains. +50% combat damage.',
    costData: 60,
    damageBonus: 0.5,
  },
]

export const AI_NODES: AiNodeDef[] = [
  {
    id: 'auto-engage',
    name: 'Auto Engage',
    description: 'Automatically start the next sector fight.',
    costAiPoints: 1,
  },
  {
    id: 'combat-log-filter',
    name: 'Log Filter',
    description: 'QoL placeholder: quieter combat summaries later.',
    costAiPoints: 2,
  },
]

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'no-ai',
    name: 'Silent Bridge',
    description: 'Reach sector 5 with AI assists disabled.',
    restriction: 'AI purchases and Auto Engage inactive',
    goalSector: 5,
    rewardChallengePoints: 1,
  },
  {
    id: 'thin-hull',
    name: 'Glass Frame',
    description: 'Reach sector 5 with half hull.',
    restriction: 'Player hull max ×0.5',
    goalSector: 5,
    rewardChallengePoints: 1,
  },
  {
    id: 'data-drought',
    name: 'Data Drought',
    description: 'Reach sector 8 without Data gains from combat.',
    restriction: 'Combat data drops disabled',
    goalSector: 8,
    rewardChallengePoints: 2,
  },
]

export const SHIP_FRAMES: ShipFrameDef[] = [
  {
    id: 'scout-frame',
    name: 'Scout Frame',
    slots: 2,
    baseDamage: 8,
    baseHull: 100,
    unlockCost: {},
  },
  {
    id: 'line-frame',
    name: 'Line Frame',
    slots: 3,
    baseDamage: 7,
    baseHull: 140,
    unlockCost: { alloys: 25, scrap: 40 },
  },
]

export const SHIP_MODULES: ShipModuleDef[] = [
  {
    id: 'pulse-cannon',
    name: 'Pulse Cannon',
    role: 'weapon',
    description: '+4 damage',
    damageBonus: 4,
    hullBonus: 0,
    damageTakenMult: 1,
    unlockCost: {},
  },
  {
    id: 'plate-layer',
    name: 'Plate Layer',
    role: 'defense',
    description: '+35 hull',
    damageBonus: 0,
    hullBonus: 35,
    damageTakenMult: 1,
    unlockCost: { scrap: 20, alloys: 8 },
  },
  {
    id: 'vector-thruster',
    name: 'Vector Thruster',
    role: 'utility',
    description: 'Take 15% less damage',
    damageBonus: 0,
    hullBonus: 0,
    damageTakenMult: 0.85,
    unlockCost: { scrap: 30, alloys: 12 },
  },
  {
    id: 'heavy-lance',
    name: 'Heavy Lance',
    role: 'weapon',
    description: '+10 damage',
    damageBonus: 10,
    hullBonus: 0,
    damageTakenMult: 1,
    unlockCost: { scrap: 50, alloys: 20 },
  },
]

export function getBuilding(id: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.id === id)
}

export function getFrame(id: string): ShipFrameDef | undefined {
  return SHIP_FRAMES.find((f) => f.id === id)
}

export function getModule(id: string): ShipModuleDef | undefined {
  return SHIP_MODULES.find((m) => m.id === id)
}

export function getChallenge(id: string): ChallengeDef | undefined {
  return CHALLENGES.find((c) => c.id === id)
}

export function buildingUpgradeCost(building: BuildingDef, currentLevel: number): ResourceCost {
  const factor = building.costScale ** currentLevel
  const cost: ResourceCost = {}
  for (const [key, amount] of Object.entries(building.baseCost)) {
    cost[key as keyof Resources] = Math.ceil((amount ?? 0) * factor)
  }
  return cost
}

export function researchDamageMultiplier(unlocked: string[]): number {
  let bonus = 1
  for (const id of unlocked) {
    const def = RESEARCH.find((r) => r.id === id)
    if (def?.damageBonus) bonus += def.damageBonus
  }
  return bonus
}

export function metaDamageMultiplier(prestigeMatter: number, challengePoints: number): number {
  return 1 + prestigeMatter * 0.02 + challengePoints * 0.03
}

export function metaProductionMultiplier(prestigeMatter: number): number {
  return 1 + prestigeMatter * 0.02
}
