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
import { equipPostTutorialLoadout, forceUnlockModule } from './testHelpers'

describe('tickGame', () => {
  it('produces scrap from assigned worker stations over time', () => {
    let start = createInitialState(0)
    start.meta.highestSectorEver = 4
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
    start.meta.highestSectorEver = 4
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
    state.combat.campaign = true
    state = startCombat(state)
    // Place enemies inside weapon range on the orbital ring.
    for (const e of state.combat.enemyUnits) {
      e.x = 50
      e.y = 0
      e.engageRange = 50
    }
    const hullBefore = state.combat.enemyHull

    // Fire happens quickly; damage waits for projectile travel
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
    state = equipPostTutorialLoadout(state)
    state.combat.campaign = true
    state = setDocked(state, false)
    advanceTicks(state, 120)
    expect(state.combat.highestSector).toBeGreaterThanOrEqual(1)
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
  it('resolves a fight and advances expedition wave', () => {
    let state = equipPostTutorialLoadout(createInitialState(0))
    state = startCombat(state)
    expect(state.combat.inFight).toBe(true)

    const next = structuredClone(state)
    // Instantly clear several waves worth of fights
    for (let i = 0; i < 3; i += 1) {
      for (const e of next.combat.enemyUnits) e.hull = 0
      advanceTicks(next, 1)
      if (!next.combat.inFight) advanceTicks(next, 0.05)
    }
    expect(next.combat.bestWaveThisRun).toBeGreaterThanOrEqual(1)
    expect(next.combat.wave).toBeGreaterThan(1)
    expect(next.resources.scrap).toBeGreaterThan(0)
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
    state.meta.highestSectorEver = 4
    state.base.workerDrones = 2
    state = assignWorker(state, 'scrap-field', 1)
    expect(state.base.assignments['scrap-field']).toBe(1)
    state = assignWorker(state, 'scrap-field', 1)
    expect(state.base.assignments['scrap-field']).toBe(2)
  })

  it('blocks alloy foundry until alloy-smelting research', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 6
    state.base.workerDrones = 2
    const blocked = assignWorker(state, 'alloy-foundry', 1)
    expect(blocked.base.assignments['alloy-foundry'] ?? 0).toBe(0)

    state.research.unlocked = ['alloy-smelting']
    state = assignWorker(state, 'alloy-foundry', 1)
    expect(state.base.assignments['alloy-foundry']).toBe(1)
  })

  it('blocks drone fabricator until drone-logistics research', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 4
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
    state.meta.highestSectorEver = 6
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
    state.meta.highestSectorEver = 4
    state.base.workerDrones = 2
    state = assignWorker(state, 'scrap-field', 1)
    state = assignWorker(state, 'power-grid', 1)
    const rates = computeResourceRates(state)
    expect(rates.scrap).toBeGreaterThan(0)
    expect(rates.energy).toBeGreaterThan(0)
  })

  it('lets Alloy Foundry upkeep pull scrap net negative', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 8
    state.research.unlocked = [...state.research.unlocked, 'alloy-smelting']
    state.base.workerDrones = 6
    state.resources.scrap = 500
    state = assignWorker(state, 'scrap-field', 1)
    for (let i = 0; i < 5; i += 1) state = assignWorker(state, 'alloy-foundry', 1)
    const rates = computeResourceRates(state)
    // 1×0.4 scrap − 5×0.16 foundry upkeep = −0.4/s
    expect(rates.scrap).toBeCloseTo(-0.4, 5)
    expect(rates.alloys).toBeGreaterThan(0)
  })

  it('buys research and AI nodes', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 8
    state.resources.data = 40
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
    state.meta.highestSectorEver = 8
    state = unlockFrame(state, 'line-frame')
    state = selectFrame(state, 'line-frame')
    expect(state.shipyard.frameId).toBe('line-frame')
    state = forceUnlockModule(state, 'vector-thruster')
    state = fitModule(state, 'vector-thruster')
    expect(state.shipyard.modules).toContain('vector-thruster')
  })
})

describe('prestige and challenges', () => {
  it('prestiges at wave threshold and keeps fitted loadout', () => {
    let state = createInitialState(0)
    state.meta.highestWaveEver = 50
    state.combat.bestWaveThisRun = 50
    state.resources.scrap = 999
    state.resources.alloys = 999
    state = unlockModule(state, 'plate-layer')
    state = fitModule(state, 'plate-layer')
    state = performPrestige(state, 1000)
    expect(state.prestige.prestigeCount).toBe(1)
    expect(state.resources.prestigeMatter).toBeGreaterThan(0)
    expect(state.combat.sector).toBe(1)
    expect(state.combat.wave).toBe(1)
    expect(state.shipyard.unlockedModules).toContain('plate-layer')
    expect(state.shipyard.modules).toContain('pulse-cannon')
    expect(state.shipyard.modules).toContain('plate-layer')
    expect(state.base.workerDrones).toBeGreaterThanOrEqual(0)
    expect(Object.keys(state.base.assignments)).toHaveLength(0)
  })

  it('enters a challenge after Act 1 clear', () => {
    let state = createInitialState(0)
    state.meta.act1Cleared = true
    state.meta.highestWaveEver = 100
    state.combat.bestWaveThisRun = 50
    state.combat.highestSector = 30
    state = enterChallenge(state, 'no-ai', 2000)
    expect(state.prestige.activeChallengeId).toBe('no-ai')
    expect(state.combat.wave).toBe(1)
    expect(state.shipyard.frameLocked).toBe(false)
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

    state.meta.highestWaveEver = 50
    state.combat.bestWaveThisRun = 50
    state = performPrestige(state, 1000)
    // Returning runs start with a salvage kit for early module levels.
    expect(state.resources.salvage).toBe(9)
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
