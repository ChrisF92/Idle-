import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { startCombat } from './tick'
import { simulateCombat } from './combat'
import {
  applyFlakDeathDetonation,
  applyHeavyArmorFracture,
  densestClusterPoint,
  effectiveEnemyArmor,
  flakSplashCount,
  HEAVY_PEN_MOMENTUM,
  HEAVY_SHIELD_BYPASS,
  PHASE_RAMP_MAX,
  PHASE_RAMP_SECONDS,
  phaseRampAtMax,
  phaseRampBypassFrac,
  phaseRampMultiplier,
  pulseChainHops,
  pulseOverkillHop,
  spawnMoltenPool,
  updatePhaseRamp,
} from './coreCombat'
import { hasMasteryEffect } from './coreMastery'
import { getModule } from './catalog'
import { desiredOrbitAngle, switchAdvantageFor } from './coreTargeting'
import { shortestAngleDelta } from './geometry'
import type { CombatUnit, GameState } from './types'

function silent() {
  return () => undefined
}

function withMastery(moduleId: string, level: number): GameState {
  const state = createInitialState(0)
  state.meta.moduleMastery[moduleId] = level
  return state
}

function dummyEnemy(id: string, extra: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id,
    side: 'enemy',
    name: id,
    shape: 'triangle',
    family: 'swarm',
    hull: extra.hull ?? 20,
    hullMax: extra.hullMax ?? 20,
    shield: extra.shield ?? 0,
    shieldMax: extra.shieldMax ?? 0,
    armor: extra.armor ?? 0,
    evasion: 0,
    damageTakenMult: 1,
    weapons: [],
    isBoss: false,
    isFlagship: false,
    dots: [],
    x: extra.x ?? 80,
    y: extra.y ?? 0,
    heading: extra.heading ?? 0,
    speed: extra.speed ?? 20,
    engageRange: 80,
    kite: false,
    phaseWarnLeft: 0,
    ...extra,
  }
}

function dummyCore(moduleId: string): CombatUnit {
  return {
    id: `${moduleId}:1`,
    coreInstanceId: `${moduleId}:1`,
    coreModuleId: moduleId,
    isCore: true,
    side: 'player',
    name: moduleId,
    shape: 'circle',
    family: 'core',
    hull: 0,
    hullMax: 0,
    shield: 0,
    shieldMax: 0,
    armor: 0,
    evasion: 0,
    damageTakenMult: 1,
    weapons: [],
    isBoss: false,
    isFlagship: false,
    dots: [],
    x: 0,
    y: 44,
    orbitAngle: 0,
    heading: 0,
    orbitRadius: 44,
    speed: 0,
    engageRange: 0,
    kite: false,
    phaseWarnLeft: 0,
  }
}

describe('Pulse Cannon Mastery boundaries', () => {
  it('M10 Overkill Retarget works without M30 chain', () => {
    const below = withMastery('pulse-cannon', 9)
    const at = withMastery('pulse-cannon', 10)
    below.combat.enemyUnits = [dummyEnemy('a', { x: 40, y: 0 }), dummyEnemy('b', { x: 50, y: 0 })]
    at.combat.enemyUnits = [dummyEnemy('a', { x: 40, y: 0 }), dummyEnemy('b', { x: 50, y: 0 })]
    expect(hasMasteryEffect(below, 'pulse-cannon', 'pulse-overkill-retarget')).toBe(false)
    expect(hasMasteryEffect(at, 'pulse-cannon', 'pulse-overkill-retarget')).toBe(true)
    expect(pulseChainHops(at, 'pulse-cannon:1')).toBe(0)
    expect(pulseOverkillHop(below, { x: 40, y: 0 }, 8, 'a')).toBeNull()
    expect(pulseOverkillHop(at, { x: 40, y: 0 }, 8, 'a')?.id).toBe('b')
  })

  it('M30 periodic Chain is distinct from M10 and M50 extends it bounded', () => {
    expect(pulseChainHops(withMastery('pulse-cannon', 29), 'pulse-cannon:1')).toBe(0)
    const m30 = withMastery('pulse-cannon', 30)
    expect(pulseChainHops(m30, 'pulse-cannon:1')).toBe(1)
    const m50 = withMastery('pulse-cannon', 50)
    expect(pulseChainHops(m50, 'pulse-cannon:1')).toBe(2)
    const again = pulseChainHops(m50, 'pulse-cannon:1')
    expect(again).toBeLessThanOrEqual(1)
  })

  it('M75 Adaptive Lock raises switch hysteresis', () => {
    const below = startCombat(withMastery('pulse-cannon', 74))
    const at = startCombat(withMastery('pulse-cannon', 75))
    const belowCore = below.combat.playerUnits.find((u) => u.coreModuleId === 'pulse-cannon')!
    const atCore = at.combat.playerUnits.find((u) => u.coreModuleId === 'pulse-cannon')!
    expect(switchAdvantageFor(at, atCore)).toBeGreaterThan(switchAdvantageFor(below, belowCore))
  })

  it('M100 Convergence adds a bounded fork cap', () => {
    const m100 = withMastery('pulse-cannon', 100)
    const m99 = withMastery('pulse-cannon', 99)
    expect(pulseChainHops(m100, 'id-a')).toBeGreaterThan(pulseChainHops(m99, 'id-b'))
    expect(pulseChainHops(withMastery('pulse-cannon', 100), 'fresh')).toBeLessThanOrEqual(4)
  })
})

