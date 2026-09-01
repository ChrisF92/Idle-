import { afterEach, describe, expect, it } from 'vitest'
import { setCoreTargetingDoctrine, unfitModule } from './actions'
import { addCoreInstance } from './coreInstances'
import { buildPlayerFleet, simulateCombat } from './combat'
import {
  ACQUISITION_FIRE_GAP,
  ACQUISITION_RETENTION,
  applyTargetingStats,
  beatsHysteresis,
  buildEvalBundle,
  buildSharedTargetMetrics,
  canConfigureTargetingDoctrine,
  canEditTargetingNow,
  clearCoreTarget,
  compareTargetTie,
  combatOverlayGeometry,
  effectiveChargeDurationSec,
  effectiveCoreAcquisitionRange,
  effectiveCoreFireRange,
  effectiveCoreFiringArc,
  effectiveCoreSlewRate,
  effectiveCoreTargetingDoctrine,
  emptyTargetingTelemetry,
  enableFireControlDoctrineForTests,
  evaluateCoreTarget,
  FIRE_CONTROL_DOCTRINE_RESEARCH_ID,
  firingSolution,
  HYSTERESIS_ABSOLUTE_FLOOR,
  isTargetableEnemy,
  isTargetingCapableCoreModule,
  pickBestTarget,
  playerCoreTarget,
  scoreDoctrine,
  setCoreTarget,
  switchRequiredGain,
  TARGET_EVAL_INTERVAL,
  tickPlayerCoreTargeting,
} from './coreTargeting'
import { targetingProfileFor } from './targetingProfiles'
import { KNIFE_FIGHT_RANGE_CAP } from './challenges'
import { applyPlayerCoreOrbit, bearingBetween, degToRad, distanceBetween, hiveBearingOf, playerCoreOutwardFacing, radToDeg, shortestAngleDelta, slewHeading, wrapTau } from './geometry'
import { createInitialState, SAVE_KEY, SAVE_VERSION } from './state'
import { loadOrCreateGame, saveGame } from './save'
import { advanceSeconds, setSortiePaused, startCombat } from './tick'
import type { CombatUnit, GameState, TargetingDoctrineId } from './types'

function silent() {
  return () => undefined
}

function enemy(partial: Partial<CombatUnit> & { id: string; x: number; y: number }): CombatUnit {
  return {
    side: 'enemy',
    name: partial.name ?? partial.id,
    shape: 'triangle',
    family: partial.family ?? 'swarm',
    hull: partial.hull ?? 40,
    hullMax: partial.hullMax ?? 40,
    shield: partial.shield ?? 0,
    shieldMax: partial.shieldMax ?? 0,
    armor: partial.armor ?? 0,
    evasion: 0,
    damageTakenMult: 1,
    weapons: partial.weapons ?? [
      {
        id: `${partial.id}-gun`,
        name: 'Sting',
        damage: partial.weapons?.[0]?.damage ?? 4,
        cooldown: 1,
        cooldownLeft: 1,
        range: 80,
        tags: ['kinetic'],
        splash: 0,
        dotDuration: 0,
        dotDamage: 0,
        telegraphDuration: 0,
        telegraphLeft: 0,
      },
    ],
    isBoss: partial.isBoss ?? false,
    isFlagship: false,
    dots: [],
    speed: partial.speed ?? 20,
    engageRange: partial.engageRange ?? 80,
    kite: false,
    phaseWarnLeft: 0,
    sourceWave: partial.sourceWave ?? 1,
    role: partial.role,
    targetable: partial.targetable,
    ...partial,
  }
}

function pulseSortie(seed = 3): GameState {
  const state = startCombat(createInitialState(seed))
  for (const unit of state.combat.playerUnits) {
    for (const weapon of unit.weapons) {
      weapon.damage = 0
      weapon.cooldownLeft = 4
    }
  }
  return state
}

function pulseCore(state: GameState): CombatUnit {
  const core = state.combat.playerUnits.find((u) => u.isCore && u.coreModuleId === 'pulse-cannon')
  if (!core) throw new Error('missing pulse core')
  return core
}

function setEnemies(state: GameState, units: CombatUnit[]): void {
  state.combat.enemyUnits = units
}

function evalNow(state: GameState): void {
  for (const core of state.combat.playerUnits) {
    if (core.isCore) core.nextTargetEvalAt = 0
  }
  tickPlayerCoreTargeting(state, 0)
}

afterEach(() => {
  localStorage.removeItem(SAVE_KEY)
})

describe('canonical targeting profiles', () => {
  it('uses authored defaults and allowed Doctrine sets', () => {
    expect(targetingProfileFor('pulse-cannon').defaultDoctrine).toBe('threat')
    expect(targetingProfileFor('pulse-cannon').allowedDoctrines).toEqual(['threat', 'focus', 'execution', 'shield'])
    expect(targetingProfileFor('heavy-lance').defaultDoctrine).toBe('heavy')
    expect(targetingProfileFor('heavy-lance').allowedDoctrines).toEqual(['heavy', 'focus', 'shield', 'threat'])
    expect(targetingProfileFor('flak-array').defaultDoctrine).toBe('cluster')
    expect(targetingProfileFor('flak-array').allowedDoctrines).toEqual(['cluster', 'threat', 'execution'])
    expect(targetingProfileFor('phase-beam').defaultDoctrine).toBe('focus')
    expect(targetingProfileFor('phase-beam').allowedDoctrines).toEqual(['focus', 'heavy', 'shield'])
    expect(targetingProfileFor('slag-spitter').defaultDoctrine).toBe('cluster')
    expect(targetingProfileFor('slag-spitter').allowedDoctrines).toEqual(['cluster', 'heavy', 'threat'])
  })

  it('restores the approved PR2 targeting seeds', () => {
    const pulse = targetingProfileFor('pulse-cannon')
    expect(pulse.fireRange).toBe(170)
    expect(pulse.acquisitionRange).toBe(240)
    expect(pulse.firingArcDeg).toBe(150)
    expect(pulse.slewRateDegPerSec).toBe(360)
    expect(pulse.switchAdvantage).toBe(0.25)
    expect(pulse.firesWhileTraversing).toBe(true)

    const heavy = targetingProfileFor('heavy-lance')
    expect(heavy.fireRange).toBe(260)
    expect(heavy.acquisitionRange).toBe(380)
    expect(heavy.firingArcDeg).toBe(100)
    expect(heavy.slewRateDegPerSec).toBe(120)
    expect(heavy.switchAdvantage).toBe(0.45)
    expect(heavy.aimToleranceDeg).toBe(4)
    expect(heavy.chargeDurationSec).toBe(2.8)
    expect(heavy.firesWhileTraversing).toBe(false)

    const flak = targetingProfileFor('flak-array')
    expect(flak.fireRange).toBe(145)
    expect(flak.acquisitionRange).toBe(210)
    expect(flak.firingArcDeg).toBe(220)
    expect(flak.slewRateDegPerSec).toBe(540)
    expect(flak.switchAdvantage).toBe(0.1)
    expect(flak.firesWhileTraversing).toBe(true)

    const phase = targetingProfileFor('phase-beam')
    expect(phase.fireRange).toBe(220)
    expect(phase.acquisitionRange).toBe(310)
    expect(phase.firingArcDeg).toBe(135)
    expect(phase.slewRateDegPerSec).toBe(180)
    expect(phase.switchAdvantage).toBe(0.6)
    expect(phase.committedSwitchAdvantage).toBe(0.65)
    expect(phase.aimToleranceDeg).toBe(6)
    expect(phase.firesWhileTraversing).toBe(false)
    expect(phase.switchAdvantage).toBeGreaterThan(heavy.switchAdvantage)

    const slag = targetingProfileFor('slag-spitter')
    expect(slag.fireRange).toBe(180)
    expect(slag.acquisitionRange).toBe(250)
    expect(slag.firingArcDeg).toBe(175)
    expect(slag.slewRateDegPerSec).toBe(300)
    expect(slag.switchAdvantage).toBe(0.2)
    expect(slag.firesWhileTraversing).toBe(true)
  })

  it('falls back to authored default when stored Doctrine is invalid', () => {
    const state = createInitialState(0)
    const inst = state.shipyard.coreInstances.find((row) => row.moduleId === 'pulse-cannon')!
    inst.targetingDoctrine = 'cluster'
    expect(effectiveCoreTargetingDoctrine(state, { moduleId: 'pulse-cannon', coreInstanceId: inst.id })).toBe(
      'threat',
    )
  })
})

