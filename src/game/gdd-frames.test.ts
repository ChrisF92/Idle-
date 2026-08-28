import { describe, expect, it } from 'vitest'
import {
  SHIP_FRAMES,
  STARTER_FRAME_ID,
  canFitModuleOnFrame,
  equippedFrame,
  frameSalvageMult,
  frameHeatMult,
  frameUnlockLine,
  getFrame,
} from './catalog'
import { applyDevAction } from './dev'
import { fitModule, selectFrame, unlockFrame } from './actions'
import { computeShipStats, createInitialState, SAVE_VERSION } from './state'
import { formatStatShift, previewLoadoutStats } from './uiReadout'
import { salvageFromKill } from './combat'
import { grantModuleCopy } from './coreProgression'
import { usableCoreSlots } from './coreSlots'
import { forceUnlockModule } from './testHelpers'

describe('GDD D8 Hive Frames', () => {
  it('replaces the USI hull ladder with five archetypes', () => {
    expect(SAVE_VERSION).toBe(49)
    expect(SHIP_FRAMES.map((f) => f.id)).toEqual([
      'starter-frame',
      'bastion-frame',
      'swarm-frame',
      'reactor-frame',
      'harvester-frame',
    ])
    expect(getFrame('scout-frame')).toBeUndefined()
    expect(getFrame('line-frame')).toBeUndefined()
    expect(getFrame('capital-frame')).toBeUndefined()
    const fresh = createInitialState(0)
    expect(fresh.shipyard.frameId).toBe(STARTER_FRAME_ID)
    expect(fresh.shipyard.unlockedFrames).toEqual([STARTER_FRAME_ID])
    expect(fresh.shipyard.modules).toEqual(['pulse-cannon', 'plate-layer'])
    expect(getFrame(STARTER_FRAME_ID)).not.toHaveProperty('weaponSlots')
    expect(getFrame(STARTER_FRAME_ID)).not.toHaveProperty('defenseSlots')
    expect(getFrame('swarm-frame')).not.toHaveProperty('weaponSlots')
    expect(usableCoreSlots(fresh)).toBe(2)
  })

  it('lets Swarm wear three Pulse Cores limited by the account bus, not uniqueness', () => {
    let s = createInitialState(0)
    s.shipyard.unlockedFrames = [...s.shipyard.unlockedFrames, 'swarm-frame']
    s = selectFrame(s, 'swarm-frame')
    expect(usableCoreSlots(s)).toBe(3)
    expect(canFitModuleOnFrame([], 'pulse-cannon', usableCoreSlots(s))).toBe(true)
    expect(canFitModuleOnFrame(['pulse-cannon', 'pulse-cannon'], 'pulse-cannon', usableCoreSlots(s))).toBe(
      true,
    )
    expect(
      canFitModuleOnFrame(['pulse-cannon', 'pulse-cannon', 'pulse-cannon'], 'pulse-cannon', usableCoreSlots(s)),
    ).toBe(false)

    grantModuleCopy(s, 'pulse-cannon')
    grantModuleCopy(s, 'pulse-cannon')
    s.shipyard.modules = []
    s.shipyard.equippedCoreIds = []
    s = fitModule(s, 'pulse-cannon')
    s = fitModule(s, 'pulse-cannon')
    s = fitModule(s, 'pulse-cannon')
    s = forceUnlockModule(s, 'barrier-projector')
    s = fitModule(s, 'barrier-projector')
    expect(s.shipyard.modules).toEqual(['pulse-cannon', 'pulse-cannon', 'pulse-cannon'])
  })

  it('does not grant later Frames from Best Wave or leftover shops', () => {
    const fresh = createInitialState(0)
    expect(fresh.shipyard.unlockedFrames).toEqual([STARTER_FRAME_ID])
    expect(unlockFrame(fresh, 'bastion-frame').shipyard.unlockedFrames).not.toContain('bastion-frame')
    expect(unlockFrame(fresh, 'swarm-frame').shipyard.unlockedFrames).not.toContain('swarm-frame')
    expect(frameUnlockLine(getFrame('bastion-frame')!)).toBe('Not yet obtainable')
    expect(frameUnlockLine(getFrame('reactor-frame')!)).toBe('Not yet obtainable')
    expect(frameUnlockLine(getFrame('swarm-frame')!)).toBe('Not yet obtainable')
    expect(frameUnlockLine(getFrame('harvester-frame')!)).toBe('Not yet obtainable')
  })

  it('shows Hull / Shield / DPS / slot deltas when previewing Bastion vs Swarm', () => {
    let s = createInitialState(0)
    s.shipyard.unlockedFrames = ['starter-frame', 'bastion-frame', 'swarm-frame']
    s = selectFrame(s, 'bastion-frame')
    const compare = previewLoadoutStats(s, 'swarm-frame', ['pulse-cannon', 'pulse-cannon', 'plate-layer'])
    expect(compare.next.hullMax).toBeLessThan(compare.current.hullMax)
    expect(compare.next.damage).toBeGreaterThan(compare.current.damage)
    const line = formatStatShift(compare.current.hullMax, compare.next.hullMax)
    expect(line).toMatch(/→/)
    expect(line).toMatch(/%/)
  })

  it('applies archetype bonuses and Dev Tools can pick any Frame', () => {
    const starter = createInitialState(0)
    let bastion = structuredClone(starter)
    bastion.shipyard.unlockedFrames = ['starter-frame', 'bastion-frame']
    bastion = selectFrame(bastion, 'bastion-frame')
    expect(computeShipStats(bastion).hullMax).toBeGreaterThan(computeShipStats(starter).hullMax)
    expect(computeShipStats(bastion).shieldMax).toBeGreaterThan(computeShipStats(starter).shieldMax)

    let harvester = applyDevAction(starter, { type: 'select-frame', frameId: 'harvester-frame' })
    expect(harvester.shipyard.frameId).toBe('harvester-frame')
    expect(equippedFrame(harvester).salvageMult).toBe(1.2)
    expect(frameSalvageMult(harvester)).toBe(1.2)
    expect(salvageFromKill(4, false, 'A', harvester) * frameSalvageMult(harvester)).toBeGreaterThan(
      salvageFromKill(4, false, 'A', starter),
    )

    let reactor = applyDevAction(starter, { type: 'select-frame', frameId: 'reactor-frame' })
    expect(frameHeatMult(reactor)).toBeGreaterThan(frameHeatMult(starter))
  })
})
