import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import { tickGame, startCombat } from './tick'
import { exportSave, importSave } from './save'
import {
  buyAiNode,
  buyResearch,
  enterChallenge,
  fitModule,
  performPrestige,
  unlockFrame,
  unlockModule,
  upgradeBuilding,
} from './actions'

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

  it('buys research and AI nodes', () => {
    let state = createInitialState(0)
    state.resources.data = 10
    state = buyResearch(state, 'basic-optics')
    expect(state.research.unlocked).toContain('basic-optics')

    state.resources.aiPoints = 1
    state = buyAiNode(state, 'auto-engage')
    expect(state.ai.purchased).toContain('auto-engage')
  })
})

describe('shipyard', () => {
  it('unlocks and fits modules that increase damage', () => {
    let state = createInitialState(0)
    const before = computeShipStats(state).damage
    state.resources.scrap = 999
    state.resources.alloys = 999
    state = unlockModule(state, 'heavy-lance')
    state = fitModule(state, 'heavy-lance')
    expect(state.shipyard.modules).toContain('heavy-lance')
    expect(computeShipStats(state).damage).toBeGreaterThan(before)
  })

  it('unlocks line frame', () => {
    let state = createInitialState(0)
    state.resources.scrap = 999
    state.resources.alloys = 999
    state = unlockFrame(state, 'line-frame')
    expect(state.shipyard.unlockedFrames).toContain('line-frame')
  })
})

describe('prestige and challenges', () => {
  it('prestiges at sector threshold and keeps ship unlocks', () => {
    let state = createInitialState(0)
    state.combat.sector = 8
    state.shipyard.unlockedModules = ['pulse-cannon', 'plate-layer']
    state.resources.scrap = 50
    state = performPrestige(state, 1000)
    expect(state.prestige.prestigeCount).toBe(1)
    expect(state.resources.prestigeMatter).toBeGreaterThan(0)
    expect(state.combat.sector).toBe(1)
    expect(state.shipyard.unlockedModules).toContain('plate-layer')
    expect(state.base.buildings.scrapYard).toBe(1)
  })

  it('enters and completes a challenge', () => {
    let state = createInitialState(0)
    state.combat.sector = 8
    state = enterChallenge(state, 'no-ai', 2000)
    expect(state.prestige.activeChallengeId).toBe('no-ai')
    expect(state.combat.sector).toBe(1)

    // Simulate clearing to sector 5 goal: after 5 clears, sector is 6
    state.combat.sector = 6
    state.ai.purchased = ['auto-engage']
    // Force a victory tick path via tryCompleteChallenge through combat
    state.combat.inFight = true
    state.combat.enemyHull = 1
    state.combat.enemyHullMax = 1
    state.combat.playerHull = 100
    state.combat.playerHullMax = 100
    // Damage is high enough to finish in one tick
    state = tickGame(state, state.lastTickAt + 1000)
    expect(state.prestige.completedChallenges).toContain('no-ai')
    expect(state.prestige.activeChallengeId).toBeNull()
    expect(state.resources.challengePoints).toBeGreaterThan(0)
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
