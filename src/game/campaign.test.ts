import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { advanceTicks, setCampaign, startCombat, warpToSector } from './tick'
import { maybeAdvanceBossPhase } from './combat'

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

  it('does not repair hull between fights', () => {
    let state = createInitialState(0)
    state = setCampaign(state, false)
    state = startCombat(state)
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    flag.hull = 40
    for (const e of state.combat.enemyUnits) e.hull = 0
    advanceTicks(state, 1)
    expect(state.combat.playerHull).toBe(40)
    const nextFlag = state.combat.playerUnits.find((u) => u.isFlagship)
    expect(nextFlag?.hull).toBe(40)
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
