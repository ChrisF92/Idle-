import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  applyNetworkPreset,
  buyProcessNode,
  performPrestige,
  setProcessConfig,
  optimiseNetwork,
} from './actions'
import {
  canBuyProcessNode,
  hasProcess,
  hasProcessMastery,
  hydrateProcessState,
  processAvailable,
  processConfig,
  processDamageMult,
  processEarned,
  processFurnaceHooks,
  processSalvageMult,
  processShieldMult,
} from './process'
import { furnaceGenerationPerSec, furnaceIdleGenPerSec } from './furnace'
import {
  NETWORK_GUIDE_IDS,
  STARTER_GUIDE_IDS,
  activeGuideStep,
  tryCompleteAchievements,
} from './progression'
import { exportSave, importSave } from './save'
import { tickAutomation } from './automation'
import { idleWorkers } from './catalog'

describe('Process 2.0 ledger', () => {
  it('keeps Earned when Available is spent', () => {
    let s = createInitialState(0)
    s.meta.aiUnlocked = true
    s.meta.completedAchievements = ['neural-link']
    s.shipyard.moduleLevels['pulse-cannon'] = 1
    s.resources.aiPoints = 10
    s.process.earned = 10
    expect(processAvailable(s)).toBe(10)
    expect(processEarned(s)).toBe(10)
    s = buyProcessNode(s, 'core-buy-max')
    expect(hasProcess(s, 'core-buy-max')).toBe(true)
    expect(processAvailable(s)).toBe(6)
    expect(processEarned(s)).toBe(10)
  })

  it('unlocks Accumulation from lifetime Earned, not spendable Available', () => {
    const s = createInitialState(0)
    s.resources.aiPoints = 0
    s.process.earned = 10
    expect(processSalvageMult(s)).toBeCloseTo(1.1)
    s.process.earned = 9
    expect(processSalvageMult(s)).toBe(1)
    s.process.earned = 35
    expect(processDamageMult(s)).toBeCloseTo(1.1)
    expect(processShieldMult(s)).toBeCloseTo(1.1)
  })

  it('applies Accumulation Heat Ledger to Furnace generation without changing stored Heat', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 5
    s.process.earned = 150
    expect(processFurnaceHooks(s).outputMult).toBeCloseTo(1.15)
    expect(s.resources.heat ?? 0).toBe(0)
    expect(furnaceIdleGenPerSec(s)).toBeCloseTo(0.02 * 1.15)
    expect(furnaceGenerationPerSec(s)).toBeGreaterThan(0.02)
  })
})

describe('Process 2.0 save and prestige', () => {
  it('hydrates an old purchased-only Process blob and reconstructs Earned', () => {
    const s = createInitialState(0)
    s.resources.aiPoints = 4
    s.process = { purchased: ['auto-salvage'] } as typeof s.process
    const imported = importSave(exportSave(s))
    expect(imported).toBeTruthy()
    expect(imported!.process.purchased).toContain('auto-salvage')
    expect(imported!.process.purchased).toContain('core-buy-max')
    expect(imported!.process.config.reliquary.autoMerge).toBe(false)
    expect(processEarned(imported!)).toBeGreaterThanOrEqual(4 + 8)
  })

  it('grantProcessPrereqs fills missing parents on hydrate', () => {
    const hydrated = hydrateProcessState({ purchased: ['offline-sortie'] } as never)
    expect(hydrated.purchased).toContain('auto-extract')
    expect(hydrated.purchased).toContain('offline-sortie')
  })

  it('Rebuild keeps purchased nodes, Earned, and config', () => {
    let s = createInitialState(0)
    s.combat.sector = 10
    s.meta.highestSectorEver = 8
    s.process.purchased = ['core-buy-max']
    s.process.earned = 20
    s.process.config.core.priority = 'weapon'
    s.resources.aiPoints = 10
    s = performPrestige(s, 1000)
    expect(hasProcess(s, 'core-buy-max')).toBe(true)
    expect(processEarned(s)).toBeGreaterThanOrEqual(20)
    expect(processConfig(s).core.priority).toBe('weapon')
  })

  it('persists Process config writes', () => {
    let s = createInitialState(0)
    s.process.purchased = ['auto-salvage']
    s = setProcessConfig(s, {
      ...processConfig(s),
      core: { ...processConfig(s).core, enabled: false, priority: 'shield' },
    })
    expect(processConfig(s).core.enabled).toBe(false)
    expect(processConfig(s).core.priority).toBe('shield')
  })
})