describe('persistent targeting', () => {
  it('acquires a valid target and keeps it across cooldowns', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [enemy({ id: 'a', x: 0, y: 180, hull: 80, hullMax: 80 })])
    evalNow(state)
    expect(core.currentTargetId).toBe('a')
    const first = core.currentTargetId
    core.weapons[0]!.cooldownLeft = 0
    simulateCombat(state, 0.2, silent)
    core.weapons[0]!.cooldownLeft = 0
    simulateCombat(state, 0.2, silent)
    expect(core.currentTargetId).toBe(first)
  })

  it('does not switch a Pulse target for a ~10% better candidate', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    const current = enemy({
      id: 'hold',
      x: 40,
      y: 160,
      hull: 50,
      hullMax: 50,
      weapons: [
        {
          id: 'hold-g',
          name: 'g',
          damage: 10,
          cooldown: 1,
          cooldownLeft: 1,
          range: 80,
          tags: ['kinetic'],
          splash: 0,
          dotDuration: 0,
          dotDamage: 0,
          telegraphDuration: 0,
          telegraphLeft: 0,
        },
      ],
    })
    const better = enemy({
      id: 'nudge',
      x: 40,
      y: 155,
      hull: 50,
      hullMax: 50,
      weapons: [
        {
          id: 'nudge-g',
          name: 'g',
          damage: 11,
          cooldown: 1,
          cooldownLeft: 1,
          range: 80,
          tags: ['kinetic'],
          splash: 0,
          dotDuration: 0,
          dotDamage: 0,
          telegraphDuration: 0,
          telegraphLeft: 0,
        },
      ],
    })
    setEnemies(state, [current, better])
    core.currentTargetId = 'hold'
    const bundle = buildEvalBundle(state, state.combat.enemyUnits)
    const sHold = scoreDoctrine('threat', current, bundle.metrics.get('hold')!)
    const sNudge = scoreDoctrine('threat', better, bundle.metrics.get('nudge')!)
    expect(sNudge).toBeGreaterThan(sHold)
    expect(sNudge / sHold).toBeLessThan(1.25)
    evaluateCoreTarget(state, core, bundle)
    expect(core.currentTargetId).toBe('hold')
  })

  it('switches when a candidate beats Pulse hysteresis', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    const weak = enemy({
      id: 'weak',
      x: 0,
      y: 220,
      hull: 80,
      hullMax: 80,
      speed: 4,
      weapons: [
        {
          id: 'w',
          name: 'g',
          damage: 1,
          cooldown: 3,
          cooldownLeft: 1,
          range: 40,
          tags: ['kinetic'],
          splash: 0,
          dotDuration: 0,
          dotDamage: 0,
          telegraphDuration: 0,
          telegraphLeft: 0,
        },
      ],
    })
    const hot = enemy({
      id: 'hot',
      x: 10,
      y: 90,
      hull: 40,
      hullMax: 40,
      speed: 40,
      weapons: [
        {
          id: 'h',
          name: 'g',
          damage: 18,
          cooldown: 0.6,
          cooldownLeft: 1,
          range: 80,
          tags: ['kinetic'],
          splash: 0,
          dotDuration: 0,
          dotDamage: 0,
          telegraphDuration: 0,
          telegraphLeft: 0,
        },
      ],
    })
    setEnemies(state, [weak, hot])
    core.currentTargetId = 'weak'
    evalNow(state)
    expect(core.currentTargetId).toBe('hot')
  })

  it('clears a dead target immediately', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [enemy({ id: 'dead', x: 0, y: 120, hull: 0, hullMax: 40 })])
    core.currentTargetId = 'dead'
    tickPlayerCoreTargeting(state, 1 / 30)
    expect(core.currentTargetId).toBeUndefined()
  })

  it('drops a target past acquisition retention and keeps one outside fire but inside acquire', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    const acquire = effectiveCoreAcquisitionRange(state, core)
    const fire = effectiveCoreFireRange(state, core)
    setEnemies(state, [
      enemy({
        id: 'far',
        x: core.x,
        y: core.y + acquire * ACQUISITION_RETENTION + 40,
      }),
    ])
    core.currentTargetId = 'far'
    tickPlayerCoreTargeting(state, 1 / 30)
    expect(core.currentTargetId).toBeUndefined()

    setEnemies(state, [
      enemy({
        id: 'mid',
        x: core.x,
        y: core.y + (fire + acquire) / 2,
      }),
    ])
    evalNow(state)
    expect(core.currentTargetId).toBe('mid')
    expect(distanceBetween(core, state.combat.enemyUnits[0]!)).toBeGreaterThan(fire)
    expect(distanceBetween(core, state.combat.enemyUnits[0]!)).toBeLessThan(acquire)
  })
})

describe('Doctrine scoring', () => {
  function scores(state: GameState, doctrine: TargetingDoctrineId) {
    const enemies = state.combat.enemyUnits
    const metrics = buildSharedTargetMetrics(state, enemies)
    return Object.fromEntries(
      enemies.map((u) => [u.id, scoreDoctrine(doctrine, u, metrics.get(u.id)!)]),
    )
  }

  it('Threat prefers near-term danger over a harmless alternative', () => {
    const state = pulseSortie()
    setEnemies(state, [
      enemy({
        id: 'harmless',
        x: 0,
        y: 200,
        speed: 4,
        weapons: [
          {
            id: 'hh',
            name: 'g',
            damage: 1,
            cooldown: 4,
            cooldownLeft: 1,
            range: 40,
            tags: ['kinetic'],
            splash: 0,
            dotDuration: 0,
            dotDamage: 0,
            telegraphDuration: 0,
            telegraphLeft: 0,
          },
        ],
      }),
      enemy({
        id: 'danger',
        x: 20,
        y: 90,
        speed: 40,
        weapons: [
          {
            id: 'dd',
            name: 'g',
            damage: 16,
            cooldown: 0.7,
            cooldownLeft: 1,
            range: 80,
            tags: ['kinetic'],
            splash: 0,
            dotDuration: 0,
            dotDamage: 0,
            telegraphDuration: 0,
            telegraphLeft: 0,
          },
        ],
      }),
    ])
    const s = scores(state, 'threat')
    expect(s.danger).toBeGreaterThan(s.harmless)
  })

  it('Focus prefers OTHER allied commitment and falls back to Threat without self-vote', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [
      enemy({ id: 'marked', x: 0, y: 140 }),
      enemy({
        id: 'other',
        x: 30,
        y: 90,
        weapons: [
          {
            id: 'og',
            name: 'g',
            damage: 20,
            cooldown: 0.5,
            cooldownLeft: 1,
            range: 80,
            tags: ['kinetic'],
            splash: 0,
            dotDuration: 0,
            dotDamage: 0,
            telegraphDuration: 0,
            telegraphLeft: 0,
          },
        ],
      }),
    ])
    core.currentTargetId = 'marked'
    const inst = state.shipyard.coreInstances.find((row) => row.moduleId === 'pulse-cannon')!
    inst.targetingDoctrine = 'focus'
    enableFireControlDoctrineForTests(state)
    state.hiveResearch.completedIds = [...new Set([...(state.hiveResearch.completedIds ?? []), FIRE_CONTROL_DOCTRINE_RESEARCH_ID])]
    const hive = state.combat.playerUnits.find((u) => u.isFlagship)!
    const ally: CombatUnit = {
      ...core,
      id: 'pulse-cannon:2',
      coreInstanceId: 'pulse-cannon:2',
      currentTargetId: 'marked',
      targetingTelemetry: emptyTargetingTelemetry(),
      weapons: core.weapons.map((w) => ({ ...w, id: `${w.id}-ally` })),
    }
    state.combat.playerUnits = [hive, core, ally]
    const metrics = buildSharedTargetMetrics(state, state.combat.enemyUnits)
    const bundle = buildEvalBundle(state, state.combat.enemyUnits)
    const picked = pickBestTarget(state, core, bundle, 'focus')
    expect(picked?.target.id).toBe('marked')
    expect(metrics.get('marked')!.focusWeight).toBe(0)

    state.combat.playerUnits = [hive, core]
    core.currentTargetId = 'marked'
    const fallback = pickBestTarget(state, core, buildEvalBundle(state, state.combat.enemyUnits), 'focus')
    const threat = pickBestTarget(state, core, buildEvalBundle(state, state.combat.enemyUnits), 'threat')
    expect(fallback?.target.id).toBe(threat?.target.id)
  })

  it('Execution prefers a weakened finishable enemy', () => {
    const state = pulseSortie()
    setEnemies(state, [
      enemy({ id: 'full', x: 0, y: 130, hull: 80, hullMax: 80 }),
      enemy({ id: 'weak', x: 10, y: 140, hull: 6, hullMax: 80 }),
    ])
    const s = scores(state, 'execution')
    expect(s.weak).toBeGreaterThan(s.full)
  })

  it('Heavy prefers the durable armored target without treating Boss as an override', () => {
    const state = pulseSortie()
    setEnemies(state, [
      enemy({ id: 'light', x: 0, y: 140, hull: 20, hullMax: 20, armor: 0, role: 'fighter' }),
      enemy({ id: 'tank', x: 20, y: 150, hull: 200, hullMax: 200, armor: 18, role: 'juggernaut' }),
      enemy({
        id: 'boss',
        x: 0,
        y: 240,
        hull: 90,
        hullMax: 90,
        armor: 1,
        isBoss: true,
        role: 'boss',
        speed: 6,
      }),
    ])
    const heavy = scores(state, 'heavy')
    expect(heavy.tank).toBeGreaterThan(heavy.light)
    expect(heavy.tank).toBeGreaterThan(heavy.boss)
    const threat = scores(state, 'threat')
    expect(threat.boss).toBeLessThan(threat.tank + threat.light)
  })

  it('Shield prefers meaningful active Shield', () => {
    const state = pulseSortie()
    setEnemies(state, [
      enemy({ id: 'hull', x: 0, y: 140, hull: 200, hullMax: 200, shield: 0, shieldMax: 0 }),
      enemy({ id: 'ward', x: 10, y: 150, hull: 40, hullMax: 40, shield: 80, shieldMax: 80, role: 'shield' }),
    ])
    const s = scores(state, 'shield')
    expect(s.ward).toBeGreaterThan(s.hull)
  })

  it('Cluster prefers 2D density, not X-only spacing', () => {
    const state = pulseSortie()
    const pack = [
      enemy({ id: 'center', x: 40, y: 140 }),
      enemy({ id: 'n1', x: 40, y: 150 }),
      enemy({ id: 'n2', x: 50, y: 140 }),
      enemy({ id: 'n3', x: 30, y: 135 }),
      enemy({ id: 'lonely', x: 180, y: 140 }),
    ]
    setEnemies(state, pack)
    const s = scores(state, 'cluster')
    expect(s.center).toBeGreaterThan(s.lonely)
    expect(s.lonely).toBeLessThan(s.n1)
  })

  it('tie-breaks deterministically by wave then id', () => {
    const a = enemy({ id: 'b-id', x: 0, y: 10, sourceWave: 2 })
    const b = enemy({ id: 'a-id', x: 0, y: 10, sourceWave: 2 })
    expect(compareTargetTie(b, a)).toBeLessThan(0)
  })
})

