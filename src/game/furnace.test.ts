import { describe, expect, it } from 'vitest'
import { createInitialState, SAVE_VERSION } from './state'
import { performRebuild, setFurnaceChannel } from './actions'
import { tickAutomation } from './automation'
import {
  applyFurnacePreset,
  buyFurnaceUpgrade,
  canSetFurnaceChannel,
  convertAshToHeat,
  finalizeFurnaceMigration,
  furnaceActiveLevel,
  furnaceCapacity,
  furnaceChannelSlots,
  furnaceConsumptionPerSec,
  furnaceDamageMult,
  furnaceGenerationPerSec,
  furnaceIdleGenPerSec,
  furnaceNetPerSec,
  furnaceRestartHeat,
  furnaceSalvageMult,
  runFurnaceManager,
  setFurnacePriority,
  tickFurnace,
} from './furnace'
import { applyOfflineCatchUp } from './offline'
import {
  FURNACE_V2_GUIDE_IDS,
  activeGuideStep,
  skipOnboarding,
} from './progression'
import { exportSave, importSave } from './save'
import { prepOnboardingDoor } from './onboarding'

function furnaceReady(sector = 28) {
  const s = createInitialState(0)
  s.meta.highestSectorEver = sector
  return s
}

describe('Furnace 2.0 heat tank', () => {
  it('keeps SAVE_VERSION at 34', () => {
    expect(SAVE_VERSION).toBe(46)
  })

  it('generates idle Heat into storage up to capacity', () => {
    const s = furnaceReady()
    s.resources.choirAsh = 0
    s.resources.heat = 0
    tickFurnace(s, 10)
    expect(s.resources.heat).toBeCloseTo(furnaceIdleGenPerSec(s) * 10, 5)
    expect(s.resources.heat).toBeLessThan(furnaceCapacity(s))

    s.resources.heat = furnaceCapacity(s)
    tickFurnace(s, 5)
    expect(s.resources.heat).toBe(furnaceCapacity(s))
  })

  it('burns Choir-ash into Heat and stops wasting ash when the tank is full', () => {
    const s = furnaceReady()
    s.resources.choirAsh = 40
    s.resources.heat = 0
    const gen = furnaceGenerationPerSec(s)
    expect(gen).toBeGreaterThan(furnaceIdleGenPerSec(s))
    tickFurnace(s, 8)
    expect(s.resources.heat).toBeGreaterThan(0.2)
    expect(s.resources.choirAsh).toBeLessThan(40)

    s.resources.heat = furnaceCapacity(s)
    const ash = s.resources.choirAsh
    tickFurnace(s, 5)
    expect(s.resources.choirAsh).toBeCloseTo(ash, 5)
  })

  it('banks ash into Heat at 10 ash per Heat', () => {
    const s = furnaceReady()
    s.resources.choirAsh = 40
    s.resources.heat = 0
    const next = convertAshToHeat(s)
    expect(next.resources.choirAsh).toBe(0)
    expect(next.resources.heat).toBeCloseTo(4)
  })
})

