import { describe, expect, it } from 'vitest'
import {
  ENEMY_HULL_EARLY,
  ENEMY_HULL_LATE,
  ENEMY_HULL_MID,
  enemyApproachTarget,
  enemyForSector,
  enemySectorScale,
  minimumPlayerWeaponRangeForSector,
} from './combat'
import { SHORT_RANGE_MAX } from './catalog'
import { wavesForSector } from './sectors'

function minExpectedPack(sector: number, boss: boolean): number {
  if (boss) return sector < 6 ? 3 : sector < 16 ? 4 : 5
  if (sector === 1) return 2
  if (sector <= 4) return 3
  if (sector <= 8) return 4
  if (sector <= 18) return 5
  return 6
}

describe('PR75 combat pacing', () => {
  it('lets ranged enemies establish standoff but eventually brings every enemy into minimum weapon range', () => {
    let sawLongRange = false
    for (let sector = 1; sector <= 80; sector += 1) {
      for (let wave = 1; wave <= wavesForSector(sector); wave += 1) {
        const encounter = enemyForSector(sector, wave)
        for (const enemy of encounter.units) {
          if (enemy.engageRange > SHORT_RANGE_MAX) sawLongRange = true
          const floor = minimumPlayerWeaponRangeForSector(sector)
          expect(enemyApproachTarget(enemy, 180, sector), `S${sector} W${wave} ${enemy.name}`).toBeLessThanOrEqual(floor)
        }
      }
    }
    expect(sawLongRange).toBe(true)
    expect(minimumPlayerWeaponRangeForSector(1)).toBe(180)
    expect(minimumPlayerWeaponRangeForSector(2)).toBe(SHORT_RANGE_MAX)
  })

  it('keeps normal and boss formations visually populated through Act 1', () => {
    for (const sector of [1, 3, 8, 9, 15, 19, 30, 51, 80]) {
      for (let wave = 1; wave <= wavesForSector(sector); wave += 1) {
        const encounter = enemyForSector(sector, wave)
        expect(encounter.units.length).toBeGreaterThanOrEqual(minExpectedPack(sector, encounter.isBoss))
        expect(encounter.units.length).toBeLessThanOrEqual(7)
      }
    }
  })

  it('keeps density pressure proportional across Route A and Route B', () => {
    const a = enemyForSector(9, 1, 'A')
    const b = enemyForSector(9, 1, 'B')
    const aHull = a.units.reduce((sum, u) => sum + u.hullMax, 0)
    const bHull = b.units.reduce((sum, u) => sum + u.hullMax, 0)
    expect(bHull / aHull).toBeGreaterThan(1.15)
    expect(bHull / aHull).toBeLessThan(1.45)
  })

  it('adds fractional-reward wing units instead of multiplying the kill economy', () => {
    const encounter = enemyForSector(30, 1)
    const wings = encounter.units.filter((u) => (u.rewardWeight ?? 1) < 1)
    expect(wings.length).toBeGreaterThan(0)
    expect(wings.every((u) => (u.rewardWeight ?? 1) <= 0.4)).toBe(true)
  })

  it('keeps enemy hull scaling monotonic while strengthening the previously soft mid band', () => {
    expect(ENEMY_HULL_EARLY).toBe(1.235)
    expect(ENEMY_HULL_MID).toBeGreaterThan(1.18)
    expect(ENEMY_HULL_LATE).toBeGreaterThan(1.2)
    for (let sector = 1; sector < 80; sector += 1) {
      expect(enemySectorScale(sector + 1)).toBeGreaterThan(enemySectorScale(sector))
    }
  })
})
