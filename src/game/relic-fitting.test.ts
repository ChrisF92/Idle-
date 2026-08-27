import { afterEach, describe, expect, it } from 'vitest'
import { fitModule, performRebuild, removeRelicFromCore, unfitModule, upgradeRelic } from './actions'
import { ACT1_CADENCE } from './cadence'
import { grantModuleCopy } from './coreProgression'
import { tickFoundry } from './foundry'
import {
  addRelicInstance,
  canFitRelic,
  canStartRelicUpgrade,
  coreRelicId,
  coreSocketRelics,
  equipRelicOnCore,
  relicFamilyOwnedCount,
  relicFitLocation,
  relicState,
  setRelicSocketActivationProvider,
} from './relics'
import { relicUpgradeJobId } from './relicSeeds'
import { setRelicTemperCapabilityProvider } from './relicSources'
import {
  FIXTURE_OPTICAL_BEHAVIOURAL,
  FIXTURE_OPTICAL_STANDARD,
  FIXTURE_POWER_BEHAVIOURAL,
  FIXTURE_POWER_STANDARD,
  FIXTURE_SHIELD_STANDARD,
  installAuthoredRelicFixtures,
  resetRelicTestFixtures,
} from './relicTestFixtures'
import { createInitialState } from './state'
import { atCareerWave, equipPostTutorialLoadout, forceUnlockModule } from './testHelpers'

function relicDock(wave = ACT1_CADENCE.reliquary) {
  let s = atCareerWave(createInitialState(0), wave)
  s = equipPostTutorialLoadout(s)
  s.combat.docked = true
  installAuthoredRelicFixtures()
  setRelicSocketActivationProvider(() => [0, 1])
  return s
}

function stock(state: ReturnType<typeof createInitialState>, materials: Record<string, number>) {
  for (const [id, n] of Object.entries(materials)) state.foundry.materials[id] = n
}

afterEach(() => {
  setRelicTemperCapabilityProvider(null)
  setRelicSocketActivationProvider(null)
  resetRelicTestFixtures()
})

