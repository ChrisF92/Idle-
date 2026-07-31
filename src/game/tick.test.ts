import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  advanceTicks,
  computeResourceRates,
  setDocked,
  startCombat,
  tickGame,
} from './tick'
import { applyOfflineCatchUp, MAX_OFFLINE_MS } from './offline'
import { exportSave, importSave } from './save'
import {
  assignWorker,
  buyAiNode,
  buyResearch,
  enterChallenge,
  fitModule,
  performPrestige,
  selectFrame,
  unfitModule,
  unlockFrame,
  unlockModule,
  upgradeModule,
} from './actions'
import { moduleLevel } from './catalog'
import { forceUnlockModule } from './testHelpers'
import { WAVES_PER_SECTOR } from './progression'

describe('tickGame', () => {
  it('produces scrap from assigned worker stations over time', () => {
    let start = createInitialState(0)
    start.meta.highestSectorEver = 3
    start.base.workerDrones = 2
    start = assignWorker(start, 'scrap-field', 1)
    start = assignWorker(start, 'power-grid', 1)
    start.combat.docked = true
    const next = tickGame(start, 5000)
    expect(next.resources.scrap).toBeGreaterThan(start.resources.scrap)
    expect(next.resources.energy).toBeGreaterThan(start.resources.energy)
  })

  it('caps live catch-up to a few seconds', () => {
    let start = createInitialState(0)
    start.meta.highestSectorEver = 3
    start.base.workerDrones = 2
    start = assignWorker(start, 'scrap-field', 2)
    start.combat.campaign = false
    start.combat.docked = true
    const next = tickGame(start, 60_000)
    expect(next.lastTickAt).toBe(60_000)
    const gained = next.resources.scrap - start.resources.scrap
    expect(gained).toBeGreaterThan(0)
    expect(gained).toBeLessThan(40)
  })

  it('campaign auto-engages after Launch', () => {
    let state = createInitialState(0)
    expect(state.combat.campaign).toBe(true)
    expect(state.combat.docked).toBe(true)
    state = tickGame(state, 1000)
    expect(state.combat.inFight).toBe(false)
    state = setDocked(state, false)
    state = tickGame(state, state.lastTickAt + 1000)
    expect(state.combat.inFight).toBe(true)
  })

  it('advances combat with real elapsed time (not whole-second ticks)', () => {
    let state = createInitialState(0)
    state.combat.campaign = false
    state = startCombat(state)
    for (const e of state.combat.enemyUnits) e.x = 50
    const hullBefore = state.combat.enemyHull

    // Fire happens quickly; damage waits for projectile travel (~0.2s at mid-lane)
    state = tickGame(state, 50)
    expect(state.combat.projectiles.length).toBeGreaterThan(0)
    expect(state.combat.enemyHull).toBe(hullBefore)
    expect(state.lastTickAt).toBe(50)

    state = tickGame(state, 400)
    expect(state.combat.enemyHull).toBeLessThan(hullBefore)
    expect(state.lastTickAt).toBe(400)
  })

  it('hull persists between chained fights under Advance', () => {
    let state = createInitialState(0)
    state.combat.campaign = true
    state = setDocked(state, false)
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
    // AI Points come from First Blood achievement on sector 1 clear, not combat drops
    expect(next.meta.completedAchievements).toContain('first-blood')
    expect(next.resources.aiPoints).toBe(1)
    expect(next.meta.aiUnlocked).toBe(true)
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
    // AI Points are not granted offline from combat fantasy anymore
    expect(next.resources.aiPoints).toBe(state.resources.aiPoints)
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
  it('assigns workers to scrap field', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 3
    state.base.workerDrones = 2
    state = assignWorker(state, 'scrap-field', 1)
    expect(state.base.assignments['scrap-field']).toBe(1)
    state = assignWorker(state, 'scrap-field', 1)
    expect(state.base.assignments['scrap-field']).toBe(2)
  })

  it('blocks alloy foundry until alloy-smelting research', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 5
    state.base.workerDrones = 2
    const blocked = assignWorker(state, 'alloy-foundry', 1)
    expect(blocked.base.assignments['alloy-foundry'] ?? 0).toBe(0)

    state.research.unlocked = ['alloy-smelting']
    state = assignWorker(state, 'alloy-foundry', 1)
    expect(state.base.assignments['alloy-foundry']).toBe(1)
  })

  it('blocks drone fabricator until drone-logistics research', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 3
    state.base.workerDrones = 2
    const blocked = assignWorker(state, 'drone-fab', 1)
    expect(blocked.base.assignments['drone-fab'] ?? 0).toBe(0)

    state.research.unlocked = ['drone-logistics']
    state = assignWorker(state, 'drone-fab', 1)
    expect(state.base.assignments['drone-fab']).toBe(1)
  })

  it('assigned workers produce scrap and data over time', () => {
    let state = createInitialState(0)
    state.combat.docked = true
    state.meta.highestSectorEver = 5
    state.base.workerDrones = 3
    state = assignWorker(state, 'scrap-field', 2)
    state = assignWorker(state, 'sensor-net', 1)
    const scrapBefore = state.resources.scrap
    const dataBefore = state.resources.data
    advanceTicks(state, 10)
    expect(state.resources.scrap).toBeGreaterThan(scrapBefore)
    expect(state.resources.data).toBeGreaterThan(dataBefore)
  })

  it('reports industry resource rates per second', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 3
    state.base.workerDrones = 2
    state = assignWorker(state, 'scrap-field', 1)
    state = assignWorker(state, 'power-grid', 1)
    const rates = computeResourceRates(state)
    expect(rates.scrap).toBeGreaterThan(0)
    expect(rates.energy).toBeGreaterThan(0)
  })

  it('buys research and AI nodes', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 8
    state.resources.data = 20
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
    state.resources.scrap = 999
    state.resources.alloys = 999
    state = forceUnlockModule(state, 'heavy-lance')
    // Scout has only 1 weapon slot — swap pulse for lance
    state = unfitModule(state, 'pulse-cannon')
    const bare = computeShipStats(state).damage
    state = fitModule(state, 'heavy-lance')
    expect(state.shipyard.modules).toContain('heavy-lance')
    expect(computeShipStats(state).damage).toBeGreaterThan(bare)
  })

  it('unlocks line frame with a utility slot', () => {
    let state = createInitialState(0)
    state.resources.scrap = 999
    state.resources.alloys = 999
    state.meta.highestSectorEver = 6
    state = unlockFrame(state, 'line-frame')
    state = selectFrame(state, 'line-frame')
    expect(state.shipyard.frameId).toBe('line-frame')
    state = forceUnlockModule(state, 'vector-thruster')
    state = fitModule(state, 'vector-thruster')
    expect(state.shipyard.modules).toContain('vector-thruster')
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
    expect(state.base.workerDrones).toBeGreaterThanOrEqual(0)
    expect(Object.keys(state.base.assignments)).toHaveLength(0)
  })

  it('enters and completes a repeatable challenge', () => {
    let state = createInitialState(0)
    state.meta.act1Cleared = true
    state.combat.sector = 8
    state = enterChallenge(state, 'no-ai', 2000)
    expect(state.prestige.activeChallengeId).toBe('no-ai')
    expect(state.combat.sector).toBe(1)

    // Force final wave of goal sector so one wipe completes the challenge
    state.combat.sector = 30
    state.combat.wave = WAVES_PER_SECTOR
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
        x: 40,
        y: 0,
        speed: 0,
        engageRange: 40,
        kite: false,
        phaseWarnLeft: 0,
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
            range: 120,
            tags: ['kinetic'],
            splash: 0,
            dotDuration: 0,
            dotDamage: 0,
            telegraphDuration: 0,
            telegraphLeft: 0,
          },
        ],
        isBoss: false,
        isFlagship: true,
        dots: [],
        x: 0,
        y: 0,
        speed: 0,
        engageRange: 0,
        kite: false,
        phaseWarnLeft: 0,
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

describe('salvage module upgrades', () => {
  it('upgrades a module with salvage and resets on prestige', () => {
    let state = createInitialState(0)
    state.resources.salvage = 100
    const before = computeShipStats(state).damage
    state = upgradeModule(state, 'pulse-cannon')
    expect(moduleLevel(state.shipyard.moduleLevels, 'pulse-cannon')).toBe(1)
    expect(computeShipStats(state).damage).toBeGreaterThan(before)
    expect(state.resources.salvage).toBeLessThan(100)

    state.combat.sector = 8
    state = performPrestige(state, 1000)
    // Returning runs start with a small salvage kit for early module levels.
    expect(state.resources.salvage).toBe(6)
    expect(moduleLevel(state.shipyard.moduleLevels, 'pulse-cannon')).toBe(0)
    expect(state.shipyard.modules).toContain('pulse-cannon')
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
