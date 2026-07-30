/** Stub catalogs — filled in as systems are designed. */

export interface BuildingDef {
  id: string
  name: string
  description: string
}

export interface ResearchDef {
  id: string
  name: string
  description: string
  costData: number
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
  { id: 'scrapYard', name: 'Scrap Yard', description: 'Passive scrap from debris fields.' },
  { id: 'powerCell', name: 'Power Cell', description: 'Generates energy for operations.' },
  { id: 'foundry', name: 'Foundry', description: 'Smelts scrap into alloys.' },
  { id: 'sensorArray', name: 'Sensor Array', description: 'Collects research data.' },
]

export const RESEARCH: ResearchDef[] = [
  {
    id: 'basic-optics',
    name: 'Basic Optics',
    description: 'Unlock sharper target acquisition.',
    costData: 10,
  },
  {
    id: 'alloy-smelting',
    name: 'Alloy Smelting',
    description: 'Unlock the Foundry building.',
    costData: 25,
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
    description: 'QoL: summarize repetitive combat lines.',
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
