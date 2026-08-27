import { afterEach, describe, expect, it } from 'vitest'
import { performRebuild } from './actions'
import { ACT1_CADENCE } from './cadence'
import { grantModuleCopy } from './coreProgression'
import { fitModule } from './actions'
import { exportSave, importSave, sanitizeCoreFits } from './save'
import { tickFoundry } from './foundry'
import {
  addRelicInstance,
  coreSocketRelics,
  createEmptyRelicState,
  equipRelicOnCore,
  relicState,
  sanitizeRelicState,
  setRelicSocketActivationProvider,
} from './relics'
import { relicUpgradeJobId, relicUpgradeRecipe } from './relicSeeds'
import { setRelicTemperCapabilityProvider } from './relicSources'
import {
  FIXTURE_OPTICAL_BEHAVIOURAL,
  FIXTURE_OPTICAL_STANDARD,
  FIXTURE_POWER_BEHAVIOURAL,
  FIXTURE_POWER_STANDARD,
  installAuthoredRelicFixtures,
  resetRelicTestFixtures,
} from './relicTestFixtures'
import { createInitialState, SAVE_VERSION } from './state'
import { atCareerWave, armRebuildDoor, equipPostTutorialLoadout } from './testHelpers'

function encodeRaw(state: object): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))))
}

