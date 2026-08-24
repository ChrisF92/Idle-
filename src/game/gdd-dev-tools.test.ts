import { describe, expect, it } from 'vitest'
import { applyDevAction, GDD_DOOR_PRESETS } from './dev'
import { isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave, isBossWave } from './waves'
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

  it('set-wave changes only the live fight', () => {
    let s = createInitialState(0)
    s = applyDevAction(s, { type: 'set-wave', wave: 47 })
    expect(s.combat.wave).toBe(47)
    expect(careerBestWave(s)).toBeLessThan(47)
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
  })

  it('force-boss-wave uses every 10th Wave', () => {
    let s = createInitialState(0)
    s = applyDevAction(s, { type: 'set-wave', wave: 27 })
    s = applyDevAction(s, { type: 'force-boss-wave' })
    expect(s.combat.wave).toBe(30)
    expect(isBossWave(s.combat.wave)).toBe(true)
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

  it('W20 Foundry door does not grant Wave 300 or later systems', () => {
    let s = createInitialState(0)
    s = applyDevAction(s, { type: 'skip-guides' })
    s = applyDevAction(s, { type: 'prep-gdd-door', wave: ACT1_CADENCE.foundry })
    s = applyDevAction(s, { type: 'fill-workers', count: 8 })
    s = applyDevAction(s, { type: 'dock-heal' })
    expect(careerBestWave(s)).toBe(ACT1_CADENCE.foundry)
    expect(isSystemUnlocked(s, 'foundry')).toBe(true)
    expect(isSystemUnlocked(s, 'network')).toBe(false)
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