describe('physical Core Doctrine persistence', () => {
  it('lets duplicate Cores store different Doctrines through Rebuild and Core Level reset', () => {
    let state = enableFireControlDoctrineForTests(createInitialState(0))
    state = unfitModule(state, 'plate-layer')
    addCoreInstance(state.shipyard, 'pulse-cannon')
    const copies = state.shipyard.coreInstances.filter((row) => row.moduleId === 'pulse-cannon')
    expect(copies.length).toBeGreaterThanOrEqual(2)
    copies[0]!.targetingDoctrine = 'threat'
    copies[1]!.targetingDoctrine = 'execution'
    state.workshop.coreStarts[copies[0]!.id] = 4
    expect(effectiveCoreTargetingDoctrine(state, { moduleId: 'pulse-cannon', coreInstanceId: copies[0]!.id })).toBe(
      'threat',
    )
    expect(effectiveCoreTargetingDoctrine(state, { moduleId: 'pulse-cannon', coreInstanceId: copies[1]!.id })).toBe(
      'execution',
    )
    state.workshop.coreStarts = {}
    expect(effectiveCoreTargetingDoctrine(state, { moduleId: 'pulse-cannon', coreInstanceId: copies[1]!.id })).toBe(
      'execution',
    )
  })
})

describe('Fire-Control Doctrine gate', () => {
  it('rejects configuration before unlock and uses authored defaults', () => {
    const locked = createInitialState(0)
    expect(canConfigureTargetingDoctrine(locked)).toBe(false)
    const inst = locked.shipyard.coreInstances.find((row) => row.moduleId === 'pulse-cannon')!
    const blocked = setCoreTargetingDoctrine(locked, inst.id, 'execution')
    expect(blocked.shipyard.coreInstances.find((row) => row.id === inst.id)?.targetingDoctrine).toBeFalsy()
    expect(effectiveCoreTargetingDoctrine(locked, { moduleId: 'pulse-cannon', coreInstanceId: inst.id })).toBe(
      'threat',
    )
  })

  it('allows Docked and PAUSED configuration once unlocked, not RUNNING', () => {
    let state = enableFireControlDoctrineForTests(createInitialState(0))
    expect(state.hiveResearch.completedIds).toContain(FIRE_CONTROL_DOCTRINE_RESEARCH_ID)
    expect(canConfigureTargetingDoctrine(state)).toBe(true)
    const inst = state.shipyard.coreInstances.find((row) => row.moduleId === 'pulse-cannon')!
    state = setCoreTargetingDoctrine(state, inst.id, 'execution')
    expect(state.shipyard.coreInstances.find((row) => row.id === inst.id)?.targetingDoctrine).toBe('execution')

    state = startCombat(state)
    const running = setCoreTargetingDoctrine(state, inst.id, 'focus')
    expect(running.shipyard.coreInstances.find((row) => row.id === inst.id)?.targetingDoctrine).toBe('execution')

    state = setSortiePaused(state, true)
    const core = pulseCore(state)
    core.currentTargetId = 'keep'
    state = setCoreTargetingDoctrine(state, inst.id, 'shield')
    expect(state.shipyard.coreInstances.find((row) => row.id === inst.id)?.targetingDoctrine).toBe('shield')
    expect(pulseCore(state).currentTargetId).toBe('keep')
    expect(state.combat.sortiePaused).toBe(true)
  })
})

describe('targeting-capable Core gate', () => {
  it('rejects Doctrine configuration on defense Cores and leftover weapon IDs', () => {
    expect(isTargetingCapableCoreModule('plate-layer')).toBe(false)
    expect(isTargetingCapableCoreModule('pulse-cannon')).toBe(true)
    expect(isTargetingCapableCoreModule('rail-driver')).toBe(false)
    expect(targetingProfileFor('rail-driver').fireRange).toBe(0)
    expect(targetingProfileFor('plate-layer').fireRange).toBe(0)

    let state = enableFireControlDoctrineForTests(createInitialState(0))
    const plate = state.shipyard.coreInstances.find((row) => row.moduleId === 'plate-layer')!
    const blocked = setCoreTargetingDoctrine(state, plate.id, 'threat')
    expect(blocked).toBe(state)
    expect(blocked.shipyard.coreInstances.find((row) => row.id === plate.id)?.targetingDoctrine).toBeUndefined()
  })
})

