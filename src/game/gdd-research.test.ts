import { describe, expect, it } from 'vitest'
import { assignWorker, performRebuild, setResearchFocus, startResearch } from './actions'
import { ACT1_CADENCE } from './cadence'
import {
  getHiveResearchNode,
  grantHiveResearchKillXp,
  hiveResearchActive,
  hiveResearchActiveNode,
  hiveResearchAvailableNodes,
  hiveResearchCompleted,
  hiveResearchCompletedIds,
  hiveResearchFocusFire,
  hiveResearchFurnaceSlots,
  hiveResearchNodeDuration,
  hiveResearchNodeEffectLine,
  hiveResearchSpeed,
  hiveResearchUpcoming,
  hiveResearchVisibleNodes,
  hiveResearchXp,
  HIVE_RESEARCH_NODES,
  HIVE_RESEARCH_WORKER_ACCEL,
  researchNodeViewState,
} from './hiveResearch'
import { applyOfflineCatchUp } from './offline'
import { isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { systemsHubCards } from './systemsHub'
import { armRebuildDoor, atCareerWave, markHullLost } from './testHelpers'
import { advanceSeconds } from './tick'

function researchState(wave = ACT1_CADENCE.research) {
  return atCareerWave(markHullLost(createInitialState(0)), wave)
}

describe('GDD Research', () => {
  it('stays locked before Wave 170', () => {
    const locked = researchState(ACT1_CADENCE.research - 1)
    expect(isSystemUnlocked(locked, 'research')).toBe(false)
    expect(setResearchFocus(locked, 'energy')).toBe(locked)
    expect(systemsHubCards(locked).map((c) => c.id)).not.toContain('research')
  })

  it('opens three Act 1 disciplines at Wave 170 under Systems', () => {
    const open = researchState()
    expect(isSystemUnlocked(open, 'research')).toBe(true)
    expect(systemsHubCards(open).map((c) => c.id)).toEqual(['foundry', 'research'])
    expect(HIVE_RESEARCH_NODES.energy.length).toBeGreaterThan(5)
    expect(HIVE_RESEARCH_NODES.observation.length).toBeGreaterThan(5)
    expect(HIVE_RESEARCH_NODES.material.length).toBeGreaterThan(5)
    expect(setResearchFocus(open, 'computation')).toBe(open)
  })

  it('runs one timed project and does not take kill XP', () => {
    let s = researchState()
    s.combat.docked = true
    s = setResearchFocus(s, 'energy')
    expect(hiveResearchActive(s)).toBe(true)
    expect(s.hiveResearch.focus).toBe('energy')
    const before = hiveResearchXp(s, 'energy')
    grantHiveResearchKillXp(s, true)
    expect(hiveResearchXp(s, 'energy')).toBe(before)
    advanceSeconds(s, 10)
    expect(hiveResearchXp(s, 'energy')).toBeGreaterThan(before)
    expect(hiveResearchCompleted(s, 'material')).toBe(0)
  })

  it('lets assigned Worker Drones accelerate the active Research project', () => {
    let slow = researchState()
    slow.combat.docked = true
    slow = setResearchFocus(slow, 'energy')
    const base = hiveResearchSpeed(slow)

    let fast = researchState()
    fast.combat.docked = true
    fast.base.workerDrones = 8
    fast = setResearchFocus(fast, 'energy')
    fast = assignWorker(fast, 'sensor-net', 4)
    expect(hiveResearchSpeed(fast)).toBeCloseTo(base + HIVE_RESEARCH_WORKER_ACCEL * 4)
    expect(hiveResearchSpeed(fast)).toBeGreaterThan(base)
  })

  it('completes the project and frees the slot', () => {
    let s = researchState()
    s.combat.docked = true
    s = setResearchFocus(s, 'energy')
    const node = hiveResearchActiveNode(s)!
    const need = hiveResearchNodeDuration(node, s)
    s.hiveResearch.progress = need - 1
    s.hiveResearch.xp.energy = need - 1
    advanceSeconds(s, 2)
    expect(hiveResearchCompleted(s, 'energy')).toBe(1)
    expect(hiveResearchActive(s)).toBe(false)
  })

  it('opens Drone Systems on a targeting rule, not a percent shop', () => {
    let s = researchState()
    s.combat.docked = true
    s = startResearch(s, 'priority-lock')
    const first = hiveResearchActiveNode(s)
    expect(first?.name).toBe('Priority Lock')
    expect(first?.kind).toBe('breakthrough')
    expect(first?.focusFire).toBe(true)
    expect(hiveResearchNodeEffectLine(first!)).toMatch(/wounded hulls/)
    expect(hiveResearchUpcoming(s, 'observation')).toHaveLength(0)
    expect(researchNodeViewState(s, getHiveResearchNode('worker-calibration')!)).toBe('locked')

    const need = hiveResearchNodeDuration(first!, s)
    s.hiveResearch.progress = need - 1
    advanceSeconds(s, 2)
    expect(s.hiveResearch.completedIds).toContain('priority-lock')
    expect(hiveResearchFocusFire(s)).toBe(true)
    expect(hiveResearchActive(s)).toBe(false)
    expect(hiveResearchAvailableNodes(s, 'observation').map((n) => n.id).sort()).toEqual(
      ['combat-sim', 'worker-calibration'].sort(),
    )
  })

  it('keeps Research across Rebuild and continues offline', () => {
    let s = armRebuildDoor(createInitialState(0))
    s = atCareerWave(s, ACT1_CADENCE.research)
    s.combat.docked = true
    s = setResearchFocus(s, 'material')
    s.hiveResearch.progress = 40
    s.hiveResearch.xp.material = 40
    s.hiveResearch.completedIds = ['plate-bank', 'extra-tap']
    s.hiveResearch.completed.energy = 2
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.hiveResearch.completedIds).toEqual(expect.arrayContaining(['plate-bank', 'extra-tap']))
    expect(s.hiveResearch.xp.material).toBe(40)
    expect(hiveResearchActive(s)).toBe(true)

    s.lastTickAt = 0
    const xp = hiveResearchXp(s, 'material')
    const { state: next } = applyOfflineCatchUp(s, 60 * 1000)
    expect(hiveResearchXp(next, 'material')).toBeGreaterThan(xp)
  })

  it('forks and later reconnects instead of a linear 1-2-3 sequence', () => {
    const s = researchState()
    const extra = getHiveResearchNode('extra-tap')!
    const keel = getHiveResearchNode('keel-bay')!
    const hangar = getHiveResearchNode('hangar-swap')!
    expect(extra.prerequisites).toEqual(['plate-bank'])
    expect(keel.prerequisites).toEqual(['plate-bank'])
    expect(hangar.prerequisites).toEqual(['extra-tap', 'keel-bay'])
    expect(hiveResearchVisibleNodes(s, 'energy').map((n) => n.id)).toEqual(['plate-bank'])
    s.hiveResearch.completedIds = ['plate-bank']
    s.hiveResearch.completed.energy = 1
    const opened = hiveResearchAvailableNodes(s, 'energy').map((n) => n.id)
    expect(opened).toEqual(expect.arrayContaining(['extra-tap', 'keel-bay', 'workshop-primer']))
    expect(opened.length).toBeGreaterThanOrEqual(3)
    expect(researchNodeViewState(s, hangar)).toBe('hidden')
    s.hiveResearch.completedIds = ['plate-bank', 'extra-tap']
    expect(researchNodeViewState(s, hangar)).toBe('locked')
  })

  it('maps old sequential energy ranks onto the new branching ids', () => {
    const s = researchState()
    s.hiveResearch.completed.energy = 3
    expect(hiveResearchCompletedIds(s)).toEqual(['priority-lock', 'plate-bank', 'extra-tap'])
    expect(hiveResearchFurnaceSlots(s)).toBe(1)
    expect(hiveResearchFocusFire(s)).toBe(true)
  })
})
