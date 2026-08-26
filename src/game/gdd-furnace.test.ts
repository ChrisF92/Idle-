import { describe, expect, it } from 'vitest'
import { convertAshToHeat, performRebuild, setFurnaceChannel } from './actions'
import { tickAutomation } from './automation'
import { ACT1_CADENCE } from './cadence'
import {
  ASH_PER_HEAT,
  canBuyFurnaceUpgrade,
  canSetFurnaceChannel,
  furnaceActiveLevel,
  furnaceAshFromKill,
  furnaceCombatFx,
  furnaceDamageMult,
  furnaceIdleGenPerSec,
  furnaceLitLine,
  furnacePushChannels,
  furnaceShieldMult,
  furnaceSalvageMult,
  furnaceSpendableHeat,
  grantFurnaceKillLoot,
  runFurnaceManager,
} from './furnace'
import { applyOfflineCatchUp } from './offline'
import { processConfig, processFurnaceHooks } from './process'
import { ONBOARDING_ENABLED, activeGuideStep, isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { armRebuildDoor, atCareerWave, markHullLost } from './testHelpers'
import { advanceSeconds, extractSortie, setDocked, startCombat } from './tick'

function furnaceState(wave = ACT1_CADENCE.furnace) {
  return atCareerWave(markHullLost(createInitialState(0)), wave)
}

describe('GDD Furnace', () => {
  it('stays locked before Wave 140', () => {
    const locked = furnaceState(ACT1_CADENCE.furnace - 1)
    expect(isSystemUnlocked(locked, 'furnace')).toBe(false)
    expect(furnaceAshFromKill(locked, false)).toBe(0)
    expect(grantFurnaceKillLoot(locked, false)).toBe(0)
    expect(locked.resources.choirAsh).toBe(0)
  })

  it('drops Ash from kills after Wave 140', () => {
    const open = furnaceState()
    expect(isSystemUnlocked(open, 'furnace')).toBe(true)
    const ash = grantFurnaceKillLoot(open, false)
    expect(ash).toBeGreaterThan(0)
    expect(open.resources.choirAsh).toBe(ash)
  })

  it('converts 10 Ash into 1 Heat and does not idle-generate', () => {
    let s = furnaceState()
    s.resources.choirAsh = ASH_PER_HEAT
    s.resources.heat = 0
    expect(furnaceIdleGenPerSec(s)).toBe(0)
    s = convertAshToHeat(s)
    expect(s.resources.choirAsh).toBe(0)
    expect(s.resources.heat).toBe(1)
  })

  it('lights Weapons I for 8 Heat at ×1.4', () => {
    let s = furnaceState()
    s.resources.heat = 8
    s = setFurnaceChannel(s, 'weapons', 1)
    expect(furnaceActiveLevel(s, 'weapons')).toBe(1)
    expect(s.resources.heat).toBe(0)
    expect(furnaceDamageMult(s)).toBeCloseTo(1.4)
    expect(canBuyFurnaceUpgrade(s, 'hearth').ok).toBe(false)
  })

  it('lights Ward and Yield at the authored Sortie multipliers', () => {
    let s = furnaceState()
    s.resources.heat = 8 + 8
    s = setFurnaceChannel(s, 'shielding', 1)
    s = setFurnaceChannel(s, 'recovery', 1)
    expect(furnaceShieldMult(s)).toBeCloseTo(1.4)
    expect(furnaceSalvageMult(s)).toBeCloseTo(1.4)
  })

  it('keeps player-facing channel names Weapons, Ward, and Yield', () => {
    const s = furnaceState()
    s.furnace.active.weapons = 1
    s.furnace.active.shielding = 2
    s.furnace.active.recovery = 3
    expect(furnaceLitLine(s)).toBe('Weapons I · Ward II · Yield III')
    expect(furnaceCombatFx(s)).toEqual({ weapons: true, ward: true, yield: true })
  })

  it('dumps Heat and extinguishes channels on Extract', () => {
    let s = furnaceState()
    s = setDocked(s, false)
    s = startCombat(s)
    s.resources.heat = 20
    s = setFurnaceChannel(s, 'weapons', 1)
    expect(furnaceActiveLevel(s, 'weapons')).toBe(1)
    s.meta.bestWave = Math.max(s.meta.bestWave ?? 0, 210)
    s.combat.bestWave = Math.max(s.combat.bestWave ?? 0, 210)
    s = extractSortie(s)
    expect(s.combat.lastSortie.outcome).toBe('extract')
    expect(s.resources.heat).toBe(0)
    expect(furnaceActiveLevel(s, 'weapons')).toBe(0)
    expect(furnaceDamageMult(s)).toBe(1)
  })

  it('dumps Ash and Heat on Rebuild', () => {
    let s = armRebuildDoor(createInitialState(0))
    s = atCareerWave(s, ACT1_CADENCE.furnace)
    s.combat.docked = true
    s.resources.choirAsh = 40
    s.resources.heat = 12
    s = setFurnaceChannel(s, 'weapons', 1)
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.resources.choirAsh).toBe(0)
    expect(s.resources.heat).toBe(0)
    expect(furnaceActiveLevel(s, 'weapons')).toBe(0)
  })

  it('does not auto-convert Ash while Docked, including offline', () => {
    let s = furnaceState()
    s.combat.docked = true
    s.resources.choirAsh = 80
    s.resources.heat = 0
    s.lastTickAt = 0
    advanceSeconds(s, 30)
    expect(s.resources.choirAsh).toBe(80)
    expect(s.resources.heat).toBe(0)

    const { state: next } = applyOfflineCatchUp(s, 10 * 60 * 1000)
    expect(next.resources.choirAsh).toBe(80)
    expect(next.resources.heat).toBe(0)
  })

  it('keeps only Weapons, Ward, and Yield as live channels', () => {
    const s = furnaceState()
    expect(furnacePushChannels().map((ch) => ch.name)).toEqual(['Weapons', 'Ward', 'Yield'])
    expect(canSetFurnaceChannel(s, 'foundry', 1).ok).toBe(false)
    expect(canSetFurnaceChannel(s, 'research', 1).ok).toBe(false)
    expect(canSetFurnaceChannel(s, 'network', 1).ok).toBe(false)
  })

  it('exposes Heat reserve, channel preset, and conditional push without auto-feed', () => {
    const s = furnaceState()
    expect(processFurnaceHooks(s).autoFeed).toBe(false)
    expect(processFurnaceHooks(s).conditionalPush).toBe(false)
    s.process.purchased = ['furnace-presets', 'furnace-reserve', 'run-profiles']
    s.process.config.furnace.reserveHeat = 12
    s.process.config.furnace.preset = 'push'
    s.resources.heat = 20
    const hooks = processFurnaceHooks(s)
    expect(hooks.autoFeed).toBe(false)
    expect(hooks.presetsUnlocked).toBe(true)
    expect(hooks.reserveHeat).toBe(12)
    expect(hooks.preset).toBe('push')
    expect(hooks.conditionalPush).toBe(true)
    expect(furnaceSpendableHeat(s)).toBe(8)
  })

  it('Process furnace-push converts Ash but will not spend the Heat reserve', () => {
    const s = furnaceState()
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
  })

  it('Furnace Manager lights the Push preset while leaving the reserve', () => {
    let s = furnaceState()
    s.combat.docked = false
    s.resources.heat = 24
    s.process.purchased = ['furnace-presets', 'furnace-auto']
    s.process.config.furnace.manager = true
    s.process.config.furnace.preset = 'push'
    s.process.config.furnace.reserveHeat = 8
    s.process.purchased.push('furnace-reserve')
    s = runFurnaceManager(s)
    expect(furnaceActiveLevel(s, 'weapons')).toBe(1)
    expect(furnaceActiveLevel(s, 'shielding')).toBe(1)
    expect(s.resources.heat).toBe(8)
    expect(furnaceCombatFx(s)).toEqual({ weapons: true, ward: true, yield: false })
  })
})

describe('GDD onboarding overlay', () => {
  it('is enabled and a docked baseline has no Launch tutorial', () => {
    expect(ONBOARDING_ENABLED).toBe(true)
    const fresh = createInitialState(0)
    expect(activeGuideStep(fresh, 'dock')).toBeNull()
    expect(activeGuideStep(fresh, 'combat')).toBeNull()
    const flying = setDocked(fresh, false)
    expect(activeGuideStep(flying, 'combat')).toBeNull()
    expect(activeGuideStep(flying, 'dock')).toBeNull()
  })
})
