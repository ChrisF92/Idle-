import { describe, expect, it } from 'vitest'
import {
  SHIP_FRAMES,
  STARTER_FRAME_ID,
  canFitModuleOnFrame,
  equippedFrame,
  frameSalvageMult,
  frameUnlockLine,
  getFrame,
} from './catalog'
import { applyDevAction } from './dev'
import { fitModule, selectFrame, setFoundrySlot, unlockFrame } from './actions'
import { furnaceAshHeatMult } from './furnace'
import { hiveResearchNodeDuration, getHiveResearchNode, tickResearch } from './hiveResearch'
import { maybeGrantSystemUnlocks } from './progression'
import { tryCompleteProtocol } from './protocols'
import { computeShipStats, createInitialState, SAVE_VERSION } from './state'
import { atCareerWave } from './testHelpers'
import { advanceSeconds } from './tick'
import { formatStatShift, previewLoadoutStats } from './uiReadout'
import { salvageFromKill } from './combat'

describe('GDD D8 Hive Frames', () => {
  it('replaces the USI hull ladder with five archetypes', () => {
    expect(SAVE_VERSION).toBe(40)
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
    expect(getFrame(STARTER_FRAME_ID)?.weaponSlots).toBe(1)
    expect(getFrame(STARTER_FRAME_ID)?.defenseSlots).toBe(1)
    expect(getFrame('swarm-frame')?.weaponSlots).toBe(3)
    expect(getFrame('bastion-frame')?.defenseSlots).toBe(3)
    expect(getFrame('harvester-frame')?.utilitySlots).toBe(3)
  })

  it('lets Swarm wear three Pulse Cores limited by slots, not uniqueness', () => {
    const swarm = getFrame('swarm-frame')!
    expect(canFitModuleOnFrame(swarm, [], 'pulse-cannon')).toBe(true)
    expect(canFitModuleOnFrame(swarm, ['pulse-cannon', 'pulse-cannon'], 'pulse-cannon')).toBe(true)
    expect(canFitModuleOnFrame(swarm, ['pulse-cannon', 'pulse-cannon', 'pulse-cannon'], 'pulse-cannon')).toBe(
      false,
    )

    let s = createInitialState(0)
    s.shipyard.unlockedFrames = [...s.shipyard.unlockedFrames, 'swarm-frame']
    s.shipyard.unlockedModules = ['pulse-cannon', 'barrier-projector', 'salvage-rig']
    s.shipyard.moduleCopies = {
      'pulse-cannon': 3,
      'barrier-projector': 1,
      'salvage-rig': 1,
    }
    s = selectFrame(s, 'swarm-frame')
    s.shipyard.modules = []
    s = fitModule(s, 'pulse-cannon')
    s = fitModule(s, 'pulse-cannon')
    s = fitModule(s, 'pulse-cannon')
    s = fitModule(s, 'barrier-projector')
    s = fitModule(s, 'salvage-rig')
    expect(s.shipyard.modules).toEqual([
      'pulse-cannon',
      'pulse-cannon',
      'pulse-cannon',
      'barrier-projector',
      'salvage-rig',
    ])
  })

  it('unlocks Bastion from Wave 70, Swarm from Temper Bar, Reactor from Extra Tap, Harvester from Swarm Pressure', () => {
    const early = atCareerWave(createInitialState(0), 69)
    maybeGrantSystemUnlocks(early)
    expect(early.shipyard.unlockedFrames).not.toContain('bastion-frame')

    const wave = atCareerWave(createInitialState(0), 70)
    maybeGrantSystemUnlocks(wave)
    expect(wave.shipyard.unlockedFrames).toContain('bastion-frame')
    expect(wave.shipyard.unlockedFrames).not.toContain('swarm-frame')

    expect(unlockFrame(createInitialState(0), 'swarm-frame').shipyard.unlockedFrames).not.toContain(
      'swarm-frame',
    )

    let foundry = atCareerWave(createInitialState(0), 50)
    foundry.foundry.recipeLevels['slag-ingot'] = 5
    foundry.foundry.materials['slag-ingot'] = 40
    foundry.foundry.materials.filament = 20
    foundry = setFoundrySlot(foundry, 0, 'temper-bar')
    advanceSeconds(foundry, 181)
    expect(foundry.shipyard.unlockedFrames).toContain('swarm-frame')
    expect(frameUnlockLine(getFrame('swarm-frame')!)).toMatch(/Temper Bar/)

    let research = atCareerWave(createInitialState(0), 170)
    const extraTap = getHiveResearchNode('extra-tap')!
    research.hiveResearch.active = true
    research.hiveResearch.focus = 'energy'
    research.hiveResearch.completedIds = ['plate-bank']
    research.hiveResearch.completed.energy = 1
    research.hiveResearch.activeNodeId = 'extra-tap'
    research.hiveResearch.progress = hiveResearchNodeDuration(extraTap, research)
    tickResearch(research, 1)
    expect(research.shipyard.unlockedFrames).toContain('reactor-frame')

    const challenge = atCareerWave(createInitialState(0), 250)
    challenge.prestige.prestigeCount = 2
    challenge.hiveResearch.completed.energy = 1
    challenge.protocols.activeId = 'mute-network'
    challenge.combat.wave = 100
    tryCompleteProtocol(challenge)
    expect(challenge.shipyard.unlockedFrames).toContain('harvester-frame')
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
    reactor.meta.bestWave = 140
    reactor.combat.bestWave = 140
    expect(furnaceAshHeatMult(reactor)).toBeGreaterThan(furnaceAshHeatMult(starter))
  })
})
