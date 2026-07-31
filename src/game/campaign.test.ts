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
  canPrestige,
  fitModule,
  performPrestige,
  selectFrame,
  unlockFrame,
  unlockModule,
} from './actions'

describe('campaign combat', () => {
  it('Hold farms the same sector after a clear', () => {
    let state = createInitialState(0)
    state = setCampaign(state, false)
    state = startCombat(state)
    expect(state.combat.sector).toBe(1)
    for (const e of state.combat.enemyUnits) e.hull = 0
    const scrapBefore = state.resources.scrap
    advanceTicks(state, 1)
    expect(state.combat.sector).toBe(1)
    expect(state.combat.highestSector).toBe(1)
    expect(state.resources.scrap).toBeGreaterThan(scrapBefore)
    // Hold keeps auto-engaging the same sector
    expect(state.combat.inFight).toBe(true)
  })

  it('Advance pushes to the next sector after a clear', () => {
    let state = createInitialState(0)
    state = setCampaign(state, true)
    state = startCombat(state)
    for (const e of state.combat.enemyUnits) e.hull = 0
    advanceTicks(state, 1)
    expect(state.combat.sector).toBe(2)
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
    // 40 + 40% of missing (max 130 → missing 90 → +36) = 76
    expect(state.combat.playerHull).toBeGreaterThan(40)
    expect(state.combat.playerHull).toBeLessThan(state.combat.playerHullMax)
    const nextFlag = state.combat.playerUnits.find((u) => u.isFlagship)
    expect(nextFlag?.hull).toBe(state.combat.playerHull)
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
    expect(state.combat.playerHull).toBe(state.combat.playerHullMax)
    // Continuous loop re-engages immediately
    expect(state.combat.inFight).toBe(true)
  })

  it('Warp jumps to a cleared sector and aborts the fight', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    for (const e of state.combat.enemyUnits) e.hull = 0
    advanceTicks(state, 1)
    expect(state.combat.sector).toBe(2)
    expect(state.combat.highestSector).toBe(1)

    state = startCombat(state)
    expect(state.combat.inFight).toBe(true)
    state = warpToSector(state, 1)
    expect(state.combat.sector).toBe(1)
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

  it('Dock pauses auto-engage so modules can be fitted', () => {
    let state = createInitialState(0)
    expect(state.combat.docked).toBe(true)
    state = setDocked(state, false)
    advanceTicks(state, 1)
    expect(state.combat.inFight).toBe(true)
    expect(state.shipyard.frameLocked).toBe(true)

    state = setDocked(state, true)
    expect(state.combat.docked).toBe(true)
    expect(state.combat.inFight).toBe(false)
    advanceTicks(state, 2)
    expect(state.combat.inFight).toBe(false)

    state.resources.scrap = 999
    state.resources.alloys = 999
    state = unlockModule(state, 'plate-layer')
    state = fitModule(state, 'plate-layer')
    expect(state.shipyard.modules).toContain('plate-layer')

    state = setDocked(state, false)
    advanceTicks(state, 1)
    expect(state.combat.docked).toBe(false)
    expect(state.combat.inFight).toBe(true)
    expect(state.combat.playerUnits.some((u) => u.armor > 0)).toBe(true)
  })

  it('repairs hull while Docked', () => {
    let state = createInitialState(0)
    state = setDocked(state, true)
    state.combat.playerHull = 40
    state.combat.playerHullMax = 130
    advanceTicks(state, 5)
    expect(state.combat.playerHull).toBeGreaterThan(40)
    expect(state.combat.playerHull).toBeLessThanOrEqual(130)
    expect(state.combat.inFight).toBe(false)
  })

  it('persists hull after a win (no full heal)', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    flag.hull = flag.hullMax * 0.6
    for (const e of state.combat.enemyUnits) e.hull = 0
    advanceTicks(state, 1)
    expect(state.combat.sector).toBe(2)
    expect(state.combat.playerHull).toBeLessThan(state.combat.playerHullMax)
  })

  it('reaches prestige sector on Advance with starter loadout', () => {
    let state = createInitialState(0)
    state = setDocked(state, false)
    advanceTicks(state, 420)
    expect(state.combat.highestSector).toBeGreaterThanOrEqual(5)
    expect(canPrestige(state)).toBe(true)
  })

  it('locks frame after Launch and blocks select until prestige', () => {
    let state = createInitialState(0)
    state.resources.scrap = 999
    state.resources.alloys = 999
    state = unlockFrame(state, 'line-frame')
    state = selectFrame(state, 'line-frame')
    expect(state.shipyard.frameId).toBe('line-frame')

    state = setDocked(state, false)
    expect(state.shipyard.frameLocked).toBe(true)
    state = selectFrame(state, 'scout-frame')
    expect(state.shipyard.frameId).toBe('line-frame')

    state.combat.sector = 8
    state = performPrestige(state, 1000)
    expect(state.combat.docked).toBe(true)
    expect(state.shipyard.frameLocked).toBe(false)
    state = selectFrame(state, 'scout-frame')
    expect(state.shipyard.frameId).toBe('scout-frame')
  })

  it('grants salvage on clear', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    for (const e of state.combat.enemyUnits) e.hull = 0
    const before = state.resources.salvage
    advanceTicks(state, 1)
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
