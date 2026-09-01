import { describe, expect, it } from 'vitest'
import { enterChallenge } from './actions'
import { blueprintLifecycle } from './blueprints'
import {
  CHALLENGE_MAX_MEDAL,
  CHALLENGE_MEDAL_STEP,
  CHALLENGE_UNLOCK_WAVE,
  CHALLENGES,
  canEnterChallenge,
  challengeAcquisitionMult,
  challengeGoalWave,
  challengeHullMult,
  challengeReinforcementIntervalMult,
  endChallengeAttempt,
  tryCompleteChallenge,
} from './challenges'
import { canConfigureTargetingDoctrine } from './coreTargeting'
import { hasDirective, queueDirectiveOffer } from './directives'
import { canIgniteFurnace } from './furnace'
import { processAutomationCards } from './process'
import { processPointsEarned } from './processPoints'
import { exportSave, importSave } from './save'
import { createInitialState, SAVE_VERSION } from './state'
import { atCareerWave } from './testHelpers'

function challengeDock(wave = CHALLENGE_UNLOCK_WAVE) {
  const state = atCareerWave(createInitialState(0), wave)
  state.combat.docked = true
  state.combat.inFight = false
  return state
}

function encodeRaw(state: object): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))))
}

describe('PR10 canonical Challenges', () => {
  it('bumps the breaking save and authors exactly the ten Act 1 Challenges', () => {
    expect(SAVE_VERSION).toBe(51)
    expect(CHALLENGES.map(({ id, name, targetWave }) => [id, name, targetWave])).toEqual([
      ['glass-frame', 'Glass Frame', 450],
      ['knife-fight', 'Knife Fight', 500],
      ['bare-hive', 'Bare Hive', 550],
      ['single-pattern', 'Single Pattern', 600],
      ['attrition', 'Attrition', 650],
      ['pressure-front', 'Pressure Front', 700],
      ['silent-bridge', 'Silent Bridge', 725],
      ['dead-reckoning', 'Dead Reckoning', 800],
      ['cold-furnace', 'Cold Furnace', 850],
      ['hollow-choir', 'Hollow Choir', 1000],
    ])
    expect(CHALLENGE_MAX_MEDAL).toBe(3)
    expect(CHALLENGE_MEDAL_STEP).toBe(75)
  })

  it('round-trips a live Challenge and rejects the pre-PR10 schema', () => {
    const state = challengeDock(1000)
    state.challenges.activeId = 'knife-fight'
    state.challenges.medals['glass-frame'] = 2
    state.challenges.bestWave['knife-fight'] = 401
    const restored = importSave(exportSave(state))
    expect(restored?.challenges).toEqual(state.challenges)
    expect(importSave(encodeRaw({ ...state, version: 50 }))).toBeNull()
  })

  it('opens at W375, with authored extra gates for Silent Bridge and Hollow Choir', () => {
    expect(canEnterChallenge(challengeDock(374), 'glass-frame')).toMatchObject({ ok: false })
    expect(canEnterChallenge(challengeDock(375), 'glass-frame')).toEqual({ ok: true })
    const silent = challengeDock()
    expect(canEnterChallenge(silent, 'silent-bridge').reason).toMatch(/Fire-Control Doctrine/)
    silent.hiveResearch.completedIds.push('d1-fire-control-doctrine')
    expect(canEnterChallenge(silent, 'silent-bridge')).toEqual({ ok: true })
    const hollow = challengeDock(1000)
    expect(canEnterChallenge(hollow, 'hollow-choir').reason).toMatch(/Choir Crown/)
    hollow.meta.act1Cleared = true
    expect(canEnterChallenge(hollow, 'hollow-choir')).toEqual({ ok: true })
  })

  it('starts a fresh W1 Sortie without currency or Rebuild cost and sanitizes the loadout', () => {
    const state = challengeDock(700)
    state.resources.prestigeMatter = 17
    state.resources.challengePoints = 9
    state.prestige.prestigeCount = 4
    state.resources.salvage = 99
    state.combat.runUpgrades = { hull: 5 }
    state.shipyard.modules.push('sensor-array')
    state.shipyard.equippedCoreIds.push('sensor-array:test')
    const next = enterChallenge(state, 'bare-hive')
    expect(next.challenges.activeId).toBe('bare-hive')
    expect(next.combat.wave).toBe(1)
    expect(next.combat.waveReached).toBe(0)
    expect(next.combat.runUpgrades).toEqual({})
    expect(next.resources.salvage).toBe(0)
    expect(next.resources.prestigeMatter).toBe(17)
    expect(next.resources.challengePoints).toBe(9)
    expect(next.prestige.prestigeCount).toBe(4)
    expect(next.shipyard.modules).not.toContain('sensor-array')
  })

  it('awards medals from secured Wave only and grants unique Blueprint routes once', () => {
    const state = challengeDock(1000)
    state.challenges.activeId = 'glass-frame'
    state.meta.bestWave = 1000
    const ppBefore = processPointsEarned(state)
    expect(tryCompleteChallenge(state, 449)).toBeNull()
    expect(state.challenges.medals['glass-frame']).toBeUndefined()
    expect(tryCompleteChallenge(state, 450)).toMatch(/BRONZE/)
    expect(state.challenges.medals['glass-frame']).toBe(1)
    expect(state.resources.challengePoints).toBe(1)
    expect(processPointsEarned(state)).toBe(ppBefore + 2)
    expect(blueprintLifecycle(state, 'ablative-mesh')).toBe('discovered')
    expect(state.challenges.uniqueRewards).toEqual(['blueprint:ablative-mesh'])

    state.challenges.activeId = 'glass-frame'
    expect(challengeGoalWave(state, 'glass-frame')).toBe(525)
    expect(tryCompleteChallenge(state, 525)).toMatch(/SILVER/)
    expect(state.challenges.uniqueRewards).toEqual(['blueprint:ablative-mesh'])
    expect(processPointsEarned(state)).toBe(ppBefore + 3)
  })

  it('wires every pre-finale unique reward into Blueprint discovery', () => {
    const state = challengeDock(1000)
    for (const def of CHALLENGES.filter((challenge) => !challenge.finale)) {
      state.challenges.activeId = def.id
      expect(tryCompleteChallenge(state, def.targetWave), def.id).not.toBeNull()
      for (const reward of def.uniqueRewards) {
        expect(reward.kind, reward.id).toBe('blueprint')
        expect(blueprintLifecycle(state, reward.id), reward.id).toBe('discovered')
      }
    }
  })

  it('applies the authored restrictions through centralized helpers', () => {
    const state = challengeDock(1000)
    state.challenges.activeId = 'glass-frame'
    expect(challengeHullMult(state)).toBe(0.5)
    state.challenges.activeId = 'hollow-choir'
    expect(challengeHullMult(state)).toBe(0.75)
    expect(challengeReinforcementIntervalMult(state)).toBe(0.85)
    state.challenges.activeId = 'pressure-front'
    expect(challengeReinforcementIntervalMult(state)).toBe(0.8)
    state.challenges.activeId = 'dead-reckoning'
    expect(challengeAcquisitionMult(state)).toBe(0.75)
  })

  it('blocks the named systems and reports Process suppression explicitly', () => {
    const silent = challengeDock(1000)
    silent.hiveResearch.completedIds.push('d1-fire-control-doctrine')
    silent.challenges.activeId = 'silent-bridge'
    expect(canConfigureTargetingDoctrine(silent)).toBe(false)

    const cold = challengeDock(1000)
    cold.challenges.activeId = 'cold-furnace'
    cold.combat.docked = false
    cold.combat.inFight = true
    cold.resources.heat = 100
    expect(canIgniteFurnace(cold, { overdrive: 1 }).reason).toBe('DISABLED BY CHALLENGE')
    cold.process.purchased = ['furnace-auto-ignite']
    expect(processAutomationCards(cold).find((card) => card.id === 'furnace-auto-ignite')?.summary)
      .toBe('DISABLED BY CHALLENGE')

    const hollow = challengeDock(1000)
    hollow.challenges.activeId = 'hollow-choir'
    hollow.combat.directives = ['overcharge']
    expect(hasDirective(hollow, 'overcharge')).toBe(false)
    expect(queueDirectiveOffer(hollow, 50)).toBe(false)
  })

  it('ends unfinished attempts on defeat and grants Hollow Choir once', () => {
    const state = challengeDock(1000)
    state.challenges.activeId = 'knife-fight'
    state.combat.waveReached = 321
    endChallengeAttempt(state, 'defeat')
    expect(state.challenges.activeId).toBeNull()
    expect(state.challenges.bestWave['knife-fight']).toBe(321)

    state.meta.act1Cleared = true
    state.challenges.activeId = 'hollow-choir'
    const ppBefore = processPointsEarned(state)
    expect(tryCompleteChallenge(state, 1000)).toMatch(/CLEAR/)
    expect(state.resources.challengePoints).toBe(6)
    expect(processPointsEarned(state)).toBe(ppBefore + 6)
    expect(state.challenges.uniqueRewards).toEqual(expect.arrayContaining([
      'account-unlock:loopbreaker',
      'cosmetic:hollow-choir-prestige',
    ]))
    state.challenges.activeId = 'hollow-choir'
    expect(tryCompleteChallenge(state, 1000)).toBeNull()
    expect(state.resources.challengePoints).toBe(6)
  })
})
