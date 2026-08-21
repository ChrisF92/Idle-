import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  canPrestige,
  performRebuild,
  pickCoreMilestone,
  upgradeModule,
} from './actions'
import { pendingMilestone } from './milestones'
import { getFrame } from './catalog'
import { isSystemUnlocked, visibleResourceIds } from './progression'
import { maybeGrantSystemUnlocks } from './progression'
import { clearSector } from './testHelpers'
import { setDocked } from './tick'

describe('phase 3: milestones, rebuild, foundry', () => {
  it('offers a 2-pick Pulse milestone at level 10', () => {
    const pending = pendingMilestone('pulse-cannon', 10, {})
    expect(pending?.id).toBe('pulse-10')
    expect(pending?.choices).toHaveLength(2)
    expect(pendingMilestone('pulse-cannon', 9, {})).toBeNull()
  })

  it('applies Focused Pulse as a damage multiplier', () => {
    let s = createInitialState(0)
    s.shipyard.moduleLevels['pulse-cannon'] = 10
    const before = computeShipStats(s).damage
    s = pickCoreMilestone(s, 'pulse-cannon', 'pulse-10', 'focused')
    expect(s.shipyard.corePicks['pulse-cannon']['pulse-10']).toBe('focused')
    expect(computeShipStats(s).damage).toBeCloseTo(before * 1.15)
  })

  it('allows Rebuild from sector 12 and wipes Core levels', () => {
    let s = createInitialState(0)
    s.combat.sector = 12
    s.meta.highestSectorEver = 12
    s.combat.highestSector = 12
    s.shipyard.moduleLevels['pulse-cannon'] = 6
    s.shipyard.corePicks = { 'pulse-cannon': { 'pulse-10': 'focused' } }
    expect(canPrestige(s)).toBe(true)

    s = performRebuild(s, {
      frameId: 'scout-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.prestige.prestigeCount).toBe(1)
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)
    expect(s.shipyard.corePicks).toEqual({})
    expect(s.combat.docked).toBe(true)
  })

  it('unlocks Frigate hull after clearing sector 4', () => {
    let s = createInitialState(0)
    s = setDocked(s, false)
    s.combat.highestSector = 4
    s.meta.highestSectorEver = 4
    maybeGrantSystemUnlocks(s)
    expect(s.shipyard.unlockedFrames).toContain('line-frame')
    expect(getFrame('line-frame')?.name).toBe('Frigate Hull')
    expect(getFrame('line-frame')?.weaponSlots).toBe(2)
    expect(getFrame('line-frame')?.requiresSectorEver).toBe(4)
  })

  it('Rebuild hangar can swap onto Frigate once unlocked', () => {
    let s = createInitialState(0)
    s.combat.sector = 12
    s.combat.highestSector = 12
    s.meta.highestSectorEver = 12
    s.shipyard.unlockedFrames = ['scout-frame', 'line-frame']
    s = performRebuild(s, {
      frameId: 'line-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.shipyard.frameId).toBe('line-frame')
  })

  it('opens Foundry at sector 6 and hides scrap until then', () => {
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'foundry')).toBe(false)
    expect(visibleResourceIds(fresh)).toEqual([])

    let s = createInitialState(0)
    s = setDocked(s, false)
    for (let i = 0; i < 6; i++) s = clearSector(s)
    expect(s.combat.highestSector).toBeGreaterThanOrEqual(6)
    expect(isSystemUnlocked(s, 'foundry')).toBe(true)
    expect(visibleResourceIds(s)).toContain('scrap')
    s.meta.hullLostOnce = true
    expect(visibleResourceIds(s)).toContain('salvage')
  })

  it('still spends salvage on in-run Core levels', () => {
    let s = createInitialState(0)
    s.resources.salvage = 10
    s = upgradeModule(s, 'pulse-cannon')
    expect(s.shipyard.moduleLevels['pulse-cannon']).toBe(1)
    expect(s.resources.salvage).toBe(7)
  })

  it('blocks further Pulse levels until the pending milestone is picked', () => {
    let s = createInitialState(0)
    s.shipyard.moduleLevels['pulse-cannon'] = 10
    s.resources.salvage = 999
    s = upgradeModule(s, 'pulse-cannon')
    expect(s.shipyard.moduleLevels['pulse-cannon']).toBe(10)
    s = pickCoreMilestone(s, 'pulse-cannon', 'pulse-10', 'rapid')
    s = upgradeModule(s, 'pulse-cannon')
    expect(s.shipyard.moduleLevels['pulse-cannon']).toBe(11)
  })
})
