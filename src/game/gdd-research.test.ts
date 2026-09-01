import { describe, expect, it } from 'vitest'
import { performRebuild } from './actions'
import { ACT1_CADENCE } from './cadence'
import {
  HIVE_RESEARCH_BRANCHES,
  HIVE_RESEARCH_NODES,
  HIVE_RESEARCH_WORKER_ACCEL,
  getHiveResearchNode,
  hiveResearchActiveNodes,
  hiveResearchBranchUnlocked,
  hiveResearchNodeDuration,
  hiveResearchProjectSlots,
  hiveResearchSpeed,
  startResearch,
} from './hiveResearch'
import { applyOfflineCatchUp } from './offline'
import { isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { armRebuildDoor, atCareerWave, markHullLost } from './testHelpers'
import { advanceSeconds } from './tick'

function researchState() {
  return atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.research)
}

describe('PR9 canonical Research', () => {
  it('opens all four ten-project disciplines at Wave 525', () => {
    const locked = atCareerWave(createInitialState(0), ACT1_CADENCE.research - 1)
    expect(isSystemUnlocked(locked, 'research')).toBe(false)
    const open = researchState()
    expect(isSystemUnlocked(open, 'research')).toBe(true)
    expect(HIVE_RESEARCH_BRANCHES.map((row) => row.name)).toEqual([
      'Hive Engineering', 'Drone Systems', 'Industrial Science', 'Computational Systems',
    ])
    expect(Object.values(HIVE_RESEARCH_NODES).every((nodes) => nodes.length === 10)).toBe(true)
    expect(HIVE_RESEARCH_BRANCHES.every((row) => hiveResearchBranchUnlocked(open, row.id))).toBe(true)
  })

  it('uses the authored catalogue and totals forty unaccelerated hours', () => {
    expect(HIVE_RESEARCH_NODES.energy.map((node) => node.name)).toEqual([
      'Cycle Engineering', 'Workshop Tooling', 'Thermal Conduits', 'Core Priming', 'Frame Calibration',
      'Workshop Template', 'Reclaim Routing', 'Thermal Recovery', 'Cycle Memory', 'Reconstruction Accelerator',
    ])
    const total = Object.values(HIVE_RESEARCH_NODES).flat().reduce((sum, node) => sum + node.duration, 0)
    expect(total).toBe(40 * 60 * 60)
    expect(getHiveResearchNode('c4-process-kernel')?.prerequisites).toEqual(['c3-deep-queue'])
  })

  it('runs one timed project, with Worker acceleration and offline progress', () => {
    const slow = startResearch(researchState(), 'e1-cycle-engineering')
    const base = hiveResearchSpeed(slow)
    let fast = researchState()
    fast.base.workerDrones = 4
    fast.base.assignments['sensor-net'] = 4
    fast = startResearch(fast, 'e1-cycle-engineering')
    expect(hiveResearchSpeed(fast)).toBeCloseTo(base + 4 * HIVE_RESEARCH_WORKER_ACCEL)
    const before = fast.hiveResearch.progress
    fast.lastTickAt = 0
    const { state: caughtUp } = applyOfflineCatchUp(fast, 60_000)
    expect(caughtUp.hiveResearch.progress).toBeGreaterThan(before)
    expect(hiveResearchActiveNodes(slow)).toHaveLength(1)
  })

  it('keeps completed projects across Rebuild', () => {
    let state = armRebuildDoor(createInitialState(0))
    state = atCareerWave(state, ACT1_CADENCE.research)
    state.hiveResearch.completedIds = ['e1-cycle-engineering']
    state.hiveResearch.completed.energy = 1
    state = startResearch(state, 'e2-workshop-tooling')
    state = performRebuild(state, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(state.hiveResearch.completedIds).toContain('e1-cycle-engineering')
    expect(state.hiveResearch.activeNodeId).toBe('e2-workshop-tooling')
  })

  it('unlocks Process only at Process Kernel and parallel Research at Parallel Analysis', () => {
    const state = researchState()
    state.hiveResearch.completedIds = ['c1-queue-buffer', 'c2-combat-telemetry', 'c3-deep-queue']
    state.hiveResearch.completed.computation = 3
    expect(isSystemUnlocked(state, 'process')).toBe(false)
    const kernel = getHiveResearchNode('c4-process-kernel')!
    const running = startResearch(state, kernel.id)
    running.hiveResearch.progress = hiveResearchNodeDuration(kernel, running) - 1
    advanceSeconds(running, 2)
    expect(isSystemUnlocked(running, 'process')).toBe(true)
    running.hiveResearch.completedIds.push('c5-pressure-analysis', 'c6-comparative-inspect', 'c7-profile-memory', 'c8-parallel-analysis')
    expect(hiveResearchProjectSlots(running)).toBe(2)
  })
})
