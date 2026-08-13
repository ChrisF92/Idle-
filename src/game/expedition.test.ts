/**
 * Phase 1 Expedition loop: orbital waves, Extract / Defeat, PM curve.
 */
import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  advanceSeconds,
  beginFight,
  setDocked,
} from './tick'
import { extractExpedition, defeatExpedition } from './expedition'
import { SAVE_VERSION } from './state'
import { canPrestige, prestigeGainFor } from './actions'
import { basePrestigeMatterForWave } from './prestigeMatter'
import { arenaDistance } from './arena'

describe('Phase 1 Expedition', () => {
  it('uses save version 23', () => {
    expect(createInitialState().version).toBe(SAVE_VERSION)
    expect(SAVE_VERSION).toBe(23)
  })

  it('launches into radial combat with perimeter spawns', () => {
    let state = createInitialState(0)
    state = setDocked(state, false)
    advanceSeconds(state, 0.05)
    expect(state.combat.inFight).toBe(true)
    expect(state.combat.wave).toBe(1)
    expect(state.combat.sector).toBe(1)
    expect(state.shipyard.frameLocked).toBe(true)
    for (const u of state.combat.enemyUnits) {
      expect(arenaDistance(u, { x: 0, y: 0 })).toBeGreaterThan(140)
    }
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)
    expect(flag?.x).toBe(0)
    expect(flag?.y).toBe(0)
  })

  it('advances wave on clear instead of sector', () => {
    let state = createInitialState(0)
    state = setDocked(state, false)
    beginFight(state)
    // Nuke enemies
    for (const u of state.combat.enemyUnits) u.hull = 0
    advanceSeconds(state, 0.1)
    expect(state.combat.bestWaveThisRun).toBe(1)
    expect(state.combat.wave).toBe(2)
    expect(state.combat.sector).toBe(1)
  })

  it('pause freezes combat without resetting wave or repairing', () => {
    let state = createInitialState(0)
    state = setDocked(state, false)
    beginFight(state)
    state.combat.wave = 7
    state.combat.bestWaveThisRun = 6
    const hull = 40
    state.combat.playerHull = hull
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    flag.hull = hull
    state = setDocked(state, true)
    expect(state.combat.docked).toBe(true)
    expect(state.combat.wave).toBe(7)
    expect(state.combat.inFight).toBe(true)
    advanceSeconds(state, 2)
    expect(state.combat.playerHull).toBe(hull)
    expect(state.combat.wave).toBe(7)
  })

  it('refuses Extract before career wave 20', () => {
    let state = createInitialState(0)
    state.combat.bestWaveThisRun = 12
    state.combat.wave = 12
    state = extractExpedition(state)
    expect(state.resources.prestigeMatter).toBe(0)
    expect(state.combat.wave).toBe(12)
    expect(state.combat.log[0]).toMatch(/wave 20/i)
  })

  it('Extract awards base PM + 5% after wave 20', () => {
    let state = createInitialState(0)
    state.meta.highestWaveEver = 20
    state.combat.bestWaveThisRun = 50
    state.combat.wave = 50
    state.shipyard.frameLocked = true
    state = extractExpedition(state)
    expect(state.resources.prestigeMatter).toBeCloseTo(10.5, 5)
    expect(state.combat.lastRunSummary?.extracted).toBe(true)
    expect(state.prestige.prestigeCount).toBe(1)
  })

  it('Defeat awards base PM without Extraction bonus', () => {
    let state = createInitialState(0)
    state.meta.highestWaveEver = 25
    state.combat.bestWaveThisRun = 50
    state.combat.wave = 50
    state = defeatExpedition(state)
    expect(state.resources.prestigeMatter).toBeCloseTo(10, 5)
    expect(state.combat.lastRunSummary?.defeated).toBe(true)
  })

  it('gates canPrestige on career wave 20', () => {
    const state = createInitialState(0)
    expect(canPrestige(state)).toBe(false)
    state.meta.highestWaveEver = 20
    expect(canPrestige(state)).toBe(true)
    expect(prestigeGainFor(state)).toBeGreaterThanOrEqual(basePrestigeMatterForWave(20))
  })

  it('locks module refit after launch', async () => {
    const { fitModule, unlockModule } = await import('./actions')
    let state = createInitialState(0)
    state.resources.scrap = 100
    state = setDocked(state, false)
    expect(state.shipyard.frameLocked).toBe(true)
    state = unlockModule(state, 'plate-layer')
    const before = [...state.shipyard.modules]
    state = fitModule(state, 'plate-layer')
    expect(state.shipyard.modules).toEqual(before)
  })
})