describe('PR6 Relic fitting', () => {
  it('requires exact physical Core and Relic instance IDs', () => {
    let s = relicDock()
    const a = addRelicInstance(s, FIXTURE_POWER_STANDARD.id)!
    expect(canFitRelic(s, 'missing-core:9', a.id, 0).reason).toBe('missing-core')
    expect(canFitRelic(s, 'pulse-cannon:1', `${FIXTURE_POWER_STANDARD.id}:99`, 0).reason).toBe('missing-relic')
    s = equipRelicOnCore(s, 'pulse-cannon:1', a.id, 0)
    expect(coreRelicId(s, 'pulse-cannon:1')).toBe(a.id)
    expect(relicFitLocation(s, a.id)).toEqual({ coreInstanceId: 'pulse-cannon:1', socketIndex: 0 })
  })

  it('rejects pending production sockets, locked sockets, class mismatch, and already-fitted duplicates', () => {
    let s = relicDock()
    const pending = addRelicInstance(s, 'power-coupler')!
    expect(canFitRelic(s, 'pulse-cannon:1', pending.id, 0).reason).toBe('socket-pending')

    const power = addRelicInstance(s, FIXTURE_POWER_STANDARD.id)!
    const shield = addRelicInstance(s, FIXTURE_SHIELD_STANDARD.id)!
    const optical = addRelicInstance(s, FIXTURE_OPTICAL_STANDARD.id)!
    expect(canFitRelic(s, 'pulse-cannon:1', shield.id, 0).reason).toBe('socket-mismatch')
    setRelicSocketActivationProvider(() => [0])
    expect(canFitRelic(s, 'pulse-cannon:1', power.id, 1).reason).toBe('socket-locked')
    setRelicSocketActivationProvider(() => [0, 1])
    expect(canFitRelic(s, 'pulse-cannon:1', optical.id, 1).ok).toBe(true)
    expect(canFitRelic(s, 'pulse-cannon:1', power.id, 1).reason).toBe('socket-mismatch')

    s = equipRelicOnCore(s, 'pulse-cannon:1', power.id, 0)
    s = forceUnlockModule(s, 'choir-tap')
    s.shipyard.modules = [...s.shipyard.modules, 'choir-tap']
    s.shipyard.equippedCoreIds = [...s.shipyard.equippedCoreIds, 'choir-tap:1']
    const again = canFitRelic(s, 'choir-tap:1', power.id, 1)
    expect(again.reason).toBe('already-fitted')
  })

  it('lets a Universal socket accept any authored Relic class', () => {
    let s = relicDock()
    s = forceUnlockModule(s, 'rapid-aegis')
    s.shipyard.modules = ['pulse-cannon', 'rapid-aegis']
    s.shipyard.equippedCoreIds = ['pulse-cannon:1', 'rapid-aegis:1']
    const ballistic = addRelicInstance(s, 'fixture-ballistic-standard')!
    expect(canFitRelic(s, 'rapid-aegis:1', ballistic.id, 1).ok).toBe(true)
    s = equipRelicOnCore(s, 'rapid-aegis:1', ballistic.id, 1)
    expect(coreSocketRelics(s, 'rapid-aegis:1')[1]).toBe(ballistic.id)
  })

  it('enforces one Behavioural Relic per physical Core and allows Standard beside it', () => {
    let s = relicDock()
    const a = addRelicInstance(s, FIXTURE_POWER_BEHAVIOURAL.id)!
    const b = addRelicInstance(s, FIXTURE_OPTICAL_BEHAVIOURAL.id)!
    const std = addRelicInstance(s, FIXTURE_POWER_STANDARD.id)!
    s = equipRelicOnCore(s, 'pulse-cannon:1', a.id, 0)
    expect(canFitRelic(s, 'pulse-cannon:1', b.id, 1).reason).toBe('behavioural-limit')
    expect(equipRelicOnCore(s, 'pulse-cannon:1', b.id, 1)).toBe(s)
    expect(canFitRelic(s, 'pulse-cannon:1', std.id, 0).ok).toBe(true)
    const std2 = addRelicInstance(s, FIXTURE_OPTICAL_STANDARD.id)!
    expect(canFitRelic(s, 'pulse-cannon:1', std2.id, 1).ok).toBe(true)
    s = equipRelicOnCore(s, 'pulse-cannon:1', std2.id, 1)
    expect(coreSocketRelics(s, 'pulse-cannon:1')[0]).toBe(a.id)
    expect(coreSocketRelics(s, 'pulse-cannon:1')[1]).toBe(std2.id)

    s = removeRelicFromCore(s, 'pulse-cannon:1', 0)
    expect(canFitRelic(s, 'pulse-cannon:1', b.id, 1).ok).toBe(true)
  })

  it('lets duplicate Core instances keep independent Behavioural fits', () => {
    let s = relicDock()
    s.shipyard.frameId = 'swarm-frame'
    s.shipyard.unlockedFrames.push('swarm-frame')
    grantModuleCopy(s, 'pulse-cannon')
    s = fitModule(s, 'pulse-cannon')
    const pulse = s.shipyard.modules.flatMap((moduleId, slot) =>
      moduleId === 'pulse-cannon' ? [s.shipyard.equippedCoreIds[slot]!] : [],
    )
    expect(pulse).toHaveLength(2)
    const a = addRelicInstance(s, FIXTURE_POWER_BEHAVIOURAL.id)!
    const b = addRelicInstance(s, FIXTURE_POWER_BEHAVIOURAL.id)!
    s = equipRelicOnCore(s, pulse[0]!, a.id, 0)
    s = equipRelicOnCore(s, pulse[1]!, b.id, 0)
    expect(coreSocketRelics(s, pulse[0]!)[0]).toBe(a.id)
    expect(coreSocketRelics(s, pulse[1]!)[0]).toBe(b.id)
    expect(a.id).not.toBe(b.id)

    s = unfitModule(s, 'pulse-cannon', pulse[1])
    expect(coreSocketRelics(s, pulse[1]!)[0]).toBe(b.id)
  })

  it('allows two Standard Relics when sockets permit', () => {
    let s = relicDock()
    const a = addRelicInstance(s, FIXTURE_POWER_STANDARD.id)!
    const b = addRelicInstance(s, FIXTURE_OPTICAL_STANDARD.id)!
    s = equipRelicOnCore(s, 'pulse-cannon:1', a.id, 0)
    s = equipRelicOnCore(s, 'pulse-cannon:1', b.id, 1)
    expect(coreSocketRelics(s, 'pulse-cannon:1').slice(0, 2)).toEqual([a.id, b.id])
  })

  it('is free while Docked, refused during a running Sortie, and never destroys on unfit', () => {
    let s = relicDock()
    const relic = addRelicInstance(s, FIXTURE_POWER_STANDARD.id)!
    s = equipRelicOnCore(s, 'pulse-cannon:1', relic.id, 0)
    s.combat.docked = false
    expect(canFitRelic(s, 'pulse-cannon:1', relic.id, 0).reason).toBe('not-docked')
    const live = removeRelicFromCore(s, 'pulse-cannon:1', 0)
    expect(coreRelicId(live, 'pulse-cannon:1')).toBe(relic.id)

    s.combat.docked = true
    s = removeRelicFromCore(s, 'pulse-cannon:1', 0)
    expect(coreRelicId(s, 'pulse-cannon:1')).toBeNull()
    expect(relicFamilyOwnedCount(s, FIXTURE_POWER_STANDARD.id)).toBe(1)
    expect(relicState(s).instances.some((row) => row.id === relic.id)).toBe(true)
  })
})

