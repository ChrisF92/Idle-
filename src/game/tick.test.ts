import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import { advanceTicks, startCombat, tickGame } from './tick'
import { applyOfflineCatchUp, MAX_OFFLINE_MS } from './offline'
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

  it('caps live catch-up to a few seconds', () => {
    const start = createInitialState(0)
    const next = tickGame(start, 60_000)
    // Live path only applies LIVE_TICK_CAP seconds of production
    const gained = next.resources.scrap - start.resources.scrap
    expect(gained).toBeGreaterThan(0)
    expect(gained).toBeLessThan(5)
  })

  it('auto-engages when AI node is owned', () => {
    let state = createInitialState(0)
    state.ai.purchased = ['auto-engage']
    state = tickGame(state, 1000)
    expect(state.combat.inFight).toBe(true)
  })

  it('accumulates sub-second polls into combat ticks', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    const hullBefore = state.combat.enemyHull

    // Simulate the UI interval: many <1s polls must not reset the clock.
    state = tickGame(state, 250)
    state = tickGame(state, 500)
    state = tickGame(state, 750)
    expect(state.combat.enemyHull).toBe(hullBefore)

    state = tickGame(state, 1000)
    expect(state.combat.enemyHull).toBeLessThan(hullBefore)
  })
})

describe('advanceTicks / combat', () => {
  it('resolves a fight and advances sector', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    expect(state.combat.inFight).toBe(true)

    const next = structuredClone(state)
    advanceTicks(next, 60)
    expect(next.combat.sector).toBeGreaterThan(1)
    expect(next.resources.scrap).toBeGreaterThan(0)
    expect(next.resources.aiPoints).toBeGreaterThan(0)
  })
})

describe('offline catch-up', () => {
  it('applies industry gains after a long absence', () => {
    const state = createInitialState(0)
    const { state: next, report } = applyOfflineCatchUp(state, 5 * 60 * 1000)
    expect(next.resources.scrap).toBeGreaterThan(state.resources.scrap)
    expect(report).not.toBeNull()
    expect(report!.gains.scrap ?? 0).toBeGreaterThan(0)
    expect(next.lastTickAt).toBe(5 * 60 * 1000)
  })

  it('pushes sectors offline when Auto Engage is owned', () => {
    const state = createInitialState(0)
    state.ai.purchased = ['auto-engage']
    const { state: next, report } = applyOfflineCatchUp(state, 3 * 60 * 1000)
    expect(next.combat.sector).toBeGreaterThan(1)
    expect(report?.sectorsCleared ?? 0).toBeGreaterThan(0)
  })

  it('caps applied offline time', () => {
    const state = createInitialState(0)
    const away = MAX_OFFLINE_MS + 2 * 60 * 60 * 1000
    const { report } = applyOfflineCatchUp(state, away)
    expect(report?.capped).toBe(true)
    expect(report?.appliedMs).toBe(MAX_OFFLINE_MS)
  })

  it('skips report for short gaps', () => {
    const state = createInitialState(0)
    const { report } = applyOfflineCatchUp(state, 10_000)
    expect(report).toBeNull()
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

    state.combat.sector = 6
    state.combat.inFight = true
    state.combat.enemyHull = 1
    state.combat.enemyHullMax = 1
    state.combat.playerHull = 100
    state.combat.playerHullMax = 100
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
