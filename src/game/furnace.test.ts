import { describe, expect, it } from 'vitest'
import { FURNACE_CHANNEL_IDS, FURNACE_LEVEL_COST, createEmptyFurnaceState } from './furnace'

describe('Furnace breaking redesign surface', () => {
  it('has exactly four canonical channels and no persistent upgrade-shop state', () => {
    expect(FURNACE_CHANNEL_IDS).toEqual(['overdrive', 'bulwark', 'guidance', 'harvest'])
    expect(FURNACE_LEVEL_COST).toEqual({ 1: 10, 2: 25, 3: 60 })
    expect(Object.keys(createEmptyFurnaceState()).sort()).toEqual(['channels', 'effectStrengthMult', 'ignited'])
  })
})