describe('Furnace 2.0 channels', () => {
  it('lights a channel, spends Heat, and applies its bonus', () => {
    let s = furnaceReady()
    s.resources.heat = 8
    s.resources.choirAsh = 0
    expect(furnaceDamageMult(s)).toBe(1)
    s = setFurnaceChannel(s, 'weapons', 1)
    expect(s.furnace.wanted.weapons).toBe(1)
    expect(s.furnace.active.weapons).toBe(1)
    expect(furnaceDamageMult(s)).toBeCloseTo(1.18)
    expect(furnaceConsumptionPerSec(s)).toBeCloseTo(0.05)
    expect(furnaceNetPerSec(s)).toBeLessThan(0)
  })

  it('charges substantially more Heat at higher channel levels', () => {
    let s = furnaceReady()
    s = setFurnaceChannel(s, 'weapons', 1)
    const l1 = furnaceConsumptionPerSec(s)
    s = setFurnaceChannel(s, 'weapons', 2)
    const l2 = furnaceConsumptionPerSec(s)
    s = setFurnaceChannel(s, 'weapons', 3)
    const l3 = furnaceConsumptionPerSec(s)
    expect(l2).toBeGreaterThan(l1 * 2)
    expect(l3).toBeGreaterThan(l2 * 2)
  })

  it('caps simultaneous channels until Extra Tap, Rebuild, or Accumulation', () => {
    let s = furnaceReady()
    expect(furnaceChannelSlots(s)).toBe(1)
    s = setFurnaceChannel(s, 'weapons', 1)
    expect(canSetFurnaceChannel(s, 'shielding', 1).ok).toBe(false)
    expect(setFurnaceChannel(s, 'shielding', 1)).toBe(s)

    s.prestige.prestigeCount = 1
    expect(furnaceChannelSlots(s)).toBe(2)
    s = setFurnaceChannel(s, 'shielding', 1)
    expect(s.furnace.active.shielding).toBe(1)

    s.process.earned = 150
    expect(furnaceChannelSlots(s)).toBe(3)
    s.resources.heat = 40
    s = buyFurnaceUpgrade(s, 'taps')
    expect(furnaceChannelSlots(s)).toBe(4)
  })

  it('keeps Foundry and Research channels locked until those systems open', () => {
    const s = furnaceReady(28)
    expect(canSetFurnaceChannel(s, 'foundry', 1).ok).toBe(true)
    expect(canSetFurnaceChannel(s, 'research', 1).ok).toBe(false)
    s.meta.highestSectorEver = 34
    expect(canSetFurnaceChannel(s, 'research', 1).ok).toBe(true)
  })
})

describe('Furnace 2.0 starvation', () => {
  it('drains stored Heat first, then drops the lowest-priority channel', () => {
    let s = furnaceReady()
    s.prestige.prestigeCount = 1
    s.resources.choirAsh = 40
    s.resources.heat = 0.4
    s = setFurnacePriority(s, ['weapons', 'shielding'])
    s = setFurnaceChannel(s, 'weapons', 1)
    s = setFurnaceChannel(s, 'shielding', 1)
    tickFurnace(s, 25)
    expect(s.furnace.active.weapons).toBe(1)
    expect(s.furnace.active.shielding).toBe(0)
    expect(s.furnace.wanted.shielding).toBe(1)
    expect(s.furnace.starveNote).toMatch(/Shielding/)
  })

  it('does not hard-shut every channel at once', () => {
    let s = furnaceReady()
    s.resources.choirAsh = 0
    s.resources.heat = 0.05
    s = setFurnaceChannel(s, 'weapons', 3)
    tickFurnace(s, 1)
    expect(s.furnace.active.weapons).toBeGreaterThanOrEqual(0)
    expect(s.furnace.active.weapons).toBeLessThan(3)
    expect(s.furnace.wanted.weapons).toBe(3)
  })
})

describe('Furnace 2.0 Process automation and presets', () => {
  it('Auto Feed dumps ash into Heat', () => {
    const s = furnaceReady()
    s.meta.aiUnlocked = true
    s.process.purchased = ['auto-bank']
    s.process.config.furnace.autoFeed = true
    s.resources.choirAsh = 20
    s.resources.heat = 0
    tickAutomation(s)
    expect(s.resources.choirAsh).toBe(0)
    expect(s.resources.heat).toBeCloseTo(2)
  })

  it('applies presets without inventing extra channels', () => {
    let s = furnaceReady(34)
    s.prestige.prestigeCount = 1
    s = applyFurnacePreset(s, 'push')
    expect(s.furnace.wanted.weapons).toBe(1)
    expect(s.furnace.wanted.shielding).toBe(1)
    expect(s.furnace.wanted.recovery).toBe(0)

    s = applyFurnacePreset(s, 'research')
    expect(s.furnace.wanted.research).toBe(1)
    expect(s.furnace.wanted.network).toBe(1)
    expect(s.furnace.wanted.weapons).toBe(0)
  })

  it('with one slot, Research preset lights Research first', () => {
    let s = furnaceReady(34)
    expect(furnaceChannelSlots(s)).toBe(1)
    s = applyFurnacePreset(s, 'research')
    expect(s.furnace.wanted.research).toBe(1)
    expect(s.furnace.wanted.network).toBe(0)
  })

  it('Furnace Manager downscales to the Heat budget and keeps wanted', () => {
    let s = furnaceReady()
    s.meta.aiUnlocked = true
    s.process.purchased = ['auto-bank', 'furnace-presets', 'furnace-auto', 'furnace-channels', 'furnace-reserve']
    s.process.config.furnace.manager = true
    s.process.config.furnace.autoChannel = true
    s.process.config.furnace.reserveHeat = 2
    s.resources.choirAsh = 0
    s.resources.heat = 3
    s = setFurnaceChannel(s, 'weapons', 3)
    const managed = runFurnaceManager(s)
    expect(managed.furnace.wanted.weapons).toBe(3)
    expect(managed.furnace.active.weapons).toBeGreaterThan(0)
    expect(managed.furnace.active.weapons).toBeLessThan(3)
    expect(furnaceActiveLevel(managed, 'shielding')).toBe(0)
  })
})

