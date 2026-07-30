import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { tickGame, startCombat } from './tick'
import { exportSave, importSave } from './save'
import { buyAiNode, buyResearch, upgradeBuilding } from './actions'

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

    state = tickGame(state, 60_000)
    expect(state.combat.sector).toBeGreaterThan(1)
    expect(state.resources.scrap).toBeGreaterThan(0)
    expect(state.resources.aiPoints).toBeGreaterThan(0)
  })

  it('auto-engages when AI node is owned', () => {
    let state = createInitialState(0)
    state.ai.purchased = ['auto-engage']
    state = tickGame(state, 1000)
    expect(state.combat.inFight).toBe(true)
  })
})

describe('purchases', () => {
  it('upgrades scrap yard when affordable', () => {
    const state = createInitialState(0)
    state.resources.scrap = 100
    const next = upgradeBuilding(state, 'scrapYard')
    expect(next.base.buildings.scrapYard).toBe(2)
    expect(next.resources.scrap).toBeLessThan(100)
  })

  it('blocks foundry until alloy-smelting research', () => {
    const state = createInitialState(0)
    state.resources.scrap = 999
    state.resources.energy = 999
    const blocked = upgradeBuilding(state, 'foundry')
    expect(blocked.base.buildings.foundry ?? 0).toBe(0)

    state.research.unlocked = ['alloy-smelting']
    const unlocked = upgradeBuilding(state, 'foundry')
    expect(unlocked.base.buildings.foundry).toBe(1)
  })

  it('buys research and applies via combat damage path', () => {
    const state = createInitialState(0)
    state.resources.data = 10
    const next = buyResearch(state, 'basic-optics')
    expect(next.research.unlocked).toContain('basic-optics')
    expect(next.resources.data).toBe(0)
  })

  it('buys AI nodes with AI points', () => {
    const state = createInitialState(0)
    state.resources.aiPoints = 1
    const next = buyAiNode(state, 'auto-engage')
    expect(next.ai.purchased).toContain('auto-engage')
    expect(next.resources.aiPoints).toBe(0)
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
