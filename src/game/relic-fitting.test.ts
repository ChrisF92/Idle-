import { afterEach, describe, expect, it } from 'vitest'
import { fitModule, performRebuild, removeRelicFromCore, unfitModule, upgradeRelic } from './actions'
import { ACT1_CADENCE } from './cadence'
import { grantModuleCopy } from './coreProgression'
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
} from './relics'
import { setRelicTemperCapabilityProvider } from './relicSources'
import { createInitialState } from './state'
import { atCareerWave, equipPostTutorialLoadout, forceUnlockModule } from './testHelpers'
import { tickFoundry } from './foundry'
import { relicUpgradeJobId } from './relicSeeds'

function relicDock(wave = ACT1_CADENCE.reliquary) {
  let s = atCareerWave(createInitialState(0), wave)
  s = equipPostTutorialLoadout(s)
  s.combat.docked = true
  return s
}

function stock(state: ReturnType<typeof createInitialState>, materials: Record<string, number>) {
  for (const [id, n] of Object.entries(materials)) state.foundry.materials[id] = n
}

afterEach(() => setRelicTemperCapabilityProvider(null))

describe('PR6 Relic fitting', () => {
  it('requires exact physical Core and Relic instance IDs', () => {
    let s = relicDock()
    const a = addRelicInstance(s, 'power-coupler')!
    expect(canFitRelic(s, 'missing-core:9', a.id, 0).reason).toBe('missing-core')
    expect(canFitRelic(s, 'pulse-cannon:1', 'power-coupler:99', 0).reason).toBe('missing-relic')
    s = equipRelicOnCore(s, 'pulse-cannon:1', a.id, 0)
    expect(coreRelicId(s, 'pulse-cannon:1')).toBe(a.id)
    expect(relicFitLocation(s, a.id)).toEqual({ coreInstanceId: 'pulse-cannon:1', socketIndex: 0 })
  })

  it('rejects locked sockets, class mismatch, and already-fitted duplicates', () => {
    let s = relicDock()
    const power = addRelicInstance(s, 'power-coupler')!
    const shield = addRelicInstance(s, 'reinforcement-plate')!
    const optical = addRelicInstance(s, 'tracking-gimbal')!
    expect(canFitRelic(s, 'pulse-cannon:1', shield.id, 0).reason).toBe('socket-mismatch')
    expect(canFitRelic(s, 'pulse-cannon:1', power.id, 1).reason).toBe('socket-locked')
    s.meta.moduleMastery = { ...s.meta.moduleMastery, 'pulse-cannon': 20 }
    expect(canFitRelic(s, 'pulse-cannon:1', optical.id, 1).ok).toBe(true)
    expect(canFitRelic(s, 'pulse-cannon:1', power.id, 1).reason).toBe('socket-mismatch')

    s = equipRelicOnCore(s, 'pulse-cannon:1', power.id, 0)
    s = forceUnlockModule(s, 'choir-tap')
    s.shipyard.modules = [...s.shipyard.modules, 'choir-tap']
    s.shipyard.equippedCoreIds = [...s.shipyard.equippedCoreIds, 'choir-tap:1']
    s.meta.moduleMastery = { ...s.meta.moduleMastery, 'choir-tap': 20 }
    const again = canFitRelic(s, 'choir-tap:1', power.id, 1)
    expect(again.reason).toBe('already-fitted')
  })

  it('lets a Universal socket accept any Relic class', () => {
    let s = relicDock()
    s = forceUnlockModule(s, 'rapid-aegis')
    s.shipyard.modules = ['pulse-cannon', 'rapid-aegis']
    s.shipyard.equippedCoreIds = ['pulse-cannon:1', 'rapid-aegis:1']
    s.meta.moduleMastery = { ...s.meta.moduleMastery, 'rapid-aegis': 20 }
    const ballistic = addRelicInstance(s, 'ballistic-jacket')!
    expect(canFitRelic(s, 'rapid-aegis:1', ballistic.id, 1).ok).toBe(true)
    s = equipRelicOnCore(s, 'rapid-aegis:1', ballistic.id, 1)
    expect(coreSocketRelics(s, 'rapid-aegis:1')[1]).toBe(ballistic.id)
  })

  it('enforces one Behavioural Relic per physical Core and allows Standard beside it', () => {
    let s = relicDock()
    s.meta.moduleMastery = { ...s.meta.moduleMastery, 'pulse-cannon': 20 }
    const a = addRelicInstance(s, 'overcharge-capacitor')!
    const b = addRelicInstance(s, 'prismatic-lens')!
    const std = addRelicInstance(s, 'power-coupler')!
    s = equipRelicOnCore(s, 'pulse-cannon:1', a.id, 0)
    expect(canFitRelic(s, 'pulse-cannon:1', b.id, 1).reason).toBe('behavioural-limit')
    expect(equipRelicOnCore(s, 'pulse-cannon:1', b.id, 1)).toBe(s)
    expect(canFitRelic(s, 'pulse-cannon:1', std.id, 0).ok).toBe(true)
    const std2 = addRelicInstance(s, 'tracking-gimbal')!
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
    const a = addRelicInstance(s, 'overcharge-capacitor')!
    const b = addRelicInstance(s, 'overcharge-capacitor')!
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
    s.meta.moduleMastery = { ...s.meta.moduleMastery, 'pulse-cannon': 20 }
    const a = addRelicInstance(s, 'power-coupler')!
    const b = addRelicInstance(s, 'tracking-gimbal')!
    s = equipRelicOnCore(s, 'pulse-cannon:1', a.id, 0)
    s = equipRelicOnCore(s, 'pulse-cannon:1', b.id, 1)
    expect(coreSocketRelics(s, 'pulse-cannon:1').slice(0, 2)).toEqual([a.id, b.id])
  })

  it('is free while Docked, refused during a running Sortie, and never destroys on unfit', () => {
    let s = relicDock()
    const relic = addRelicInstance(s, 'power-coupler')!
    s = equipRelicOnCore(s, 'pulse-cannon:1', relic.id, 0)
    s.combat.docked = false
    expect(canFitRelic(s, 'pulse-cannon:1', relic.id, 0).reason).toBe('not-docked')
    const live = removeRelicFromCore(s, 'pulse-cannon:1', 0)
    expect(coreRelicId(live, 'pulse-cannon:1')).toBe(relic.id)

    s.combat.docked = true
    s = removeRelicFromCore(s, 'pulse-cannon:1', 0)
    expect(coreRelicId(s, 'pulse-cannon:1')).toBeNull()
    expect(relicFamilyOwnedCount(s, 'power-coupler')).toBe(1)
    expect(relicState(s).instances.some((row) => row.id === relic.id)).toBe(true)
  })
})