describe('PR6 Relic tiers', () => {
  it('transforms one physical instance I→II→III without cloning', () => {
    let s = relicDock()
    const relic = addRelicInstance(s, FIXTURE_POWER_STANDARD.id)!
    expect(relic.id).toBe(`${FIXTURE_POWER_STANDARD.id}:1`)
    expect(relic.tier).toBe(1)
    s = equipRelicOnCore(s, 'pulse-cannon:1', relic.id, 0)

    setRelicTemperCapabilityProvider({
      canUpgradeRelicToTier2: () => true,
      canUpgradeRelicToTier3: () => true,
    })
    stock(s, {
      'conductive-filament': 40,
      'recovered-stock': 20,
      'phase-crystal': 8,
      'thermal-conductor': 8,
    })

    expect(canStartRelicUpgrade(s, relic.id).toTier).toBe(2)
    s = upgradeRelic(s, relic.id)
    expect(s.foundry.fabrication.some((slot) => slot.jobId === relicUpgradeJobId(relic.id, 2))).toBe(true)
    tickFoundry(s, 180)
    expect(relicState(s).instances).toHaveLength(1)
    expect(relicState(s).instances[0]).toEqual({
      id: `${FIXTURE_POWER_STANDARD.id}:1`,
      familyId: FIXTURE_POWER_STANDARD.id,
      tier: 2,
    })
    expect(coreSocketRelics(s, 'pulse-cannon:1')[0]).toBe(`${FIXTURE_POWER_STANDARD.id}:1`)

    s = upgradeRelic(s, relic.id)
    tickFoundry(s, 300)
    expect(relicState(s).instances).toHaveLength(1)
    expect(relicState(s).instances[0]?.tier).toBe(3)
    expect(canStartRelicUpgrade(s, relic.id).ok).toBe(false)
  })

  it('blocks II without Relic Tempering, III without Masterwork, and I→III jumps', () => {
    const s = relicDock()
    const relic = addRelicInstance(s, FIXTURE_POWER_STANDARD.id)!
    expect(canStartRelicUpgrade(s, relic.id).ok).toBe(false)
    expect(canStartRelicUpgrade(s, relic.id).reason).toMatch(/Relic Tempering/)

    setRelicTemperCapabilityProvider({
      canUpgradeRelicToTier2: () => true,
      canUpgradeRelicToTier3: () => false,
    })
    expect(canStartRelicUpgrade(s, relic.id).toTier).toBe(2)
    relic.tier = 2
    expect(canStartRelicUpgrade(s, relic.id).reason).toMatch(/Masterwork Tempering/)
    relic.tier = 1
    expect(canStartRelicUpgrade(s, relic.id).toTier).not.toBe(3)
  })

  it('keeps Tiers through Rebuild', () => {
    let s = relicDock(ACT1_CADENCE.reliquary)
    const a = addRelicInstance(s, FIXTURE_POWER_STANDARD.id, 2)!
    const b = addRelicInstance(s, FIXTURE_POWER_BEHAVIOURAL.id, 1)!
    s = equipRelicOnCore(s, 'pulse-cannon:1', a.id, 0)
    s.workshop.coreStarts = { 'pulse-cannon:1': 4 }
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(relicState(s).instances).toEqual([
      { id: a.id, familyId: FIXTURE_POWER_STANDARD.id, tier: 2 },
      { id: b.id, familyId: FIXTURE_POWER_BEHAVIOURAL.id, tier: 1 },
    ])
    expect(coreSocketRelics(s, 'pulse-cannon:1')[0]).toBe(a.id)
    expect(s.workshop.coreStarts['pulse-cannon:1'] ?? 0).toBe(0)
  })
})
