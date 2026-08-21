import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  assignWorker,
  autoBalanceWorkers,
  buyAiNode,
  buyResearch,
  canEnterChallenge,
  clearWorkerAssignments,
  enterChallenge,
  fillStationWorkers,
  performAscension,
  performPrestige,
  setLaborProfile,
} from './actions'
import {
  GUIDE_STEPS,
  STARTER_GUIDE_IDS,
  activeGuideStep,
  isSystemUnlocked,
  retirePostResetOnboarding,
  syncCompletedGuides,
} from './progression'
import {
  aiDroneEfficiencyMult,
  getChallenge,
  isChallengeUnlocked,
} from './catalog'
import { advanceSeconds, computeResourceRates } from './tick'

describe('onboarding survives soft resets', () => {
  it('retires starter guides after prestige', () => {
    let state = createInitialState(0)
    state.combat.sector = 12
    state = performPrestige(state, 1000)
    for (const id of STARTER_GUIDE_IDS) {
      expect(state.meta.seenOnboarding).toContain(id)
    }
    expect(activeGuideStep(state, 'combat')).not.toMatchObject({
      id: 'guide-launch',
    })
  })

  it('retires the full guide catalog after ascension', () => {
    let state = createInitialState(0)
    state.meta.act1Cleared = true
    state.combat.sector = 30
    state.meta.highestSectorEver = 30
    state = performAscension(state, 1000)
    expect(state.meta.ascensionCount).toBe(1)
    for (const step of GUIDE_STEPS) {
      expect(state.meta.seenOnboarding).toContain(step.id)
    }
    expect(activeGuideStep(state, 'combat')).toBeNull()
  })

  it('syncCompletedGuides acks launch once the ship is flying', () => {
    let state = createInitialState(0)
    state.combat.docked = false
    state = syncCompletedGuides(state, 'dock')
    expect(state.meta.seenOnboarding).toContain('guide-launch')
  })

  it('retirePostResetOnboarding is idempotent', () => {
    const state = createInitialState(0)
    state.prestige.prestigeCount = 2
    retirePostResetOnboarding(state)
    const first = [...state.meta.seenOnboarding]
    retirePostResetOnboarding(state)
    expect(state.meta.seenOnboarding).toEqual(first)
  })
})

describe('labor router QoL', () => {
  it('applies scrap / foundry-safe profiles', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 12
    state.base.workerDrones = 12
    state.resources.aiPoints = 20
    state.research.unlocked = ['alloy-smelting', 'drone-logistics']
    state = buyAiNode(state, 'auto-assign-workers')

    state = autoBalanceWorkers(state, 'scrap')
    expect(state.meta.laborProfile).toBe('scrap')
    expect(state.base.assignments['scrap-field'] ?? 0).toBeGreaterThan(
      state.base.assignments['alloy-foundry'] ?? 0,
    )

    state = setLaborProfile(state, 'foundry-safe')
    state = autoBalanceWorkers(state, 'foundry-safe')
    const scrap = state.base.assignments['scrap-field'] ?? 0
    const foundry = state.base.assignments['alloy-foundry'] ?? 0
    // Scrap income should cover foundry upkeep at base rates.
    expect(scrap * 0.4 + 1e-9).toBeGreaterThanOrEqual(foundry * 0.16)
  })

  it('supports fill, clear, and labor loop node', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 12
    state.base.workerDrones = 8
    state.resources.aiPoints = 30
    state = buyAiNode(state, 'auto-assign-workers')
    state = buyAiNode(state, 'labor-loop')
    expect(state.ai.purchased).toContain('labor-loop')

    state = fillStationWorkers(state, 'scrap-field')
    expect(state.base.assignments['scrap-field']).toBe(8)
    state = clearWorkerAssignments(state)
    expect(state.base.assignments['scrap-field']).toBeUndefined()
  })

  it('drone efficiency multiplies station output', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 18
    state.base.workerDrones = 2
    state = assignWorker(state, 'scrap-field', 2)
    const before = computeResourceRates(state).scrap ?? 0

    state.resources.aiPoints = 20
    state = buyAiNode(state, 'drone-efficiency-1')
    expect(aiDroneEfficiencyMult(state)).toBe(1.35)
    const after = computeResourceRates(state).scrap ?? 0
    expect(after).toBeCloseTo(before * 1.35, 5)
  })
})

describe('ascension-entry challenges', () => {
  it('Long Haul / Null Signal require Ascension entry at sector 30', () => {
    let state = createInitialState(0)
    state.meta.act1Cleared = true
    state.meta.highestSectorEver = 30
    state.combat.sector = 12
    expect(isChallengeUnlocked(state, 'long-haul')).toBe(true)
    expect(canEnterChallenge(state, 'long-haul')).toBe(false)

    state.combat.sector = 30
    expect(canEnterChallenge(state, 'long-haul')).toBe(true)
    const before = state.meta.ascensionCount
    const beforePrestige = state.prestige.prestigeCount
    state = enterChallenge(state, 'long-haul', 1000)
    expect(state.prestige.activeChallengeId).toBe('long-haul')
    expect(state.meta.ascensionCount).toBe(before + 1)
    expect(state.prestige.prestigeCount).toBe(beforePrestige)
    expect(getChallenge('long-haul')?.entryCost).toBe('ascension')
  })

  it('Hollow Choir needs a prior Ascension and blocks AI', () => {
    let state = createInitialState(0)
    state.meta.act1Cleared = true
    state.meta.highestSectorEver = 30
    state.combat.sector = 30
    expect(isChallengeUnlocked(state, 'hollow-choir')).toBe(false)
    state.meta.ascensionCount = 1
    expect(canEnterChallenge(state, 'hollow-choir')).toBe(true)

    state.ai.purchased = ['auto-assign-workers', 'combat-chrono-1']
    state.resources.aiPoints = 10
    state = enterChallenge(state, 'hollow-choir', 2000)
    expect(state.prestige.activeChallengeId).toBe('hollow-choir')
    // AI still owned, but doctrines/automation inactive during the run.
    const bought = buyAiNode(state, 'hold-accountant')
    expect(bought.ai.purchased).not.toContain('hold-accountant')
  })
})

describe('permanent research', () => {
  it('keeps researched unlocks (including Codex) across prestige', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 12
    state.resources.data = 200
    state = buyResearch(state, 'tactical-codex')
    state = buyResearch(state, 'basic-optics')
    state = buyResearch(state, 'alloy-smelting')
    state.combat.sector = 12
    state = performPrestige(state, 1000)
    expect(state.research.unlocked).toEqual(
      expect.arrayContaining(['tactical-codex', 'basic-optics', 'alloy-smelting']),
    )
    expect(isSystemUnlocked(state, 'codex')).toBe(true)
  })
})

describe('labor loop tick', () => {
  it('auto-assigns idle workers when Labor Loop is owned', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 12
    state.base.workerDrones = 6
    state.resources.aiPoints = 20
    state = buyAiNode(state, 'auto-assign-workers')
    state = buyAiNode(state, 'labor-loop')
    state.meta.laborProfile = 'scrap'
    // All idle — tick should reshuffle.
    advanceSeconds(state, 1)
    expect(Object.values(state.base.assignments).reduce((a, b) => a + b, 0)).toBe(6)
  })
})
