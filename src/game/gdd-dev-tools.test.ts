import { describe, expect, it } from 'vitest'
import { applyDevAction, GDD_DOOR_PRESETS } from './dev'
import { isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave } from './waves'
import { moduleMasteryRank } from './catalog'
import { canRebuild } from './rebuild'

describe('GDD Dev Tools', () => {
  it('lists the Act 1 door presets', () => {
    expect(GDD_DOOR_PRESETS.map((d) => d.wave)).toEqual([
      ACT1_CADENCE.foundry,
      ACT1_CADENCE.workers,
      ACT1_CADENCE.directives,
      ACT1_CADENCE.rebuild,
      ACT1_CADENCE.reliquary,
      ACT1_CADENCE.furnace,
      ACT1_CADENCE.research,
      ACT1_CADENCE.process,
      ACT1_CADENCE.protocols,
      ACT1_CADENCE.reinforce,
    ])
    expect(GDD_DOOR_PRESETS.map((d) => d.label)).toEqual([
      'W50 Foundry',
      'W50 Workers',
      'W50 Directives',
      'W210 Rebuild',
      'W320 Relics',
      'W140 Furnace',
      'W170 Research',
      'W210 Process',
      'W250 Challenges',
      'W1000 Reinforce',
    ])
  })

  it('set-best-wave grants career doors without changing the live Wave', () => {
    let s = createInitialState(0)
    s.combat.wave = 3
    s = applyDevAction(s, { type: 'set-best-wave', wave: ACT1_CADENCE.foundry })
    expect(careerBestWave(s)).toBeGreaterThanOrEqual(ACT1_CADENCE.foundry)
    expect(s.combat.wave).toBe(3)
    expect(isSystemUnlocked(s, 'foundry')).toBe(true)
    expect(isSystemUnlocked(s, 'furnace')).toBe(false)
    expect(isSystemUnlocked(s, 'echo')).toBe(false)
    expect(isSystemUnlocked(s, 'specialists')).toBe(false)
  })

  it('opens each GDD door from a wipe', () => {
    const cases: Array<{ wave: number; id: 'foundry' | 'network' | 'furnace' | 'research' | 'process' | 'protocols' | 'reinforce' }> = [
      { wave: ACT1_CADENCE.foundry, id: 'foundry' },
      { wave: ACT1_CADENCE.workers, id: 'network' },
      { wave: ACT1_CADENCE.furnace, id: 'furnace' },
      { wave: ACT1_CADENCE.research, id: 'research' },
      { wave: ACT1_CADENCE.process, id: 'process' },
      { wave: ACT1_CADENCE.protocols, id: 'protocols' },
    ]
    for (const { wave, id } of cases) {
      let s = applyDevAction(createInitialState(0), { type: 'prep-gdd-door', wave })
      expect(isSystemUnlocked(s, id), `door ${id} at W${wave}`).toBe(true)
      expect(isSystemUnlocked(s, 'echo')).toBe(false)
      expect(isSystemUnlocked(s, 'specialists')).toBe(false)
      expect(isSystemUnlocked(s, 'capital')).toBe(false)
    }

    let rebuild = applyDevAction(createInitialState(0), { type: 'prep-gdd-door', wave: ACT1_CADENCE.rebuild })
    rebuild.combat.docked = true
    expect(canRebuild(rebuild)).toBe(true)

    const climax = applyDevAction(createInitialState(0), { type: 'prep-gdd-door', wave: ACT1_CADENCE.reinforce })
    expect(isSystemUnlocked(climax, 'reinforce')).toBe(true)
    expect(climax.meta.act1Cleared).toBe(true)

    const relics = applyDevAction(createInitialState(0), { type: 'prep-gdd-door', wave: ACT1_CADENCE.reliquary })
    expect(isSystemUnlocked(relics, 'reliquary')).toBe(true)
    expect(relics.relics.instances.length).toBe(0)
  })

  it('picks any GDD Frame without the USI hull ladder', () => {
    let s = applyDevAction(createInitialState(0), { type: 'select-frame', frameId: 'swarm-frame' })
    expect(s.shipyard.frameId).toBe('swarm-frame')
    expect(s.shipyard.unlockedFrames).toContain('swarm-frame')
    s = applyDevAction(s, { type: 'select-frame', frameId: 'starter-frame' })
    expect(s.shipyard.frameId).toBe('starter-frame')
  })

  it('sets shared Core Mastery', () => {
    let s = createInitialState(0)
    s = applyDevAction(s, { type: 'set-core-mastery', ranks: { 'pulse-cannon': 12 } })
    expect(moduleMasteryRank(s, 'pulse-cannon')).toBe(12)
  })

  it('injects Farm and Push Process profiles', () => {
    let farm = applyDevAction(createInitialState(0), { type: 'inject-process-profile', profileId: 'farm' })
    expect(isSystemUnlocked(farm, 'process')).toBe(true)
    expect(farm.process.purchased).toEqual(
      expect.arrayContaining(['buy-ten', 'auto-shop', 'spend-ratios', 'rule-builder', 'run-profiles']),
    )
    expect(farm.process.config.activeProfileId).toBe('farm')
    expect(farm.process.config.profiles.map((p) => p.id)).toEqual(
      expect.arrayContaining(['farm', 'push', 'challenge']),
    )

    const push = applyDevAction(farm, { type: 'inject-process-profile', profileId: 'push' })
    expect(push.process.config.activeProfileId).toBe('push')
  })

  it('seed-late-game opens Reinforce instead of Task List / Capital', () => {
    const s = applyDevAction(createInitialState(0), { type: 'seed-late-game' })
    expect(isSystemUnlocked(s, 'reinforce')).toBe(true)
    expect(isSystemUnlocked(s, 'capital')).toBe(false)
    expect(isSystemUnlocked(s, 'echo')).toBe(false)
  })

  it('W50 Foundry door also opens Workers, but not later systems', () => {
    let s = createInitialState(0)
    s = applyDevAction(s, { type: 'skip-guides' })
    s = applyDevAction(s, { type: 'prep-gdd-door', wave: ACT1_CADENCE.foundry })
    s = applyDevAction(s, { type: 'fill-workers', count: 8 })
    s = applyDevAction(s, { type: 'dock-heal' })
    expect(careerBestWave(s)).toBe(ACT1_CADENCE.foundry)
    expect(isSystemUnlocked(s, 'foundry')).toBe(true)
    expect(isSystemUnlocked(s, 'network')).toBe(true)
    expect(isSystemUnlocked(s, 'furnace')).toBe(false)
    expect(isSystemUnlocked(s, 'research')).toBe(false)
    expect(isSystemUnlocked(s, 'process')).toBe(false)
    expect(s.base.workerDrones).toBeGreaterThanOrEqual(8)
  })

  it('unlock-catalog does not raise Best Wave', () => {
    const s = applyDevAction(createInitialState(0), { type: 'unlock-catalog' })
    expect(careerBestWave(s)).toBe(0)
    expect(s.shipyard.unlockedFrames).toContain('bastion-frame')
    expect(isSystemUnlocked(s, 'foundry')).toBe(false)
    expect(isSystemUnlocked(s, 'furnace')).toBe(false)
  })
})
