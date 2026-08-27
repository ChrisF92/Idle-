import { describe, expect, it } from 'vitest'
import { setResearchFocus } from './actions'
import { ACT1_CADENCE, PROCESS_MIN_REBUILDS } from './cadence'
import { LATE_ACT1_MODULE_MASTERY, moduleMasteryCap, moduleMasteryRank } from './catalog'
import {
  hiveResearchActive,
  hiveResearchComputationUnlocked,
  hiveResearchExtraUtilitySlots,
  HIVE_RESEARCH_NODES,
} from './hiveResearch'
import { MORE_STATIONS, moreStationBuckets } from './moreStations'
import { isSystemUnlocked } from './progression'
import { coreSocketLayout } from './reliquary'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'

function masteryState(opts?: { wave?: number; rebuilds?: number; research?: boolean }) {
  const s = atCareerWave(markHullLost(createInitialState(0)), opts?.wave ?? ACT1_CADENCE.mastery)
  s.prestige.prestigeCount = opts?.rebuilds ?? PROCESS_MIN_REBUILDS
  if (opts?.research !== false) s.hiveResearch.completed.energy = 1
  s.combat.docked = true
  return s
}

describe('GDD late Act 1 mastery', () => {
  it('stays locked before Wave 275', () => {
    const locked = masteryState({ wave: ACT1_CADENCE.mastery - 1 })
    expect(hiveResearchComputationUnlocked(locked)).toBe(false)
    expect(setResearchFocus(locked, 'computation')).toBe(locked)
    expect(coreSocketLayout(locked, 'pulse-cannon')).toEqual(['power'])
    expect(moduleMasteryCap(locked)).toBe(LATE_ACT1_MODULE_MASTERY)
    expect(hiveResearchExtraUtilitySlots(locked)).toBe(0)
  })

  it('stays locked at Wave 275 until Process is online', () => {
    const noRebuild = masteryState({ rebuilds: 1 })
    expect(isSystemUnlocked(noRebuild, 'process')).toBe(false)
    expect(hiveResearchComputationUnlocked(noRebuild)).toBe(false)
    expect(setResearchFocus(noRebuild, 'computation')).toBe(noRebuild)
  })

  it('expands existing systems at Wave 275 after Process', () => {
    const open = masteryState()
    expect(hiveResearchComputationUnlocked(open)).toBe(true)
    expect(HIVE_RESEARCH_NODES.computation.length).toBeGreaterThanOrEqual(6)
    const next = setResearchFocus(open, 'computation')
    expect(hiveResearchActive(next)).toBe(true)
    expect(next.hiveResearch.focus).toBe('computation')
    expect(coreSocketLayout(open, 'pulse-cannon')).toEqual(['power', 'universal'])
    expect(moduleMasteryCap(open)).toBe(LATE_ACT1_MODULE_MASTERY)
    expect(hiveResearchExtraUtilitySlots(open)).toBe(1)
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
    expect(MORE_STATIONS.map((s) => s.id)).toEqual(['codex', 'protocols', 'reinforce'])
    expect(moreStationBuckets(open).open.map((s) => s.id)).toEqual(['codex', 'protocols'])
    expect(moreStationBuckets(open).next).toEqual([])
    expect(moreStationBuckets(open).open.map((s) => s.id)).not.toContain('reinforce')
  })
})
