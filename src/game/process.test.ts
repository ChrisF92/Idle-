import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  buyProcessNode,
  performPrestige,
  setProcessConfig,
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
import {
  NETWORK_GUIDE_IDS,
  STARTER_GUIDE_IDS,
  activeGuideStep,
  skipOnboarding,
  tryCompleteAchievements,
} from './progression'
import { exportSave, importSave } from './save'

describe('Process 2.0 ledger', () => {
  it('keeps Earned when Available is spent', () => {
    let s = createInitialState(0)
    s.meta.aiUnlocked = true
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

  it('exposes Furnace 2.0 output as a hook without applying it to current Heat', () => {
    const s = createInitialState(0)
    s.process.earned = 150
    expect(processFurnaceHooks(s).outputMult).toBeCloseTo(1.15)
    expect(s.resources.heat ?? 0).toBe(0)
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
  function processReady() {
    const s = createInitialState(0)
    s.meta.aiUnlocked = true
    s.meta.completedAchievements = ['first-blood']
    s.meta.seenOnboarding = [
      ...STARTER_GUIDE_IDS,
      ...NETWORK_GUIDE_IDS,
      'guide-foundry',
      'guide-reliquary',
      'guide-furnace',
      'guide-research-tab',
      'guide-salvage',
      'guide-ai-tab',
    ]
    return s
  }

  it('opens the Process 2.0 tour after the Process door', () => {
    const s = processReady()
    expect(activeGuideStep(s, 'process')?.id).toBe('guide-process-v2-what')
  })

  it('still offers the 2.0 tour on saves that saw the old Process guides', () => {
    const s = processReady()
    s.meta.seenOnboarding = [...s.meta.seenOnboarding, 'guide-achievements']
    expect(activeGuideStep(s, 'process')?.id).toBe('guide-process-v2-what')
  })

  it('Skip on What Process is dismisses the whole 2.0 group', () => {
    const skipped = skipOnboarding(processReady(), 'guide-process-v2-what')
    expect(activeGuideStep(skipped, 'process')).toBeNull()
    expect(skipped.meta.seenOnboarding).toContain('guide-process-v2-buy')
  })

  it('does not stick on First purchase if a node is already owned', () => {
    const s = processReady()
    s.process.purchased = ['core-buy-max']
    s.meta.seenOnboarding = [
      ...s.meta.seenOnboarding,
      'guide-process-v2-what',
      'guide-process-v2-earn',
      'guide-process-v2-ledger',
      'guide-process-v2-automation',
      'guide-process-v2-qol',
      'guide-process-v2-accumulation',
      'guide-process-v2-understand',
    ]
    expect(activeGuideStep(s, 'process')?.id).not.toBe('guide-process-v2-buy')
  })
})
