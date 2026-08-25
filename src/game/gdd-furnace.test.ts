import { describe, expect, it } from 'vitest'
import { convertAshToHeat, performRebuild, setFurnaceChannel } from './actions'
import { ACT1_CADENCE } from './cadence'
import {
  ASH_PER_HEAT,
  canBuyFurnaceUpgrade,
  furnaceActiveLevel,
  furnaceAshFromKill,
  furnaceDamageMult,
  furnaceIdleGenPerSec,
  furnaceShieldMult,
  furnaceSalvageMult,
  grantFurnaceKillLoot,
} from './furnace'
import { applyOfflineCatchUp } from './offline'
import { ONBOARDING_ENABLED, activeGuideStep, isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { armRebuildDoor, atCareerWave, markHullLost } from './testHelpers'
import { advanceTicks, setDocked, startCombat } from './tick'

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

  it('dumps Heat and extinguishes channels on Extract', () => {
    let s = furnaceState()
    s = setDocked(s, false)
    s = startCombat(s)
    s.resources.heat = 20
    s = setFurnaceChannel(s, 'weapons', 1)
    expect(furnaceActiveLevel(s, 'weapons')).toBe(1)
    s = setDocked(s, true)
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
    advanceTicks(s, 30)
    expect(s.resources.choirAsh).toBe(80)
    expect(s.resources.heat).toBe(0)

    const { state: next } = applyOfflineCatchUp(s, 10 * 60 * 1000)
    expect(next.resources.choirAsh).toBe(80)
    expect(next.resources.heat).toBe(0)
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