describe('Heavy Lance Mastery boundaries', () => {
  it('does not author Pierce at M0', () => {
    expect(getModule('heavy-lance')?.weapon?.tags.includes('pierce')).toBe(false)
    expect(hasMasteryEffect(withMastery('heavy-lance', 0), 'heavy-lance', 'heavy-pierce')).toBe(false)
    expect(hasMasteryEffect(withMastery('heavy-lance', 29), 'heavy-lance', 'heavy-pierce')).toBe(false)
    expect(hasMasteryEffect(withMastery('heavy-lance', 30), 'heavy-lance', 'heavy-pierce')).toBe(true)
  })

  it('M10 Predictive Traverse changes the desired orbital solution for a moving target', () => {
    const below = withMastery('heavy-lance', 9)
    const at = withMastery('heavy-lance', 10)
    const core = dummyCore('heavy-lance')
    const target = dummyEnemy('lead', { x: 200, y: 80, heading: 0, speed: 40 })
    below.combat.enemyUnits = [target]
    at.combat.enemyUnits = [target]
    const without = desiredOrbitAngle(below, core, target)
    const withLead = desiredOrbitAngle(at, core, target)
    expect(Math.abs(shortestAngleDelta(without, withLead))).toBeGreaterThan(1e-3)
  })

  it('M50 Shield Bypass is a real fraction, M75 momentum and M100 fracture are bounded', () => {
    expect(HEAVY_SHIELD_BYPASS).toBeGreaterThan(0)
    expect(HEAVY_SHIELD_BYPASS).toBeLessThan(1)
    expect(HEAVY_PEN_MOMENTUM).toBeGreaterThan(0)
    expect(HEAVY_PEN_MOMENTUM).toBeLessThan(1)
    const s = withMastery('heavy-lance', 100)
    const armored = dummyEnemy('tank', { armor: 20, hull: 80, hullMax: 80 })
    s.combat.enemyUnits = [armored]
    expect(effectiveEnemyArmor(s, armored)).toBe(20)
    applyHeavyArmorFracture(s, 4)
    s.combat.simTime = 0.1
    expect(effectiveEnemyArmor(s, armored)).toBeLessThan(20)
  })
})

describe('Flak Array Mastery boundaries', () => {
  it('M30 Fragmentation and M75 Saturation change splash count', () => {
    expect(flakSplashCount(withMastery('flak-array', 29), 2)).toBe(2)
    expect(flakSplashCount(withMastery('flak-array', 30), 2)).toBe(3)
    expect(flakSplashCount(withMastery('flak-array', 75), 2)).toBe(4)
  })

  it('M50 Death Detonation is Flak-sourced and M100 uses the densest cluster', () => {
    const flak = withMastery('flak-array', 50)
    flak.combat.enemyUnits = [
      dummyEnemy('dead', { x: 0, y: 100, hull: 0 }),
      dummyEnemy('near', { x: 10, y: 100, hull: 20, hullMax: 20 }),
    ]
    const near = flak.combat.enemyUnits[1]!
    applyFlakDeathDetonation(flak, flak.combat.enemyUnits[0]!, 10, 'pulse-cannon')
    expect(near.hull).toBe(20)
    applyFlakDeathDetonation(flak, flak.combat.enemyUnits[0]!, 10, 'flak-array')
    expect(near.hull).toBeLessThan(20)
    const box = withMastery('flak-array', 100)
    box.combat.enemyUnits = [
      dummyEnemy('a', { x: 0, y: 0 }),
      dummyEnemy('b', { x: 5, y: 0 }),
      dummyEnemy('c', { x: 200, y: 0 }),
    ]
    const dense = densestClusterPoint(box)
    expect(dense).not.toBeNull()
    expect(Math.hypot(dense!.x, dense!.y)).toBeLessThan(20)
  })
})

