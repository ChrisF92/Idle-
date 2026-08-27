/**
 * Authored targeting / mechanical profiles for the final Act 1 Cores.
 *
 * PR2 owns the targeting engine. This file feeds it Core-authored geometry.
 * Acquisition range is always greater than firing range.
 */

import { getModule } from './catalog'
import type { TargetingDoctrineId } from './types'

export type CoreTargetingProfileId =
  | 'pulse-cannon'
  | 'heavy-lance'
  | 'flak-array'
  | 'phase-beam'
  | 'slag-spitter'
  | 'grav-tether'
  | 'salvage-beacon'

export type CoreSlewClass = 'slow' | 'medium' | 'fast' | 'very-fast'

export interface CoreTargetingProfile {
  profileId: CoreTargetingProfileId
  moduleIds: string[]
  defaultDoctrine: TargetingDoctrineId
  allowedDoctrines: readonly TargetingDoctrineId[]
  fireRange: number
  acquisitionRange: number
  firingArcDeg: number
  slewRateDegPerSec: number
  slewClass: CoreSlewClass
  switchAdvantage: number
  committedSwitchAdvantage?: number
  firesWhileTraversing: boolean
  requiresStabilisedAim: boolean
  aimToleranceDeg: number
  requiresCharge: boolean
  chargeDurationSec: number
  committedOrbitFactor: number
}

const THREAT_FOCUS_EXEC_SHIELD = ['threat', 'focus', 'execution', 'shield'] as const
const HEAVY_FOCUS_SHIELD_THREAT = ['heavy', 'focus', 'shield', 'threat'] as const
const CLUSTER_THREAT_EXEC = ['cluster', 'threat', 'execution'] as const
const FOCUS_HEAVY_SHIELD = ['focus', 'heavy', 'shield'] as const
const CLUSTER_HEAVY_THREAT = ['cluster', 'heavy', 'threat'] as const
const THREAT_HEAVY_CLUSTER = ['threat', 'heavy', 'cluster'] as const
const EXECUTION_HEAVY = ['execution', 'heavy'] as const

export const PULSE_TARGETING_PROFILE: CoreTargetingProfile = {
  profileId: 'pulse-cannon',
  moduleIds: ['pulse-cannon'],
  defaultDoctrine: 'threat',
  allowedDoctrines: THREAT_FOCUS_EXEC_SHIELD,
  fireRange: 170,
  acquisitionRange: 240,
  firingArcDeg: 150,
  slewRateDegPerSec: 360,
  slewClass: 'fast',
  switchAdvantage: 0.25,
  firesWhileTraversing: true,
  requiresStabilisedAim: false,
  aimToleranceDeg: 180,
  requiresCharge: false,
  chargeDurationSec: 0,
  committedOrbitFactor: 1,
}

export const HEAVY_LANCE_TARGETING_PROFILE: CoreTargetingProfile = {
  profileId: 'heavy-lance',
  moduleIds: ['heavy-lance'],
  defaultDoctrine: 'heavy',
  allowedDoctrines: HEAVY_FOCUS_SHIELD_THREAT,
  fireRange: 260,
  acquisitionRange: 380,
  firingArcDeg: 100,
  slewRateDegPerSec: 120,
  slewClass: 'slow',
  switchAdvantage: 0.45,
  committedSwitchAdvantage: 0.45,
  firesWhileTraversing: false,
  requiresStabilisedAim: true,
  aimToleranceDeg: 4,
  requiresCharge: true,
  chargeDurationSec: 2.8,
  committedOrbitFactor: 0.12,
}

export const FLAK_TARGETING_PROFILE: CoreTargetingProfile = {
  profileId: 'flak-array',
  moduleIds: ['flak-array'],
  defaultDoctrine: 'cluster',
  allowedDoctrines: CLUSTER_THREAT_EXEC,
  fireRange: 145,
  acquisitionRange: 210,
  firingArcDeg: 220,
  slewRateDegPerSec: 540,
  slewClass: 'very-fast',
  switchAdvantage: 0.1,
  firesWhileTraversing: true,
  requiresStabilisedAim: false,
  aimToleranceDeg: 180,
  requiresCharge: false,
  chargeDurationSec: 0,
  committedOrbitFactor: 1,
}