describe('acquisition, slew, and firing solution', () => {
  it('pre-acquires and orbitally pre-traverses without firing outside fire range', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    applyPlayerCoreOrbit(core)
    const fire = effectiveCoreFireRange(state, core)
    const acquire = effectiveCoreAcquisitionRange(state, core)
    const y = acquire * 0.92
    setEnemies(state, [enemy({ id: 'out', x: y, y: 0 })])
    const before = core.orbitAngle ?? 0
    const desired = hiveBearingOf(state.combat.enemyUnits[0]!)
    simulateCombat(state, 0.25, silent)
    expect(core.currentTargetId).toBe('out')
    expect(state.combat.projectiles.filter((p) => p.side === 'player')).toHaveLength(0)
    expect(Math.abs(shortestAngleDelta(core.orbitAngle ?? 0, desired))).toBeLessThan(
      Math.abs(shortestAngleDelta(before, desired)),
    )
    expect(firingSolution(state, core, state.combat.enemyUnits[0]!).canFire).toBe(false)
    const target = state.combat.enemyUnits[0]!
    target.x = Math.sin(core.orbitAngle ?? 0) * (fire * 0.6)
    target.y = Math.cos(core.orbitAngle ?? 0) * (fire * 0.6)
    core.weapons[0]!.cooldownLeft = 0
    simulateCombat(state, 1 / 30, silent)
    expect(state.combat.projectiles.some((p) => p.side === 'player' && p.fromId === core.id)).toBe(true)
  })

  it('Heavy Lance does not pre-charge outside fire range and requires a settled orbital solution', () => {
    let state = createInitialState(0)
    state = unfitModule(state, 'pulse-cannon')
    state.shipyard.unlockedModules.push('heavy-lance')
    state.shipyard.coreInstances.push({ id: 'heavy-lance:1', moduleId: 'heavy-lance' })
    state.shipyard.modules = ['heavy-lance', 'plate-layer']
    state.shipyard.equippedCoreIds = ['heavy-lance:1', 'plate-layer:1']
    state = startCombat(state)
    const core = state.combat.playerUnits.find((u) => u.isCore && u.coreModuleId === 'heavy-lance')!
    applyPlayerCoreOrbit(core)
    const fire = effectiveCoreFireRange(state, core)
    const acquire = effectiveCoreAcquisitionRange(state, core)
    setEnemies(state, [enemy({ id: 'siege', x: acquire * 0.9, y: 0, hull: 400, hullMax: 400, armor: 12 })])
    for (const weapon of core.weapons) weapon.damage = 0
    simulateCombat(state, 0.4, silent)
    expect(core.currentTargetId).toBe('siege')
    expect(core.weapons[0]!.telegraphLeft).toBe(0)
    expect(core.weapons[0]!.chargeReady).toBeFalsy()

    const target = state.combat.enemyUnits[0]!
    target.x = Math.sin(core.orbitAngle ?? 0) * (fire * 0.5)
    target.y = Math.cos(core.orbitAngle ?? 0) * (fire * 0.5)
    core.orbitAngle = hiveBearingOf(target) + degToRad(25)
    applyPlayerCoreOrbit(core)
    core.weapons[0]!.cooldownLeft = 0
    simulateCombat(state, 1 / 30, silent)
    expect(core.weapons[0]!.telegraphLeft).toBe(0)

    core.orbitAngle = hiveBearingOf(target)
    applyPlayerCoreOrbit(core)
    simulateCombat(state, 1 / 30, silent)
    expect(core.weapons[0]!.telegraphLeft).toBeGreaterThan(0)
    const charging = core.weapons[0]!.telegraphLeft
    simulateCombat(state, 0.2, silent)
    expect(core.weapons[0]!.telegraphLeft).toBeLessThan(charging)
    expect(core.weapons[0]!.telegraphLeft).toBeGreaterThan(0)

    const siege = { ...target, id: 'siege', x: target.x, y: target.y }
    setEnemies(state, [
      siege,
      enemy({ id: 'better', x: 10, y: 80, hull: 900, hullMax: 900, armor: 40 }),
    ])
    core.currentTargetId = 'siege'
    const held = core.weapons[0]!.telegraphLeft
    evalNow(state)
    expect(core.currentTargetId).toBe('siege')
    expect(core.weapons[0]!.telegraphLeft).toBe(held)

    setEnemies(state, [])
    tickPlayerCoreTargeting(state, 1 / 30)
    expect(core.currentTargetId).toBeUndefined()
    expect(core.weapons[0]!.telegraphLeft).toBe(0)
  })

  it('slew respects orbital rate and shortest wrap', () => {
    expect(radToDeg(Math.abs(shortestAngleDelta(degToRad(359), degToRad(1))))).toBeCloseTo(2, 5)
    const stepped = slewHeading(degToRad(359), degToRad(1), degToRad(1))
    expect(radToDeg(stepped) % 360).toBeCloseTo(0, 0)

    const state = pulseSortie()
    const core = pulseCore(state)
    core.orbitAngle = 0
    applyPlayerCoreOrbit(core)
    setEnemies(state, [enemy({ id: 't', x: 80, y: 0 })])
    core.currentTargetId = 't'
    const start = core.orbitAngle ?? 0
    const rate = effectiveCoreSlewRate(state, core)
    tickPlayerCoreTargeting(state, 0.05)
    const moved = Math.abs(shortestAngleDelta(start, core.orbitAngle ?? 0))
    expect(moved).toBeLessThanOrEqual(degToRad(rate) * 0.05 + 1e-6)
    expect(moved).toBeGreaterThan(0)
  })

  it('lets Flak and Slag fire while orbiting and requires Phase orbital alignment', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [enemy({ id: 'arc', x: 0, y: 120 })])
    const target = state.combat.enemyUnits[0]!
    core.currentTargetId = 'arc'
    core.orbitAngle = hiveBearingOf(target)
    applyPlayerCoreOrbit(core)
    core.coreModuleId = 'flak-array'
    expect(firingSolution(state, core, target).canFire).toBe(true)
    expect(firingSolution(state, core, target).stabilised || targetingProfileFor('flak-array').firesWhileTraversing).toBe(true)
    core.coreModuleId = 'slag-spitter'
    expect(firingSolution(state, core, target).canFire).toBe(true)
    core.coreModuleId = 'phase-beam'
    core.orbitAngle = hiveBearingOf(target) + degToRad(20)
    applyPlayerCoreOrbit(core)
    expect(firingSolution(state, core, target).canConnectBeam).toBe(false)
    core.orbitAngle = hiveBearingOf(target)
    applyPlayerCoreOrbit(core)
    expect(firingSolution(state, core, target).canConnectBeam).toBe(true)
  })

  it('pulse can fire while its orbit angle is still changing if the target is inside the outward arc', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [enemy({ id: 'arc', x: 0, y: 120 })])
    core.currentTargetId = 'arc'
    core.orbitAngle = hiveBearingOf(state.combat.enemyUnits[0]!) + degToRad(40)
    applyPlayerCoreOrbit(core)
    const sol = firingSolution(state, core, state.combat.enemyUnits[0]!)
    expect(sol.inArc).toBe(true)
    expect(sol.canFire).toBe(true)
    expect(targetingProfileFor('pulse-cannon').firesWhileTraversing).toBe(true)
    core.orbitAngle = hiveBearingOf(state.combat.enemyUnits[0]!) + degToRad(90)
    applyPlayerCoreOrbit(core)
    expect(firingSolution(state, core, state.combat.enemyUnits[0]!).canFire).toBe(false)
  })
})

describe('physical shot origin and persistence', () => {
  it('spawns projectiles and beams from the Core world position', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    core.orbitAngle = Math.PI / 2
    core.x = 30
    core.y = 0
    setEnemies(state, [enemy({ id: 'p', x: 80, y: 0 })])
    core.currentTargetId = 'p'
    core.orbitAngle = hiveBearingOf(state.combat.enemyUnits[0]!)
    applyPlayerCoreOrbit(core)
    core.weapons[0]!.cooldownLeft = 0
    simulateCombat(state, 1 / 30, silent)
    const shot = state.combat.projectiles.find((p) => p.side === 'player')
    expect(shot?.originX).toBeCloseTo(core.x, 5)
    expect(shot?.originY).toBeCloseTo(core.y, 5)
    expect(Math.hypot(shot?.originX ?? 0, shot?.originY ?? 0)).toBeGreaterThan(10)
  })

  it('spawns a Phase beam from the Core world position when aligned', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    core.coreModuleId = 'phase-beam'
    core.orbitAngle = Math.PI / 2
    core.x = 40
    core.y = 0
    for (const weapon of core.weapons) {
      weapon.delivery = 'beam'
      weapon.cooldownLeft = 0
    }
    setEnemies(state, [enemy({ id: 'p', x: 90, y: 0 })])
    core.currentTargetId = 'p'
    core.orbitAngle = hiveBearingOf(state.combat.enemyUnits[0]!)
    applyPlayerCoreOrbit(core)
    simulateCombat(state, 1 / 30, silent)
    const beam = state.combat.beams.find((b) => b.side === 'player')
    expect(beam?.fromId).toBe(core.id)
    expect(Math.hypot(core.x, core.y)).toBeGreaterThan(10)
  })

  it('survives save/reload without moving the orbit or dropping the target', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [enemy({ id: 'keep', x: 20, y: 150 })])
    evalNow(state)
    core.orbitAngle = 0.4
    applyPlayerCoreOrbit(core)
    core.targetingTelemetry = { ...emptyTargetingTelemetry(), targetSwitches: 3, timeSlewLimited: 1.2 }
    expect(SAVE_VERSION).toBe(51)
    saveGame(state)
    const loaded = loadOrCreateGame()
    const loadedCore = loaded.combat.playerUnits.find((u) => u.isCore)!
    expect(loadedCore.currentTargetId).toBe(core.currentTargetId)
    expect(loadedCore.orbitAngle).toBeCloseTo(0.4)
    expect(playerCoreOutwardFacing(loadedCore)).toBeCloseTo(0.4)
    expect(loadedCore.heading).toBeCloseTo(loadedCore.orbitAngle ?? 0)
    expect(loadedCore.targetingTelemetry?.targetSwitches).toBe(3)
    expect(loadedCore.targetingTelemetry?.timeSlewLimited).toBeCloseTo(1.2)
    const paused = loaded.combat.simTime
    advanceSeconds(loaded, 2)
    expect(loaded.combat.simTime).toBeCloseTo(paused)
    expect(loaded.combat.playerUnits.find((u) => u.isCore)!.orbitAngle).toBeCloseTo(0.4)
  })
})

