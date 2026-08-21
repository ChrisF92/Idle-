import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { DEFEAT_SEQUENCE_S, advanceSeconds, setDocked, startCombat } from './tick'
import { GUIDE_STEPS, activeGuideStep } from './progression'

describe('sortie feel', () => {
  it('keeps the flagship in the lane between waves', () => {
    let state = createInitialState(0)
    state = setDocked(state, false)
    state = startCombat(state)
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)
    expect(flag).toBeTruthy()
    const id = flag!.id
    flag!.hull = Math.max(8, flag!.hullMax * 0.4)
    for (const e of state.combat.enemyUnits) e.hull = 0
    advanceSeconds(state, 1)
    expect(state.combat.inFight).toBe(true)
    expect(state.combat.wave).toBe(2)
    expect(state.combat.docked).toBe(false)
    const next = state.combat.playerUnits.find((u) => u.isFlagship)
    expect(next?.id).toBe(id)
    expect(state.combat.playerHull).toBeGreaterThan(0)
    expect(state.combat.playerHull).toBeLessThan(state.combat.playerHullMax)
  })

  it('holds the wreck on the field, then docks on death', () => {
    let state = createInitialState(0)
    state = setDocked(state, false)
    state = startCombat(state)
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    flag.hull = 0
    advanceSeconds(state, 0.2)
    expect(state.combat.docked).toBe(false)
    expect(state.combat.defeatLeft).toBeGreaterThan(0)
    expect(state.combat.playerHull).toBe(0)
    expect(state.combat.inFight).toBe(true)

    advanceSeconds(state, DEFEAT_SEQUENCE_S + 0.2)
    expect(state.combat.docked).toBe(true)
    expect(state.combat.defeatLeft).toBe(0)
    expect(state.combat.inFight).toBe(false)
    expect(state.combat.frontierHold).toBe(false)
    expect(state.combat.lastSortie.outcome).toBe('defeat')
    expect(state.combat.wave).toBe(1)
  })

  it('starts the live guide catalog on Dock', () => {
    const state = createInitialState(0)
    const step = activeGuideStep(state, 'dock')
    expect(step?.id).toBe('guide-launch')
    expect(step?.target).toBe('launch')
    expect(GUIDE_STEPS.some((s) => s.target === 'rebuild-btn')).toBe(false)
  })
})
