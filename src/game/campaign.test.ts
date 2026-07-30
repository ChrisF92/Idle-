import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  advanceTicks,
  resumeCampaign,
  setCampaign,
  setStance,
  startCombat,
  WALL_AFTER_LOSSES,
} from './tick'
import { computeFightDamage, maybeAdvanceBossPhase } from './combat'

describe('campaign combat', () => {
  it('assault stance deals more damage than bulwark', () => {
    let assault = createInitialState(0)
    assault = setStance(assault, 'assault')
    assault = startCombat(assault)

    let bulwark = createInitialState(0)
    bulwark = setStance(bulwark, 'bulwark')
    bulwark = startCombat(bulwark)

    expect(computeFightDamage(assault).playerDps).toBeGreaterThan(
      computeFightDamage(bulwark).playerDps,
    )
    expect(computeFightDamage(assault).enemyDps).toBeGreaterThan(
      computeFightDamage(bulwark).enemyDps,
    )
  })

  it('blocks stance changes during a fight', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    const locked = setStance(state, 'assault')
    expect(locked.combat.stance).toBe('skirmish')
  })

  it('walls campaign after repeated losses', () => {
    let state = createInitialState(0)
    state.combat.campaign = true
    state.combat.consecutiveLosses = WALL_AFTER_LOSSES - 1
    state = startCombat(state)
    // Force an instant loss
    state.combat.playerHull = 0
    state.combat.enemyHull = 1000
    advanceTicks(state, 1)
    expect(state.combat.walled).toBe(true)
    expect(state.combat.inFight).toBe(false)

    const beforeSector = state.combat.sector
    advanceTicks(state, 5)
    expect(state.combat.sector).toBe(beforeSector)
    expect(state.combat.inFight).toBe(false)

    state = resumeCampaign(state)
    expect(state.combat.walled).toBe(false)
    advanceTicks(state, 1)
    expect(state.combat.inFight).toBe(true)
  })

  it('can pause campaign', () => {
    let state = createInitialState(0)
    state = setCampaign(state, false)
    expect(state.combat.campaign).toBe(false)
    advanceTicks(state, 2)
    expect(state.combat.inFight).toBe(false)
  })

  it('advances boss phases automatically', () => {
    const state = createInitialState(0)
    state.combat.isBoss = true
    state.combat.bossPhase = 0
    state.combat.enemyFamily = 'titan'
    state.combat.enemyHullMax = 100
    state.combat.enemyHull = 60
    state.combat.enemyDamage = 10
    const logs: string[] = []
    maybeAdvanceBossPhase(state, (_s, line) => logs.push(line))
    expect(state.combat.bossPhase).toBe(1)
    expect(state.combat.enemyFamily).toBe('armored')

    state.combat.enemyHull = 30
    maybeAdvanceBossPhase(state, (_s, line) => logs.push(line))
    expect(state.combat.bossPhase).toBe(2)
    expect(state.combat.enemyFamily).toBe('ethereal')
    expect(logs.length).toBe(2)
  })
})