describe('Process 2.0 mastery and achievements', () => {
  it('gates Core Buy Max until a Core is ranked', () => {
    const s = createInitialState(0)
    s.meta.aiUnlocked = true
    s.resources.aiPoints = 20
    expect(hasProcessMastery(s, 'cores')).toBe(false)
    expect(canBuyProcessNode(s, 'core-buy-max').ok).toBe(false)
    s.shipyard.moduleLevels['pulse-cannon'] = 1
    expect(hasProcessMastery(s, 'cores')).toBe(true)
    expect(canBuyProcessNode(s, 'core-buy-max').ok).toBe(true)
  })

  it('does not require mastery for Ash Bank or Smart Smelt', () => {
    const s = createInitialState(0)
    s.meta.aiUnlocked = true
    s.meta.highestSectorEver = 5
    s.combat.highestSector = 5
    s.resources.aiPoints = 20
    expect(canBuyProcessNode(s, 'auto-bank').ok).toBe(true)
    expect(canBuyProcessNode(s, 'smart-smelt').ok).toBe(true)
  })

  it('First Blood grants 4 Process Available and Earned', () => {
    const s = createInitialState(0)
    s.combat.highestSector = 1
    const newly = tryCompleteAchievements(s)
    expect(newly).toContain('first-blood')
    expect(s.resources.aiPoints).toBe(4)
    expect(processEarned(s)).toBe(4)
  })
})

describe('Process 2.0 onboarding', () => {
  it('does not force a Process tree tour on unlock', () => {
    const s = createInitialState(0)
    s.meta.aiUnlocked = true
    s.meta.completedAchievements = ['first-blood']
    s.meta.seenOnboarding = [...STARTER_GUIDE_IDS, ...NETWORK_GUIDE_IDS]
    expect(activeGuideStep(s, 'process')).toBeNull()
  })
})
describe('Process 2.0 Network presets and optimiser', () => {
  it('Optimise is deterministic and honour Push vs Defence vs Farm', () => {
    const ready = () => {
      let s = createInitialState(0)
      s.meta.hullLostOnce = true
      s.meta.highestSectorEver = 8
      s.combat.highestSector = 8
      s.base.workerDrones = 10
      s.process.purchased = ['network-optimise', 'network-presets']
      return s
    }

    let push = ready()
    push = setProcessConfig(push, {
      ...processConfig(push),
      network: { ...processConfig(push).network, preset: 'push' },
    })
    push = optimiseNetwork(push)
    const pushAgain = optimiseNetwork(push)
    expect(push.base.assignments).toEqual(pushAgain.base.assignments)
    expect(push.base.assignments.strike ?? 0).toBeGreaterThan(push.base.assignments.ward ?? 0)
    expect(push.base.assignments['strike-relay'] ?? 0).toBeGreaterThan(0)

    let defence = ready()
    defence = applyNetworkPreset(defence, 'defence')
    expect(defence.base.assignments.ward ?? 0).toBeGreaterThan(defence.base.assignments.strike ?? 0)

    let farm = ready()
    farm.meta.highestSectorEver = 12
    farm.combat.highestSector = 12
    farm = applyNetworkPreset(farm, 'farm')
    expect(farm.base.assignments.yield ?? 0).toBeGreaterThan(farm.base.assignments.strike ?? 0)
  })

  it('Auto Optimise redistributes idle drones using the current preset', () => {
    let s = createInitialState(0)
    s.meta.hullLostOnce = true
    s.meta.highestSectorEver = 8
    s.combat.highestSector = 8
    s.base.workerDrones = 10
    s.base.assignments.strike = 4
    s.process.purchased = ['network-optimise', 'network-presets', 'network-balance']
    s = setProcessConfig(s, {
      ...processConfig(s),
      network: { ...processConfig(s).network, enabled: true, preset: 'defence' },
    })
    tickAutomation(s)
    expect(s.base.assignments.ward ?? 0).toBeGreaterThan(s.base.assignments.strike ?? 0)
    expect(idleWorkers(s)).toBe(0)
  })
})