describe('determinism, telemetry, and stress', () => {
  it('picks the same target from the same state twice', () => {
    const a = pulseSortie(9)
    const b = pulseSortie(9)
    const pack = [
      enemy({ id: 'e1', x: 20, y: 120, sourceWave: 1 }),
      enemy({ id: 'e2', x: -30, y: 150, sourceWave: 1 }),
      enemy({ id: 'e3', x: 60, y: 90, sourceWave: 2 }),
    ]
    setEnemies(a, pack.map((u) => ({ ...u, weapons: [...u.weapons] })))
    setEnemies(b, pack.map((u) => ({ ...u, weapons: [...u.weapons] })))
    evalNow(a)
    evalNow(b)
    expect(pulseCore(a).currentTargetId).toBe(pulseCore(b).currentTargetId)
  })

  it('records targeting telemetry and does not advance it while paused', () => {
    let state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [enemy({ id: 'a', x: 230, y: 0 })])
    core.orbitAngle = Math.PI
    applyPlayerCoreOrbit(core)
    evalNow(state)
    expect(core.targetingTelemetry?.initialAcquisitions).toBeGreaterThan(0)
    expect(core.targetingTelemetry?.targetSwitches ?? 0).toBe(0)
    tickPlayerCoreTargeting(state, 0.3)
    const slew = core.targetingTelemetry!.timeSlewLimited
    const out = core.targetingTelemetry!.timeAcquiredOutsideFire
    expect(slew + out + core.targetingTelemetry!.timeNoTargetWhileEnemies).toBeGreaterThan(0)
    const frozen = { ...core.targetingTelemetry! }
    state = setSortiePaused(state, true)
    advanceSeconds(state, 1)
    expect(pulseCore(state).targetingTelemetry).toEqual(frozen)
  })

  it('stays stable with six Cores and a dense enemy field', () => {
    const state = pulseSortie(11)
    const hive = state.combat.playerUnits.find((u) => u.isFlagship)!
    const extras: CombatUnit[] = []
    for (let i = 0; i < 5; i += 1) {
      extras.push({
        ...pulseCore(state),
        id: `pulse-cannon:${i + 2}`,
        coreInstanceId: `pulse-cannon:${i + 2}`,
        coreSlot: i + 1,
        orbitAngle: (i + 1) * 0.9,
        heading: (i + 1) * 0.9,
        targetingTelemetry: emptyTargetingTelemetry(),
        weapons: pulseCore(state).weapons.map((w) => ({ ...w, id: `${w.id}-${i}` })),
      })
    }
    state.combat.playerUnits = [hive, pulseCore(state), ...extras]
    const crowd: CombatUnit[] = []
    for (let i = 0; i < 55; i += 1) {
      const a = (i / 55) * Math.PI * 2
      crowd.push(
        enemy({
          id: `mob-${i}`,
          x: Math.sin(a) * (90 + (i % 5) * 20),
          y: Math.cos(a) * (90 + (i % 5) * 20),
          hull: 10 + (i % 7),
          hullMax: 40,
          sourceWave: 1 + (i % 4),
        }),
      )
    }
    setEnemies(state, crowd)
    for (let i = 0; i < 40; i += 1) {
      tickPlayerCoreTargeting(state, TARGET_EVAL_INTERVAL)
      crowd[i % crowd.length]!.hull = 0
    }
    for (const core of state.combat.playerUnits.filter((u) => u.isCore)) {
      expect(Number.isFinite(core.heading)).toBe(true)
      if (core.currentTargetId) {
        const t = state.combat.enemyUnits.find((u) => u.id === core.currentTargetId)
        expect(!t || t.hull > 0).toBe(true)
      }
    }
  })
})

describe('range / arc identity', () => {
  it('keeps Acquisition larger than Fire Range for canonical Cores', () => {
    const state = createInitialState(0)
    const fleet = buildPlayerFleet(state)
    const core = fleet.find((u) => u.isCore)!
    expect(effectiveCoreAcquisitionRange(state, core)).toBeGreaterThan(effectiveCoreFireRange(state, core))
    expect(effectiveCoreFiringArc(state, core)).toBe(150)
    expect(effectiveCoreSlewRate(state, core)).toBeCloseTo(360 * 1.08)
  })

  it('returns an empty profile for leftover weapon IDs', () => {
    const profile = targetingProfileFor('rail-driver')
    expect(profile.fireRange).toBe(0)
    expect(profile.acquisitionRange).toBe(0)
  })
})

describe('targetability extension', () => {
  it('does not treat untargetable as dead and skips them for acquisition', () => {
    const state = pulseSortie()
    const veiled = enemy({ id: 'veil', x: 0, y: 100, targetable: false, hull: 40, hullMax: 40 })
    expect(isTargetableEnemy(state, veiled)).toBe(false)
    expect(veiled.hull).toBeGreaterThan(0)
    setEnemies(state, [veiled, enemy({ id: 'open', x: 20, y: 110 })])
    evalNow(state)
    expect(pulseCore(state).currentTargetId).toBe('open')
  })

  it('still treats an enemy flagship/Boss hull as targetable', () => {
    const state = pulseSortie()
    const boss = enemy({ id: 'bound', x: 0, y: 120, isFlagship: true, isBoss: true, hull: 80, hullMax: 80 })
    expect(isTargetableEnemy(state, boss)).toBe(true)
    setEnemies(state, [boss])
    evalNow(state)
    expect(pulseCore(state).currentTargetId).toBe('bound')
  })
})

describe('player fire uses persistent target', () => {
  it('does not secretly pick a new target at fire time', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [
      enemy({ id: 'locked', x: 0, y: 100 }),
      enemy({ id: 'other', x: 10, y: 80 }),
    ])
    core.currentTargetId = 'locked'
    core.orbitAngle = hiveBearingOf(state.combat.enemyUnits[0]!)
    applyPlayerCoreOrbit(core)
    core.nextTargetEvalAt = state.combat.simTime + 10
    core.weapons[0]!.cooldownLeft = 0
    simulateCombat(state, 1 / 30, silent)
    const shot = state.combat.projectiles.find((p) => p.side === 'player')
    expect(shot?.toId).toBe('locked')
    expect(playerCoreTarget(state, core)?.id).toBe('locked')
  })
})

function stubGun(id: string, damage: number, cooldown = 1): CombatUnit['weapons'][number] {
  return {
    id,
    name: 'g',
    damage,
    cooldown,
    cooldownLeft: 1,
    range: 80,
    tags: ['kinetic'],
    splash: 0,
    dotDuration: 0,
    dotDamage: 0,
    telegraphDuration: 0,
    telegraphLeft: 0,
  }
}

function addAllyCore(state: GameState, id: string, targetId?: string): CombatUnit {
  const core = pulseCore(state)
  const ally: CombatUnit = {
    ...core,
    id,
    coreInstanceId: id,
    currentTargetId: targetId,
    targetLockTime: 0,
    targetingTelemetry: emptyTargetingTelemetry(),
    weapons: core.weapons.map((w) => ({ ...w, id: `${w.id}-${id}` })),
  }
  state.combat.playerUnits.push(ally)
  return ally
}

function fitHeavyLance(seed = 0): GameState {
  let state = createInitialState(seed)
  state = unfitModule(state, 'pulse-cannon')
  state.shipyard.unlockedModules.push('heavy-lance')
  state.shipyard.modules = ['heavy-lance', 'plate-layer']
  state.shipyard.coreInstances.push({ id: 'heavy-lance:1', moduleId: 'heavy-lance' })
  state.shipyard.equippedCoreIds = ['heavy-lance:1', 'plate-layer:1']
  return startCombat(state)
}

describe('acquisition safety gap', () => {
  it('keeps authored acquisition when fire is unmodified', () => {
    const pulse = targetingProfileFor('pulse-cannon')
    const stats = applyTargetingStats(pulse, {})
    expect(stats.fire).toBe(170)
    expect(stats.acquire).toBe(240)
  })

  it('preserves a meaningful acquire > fire gap if fire would overtake acquisition', () => {
    const pulse = targetingProfileFor('pulse-cannon')
    const stats = applyTargetingStats(pulse, { fireRangeAdd: 200 })
    expect(stats.fire).toBe(370)
    expect(stats.acquire).toBeGreaterThanOrEqual(stats.fire * ACQUISITION_FIRE_GAP - 1e-9)
    expect(stats.acquire).toBeCloseTo(370 * ACQUISITION_FIRE_GAP)
  })
})

