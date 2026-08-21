import { describe, expect, it } from 'vitest'
import { assignWorker, performRebuild, setResearchFocus } from './actions'
import { ACT1_CADENCE } from './cadence'
import {
  grantHiveResearchKillXp,
  hiveResearchActive,
  hiveResearchCompleted,
  hiveResearchNodeCost,
  hiveResearchSpeed,
  hiveResearchXp,
  HIVE_RESEARCH_NODES,
  HIVE_RESEARCH_WORKER_ACCEL,
} from './hiveResearch'
import { applyOfflineCatchUp } from './offline'
import { isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { systemsHubCards } from './systemsHub'
import { armRebuildDoor, atCareerWave, markHullLost } from './testHelpers'
import { advanceTicks } from './tick'

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
    expect(systemsHubCards(open).map((c) => c.id)).toEqual(['foundry', 'network', 'furnace', 'research'])
    expect(HIVE_RESEARCH_NODES.energy.length).toBe(9)
    expect(HIVE_RESEARCH_NODES.observation.length).toBe(9)
    expect(HIVE_RESEARCH_NODES.material.length).toBe(9)
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
    advanceTicks(s, 10)
    expect(hiveResearchXp(s, 'energy')).toBeGreaterThan(before)
    expect(hiveResearchCompleted(s, 'material')).toBe(0)
  })

  it('lets Sensor Net drones accelerate the active project', () => {
    let slow = researchState()
    slow.combat.docked = true
    slow = setResearchFocus(slow, 'energy')
    const base = hiveResearchSpeed(slow)

    let fast = researchState()
    fast.combat.docked = true
    fast.base.workerDrones = 8
    fast = assignWorker(fast, 'sensor-net', 4)
    fast = setResearchFocus(fast, 'energy')
    expect(hiveResearchSpeed(fast)).toBeCloseTo(base + HIVE_RESEARCH_WORKER_ACCEL * 4)
    expect(hiveResearchSpeed(fast)).toBeGreaterThan(base)
  })

  it('completes the project and frees the slot', () => {
    let s = researchState()
    s.combat.docked = true
    s = setResearchFocus(s, 'energy')
    const need = hiveResearchNodeCost(0, s)
    s.hiveResearch.xp.energy = need - 1
    advanceTicks(s, 2)
    expect(hiveResearchCompleted(s, 'energy')).toBe(1)
    expect(hiveResearchActive(s)).toBe(false)
  })

  it('keeps Research across Rebuild and continues offline', () => {
    let s = armRebuildDoor(createInitialState(0))
    s = atCareerWave(s, ACT1_CADENCE.research)
    s.combat.docked = true
    s = setResearchFocus(s, 'material')
    s.hiveResearch.xp.material = 40
    s.hiveResearch.completed.energy = 2
    s = performRebuild(s, { frameId: 'scout-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.hiveResearch.completed.energy).toBe(2)
    expect(s.hiveResearch.xp.material).toBe(40)
    expect(hiveResearchActive(s)).toBe(true)

    s.lastTickAt = 0
    const xp = hiveResearchXp(s, 'material')
    const { state: next } = applyOfflineCatchUp(s, 60 * 1000)
    expect(hiveResearchXp(next, 'material')).toBeGreaterThan(xp)
  })
})
