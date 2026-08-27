/**
 * PR7 / PR11-tunable encounter seeds.
 *
 * These are simulator starting points, not final balance. Do not scatter
 * copies through runtime. Canonical design remains
 * `docs/act1-canonical-design.md`.
 */

import type { FormationId } from './formations'

export type CommanderTraitId =
  | 'vanguard'
  | 'ironclad'
  | 'wardbearer'
  | 'rallying'
  | 'displacer'
  | 'suppressor'
  | 'volatile'
  | 'breacher'

/** Ordinary Hull/Shield: 1.011 ^ (Wave - 1). */
export const ENEMY_HULL_SHIELD_SCALE = 1.011

/** Ordinary outgoing damage: 1.0085 ^ (Wave - 1). */
export const ENEMY_DAMAGE_SCALE = 1.0085

/** Ordinary reward value: 1.0065 ^ (Wave - 1). */
export const ENEMY_REWARD_SCALE = 1.0065

export function enemyWaveScale(wave: number): number {
  return Math.pow(ENEMY_HULL_SHIELD_SCALE, Math.max(1, wave) - 1)
}

export function enemyDamageScale(wave: number): number {
  return Math.pow(ENEMY_DAMAGE_SCALE, Math.max(1, wave) - 1)
}

export function salvageWaveBase(wave: number): number {
  return Math.pow(ENEMY_REWARD_SCALE, Math.max(1, wave) - 1)
}

/**
 * Role-neutral development/simulator baseline used when a hostile's unique
 * combat profile is mechanically pending. Not Codex-canonical. Not a soft
 * counter. Not a unique mechanic.
 */
export const ROLE_NEUTRAL_BASELINE = {
  hull: 8,
  shield: 0,
  armor: 0,
  damage: 2.6,
  cooldown: 0.95,
  range: 48,
  speed: 36,
  engageRange: 84,
  kite: false,
} as const

/** Authored elite-role seed for Choir Sentinel / Crowned Husk. */
export const ELITE_ROLE_BASELINE = {
  hull: 22,
  shield: 10,
  armor: 3,
  damage: 3.4,
  cooldown: 1.15,
  range: 56,
  speed: 26,
  engageRange: 92,
  kite: false,
} as const

/** Resonance Vessel death-position hazard. Simulator seeds. */
export const RESONANCE_VESSEL_HAZARD = {
  radius: 36,
  damage: 8,
  delay: 0.5,
} as const

/** Breach Engine telegraphed partial-Shield-bypass spike. Simulator seeds. */
export const BREACH_ENGINE_SPIKE = {
  charge: 1.8,
  bypassFrac: 0.25,
  damageMult: 1.85,
  cooldown: 8,
} as const

/** Support / disruptor density cap per ordinary or Commander package. */
export const SUPPORT_CAP_PER_PACKAGE = 2
export const DISRUPTOR_CAP_PER_PACKAGE = 2

/**
 * Bounded formation/dispersion contribution to threat.
 * Wide angular spread adds targeting pressure without wild multipliers.
 */
export const FORMATION_DISPERSION_WEIGHT: Record<FormationId, number> = {
  spear: 0,
  pincer: 0.04,
  encirclement: 0.1,
  screen: 0.06,
  siege: 0.05,
  'swarm-burst': 0.03,
  'mixed-pressure': 0.08,
}

export const FORMATION_DISPERSION_WEIGHT_MAX = 0.12

export const ORDINARY_COUNT_MIN = 2
export const ORDINARY_COUNT_MAX = 6

/** Commander Wave total threat vs ordinary Wave of the same band. */
export const COMMANDER_WAVE_THREAT_MULT = 1.4

/** Commander itself consumes this share of the Commander-wave threat. */
export const COMMANDER_SELF_THREAT_SHARE = 0.45

export const COMMANDER_PROMOTION = {
  pending: { hull: 2.2, shield: 1.8, damage: 1.18, speed: 1, armorAdd: 0 },
  elite: { hull: 1.65, shield: 1.5, damage: 1.2, speed: 0.95, armorAdd: 2 },
} as const

