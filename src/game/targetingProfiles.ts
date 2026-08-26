/**
 * Authored targeting / mechanical profiles for weapon Cores.
 *
 * Canonical identities (Pulse, Heavy Lance, Flak, Phase Beam, Slag Spitter)
 * live here. PR4 owns the final 14-Core catalogue; until then unknown weapon
 * IDs use ONE isolated legacy fallback — not bespoke per-Core targeting.
 *
 * These numbers are implementation/simulator seeds. Relative identities are
 * authoritative. PR11 may retune exact values.
 */

import { getModule } from './catalog'
import type { TargetingDoctrineId } from './types'

export type CoreTargetingProfileId =
  | 'pulse-cannon'
  | 'heavy-lance'
  | 'flak-array'
  | 'phase-beam'
  | 'slag-spitter'
  | 'legacy-fallback'

export interface CoreTargetingProfile {
  profileId: CoreTargetingProfileId
  /** Module IDs this profile currently covers (including transitional aliases). */
  moduleIds: string[]
  defaultDoctrine: TargetingDoctrineId
  allowedDoctrines: readonly TargetingDoctrineId[]
  /** Base firing range in simulation units. */
  fireRange: number
  /** Base acquisition range. Always larger than fire range. */
  acquisitionRange: number
  /** Total firing arc in degrees, centred on mechanical heading. */
  firingArcDeg: number
  /** Mechanical slew in degrees / simulated second. */
  slewRateDegPerSec: number
  /** Candidate must beat current score by this fraction to switch. */
  switchAdvantage: number
  /** While strongly committed (Heavy charge / Phase beam), extra stickiness. */
  committedSwitchAdvantage?: number
  firesWhileTraversing: boolean
  requiresStabilisedAim: boolean
  /** Extra near-centre alignment for Heavy / Phase, in degrees. */
  aimToleranceDeg: number
  /** Heavy Lance: charge/release, not a free pre-charge. */
  requiresCharge: boolean
  chargeDurationSec: number
  /** Orbit speed multiplier while charging / beaming. 1 = unchanged. */
  committedOrbitFactor: number
}

const THREAT_FOCUS_EXEC_SHIELD = ['threat', 'focus', 'execution', 'shield'] as const
const HEAVY_FOCUS_SHIELD_THREAT = ['heavy', 'focus', 'shield', 'threat'] as const
const CLUSTER_THREAT_EXEC = ['cluster', 'threat', 'execution'] as const
const FOCUS_HEAVY_SHIELD = ['focus', 'heavy', 'shield'] as const
const CLUSTER_HEAVY_THREAT = ['cluster', 'heavy', 'threat'] as const

export const PULSE_TARGETING_PROFILE: CoreTargetingProfile = {
  profileId: 'pulse-cannon',
  moduleIds: ['pulse-cannon'],
  defaultDoctrine: 'threat',
  allowedDoctrines: THREAT_FOCUS_EXEC_SHIELD,
  fireRange: 170,
  acquisitionRange: 240,
  firingArcDeg: 150,
  slewRateDegPerSec: 240,
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
  slewRateDegPerSec: 90,
  switchAdvantage: 0.52,
  committedSwitchAdvantage: 0.52,
  firesWhileTraversing: false,
  requiresStabilisedAim: true,
  aimToleranceDeg: 6,
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
  slewRateDegPerSec: 360,
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
  slewRateDegPerSec: 150,
  switchAdvantage: 0.45,
  committedSwitchAdvantage: 0.65,
  firesWhileTraversing: false,
  requiresStabilisedAim: true,
  aimToleranceDeg: 8,
  requiresCharge: false,
  chargeDurationSec: 0,
  committedOrbitFactor: 0.18,
}

export const SLAG_TARGETING_PROFILE: CoreTargetingProfile = {
  profileId: 'slag-spitter',
  /** Current catalogue id is `slag-spit` until PR4's final Core catalogue. */
  moduleIds: ['slag-spitter', 'slag-spit'],
  defaultDoctrine: 'cluster',
  allowedDoctrines: CLUSTER_HEAVY_THREAT,
  fireRange: 180,
  acquisitionRange: 250,
  firingArcDeg: 175,
  slewRateDegPerSec: 220,
  switchAdvantage: 0.2,
  firesWhileTraversing: true,
  requiresStabilisedAim: false,
  aimToleranceDeg: 180,
  requiresCharge: false,
  chargeDurationSec: 0,
  committedOrbitFactor: 1,
}

/**
 * Isolated temporary fallback for non-final weapon Core IDs until PR4.
 * Not a compatibility layer and not a per-Core custom profile.
 *
 * Current main IDs that use this:
 * - rail-driver
 * - ion-burst
 * - charge-prism
 * - swarm-rack
 * - arc-lash
 * plus any other unexpected weapon role module.
 */
export const LEGACY_CORE_TARGETING_FALLBACK: CoreTargetingProfile = {
  profileId: 'legacy-fallback',
  moduleIds: ['rail-driver', 'ion-burst', 'charge-prism', 'swarm-rack', 'arc-lash'],
  defaultDoctrine: 'threat',
  allowedDoctrines: ['threat', 'focus', 'execution', 'heavy', 'shield', 'cluster'],
  fireRange: 150,
  acquisitionRange: 210,
  firingArcDeg: 180,
  slewRateDegPerSec: 180,
  switchAdvantage: 0.25,
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
]

const BY_MODULE = new Map<string, CoreTargetingProfile>()
for (const profile of CANONICAL) {
  for (const id of profile.moduleIds) BY_MODULE.set(id, profile)
}

export const LEGACY_FALLBACK_MODULE_IDS = LEGACY_CORE_TARGETING_FALLBACK.moduleIds

export function isCanonicalWeaponModule(moduleId: string): boolean {
  return BY_MODULE.has(moduleId)
}

export function targetingProfileFor(moduleId: string): CoreTargetingProfile {
  const authored = BY_MODULE.get(moduleId)
  if (authored) return authored
  const weaponRange = getModule(moduleId)?.weapon?.range
  const fire = Number.isFinite(weaponRange) && (weaponRange ?? 0) > 0 ? (weaponRange as number) : 150
  return {
    ...LEGACY_CORE_TARGETING_FALLBACK,
    fireRange: fire,
    acquisitionRange: fire * 1.4,
  }
}