describe('PR6 Relic tiers', () => {
  it('transforms one physical instance I→II→III without cloning', () => {
    let s = relicDock()
    const relic = addRelicInstance(s, 'power-coupler')!
    expect(relic.id).toBe('power-coupler:1')
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
    expect(relicState(s).instances[0]).toEqual({ id: 'power-coupler:1', familyId: 'power-coupler', tier: 2 })
    expect(coreSocketRelics(s, 'pulse-cannon:1')[0]).toBe('power-coupler:1')

    s = upgradeRelic(s, relic.id)
    tickFoundry(s, 300)
    expect(relicState(s).instances).toHaveLength(1)
    expect(relicState(s).instances[0]?.tier).toBe(3)
    expect(canStartRelicUpgrade(s, relic.id).ok).toBe(false)
  })

  it('blocks II without Relic Tempering, III without Masterwork, and I→III jumps', () => {
    const s = relicDock()
    const relic = addRelicInstance(s, 'power-coupler')!
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
    const a = addRelicInstance(s, 'power-coupler', 2)!
    const b = addRelicInstance(s, 'overcharge-capacitor', 1)!
    s = equipRelicOnCore(s, 'pulse-cannon:1', a.id, 0)
    s.workshop.coreStarts = { 'pulse-cannon:1': 4 }
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(relicState(s).instances).toEqual([
      { id: a.id, familyId: 'power-coupler', tier: 2 },
      { id: b.id, familyId: 'overcharge-capacitor', tier: 1 },
    ])
    expect(coreSocketRelics(s, 'pulse-cannon:1')[0]).toBe(a.id)
    expect(s.workshop.coreStarts['pulse-cannon:1'] ?? 0).toBe(0)
  })
})
