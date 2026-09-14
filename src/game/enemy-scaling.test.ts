import { describe, expect, it } from 'vitest'
import {
  ACT1_ENEMY_SCALING,
  ENEMY_DAMAGE_SCALE,
  ENEMY_HULL_SHIELD_SCALE,
  ENEMY_REWARD_SCALE,
  enemyDamageScale,
  enemyScalingAtWave,
  enemyWaveScale,
  salvageWaveBase,
} from './enemyScaling'

describe('central Act 1 enemy scaling', () => {
  it('starts every global curve at identity on Wave 1', () => {
    expect(enemyScalingAtWave(1)).toEqual({
      wave: 1,
      hullShield: 1,
      outgoingDamage: 1,
      rewardValue: 1,
    })
    expect(enemyScalingAtWave(0)).toEqual(enemyScalingAtWave(1))
  })

  it('uses one uninterrupted exponential curve per layer', () => {
    for (const wave of [2, 10, 50, 100, 300, 650, 1000]) {
      expect(enemyWaveScale(wave)).toBeCloseTo(
        Math.pow(ENEMY_HULL_SHIELD_SCALE, wave - 1),
        10,
      )
      expect(enemyDamageScale(wave)).toBeCloseTo(
        Math.pow(ENEMY_DAMAGE_SCALE, wave - 1),
        10,
      )
      expect(salvageWaveBase(wave)).toBeCloseTo(
        Math.pow(ENEMY_REWARD_SCALE, wave - 1),
        10,
      )
    }
  })

  it('compounds by the same factor at every Wave instead of using stat bands', () => {
    for (const wave of [1, 29, 49, 99, 299, 649, 999]) {
      expect(enemyWaveScale(wave + 1) / enemyWaveScale(wave)).toBeCloseTo(
        ACT1_ENEMY_SCALING.hullShield.growth,
        12,
      )
      expect(enemyDamageScale(wave + 1) / enemyDamageScale(wave)).toBeCloseTo(
        ACT1_ENEMY_SCALING.outgoingDamage.growth,
        12,
      )
      expect(salvageWaveBase(wave + 1) / salvageWaveBase(wave)).toBeCloseTo(
        ACT1_ENEMY_SCALING.rewardValue.growth,
        12,
      )
    }
  })

  it('keeps durability ahead of damage and rewards across Act 1', () => {
    const late = enemyScalingAtWave(1000)
    expect(late.hullShield).toBeGreaterThan(late.outgoingDamage)
    expect(late.outgoingDamage).toBeGreaterThan(late.rewardValue)
  })
})
