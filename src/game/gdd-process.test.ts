import { describe, expect, it } from 'vitest'
import { applyNetworkPreset, buyProcessNode, performRebuild } from './actions'
import { ACT1_CADENCE, PROCESS_MIN_REBUILDS } from './cadence'
import {
  NETWORK_PRESETS,
  PROCESS_HIDDEN_IDS,
  canBuyProcessNode,
  hasProcessMastery,
  mergeProcessConfig,
  networkAllocationWeights,
  processConfig,
  processFurnaceHooks,
  processLessonCount,
  processOnlineBlurb,
  processVisibleNodes,
} from './process'
import { isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { systemsHubCards } from './systemsHub'
import { armRebuildDoor, atCareerWave, markHullLost } from './testHelpers'

function processState(opts?: { wave?: number; rebuilds?: number; research?: boolean }) {
  const s = atCareerWave(markHullLost(createInitialState(0)), opts?.wave ?? ACT1_CADENCE.process)
  s.prestige.prestigeCount = opts?.rebuilds ?? PROCESS_MIN_REBUILDS
  if (opts?.research !== false) s.hiveResearch.completed.energy = 1
  return s
}

describe('GDD Process', () => {
  it('stays locked before Wave 210', () => {
    const locked = processState({ wave: ACT1_CADENCE.process - 1 })
    expect(isSystemUnlocked(locked, 'process')).toBe(false)
    expect(systemsHubCards(locked).map((c) => c.id)).not.toContain('process')
  })

  it('stays locked at Wave 210 without Rebuilds or Research', () => {
    const noRebuild = processState({ rebuilds: 1 })
    expect(isSystemUnlocked(noRebuild, 'process')).toBe(false)

    const noResearch = processState({ research: false })
    expect(isSystemUnlocked(noResearch, 'process')).toBe(false)
  })

  it('opens under Systems at Wave 210 after two Rebuilds and a Research project', () => {
    const open = processState()
    expect(isSystemUnlocked(open, 'process')).toBe(true)
    expect(systemsHubCards(open).map((c) => c.id)).toEqual(['foundry', 'furnace', 'research', 'process'])
  })

  it('shows QoL and simple actions first, hiding retired furnace and Ghost Sortie nodes', () => {
    const open = processState()
    const ids = processVisibleNodes(open).map((n) => n.id)
    expect(ids).toContain('core-buy-max')
    expect(ids).toContain('auto-salvage')
    expect(ids).not.toContain('core-priority')
    expect(ids).not.toContain('foundry-priority')
    for (const hidden of PROCESS_HIDDEN_IDS) {
      expect(ids).not.toContain(hidden)
    }
    expect(canBuyProcessNode(open, 'auto-bank').ok).toBe(false)
    expect(canBuyProcessNode(open, 'offline-sortie').ok).toBe(false)
  })

  it('gates later Process nodes on Best Wave, not leftover sector bands', () => {
    const early = processState({ wave: 50 })
    early.process.purchased = ['auto-salvage']
    early.resources.aiPoints = 20
    expect(canBuyProcessNode(early, 'smart-core').reason).toBe('Reach Wave 60')
    const ready = processState({ wave: 60 })
    ready.process.purchased = ['auto-salvage']
    ready.resources.aiPoints = 20
    expect(canBuyProcessNode(ready, 'smart-core').ok).toBe(true)
  })

  it('reveals priorities after the first purchase', () => {
    let s = processState()
    s.shipyard.moduleLevels['pulse-cannon'] = 1
    s.resources.aiPoints = 20
    s = buyProcessNode(s, 'core-buy-max')
    const ids = processVisibleNodes(s).map((n) => n.id)
    expect(ids).toContain('core-priority')
    expect(ids).not.toContain('smart-core')
  })

  it('counts industrial Worker jobs as mastery, not Strike or Ward bars', () => {
    const s = processState()
    s.base.assignments.strike = 3
    s.base.assignments.ward = 2
    expect(hasProcessMastery(s, 'network')).toBe(false)
    s.base.assignments['scrap-field'] = 1
    expect(hasProcessMastery(s, 'network')).toBe(true)
  })

  it('never auto-feeds the Furnace, even if the old Auto Feed node is owned', () => {
    const s = processState()
    s.process.purchased = ['auto-bank']
    expect(processFurnaceHooks(s).autoFeed).toBe(false)
  })

  it('uses practised loops for the first-open history line', () => {
    const s = processState()
    s.shipyard.moduleLevels['pulse-cannon'] = 5
    s.workshop.levels['plate-layer'] = 3
    expect(processLessonCount(s)).toBe(8)
    expect(processOnlineBlurb(s)).toMatch(/8 times/)
    expect(processOnlineBlurb(s)).toMatch(/you've learned/)
  })

  it('keeps Process purchases and Earned across Rebuild', () => {
    let s = armRebuildDoor(createInitialState(0))
    s = atCareerWave(s, ACT1_CADENCE.process)
    s.combat.docked = true
    s.prestige.prestigeCount = PROCESS_MIN_REBUILDS
    s.hiveResearch.completed.energy = 1
    s.process.purchased = ['core-buy-max']
    s.process.earned = 40
    s.resources.aiPoints = 36
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.process.purchased).toContain('core-buy-max')
    expect(s.process.earned).toBeGreaterThanOrEqual(40)
  })

  it('maps Worker presets onto industrial jobs, not Strike or Ward', () => {
    expect(NETWORK_PRESETS.farm['scrap-field']).toBeGreaterThan(NETWORK_PRESETS.farm.strike ?? 0)
    expect(NETWORK_PRESETS.push.strike).toBeUndefined()
    expect(NETWORK_PRESETS.defence.ward).toBeUndefined()

    let farm = processState()
    farm.base.workerDrones = 10
    farm.process.purchased = ['network-optimise', 'network-presets']
    farm = applyNetworkPreset(farm, 'farm')
    expect(farm.base.assignments.strike ?? 0).toBe(0)
    expect(farm.base.assignments.ward ?? 0).toBe(0)
    expect(farm.base.assignments['scrap-field'] ?? 0).toBeGreaterThan(0)

    let defence = processState()
    defence.base.workerDrones = 10
    defence.process.purchased = ['network-optimise', 'network-presets']
    defence = applyNetworkPreset(defence, 'defence')
    expect(defence.base.assignments['repair-bay'] ?? 0).toBeGreaterThan(
      defence.base.assignments['scrap-field'] ?? 0,
    )
  })

  it('leans Farm toward Scrap Field while flying after Network Sortie Bias', () => {
    const s = processState()
    s.combat.docked = false
    s.process.purchased = ['network-tune']
    s.process.config = {
      ...processConfig(s),
      network: { ...processConfig(s).network, preset: 'farm' },
    }
    const flying = networkAllocationWeights(s)
    s.combat.docked = true
    const docked = networkAllocationWeights(s)
    expect(flying['scrap-field']).toBeGreaterThan(docked['scrap-field'])
  })

  it('rewrites leftover Yield/Loom/Archive ratio keys onto jobs', () => {
    const cfg = mergeProcessConfig({
      network: { preset: 'custom', ratios: { yield: 5, loom: 3, archive: 2 } },
    })
    expect(cfg.network.ratios['scrap-field']).toBe(5)
    expect(cfg.network.ratios['drone-fab']).toBe(3)
    expect(cfg.network.ratios['sensor-net']).toBe(2)
    expect(cfg.network.ratios.yield).toBeUndefined()
  })
})
