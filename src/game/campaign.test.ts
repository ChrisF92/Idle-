import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  advanceTicks,
  setCampaign,
  setDocked,
  startCombat,
} from './tick'
import { maybeAdvanceBossPhase } from './combat'
import {
  buyAiNode,
  canPrestige,
  fitModule,
  performPrestige,
  unlockModule,
} from './actions'
import { clearCurrentWave, clearWaves } from './testHelpers'

describe('expedition combat', () => {
  it('Push advances wave after a clear', () => {
    let state = createInitialState(0)
    state = setCampaign(state, true)
    state = startCombat(state)
    expect(state.combat.wave).toBe(1)
    const scrapBefore = state.resources.scrap
    state = clearCurrentWave(state)
    expect(state.combat.wave).toBe(2)
    expect(state.combat.bestWaveThisRun).toBe(1)
    expect(state.combat.sector).toBe(1)
    expect(state.resources.scrap).toBeGreaterThan(scrapBefore)
  })

  it('Hold request stays on Push in Phase 1', () => {
    let state = createInitialState(0)
    state = setCampaign(state, false)
    expect(state.combat.campaign).toBe(true)
    expect(state.combat.mode).toBe('push')
  })

  it('hull persists across waves with modest between-wave repair', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    flag.hull = Math.max(10, flag.hullMax * 0.4)
    state.combat.playerHull = flag.hull
    const before = state.combat.playerHull
    state = clearCurrentWave(state)
    // Between-wave repair restores some hull; should not full heal.
    expect(state.combat.playerHull).toBeGreaterThan(before)
    expect(state.combat.playerHull).toBeLessThan(state.combat.playerHullMax)
  })

  it('Pause freezes wave progress and blocks free repair', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    state.combat.wave = 5
    const hull = 55
    state.combat.playerHull = hull
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    flag.hull = hull
    state = setDocked(state, true)
    advanceTicks(state, 5)
    expect(state.combat.wave).toBe(5)
    expect(state.combat.playerHull).toBe(hull)
  })

  it('death ends the expedition (Defeat)', () => {
    let state = createInitialState(0)
    state.meta.starterCombatLesson = 2
    state.meta.highestWaveEver = 25
    state.combat.bestWaveThisRun = 25
    state.prestige.prestigeCount = 1
    state = startCombat(state)
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    flag.hull = 0
    state.combat.playerHull = 0
    advanceTicks(state, 1)
    expect(state.combat.docked).toBe(true)
    expect(state.combat.wave).toBe(1)
    expect(state.resources.prestigeMatter).toBeGreaterThan(0)
  })

  it('Prestige unlocks at career wave 20', () => {
    const state = createInitialState(0)
    expect(canPrestige(state)).toBe(false)
    state.meta.highestWaveEver = 20
    expect(canPrestige(state)).toBe(true)
  })

  it('clearing many waves raises career best', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    state = clearWaves(state, 5)
    expect(state.combat.bestWaveThisRun).toBeGreaterThanOrEqual(5)
    expect(state.meta.highestWaveEver).toBeGreaterThanOrEqual(5)
  })

  it('boss phase shifts retag the titan', () => {
    let state = createInitialState(0)
    state.combat.wave = 100
    state = startCombat(state)
    expect(state.combat.isBoss).toBe(true)
    const boss = state.combat.enemyUnits.find((u) => u.isBoss)!
    boss.hull = boss.hullMax * 0.5
    const log: string[] = []
    maybeAdvanceBossPhase(state, (_s, line) => log.push(line))
    expect(state.combat.bossPhase).toBeGreaterThanOrEqual(1)
  })

  it('blocks module refit while expedition is locked', () => {
    let state = createInitialState(0)
    state.resources.scrap = 200
    state = startCombat(state)
    state = unlockModule(state, 'plate-layer')
    const before = state.shipyard.modules.length
    state = fitModule(state, 'plate-layer')
    expect(state.shipyard.modules.length).toBe(before)
  })

  it('performPrestige resets expedition progress', () => {
    let state = createInitialState(0)
    state.meta.highestWaveEver = 40
    state.combat.bestWaveThisRun = 40
    state.combat.wave = 41
    state.shipyard.frameLocked = true
    state = performPrestige(state, 1000)
    expect(state.prestige.prestigeCount).toBe(1)
    expect(state.combat.wave).toBe(1)
    expect(state.shipyard.frameLocked).toBe(false)
  })
})

// Keep buyAiNode import used for future automation tests
void buyAiNode
