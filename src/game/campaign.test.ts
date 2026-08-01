import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  advanceTicks,
  setCampaign,
  setDocked,
  startCombat,
  warpToSector,
} from './tick'
import { maybeAdvanceBossPhase } from './combat'
import {
  buyAiNode,
  canPrestige,
  fitModule,
  performPrestige,
  selectFrame,
  unlockFrame,
  unlockModule,
} from './actions'
import { clearSector } from './testHelpers'

describe('campaign combat', () => {
  it('Hold farms the same sector after a clear', () => {
    let state = createInitialState(0)
    state = setCampaign(state, false)
    state = startCombat(state)
    expect(state.combat.sector).toBe(1)
    const scrapBefore = state.resources.scrap
    state = clearSector(state)
    expect(state.combat.sector).toBe(1)
    expect(state.combat.wave).toBe(1)
    expect(state.combat.highestSector).toBe(1)
    expect(state.resources.scrap).toBeGreaterThan(scrapBefore)
    // Hold keeps auto-engaging the same sector
    expect(state.combat.inFight).toBe(true)
  })

  it('Advance pushes to the next sector after a clear', () => {
    let state = createInitialState(0)
    state = setCampaign(state, true)
    state = startCombat(state)
    state = clearSector(state)
    expect(state.combat.sector).toBe(2)
    expect(state.combat.wave).toBe(1)
    expect(state.combat.highestSector).toBe(1)
  })

  it('applies only a partial clear heal (no full repair)', () => {
    let state = createInitialState(0)
    state = setCampaign(state, false)
    state = startCombat(state)
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    flag.hull = 40
    for (const e of state.combat.enemyUnits) e.hull = 0
    advanceTicks(state, 1)
    // Wave clear: 25% of missing hull (no full repair).
    expect(state.combat.playerHull).toBeGreaterThan(40)
    expect(state.combat.playerHull).toBeLessThan(state.combat.playerHullMax)
  })

  it('warps to previous sector with full hull on death', () => {
    let state = createInitialState(0)
    state.combat.sector = 4
    state.combat.highestSector = 4
    state = startCombat(state)
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    flag.hull = 0
    advanceTicks(state, 1)
    expect(state.combat.sector).toBe(3)
    expect(state.combat.wave).toBe(1)
    expect(state.combat.playerHull).toBe(state.combat.playerHullMax)
    // Continuous loop re-engages immediately
    expect(state.combat.inFight).toBe(true)
  })

  it('Warp jumps to a cleared sector and aborts the fight', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 8
    state.resources.aiPoints = 10
    state = buyAiNode(state, 'warp-navigator')
    state = startCombat(state)
    state = clearSector(state)
    expect(state.combat.sector).toBe(2)
    expect(state.combat.highestSector).toBe(1)

    state = startCombat(state)
    expect(state.combat.inFight).toBe(true)
    state = warpToSector(state, 1)
    expect(state.combat.sector).toBe(1)
    expect(state.combat.wave).toBe(1)
    expect(state.combat.inFight).toBe(false)
    advanceTicks(state, 1)
    expect(state.combat.inFight).toBe(true)
    expect(state.combat.sector).toBe(1)
  })

  it('rejects Warp to uncleared sectors', () => {
    let state = createInitialState(0)
    state = warpToSector(state, 1)
    expect(state.combat.sector).toBe(1)
    expect(state.combat.highestSector).toBe(0)
  })

  it('Pause stops auto-engage, resets sector to W1, and allows refit', () => {
    let state = createInitialState(0)
    expect(state.combat.docked).toBe(true)
    state = setDocked(state, false)
    advanceTicks(state, 1)
    expect(state.combat.inFight).toBe(true)
    expect(state.shipyard.frameLocked).toBe(true)

    // Progress into the sector, then Pause should rewind to W1.
    for (const e of state.combat.enemyUnits) e.hull = 0
    advanceTicks(state, 1)
    expect(state.combat.wave).toBeGreaterThan(1)

    state = setDocked(state, true)
    expect(state.combat.docked).toBe(true)
    expect(state.combat.inFight).toBe(false)
    expect(state.combat.wave).toBe(1)
    advanceTicks(state, 2)
    expect(state.combat.inFight).toBe(false)
    expect(state.combat.wave).toBe(1)

    state.resources.scrap = 999
    state.resources.alloys = 999
    state = unlockModule(state, 'plate-layer')
    state = fitModule(state, 'plate-layer')
    expect(state.shipyard.modules).toContain('plate-layer')

    state = setDocked(state, false)
    advanceTicks(state, 1)
    expect(state.combat.docked).toBe(false)
    expect(state.combat.inFight).toBe(true)
    expect(state.combat.wave).toBe(1)
    expect(state.combat.playerUnits.some((u) => u.armor > 0)).toBe(true)
  })

  it('chains waves with no intermission', () => {
    let state = createInitialState(0)
    state = setDocked(state, false)
    advanceTicks(state, 1)
    expect(state.combat.inFight).toBe(true)
    expect(state.combat.wave).toBe(1)
    for (const e of state.combat.enemyUnits) e.hull = 0
    advanceTicks(state, 1)
    expect(state.combat.inFight).toBe(true)
    expect(state.combat.wave).toBe(2)
  })

  it('repairs hull while Paused', () => {
    let state = createInitialState(0)
    state = setDocked(state, true)
    state.combat.playerHull = 40
    state.combat.playerHullMax = 130
    advanceTicks(state, 5)
    expect(state.combat.playerHull).toBeGreaterThan(40)
    expect(state.combat.playerHull).toBeLessThanOrEqual(130)
    expect(state.combat.inFight).toBe(false)
  })

  it('AI never Pauses or Resumes combat', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 8
    state.meta.aiUnlocked = true
    state.resources.aiPoints = 10
    state = buyAiNode(state, 'auto-dock-critical')
    state = buyAiNode(state, 'auto-launch-ready')
    expect(state.ai.purchased).toContain('auto-dock-critical')
    expect(state.ai.purchased).toContain('auto-launch-ready')
    state = setDocked(state, false)
    advanceTicks(state, 1)
    expect(state.combat.inFight).toBe(true)

    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    flag.hull = 10
    flag.shield = 0
    for (const e of state.combat.enemyUnits) e.hull = 0
    advanceTicks(state, 2)
    // Still fighting / auto-engaging — AI must not force Pause.
    expect(state.combat.docked).toBe(false)
    expect(state.combat.inFight).toBe(true)

    // Manual Pause stays paused; Field Repairs must not Resume.
    state = setDocked(state, true)
    advanceTicks(state, 20)
    expect(state.combat.docked).toBe(true)
    expect(state.combat.inFight).toBe(false)
  })

  it('persists hull after a win (no full heal)', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    flag.hull = flag.hullMax * 0.6
    state = clearSector(state)
    expect(state.combat.sector).toBe(2)
    expect(state.combat.playerHull).toBeLessThan(state.combat.playerHullMax)
  })

  it('reaches prestige sector on Advance with starter loadout', () => {
    let state = createInitialState(0)
    state = setDocked(state, false)
    for (let i = 0; i < 80 && state.combat.highestSector < 10; i++) {
      state = clearSector(state)
    }
    expect(state.combat.highestSector).toBeGreaterThanOrEqual(10)
    expect(state.combat.sector).toBeGreaterThanOrEqual(10)
    expect(canPrestige(state)).toBe(true)
  })

  it('locks frame after Launch and blocks select until prestige', () => {
    let state = createInitialState(0)
    state.resources.scrap = 999
    state.resources.alloys = 999
    state.meta.highestSectorEver = 8
    state = unlockFrame(state, 'line-frame')
    state = selectFrame(state, 'line-frame')
    expect(state.shipyard.frameId).toBe('line-frame')

    state = setDocked(state, false)
    expect(state.shipyard.frameLocked).toBe(true)
    state = selectFrame(state, 'scout-frame')
    expect(state.shipyard.frameId).toBe('line-frame')

    state.combat.sector = 10
    state.meta.highestSectorEver = 10
    state = performPrestige(state, 1000)
    expect(state.combat.docked).toBe(true)
    expect(state.shipyard.frameLocked).toBe(false)
    state = selectFrame(state, 'scout-frame')
    expect(state.shipyard.frameId).toBe('scout-frame')
  })

  it('grants salvage on clear', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    const before = state.resources.salvage
    state = clearSector(state)
    expect(state.resources.salvage).toBeGreaterThan(before)
  })

  it('advances boss phases automatically', () => {
    const state = createInitialState(0)
    state.combat.isBoss = true
    state.combat.bossPhase = 0
    state.combat.enemyFamily = 'titan'
    state.combat.enemyUnits = [
      {
        id: 'boss',
        side: 'enemy',
        name: 'Boss',
        shape: 'hex',
        family: 'titan',
        hull: 60,
        hullMax: 100,
        shield: 0,
        shieldMax: 0,
        armor: 0,
        evasion: 0,
        damageTakenMult: 1,
        weapons: [
          {
            id: 'bw',
            name: 'Strike',
            damage: 10,
            cooldown: 1,
            cooldownLeft: 0,
            range: 100,
            tags: ['kinetic'],
            splash: 0,
            dotDuration: 0,
            dotDamage: 0,
            telegraphDuration: 0.85,
            telegraphLeft: 0,
          },
        ],
        isBoss: true,
        isFlagship: true,
        dots: [],
        x: 100,
        y: 0,
        speed: 10,
        engageRange: 90,
        kite: true,
        phaseWarnLeft: 0,
      },
    ]
    const logs: string[] = []
    maybeAdvanceBossPhase(state, (_s, line) => logs.push(line))
    expect(state.combat.bossPhase).toBe(1)
    expect(state.combat.enemyFamily).toBe('armored')

    state.combat.enemyUnits[0]!.hull = 30
    maybeAdvanceBossPhase(state, (_s, line) => logs.push(line))
    expect(state.combat.bossPhase).toBe(2)
    expect(state.combat.enemyFamily).toBe('ethereal')
    expect(logs.length).toBe(2)
  })
})