describe('Focus excludes self-vote', () => {
  it('does not self-anchor a lone Focus Core', () => {
    const state = enableFireControlDoctrineForTests(pulseSortie())
    const inst = state.shipyard.coreInstances.find((row) => row.moduleId === 'pulse-cannon')!
    inst.targetingDoctrine = 'focus'
    const core = pulseCore(state)
    setEnemies(state, [
      enemy({ id: 'a', x: 0, y: 160, speed: 6, weapons: [stubGun('a-g', 2, 3)] }),
      enemy({ id: 'b', x: 10, y: 90, speed: 40, weapons: [stubGun('b-g', 18, 0.6)] }),
    ])
    core.currentTargetId = 'a'
    evalNow(state)
    const threat = pickBestTarget(state, core, buildEvalBundle(state, state.combat.enemyUnits), 'threat')
    expect(core.currentTargetId).toBe(threat?.target.id)
  })

  it('lets a second Focus Core converge onto another Core’s commitment', () => {
    const state = enableFireControlDoctrineForTests(pulseSortie())
    const inst = state.shipyard.coreInstances.find((row) => row.moduleId === 'pulse-cannon')!
    inst.targetingDoctrine = 'focus'
    const core = pulseCore(state)
    setEnemies(state, [
      enemy({ id: 'a', x: 0, y: 140 }),
      enemy({ id: 'b', x: 40, y: 90, speed: 40, weapons: [stubGun('b-g', 20, 0.5)] }),
    ])
    addAllyCore(state, 'pulse-cannon:2', 'a')
    core.currentTargetId = undefined
    evalNow(state)
    expect(core.currentTargetId).toBe('a')
  })

  it('is independent of Core processing order', () => {
    const state = enableFireControlDoctrineForTests(pulseSortie())
    const inst = state.shipyard.coreInstances.find((row) => row.moduleId === 'pulse-cannon')!
    inst.targetingDoctrine = 'focus'
    const core = pulseCore(state)
    setEnemies(state, [
      enemy({ id: 'a', x: 0, y: 140 }),
      enemy({ id: 'b', x: 40, y: 90, speed: 40, weapons: [stubGun('b-g', 20, 0.5)] }),
    ])
    const ally = addAllyCore(state, 'pulse-cannon:2', 'a')
    const hive = state.combat.playerUnits.find((u) => u.isFlagship)!
    const evalFocusCore = () => {
      for (const unit of state.combat.playerUnits) {
        if (unit.isCore) unit.nextTargetEvalAt = 1e9
      }
      core.nextTargetEvalAt = 0
      core.currentTargetId = undefined
      tickPlayerCoreTargeting(state, 0)
    }
    state.combat.playerUnits = [hive, core, ally]
    evalFocusCore()
    const forward = core.currentTargetId
    state.combat.playerUnits = [hive, ally, core]
    evalFocusCore()
    expect(core.currentTargetId).toBe(forward)
    expect(forward).toBe('a')
  })

  it('does not permanently self-anchor from its own projectile', () => {
    const state = enableFireControlDoctrineForTests(pulseSortie())
    const inst = state.shipyard.coreInstances.find((row) => row.moduleId === 'pulse-cannon')!
    inst.targetingDoctrine = 'focus'
    const core = pulseCore(state)
    setEnemies(state, [
      enemy({ id: 'a', x: 0, y: 160, speed: 6, weapons: [stubGun('a-g', 2, 3)] }),
      enemy({ id: 'b', x: 10, y: 90, speed: 40, weapons: [stubGun('b-g', 18, 0.6)] }),
    ])
    core.currentTargetId = undefined
    state.combat.projectiles = [
      {
        id: 'own-shot',
        fromId: core.id,
        toId: 'a',
        side: 'player',
        tag: 'kinetic',
        x: core.x,
        y: core.y,
        damage: 1,
        tags: ['kinetic'],
        dotDuration: 0,
        dotDamage: 0,
        speed: 40,
        attackerFamily: 'core',
      },
    ]
    evalNow(state)
    expect(core.currentTargetId).toBe('b')
  })
})

describe('Shield fallback and Execution / Cluster scoring', () => {
  it('falls back to Threat when no legal candidate is meaningfully shielded', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [
      enemy({ id: 'harmless', x: 0, y: 180, speed: 4, shield: 0, shieldMax: 0, weapons: [stubGun('h', 1, 4)] }),
      enemy({ id: 'danger', x: 20, y: 90, speed: 40, shield: 0, shieldMax: 0, weapons: [stubGun('d', 16, 0.7)] }),
    ])
    const bundle = buildEvalBundle(state, state.combat.enemyUnits)
    expect(pickBestTarget(state, core, bundle, 'shield')?.target.id).toBe(
      pickBestTarget(state, core, bundle, 'threat')?.target.id,
    )
  })

  it('still prefers a meaningfully shielded target when one exists', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [
      enemy({ id: 'hull', x: 0, y: 140, hull: 200, hullMax: 200, shield: 0, shieldMax: 0, speed: 40, weapons: [stubGun('hh', 20, 0.5)] }),
      enemy({ id: 'ward', x: 10, y: 150, hull: 40, hullMax: 40, shield: 80, shieldMax: 80, role: 'shield' }),
    ])
    const bundle = buildEvalBundle(state, state.combat.enemyUnits)
    expect(pickBestTarget(state, core, bundle, 'shield')?.target.id).toBe('ward')
  })

  it('Execution prefers true remaining durability over a low-hull shielded tank', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [
      enemy({
        id: 'a',
        x: 0,
        y: 130,
        hull: 5,
        hullMax: 100,
        shield: 400,
        shieldMax: 400,
      }),
      enemy({
        id: 'b',
        x: 10,
        y: 140,
        hull: 18,
        hullMax: 40,
        shield: 0,
        shieldMax: 0,
      }),
    ])
    const bundle = buildEvalBundle(state, state.combat.enemyUnits)
    expect(pickBestTarget(state, core, bundle, 'execution')?.target.id).toBe('b')
  })

  it('Cluster includes local effective mass, not only neighbour DPS', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [
      enemy({ id: 'light-a', x: 0, y: 140, hull: 8, hullMax: 8 }),
      enemy({ id: 'light-b', x: 8, y: 140, hull: 8, hullMax: 8 }),
      enemy({ id: 'light-c', x: 0, y: 148, hull: 8, hullMax: 8 }),
      enemy({ id: 'tank-a', x: 90, y: 140, hull: 220, hullMax: 220, armor: 12 }),
      enemy({ id: 'tank-b', x: 98, y: 140, hull: 220, hullMax: 220, armor: 12 }),
      enemy({ id: 'tank-c', x: 90, y: 148, hull: 220, hullMax: 220, armor: 12 }),
    ])
    const bundle = buildEvalBundle(state, state.combat.enemyUnits)
    const picked = pickBestTarget(state, core, bundle, 'cluster')?.target.id
    expect(picked === 'tank-a' || picked === 'tank-b' || picked === 'tank-c').toBe(true)
    expect(bundle.metrics.get('tank-a')!.clusterMass).toBeGreaterThan(bundle.metrics.get('light-a')!.clusterMass)
  })
})

describe('absolute hysteresis floor', () => {
  it('uses a central absolute floor so near-zero scores cannot chatter', () => {
    expect(switchRequiredGain(0, 0.25)).toBe(HYSTERESIS_ABSOLUTE_FLOOR)
    expect(switchRequiredGain(0.2, 0.25)).toBe(HYSTERESIS_ABSOLUTE_FLOOR)
    expect(beatsHysteresis(0.3, 0.2, 0.25)).toBe(false)
    expect(beatsHysteresis(20, 0.2, 0.25)).toBe(true)
  })
})

describe('Doctrine edit contract', () => {
  it('allows Docked and PAUSED Sortie edits, rejects RUNNING and other transitions', () => {
    let state = enableFireControlDoctrineForTests(createInitialState(0))
    expect(canEditTargetingNow(state)).toBe(true)
    expect(canConfigureTargetingDoctrine(state)).toBe(true)
    state = startCombat(state)
    expect(canEditTargetingNow(state)).toBe(false)
    const running = setCoreTargetingDoctrine(state, pulseCore(state).coreInstanceId!, 'execution')
    expect(running.shipyard.coreInstances.find((row) => row.moduleId === 'pulse-cannon')?.targetingDoctrine).not.toBe(
      'execution',
    )
    state = setSortiePaused(state, true)
    expect(canEditTargetingNow(state)).toBe(true)
    const transitional = structuredClone(state)
    transitional.combat.docked = false
    transitional.combat.inFight = false
    transitional.combat.sortiePaused = false
    expect(canEditTargetingNow(transitional)).toBe(false)
    const rejected = setCoreTargetingDoctrine(transitional, pulseCore(transitional).coreInstanceId!, 'execution')
    expect(rejected.shipyard.coreInstances.find((row) => row.moduleId === 'pulse-cannon')?.targetingDoctrine).not.toBe(
      'execution',
    )
  })

  it('preserves current target, heading, and Heavy charge when Doctrine changes while paused', () => {
    let state = enableFireControlDoctrineForTests(fitHeavyLance())
    const core = state.combat.playerUnits.find((u) => u.isCore)!
    const inst = state.shipyard.coreInstances.find((row) => row.moduleId === 'heavy-lance')!
    setEnemies(state, [enemy({ id: 'hold', x: core.x + 20, y: core.y + 20, hull: 400, hullMax: 400, armor: 10 })])
    core.currentTargetId = 'hold'
    core.orbitAngle = 1.2
    applyPlayerCoreOrbit(core)
    core.targetLockTime = 1.5
    core.weapons[0]!.telegraphLeft = 1.1
    core.weapons[0]!.telegraphToId = 'hold'
    state = setSortiePaused(state, true)
    const pausedCore = state.combat.playerUnits.find((u) => u.isCore)!
    pausedCore.currentTargetId = 'hold'
    pausedCore.orbitAngle = 1.2
    applyPlayerCoreOrbit(pausedCore)
    pausedCore.targetLockTime = 1.5
    pausedCore.weapons[0]!.telegraphLeft = 1.1
    state = setCoreTargetingDoctrine(state, inst.id, 'threat')
    const after = state.combat.playerUnits.find((u) => u.isCore)!
    expect(after.currentTargetId).toBe('hold')
    expect(after.orbitAngle).toBeCloseTo(1.2)
    expect(playerCoreOutwardFacing(after)).toBeCloseTo(1.2)
    expect(after.targetLockTime).toBeCloseTo(1.5)
    expect(after.weapons[0]!.telegraphLeft).toBeCloseTo(1.1)
    expect(after.nextTargetEvalAt).toBe(0)
  })
})

