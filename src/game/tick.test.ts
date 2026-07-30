import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { tickGame, startCombat } from './tick'
import { exportSave, importSave } from './save'

describe('tickGame', () => {
  it('produces scrap from scrap yard over time', () => {
    const start = createInitialState(0)
    const next = tickGame(start, 5000)
    expect(next.resources.scrap).toBeGreaterThan(0)
    expect(next.resources.energy).toBeGreaterThan(start.resources.energy)
  })

  it('resolves a fight and advances sector', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    expect(state.combat.inFight).toBe(true)

    // Enough ticks to finish placeholder fight
    state = tickGame(state, 60_000)
    expect(state.combat.sector).toBeGreaterThan(1)
    expect(state.resources.scrap).toBeGreaterThan(0)
  })
})

describe('save export/import', () => {
  it('round-trips game state', () => {
    const state = createInitialState(123)
    state.resources.scrap = 42
    const code = exportSave(state)
    const restored = importSave(code)
    expect(restored?.resources.scrap).toBe(42)
    expect(restored?.version).toBe(state.version)
  })
})
