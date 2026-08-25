import { describe, expect, it } from 'vitest'
import {
  ENEMY_HULL_EARLY,
  ENEMY_HULL_LATE,
  ENEMY_HULL_MID,
  ENEMY_HULL_BASE,
  enemyApproachTarget,
  encounterForWave,
  enemyForSector,
  enemySectorScale,
  HIVE_STANDOFF_MIN,
  minimumPlayerWeaponRangeForSector,
  simulateCombat,
} from './combat'
import { createInitialState } from './state'
import { startCombat } from './tick'
import {
  ENEMY_PARK_MAX,
  MIN_CORE_WEAPON_RANGE,
  SHORT_RANGE_MAX,
  SHIP_MODULES,
  getModule,
} from './catalog'
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
  it('parks each enemy on a loadout-independent hold that every Core can reach', () => {
    const starter = createInitialState(0)
    const flakFitted = forceUnlockModule(createInitialState(0), 'flak-array')
    flakFitted.shipyard.modules = ['flak-array']
    let sawCloserRoles = false
    let sawFarRoles = false
    for (let sector = 1; sector <= 80; sector += 1) {
      for (let wave = 1; wave <= wavesForSector(sector); wave += 1) {
        const encounter = enemyForSector(sector, wave)
        for (const enemy of encounter.units) {
          const hold = enemyApproachTarget(enemy, 0, sector)
          expect(hold, `S${sector} W${wave} ${enemy.name}`).toBeLessThanOrEqual(ENEMY_PARK_MAX)
          expect(hold).toBeGreaterThan(coreOrbitRadius('heavy'))
          expect(hold).toBe(enemyApproachTarget(enemy, 180, sector, starter))
          expect(hold).toBe(enemyApproachTarget(enemy, 180, sector, flakFitted))
          expect(Math.max(...enemy.weapons.map((w) => w.range))).toBeGreaterThanOrEqual(hold)
          if (hold < ENEMY_PARK_MAX) sawCloserRoles = true
          if (hold >= 110) sawFarRoles = true
        }
      }
    }
    expect(sawCloserRoles).toBe(true)
    expect(sawFarRoles).toBe(true)
    expect(minimumPlayerWeaponRangeForSector(1)).toBe(ENEMY_PARK_MAX)
    expect(minimumPlayerWeaponRangeForSector(2, starter)).toBe(ENEMY_PARK_MAX)
    expect(enemyApproachTarget({ engageRange: 24 })).toBe(HIVE_STANDOFF_MIN)
    expect(enemyApproachTarget({ engageRange: 84 })).toBe(84)
    expect(enemyApproachTarget({ engageRange: 118 })).toBe(118)
    expect(enemyApproachTarget({ engageRange: 200 })).toBe(ENEMY_PARK_MAX)
  })

  it('requires every catalog Core gun to reach the farthest legal park', () => {
    for (const mod of SHIP_MODULES) {
      const range = mod.weapon?.range
      if (typeof range !== 'number' || range <= 0) continue
      expect(range, mod.id).toBeGreaterThanOrEqual(MIN_CORE_WEAPON_RANGE)
      expect(range, mod.id).toBeGreaterThanOrEqual(ENEMY_PARK_MAX)
    }
    expect(getModule('flak-array')!.weapon!.range).toBe(MIN_CORE_WEAPON_RANGE)
  })

  it('compresses parks only for Knife Fight, not because Flak is fitted', () => {
    const knife = createInitialState(0)
    knife.prestige.activeChallengeId = 'short-range'
    expect(minimumPlayerWeaponRangeForSector(1, knife)).toBe(SHORT_RANGE_MAX)
    expect(enemyApproachTarget({ engageRange: 118 }, 0, 2, knife)).toBe(SHORT_RANGE_MAX)
    const flak = forceUnlockModule(createInitialState(0), 'flak-array')
    flak.shipyard.modules = ['flak-array']
    expect(enemyApproachTarget({ engageRange: 118 }, 0, 2, flak)).toBe(118)
  })

  it('stops living enemies short of the Hive and on their role hold', () => {
    let state = createInitialState(0)
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
      const hold = enemyApproachTarget(unit, state.combat.fightElapsed ?? 0, state.combat.sector)
      expect(unit.x).toBeGreaterThanOrEqual(HIVE_STANDOFF_MIN - 0.05)
      expect(unit.x).toBeLessThanOrEqual(ENEMY_PARK_MAX + 0.05)
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

  it('ignores leftover Route B so both paths share the same encounter', () => {
    const a = enemyForSector(9, 1, 'A')
    const b = enemyForSector(9, 1, 'B')
    const aHull = a.units.reduce((sum, u) => sum + u.hullMax, 0)
    const bHull = b.units.reduce((sum, u) => sum + u.hullMax, 0)
    expect(bHull / aHull).toBe(1)
    expect(b.units.length).toBe(a.units.length)
  })

  it('adds fractional-reward wing units instead of multiplying the kill economy', () => {
    const encounter = enemyForSector(30, 1)
    const wings = encounter.units.filter((u) => (u.rewardWeight ?? 1) < 1)
    expect(wings.length).toBeGreaterThan(0)
    expect(wings.every((u) => (u.rewardWeight ?? 1) <= 0.4)).toBe(true)
  })

  it('keeps enemy hull scaling monotonic while steepening S4–S8 and leaving S1 on tutorial hull', () => {
    expect(enemySectorScale(1)).toBeCloseTo(ENEMY_HULL_BASE)
    expect(enemySectorScale(2)).toBeLessThan(ENEMY_HULL_BASE * Math.pow(1.235, 1))
    expect(enemySectorScale(7)).toBeGreaterThan(ENEMY_HULL_BASE * Math.pow(1.235, 6))
    expect(ENEMY_HULL_EARLY).toBeGreaterThan(1.23)
    expect(ENEMY_HULL_MID).toBeGreaterThan(1.18)
    expect(ENEMY_HULL_LATE).toBeGreaterThan(1.2)
    for (let sector = 1; sector < 80; sector += 1) {
      expect(enemySectorScale(sector + 1)).toBeGreaterThan(enemySectorScale(sector))
    }
  })
})
