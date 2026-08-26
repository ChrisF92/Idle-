import { describe, expect, it } from 'vitest'
import {
  buildPlayerFleet,
  dealCombatDamage,
  enemyApproachTarget,
  simulateCombat,
  SPAWN_DISTANCE,
} from './combat'
import { ENEMY_PARK_MAX, getModule, lowestPlayerCoreRange, MIN_CORE_WEAPON_RANGE } from './catalog'
import { RADIAL_EDGE_RANGE } from './combatVisual'
import { createInitialState } from './state'
import { startCombat } from './tick'
import { coreOrbitRadius } from './hiveVisual'

describe('GDD Hive and orbiting Cores', () => {
  it('builds a Hive hull with weapon Cores as untargetable satellites', () => {
    const fleet = buildPlayerFleet(createInitialState(0))
    const hive = fleet.find((u) => u.isFlagship)
    const cores = fleet.filter((u) => u.isCore)
    expect(hive?.id).toBe('hive')
    expect(hive?.name).toBe('Hive')
    expect(hive?.weapons.filter((w) => w.id !== 'frame-battery')).toHaveLength(0)
    expect(cores.length).toBeGreaterThan(0)
    expect(cores.every((core) => core.untargetable)).toBe(true)
    expect(cores.every((core) => core.hull === 0 && core.hullMax === 0)).toBe(true)
    expect(cores.some((core) => core.coreModuleId === 'pulse-cannon' && core.weapons.length === 1)).toBe(true)
    expect(cores.some((core) => core.coreModuleId === 'plate-layer')).toBe(true)
    expect(cores[0]!.coreModuleId).toBe('pulse-cannon')
    expect(Math.hypot(cores[0]!.x, cores[0]!.y)).toBeCloseTo(coreOrbitRadius('pulse-cannon'))
  })

  it('lets enemies damage only the Hive', () => {
    let state = startCombat(createInitialState(0))
    const hive = state.combat.playerUnits.find((u) => u.isFlagship)!
    const core = state.combat.playerUnits.find((u) => u.isCore)!
    const hullBefore = hive.hull
    dealCombatDamage(core, 40, ['kinetic'])
    expect(core.hull).toBe(0)
    expect(hive.hull).toBe(hullBefore)
    hive.shield = 0
    dealCombatDamage(hive, 8, ['kinetic'])
    expect(hive.hull).toBeLessThan(hullBefore)

    for (const enemy of state.combat.enemyUnits) {
      enemy.x = 40
      enemy.y = 0
      enemy.engageRange = 40
      for (const weapon of enemy.weapons) {
        weapon.range = 80
        weapon.cooldownLeft = 0
        weapon.telegraphDuration = 0
        weapon.telegraphLeft = 0
      }
    }
    simulateCombat(state, 0.2, () => {})
    const shots = state.combat.projectiles.filter((p) => p.side === 'enemy')
    expect(shots.length).toBeGreaterThan(0)
    expect(shots.every((p) => p.toId === hive.id)).toBe(true)
  })

  it('fires player shots from the Core orbit, not the Hive origin', () => {
    let state = startCombat(createInitialState(0))
    const hive = state.combat.playerUnits.find((u) => u.isFlagship)!
    const core = state.combat.playerUnits.find((u) => u.isCore)!
    for (const enemy of state.combat.enemyUnits) {
      enemy.x = 70
      enemy.y = 0
      enemy.engageRange = 200
    }
    const target = state.combat.enemyUnits[0]
    if (target) {
      core.currentTargetId = target.id
      core.heading = Math.atan2(target.x - core.x, target.y - core.y)
    }
    for (const weapon of core.weapons) {
      weapon.range = 200
      weapon.cooldownLeft = 0
    }
    simulateCombat(state, 1 / 60, () => {})
    const shot = state.combat.projectiles.find((p) => p.side === 'player')
    expect(shot?.fromId).toBe(core.id)
    expect(Math.hypot(shot?.originX ?? 0, shot?.originY ?? 0)).toBeGreaterThan(10)
    expect(shot?.originY).not.toBeCloseTo(hive.y)
    expect(shot?.weaponId).toMatch(/pulse-cannon-wpn-0/)
  })

  it('keeps Pulse reach legal against enemies parked at the Hive standoff', () => {
    const state = createInitialState(0)
    const fleet = buildPlayerFleet(state)
    const pulse = fleet.find((u) => u.isCore)?.weapons[0]
    const hold = enemyApproachTarget({ engageRange: 84 })
    expect(pulse?.range).toBeGreaterThanOrEqual(hold)
    expect(hold).toBeGreaterThan(coreOrbitRadius('heavy-lance'))
    expect(pulse?.range).toBeGreaterThanOrEqual(ENEMY_PARK_MAX)
  })

  it('keeps every Core at or past the farthest park and short of spawn', () => {
    const pulse = getModule('pulse-cannon')!.weapon!.range
    const flak = getModule('flak-array')!.weapon!.range
    const lance = getModule('heavy-lance')!.weapon!.range
    const phase = getModule('phase-beam')!.weapon!.range
    expect(flak).toBeGreaterThanOrEqual(MIN_CORE_WEAPON_RANGE)
    expect(pulse).toBeGreaterThan(flak)
    expect(lance).toBeGreaterThan(pulse)
    expect(phase).toBeGreaterThan(pulse)
    expect(lance).toBeLessThan(SPAWN_DISTANCE)
    expect(flak).toBe(lowestPlayerCoreRange())
    expect(RADIAL_EDGE_RANGE).toBeLessThan(SPAWN_DISTANCE)
  })
})
