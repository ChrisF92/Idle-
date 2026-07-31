import { describe, expect, it } from 'vitest'
import { createInitialState, buildFlagshipWeapons, computeShipStats } from './state'
import {
  enterChallenge,
  fitModule,
  unlockFrame,
  selectFrame,
  unlockModule,
  canEnterChallenge,
} from './actions'
import {
  SHORT_RANGE_MAX,
  getChallenge,
  isChallengeUnlocked,
  isModuleBlockedByChallenge,
} from './catalog'

describe('challenge pack: Bare Rig + Knife Fight', () => {
  it('defines Bare Rig and Knife Fight with unlock chain', () => {
    expect(getChallenge('no-utility')?.name).toBe('Bare Rig')
    expect(getChallenge('short-range')?.name).toBe('Knife Fight')
    expect(getChallenge('short-range')?.requiresChallengeClears).toEqual({
      challengeId: 'no-utility',
      clears: 1,
    })
  })

  it('locks Bare Rig until first prestige', () => {
    const state = createInitialState(0)
    expect(isChallengeUnlocked(state, 'no-utility')).toBe(false)
    state.prestige.prestigeCount = 1
    expect(isChallengeUnlocked(state, 'no-utility')).toBe(true)
  })

  it('locks Knife Fight until Bare Rig is cleared once', () => {
    const state = createInitialState(0)
    state.prestige.prestigeCount = 1
    expect(isChallengeUnlocked(state, 'short-range')).toBe(false)
    state.prestige.challengeClears = { 'no-utility': 1 }
    expect(isChallengeUnlocked(state, 'short-range')).toBe(true)
  })

  it('strips utility modules on Bare Rig enter and blocks refit', () => {
    let state = createInitialState(0)
    state.prestige.prestigeCount = 1
    state.combat.sector = 8
    state.meta.highestSectorEver = 8
    state.resources.scrap = 999
    state.resources.alloys = 999
    // Scout has 0U — use Line Frame for a utility slot.
    state = unlockFrame(state, 'line-frame')
    state = selectFrame(state, 'line-frame')
    state = unlockModule(state, 'vector-thruster')
    state = unlockModule(state, 'plate-layer')
    state = fitModule(state, 'vector-thruster')
    state = fitModule(state, 'plate-layer')
    expect(state.shipyard.modules).toContain('vector-thruster')

    state = enterChallenge(state, 'no-utility', 1000)
    expect(state.prestige.activeChallengeId).toBe('no-utility')
    expect(state.shipyard.modules).not.toContain('vector-thruster')
    expect(state.shipyard.modules).toContain('plate-layer')
    expect(isModuleBlockedByChallenge('no-utility', 'vector-thruster')).toBe(true)

    // Already unlocked; fitting must still fail under Bare Rig.
    const blocked = fitModule(state, 'vector-thruster')
    expect(blocked.shipyard.modules).not.toContain('vector-thruster')
  })

  it('caps all weapon ranges under Knife Fight', () => {
    let state = createInitialState(0)
    state.prestige.prestigeCount = 1
    state.prestige.challengeClears = { 'no-utility': 1 }
    state.combat.sector = 8
    state.meta.highestSectorEver = 10
    state.resources.scrap = 999
    state.resources.alloys = 999
    state = unlockModule(state, 'heavy-lance')
    state = unlockModule(state, 'flak-array')

    expect(canEnterChallenge(state, 'short-range')).toBe(true)
    state = enterChallenge(state, 'short-range', 2000)
    expect(state.prestige.activeChallengeId).toBe('short-range')

    // Long weapons may stay fitted — range is capped at combat build time.
    state = fitModule(state, 'heavy-lance')
    const weapons = buildFlagshipWeapons(state)
    expect(weapons.length).toBeGreaterThan(1)
    expect(Math.max(...weapons.map((w) => w.range))).toBe(SHORT_RANGE_MAX)

    state = fitModule(state, 'flak-array')
    // Scout only has 1W — swap to flak
    const withFlak = createInitialState(0)
    withFlak.prestige.activeChallengeId = 'short-range'
    withFlak.shipyard.modules = ['flak-array']
    withFlak.shipyard.unlockedModules = ['flak-array', 'pulse-cannon']
    const flakWeapons = buildFlagshipWeapons(withFlak)
    const flak = flakWeapons.find((w) => w.name === 'Flak')
    expect(flak?.range).toBe(SHORT_RANGE_MAX)
    expect(computeShipStats(withFlak).damage).toBeGreaterThan(0)
  })
})
