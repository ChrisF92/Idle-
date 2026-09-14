import { describe, expect, it } from 'vitest'
import { encounterForWave } from './combat'
import { getHostileDef } from './hostileCatalogue'
import {
  eligibleSpawnWeights,
  hostileSpawnWeight,
  ordinarySpawnPlan,
  ordinarySpawnRate,
} from './spawnDirector'
import { createInitialState } from './state'
import { advanceSeconds, startCombat } from './tick'

function seededState(seed: number) {
  const state = createInitialState(0)
  state.lastTickAt = 1
  state.combat.sortieSeed = seed
  return state
}

describe('GDD deterministic weighted spawning', () => {
  it('raises ordinary spawn rate across Act 1 without changing the seven-second Wave clock', () => {
    expect(ordinarySpawnRate(1)).toBeCloseTo(3, 6)
    expect(ordinarySpawnRate(500)).toBeGreaterThan(ordinarySpawnRate(1))
    expect(ordinarySpawnRate(1000)).toBeCloseTo(6, 6)
  })

  it('produces identical plans for an identical seed and preserves first contact', () => {
    const a = ordinarySpawnPlan({ wave: 175, sortieSeed: 29, packageOrdinal: 4 })
    const b = ordinarySpawnPlan({ wave: 175, sortieSeed: 29, packageOrdinal: 4 })
    expect(a).toEqual(b)
    expect(a.offsets[0]).toBe(0)
    expect(a.defs[0]?.id).toBe('phase-wisp')
  })

  it('weights recent contacts above old contacts and keeps authored elites rare', () => {
    const mite = getHostileDef('void-mite')!
    const vessel = getHostileDef('resonance-vessel')!
    const sentinel = getHostileDef('choir-sentinel')!
    expect(hostileSpawnWeight(vessel, 820)).toBeGreaterThan(hostileSpawnWeight(mite, 820))
    expect(hostileSpawnWeight(sentinel, 820)).toBeLessThan(hostileSpawnWeight(vessel, 820))
    expect(eligibleSpawnWeights(100).some((row) => row.def.id === 'phase-wisp')).toBe(false)
  })

  it('stages later successful checks instead of spawning the whole Wave at once', () => {
    const state = startCombat(seededState(42))
    expect(state.combat.sortieSeed).toBe(42)
    expect(state.combat.sortieMark?.sortieSeed).toBe(42)
    expect(state.combat.waveReached).toBe(1)
    expect(state.combat.waveSpawn?.rate).toBeCloseTo(ordinarySpawnRate(1), 8)
    expect(state.combat.packages[0]?.pendingCount).toBe(0)
    for (const unit of state.combat.enemyUnits) {
      unit.hullMax = 1e9
      unit.hull = 1e9
      for (const weapon of unit.weapons) weapon.damage = 0
    }
    advanceSeconds(state, 7.1)
    const wave2 = state.combat.packages.find((pkg) => pkg.wave === 2)!
    expect(wave2.pendingCount).toBeGreaterThan(0)
    const staged = wave2.pendingCount
    advanceSeconds(state, 3)
    expect(wave2.pendingCount).toBeLessThan(staged)
  })

  it('does not treat every 10th Wave as an authored Boss mechanic', () => {
    expect(encounterForWave(10).isBoss).toBe(false)
    expect(encounterForWave(20).isBoss).toBe(false)
    expect(encounterForWave(30).mechanicId).toBeUndefined()
    expect(encounterForWave(300).mechanicId).toBeUndefined()
  })
})
