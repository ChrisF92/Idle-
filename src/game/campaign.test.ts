import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { advanceTicks, setCampaign, startCombat } from './tick'
import { maybeAdvanceBossPhase } from './combat'

describe('campaign combat', () => {
  it('holds instead of auto-engaging when Advance is off', () => {
    let state = createInitialState(0)
    state = setCampaign(state, false)
    expect(state.combat.campaign).toBe(false)
    advanceTicks(state, 2)
    expect(state.combat.inFight).toBe(false)
  })

  it('repairs hull gradually while Holding', () => {
    let state = createInitialState(0)
    state = setCampaign(state, false)
    state.combat.playerHull = 20
    state.combat.playerHullMax = 100
    advanceTicks(state, 5)
    expect(state.combat.playerHull).toBeGreaterThan(20)
    expect(state.combat.playerHull).toBeLessThanOrEqual(100)
  })

  it('warps to previous sector with full hull on death', () => {
    let state = createInitialState(0)
    state.combat.sector = 4
    state = startCombat(state)
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    flag.hull = 0
    advanceTicks(state, 1)
    expect(state.combat.sector).toBe(3)
    expect(state.combat.playerHull).toBe(state.combat.playerHullMax)
    // Continuous advance re-engages immediately
    expect(state.combat.inFight).toBe(true)
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