export const PHASE_BEAM_TARGETING_PROFILE: CoreTargetingProfile = {
  profileId: 'phase-beam',
  moduleIds: ['phase-beam'],
  defaultDoctrine: 'focus',
  allowedDoctrines: FOCUS_HEAVY_SHIELD,
  fireRange: 220,
  acquisitionRange: 310,
  firingArcDeg: 135,
  slewRateDegPerSec: 180,
  slewClass: 'medium',
  switchAdvantage: 0.6,
  committedSwitchAdvantage: 0.65,
  firesWhileTraversing: false,
  requiresStabilisedAim: true,
  aimToleranceDeg: 6,
  requiresCharge: false,
  chargeDurationSec: 0,
  committedOrbitFactor: 0.18,
}

export const SLAG_TARGETING_PROFILE: CoreTargetingProfile = {
  profileId: 'slag-spitter',
  moduleIds: ['slag-spitter'],
  defaultDoctrine: 'cluster',
  allowedDoctrines: CLUSTER_HEAVY_THREAT,
  fireRange: 180,
  acquisitionRange: 250,
  firingArcDeg: 175,
  slewRateDegPerSec: 300,
  slewClass: 'fast',
  switchAdvantage: 0.2,
  firesWhileTraversing: true,
  requiresStabilisedAim: false,
  aimToleranceDeg: 180,
  requiresCharge: false,
  chargeDurationSec: 0,
  committedOrbitFactor: 1,
}

export const GRAV_TETHER_TARGETING_PROFILE: CoreTargetingProfile = {
  profileId: 'grav-tether',
  moduleIds: ['grav-tether'],
  defaultDoctrine: 'threat',
  allowedDoctrines: THREAT_HEAVY_CLUSTER,
  fireRange: 160,
  acquisitionRange: 240,
  firingArcDeg: 200,
  slewRateDegPerSec: 300,
  slewClass: 'fast',
  switchAdvantage: 0.22,
  firesWhileTraversing: true,
  requiresStabilisedAim: false,
  aimToleranceDeg: 180,
  requiresCharge: false,
  chargeDurationSec: 0,
  committedOrbitFactor: 1,
}

export const SALVAGE_BEACON_TARGETING_PROFILE: CoreTargetingProfile = {
  profileId: 'salvage-beacon',
  moduleIds: ['salvage-beacon'],
  defaultDoctrine: 'execution',
  allowedDoctrines: EXECUTION_HEAVY,
  fireRange: 190,
  acquisitionRange: 280,
  firingArcDeg: 160,
  slewRateDegPerSec: 240,
  slewClass: 'medium',
  switchAdvantage: 0.28,
  firesWhileTraversing: true,
  requiresStabilisedAim: false,
  aimToleranceDeg: 180,
  requiresCharge: false,
  chargeDurationSec: 0,
  committedOrbitFactor: 1,
}

const CANONICAL: CoreTargetingProfile[] = [
  PULSE_TARGETING_PROFILE,
  HEAVY_LANCE_TARGETING_PROFILE,
  FLAK_TARGETING_PROFILE,
  PHASE_BEAM_TARGETING_PROFILE,
  SLAG_TARGETING_PROFILE,
  GRAV_TETHER_TARGETING_PROFILE,
  SALVAGE_BEACON_TARGETING_PROFILE,
]

const BY_MODULE = new Map<string, CoreTargetingProfile>()
for (const profile of CANONICAL) {
  for (const id of profile.moduleIds) BY_MODULE.set(id, profile)
}

const SUPPORT_TARGETING = new Set(['grav-tether', 'salvage-beacon'])

export function isCanonicalWeaponModule(moduleId: string): boolean {
  const profile = BY_MODULE.get(moduleId)
  return Boolean(profile && profile.profileId !== 'grav-tether' && profile.profileId !== 'salvage-beacon')
}

/**
 * Weapon Cores plus Grav Tether / Salvage Beacon, which lock through PR2
 * to drive control and marking. Defense Cores are not targeting-capable.
 */
export function isTargetingCapableCoreModule(moduleId: string): boolean {
  if (SUPPORT_TARGETING.has(moduleId)) return true
  const mod = getModule(moduleId)
  return Boolean(mod && mod.role === 'weapon' && mod.weapon)
}

const EMPTY_PROFILE: CoreTargetingProfile = {
  ...PULSE_TARGETING_PROFILE,
  fireRange: 0,
  acquisitionRange: 0,
  firingArcDeg: 0,
  slewRateDegPerSec: 0,
}

export function targetingProfileFor(moduleId: string): CoreTargetingProfile {
  const authored = BY_MODULE.get(moduleId)
  if (authored) return authored
  return EMPTY_PROFILE
}

export const AUTHORED_TARGETING_PROFILES = CANONICAL
