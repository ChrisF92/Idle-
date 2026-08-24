import { describe, expect, it } from 'vitest'
import { applyNetworkPreset, buyProcessNode, performRebuild } from './actions'
import { tickAutomation } from './automation'
import { ACT1_CADENCE, PROCESS_MIN_REBUILDS } from './cadence'
import { shopReadoutUnlocked } from './disclosure'
import {
  NETWORK_PRESETS,
  PROCESS_HIDDEN_IDS,
  PROCESS_NODES,
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
import {
  evaluateProcessIntent,
  processShouldExtract,
  shopCategorySpend,
} from './processProfiles'
import { isSystemUnlocked } from './progression'
import { createInitialState, SAVE_VERSION } from './state'
import { systemsHubCards } from './systemsHub'
import { armRebuildDoor, atCareerWave, markHullLost } from './testHelpers'
import { shopEconomyRoi, shopTimeToAfford } from './workshop'

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
    expect(ids).toContain('buy-ten')
    expect(ids).toContain('shop-buy-max')
    expect(ids).toContain('shop-readout')
    expect(ids).toContain('auto-shop')
    expect(ids).not.toContain('core-buy-max')
    expect(ids).not.toContain('auto-salvage')
    expect(ids).not.toContain('spend-ratios')
    expect(ids).not.toContain('rule-builder')
    expect(ids).not.toContain('run-profiles')
    expect(ids).not.toContain('core-priority')
    expect(ids).not.toContain('foundry-priority')
    expect(ids).not.toContain('foundry-buy-max')
    expect(ids).not.toContain('foundry-auto')
    for (const hidden of PROCESS_HIDDEN_IDS) {
      expect(ids).not.toContain(hidden)
    }
    expect(canBuyProcessNode(open, 'auto-bank').ok).toBe(false)
    expect(canBuyProcessNode(open, 'offline-sortie').ok).toBe(false)
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
    s.process.purchased = ['buy-ten']
    s.process.earned = 40
    s.resources.aiPoints = 36
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.process.purchased).toContain('buy-ten')
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
    expect(defence.base.assignments['repair-bay'] ?? 0).toBe(0)
    expect(defence.base.assignments['alloy-foundry'] ?? 0).toBeGreaterThan(0)
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

  it('prices the Process shop ladder and hides leftover Sortie / Furnace nodes', () => {
    expect(SAVE_VERSION).toBe(37)
    expect(PROCESS_NODES.find((n) => n.id === 'buy-ten')?.cost).toBe(2)
    expect(PROCESS_NODES.find((n) => n.id === 'shop-buy-max')?.cost).toBe(4)
    expect(PROCESS_NODES.find((n) => n.id === 'shop-readout')?.cost).toBe(2)
    expect(PROCESS_NODES.find((n) => n.id === 'auto-shop')?.cost).toBe(8)
    expect(PROCESS_NODES.find((n) => n.id === 'spend-ratios')?.cost).toBe(8)
    expect(PROCESS_NODES.find((n) => n.id === 'rule-builder')?.cost).toBe(12)
    expect(PROCESS_NODES.find((n) => n.id === 'run-profiles')?.cost).toBe(10)
    expect(PROCESS_NODES.find((n) => n.id === 'core-buy-max')).toBeUndefined()
    expect(PROCESS_HIDDEN_IDS.has('offline-sortie')).toBe(true)
    expect(PROCESS_HIDDEN_IDS.has('auto-bank')).toBe(true)
    expect(PROCESS_HIDDEN_IDS.has('echo-repeat')).toBe(true)
    expect(PROCESS_HIDDEN_IDS.has('network-tune')).toBe(true)
    expect(PROCESS_HIDDEN_IDS.has('foundry-buy-max')).toBe(true)
    expect(PROCESS_HIDDEN_IDS.has('foundry-auto')).toBe(true)
  })

  it('shows time-to-afford and Economy ROI only after Shop Readout', () => {
    const s = processState()
    s.combat.docked = false
    s.combat.fightElapsed = 20
    s.resources.salvage = 3
    expect(shopReadoutUnlocked(s)).toBe(false)
    expect(shopTimeToAfford(s, 8, 3)).toBeNull()
    expect(shopEconomyRoi(s, 'salvage-kill')).toBeNull()
    s.process.purchased = ['shop-readout']
    expect(shopReadoutUnlocked(s)).toBe(true)
    expect(shopTimeToAfford(s, 8, 20)).toBe('Affordable now')
    expect(shopEconomyRoi(s, 'salvage-kill')).toMatch(/ROI/)
  })

  it('lets Farm auto-buy Economy first and Extract under half hull', () => {
    const s = processState()
    s.combat.docked = false
    s.combat.wave = 8
    s.combat.playerHull = 40
    s.combat.playerHullMax = 100
    s.resources.salvage = 400
    s.process.purchased = ['buy-ten', 'auto-shop', 'spend-ratios', 'rule-builder', 'run-profiles']
    s.process.config = { ...processConfig(s), activeProfileId: 'farm' }

    const intent = evaluateProcessIntent(s)
    expect(intent.spend.economy).toBeGreaterThan(intent.spend.attack)
    expect(intent.autoShop).toBe(true)
    expect(intent.autoExtract).toBe(true)
    expect(processShouldExtract(s)).toBe(true)

    tickAutomation(s)
    expect(shopCategorySpend(s, 'economy')).toBeGreaterThan(shopCategorySpend(s, 'attack'))
    expect((s.combat.runUpgrades['salvage-kill'] ?? 0) + (s.combat.runUpgrades['salvage-wave'] ?? 0)).toBeGreaterThan(
      s.combat.runUpgrades['weapon-power'] ?? 0,
    )
  })

  it('lets Push dump Economy at 95% of Best and light Furnace', () => {
    const s = processState()
    s.combat.docked = false
    s.combat.wave = Math.ceil(ACT1_CADENCE.process * 0.95)
    s.resources.choirAsh = 80
    s.resources.heat = 0
    s.process.purchased = ['buy-ten', 'auto-shop', 'spend-ratios', 'rule-builder', 'run-profiles']
    s.process.config = { ...processConfig(s), activeProfileId: 'push' }

    const intent = evaluateProcessIntent(s)
    expect(intent.spend.economy).toBe(0)
    expect(intent.furnacePush).toBe(true)
    expect(intent.autoExtract).toBe(false)
    expect(processShouldExtract(s)).toBe(false)

    tickAutomation(s)
    expect(s.furnace.wanted.weapons).toBeGreaterThanOrEqual(1)
    expect(s.furnace.active.weapons).toBeGreaterThanOrEqual(1)
    expect((s.resources.choirAsh ?? 0) + (s.resources.heat ?? 0) * 10).toBeLessThan(80)
  })
})
