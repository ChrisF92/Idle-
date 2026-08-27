import { describe, expect, it } from 'vitest'
import { performRebuild } from './actions'
import { ACT1_CADENCE } from './cadence'
import { grantModuleCopy } from './coreProgression'
import { fitModule } from './actions'
import { exportSave, importSave, sanitizeCoreFits } from './save'
import {
  addRelicInstance,
  coreSocketRelics,
  createEmptyRelicState,
  equipRelicOnCore,
  relicState,
  sanitizeRelicState,
} from './relics'
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

describe('PR6 Relic save schema', () => {
  it('uses save version 47 with no shard migration', () => {
    expect(SAVE_VERSION).toBe(47)
    const old = JSON.parse(JSON.stringify({ ...createInitialState(0), version: 46 }))
    expect(importSave(encodeRaw(old))).toBeNull()
  })

  it('round-trips physical Relics, unique IDs, Tiers, and per-Core fits', () => {
    let s = relicDock()
    const a = addRelicInstance(s, 'power-coupler', 2)!
    const b = addRelicInstance(s, 'power-coupler', 1)!
    const c = addRelicInstance(s, 'overcharge-capacitor', 1)!
    s = equipRelicOnCore(s, 'pulse-cannon:1', a.id, 0)
    const loaded = importSave(exportSave(s))
    expect(loaded).not.toBeNull()
    expect(relicState(loaded!).instances).toEqual([
      { id: a.id, familyId: 'power-coupler', tier: 2 },
      { id: b.id, familyId: 'power-coupler', tier: 1 },
      { id: c.id, familyId: 'overcharge-capacitor', tier: 1 },
    ])
    expect(coreSocketRelics(loaded!, 'pulse-cannon:1')[0]).toBe(a.id)
  })

  it('sanitizes malformed current-version Relic state without destroying instances', () => {
    const s = relicDock()
    s.relics = {
      instances: [
        { id: 'power-coupler:1', familyId: 'power-coupler', tier: 1 },
        { id: 'power-coupler:1', familyId: 'power-coupler', tier: 2 },
        { id: 'ghost:1', familyId: 'battle-chip' as never, tier: 1 },
        { id: 'bad-tier', familyId: 'reinforcement-plate', tier: 0 as never },
        { id: 'overcharge-capacitor:1', familyId: 'overcharge-capacitor', tier: 4 as never },
        { id: 'prismatic-lens:1', familyId: 'prismatic-lens', tier: 1 },
        { id: 'tracking-gimbal:1', familyId: 'tracking-gimbal', tier: 1 },
      ],
      nextSerial: {},
      coreFits: {
        'pulse-cannon': ['power-coupler:1'],
        'missing-core:9': ['power-coupler:1'],
        'pulse-cannon:1': ['power-coupler:1', 'prismatic-lens:1'],
        'plate-layer:1': ['power-coupler:1', 'tracking-gimbal:1'],
      },
    }
    s.meta.moduleMastery = { ...s.meta.moduleMastery, 'pulse-cannon': 20 }
    sanitizeRelicState(s)
    const ids = relicState(s).instances.map((row) => row.id)
    expect(ids).toEqual(['power-coupler:1', 'prismatic-lens:1', 'tracking-gimbal:1'])
    expect(s.relics.coreFits['pulse-cannon']).toBeUndefined()
    expect(s.relics.coreFits['missing-core:9']).toBeUndefined()
    expect(coreSocketRelics(s, 'pulse-cannon:1')[0]).toBe('power-coupler:1')
    expect(coreSocketRelics(s, 'pulse-cannon:1')[1]).toBe('prismatic-lens:1')
    expect(coreSocketRelics(s, 'pulse-cannon:1').filter(Boolean)).toHaveLength(2)
    expect(coreSocketRelics(s, 'plate-layer:1').filter(Boolean)).toHaveLength(0)
    expect(ids).toContain('prismatic-lens:1')
    expect(ids).toContain('tracking-gimbal:1')
  })

  it('sanitizes a second Behavioural fit and keeps both Relics in inventory', () => {
    const s = relicDock()
    s.meta.moduleMastery = { ...s.meta.moduleMastery, 'pulse-cannon': 20 }
    s.relics = {
      instances: [
        { id: 'overcharge-capacitor:1', familyId: 'overcharge-capacitor', tier: 1 },
        { id: 'prismatic-lens:1', familyId: 'prismatic-lens', tier: 1 },
      ],
      nextSerial: {},
      coreFits: {
        'pulse-cannon:1': ['overcharge-capacitor:1', 'prismatic-lens:1'],
      },
    }
    sanitizeCoreFits(s)
    expect(coreSocketRelics(s, 'pulse-cannon:1')[0]).toBe('overcharge-capacitor:1')
    expect(coreSocketRelics(s, 'pulse-cannon:1')[1]).toBeNull()
    expect(relicState(s).instances).toHaveLength(2)
  })

  it('preserves Relics and fits across Rebuild with mixed Tiers and duplicate Cores', () => {
    let s = armRebuildDoor(createInitialState(0))
    s = atCareerWave(s, ACT1_CADENCE.reliquary)
    s = equipPostTutorialLoadout(s)
    s.combat.docked = true
    s.shipyard.frameId = 'swarm-frame'
    s.shipyard.unlockedFrames.push('swarm-frame')
    grantModuleCopy(s, 'pulse-cannon')
    s = fitModule(s, 'pulse-cannon')
    const pulse = s.shipyard.equippedCoreIds.filter((id) => id?.startsWith('pulse-cannon:')) as string[]
    const a = addRelicInstance(s, 'power-coupler', 2)!
    const b = addRelicInstance(s, 'power-coupler', 1)!
    const c = addRelicInstance(s, 'overcharge-capacitor', 3)!
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
