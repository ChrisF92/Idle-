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
    start.combat.campaign = false
    const next = tickGame(start, 60_000)
    // Live path only applies LIVE_TICK_CAP seconds
    expect(next.lastTickAt - start.lastTickAt).toBe(5_000)
    const gained = next.resources.scrap - start.resources.scrap
    expect(gained).toBeGreaterThan(0)
    expect(gained).toBeLessThan(5)
  })

  it('campaign auto-engages the next fight', () => {
    let state = createInitialState(0)
    expect(state.combat.campaign).toBe(true)
    state = tickGame(state, 1000)
    expect(state.combat.inFight).toBe(true)
  })

  it('accumulates sub-second polls into combat ticks', () => {
    let state = createInitialState(0)
    state.combat.campaign = false
    state = startCombat(state)
    const hullBefore = state.combat.enemyHull

    state = tickGame(state, 250)
    state = tickGame(state, 500)
    state = tickGame(state, 750)
    expect(state.combat.enemyHull).toBe(hullBefore)

    state = tickGame(state, 1000)
    expect(state.combat.enemyHull).toBeLessThan(hullBefore)
  })

  it('hull persists between chained fights under Advance', () => {
    let state = createInitialState(0)
    state.combat.campaign = true
    advanceTicks(state, 80)
    expect(state.combat.sector).toBeGreaterThan(1)
    // After some clears, either in a fight at partial hull or repairing — not always full
    if (state.combat.inFight) {
      const flag = state.combat.playerUnits.find((u) => u.isFlagship)
      expect(flag).toBeTruthy()
    } else {
      expect(state.combat.playerHull).toBeGreaterThan(0)
    }
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

  it('grants sector-scaled offline rewards without advancing sectors', () => {
    const state = createInitialState(0)
    state.combat.sector = 6
    state.combat.campaign = true
    const { state: next, report } = applyOfflineCatchUp(state, 3 * 60 * 1000)
    expect(next.combat.sector).toBe(6)
    expect(report?.sectorsCleared ?? 0).toBe(0)
    expect(next.resources.scrap).toBeGreaterThan(state.resources.scrap)
    expect(next.resources.aiPoints).toBeGreaterThan(state.resources.aiPoints)
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
  it('prestiges at sector threshold and keeps fitted loadout', () => {
    let state = createInitialState(0)
    state.combat.sector = 8
    state.resources.scrap = 999
    state.resources.alloys = 999
    state = unlockModule(state, 'plate-layer')
    state = fitModule(state, 'plate-layer')
    state = performPrestige(state, 1000)
    expect(state.prestige.prestigeCount).toBe(1)
    expect(state.resources.prestigeMatter).toBeGreaterThan(0)
    expect(state.combat.sector).toBe(1)
    expect(state.shipyard.unlockedModules).toContain('plate-layer')
    expect(state.shipyard.modules).toContain('pulse-cannon')
    expect(state.shipyard.modules).toContain('plate-layer')
    expect(state.base.buildings.scrapYard).toBe(1)
  })

  it('enters and completes a repeatable challenge', () => {
    let state = createInitialState(0)
    state.combat.sector = 8
    state = enterChallenge(state, 'no-ai', 2000)
    expect(state.prestige.activeChallengeId).toBe('no-ai')
    expect(state.combat.sector).toBe(1)

    state.combat.sector = 6
    state.combat.inFight = true
    state.combat.enemyUnits = [
      {
        id: 'e',
        side: 'enemy',
        name: 'Dummy',
        shape: 'circle',
        family: 'swarm',
        hull: 1,
        hullMax: 1,
        shield: 0,
        shieldMax: 0,
        armor: 0,
        evasion: 0,
        damageTakenMult: 1,
        weapons: [],
        isBoss: false,
        isFlagship: false,
        dots: [],
      },
    ]
    state.combat.playerUnits = [
      {
        id: 'flagship',
        side: 'player',
        name: 'Flagship',
        shape: 'triangle',
        family: 'player',
        hull: 100,
        hullMax: 100,
        shield: 0,
        shieldMax: 0,
        armor: 0,
        evasion: 0,
        damageTakenMult: 1,
        weapons: [
          {
            id: 'w',
            name: 'Pulse',
            damage: 50,
            cooldown: 1,
            cooldownLeft: 0,
            tags: ['kinetic'],
            splash: 0,
            dotDuration: 0,
            dotDamage: 0,
          },
        ],
        isBoss: false,
        isFlagship: true,
        dots: [],
      },
    ]
    state.combat.enemyHull = 1
    state.combat.enemyHullMax = 1
    state.combat.playerHull = 100
    state.combat.playerHullMax = 100
    state = tickGame(state, state.lastTickAt + 1000)
    expect(state.prestige.challengeClears['no-ai']).toBe(1)
    expect(state.prestige.activeChallengeId).toBeNull()
    expect(state.resources.challengePoints).toBeGreaterThan(0)

    // Repeatable — can enter again after reaching sector gate
    state.combat.sector = 8
    state = enterChallenge(state, 'no-ai', 3000)
    expect(state.prestige.activeChallengeId).toBe('no-ai')
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
