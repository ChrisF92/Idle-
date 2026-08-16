import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { advanceSeconds, setDocked, starterRefitGate } from './tick'
import { upgradeModule } from './actions'
import { moduleUpgradeCost, salvageToRankStarterCores, ensureStarterCoresTourSalvage } from './catalog'
import { closeSortie } from './sortieSummary'

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

  it('first hull loss banks enough Salvage to rank Pulse and Plate', () => {
    let state = createInitialState(0)
    expect(salvageToRankStarterCores(state)).toBe(
      moduleUpgradeCost(0, 'pulse-cannon') + moduleUpgradeCost(0, 'plate-layer'),
    )
    expect(salvageToRankStarterCores(state)).toBe(9)
    state.resources.salvage = 3
    closeSortie(state, 'defeat', 'Hull lost.')
    expect(state.resources.salvage).toBe(9)
    expect(state.meta.hullLostOnce).toBe(true)

    state = upgradeModule(state, 'pulse-cannon')
    expect(state.shipyard.moduleLevels['pulse-cannon']).toBe(1)
    expect(state.resources.salvage).toBe(6)
    state = upgradeModule(state, 'plate-layer')
    expect(state.shipyard.moduleLevels['plate-layer']).toBe(1)
    expect(state.resources.salvage).toBe(0)
  })

  it('tops up Salvage when Pulse is ranked but Plate is still unaffordable', () => {
    let state = createInitialState(0)
    state.meta.hullLostOnce = true
    state.shipyard.moduleLevels['pulse-cannon'] = 1
    state.resources.salvage = 3
    state = ensureStarterCoresTourSalvage(state)
    expect(state.resources.salvage).toBe(6)
    state = upgradeModule(state, 'plate-layer')
    expect(state.shipyard.moduleLevels['plate-layer']).toBe(1)
  })

  it('does not top up Salvage after both starter Cores are ranked', () => {
    const state = createInitialState(0)
    state.meta.hullLostOnce = true
    state.shipyard.moduleLevels['pulse-cannon'] = 1
    state.shipyard.moduleLevels['plate-layer'] = 1
    state.resources.salvage = 2
    closeSortie(state, 'defeat', 'Hull lost.')
    expect(state.resources.salvage).toBe(2)
  })
})
