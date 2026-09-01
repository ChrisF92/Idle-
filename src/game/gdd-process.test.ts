import { describe, expect, it } from 'vitest'
import { buyProcessNode } from './actions'
import { ACT1_CADENCE } from './cadence'
import {
  PROCESS_ACCUMULATION,
  PROCESS_NODES,
  canBuyProcessNode,
  processAvailable,
  processDamageMult,
  processFoundrySpeedMult,
  processResearchSpeedMult,
} from './process'
import { ACT1_PROCESS_POINT_TOTAL, processPointsEarned } from './processPoints'
import { conditionMet, evaluateProcessIntent, processShouldExtract } from './processProfiles'
import { tickAutomation } from './automation'
import { isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'

function processState() {
  const state = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.process)
  state.hiveResearch.completedIds = [
    'c1-queue-buffer', 'c2-combat-telemetry', 'c3-deep-queue', 'c4-process-kernel',
  ]
  state.hiveResearch.completed.computation = 4
  return state
}

describe('PR9 canonical Process', () => {
  it('unlocks only from Process Kernel and exposes banked achievement PP', () => {
    const locked = atCareerWave(createInitialState(0), ACT1_CADENCE.process)
    expect(isSystemUnlocked(locked, 'process')).toBe(false)
    const open = processState()
    expect(isSystemUnlocked(open, 'process')).toBe(true)
    expect(processAvailable(open)).toBe(processPointsEarned(open))
    expect(processAvailable(open)).toBeGreaterThan(0)
  })

  it('defines the exact 28-capability, 151 PP tree against 160 available PP', () => {
    expect(PROCESS_NODES).toHaveLength(28)
    expect(PROCESS_NODES.reduce((sum, node) => sum + node.cost, 0)).toBe(151)
    expect(ACT1_PROCESS_POINT_TOTAL).toBe(160)
    expect(PROCESS_ACCUMULATION).toEqual([])
    expect(PROCESS_NODES.map((node) => node.name)).toEqual(expect.arrayContaining([
      'Bulk Purchase', 'Worker Presets', 'Research Queue Assist', 'Rule Builder',
      'Furnace Auto-Ignite', 'Directive Preference', 'Auto Extract', 'Challenge Profile',
    ]))
  })

  it('enforces logical prerequisites and spends permanent PP once', () => {
    let state = processState()
    expect(canBuyProcessNode(state, 'buy-max').ok).toBe(false)
    const before = processAvailable(state)
    state = buyProcessNode(state, 'bulk-purchase')
    expect(state.process.purchased).toContain('bulk-purchase')
    expect(processAvailable(state)).toBe(before - 2)
    expect(canBuyProcessNode(state, 'buy-max').ok).toBe(true)
    expect(buyProcessNode(state, 'bulk-purchase')).toBe(state)
  })

  it('adds no passive combat, production, or Research multiplier', () => {
    const state = processState()
    state.process.purchased = PROCESS_NODES.map((node) => node.id)
    expect(processDamageMult(state)).toBe(1)
    expect(processFoundrySpeedMult(state)).toBe(1)
    expect(processResearchSpeedMult(state)).toBe(1)
  })

  it('supports bounded challenge/profile conditions and capability-gated extraction', () => {
    const state = processState()
    state.process.purchased = ['rule-builder', 'process-profiles']
    state.process.config.activeProfileId = 'farm'
    state.challenges.activeId = 'glass-frame'
    expect(conditionMet(state, { kind: 'challenge-active' })).toBe(true)
    expect(conditionMet(state, { kind: 'profile-is', profileId: 'farm' })).toBe(true)
    state.combat.docked = false
    state.combat.wave = 20
    state.combat.playerHullMax = 100
    state.combat.playerHull = 20
    expect(evaluateProcessIntent(state).autoExtract).toBe(false)
    expect(processShouldExtract(state)).toBe(false)
    state.process.purchased.push('auto-extract')
    expect(evaluateProcessIntent(state).autoExtract).toBe(true)
    expect(processShouldExtract(state)).toBe(true)
  })

  it('starts only explicitly queued Research and consumes that queue entry', () => {
    const state = processState()
    state.process.purchased = ['research-queue-assist']
    state.process.config.research.queue = ['e1-cycle-engineering']
    tickAutomation(state)
    expect(state.hiveResearch.activeNodeId).toBe('e1-cycle-engineering')
    expect(state.process.config.research.queue).toEqual([])
  })

  it('chooses an offered Directive by preference without rerolling', () => {
    const state = processState()
    state.process.purchased = ['directive-preference']
    state.process.config.sortie.directivePreference = ['scavenger-sweep', 'overcharge']
    state.combat.directiveOffer = ['overcharge', 'scavenger-sweep', 'reactive-array']
    tickAutomation(state)
    expect(state.combat.directives).toContain('scavenger-sweep')
    expect(state.combat.directiveOffer).toBeNull()
  })

  it('never rewrites an Ignited Furnace or fabricates first-time unique items', () => {
    const state = processState()
    state.process.purchased = PROCESS_NODES.map((node) => node.id)
    state.process.config.activeProfileId = 'push'
    state.process.config.furnace.autoChannel = true
    state.furnace.ignited = true
    state.furnace.channels = { overdrive: 1, bulwark: 0, guidance: 0, harvest: 0 }
    const channels = structuredClone(state.furnace.channels)
    const fabrication = structuredClone(state.foundry.fabrication)
    tickAutomation(state)
    expect(state.furnace.channels).toEqual(channels)
    expect(state.foundry.fabrication).toEqual(fabrication)
  })
})
