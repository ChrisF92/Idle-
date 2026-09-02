import type { TargetingDoctrineId } from '../types'
import type { SimulationSpendProfile } from './types'

export const ACT1_BUILD_PROFILE_IDS = [
  'balanced-generalist',
  'swarm-control',
  'boss-killer',
  'shield-breaker',
  'defensive-sustain',
  'economy-farm',
] as const

export type Act1BuildProfileId = (typeof ACT1_BUILD_PROFILE_IDS)[number]

export type AccountInvestmentStrategy =
  | 'workshop-heavy'
  | 'core-level-heavy'
  | 'permanent-unlock-heavy'
  | 'balanced'

export interface Act1BuildProfile {
  id: Act1BuildProfileId
  label: string
  purpose: string
  frameId: string
  coreIds: string[]
  relicFamilyIds: string[]
  doctrines: TargetingDoctrineId[]
  investment: AccountInvestmentStrategy
}

/**
 * Canonical PR11 acceptance matrix. These are simulator fixtures, not player
 * presets or claims of optimality; duplicates are deliberate where noted.
 */
export const ACT1_BUILD_PROFILES: Act1BuildProfile[] = [
  {
    id: 'balanced-generalist',
    label: 'Balanced Generalist',
    purpose: 'General frontier progression without a specialist dependency.',
    frameId: 'starter-frame',
    coreIds: ['pulse-cannon', 'plate-layer', 'flak-array', 'rapid-aegis', 'sensor-array'],
    relicFamilyIds: ['power-coupler', 'reinforcement-plate', 'predictive-bus'],
    doctrines: ['threat', 'focus'],
    investment: 'balanced',
  },
  {
    id: 'swarm-control',
    label: 'Swarm Control',
    purpose: 'Dense formations, angular pressure, and manageable backlog.',
    frameId: 'swarm-frame',
    coreIds: ['flak-array', 'flak-array', 'grav-tether', 'pulse-cannon', 'rapid-aegis', 'sensor-array'],
    relicFamilyIds: ['gravity-lens', 'tracking-gimbal', 'prismatic-lens'],
    doctrines: ['cluster', 'threat'],
    investment: 'core-level-heavy',
  },
  {
    id: 'boss-killer',
    label: 'Boss Killer',
    purpose: 'Focused single-target pressure with defensive room for mechanics.',
    frameId: 'reactor-frame',
    coreIds: ['heavy-lance', 'heavy-lance', 'slag-spitter', 'sensor-array', 'plate-layer'],
    relicFamilyIds: ['fixed-mount', 'focusing-array', 'resonance-tap'],
    doctrines: ['heavy', 'focus', 'execution'],
    investment: 'workshop-heavy',
  },
  {
    id: 'shield-breaker',
    label: 'Shield Breaker',
    purpose: 'Shield pressure and target handoff without making one Core mandatory.',
    frameId: 'starter-frame',
    coreIds: ['phase-beam', 'slag-spitter', 'heavy-lance', 'sensor-array', 'barrier-projector'],
    relicFamilyIds: ['phase-needle', 'shatter-mesh', 'predictive-bus'],
    doctrines: ['shield', 'focus'],
    investment: 'permanent-unlock-heavy',
  },
  {
    id: 'defensive-sustain',
    label: 'Defensive Sustain',
    purpose: 'Long pressure windows with recovery and soft offensive answers.',
    frameId: 'bastion-frame',
    coreIds: ['plate-layer', 'rapid-aegis', 'barrier-projector', 'nano-lathe', 'pulse-cannon', 'sensor-array'],
    relicFamilyIds: ['aegis-relay', 'nanite-reservoir', 'shield-crossfeed'],
    doctrines: ['threat', 'shield'],
    investment: 'core-level-heavy',
  },
  {
    id: 'economy-farm',
    label: 'Economy/Farm',
    purpose: 'Solved-content farming with enough combat power to avoid stagnation.',
    frameId: 'harvester-frame',
    coreIds: ['salvage-beacon', 'choir-tap', 'nano-lathe', 'pulse-cannon', 'plate-layer'],
    relicFamilyIds: ['salvage-matrix', 'industrial-optimiser', 'resonance-tap'],
    doctrines: ['execution', 'threat'],
    investment: 'balanced',
  },
]

export function getAct1BuildProfile(id: Act1BuildProfileId): Act1BuildProfile {
  return ACT1_BUILD_PROFILES.find((profile) => profile.id === id) ?? ACT1_BUILD_PROFILES[0]!
}

export function spendModeForBuildProfile(id: Act1BuildProfileId): SimulationSpendProfile {
  if (id === 'boss-killer' || id === 'shield-breaker') return 'offensive'
  if (id === 'defensive-sustain') return 'defensive'
  if (id === 'economy-farm') return 'economy-first'
  return 'balanced'
}