describe('Phase Beam Mastery boundaries', () => {
  it('M10 Ramp does not advance from a mere living currentTargetId', () => {
    const s = withMastery('phase-beam', 10)
    const core = dummyCore('phase-beam')
    core.currentTargetId = 'e1'
    s.combat.enemyUnits = [dummyEnemy('e1')]
    updatePhaseRamp(s, core, 2, false)
    expect(phaseRampMultiplier(s, core)).toBe(1)
    updatePhaseRamp(s, core, 2, true)
    expect(phaseRampMultiplier(s, core)).toBeGreaterThan(1)
    expect(phaseRampMultiplier(s, core)).toBeLessThan(PHASE_RAMP_MAX)
  })

  it('M50 Shield Bypass grows with Ramp and M100 Exposure requires max ramp', () => {
    const s = withMastery('phase-beam', 50)
    const core = dummyCore('phase-beam')
    expect(phaseRampBypassFrac(s, core)).toBeGreaterThan(0)
    const low = phaseRampBypassFrac(s, core)
    updatePhaseRamp(s, core, PHASE_RAMP_SECONDS, true)
    const high = phaseRampBypassFrac(s, core)
    expect(high).toBeGreaterThan(low)
    expect(high).toBeLessThan(1)
    const m100 = withMastery('phase-beam', 100)
    const maxCore = dummyCore('phase-beam')
    expect(phaseRampAtMax(m100, maxCore)).toBe(false)
    updatePhaseRamp(m100, maxCore, PHASE_RAMP_SECONDS, true)
    expect(phaseRampAtMax(m100, maxCore)).toBe(true)
  })

  it('M75 Lock Memory keeps only part of Ramp through a brief drop', () => {
    const s = withMastery('phase-beam', 75)
    const core = dummyCore('phase-beam')
    updatePhaseRamp(s, core, PHASE_RAMP_SECONDS, true)
    const peaked = phaseRampMultiplier(s, core)
    updatePhaseRamp(s, core, 0.2, false)
    const remembered = phaseRampMultiplier(s, core)
    expect(remembered).toBeLessThan(peaked)
    expect(remembered).toBeGreaterThan(1)
    updatePhaseRamp(s, core, 8, false)
    expect(phaseRampMultiplier(s, core)).toBeLessThan(remembered)
  })
})

describe('Slag Spitter Mastery boundaries', () => {
  it('does not invent M10 and only Slag origin creates pools', () => {
    expect(hasMasteryEffect(withMastery('slag-spitter', 10), 'slag-spitter', 'slag-molten-pool')).toBe(false)
    const s = withMastery('slag-spitter', 30)
    spawnMoltenPool(s, 10, 10, 'pulse-cannon')
    expect(s.combat.coreRuntime?.moltenPools ?? []).toHaveLength(0)
    spawnMoltenPool(s, 10, 10, 'slag-spitter')
    expect(s.combat.coreRuntime?.moltenPools.length).toBe(1)
    const m75 = withMastery('slag-spitter', 75)
    spawnMoltenPool(m75, 0, 0, 'slag-spitter')
    expect(m75.combat.coreRuntime!.moltenPools[0]!.radius).toBeGreaterThan(35)
    const m100 = withMastery('slag-spitter', 100)
    spawnMoltenPool(m100, 0, 0, 'slag-spitter')
    spawnMoltenPool(m100, 4, 0, 'slag-spitter')
    spawnMoltenPool(m100, 8, 0, 'slag-spitter')
    spawnMoltenPool(m100, 12, 0, 'slag-spitter')
    expect(m100.combat.coreRuntime!.moltenPools.filter((p) => p.until > 0).length).toBeLessThanOrEqual(4)
  })
})

describe('Grav Tether control is non-destructive', () => {
  it('does not permanently mutate authored enemy speed', () => {
    const s = createInitialState(0)
    s.shipyard.unlockedModules.push('grav-tether')
    s.shipyard.coreInstances.push({ id: 'grav-tether:1', moduleId: 'grav-tether' })
    s.shipyard.modules = ['grav-tether']
    s.shipyard.equippedCoreIds = ['grav-tether:1']
    const live = startCombat(s)
    live.combat.enemyUnits = [dummyEnemy('g', { x: 90, y: 0, speed: 24 })]
    const core = live.combat.playerUnits.find((u) => u.coreModuleId === 'grav-tether')
    if (core) core.currentTargetId = 'g'
    const authored = live.combat.enemyUnits[0]!.speed
    simulateCombat(live, 0.4, silent)
    expect(live.combat.enemyUnits[0]!.speed).toBe(authored)
  })
})
