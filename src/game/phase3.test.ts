import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  performRebuild,
  pickCoreMilestone,
  upgradeModule,
} from './actions'
import { canRebuild } from './rebuild'
import { pendingMilestone } from './milestones'
import { getFrame } from './catalog'
import { isSystemUnlocked, visibleResourceIds } from './progression'
import { maybeGrantSystemUnlocks } from './progression'
import { atCareerWave, armRebuildDoor } from './testHelpers'
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

  it('allows Rebuild from Wave 210 and keeps Core Mastery', () => {
    let s = armRebuildDoor(createInitialState(0))
    s.meta.moduleMastery = { 'pulse-cannon': 6 }
    s.shipyard.corePicks = { 'pulse-cannon': { 'pulse-10': 'focused' } }
    expect(canRebuild(s)).toBe(true)

    s = performRebuild(s, {
      frameId: 'starter-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.prestige.prestigeCount).toBe(1)
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)
    expect(s.meta.moduleMastery['pulse-cannon']).toBe(6)
    expect(s.shipyard.corePicks['pulse-cannon']['pulse-10']).toBe('focused')
    expect(s.combat.docked).toBe(true)
  })

  it('unlocks Bastion Frame after Wave 70', () => {
    let s = atCareerWave(createInitialState(0), 70)
    s = setDocked(s, false)
    maybeGrantSystemUnlocks(s)
    expect(s.shipyard.unlockedFrames).toContain('bastion-frame')
    expect(getFrame('bastion-frame')?.name).toBe('Bastion Frame')
    expect(getFrame('bastion-frame')?.defenseSlots).toBe(3)
    expect(getFrame('bastion-frame')?.requiresBestWave).toBe(70)
    const early = atCareerWave(createInitialState(0), 69)
    maybeGrantSystemUnlocks(early)
    expect(early.shipyard.unlockedFrames).not.toContain('bastion-frame')
  })

  it('Rebuild hangar can swap onto Bastion once unlocked', () => {
    let s = armRebuildDoor(createInitialState(0))
    s.shipyard.unlockedFrames = ['starter-frame', 'bastion-frame']
    s = performRebuild(s, {
      frameId: 'bastion-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.shipyard.frameId).toBe('bastion-frame')
  })

  it('opens Foundry at Wave 20 and hides scrap until then', () => {
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'foundry')).toBe(false)
    expect(visibleResourceIds(fresh)).toEqual([])

    const locked = atCareerWave(createInitialState(0), 19)
    expect(isSystemUnlocked(locked, 'foundry')).toBe(false)

    let s = atCareerWave(createInitialState(0), 20)
    expect(isSystemUnlocked(s, 'foundry')).toBe(true)
    expect(visibleResourceIds(s)).toContain('scrap')
    s.meta.hullLostOnce = true
    expect(visibleResourceIds(s)).toContain('salvage')
  })

  it('does not spend Salvage on Cores during a Sortie', () => {
    let s = createInitialState(0)
    s = setDocked(s, false)
    s.resources.salvage = 10
    s = upgradeModule(s, 'pulse-cannon')
    expect(s.combat.coreRunLevels?.['0'] ?? 0).toBe(0)
    expect(s.resources.salvage).toBe(10)
  })
})