describe('targetLockTime', () => {
  it('accumulates while the same target is retained, including cooldown and pre-slew', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [enemy({ id: 'a', x: 0, y: 200 })])
    evalNow(state)
    expect(core.currentTargetId).toBe('a')
    expect(core.targetLockTime ?? 0).toBe(0)
    tickPlayerCoreTargeting(state, 0.4)
    expect(core.targetLockTime).toBeCloseTo(0.4)
    core.weapons[0]!.cooldownLeft = 2
    tickPlayerCoreTargeting(state, 0.3)
    expect(core.currentTargetId).toBe('a')
    expect(core.targetLockTime).toBeCloseTo(0.7)
  })

  it('resets on switch and on loss, and does not advance while paused', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [
      enemy({ id: 'a', x: 0, y: 220, speed: 4, weapons: [stubGun('a', 1, 4)] }),
      enemy({ id: 'b', x: 10, y: 90, speed: 40, weapons: [stubGun('b', 18, 0.6)] }),
    ])
    core.currentTargetId = 'a'
    evalNow(state)
    expect(core.currentTargetId).toBe('b')
    expect(core.targetLockTime ?? 0).toBe(0)
    tickPlayerCoreTargeting(state, 0.5)
    expect(core.targetLockTime).toBeCloseTo(0.5)
    state.combat.enemyUnits.find((u) => u.id === 'b')!.hull = 0
    tickPlayerCoreTargeting(state, 0)
    expect(core.currentTargetId).not.toBe('b')
    expect(core.targetLockTime ?? 0).toBe(0)

    const live = pulseSortie()
    setEnemies(live, [enemy({ id: 'keep', x: 0, y: 150 })])
    evalNow(live)
    tickPlayerCoreTargeting(live, 0.8)
    const paused = setSortiePaused(live, true)
    const before = pulseCore(paused).targetLockTime
    advanceSeconds(paused, 2)
    expect(pulseCore(paused).targetLockTime).toBeCloseTo(before ?? 0)
  })

  it('persists through save/reload', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [enemy({ id: 'keep', x: 20, y: 150 })])
    evalNow(state)
    core.targetLockTime = 2.25
    saveGame(state)
    const loaded = loadOrCreateGame()
    expect(loaded.combat.playerUnits.find((u) => u.isCore)!.targetLockTime).toBeCloseTo(2.25)
  })
})

describe('telemetry semantics', () => {
  it('counts initial acquisitions separately from switches and records shots fired', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    setEnemies(state, [enemy({ id: 'a', x: 0, y: 100 })])
    evalNow(state)
    expect(core.targetingTelemetry?.initialAcquisitions).toBe(1)
    expect(core.targetingTelemetry?.targetSwitches ?? 0).toBe(0)
    core.orbitAngle = hiveBearingOf(state.combat.enemyUnits[0]!)
    applyPlayerCoreOrbit(core)
    core.weapons[0]!.cooldownLeft = 0
    simulateCombat(state, 1 / 30, silent)
    expect(core.targetingTelemetry?.shotsFired).toBeGreaterThanOrEqual(1)
    setEnemies(state, [
      enemy({ id: 'a', x: 0, y: 220, speed: 4, weapons: [stubGun('a', 1, 4)] }),
      enemy({ id: 'hot', x: 8, y: 80, speed: 50, weapons: [stubGun('hot', 30, 0.3)] }),
    ])
    core.currentTargetId = 'a'
    core.nextTargetEvalAt = 0
    evalNow(state)
    expect(core.currentTargetId).toBe('hot')
    expect(core.targetingTelemetry?.targetSwitches).toBeGreaterThanOrEqual(1)
  })

  it('resets the held-shot latch on target loss and counts one blocked opportunity each', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    const a = enemy({ id: 'a', x: 0, y: 90 })
    setEnemies(state, [a])
    core.currentTargetId = 'a'
    core.heldShotNoted = true
    clearCoreTarget(core)
    expect(core.heldShotNoted).toBe(false)
    core.heldShotNoted = true
    setCoreTarget(core, 'a')
    expect(core.heldShotNoted).toBe(false)
    expect(core.currentTargetId).toBe('a')

    core.orbitAngle = hiveBearingOf(a) + Math.PI
    applyPlayerCoreOrbit(core)
    core.weapons[0]!.cooldownLeft = 0
    const blockedA = firingSolution(state, core, a)
    expect(blockedA.inFireRange).toBe(true)
    expect(blockedA.canFire).toBe(false)
    simulateCombat(state, 1 / 30, silent)
    expect(core.targetingTelemetry?.shotsHeldIllegalSolution).toBe(1)
    simulateCombat(state, 1 / 30, silent)
    simulateCombat(state, 1 / 30, silent)
    expect(core.targetingTelemetry?.shotsHeldIllegalSolution).toBe(1)

    const b = enemy({ id: 'b', x: 0, y: 90 })
    setEnemies(state, [b])
    core.orbitAngle = hiveBearingOf(b) + Math.PI
    applyPlayerCoreOrbit(core)
    core.weapons[0]!.cooldownLeft = 0
    simulateCombat(state, 1 / 30, silent)
    expect(core.currentTargetId).toBe('b')
    expect(core.targetingTelemetry?.shotsHeldIllegalSolution).toBe(2)
    simulateCombat(state, 1 / 30, silent)
    simulateCombat(state, 1 / 30, silent)
    simulateCombat(state, 1 / 30, silent)
    expect(core.targetingTelemetry?.shotsHeldIllegalSolution).toBe(2)
    expect(core.targetingTelemetry?.shotsFired ?? 0).toBe(0)
  })
})

describe('Knife Fight fire-range cap', () => {
  it('caps Pulse fire range without collapsing acquisition', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    expect(effectiveCoreFireRange(state, core)).toBe(170)
    state.challenges.activeId = 'knife-fight'
    const fire = effectiveCoreFireRange(state, core)
    const acquire = effectiveCoreAcquisitionRange(state, core)
    expect(fire).toBe(KNIFE_FIGHT_RANGE_CAP)
    expect(acquire).toBeGreaterThan(fire)
    expect(acquire).toBeGreaterThanOrEqual(fire * ACQUISITION_FIRE_GAP)
    const y = (fire + acquire) / 2
    setEnemies(state, [enemy({ id: 'mid', x: 0, y })])
    simulateCombat(state, 0.25, silent)
    expect(core.currentTargetId).toBe('mid')
    expect(state.combat.projectiles.filter((p) => p.side === 'player')).toHaveLength(0)
    state.combat.enemyUnits[0]!.x = 0
    state.combat.enemyUnits[0]!.y = Math.max(fire * 0.85, (core.orbitRadius ?? 44) + 24)
    core.orbitAngle = hiveBearingOf(state.combat.enemyUnits[0]!)
    applyPlayerCoreOrbit(core)
    core.weapons[0]!.cooldownLeft = 0
    simulateCombat(state, 1 / 30, silent)
    expect(state.combat.projectiles.some((p) => p.side === 'player')).toBe(true)
  })
})

