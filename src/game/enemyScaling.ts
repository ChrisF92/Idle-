/**
 * Central Act 1 enemy-pressure curves.
 *
 * Hostile definitions own identity: base Hull, Shield, damage, movement and
 * mechanics. SpawnDirector owns density and composition. This module owns only
 * the smooth Wave multiplier applied to ordinary durability, outgoing damage
 * and reward value.
 *
 * Keep these layers independent. Balance player progression against this
 * stable baseline, and tune only one named curve in a balance PR.
 */

export interface ExponentialEnemyCurve {
  base: number
  growth: number
}

export const ACT1_ENEMY_SCALING = {
  hullShield: { base: 1, growth: 1.0205 },
  outgoingDamage: { base: 1, growth: 1.0085 },
  rewardValue: { base: 1, growth: 1.0065 },
} as const

/** Base Scrap paid when a Wave is secured, before authored modifiers. */
export function securedWaveScrapBase(wave: number): number {
  return Math.max(1, 1 + Math.floor(Math.max(1, wave) / 20))
}

/** Compatibility names used by existing combat and simulator callers. */
export const ENEMY_HULL_SHIELD_SCALE = ACT1_ENEMY_SCALING.hullShield.growth
export const ENEMY_DAMAGE_SCALE = ACT1_ENEMY_SCALING.outgoingDamage.growth
export const ENEMY_REWARD_SCALE = ACT1_ENEMY_SCALING.rewardValue.growth

function waveExponent(wave: number): number {
  return Math.max(1, wave) - 1
}

export function exponentialEnemyScale(curve: ExponentialEnemyCurve, wave: number): number {
  return curve.base * Math.pow(curve.growth, waveExponent(wave))
}

export function enemyWaveScale(wave: number): number {
  return exponentialEnemyScale(ACT1_ENEMY_SCALING.hullShield, wave)
}

export function enemyDamageScale(wave: number): number {
  return exponentialEnemyScale(ACT1_ENEMY_SCALING.outgoingDamage, wave)
}

export function salvageWaveBase(wave: number): number {
  return exponentialEnemyScale(ACT1_ENEMY_SCALING.rewardValue, wave)
}

export interface EnemyScalingSnapshot {
  wave: number
  hullShield: number
  outgoingDamage: number
  rewardValue: number
}

/** Readout for tests, telemetry and future balancing tools. */
export function enemyScalingAtWave(wave: number): EnemyScalingSnapshot {
  const normalizedWave = Math.max(1, wave)
  return {
    wave: normalizedWave,
    hullShield: enemyWaveScale(normalizedWave),
    outgoingDamage: enemyDamageScale(normalizedWave),
    rewardValue: salvageWaveBase(normalizedWave),
  }
}
