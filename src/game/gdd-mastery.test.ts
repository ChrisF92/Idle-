import { describe, expect, it } from 'vitest'
import { setResearchFocus } from './actions'
import { ACT1_CADENCE } from './cadence'
import { LATE_ACT1_MODULE_MASTERY, moduleMasteryCap, moduleMasteryRank } from './catalog'
import {
  hiveResearchActive,
  hiveResearchComputationUnlocked,
  hiveResearchExtraUtilitySlots,
  HIVE_RESEARCH_NODES,
} from './hiveResearch'
import { MORE_STATIONS, moreStationBuckets } from './moreStations'
import { isSystemUnlocked } from './progression'
import { coreSocketLayout, isRelicsUnlocked } from './relics'
import { masteryMilestonesFor } from './coreProgression'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'

function masteryState(opts?: { wave?: number; rebuilds?: number; research?: boolean }) {
  const s = atCareerWave(markHullLost(createInitialState(0)), opts?.wave ?? ACT1_CADENCE.research)
  s.prestige.prestigeCount = opts?.rebuilds ?? 0
  if (opts?.research !== false) {
    s.hiveResearch.completedIds = ['c1-queue-buffer', 'c2-combat-telemetry', 'c3-deep-queue', 'c4-process-kernel']
    s.hiveResearch.completed.computation = 4
  }
  s.combat.docked = true
  return s
}

describe('GDD late Act 1 mastery', () => {
  it('keeps Research disciplines locked before Wave 525', () => {
    const locked = masteryState({ wave: ACT1_CADENCE.research - 1 })
    expect(hiveResearchComputationUnlocked(locked)).toBe(false)
    expect(setResearchFocus(locked, 'computation')).toBe(locked)
    expect(isRelicsUnlocked(locked)).toBe(true)
    expect(coreSocketLayout(locked, 'pulse-cannon')).toEqual([])
    expect(moduleMasteryCap(locked)).toBe(LATE_ACT1_MODULE_MASTERY)
    expect(hiveResearchExtraUtilitySlots(locked)).toBe(0)
  })

  it('opens Computational Research at its Wave door while Process still waits for Kernel', () => {
    const withoutKernel = masteryState({ research: false })
    expect(isSystemUnlocked(withoutKernel, 'process')).toBe(false)
    expect(hiveResearchComputationUnlocked(withoutKernel)).toBe(true)
    expect(setResearchFocus(withoutKernel, 'computation')).not.toBe(withoutKernel)
  })

  it('expands existing systems after Process Kernel', () => {
    const open = masteryState()
    expect(hiveResearchComputationUnlocked(open)).toBe(true)
    expect(HIVE_RESEARCH_NODES.computation.length).toBeGreaterThanOrEqual(6)
    const next = setResearchFocus(open, 'computation')
    expect(hiveResearchActive(next)).toBe(true)
    expect(next.hiveResearch.focus).toBe('computation')
    expect(isRelicsUnlocked(open)).toBe(true)
    expect(coreSocketLayout(open, 'pulse-cannon')).toEqual([])
    expect(masteryMilestonesFor('pulse-cannon').find((ms) => ms.level === 20)?.socket).toBe('optical')
    expect(moduleMasteryCap(open)).toBe(LATE_ACT1_MODULE_MASTERY)
    expect(hiveResearchExtraUtilitySlots(open)).toBe(0)
  })

  it('lets Core Mastery climb past 10 after Wave 275 without leftover parts', () => {
    const s = masteryState()
    s.meta.moduleMastery = { ...s.meta.moduleMastery, 'pulse-cannon': 11 }
    expect(moduleMasteryRank(s, 'pulse-cannon')).toBe(11)
    expect(moduleMasteryCap(s)).toBe(LATE_ACT1_MODULE_MASTERY)
  })

  it('keeps Specialists, Tasks, and Echo shut, and does not add a More card', () => {
    const open = masteryState()
    expect(isSystemUnlocked(open, 'specialists')).toBe(false)
    expect(isSystemUnlocked(open, 'tasks')).toBe(false)
    expect(isSystemUnlocked(open, 'echo')).toBe(false)
    expect(MORE_STATIONS.map((s) => s.id)).toEqual(['codex', 'challenges', 'reinforce'])
    expect(moreStationBuckets(open).open.map((s) => s.id)).toEqual(['codex', 'challenges'])
    expect(moreStationBuckets(open).next).toEqual([])
    expect(moreStationBuckets(open).open.map((s) => s.id)).not.toContain('reinforce')
  })
})
