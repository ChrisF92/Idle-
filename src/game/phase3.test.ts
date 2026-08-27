import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { buyCoreStartingLevel, performRebuild } from './actions'
import { canRebuild } from './rebuild'
import { nextMasteryMilestone } from './coreMastery'
import { getFrame } from './catalog'
import { isSystemUnlocked, visibleResourceIds } from './progression'
import { maybeGrantSystemUnlocks } from './progression'
import { atCareerWave, armRebuildDoor } from './testHelpers'
import { setDocked } from './tick'

describe('phase 3: milestones, rebuild, foundry', () => {
  it('uses authored Core Mastery milestones instead of leftover 2-picks', () => {
    expect(nextMasteryMilestone('pulse-cannon', 0)?.name).toBe('Pulse Identity')
    expect(nextMasteryMilestone('pulse-cannon', 5)?.name).toBe('Overkill Retarget')
    expect(nextMasteryMilestone('pulse-cannon', 10)?.name).toBe('Relic Capability')
  })

  it('allows Rebuild from Wave 210 and keeps Core Mastery', () => {
    let s = armRebuildDoor(createInitialState(0))
    s.meta.moduleMastery = { 'pulse-cannon': 6 }
    expect(canRebuild(s)).toBe(true)

    s = performRebuild(s, {
      frameId: 'starter-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.prestige.prestigeCount).toBe(1)
    expect(s.meta.moduleMastery['pulse-cannon']).toBe(6)
    expect(s.combat.docked).toBe(true)
  })

  it('does not grant Bastion from Best Wave', () => {
    const s = atCareerWave(createInitialState(0), 70)
    maybeGrantSystemUnlocks(s)
    expect(s.shipyard.unlockedFrames).toEqual(['starter-frame'])
    expect(getFrame('bastion-frame')?.name).toBe('Bastion')
    expect(getFrame('bastion-frame')?.unlockSource).toBe('material-mastery')
    expect(getFrame('bastion-frame')).not.toHaveProperty('defenseSlots')
    expect(getFrame('bastion-frame')).not.toHaveProperty('requiresBestWave')
  })

  it('Rebuild hangar can swap onto Bastion once owned', () => {
    let s = armRebuildDoor(createInitialState(0))
    s.shipyard.unlockedFrames = ['starter-frame', 'bastion-frame']
    s = performRebuild(s, {
      frameId: 'bastion-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.shipyard.frameId).toBe('bastion-frame')
  })

  it('opens Foundry at Wave 50 and hides scrap until then', () => {
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'foundry')).toBe(false)
    expect(visibleResourceIds(fresh)).toEqual([])

    const locked = atCareerWave(createInitialState(0), 49)
    expect(isSystemUnlocked(locked, 'foundry')).toBe(false)

    let s = atCareerWave(createInitialState(0), 50)
    expect(isSystemUnlocked(s, 'foundry')).toBe(true)
    expect(visibleResourceIds(s)).toContain('scrap')
    s.meta.hullLostOnce = true
    expect(visibleResourceIds(s)).toContain('salvage')
  })

  it('does not spend Salvage on Cores during a Sortie', () => {
    let s = createInitialState(0)
    s = setDocked(s, false)
    s.resources.salvage = 10
    s.resources.scrap = 80
    s = buyCoreStartingLevel(s, 'pulse-cannon:1')
    expect(s.resources.salvage).toBe(10)
    expect(s.resources.scrap).toBe(80)
  })
})