describe('Heavy Lance cycle rate', () => {
  it('scales charge duration from the 2.8s base and does not double-cooldown', () => {
    const state = fitHeavyLance()
    const core = state.combat.playerUnits.find((u) => u.isCore)!
    expect(effectiveChargeDurationSec(state, core)).toBeCloseTo(2.8, 5)
    const baseCd = core.weapons[0]!.cooldown
    core.weapons[0]!.cooldown = baseCd * 0.5
    expect(effectiveChargeDurationSec(state, core)).toBeCloseTo(1.4, 5)
    core.weapons[0]!.cooldown = baseCd * 2
    expect(effectiveChargeDurationSec(state, core)).toBeCloseTo(5.6, 5)
    core.weapons[0]!.cooldown = baseCd
    const target = enemy({ id: 'siege', x: core.x + 30, y: core.y + 30, hull: 400, hullMax: 400, armor: 8 })
    setEnemies(state, [target])
    core.currentTargetId = 'siege'
    core.orbitAngle = hiveBearingOf(target)
    applyPlayerCoreOrbit(core)
    core.weapons[0]!.cooldownLeft = 0
    simulateCombat(state, 1 / 30, silent)
    expect(core.weapons[0]!.telegraphLeft).toBeGreaterThan(2.5)
    expect(core.weapons[0]!.telegraphLeft).toBeLessThanOrEqual(2.8 + 1e-6)
    core.weapons[0]!.telegraphLeft = 0
    core.weapons[0]!.chargeReady = true
    core.weapons[0]!.cooldownLeft = 0
    simulateCombat(state, 1 / 30, silent)
    expect(core.weapons[0]!.chargeReady).toBeFalsy()
    expect(core.weapons[0]!.cooldownLeft).toBe(0)
  })

  it('shortens Heavy charge when Cycle Rate improves', () => {
    let state = createInitialState(0)
    state.workshop.levels = { ...(state.workshop.levels ?? {}), 'cycle-rate': 4 }
    state = unfitModule(state, 'pulse-cannon')
    state.shipyard.unlockedModules.push('heavy-lance')
    state.shipyard.modules = ['heavy-lance', 'plate-layer']
    state.shipyard.coreInstances.push({ id: 'heavy-lance:1', moduleId: 'heavy-lance' })
    state.shipyard.equippedCoreIds = ['heavy-lance:1', 'plate-layer:1']
    state = startCombat(state)
    const core = state.combat.playerUnits.find((u) => u.isCore)!
    expect(effectiveChargeDurationSec(state, core)).toBeLessThan(2.8 - 0.05)
  })
})

describe('save/reload continuation with targeting state', () => {
  it('matches an uninterrupted branch after reload, resume, and the same sim time', () => {
    const state = fitHeavyLance(19)
    for (const unit of state.combat.playerUnits) {
      for (const weapon of unit.weapons) weapon.damage = 0
    }
    const core = state.combat.playerUnits.find((u) => u.isCore)!
    setEnemies(state, [enemy({ id: 'keep', x: core.x + 40, y: core.y + 40, hull: 800, hullMax: 800, armor: 8 })])
    evalNow(state)
    simulateCombat(state, 0.35, silent)
    core.targetLockTime = Math.max(core.targetLockTime ?? 0, 1.1)
    const target = state.combat.enemyUnits[0]!
    core.currentTargetId = 'keep'
    core.orbitAngle = hiveBearingOf(target)
    applyPlayerCoreOrbit(core)
    core.weapons[0]!.cooldownLeft = 0
    simulateCombat(state, 0.4, silent)
    expect(core.weapons[0]!.telegraphLeft).toBeGreaterThan(0)

    const fingerprint = (s: GameState) => {
      const c = s.combat.playerUnits.find((u) => u.isCore)!
      return {
        target: c.currentTargetId,
        lock: c.targetLockTime,
        heading: c.heading,
        orbit: c.orbitAngle,
        charge: c.weapons[0]?.telegraphLeft,
        ready: Boolean(c.weapons[0]?.chargeReady),
        cd: c.weapons[0]?.cooldownLeft,
        shots: s.combat.projectiles.map((p) => ({ id: p.id, x: p.x, y: p.y, to: p.toId })),
        beams: (s.combat.beams ?? []).map((b) => ({ id: b.id, from: b.fromId, to: b.toId })),
        enemies: s.combat.enemyUnits.map((u) => ({ id: u.id, x: u.x, y: u.y, hull: u.hull, shield: u.shield })),
        scrap: s.resources.scrap,
        salvage: s.resources.salvage,
        tel: c.targetingTelemetry,
        rng: s.combat.rng.s,
      }
    }

    const branchA = structuredClone(state)
    saveGame(state)
    const branchB = loadOrCreateGame(Date.now() + 40_000)
    expect(branchB.combat.sortiePaused).toBe(true)
    branchB.combat.sortiePaused = false
    simulateCombat(branchA, 0.9, silent)
    simulateCombat(branchB, 0.9, silent)
    expect(fingerprint(branchB)).toEqual(fingerprint(branchA))
  })
})

describe('orbital slew geometry', () => {
  it('keeps outward facing equal to the Hive-radial bearing', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    for (const angle of [0, 0.7, Math.PI, 4.2]) {
      core.orbitAngle = angle
      applyPlayerCoreOrbit(core)
      expect(playerCoreOutwardFacing(core)).toBeCloseTo(core.orbitAngle ?? 0)
      expect(core.heading).toBeCloseTo(core.orbitAngle ?? 0)
      expect(wrapTau(Math.atan2(core.x, core.y))).toBeCloseTo(wrapTau(core.orbitAngle ?? 0))
    }
  })

  it('changes orbital angle toward a target outside the current firing arc and does not independently aim', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    core.orbitAngle = 0
    applyPlayerCoreOrbit(core)
    const startFacing = playerCoreOutwardFacing(core)
    setEnemies(state, [enemy({ id: 'side', x: 180, y: 0 })])
    core.currentTargetId = 'side'
    const startOrbit = core.orbitAngle ?? 0
    tickPlayerCoreTargeting(state, 0.2)
    expect(core.orbitAngle).not.toBeCloseTo(startOrbit)
    expect(playerCoreOutwardFacing(core)).toBeCloseTo(core.orbitAngle ?? 0)
    expect(core.heading).toBeCloseTo(core.orbitAngle ?? 0)
    expect(core.heading).not.toBeCloseTo(bearingBetween(core, state.combat.enemyUnits[0]!))
    expect(playerCoreOutwardFacing(core)).not.toBeCloseTo(startFacing)
  })

  it('lets a fast-slew Core close an orbital gap faster than a slow-slew Core', () => {
    const fast = pulseSortie()
    const slow = pulseSortie()
    const fastCore = pulseCore(fast)
    const slowCore = pulseCore(slow)
    slowCore.coreModuleId = 'heavy-lance'
    for (const core of [fastCore, slowCore]) {
      core.orbitAngle = 0
      applyPlayerCoreOrbit(core)
      core.currentTargetId = 'side'
    }
    setEnemies(fast, [enemy({ id: 'side', x: 200, y: 0 })])
    setEnemies(slow, [enemy({ id: 'side', x: 200, y: 0 })])
    tickPlayerCoreTargeting(fast, 0.15)
    tickPlayerCoreTargeting(slow, 0.15)
    const fastMoved = Math.abs(shortestAngleDelta(0, fastCore.orbitAngle ?? 0))
    const slowMoved = Math.abs(shortestAngleDelta(0, slowCore.orbitAngle ?? 0))
    expect(fastMoved).toBeGreaterThan(slowMoved + degToRad(10))
  })

  it('raises orbital traverse rate through Matter Traverse Actuators and Sensor Array', () => {
    const base = pulseSortie()
    const matter = pulseSortie()
    const sensor = pulseSortie()
    matter.prestige.matterShop = { ...(matter.prestige.matterShop ?? {}), 'traverse-actuators': 4 }
    sensor.shipyard.unlockedModules.push('sensor-array')
    sensor.shipyard.coreInstances.push({ id: 'sensor-array:1', moduleId: 'sensor-array' })
    sensor.shipyard.modules = ['pulse-cannon', 'sensor-array']
    sensor.shipyard.equippedCoreIds = ['pulse-cannon:1', 'sensor-array:1']
    expect(effectiveCoreSlewRate(matter, pulseCore(matter))).toBeGreaterThan(
      effectiveCoreSlewRate(base, pulseCore(base)),
    )
    expect(effectiveCoreSlewRate(sensor, pulseCore(sensor))).toBeGreaterThan(
      effectiveCoreSlewRate(base, pulseCore(base)),
    )
    for (const state of [base, matter]) {
      const core = pulseCore(state)
      core.orbitAngle = 0
      applyPlayerCoreOrbit(core)
      setEnemies(state, [enemy({ id: 'side', x: 200, y: 0 })])
      core.currentTargetId = 'side'
      tickPlayerCoreTargeting(state, 0.1)
    }
    expect(Math.abs(pulseCore(matter).orbitAngle ?? 0)).toBeGreaterThan(
      Math.abs(pulseCore(base).orbitAngle ?? 0),
    )
  })

  it('presentation overlay uses the same orbit position and outward facing as simulation', () => {
    const state = pulseSortie()
    const core = pulseCore(state)
    core.orbitAngle = 1.1
    applyPlayerCoreOrbit(core)
    const overlay = combatOverlayGeometry(state).find((row) => row.coreInstanceId === core.coreInstanceId)
    expect(overlay?.x).toBeCloseTo(core.x)
    expect(overlay?.y).toBeCloseTo(core.y)
    expect(overlay?.heading).toBeCloseTo(playerCoreOutwardFacing(core))
  })
})
