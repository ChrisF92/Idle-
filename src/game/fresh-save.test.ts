import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { createFreshCareerState, startOpeningSortie } from './freshStart'
import { exportSave, importSave, loadOrCreateGame } from './save'
import { markHullLost } from './testHelpers'
import { setDocked } from './tick'

describe('fresh save vs existing docked save', () => {
  it('creates a genuinely new game already fighting Wave 1', () => {
    const fresh = createFreshCareerState(0)
    expect(fresh.shipyard.frameId).toBe('starter-frame')
    expect(fresh.shipyard.equippedCoreIds.length).toBeGreaterThan(0)
    expect(fresh.combat.docked).toBe(false)
    expect(fresh.combat.inFight).toBe(true)
    expect(fresh.combat.wave).toBe(1)
  })

  it('leaves a docked baseline docked — no auto-launch', () => {
    const docked = createInitialState(0)
    expect(docked.combat.docked).toBe(true)
    expect(docked.combat.inFight).toBe(false)
    expect(docked.combat.wave).toBe(1)
  })

  it('does not auto-launch an existing docked save on import', () => {
    const existing = markHullLost(createInitialState(0))
    existing.combat.docked = true
    existing.combat.inFight = false
    const loaded = importSave(exportSave(existing))
    expect(loaded?.combat.docked).toBe(true)
    expect(loaded?.combat.inFight).toBe(false)
  })

  it('does not auto-launch after extract/defeat/rebuild-style docking', () => {
    let state = createFreshCareerState(0)
    state = setDocked(state, true)
    expect(state.combat.docked).toBe(true)
    expect(state.combat.inFight).toBe(false)
    const again = startOpeningSortie(state)
    expect(again.combat.docked).toBe(false)
  })

  it('loadOrCreateGame with no save uses the opening Sortie', () => {
    localStorage.clear()
    const state = loadOrCreateGame(0)
    expect(state.combat.docked).toBe(false)
    expect(state.combat.inFight).toBe(true)
    expect(state.combat.wave).toBe(1)
  })
})
