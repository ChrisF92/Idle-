import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { startCombat } from './tick'
import {
  applyFlakDeathDetonation,
  simulateCombat,
} from './combat'
import {
  applyHeavyArmorFracture,
  effectiveEnemyArmor,
  flakSplashCount,
  HEAVY_PEN_MOMENTUM,
  HEAVY_SHIELD_BYPASS,
  nextEnemyAlongHeading,
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
import { CORE_MASTERY_MILESTONES, hasMasteryEffect } from './coreMastery'
import { getModule } from './catalog'
import {
  buildEvalBundle,
  densestLegalFlakCluster,
  desiredOrbitAngle,
  firingSolution,
  playerCoreOutwardFacing,
  scoreDoctrine,
  switchAdvantageFor,
  targetMetricsForCore,
} from './coreTargeting'
import { applyPlayerCoreOrbit, bearingBetween, shortestAngleDelta } from './geometry'
import { ensureSortieStats } from './sortieTelemetry'
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
    sourceWave: extra.sourceWave ?? 1,
    rewardWeight: extra.rewardWeight ?? 1,
    killRewarded: extra.killRewarded,
    targetable: extra.targetable,
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

function fitWeaponSortie(moduleId: string, mastery: number): GameState {
  const state = withMastery(moduleId, mastery)
  if (!state.shipyard.unlockedModules.includes(moduleId)) {
    state.shipyard.unlockedModules = [...state.shipyard.unlockedModules, moduleId]
  }
  if (!state.shipyard.coreInstances.some((row) => row.id === `${moduleId}:1`)) {
    state.shipyard.coreInstances.push({ id: `${moduleId}:1`, moduleId })
  }
  state.shipyard.modules = [moduleId]
  state.shipyard.equippedCoreIds = [`${moduleId}:1`]
  return startCombat(state)
}

function fireHeavyLance(mastery: number) {
  const state = fitWeaponSortie('heavy-lance', mastery)
  const core = state.combat.playerUnits.find((u) => u.coreModuleId === 'heavy-lance')!
  core.orbitAngle = 0
  applyPlayerCoreOrbit(core)
  const range = getModule('heavy-lance')!.weapon!.range
  state.combat.enemyUnits = [
    dummyEnemy('siege', {
      x: Math.sin(core.orbitAngle ?? 0) * range * 0.5,
      y: Math.cos(core.orbitAngle ?? 0) * range * 0.5,
      hull: 400,
      hullMax: 400,
      armor: 8,
    }),
  ]
  core.currentTargetId = 'siege'
  const weapon = core.weapons[0]!
  weapon.cooldownLeft = 0
  weapon.telegraphLeft = 0
  weapon.chargeReady = true
  simulateCombat(state, 1 / 30, silent)
  return state.combat.projectiles.find((shot) => shot.sourceModuleId === 'heavy-lance')
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

  it('M29 vs M30: only M30 fires a pierce-tagged Heavy Lance shot', () => {
    const below = fireHeavyLance(29)
    const at = fireHeavyLance(30)
    expect(below?.tags.includes('pierce')).toBe(false)
    expect(at?.tags.includes('pierce')).toBe(true)
    expect(at?.originX).toBeCloseTo(0)
    expect(at?.originY).toBeGreaterThan(20)
  })

  it('M75 Penetration Momentum damages a hull behind the shot path', () => {
    const s = withMastery('heavy-lance', 75)
    const primary = dummyEnemy('front', { x: 80, y: 0, hull: 40, hullMax: 40 })
    const behind = dummyEnemy('rear', { x: 120, y: 0, hull: 40, hullMax: 40 })
    s.combat.enemyUnits = [primary, behind]
    expect(nextEnemyAlongHeading(s, primary, bearingBetween(primary, behind), primary.id)?.id).toBe('rear')
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

  it('M50 Death Detonation is Flak-sourced and M100 requires a legal cluster', () => {
    const flak = fitWeaponSortie('flak-array', 50)
    const core = flak.combat.playerUnits.find((u) => u.coreModuleId === 'flak-array')!
    core.orbitAngle = 0
    applyPlayerCoreOrbit(core)
    flak.combat.enemyUnits = [
      dummyEnemy('dead', { x: 0, y: 90, hull: 0 }),
      dummyEnemy('near', { x: 10, y: 90, hull: 20, hullMax: 20 }),
    ]
    const near = flak.combat.enemyUnits[1]!
    applyFlakDeathDetonation(flak, flak.combat.enemyUnits[0]!, 10, 'pulse-cannon', core.id)
    expect(near.hull).toBe(20)
    applyFlakDeathDetonation(flak, flak.combat.enemyUnits[0]!, 10, 'flak-array', core.id)
    expect(near.hull).toBeLessThan(20)
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

  it('M29 vs M30: refraction glances only after M30 during legal beam contact', () => {
    function beamTick(mastery: number) {
      const state = fitWeaponSortie('phase-beam', mastery)
      const core = state.combat.playerUnits.find((u) => u.coreModuleId === 'phase-beam')!
      core.orbitAngle = 0
      applyPlayerCoreOrbit(core)
      state.combat.enemyUnits = [
        dummyEnemy('primary', { x: 0, y: 90, hull: 80, hullMax: 80 }),
        dummyEnemy('glance', { x: 18, y: 90, hull: 80, hullMax: 80 }),
      ]
      core.currentTargetId = 'primary'
      state.combat.beams = [
        {
          id: 'beam-test',
          fromId: core.id,
          toId: 'primary',
          side: 'player',
          tag: 'energy',
          tags: ['energy'],
          remaining: 1,
          duration: 1,
          damage: 40,
          attackerFamily: 'core',
          sourceModuleId: 'phase-beam',
        },
      ]
      simulateCombat(state, 0.25, silent)
      const glance = state.combat.enemyUnits.find((u) => u.id === 'glance')!
      const primary = state.combat.enemyUnits.find((u) => u.id === 'primary')!
      return { glance, primary }
    }
    const below = beamTick(29)
    const at = beamTick(30)
    expect(below.primary.hull).toBeLessThan(80)
    expect(below.glance.hull).toBe(80)
    expect(at.primary.hull).toBeLessThan(80)
    expect(at.glance.hull).toBeLessThan(80)
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
    spawnMoltenPool(s, 10, 10)
    expect(s.combat.coreRuntime?.moltenPools ?? []).toHaveLength(0)
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

function killsOf(state: GameState): number {
  return ensureSortieStats(state).kills
}

describe('Heavy M10 predictive traverse vs stabilisation', () => {
  it('leads a lateral target, stays outward-facing, and still starts charge', () => {
    function run(mastery: number) {
      const state = fitWeaponSortie('heavy-lance', mastery)
      const core = state.combat.playerUnits.find((u) => u.coreModuleId === 'heavy-lance')!
      core.orbitAngle = 0
      applyPlayerCoreOrbit(core)
      const target = dummyEnemy('strafe', {
        x: 0,
        y: 180,
        heading: Math.PI / 2,
        speed: 80,
        engageRange: 180,
        kite: true,
        hull: 400,
        hullMax: 400,
        weapons: [],
      })
      state.combat.enemyUnits = [target]
      core.currentTargetId = 'strafe'
      for (const weapon of core.weapons) {
        weapon.cooldownLeft = 0
        weapon.telegraphLeft = 0
        weapon.chargeReady = false
      }
      const dt = 1 / 30
      for (let i = 0; i < 45; i += 1) {
        target.x += Math.sin(target.heading ?? 0) * target.speed * dt
        target.y += Math.cos(target.heading ?? 0) * target.speed * dt
        target.engageRange = Math.hypot(target.x, target.y)
        simulateCombat(state, dt, silent)
        expect(playerCoreOutwardFacing(core)).toBeCloseTo(core.orbitAngle ?? 0, 5)
        expect(core.heading).toBeCloseTo(core.orbitAngle ?? 0, 5)
      }
      return { state, core, target, sol: firingSolution(state, core, target) }
    }
    const m9 = run(9)
    const m10 = run(10)
    expect(m9.sol.canStartCharge || m9.core.weapons[0]!.telegraphLeft > 0 || m9.core.weapons[0]!.chargeReady).toBe(
      true,
    )
    const m10Lead = Math.abs(
      shortestAngleDelta(desiredOrbitAngle(m10.state, m10.core, m10.target), hiveBearingNow(m10.target)),
    )
    expect(m10Lead).toBeGreaterThan(1e-3)
    expect(Math.abs(shortestAngleDelta(m10.core.orbitAngle ?? 0, desiredOrbitAngle(m10.state, m10.core, m10.target)))).toBeLessThan(
      Math.abs(shortestAngleDelta(m9.core.orbitAngle ?? 0, desiredOrbitAngle(m10.state, m10.core, m10.target))) + 0.2,
    )
    expect(m10.sol.inArc).toBe(true)
    expect(m10.sol.inFireRange).toBe(true)
    expect(m10.sol.canStartCharge || m10.core.weapons[0]!.telegraphLeft > 0 || m10.core.weapons[0]!.chargeReady).toBe(
      true,
    )
  })
})

function hiveBearingNow(target: CombatUnit): number {
  return Math.atan2(target.x, target.y)
}

describe('Secondary Mastery kill accounting', () => {
  it('Pulse M10 overkill secondary kill pays once', () => {
    const state = fitWeaponSortie('pulse-cannon', 10)
    const core = state.combat.playerUnits.find((u) => u.coreModuleId === 'pulse-cannon')!
    core.orbitAngle = 0
    applyPlayerCoreOrbit(core)
    state.combat.enemyUnits = [
      dummyEnemy('primary', { x: 0, y: 90, hull: 4, hullMax: 4, armor: 6 }),
      dummyEnemy('hop', { x: 12, y: 90, hull: 6, hullMax: 6 }),
    ]
    const salvage0 = state.resources.salvage
    const kills0 = killsOf(state)
    state.combat.projectiles = [
      {
        id: 'pulse-shot',
        fromId: core.id,
        toId: 'primary',
        side: 'player',
        tag: 'kinetic',
        tags: ['kinetic'],
        x: 0,
        y: 90,
        damage: 40,
        speed: 400,
        attackerFamily: 'core',
        delivery: 'projectile',
        originX: core.x,
        originY: core.y,
        heading: 0,
        sourceModuleId: 'pulse-cannon',
        hullDamage: 1,
        shieldDamage: 1,
        armorDamage: 0.25,
        dotDuration: 0,
        dotDamage: 0,
      },
    ]
    simulateCombat(state, 1 / 30, silent)
    expect(state.combat.enemyUnits.find((u) => u.id === 'primary')?.hull ?? 0).toBe(0)
    expect(state.combat.enemyUnits.find((u) => u.id === 'hop')?.hull ?? 0).toBe(0)
    expect(killsOf(state)).toBe(kills0 + 2)
    expect(state.resources.salvage).toBeGreaterThan(salvage0)
    const salvage1 = state.resources.salvage
    const kills1 = killsOf(state)
    simulateCombat(state, 1 / 30, silent)
    expect(killsOf(state)).toBe(kills1)
    expect(state.resources.salvage).toBe(salvage1)
  })

  it('Heavy M75 penetration secondary kill pays once', () => {
    const state = fitWeaponSortie('heavy-lance', 75)
    const core = state.combat.playerUnits.find((u) => u.coreModuleId === 'heavy-lance')!
    core.orbitAngle = 0
    applyPlayerCoreOrbit(core)
    state.combat.enemyUnits = [
      dummyEnemy('front', { x: 0, y: 90, hull: 8, hullMax: 8 }),
      dummyEnemy('rear', { x: 0, y: 130, hull: 4, hullMax: 4 }),
    ]
    const salvage0 = state.resources.salvage
    const kills0 = killsOf(state)
    state.combat.projectiles = [
      {
        id: 'lance-shot',
        fromId: core.id,
        toId: 'front',
        side: 'player',
        tag: 'kinetic',
        tags: ['kinetic', 'pierce'],
        x: 0,
        y: 90,
        damage: 30,
        speed: 400,
        attackerFamily: 'core',
        delivery: 'projectile',
        originX: core.x,
        originY: core.y,
        heading: bearingBetween({ x: 0, y: 90 }, { x: 0, y: 130 }),
        sourceModuleId: 'heavy-lance',
        hullDamage: 1,
        shieldDamage: 1,
        armorDamage: 1,
        dotDuration: 0,
        dotDamage: 0,
      },
    ]
    simulateCombat(state, 1 / 30, silent)
    expect(state.combat.enemyUnits.find((u) => u.id === 'rear')?.hull ?? 0).toBe(0)
    expect(killsOf(state)).toBeGreaterThanOrEqual(kills0 + 1)
    expect(state.resources.salvage).toBeGreaterThan(salvage0)
    const salvage1 = state.resources.salvage
    const kills1 = killsOf(state)
    simulateCombat(state, 1 / 30, silent)
    expect(killsOf(state)).toBe(kills1)
    expect(state.resources.salvage).toBe(salvage1)
  })

  it('Flak M50 death detonation secondary kill pays once and respects Shield', () => {
    const state = fitWeaponSortie('flak-array', 50)
    const core = state.combat.playerUnits.find((u) => u.coreModuleId === 'flak-array')!
    core.orbitAngle = 0
    applyPlayerCoreOrbit(core)
    const dead = dummyEnemy('dead', { x: 0, y: 90, hull: 0, hullMax: 8 })
    const victim = dummyEnemy('splash', { x: 8, y: 90, hull: 3, hullMax: 3 })
    state.combat.enemyUnits = [dead, victim]
    const salvage0 = state.resources.salvage
    const kills0 = killsOf(state)
    applyFlakDeathDetonation(state, dead, 40, 'flak-array', core.id)
    expect(victim.hull).toBe(0)
    expect(killsOf(state)).toBe(kills0 + 1)
    expect(state.resources.salvage).toBeGreaterThan(salvage0)
    const salvage1 = state.resources.salvage
    applyFlakDeathDetonation(state, dead, 40, 'flak-array', core.id)
    simulateCombat(state, 1 / 30, silent)
    expect(killsOf(state)).toBe(kills0 + 1)
    expect(state.resources.salvage).toBe(salvage1)

    const shielded = fitWeaponSortie('flak-array', 50)
    const sCore = shielded.combat.playerUnits.find((u) => u.coreModuleId === 'flak-array')!
    sCore.orbitAngle = 0
    applyPlayerCoreOrbit(sCore)
    const ward = dummyEnemy('ward', { x: 8, y: 90, hull: 20, hullMax: 20, shield: 30, shieldMax: 30 })
    shielded.combat.enemyUnits = [dummyEnemy('dead2', { x: 0, y: 90, hull: 0 }), ward]
    applyFlakDeathDetonation(shielded, shielded.combat.enemyUnits[0]!, 20, 'flak-array', sCore.id)
    expect(ward.hull).toBe(20)
    expect(ward.shield).toBeLessThan(30)
  })

  it('Phase M30 refraction secondary kill pays once', () => {
    const state = fitWeaponSortie('phase-beam', 30)
    const core = state.combat.playerUnits.find((u) => u.coreModuleId === 'phase-beam')!
    core.orbitAngle = 0
    applyPlayerCoreOrbit(core)
    state.combat.enemyUnits = [
      dummyEnemy('primary', { x: 0, y: 90, hull: 80, hullMax: 80 }),
      dummyEnemy('glance', { x: 16, y: 90, hull: 2, hullMax: 2 }),
    ]
    core.currentTargetId = 'primary'
    const salvage0 = state.resources.salvage
    const kills0 = killsOf(state)
    state.combat.beams = [
      {
        id: 'beam-kill',
        fromId: core.id,
        toId: 'primary',
        side: 'player',
        tag: 'energy',
        tags: ['energy'],
        remaining: 1,
        duration: 1,
        damage: 80,
        attackerFamily: 'core',
        sourceModuleId: 'phase-beam',
      },
    ]
    simulateCombat(state, 0.4, silent)
    expect(state.combat.enemyUnits.find((u) => u.id === 'glance')?.hull ?? 0).toBe(0)
    expect(killsOf(state)).toBe(kills0 + 1)
    expect(state.resources.salvage).toBeGreaterThan(salvage0)
    const salvage1 = state.resources.salvage
    const kills1 = killsOf(state)
    simulateCombat(state, 0.4, silent)
    expect(killsOf(state)).toBe(kills1)
    expect(state.resources.salvage).toBe(salvage1)
  })

  it('Slag pool secondary kill pays once and respects Shield', () => {
    const state = fitWeaponSortie('slag-spitter', 30)
    state.combat.enemyUnits = [dummyEnemy('burn', { x: 0, y: 80, hull: 1, hullMax: 1 })]
    spawnMoltenPool(state, 0, 80, 'slag-spitter')
    const salvage0 = state.resources.salvage
    const kills0 = killsOf(state)
    simulateCombat(state, 1, silent)
    expect(state.combat.enemyUnits.find((u) => u.id === 'burn')?.hull ?? 0).toBe(0)
    expect(killsOf(state)).toBe(kills0 + 1)
    expect(state.resources.salvage).toBeGreaterThan(salvage0)
    const salvage1 = state.resources.salvage
    simulateCombat(state, 1, silent)
    expect(killsOf(state)).toBe(kills0 + 1)
    expect(state.resources.salvage).toBe(salvage1)

    const shielded = fitWeaponSortie('slag-spitter', 30)
    const ward = dummyEnemy('slag-ward', { x: 0, y: 80, hull: 20, hullMax: 20, shield: 12, shieldMax: 12 })
    shielded.combat.enemyUnits = [ward]
    spawnMoltenPool(shielded, 0, 80, 'slag-spitter')
    simulateCombat(shielded, 0.8, silent)
    expect(ward.hull).toBe(20)
    expect(ward.shield).toBeLessThan(12)
  })
})

describe('Flak M10/M100 scoping', () => {
  it('does not rewrite another Core Cluster score when Flak is mastered but unequipped', () => {
    const moving = [
      dummyEnemy('a', { x: 0, y: 100, heading: Math.PI / 2, speed: 100 }),
      dummyEnemy('b', { x: 80, y: 100, heading: -Math.PI / 2, speed: 100 }),
    ]
    const slagOnly = fitWeaponSortie('slag-spitter', 0)
    slagOnly.meta.moduleMastery['flak-array'] = 10
    slagOnly.combat.enemyUnits = moving.map((row) => ({ ...row }))
    const slagCore = slagOnly.combat.playerUnits.find((u) => u.coreModuleId === 'slag-spitter')!
    const baseline = fitWeaponSortie('slag-spitter', 0)
    baseline.combat.enemyUnits = moving.map((row) => ({ ...row }))
    const baseCore = baseline.combat.playerUnits.find((u) => u.coreModuleId === 'slag-spitter')!
    const slagBundle = buildEvalBundle(slagOnly, slagOnly.combat.enemyUnits)
    const baseBundle = buildEvalBundle(baseline, baseline.combat.enemyUnits)
    const slagScore = scoreDoctrine(
      'cluster',
      slagOnly.combat.enemyUnits[0]!,
      targetMetricsForCore(slagOnly, slagBundle, slagCore, slagOnly.combat.enemyUnits[0]!)!,
    )
    const baseScore = scoreDoctrine(
      'cluster',
      baseline.combat.enemyUnits[0]!,
      targetMetricsForCore(baseline, baseBundle, baseCore, baseline.combat.enemyUnits[0]!)!,
    )
    expect(slagScore).toBeCloseTo(baseScore)

    const flak = fitWeaponSortie('flak-array', 10)
    flak.combat.enemyUnits = moving.map((row) => ({ ...row }))
    const flakCore = flak.combat.playerUnits.find((u) => u.coreModuleId === 'flak-array')!
    const flakBundle = buildEvalBundle(flak, flak.combat.enemyUnits)
    const flakMetrics = targetMetricsForCore(flak, flakBundle, flakCore, flak.combat.enemyUnits[0]!)!
    const slagMetrics = targetMetricsForCore(
      slagOnly,
      slagBundle,
      slagCore,
      slagOnly.combat.enemyUnits[0]!,
    )!
    expect(flakMetrics.clusterCount).toBeGreaterThan(slagMetrics.clusterCount)
  })

  it('Kill Box only selects a cluster inside legal Flak range and arc', () => {
    const state = fitWeaponSortie('flak-array', 100)
    const core = state.combat.playerUnits.find((u) => u.coreModuleId === 'flak-array')!
    core.orbitAngle = 0
    applyPlayerCoreOrbit(core)
    state.combat.enemyUnits = [
      dummyEnemy('legal-a', { x: 0, y: 90 }),
      dummyEnemy('legal-b', { x: 8, y: 90 }),
      dummyEnemy('far-a', { x: 0, y: -240 }),
      dummyEnemy('far-b', { x: 8, y: -240 }),
      dummyEnemy('far-c', { x: 16, y: -240 }),
    ]
    const chosen = densestLegalFlakCluster(state, core)!
    expect(chosen.y).toBeGreaterThan(0)
    expect(Math.hypot(chosen.x, chosen.y)).toBeLessThan(120)
  })

  it('skips untargetable enemies for Pulse overkill and Phase glance', () => {
    const pulse = withMastery('pulse-cannon', 10)
    pulse.combat.enemyUnits = [
      dummyEnemy('veiled', { x: 40, y: 0, targetable: false }),
      dummyEnemy('open', { x: 50, y: 0 }),
    ]
    expect(pulseOverkillHop(pulse, { x: 40, y: 0 }, 8, 'dead')?.id).toBe('open')
  })
})

describe('Pending defense/utility milestone names', () => {
  it('does not attach unauthored later behaviours to framework thresholds', () => {
    const forbidden = /Impact Bracing|Bypass Protection|Regen Ramp|Twin Tether|Predictive Solution|Elite Bounty|Small-Hit|Break Pulse|Ablative Layer/
    for (const rows of Object.values(CORE_MASTERY_MILESTONES)) {
      for (const ms of rows) {
        if (!ms.pending || ms.level === 5) continue
        expect(ms.effect).toBeUndefined()
        expect(ms.name.startsWith('Pending M')).toBe(true)
        expect(ms.name).not.toMatch(forbidden)
      }
    }
  })
})
