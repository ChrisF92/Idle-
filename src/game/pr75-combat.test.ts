import { describe, expect, it } from 'vitest'
import {
  ENEMY_HULL_EARLY,
  ENEMY_HULL_LATE,
  ENEMY_HULL_MID,
  enemyApproachTarget,
  encounterForWave,
  enemyForSector,
  enemySectorScale,
  HIVE_STANDOFF_MIN,
  lowestEquippedPlayerWeaponRange,
  minimumPlayerWeaponRangeForSector,
  simulateCombat,
} from './combat'
import { createInitialState } from './state'
import { startCombat } from './tick'
import { SHORT_RANGE_MAX, getModule } from './catalog'
import { wavesForSector } from './sectors'
import { forceUnlockModule } from './testHelpers'
import { coreOrbitRadius } from './hiveVisual'

function minExpectedPack(sector: number, boss: boolean): number {
  if (boss) return sector < 6 ? 3 : sector < 16 ? 4 : 5
  if (sector === 1) return 2
  if (sector <= 4) return 3
  if (sector <= 8) return 4
  if (sector <= 18) return 5
  return 6
}

describe('PR75 combat pacing', () => {
  it('parks each enemy at its role standoff without sitting outside the shortest equipped Core', () => {
    const starter = createInitialState(0)
    const pulseRange = getModule('pulse-cannon')!.weapon!.range
    expect(lowestEquippedPlayerWeaponRange(starter)).toBe(pulseRange)
    let sawCloserRoles = false
    let sawCappedRoles = false
    for (let sector = 1; sector <= 80; sector += 1) {
      for (let wave = 1; wave <= wavesForSector(sector); wave += 1) {
        const encounter = enemyForSector(sector, wave)
        for (const enemy of encounter.units) {
          const hold = enemyApproachTarget(enemy, 0, sector, starter)
          expect(hold, `S${sector} W${wave} ${enemy.name}`).toBeLessThanOrEqual(pulseRange)
          expect(hold).toBeGreaterThan(coreOrbitRadius('heavy'))
          expect(hold).toBe(enemyApproachTarget(enemy, 180, sector, starter))
          expect(Math.max(...enemy.weapons.map((w) => w.range))).toBeGreaterThanOrEqual(hold)
          if (hold < pulseRange) sawCloserRoles = true
          if (enemy.engageRange > pulseRange) sawCappedRoles = true
        }
      }
    }
    expect(sawCloserRoles).toBe(true)
    expect(sawCappedRoles).toBe(true)
    expect(minimumPlayerWeaponRangeForSector(1)).toBe(SHORT_RANGE_MAX)
    expect(minimumPlayerWeaponRangeForSector(2, starter)).toBe(pulseRange)
    expect(enemyApproachTarget({ engageRange: 24 }, 0, 2, starter)).toBe(HIVE_STANDOFF_MIN)
    expect(enemyApproachTarget({ engageRange: 84 }, 0, 2, starter)).toBe(84)
    expect(enemyApproachTarget({ engageRange: 118 }, 0, 2, starter)).toBe(pulseRange)
    expect(enemyApproachTarget({ engageRange: 118 })).toBe(SHORT_RANGE_MAX)
  })

  it('pulls every park in to Flak when that is the shortest fitted gun', () => {
    let flak = forceUnlockModule(createInitialState(0), 'flak-array')
    flak.shipyard.modules = ['flak-array']
    expect(lowestEquippedPlayerWeaponRange(flak)).toBe(SHORT_RANGE_MAX)
    expect(enemyApproachTarget({ engageRange: 74 }, 0, 2, flak)).toBe(SHORT_RANGE_MAX)
    expect(enemyApproachTarget({ engageRange: 118 }, 0, 2, flak)).toBe(SHORT_RANGE_MAX)
  })

  it('stops living enemies short of the Hive and on their role hold', () => {
    let state = createInitialState(0)
    const parkCap = lowestEquippedPlayerWeaponRange(state)
    const parkFloor = Math.min(HIVE_STANDOFF_MIN, parkCap)
    state.combat.sector = 2
    state.combat.wave = 1
    state = startCombat(state)
    for (const unit of [...state.combat.playerUnits, ...state.combat.enemyUnits]) {
      for (const weapon of unit.weapons) {
        weapon.damage = 0
        weapon.cooldownLeft = 99
      }
    }
    for (let i = 0; i < 240; i += 1) simulateCombat(state, 1 / 30, () => {})
    const living = state.combat.enemyUnits.filter((unit) => unit.hull > 0)
    expect(living.length).toBeGreaterThan(0)
    for (const unit of living) {
      const hold = enemyApproachTarget(unit, state.combat.fightElapsed ?? 0, state.combat.sector, state)
      expect(unit.x).toBeGreaterThanOrEqual(parkFloor - 0.05)
      expect(unit.x).toBeLessThanOrEqual(parkCap + 0.05)
      expect(unit.x).toBeCloseTo(hold, 0)
    }
  })

  it('rotates authored wave patterns inside a GDD family band', () => {
    const early = encounterForWave(41)
    const later = encounterForWave(45)
    expect(early.family).toBe('armored')
    expect(later.family).toBe('armored')
    const rolesEarly = early.units.filter((u) => (u.rewardWeight ?? 1) === 1).map((u) => u.role)
    const rolesLater = later.units.filter((u) => (u.rewardWeight ?? 1) === 1).map((u) => u.role)
    expect(rolesLater).not.toEqual(rolesEarly)
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
