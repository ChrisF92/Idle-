import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  enterChallenge,
  fitModule,
  unfitModule,
  canEnterChallenge,
} from './actions'
import {
  getChallenge,
  isChallengeUnlocked,
  isModuleBlockedByChallenge,
} from './catalog'
import { advanceTicks, setCampaign, startCombat } from './tick'
import { forceUnlockModule } from './testHelpers'

describe('challenge depth: Mono Pulse, Attrition, Long Haul', () => {
  it('defines the three new challenges at goal sector 30', () => {
    expect(getChallenge('mono-pulse')?.goalSector).toBe(30)
    expect(getChallenge('attrition')?.goalSector).toBe(30)
    expect(getChallenge('long-haul')?.goalSector).toBe(30)
  })

  it('unlocks Mono Pulse via short-range clear OR 2 prestiges', () => {
    const a = createInitialState(0)
    expect(isChallengeUnlocked(a, 'mono-pulse')).toBe(false)
    a.prestige.challengeClears = { 'short-range': 1 }
    expect(isChallengeUnlocked(a, 'mono-pulse')).toBe(true)

    const b = createInitialState(0)
    b.prestige.prestigeCount = 2
    expect(isChallengeUnlocked(b, 'mono-pulse')).toBe(true)
  })

  it('unlocks Attrition after Glass Frame clear', () => {
    const state = createInitialState(0)
    expect(isChallengeUnlocked(state, 'attrition')).toBe(false)
    state.prestige.challengeClears = { 'thin-hull': 1 }
    expect(isChallengeUnlocked(state, 'attrition')).toBe(true)
  })

  it('unlocks Long Haul via sector 25 career OR 3 prestiges', () => {
    const a = createInitialState(0)
    expect(isChallengeUnlocked(a, 'long-haul')).toBe(false)
    a.meta.highestSectorEver = 25
    expect(isChallengeUnlocked(a, 'long-haul')).toBe(true)

    const b = createInitialState(0)
    b.prestige.prestigeCount = 3
    expect(isChallengeUnlocked(b, 'long-haul')).toBe(true)
  })

  it('strips non-pulse weapons on Mono Pulse enter and blocks refit', () => {
    let state = createInitialState(0)
    state.prestige.prestigeCount = 2
    state.meta.act1Cleared = true
    state.combat.sector = 8
    state.meta.highestSectorEver = 10
    state.resources.scrap = 999
    state.resources.alloys = 999
    state = forceUnlockModule(state, 'heavy-lance')
    state = forceUnlockModule(state, 'flak-array')
    // Scout has 1W — swap pulse for lance before enter.
    state = unfitModule(state, 'pulse-cannon')
    state = fitModule(state, 'heavy-lance')
    expect(state.shipyard.modules).toContain('heavy-lance')

    expect(canEnterChallenge(state, 'mono-pulse')).toBe(true)
    state = enterChallenge(state, 'mono-pulse', 1000)
    expect(state.prestige.activeChallengeId).toBe('mono-pulse')
    expect(state.shipyard.modules).not.toContain('heavy-lance')
    expect(isModuleBlockedByChallenge('mono-pulse', 'heavy-lance')).toBe(true)
    expect(isModuleBlockedByChallenge('mono-pulse', 'pulse-cannon')).toBe(false)

    const blocked = fitModule(state, 'heavy-lance')
    expect(blocked.shipyard.modules).not.toContain('heavy-lance')
    // Pulse still allowed
    state = fitModule(state, 'pulse-cannon')
    expect(state.shipyard.modules).toContain('pulse-cannon')
    expect(computeShipStats(state).damage).toBeGreaterThan(0)
  })

  it('Attrition skips 25% missing hull recovery on fight win', () => {
    let state = createInitialState(0)
    state.prestige.prestigeCount = 1
    state.meta.act1Cleared = true
    state.prestige.challengeClears = { 'thin-hull': 1 }
    state.combat.sector = 8
    state.meta.highestSectorEver = 8
    state = enterChallenge(state, 'attrition', 2000)
    expect(state.prestige.activeChallengeId).toBe('attrition')

    state = setCampaign(state, false)
    state = startCombat(state)
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    flag.hull = 40
    for (const e of state.combat.enemyUnits) e.hull = 0
    advanceTicks(state, 1)
    // No 25% missing-hull heal (~62.5); only tiny field repair after the fight ends.
    expect(state.combat.playerHull).toBeGreaterThanOrEqual(40)
    expect(state.combat.playerHull).toBeLessThan(45)
  })
})

