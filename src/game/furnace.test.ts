import { describe, expect, it } from 'vitest'
import { tickAutomation } from './automation'
import { ACT1_CADENCE } from './cadence'
import {
  applyFurnacePreset,
  canSetFurnaceChannel,
  furnaceActiveLevel,
  furnaceChannelSlots,
  furnaceCombatFx,
  furnaceConsumptionPerSec,
  furnaceDamageMult,
  furnaceIdleGenPerSec,
  furnaceLitLine,
  furnacePushChannels,
  furnaceSpendableHeat,
  getFurnaceChannel,
  runFurnaceManager,
  tickFurnace,
} from './furnace'
import {
  FURNACE_V2_GUIDE_IDS,
  activeGuideStep,
  skipOnboarding,
} from './progression'
import { processConfig, processFurnaceHooks } from './process'
import { createInitialState, SAVE_VERSION } from './state'
import { atCareerWave, markHullLost } from './testHelpers'

function furnaceReady() {
  return atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.furnace)
}

describe('GDD Furnace channels and Process hooks', () => {
  it('keeps SAVE_VERSION at 38', () => {
    expect(SAVE_VERSION).toBe(38)
  })

  it('does not idle-generate Heat', () => {
    const s = furnaceReady()
    s.resources.choirAsh = 40
    s.resources.heat = 0
    expect(furnaceIdleGenPerSec(s)).toBe(0)
    expect(furnaceConsumptionPerSec(s)).toBe(0)
    tickFurnace(s, 10)
    expect(s.resources.heat).toBe(0)
    expect(s.resources.choirAsh).toBe(40)
  })

  it('exposes Weapons, Ward, and Yield only', () => {
    expect(furnacePushChannels().map((ch) => ch.name)).toEqual(['Weapons', 'Ward', 'Yield'])
    expect(getFurnaceChannel('shielding')?.name).toBe('Ward')
    expect(getFurnaceChannel('recovery')?.name).toBe('Yield')
    expect(furnaceChannelSlots(furnaceReady())).toBe(3)
    expect(canSetFurnaceChannel(furnaceReady(), 'foundry', 1).ok).toBe(false)
    expect(canSetFurnaceChannel(furnaceReady(), 'research', 1).ok).toBe(false)
    expect(canSetFurnaceChannel(furnaceReady(), 'network', 1).ok).toBe(false)
  })

  it('lights significant multipliers, not tiny percents', () => {
    for (const ch of furnacePushChannels()) {
      expect(ch.levels[0]?.mult).toBeGreaterThanOrEqual(1.4)
      expect(ch.levels[2]?.mult).toBeGreaterThanOrEqual(2.4)
    }
  })

  it('Push and Farm presets stay on the GDD three channels', () => {
    let s = furnaceReady()
    s = applyFurnacePreset(s, 'push')
    expect(s.furnace.wanted.weapons).toBe(1)
    expect(s.furnace.wanted.shielding).toBe(1)
    expect(s.furnace.wanted.recovery).toBe(0)
    expect(furnaceLitLine(s)).toBe('Weapons I · Ward I')

    s = applyFurnacePreset(s, 'farm')
    expect(s.furnace.wanted.weapons).toBe(1)
    expect(s.furnace.wanted.recovery).toBe(1)
    expect(s.furnace.wanted.shielding).toBe(0)
    expect(furnaceLitLine(s)).toBe('Weapons I · Yield I')

    s = applyFurnacePreset(s, 'research')
    expect(s.furnace.wanted.research).toBe(0)
    expect(s.furnace.wanted.network).toBe(0)
  })

  it('exposes Heat reserve, channel preset, and conditional activation', () => {
    const s = furnaceReady()
    expect(processFurnaceHooks(s).autoFeed).toBe(false)
    expect(processFurnaceHooks(s).reserveHeat).toBe(0)
    expect(processFurnaceHooks(s).conditionalPush).toBe(false)

    s.process.purchased = ['auto-bank', 'furnace-presets', 'furnace-reserve', 'furnace-channels', 'run-profiles']
    s.process.config.furnace.reserveHeat = 12
    s.process.config.furnace.preset = 'push'
    const hooks = processFurnaceHooks(s)
    expect(hooks.autoFeed).toBe(false)
    expect(hooks.presetsUnlocked).toBe(true)
    expect(hooks.reserveHeat).toBe(12)
    expect(hooks.preset).toBe('push')
    expect(hooks.conditionalPush).toBe(true)
    expect(furnaceSpendableHeat(s)).toBe(0)
    s.resources.heat = 20
    expect(furnaceSpendableHeat(s)).toBe(8)
  })

  it('Process furnace-push converts Ash but will not spend the Heat reserve', () => {
    const s = furnaceReady()
    s.combat.docked = false
    s.combat.wave = Math.ceil(ACT1_CADENCE.furnace * 0.95)
    s.resources.choirAsh = 80
    s.resources.heat = 0
    s.process.purchased = ['buy-ten', 'auto-shop', 'spend-ratios', 'rule-builder', 'run-profiles', 'furnace-reserve']
    s.process.config = { ...processConfig(s), activeProfileId: 'push' }
    s.process.config.furnace.reserveHeat = 8
    tickAutomation(s)
    expect(s.resources.choirAsh).toBe(0)
    expect(s.resources.heat).toBe(8)
    expect(furnaceActiveLevel(s, 'weapons')).toBe(0)
    expect(furnaceDamageMult(s)).toBe(1)
  })

  it('Furnace Manager lights the Push preset while leaving the reserve', () => {
    let s = furnaceReady()
    s.combat.docked = false
    s.resources.heat = 24
    s.process.purchased = ['furnace-presets', 'furnace-auto', 'furnace-reserve']
    s.process.config.furnace.manager = true
    s.process.config.furnace.preset = 'push'
    s.process.config.furnace.reserveHeat = 8
    s = runFurnaceManager(s)
    expect(furnaceActiveLevel(s, 'weapons')).toBe(1)
    expect(furnaceActiveLevel(s, 'shielding')).toBe(1)
    expect(s.resources.heat).toBe(8)
    expect(furnaceCombatFx(s)).toEqual({ weapons: true, ward: true, yield: false })
  })

  it('starts a single Furnace light action on first open', () => {
    let s = furnaceReady()
    expect(activeGuideStep(s, 'furnace')?.id).toBe('guide-furnace-light')
    s = skipOnboarding(s, 'guide-furnace-light')
    expect(activeGuideStep(s, 'furnace')).toBeNull()
    for (const id of FURNACE_V2_GUIDE_IDS) {
      expect(s.meta.seenOnboarding).toContain(id)
    }
  })
})
