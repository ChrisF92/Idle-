import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState } from './state'
import {
  PROJECTILE_SPEED,
  SHIELD_REGEN_DELAY,
  enemyForSector,
  simulateCombat,
} from './combat'
import { wavesForSector } from './sectors'
import { advanceSeconds, setCampaign, setDocked, startCombat } from './tick'
import type { GameState } from './types'

function flagship(state: GameState) {
  return state.combat.playerUnits.find((u) => u.isFlagship)
}

/** Drive the live sim without death-heal so hull chip is observable. */
function watchFight(state: GameState, seconds: number) {
  const startHull = flagship(state)?.hull ?? 0
  const startShield = flagship(state)?.shield ?? 0
  let minHull = startHull
  let minShield = startShield
  const step = 1 / 30
  let elapsed = 0
  while (elapsed < seconds) {
    simulateCombat(state, step, () => undefined)
    elapsed += step
    const flag = flagship(state)
    if (!flag || flag.hull <= 0) {
      return {
        dead: true,
        won: false,
        minHull: 0,
        minShield,
        startHull,
        startShield,
        elapsed,
      }
    }
    minHull = Math.min(minHull, flag.hull)
    minShield = Math.min(minShield, flag.shield)
    if (!state.combat.enemyUnits.some((u) => u.hull > 0)) {
      return {
        dead: false,
        won: true,
        minHull,
        minShield,
        startHull,
        startShield,
        elapsed,
      }
    }
  }
  return {
    dead: false,
    won: false,
    minHull,
    minShield,
    startHull,
    startShield,
    elapsed,
  }
}

describe('early combat pacing', () => {
  it('S1 boss slam lands inside the Plate regen delay', () => {
    const pack = enemyForSector(1, wavesForSector(1))
    const boss = pack.units.find((u) => u.isBoss)
    expect(boss).toBeTruthy()
    const weapon = boss!.weapons[0]!
    const travel = boss!.engageRange / PROJECTILE_SPEED
    expect(weapon.telegraphDuration).toBeGreaterThan(0)
    expect(weapon.cooldown + weapon.telegraphDuration + travel).toBeLessThanOrEqual(
      SHIELD_REGEN_DELAY + 1e-6,
    )
  })

  it('S1 boss with L0 Plate breaks shield and chips hull', () => {
    let state = createInitialState(0)
    expect(state.shipyard.moduleLevels['plate-layer'] ?? 0).toBe(0)
    expect(computeShipStats(state).shieldMax).toBe(30)
    state.combat.wave = wavesForSector(1)
    state = startCombat(state)
    expect(state.combat.isBoss).toBe(true)

    // Isolate the titan so pack DPS cannot mask a slow slam.
    const boss = state.combat.enemyUnits.find((u) => u.isBoss)!
    state.combat.enemyUnits = [boss]
    for (const unit of state.combat.playerUnits) {
      for (const weapon of unit.weapons) {
        weapon.damage = 0
        weapon.cooldownLeft = 99
      }
    }

    const result = watchFight(state, 45)
    expect(result.minShield).toBe(0)
    expect(result.dead || result.minHull < result.startHull).toBe(true)
  })

  it('L0 Pulse + Plate still survives the opening S1 pack', () => {
    let s = createInitialState(0)
    s = setDocked(s, false)
    advanceSeconds(s, 12)
    expect(s.combat.docked).toBe(false)
    expect(s.combat.playerHull).toBeGreaterThan(0)
  })

  it('L0 Pulse + Plate can still clear sector 1', () => {
    let s = createInitialState(0)
    s = setCampaign(s, true)
    s = setDocked(s, false)
    advanceSeconds(s, 90)
    expect(s.combat.highestSector).toBeGreaterThanOrEqual(1)
    expect(s.combat.lastSortie?.outcome).not.toBe('defeat')
  })
})