function relicDock() {
  let s = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
  s = equipPostTutorialLoadout(s)
  s.combat.docked = true
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

describe('PR6 Relic save schema', () => {
  it('uses save version 47 with no shard migration', () => {
    expect(SAVE_VERSION).toBe(47)
    const old = JSON.parse(JSON.stringify({ ...createInitialState(0), version: 46 }))
    expect(importSave(encodeRaw(old))).toBeNull()
  })

  it('round-trips physical Relics, unique IDs, Tiers, and per-Core fits', () => {
    installAuthoredRelicFixtures()
    setRelicSocketActivationProvider(() => [0, 1])
    let s = relicDock()
    const a = addRelicInstance(s, FIXTURE_POWER_STANDARD.id, 2)!
    const b = addRelicInstance(s, FIXTURE_POWER_STANDARD.id, 1)!
    const c = addRelicInstance(s, FIXTURE_POWER_BEHAVIOURAL.id, 1)!
    s = equipRelicOnCore(s, 'pulse-cannon:1', a.id, 0)
    const loaded = importSave(exportSave(s))
    expect(loaded).not.toBeNull()
    expect(relicState(loaded!).instances).toEqual([
      { id: a.id, familyId: FIXTURE_POWER_STANDARD.id, tier: 2 },
      { id: b.id, familyId: FIXTURE_POWER_STANDARD.id, tier: 1 },
      { id: c.id, familyId: FIXTURE_POWER_BEHAVIOURAL.id, tier: 1 },
    ])
    expect(coreSocketRelics(loaded!, 'pulse-cannon:1')[0]).toBe(a.id)
  })

  it('sanitizes malformed current-version Relic state without destroying instances', () => {
    installAuthoredRelicFixtures()
    setRelicSocketActivationProvider((_state, _coreId, moduleId) =>
      moduleId === 'pulse-cannon' ? [0, 1] : [0],
    )
    const s = relicDock()
    s.relics = {
      instances: [
        { id: `${FIXTURE_POWER_STANDARD.id}:1`, familyId: FIXTURE_POWER_STANDARD.id, tier: 1 },
        { id: `${FIXTURE_POWER_STANDARD.id}:1`, familyId: FIXTURE_POWER_STANDARD.id, tier: 2 },
        { id: 'ghost:1', familyId: 'battle-chip', tier: 1 },
        { id: 'bad-tier', familyId: 'reinforcement-plate', tier: 0 as never },
        { id: 'overcharge-capacitor:1', familyId: 'overcharge-capacitor', tier: 4 as never },
        { id: `${FIXTURE_OPTICAL_BEHAVIOURAL.id}:1`, familyId: FIXTURE_OPTICAL_BEHAVIOURAL.id, tier: 1 },
        { id: `${FIXTURE_OPTICAL_STANDARD.id}:1`, familyId: FIXTURE_OPTICAL_STANDARD.id, tier: 1 },
      ],
      nextSerial: {},
      coreFits: {
        'pulse-cannon': [`${FIXTURE_POWER_STANDARD.id}:1`],
        'missing-core:9': [`${FIXTURE_POWER_STANDARD.id}:1`],
        'pulse-cannon:1': [`${FIXTURE_POWER_STANDARD.id}:1`, `${FIXTURE_OPTICAL_BEHAVIOURAL.id}:1`],
        'plate-layer:1': [`${FIXTURE_POWER_STANDARD.id}:1`, `${FIXTURE_OPTICAL_STANDARD.id}:1`],
      },
    }
    sanitizeRelicState(s)
    const ids = relicState(s).instances.map((row) => row.id)
    expect(ids).toEqual([
      `${FIXTURE_POWER_STANDARD.id}:1`,
      `${FIXTURE_OPTICAL_BEHAVIOURAL.id}:1`,
      `${FIXTURE_OPTICAL_STANDARD.id}:1`,
    ])
    expect(s.relics.coreFits['pulse-cannon']).toBeUndefined()
    expect(s.relics.coreFits['missing-core:9']).toBeUndefined()
    expect(coreSocketRelics(s, 'pulse-cannon:1')[0]).toBe(`${FIXTURE_POWER_STANDARD.id}:1`)
    expect(coreSocketRelics(s, 'pulse-cannon:1')[1]).toBe(`${FIXTURE_OPTICAL_BEHAVIOURAL.id}:1`)
    expect(coreSocketRelics(s, 'pulse-cannon:1').filter(Boolean)).toHaveLength(2)
    expect(coreSocketRelics(s, 'plate-layer:1').filter(Boolean)).toHaveLength(0)
  })

  it('sanitizes a second Behavioural fit and keeps both Relics in inventory', () => {
    installAuthoredRelicFixtures()
    setRelicSocketActivationProvider(() => [0, 1])
    const s = relicDock()
    s.relics = {
      instances: [
        { id: `${FIXTURE_POWER_BEHAVIOURAL.id}:1`, familyId: FIXTURE_POWER_BEHAVIOURAL.id, tier: 1 },
        { id: `${FIXTURE_OPTICAL_BEHAVIOURAL.id}:1`, familyId: FIXTURE_OPTICAL_BEHAVIOURAL.id, tier: 1 },
      ],
      nextSerial: {},
      coreFits: {
        'pulse-cannon:1': [`${FIXTURE_POWER_BEHAVIOURAL.id}:1`, `${FIXTURE_OPTICAL_BEHAVIOURAL.id}:1`],
      },
    }
    sanitizeCoreFits(s)
    expect(coreSocketRelics(s, 'pulse-cannon:1')[0]).toBe(`${FIXTURE_POWER_BEHAVIOURAL.id}:1`)
    expect(coreSocketRelics(s, 'pulse-cannon:1')[1]).toBeNull()
    expect(relicState(s).instances).toHaveLength(2)
  })

  it('preserves Relics and fits across Rebuild with mixed Tiers and duplicate Cores', () => {
    installAuthoredRelicFixtures()
    setRelicSocketActivationProvider(() => [0, 1])
    let s = armRebuildDoor(createInitialState(0))
    s = atCareerWave(s, ACT1_CADENCE.reliquary)
    s = equipPostTutorialLoadout(s)
    s.combat.docked = true
    s.shipyard.frameId = 'swarm-frame'
    s.shipyard.unlockedFrames.push('swarm-frame')
    grantModuleCopy(s, 'pulse-cannon')
    s = fitModule(s, 'pulse-cannon')
    const pulse = s.shipyard.equippedCoreIds.filter((id) => id?.startsWith('pulse-cannon:')) as string[]
    const a = addRelicInstance(s, FIXTURE_POWER_STANDARD.id, 2)!
    const b = addRelicInstance(s, FIXTURE_POWER_STANDARD.id, 1)!
    const c = addRelicInstance(s, FIXTURE_POWER_BEHAVIOURAL.id, 3)!
    const d = addRelicInstance(s, 'reinforcement-plate', 1)!
    s = equipRelicOnCore(s, pulse[0]!, a.id, 0)
    s = equipRelicOnCore(s, pulse[1]!, c.id, 0)
    s.workshop.coreStarts = { [pulse[0]!]: 6, [pulse[1]!]: 3 }
    s.meta.moduleMastery = { ...s.meta.moduleMastery, 'pulse-cannon': 12 }

    s = performRebuild(s, { frameId: 'swarm-frame', modules: ['pulse-cannon', 'pulse-cannon', 'plate-layer'] })
    expect(relicState(s).instances.map((row) => row.id).sort()).toEqual([a.id, b.id, c.id, d.id].sort())
    expect(relicState(s).instances.find((row) => row.id === a.id)?.tier).toBe(2)
    expect(relicState(s).instances.find((row) => row.id === c.id)?.tier).toBe(3)
    expect(coreSocketRelics(s, pulse[0]!)[0]).toBe(a.id)
    expect(coreSocketRelics(s, pulse[1]!)[0]).toBe(c.id)
    expect(s.meta.moduleMastery['pulse-cannon']).toBe(12)
    expect(s.workshop.coreStarts[pulse[0]!] ?? 0).toBe(0)
  })

  it('starts empty Relic state without leftover colour slots', () => {
    const empty = createEmptyRelicState()
    expect(empty).toEqual({ instances: [], nextSerial: {}, coreFits: {} })
    const s = createInitialState(0)
    expect(s.relics).toEqual(empty)
    expect((s as { reliquary?: unknown }).reliquary).toBeUndefined()
  })
})

describe('PR6 upgrade-job identity', () => {
  it('A: mismatched targetRelicId sanitizes without transforming any Relic', () => {
    const s = relicDock()
    addRelicInstance(s, 'power-coupler', 1)
    addRelicInstance(s, 'overcharge-capacitor', 1)
    const jobId = relicUpgradeJobId('power-coupler:1', 2)
    s.foundry.fabrication[0] = {
      kind: 'relic',
      jobId,
      progress: 0.8,
      paid: true,
      targetRelicId: 'overcharge-capacitor:1',
    }
    const loaded = importSave(exportSave(s))!
    expect(loaded.foundry.fabrication[0]?.kind).toBeNull()
    expect(loaded.foundry.fabrication[0]?.jobId).toBeNull()
    expect(relicState(loaded).instances.find((row) => row.id === 'power-coupler:1')?.tier).toBe(1)
    expect(relicState(loaded).instances.find((row) => row.id === 'overcharge-capacitor:1')?.tier).toBe(1)
    tickFoundry(loaded, 180)
    expect(relicState(loaded).instances.every((row) => row.tier === 1)).toBe(true)
  })

  it('B: nonexistent upgrade target sanitizes without transforming', () => {
    const s = relicDock()
    addRelicInstance(s, 'power-coupler', 1)
    s.foundry.fabrication[0] = {
      kind: 'relic',
      jobId: relicUpgradeJobId('power-coupler:999', 2),
      progress: 0.9,
      paid: true,
      targetRelicId: 'power-coupler:999',
    }
    const loaded = importSave(exportSave(s))!
    expect(loaded.foundry.fabrication[0]?.kind).toBeNull()
    expect(relicState(loaded).instances).toHaveLength(1)
    expect(relicState(loaded).instances[0]?.tier).toBe(1)
  })

  it('C: Tier II job against an already-Tier-II target sanitizes without transforming', () => {
    const s = relicDock()
    addRelicInstance(s, 'power-coupler', 2)
    s.foundry.fabrication[0] = {
      kind: 'relic',
      jobId: relicUpgradeJobId('power-coupler:1', 2),
      progress: 0.95,
      paid: true,
      targetRelicId: 'power-coupler:1',
    }
    const loaded = importSave(exportSave(s))!
    expect(loaded.foundry.fabrication[0]?.kind).toBeNull()
    expect(relicState(loaded).instances[0]?.tier).toBe(2)
    tickFoundry(loaded, 180)
    expect(relicState(loaded).instances[0]?.tier).toBe(2)
    expect(relicState(loaded).instances).toHaveLength(1)
  })

  it('D: valid paid in-progress job round-trips and completes exactly once', () => {
    let s = relicDock()
    const relic = addRelicInstance(s, 'power-coupler', 1)!
    setRelicTemperCapabilityProvider({
      canUpgradeRelicToTier2: () => true,
      canUpgradeRelicToTier3: () => true,
    })
    const t2 = relicUpgradeRecipe('power-coupler', 2)
    stock(s, {
      'conductive-filament': 40,
      'recovered-stock': 20,
      'phase-crystal': 4,
    })
    s.foundry.fabrication[0] = {
      kind: 'relic',
      jobId: relicUpgradeJobId(relic.id, 2),
      progress: 0.4,
      paid: true,
      targetRelicId: relic.id,
    }
    const loaded = importSave(exportSave(s))!
    expect(loaded.foundry.fabrication[0]?.jobId).toBe(relicUpgradeJobId(relic.id, 2))
    expect(loaded.foundry.fabrication[0]?.targetRelicId).toBe(relic.id)
    expect(relicState(loaded).instances[0]?.tier).toBe(1)
    tickFoundry(loaded, t2.craftTime)
    expect(relicState(loaded).instances).toHaveLength(1)
    expect(relicState(loaded).instances[0]).toEqual({ id: relic.id, familyId: 'power-coupler', tier: 2 })
    expect(loaded.foundry.fabrication[0]?.kind).toBeNull()
    tickFoundry(loaded, t2.craftTime)
    expect(relicState(loaded).instances[0]?.tier).toBe(2)
    expect(relicState(loaded).instances).toHaveLength(1)
  })
})
