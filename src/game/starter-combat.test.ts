import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { advanceSeconds, setDocked, startCombat, starterRefitGate } from './tick'

describe('Hiveworks starter (tutorial retired)', () => {
  it('starts with Pulse + Plate fitted and no launch gate', () => {
    const state = createInitialState(0)
    expect(state.shipyard.modules).toEqual(
      expect.arrayContaining(['pulse-cannon', 'plate-layer']),
    )
    expect(starterRefitGate(state)).toBeNull()
    expect(state.meta.starterCombatLesson).toBe(2)
  })

  it('does not script an instant death on launch', () => {
    let state = createInitialState(0)
    state = setDocked(state, false)
    advanceSeconds(state, 2)
    expect(state.combat.docked).toBe(false)
    expect(state.combat.inFight).toBe(true)
    expect(state.combat.playerHull).toBeGreaterThan(0)
  })

  it('first hull loss wipes Salvage; Scrap and Workshop persist instead', () => {
    let state = createInitialState(0)
    state = setDocked(state, false)
    state = startCombat(state)
    state.resources.salvage = 12
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)
    if (flag) flag.hull = 0
    state.combat.playerHull = 0
    advanceSeconds(state, 2)
    expect(state.resources.salvage).toBe(0)
    expect(state.meta.hullLostOnce).toBe(true)
    expect(state.combat.docked).toBe(true)
    expect(state.combat.lastSortie.outcome).toBe('defeat')
  })
})
