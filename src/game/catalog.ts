/** Game content catalogs — costs, unlocks, and placeholder effects. */

import type { Resources } from './types'

export type ResourceCost = Partial<Record<keyof Resources, number>>

export interface BuildingDef {
  id: string
  name: string
  description: string
  /** Required research id, if any. */
  requiresResearch?: string
  /** Base upgrade cost at level 0 → 1. */
  baseCost: ResourceCost
  /** Cost multiplier per existing level. */
  costScale: number
  /** Production per level per second. */
  rates: ResourceCost
  /** Optional scrap consumed per second per level (e.g. foundry). */
  upkeepScrapPerLevel?: number
}

export interface ResearchDef {
  id: string
  name: string
  description: string
  costData: number
  /** Flat player DPS multiplier added when owned (1.0 = +100%). */
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
}

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
    restriction: 'AI purchases inactive',
  },
  {
    id: 'thin-hull',
    name: 'Glass Frame',
    description: 'Reach sector 5 with half hull.',
    restriction: 'Player hull max ×0.5',
  },
  {
    id: 'data-drought',
    name: 'Data Drought',
    description: 'Reach sector 8 without Data gains from combat.',
    restriction: 'Combat data drops disabled',
  },
]

export const SHIP_FRAMES = [
  { id: 'scout-frame', name: 'Scout Frame', slots: 2 },
  { id: 'line-frame', name: 'Line Frame', slots: 3 },
]

export const SHIP_MODULES = [
  { id: 'pulse-cannon', name: 'Pulse Cannon', role: 'weapon' },
  { id: 'plate-layer', name: 'Plate Layer', role: 'defense' },
  { id: 'vector-thruster', name: 'Vector Thruster', role: 'utility' },
]

export function getBuilding(id: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.id === id)
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
