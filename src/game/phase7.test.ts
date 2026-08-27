import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState, SAVE_VERSION } from './state'
import { performRebuild } from './actions'
import { getFrame } from './catalog'
import { maybeGrantSystemUnlocks, isSystemUnlocked } from './progression'
import { encounterForWave } from './combat'

describe('phase 7 leftovers: no Yard, no Route A/B, no sector launch', () => {
  it('bumps save and keeps Yard locked', () => {
    expect(SAVE_VERSION).toBe(48)
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'yard')).toBe(false)
    expect(getFrame('bastion-frame')?.requiresBestWave).toBe(70)
    expect(getFrame('starter-frame')?.baseHull).toBe(40)
  })

  it('unlocks Bastion Frame after Wave 70 and does not auto-grant Swarm', () => {
    const s = createInitialState(0)
    s.meta.bestWave = 80
    s.combat.bestWave = 80
    maybeGrantSystemUnlocks(s)
    expect(s.shipyard.unlockedFrames).toContain('bastion-frame')
    expect(s.shipyard.unlockedFrames).not.toContain('swarm-frame')
  })

  it('has no standalone Yard and no Route A/B encounter argument', () => {
    const s = createInitialState(0)
    expect(s).not.toHaveProperty('yard')
    const enc = encounterForWave(9)
    expect(enc.units.length).toBeGreaterThan(0)
    expect(() => encounterForWave(9)).not.toThrow()
  })

  it('Rebuild hangar can swap onto Bastion once unlocked', () => {
    let s = createInitialState(0)
    s.meta.bestWave = 210
    s.combat.bestWave = 210
    s.combat.docked = true
    s.meta.hullLostOnce = true
    s.prestige.cycle.normalSortiesCompleted = 4
    s.shipyard.unlockedFrames = ['starter-frame', 'bastion-frame']
    s = performRebuild(s, {
      frameId: 'bastion-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.shipyard.frameId).toBe('bastion-frame')
    const starterHull = computeShipStats({
      ...s,
      shipyard: { ...s.shipyard, frameId: 'starter-frame' },
    }).hullMax
    expect(computeShipStats(s).hullMax).toBeGreaterThan(starterHull)
  })
})
