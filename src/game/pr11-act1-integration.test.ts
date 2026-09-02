import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as actions from './actions'
import { ACT1_TARGETS } from './balance/act1'
import { ACT1_CADENCE, ACT1_FINAL_WAVE } from './cadence'
import { getFrame, getModule } from './catalog'
import { ONBOARDING_LESSON_IDS } from './onboarding'
import { isSystemUnlocked } from './progression'
import { getRelicFamily } from './relicCatalogue'
import {
  ACT1_BUILD_PROFILES,
  ACT1_BUILD_PROFILE_IDS,
} from './simulation/buildProfiles'
import { SIMULATION_PRESETS } from './simulation/presets'
import { createInitialState } from './state'
import { ACTIVE_ENEMY_SOFT_CAP } from './waves'
import { recordBossClearSources } from './bossClear'
import { canEnterChallenge } from './challenges'

const here = dirname(fileURLToPath(import.meta.url))

describe('PR11 W1 → W1000 integration', () => {
  it('locks the canonical progression spine and finale boundary', () => {
    expect(ACT1_FINAL_WAVE).toBe(1000)
    expect(ACT1_CADENCE).toMatchObject({
      codex: 30,
      foundry: 50,
      workers: 110,
      directives: 125,
      rebuild: 210,
      reliquary: 320,
      challenges: 375,
      furnace: 450,
      research: 525,
      process: 525,
      reinforce: 1000,
    })
  })

  it('uses the exact cumulative active-time acceptance windows', () => {
    const expected: Record<string, [number, number]> = {
      'wave-100': [2, 4],
      'wave-200': [6, 10],
      'wave-300': [12, 18],
      'wave-400': [20, 28],
      'wave-500': [30, 40],
      'wave-600': [42, 54],
      'wave-700': [52, 66],
      'wave-800': [62, 78],
      'wave-900': [72, 90],
      w1000: [80, 100],
    }
    for (const [id, hours] of Object.entries(expected)) {
      const target = ACT1_TARGETS.find((row) => row.id === id)
      expect(target, id).toBeTruthy()
      expect([target!.min / 3600, target!.max / 3600]).toEqual(hours)
    }
  })

  it('defines all six required buildcraft profiles with valid authored content', () => {
    expect(ACT1_BUILD_PROFILES.map((profile) => profile.id)).toEqual(ACT1_BUILD_PROFILE_IDS)
    expect(ACT1_BUILD_PROFILES.map((profile) => profile.label)).toEqual([
      'Balanced Generalist',
      'Swarm Control',
      'Boss Killer',
      'Shield Breaker',
      'Defensive Sustain',
      'Economy/Farm',
    ])
    for (const profile of ACT1_BUILD_PROFILES) {
      expect(getFrame(profile.frameId), profile.frameId).toBeTruthy()
      expect(profile.coreIds.length).toBeGreaterThanOrEqual(5)
      expect(profile.coreIds.length).toBeLessThanOrEqual(6)
      for (const id of profile.coreIds) expect(getModule(id), `${profile.id}:${id}`).toBeTruthy()
      for (const id of profile.relicFamilyIds) expect(getRelicFamily(id), `${profile.id}:${id}`).toBeTruthy()
      expect(profile.doctrines.length).toBeGreaterThan(0)
    }
    const mandatory = ACT1_BUILD_PROFILES[0]!.coreIds.filter((id) =>
      ACT1_BUILD_PROFILES.every((profile) => profile.coreIds.includes(id)),
    )
    expect(mandatory).toEqual([])
    expect(new Set(ACT1_BUILD_PROFILES.map((profile) => profile.coreIds.join('|'))).size).toBe(6)
    expect(new Set(ACT1_BUILD_PROFILES.map((profile) => profile.investment))).toEqual(
      new Set(['workshop-heavy', 'core-level-heavy', 'permanent-unlock-heavy', 'balanced']),
    )
  })

  it('offers a Wave 1000 simulator preset for every build profile', () => {
    const finaleProfiles = SIMULATION_PRESETS
      .filter((preset) => preset.config.stop.type === 'wave' && preset.config.stop.wave === 1000)
      .map((preset) => preset.config.buildProfile)
    expect(finaleProfiles).toEqual(expect.arrayContaining([...ACT1_BUILD_PROFILE_IDS]))
  })

  it('reveals Reinforce only after Choir Crown without implementing another reset', () => {
    const state = createInitialState(0)
    state.meta.bestWave = 1000
    state.combat.bestWave = 1000
    expect(isSystemUnlocked(state, 'reinforce')).toBe(false)
    state.meta.act1Cleared = true
    expect(isSystemUnlocked(state, 'reinforce')).toBe(true)
    expect('ascensionCount' in state.meta).toBe(false)
    expect('canAscend' in actions).toBe(false)
    expect('performAscension' in actions).toBe(false)
    expect('performReinforce' in actions).toBe(false)
  })

  it('hands a real Choir Crown clear to the finale exactly once', () => {
    const state = createInitialState(0)
    state.meta.bestWave = 1000
    state.combat.bestWave = 1000
    recordBossClearSources(state, 1000)
    recordBossClearSources(state, 1000)
    expect(state.meta.act1Cleared).toBe(true)
    expect(state.meta.act1FinalePending).toBe(true)
    expect(state.codex.milestones.filter((id) => id === 'act1-boss-clear')).toHaveLength(1)
    state.combat.docked = true
    expect(canEnterChallenge(state, 'hollow-choir')).toEqual({ ok: true })
  })

  it('keeps onboarding event-driven through every implemented Act 1 system', () => {
    expect(ONBOARDING_LESSON_IDS).toEqual(expect.arrayContaining([
      'opening.salvage',
      'first-defeat.workshop',
      'foundry.processing',
      'workers.assignment',
      'directives.choice',
      'rebuild.preview',
      'relic.install',
      'furnace.channel',
      'research.project',
      'process.capability',
      'challenges.start',
    ]))
    expect(ONBOARDING_LESSON_IDS).not.toContain('reinforce' as never)
  })

  it('pins the mobile/performance acceptance floor', () => {
    const tokens = readFileSync(join(here, '../ui/tokens.css'), 'utf8')
    const polish = readFileSync(join(here, '../polish.css'), 'utf8')
    const vitest = readFileSync(join(here, '../../vitest.config.ts'), 'utf8')
    expect(tokens).toMatch(/--touch:\s*44px/)
    expect(polish).toMatch(/@media \(max-width: 360px\)/)
    expect(ACTIVE_ENEMY_SOFT_CAP).toBeGreaterThanOrEqual(55)
    expect(ACTIVE_ENEMY_SOFT_CAP).toBeLessThanOrEqual(60)
    expect(vitest).not.toMatch(/exclude|GDD_REWRITE_PENDING/)
  })
})
