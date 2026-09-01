import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState, SAVE_VERSION } from './state'
import { performRebuild } from './actions'
import { getFrame } from './catalog'
import { maybeGrantSystemUnlocks } from './progression'
import { encounterForWave } from './combat'

describe('phase 7 leftovers: no Yard, no Route A/B, no sector launch', () => {
  it('bumps save and has no standalone Yard', () => {
    expect(SAVE_VERSION).toBe(51)
    const fresh = createInitialState(0)
    expect(fresh).not.toHaveProperty('yard')
    expect(getFrame('starter-frame')?.baseHull).toBe(40)
  })

  it('does not auto-grant Swarm Frame from Best Wave', () => {
    const s = createInitialState(0)
    s.meta.bestWave = 80
    s.combat.bestWave = 80
    maybeGrantSystemUnlocks(s)
    expect(s.shipyard.unlockedFrames).not.toContain('swarm-frame')
  })

  it('has no Route A/B encounter argument', () => {
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