describe('Furnace 2.0 Rebuild, offline, save, onboarding', () => {
  it('Rebuild keeps upgrades, wanted lights, and ash; Heat resets unless Ember', () => {
    let s = furnaceReady(34)
    s.furnace.upgrades.hearth = 2
    s.furnace.wanted.weapons = 2
    s.furnace.active.weapons = 2
    s.resources.heat = 10
    s.resources.choirAsh = 12
    s.resources.prestigeMatter = 2
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.furnace.upgrades.hearth).toBe(2)
    expect(s.furnace.wanted.weapons).toBe(2)
    expect(s.resources.choirAsh).toBe(12)
    expect(s.resources.heat).toBe(0)
  })

  it('Ember Lock keeps a fraction of Heat on Rebuild', () => {
    const s = furnaceReady()
    s.furnace.upgrades.ember = 1
    expect(furnaceRestartHeat(s, 10)).toBeCloseTo(2.2)
  })

  it('applies Heat generation while offline', () => {
    const s = furnaceReady()
    s.resources.choirAsh = 30
    s.resources.heat = 0
    s.lastTickAt = 0
    const { state } = applyOfflineCatchUp(s, 60_000)
    expect(state.resources.heat).toBeGreaterThan(0.4)
    expect(state.resources.choirAsh).toBeLessThan(30)
  })

  it('migrates old rank tracks into Furnace 2.0 upgrades', () => {
    const s = furnaceReady()
    const parsed = JSON.parse(decodeURIComponent(escape(atob(exportSave(s))))) as {
      furnace: { ranks: Record<string, number> }
      resources: { heat: number }
    }
    parsed.furnace = { ranks: { attack: 8, defense: 4, lab: 0, workshop: 2, hold: 1 } }
    parsed.resources.heat = 6
    const imported = importSave(btoa(unescape(encodeURIComponent(JSON.stringify(parsed)))))
    expect(imported).toBeTruthy()
    expect(imported!.furnace.v2).toBe(true)
    expect(imported!.furnace.ranks.attack).toBe(0)
    expect(imported!.furnace.upgrades.hearth).toBeGreaterThan(0)
    expect(imported!.resources.heat).toBe(6)

    const local = furnaceReady()
    local.furnace.v2 = false
    local.furnace.ranks = { attack: 4, defense: 0, lab: 0, workshop: 0, hold: 0 }
    finalizeFurnaceMigration(local)
    expect(local.furnace.v2).toBe(true)
    expect(local.furnace.upgrades.hearth).toBe(1)
  })

  it('starts a single Furnace light action on first open', () => {
    let s = prepOnboardingDoor(createInitialState(0), 'furnace.channel')
    expect(activeGuideStep(s, 'furnace')?.id).toBe('furnace.channel')
    s = skipOnboarding(s, 'furnace.channel')
    expect(activeGuideStep(s, 'furnace')).toBeNull()
    for (const id of FURNACE_V2_GUIDE_IDS) {
      expect(s.meta.seenOnboarding).toContain(id)
    }
  })

  it('does not replay the Furnace light hint after it is seen', () => {
    const s = prepOnboardingDoor(createInitialState(0), 'furnace.channel')
    s.meta.seenOnboarding = [...FURNACE_V2_GUIDE_IDS]
    expect(activeGuideStep(s, 'furnace')).toBeNull()
  })
})

describe('Furnace 2.0 recovery channel', () => {
  it('raises salvage while Recovery is lit', () => {
    let s = furnaceReady()
    expect(furnaceSalvageMult(s)).toBe(1)
    s = setFurnaceChannel(s, 'recovery', 1)
    expect(furnaceSalvageMult(s)).toBeCloseTo(1.12)
  })
})