export const COMMANDER_REWARD = {
  salvageMult: 4,
  scrapMult: 3,
  masteryMult: 1.6,
  materialChanceMult: 1.8,
  fragmentChanceMult: 1.5,
  choirAshMult: 1.75,
} as const

export const COMMANDER_PRIORITY_TERM = {
  base: 7,
  threatTraitBonus: 5,
  heavyBonus: 4,
  shieldBonus: 6,
  max: 18,
} as const

export const MAX_ACTIVE_COMMANDERS = 2

export const TRAIT_UNLOCK_WAVE: Record<CommanderTraitId, number> = {
  vanguard: 10,
  ironclad: 20,
  wardbearer: 60,
  rallying: 120,
  displacer: 280,
  suppressor: 330,
  volatile: 680,
  breacher: 760,
}

export const VANGUARD_SEEDS = {
  selfSpeedMult: 1.25,
  selfCycleMult: 1.12,
  auraSpeedMult: 1.08,
  auraRadius: 90,
} as const

export const IRONCLAD_SEEDS = {
  pending: { hullMult: 1.4, armorAdd: 3, speedMult: 0.92 },
  elite: { hullMult: 1.25, armorAdd: 4, speedMult: 0.88 },
} as const

export const WARDBEARER_SEEDS = {
  personalShieldFracOfHull: 0.45,
  allySupportShield: 6,
  auraRadius: 90,
  pulse: 1.5,
} as const

export const RALLYING_SEEDS = {
  allyCycleMult: 1.12,
  allySpeedMult: 1.05,
  auraRadius: 90,
} as const

export const DISPLACER_SEEDS = {
  telegraph: 1.2,
  moveDuration: 0.45,
  cooldown: 8,
  bearingDelta: 0.7,
  radiusDelta: 20,
} as const

export const SUPPRESSOR_SEEDS = {
  slewMult: 0.75,
  acquireMult: 0.8,
  /** Floor vs unmodified profile. Never zero. */
  floorMult: 0.35,
} as const

export const VOLATILE_SEEDS = {
  radius: 55,
  damage: 18,
  delay: 0.4,
} as const

export const BREACHER_SEEDS = {
  charge: 2.4,
  cooldown: 10,
  bypassFrac: 0.35,
  damageMult: 2.2,
} as const

export const BOSS_WARNING_DEFAULT = 2
export const BOSS_WARNING_CROWN = 2.5

/** Role-aware Boss durability/offense vs ordinary scaled hostiles. */
export const BOSS_SCALING = {
  championEhpMult: 6.5,
  signatureEhpMult: 11,
  crownEhpMult: 22,
  damageMult: 1.55,
  armorAdd: 4,
  shieldFrac: 0.35,
} as const

export const CHOIR_CROWN_SEEDS = {
  reconstructionHullFrac: 0.66,
  loopbreakHullFrac: 0.33,
  echoCount: 3,
  reconstructionNodes: 2,
  slamDamageMult: 2.4,
  slamTelegraph: 1.4,
  slamCooldown: 5,
  jamTelegraph: 0.8,
  jamDuration: 1.2,
  jamCooldown: 7,
  loopbreakExtra: 2,
} as const

/** W950 Choir Exarch II direct Crown Matrix recovery. Simulator seed. */
export const W950_CROWN_MATRIX_GRANT = 1

export const BOSS_KILL_SALVAGE_MULT = 5
export const BOSS_KILL_SCRAP_MULT = 2

/**
 * W10 onboarding pairing. Canonical does not author a specific pairing.
 * At W10 the only introduced hostile is Void Mite and the only unlocked
 * Trait is Vanguard, so this is an availability-constrained seed, not an
 * independently authored identity.
 */
export const W10_COMMANDER_SEED = {
  hostileId: 'void-mite' as const,
  traitId: 'vanguard' as const,
  status: 'pending-pairing' as const,
}
