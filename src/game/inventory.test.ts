import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  RELIC_STORAGE_NOTE,
  coreCopyBreakdown,
  equippedCoreCount,
  inventoryEquipment,
  inventoryMaterials,
  inventoryRelics,
  relicAvailability,
} from './inventory'
import { grantModuleCopy } from './coreProgression'

describe('Inventory item model', () => {
  it('counts Core copies as owned / equipped / available', () => {
    const state = createInitialState(0)
    expect(equippedCoreCount(state, 'pulse-cannon')).toBe(1)
    const starter = coreCopyBreakdown(state, 'pulse-cannon')
    expect(starter?.owned).toBeGreaterThanOrEqual(1)
    expect(starter?.equipped).toBe(1)
    grantModuleCopy(state, 'pulse-cannon')
    const copies = coreCopyBreakdown(state, 'pulse-cannon')
    expect(copies?.owned).toBe(2)
    expect(copies?.equipped).toBe(1)
    expect(copies?.available).toBe(1)
  })

  it('lists Frames and Cores under Equipment', () => {
    const state = createInitialState(0)
    const rows = inventoryEquipment(state)
    expect(rows.some((row) => row.kind === 'frame' && row.id === 'starter-frame')).toBe(true)
    expect(rows.some((row) => row.kind === 'core' && row.id === 'pulse-cannon')).toBe(true)
  })

  it('counts Relic owned / equipped / free from instance fits', () => {
    const state = createInitialState(0)
    state.relics.instances = [
      { id: 'power-coupler:1', familyId: 'power-coupler', tier: 1 },
      { id: 'power-coupler:2', familyId: 'power-coupler', tier: 1 },
    ]
    state.relics.coreFits = { 'pulse-cannon:1': ['power-coupler:1'] }
    const counts = relicAvailability(state, 'power-coupler:1')
    expect(counts.available).toBe(0)
    expect(counts.equipped).toBe(1)
    expect(counts.owned).toBe(1)
    const row = inventoryRelics(state).find((item) => item.id === 'power-coupler:1')
    expect(row?.fittedCoreName).toContain('Pulse Cannon')
    expect(RELIC_STORAGE_NOTE).toMatch(/physical Core/)
  })

  it('builds a material ledger from Foundry recipes and stock', () => {
    const state = createInitialState(0)
    state.foundry.materials['recovered-stock'] = 12
    const rows = inventoryMaterials(state)
    const slag = rows.find((row) => row.id === 'recovered-stock')
    expect(slag?.stock).toBe(12)
    expect(slag?.family).toBe('recovered')
    expect(slag?.consumedBy.length).toBeGreaterThan(0)
  })
})
