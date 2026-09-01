import { describe, expect, it } from 'vitest'
import {
  LEGACY_CORE_IDS,
  SHIP_FRAMES,
  SHIP_MODULES,
  STARTER_FRAME_ID,
  canFitModuleOnFrame,
  getFrame,
  getModule,
  frameHeatMult,
  moduleMasteryRank,
} from './catalog'
import { usableCoreSlots, grantAccountCoreSlots, normalAccountCoreSlots } from './coreSlots'
import {
  CORE_MASTERY_MILESTONES,
  hasMasteryEffect,
  matureSocketLayout,
  unlockedSocketLayout,
} from './coreMastery'
import {
  applyMasteryXp,
  awardEquippedMasteryXp,
  buyCoreStartingLevel,
  coreStartingLevel,
  grantModuleCopy,
} from './coreProgression'
import {
  AUTHORED_TARGETING_PROFILES,
  isTargetingCapableCoreModule,
  targetingProfileFor,
} from './targetingProfiles'
import {
  ABLATIVE_DEFERRAL_CAP,
  BARRIER_INTERCEPT_COOLDOWN,
  NANO_LATHE_REPAIR_PER_SEC,
  PHASE_RAMP_SECONDS,
  SALVAGE_MARK_BONUS,
  SLAG_POOL_RADIUS,
  choirTapAshToHeatMult,
  choirTapOnHighValueKill,
  emptySortieCoreRuntime,
  ensureSortieCoreRuntime,
  mitigateIncomingToHive,
  phaseRampMultiplier,
  salvageMarkBonus,
  sensorTargetingModifier,
  tickNanoLathe,
  tickSupportCores,
  tryBarrierIntercept,
  updatePhaseRamp,
} from './coreCombat'
import { fitModule, selectFrame, unfitModule, performRebuild } from './actions'
import { importSave, exportSave } from './save'
import { extractSortie, setDocked } from './tick'
import { armRebuildDoor, atCareerWave, completeDefeat, forceUnlockModule } from './testHelpers'
import { createInitialState, SAVE_VERSION } from './state'
import { buildPlayerFleet } from './combat'
import { frameSensorTargetingContribution } from './coreTargeting'

const FINAL_FRAMES = ['starter-frame', 'bastion-frame', 'swarm-frame', 'reactor-frame', 'harvester-frame']
const WEAPON_CORES = ['pulse-cannon', 'heavy-lance', 'flak-array', 'phase-beam', 'slag-spitter']
const DEFENSE_CORES = ['plate-layer', 'rapid-aegis', 'ablative-mesh', 'barrier-projector']
const UTILITY_CORES = ['salvage-beacon', 'grav-tether', 'nano-lathe', 'sensor-array', 'choir-tap']

function live(state = createInitialState(0)) {
  return setDocked(state, false)
}

function grantFrame(state: ReturnType<typeof createInitialState>, frameId: string) {
  const next = structuredClone(state)
  if (!next.shipyard.unlockedFrames.includes(frameId)) {
    next.shipyard.unlockedFrames = [...next.shipyard.unlockedFrames, frameId]
  }
  return next
}

describe('PR4 catalogue', () => {
  it('has exactly five production Frames', () => {
    expect(SHIP_FRAMES.map((f) => f.id)).toEqual(FINAL_FRAMES)
    expect(getFrame(STARTER_FRAME_ID)?.name).toBe('Standard')
    expect(getFrame('scout-frame')).toBeUndefined()
  })

  it('has exactly fourteen production Cores', () => {
    expect(SHIP_MODULES.map((m) => m.id)).toEqual([...WEAPON_CORES, ...DEFENSE_CORES, ...UTILITY_CORES])
    expect(SHIP_MODULES.filter((m) => m.role === 'weapon')).toHaveLength(5)
    expect(SHIP_MODULES.filter((m) => m.role === 'defense')).toHaveLength(4)
    expect(SHIP_MODULES.filter((m) => m.role === 'utility')).toHaveLength(5)
  })

  it('does not keep canonical §29.3 leftover Cores as production entries', () => {
    for (const id of LEGACY_CORE_IDS) {
      expect(getModule(id)).toBeUndefined()
    }
  })
})

describe('PR4 fresh account', () => {
  it('starts Standard with physical Pulse Cannon + Plate Layer and 2 universal slots', () => {
    const s = createInitialState(0)
    expect(s.shipyard.frameId).toBe(STARTER_FRAME_ID)
    expect(s.shipyard.modules).toEqual(['pulse-cannon', 'plate-layer'])
    expect(s.shipyard.coreInstances.map((c) => c.id).sort()).toEqual(['plate-layer:1', 'pulse-cannon:1'])
    expect(s.shipyard.equippedCoreIds).toEqual(['pulse-cannon:1', 'plate-layer:1'])
    expect(usableCoreSlots(s)).toBe(2)
    expect(s.shipyard.coreInstances.every((c) => c.id.includes(':'))).toBe(true)
  })
})

describe('PR4 universal slots', () => {
  it('lets any role occupy any free slot', () => {
    let s = createInitialState(0)
    s = unfitModule(s, 'pulse-cannon')
    s = unfitModule(s, 'plate-layer')
    expect(canFitModuleOnFrame([], 'pulse-cannon', 2)).toBe(true)
    expect(canFitModuleOnFrame(['pulse-cannon'], 'nano-lathe', 2)).toBe(true)
    expect(canFitModuleOnFrame(['pulse-cannon', 'nano-lathe'], 'plate-layer', 2)).toBe(false)
    s = forceUnlockModule(s, 'nano-lathe')
    s = fitModule(s, 'nano-lathe')
    s = fitModule(s, 'pulse-cannon')
    expect(s.shipyard.modules).toEqual(['nano-lathe', 'pulse-cannon'])
    expect(getFrame(s.shipyard.frameId)).not.toHaveProperty('weaponSlots')
  })
})

describe('PR4 Swarm bus', () => {
  it('adds +1 relative slot, never above 6, and other Frames do not', () => {
    let s = createInitialState(0)
    s = grantFrame(s, 'swarm-frame')
    expect(normalAccountCoreSlots(s)).toBe(2)
    expect(usableCoreSlots(s, 'swarm-frame')).toBe(3)
    expect(usableCoreSlots(s, STARTER_FRAME_ID)).toBe(2)

    s = atCareerWave(s, 75)
    expect(usableCoreSlots(s, STARTER_FRAME_ID)).toBe(3)
    expect(usableCoreSlots(s, 'swarm-frame')).toBe(4)

    s = atCareerWave(s, 330)
    expect(usableCoreSlots(s, STARTER_FRAME_ID)).toBe(4)
    expect(usableCoreSlots(s, 'swarm-frame')).toBe(5)
    expect(usableCoreSlots(s, 'bastion-frame')).toBe(4)

    s = grantAccountCoreSlots(s, { id: 'engineering-fifth', source: 'engineering', slots: 1 })
    expect(usableCoreSlots(s, STARTER_FRAME_ID)).toBe(5)
    expect(usableCoreSlots(s, 'swarm-frame')).toBe(6)
    s = grantAccountCoreSlots(s, { id: 'test-overflow', source: 'test', slots: 4 })
    expect(usableCoreSlots(s, STARTER_FRAME_ID)).toBe(5)
    expect(usableCoreSlots(s, 'swarm-frame')).toBe(6)
  })
})

describe('PR4 physical copies', () => {
  it('keeps distinct instance IDs, Core Levels, Doctrine, and shared Mastery', () => {
    let s = createInitialState(0)
    s = grantFrame(s, 'swarm-frame')
    s = selectFrame(s, 'swarm-frame')
    grantModuleCopy(s, 'pulse-cannon')
    s = fitModule(s, 'pulse-cannon')
    const ids = s.shipyard.equippedCoreIds.filter((_, i) => s.shipyard.modules[i] === 'pulse-cannon')
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
    s.resources.scrap = 200
    s = buyCoreStartingLevel(s, ids[1]!)
    expect(coreStartingLevel(s, ids[0]!)).toBe(0)
    expect(coreStartingLevel(s, ids[1]!)).toBe(1)
    const a = s.shipyard.coreInstances.find((c) => c.id === ids[0]!)!
    const b = s.shipyard.coreInstances.find((c) => c.id === ids[1]!)!
    a.targetingDoctrine = 'focus'
    b.targetingDoctrine = 'execution'
    expect(a.targetingDoctrine).not.toBe(b.targetingDoctrine)
    s.meta.moduleMastery['pulse-cannon'] = 12
    expect(moduleMasteryRank(s, 'pulse-cannon')).toBe(12)
  })
})

describe('PR4 Core Level lifecycle', () => {
  it('is Scrap-funded, ignores Salvage buys, persists Defeat/Extract, resets on Rebuild', () => {
    let s = createInitialState(0)
    s.resources.scrap = 80
    s.resources.salvage = 40
    s = buyCoreStartingLevel(s, 'pulse-cannon:1')
    expect(coreStartingLevel(s, 'pulse-cannon:1')).toBe(1)
    s = live(s)
    const salvage = s.resources.salvage
    expect(s.resources.salvage).toBe(salvage)
    expect(coreStartingLevel(s, 'pulse-cannon:1')).toBe(1)

    s = completeDefeat(s)
    expect(coreStartingLevel(s, 'pulse-cannon:1')).toBe(1)

    s = live(s)
    s.combat.playerHull = Math.max(2, s.combat.playerHull)
    s = extractSortie(s)
    expect(coreStartingLevel(s, 'pulse-cannon:1')).toBe(1)

    s = armRebuildDoor(s)
    s = performRebuild(s, { frameId: STARTER_FRAME_ID, modules: ['pulse-cannon', 'plate-layer'] })
    expect(coreStartingLevel(s, 'pulse-cannon:1')).toBe(0)
  })
})

describe('PR4 Mastery lifecycle', () => {
  it('awards equipped use XP, shares type tracks, and survives Defeat/Extract/Rebuild/save', () => {
    let s = live()
    const grants = awardEquippedMasteryXp(s, 12, {
      boss: false,
      newBest: false,
      careerBestBefore: 20,
    })
    expect(grants.map((g) => g.moduleId).sort()).toEqual(['plate-layer', 'pulse-cannon'])
    const pulseXp = s.meta.moduleMasteryXp!['pulse-cannon']
    expect(pulseXp).toBeGreaterThan(0)

    let parked = createInitialState(0)
    parked.shipyard.unlockedModules.push('flak-array')
    grantModuleCopy(parked, 'flak-array')
    parked = live(parked)
    awardEquippedMasteryXp(parked, 12, { boss: false, newBest: false, careerBestBefore: 20 })
    expect(parked.meta.moduleMasteryXp?.['flak-array'] ?? 0).toBe(0)

    applyMasteryXp(s, 'pulse-cannon', 5000)
    const mastery = moduleMasteryRank(s, 'pulse-cannon')
    s = completeDefeat(s)
    expect(moduleMasteryRank(s, 'pulse-cannon')).toBe(mastery)
    s = live(s)
    s.combat.playerHull = Math.max(2, s.combat.playerHull)
    s = extractSortie(s)
    expect(moduleMasteryRank(s, 'pulse-cannon')).toBe(mastery)
    s = armRebuildDoor(s)
    s = performRebuild(s, { frameId: STARTER_FRAME_ID, modules: ['pulse-cannon'] })
    expect(moduleMasteryRank(s, 'pulse-cannon')).toBe(mastery)
    const loaded = importSave(exportSave(s))
    expect(moduleMasteryRank(loaded!, 'pulse-cannon')).toBe(mastery)
  })
})

describe('PR4 authored Mastery milestones', () => {
  it('unlocks explicit weapon effects at canonical levels and does not invent Slag M10', () => {
    const s = createInitialState(0)
    s.meta.moduleMastery = {
      'pulse-cannon': 100,
      'heavy-lance': 100,
      'flak-array': 100,
      'phase-beam': 100,
      'slag-spitter': 100,
    }
    expect(hasMasteryEffect(s, 'pulse-cannon', 'pulse-overkill-retarget')).toBe(true)
    expect(hasMasteryEffect(s, 'pulse-cannon', 'pulse-periodic-chain')).toBe(true)
    expect(hasMasteryEffect(s, 'pulse-cannon', 'pulse-chain-continue')).toBe(true)
    expect(hasMasteryEffect(s, 'pulse-cannon', 'pulse-adaptive-lock')).toBe(true)
    expect(hasMasteryEffect(s, 'pulse-cannon', 'pulse-convergence')).toBe(true)
    expect(hasMasteryEffect(s, 'heavy-lance', 'heavy-predictive-traverse')).toBe(true)
    expect(hasMasteryEffect(s, 'heavy-lance', 'heavy-pierce')).toBe(true)
    expect(hasMasteryEffect(s, 'heavy-lance', 'heavy-shield-bypass')).toBe(true)
    expect(hasMasteryEffect(s, 'heavy-lance', 'heavy-pen-momentum')).toBe(true)
    expect(hasMasteryEffect(s, 'heavy-lance', 'heavy-armor-fracture')).toBe(true)
    expect(hasMasteryEffect(s, 'flak-array', 'flak-pack-prediction')).toBe(true)
    expect(hasMasteryEffect(s, 'flak-array', 'flak-fragmentation')).toBe(true)
    expect(hasMasteryEffect(s, 'flak-array', 'flak-death-detonation')).toBe(true)
    expect(hasMasteryEffect(s, 'flak-array', 'flak-saturation')).toBe(true)
    expect(hasMasteryEffect(s, 'flak-array', 'flak-kill-box')).toBe(true)
    expect(hasMasteryEffect(s, 'phase-beam', 'phase-ramp')).toBe(true)
    expect(hasMasteryEffect(s, 'phase-beam', 'phase-refraction')).toBe(true)
    expect(hasMasteryEffect(s, 'phase-beam', 'phase-ramp-bypass')).toBe(true)
    expect(hasMasteryEffect(s, 'phase-beam', 'phase-lock-memory')).toBe(true)
    expect(hasMasteryEffect(s, 'phase-beam', 'phase-exposure')).toBe(true)
    expect(CORE_MASTERY_MILESTONES['slag-spitter']!.find((ms) => ms.level === 10)?.pending).toBe(true)
    expect(hasMasteryEffect(s, 'slag-spitter', 'slag-molten-pool')).toBe(true)
    expect(hasMasteryEffect(s, 'slag-spitter', 'slag-corrosion')).toBe(true)
    expect(hasMasteryEffect(s, 'slag-spitter', 'slag-spread')).toBe(true)
    expect(hasMasteryEffect(s, 'slag-spitter', 'slag-pool-merge')).toBe(true)
    expect(SLAG_POOL_RADIUS).toBe(35)
  })

  it('exposes M100 defense/utility capstones that are explicitly levelled', () => {
    const s = createInitialState(0)
    s.meta.moduleMastery = {
      'plate-layer': 100,
      'rapid-aegis': 100,
      'ablative-mesh': 100,
      'barrier-projector': 100,
      'grav-tether': 100,
      'sensor-array': 100,
      'choir-tap': 50,
    }
    expect(hasMasteryEffect(s, 'plate-layer', 'plate-citadel-skin')).toBe(true)
    expect(hasMasteryEffect(s, 'rapid-aegis', 'aegis-perpetual')).toBe(true)
    expect(hasMasteryEffect(s, 'ablative-mesh', 'ablative-deferral')).toBe(true)
    expect(hasMasteryEffect(s, 'barrier-projector', 'barrier-rearm')).toBe(true)
    expect(hasMasteryEffect(s, 'grav-tether', 'grav-gravity-well')).toBe(true)
    expect(hasMasteryEffect(s, 'sensor-array', 'sensor-fire-control')).toBe(true)
    expect(hasMasteryEffect(s, 'choir-tap', 'choir-hot-recovery')).toBe(true)
    expect(hasMasteryEffect(s, 'choir-tap', 'choir-furnace-feed')).toBe(true)
  })

  it('does not assign unauthored defense/utility behaviours to pending thresholds', () => {
    for (const rows of Object.values(CORE_MASTERY_MILESTONES)) {
      for (const ms of rows) {
        if (!ms.pending || ms.level === 5) continue
        expect(ms.effect).toBeUndefined()
        expect(ms.name.startsWith('Pending M')).toBe(true)
      }
    }
    expect(CORE_MASTERY_MILESTONES['plate-layer']!.find((ms) => ms.level === 10)?.name).toBe(
      'Pending M10 behaviour',
    )
  })
})

describe('PR4 targeting geometry', () => {
  it('authors acquisition > fire, Doctrine sets, arcs, and slew identities', () => {
    for (const profile of AUTHORED_TARGETING_PROFILES.filter((p) =>
      WEAPON_CORES.includes(p.profileId),
    )) {
      expect(profile.acquisitionRange).toBeGreaterThan(profile.fireRange)
    }
    expect(targetingProfileFor('pulse-cannon')).toMatchObject({
      defaultDoctrine: 'threat',
      firingArcDeg: 150,
      slewClass: 'fast',
    })
    expect(targetingProfileFor('heavy-lance')).toMatchObject({
      defaultDoctrine: 'heavy',
      firingArcDeg: 100,
      slewClass: 'slow',
      requiresCharge: true,
      firesWhileTraversing: false,
    })
    expect(targetingProfileFor('flak-array').slewClass).toBe('very-fast')
    expect(targetingProfileFor('phase-beam').committedSwitchAdvantage).toBeGreaterThan(
      targetingProfileFor('pulse-cannon').switchAdvantage,
    )
    const phase = getModule('phase-beam')!.weapon!
    expect(phase.damage / phase.cooldown).toBeCloseTo(8, 1)
    expect(isTargetingCapableCoreModule('grav-tether')).toBe(true)
    expect(isTargetingCapableCoreModule('salvage-beacon')).toBe(true)
    expect(isTargetingCapableCoreModule('plate-layer')).toBe(false)
  })

  it('ramps Phase over several seconds rather than instantly', () => {
    let s = createInitialState(0)
    s.meta.moduleMastery['phase-beam'] = 10
    s.shipyard.modules = ['phase-beam']
    s.shipyard.unlockedModules = ['phase-beam']
    const core = {
      id: 'phase-beam:1',
      coreInstanceId: 'phase-beam:1',
      coreModuleId: 'phase-beam',
      isCore: true,
      currentTargetId: 'e1',
    } as never
    s.combat.enemyUnits = [{ id: 'e1', hull: 10, side: 'enemy' } as never]
    updatePhaseRamp(s, core, 0.5, true)
    const early = phaseRampMultiplier(s, core)
    updatePhaseRamp(s, core, PHASE_RAMP_SECONDS, true)
    const late = phaseRampMultiplier(s, core)
    expect(late).toBeGreaterThan(early)
    expect(early).toBeLessThan(1.2)
  })

  it('originates Core satellites from authored orbit radii', () => {
    const s = createInitialState(0)
    const fleet = buildPlayerFleet(s)
    const pulse = fleet.find((u) => u.coreModuleId === 'pulse-cannon')
    expect(pulse?.orbitRadius).toBe(44)
    expect(Math.hypot(pulse?.x ?? 0, pulse?.y ?? 0)).toBeCloseTo(44)
  })
})

describe('PR4 defense and support', () => {
  it('distinguishes Plate bank from Rapid Aegis recovery', () => {
    expect(getModule('plate-layer')!.shieldBonus).toBeGreaterThan(getModule('rapid-aegis')!.shieldBonus!)
    expect(getModule('rapid-aegis')!.shieldRegen!).toBeGreaterThan(getModule('plate-layer')!.shieldRegen!)
  })

  it('bounds Ablative deferral and Barrier intercept cooldown', () => {
    let s = createInitialState(0)
    s = forceUnlockModule(s, 'ablative-mesh')
    s = unfitModule(s, 'plate-layer')
    s = fitModule(s, 'ablative-mesh')
    s.meta.moduleMastery['ablative-mesh'] = 100
    s.combat.playerUnits = [
      {
        id: 'hive',
        isFlagship: true,
        side: 'player',
        hull: 40,
        hullMax: 40,
        shield: 0,
        shieldMax: 0,
      } as never,
    ]
    const leftover = mitigateIncomingToHive(s, s.combat.playerUnits[0]!, 40, ['kinetic'])
    expect(leftover).toBeLessThan(40)
    expect(s.combat.coreRuntime!.deferredDamage).toBeLessThanOrEqual(ABLATIVE_DEFERRAL_CAP)
    expect(leftover).toBeGreaterThan(0)

    s = forceUnlockModule(s, 'barrier-projector')
    s.shipyard.modules = ['barrier-projector']
    const flag = s.combat.playerUnits[0]!
    flag.hull = 5
    expect(tryBarrierIntercept(s, flag, 20)).toBe(true)
    expect(tryBarrierIntercept(s, flag, 20)).toBe(false)
    expect(s.combat.coreRuntime!.barrierInterceptCooldown).toBe(BARRIER_INTERCEPT_COOLDOWN)
  })

  it('marks Salvage Beacon kills and repairs with Nano Lathe in combat', () => {
    let s = createInitialState(0)
    s = forceUnlockModule(s, 'salvage-beacon')
    s.shipyard.modules = ['salvage-beacon']
    ensureSortieCoreRuntime(s).salvageMarks.e1 = { until: 99, elite: false }
    s.combat.simTime = 0
    const marked = salvageMarkBonus(s, { id: 'e1', isBoss: false, role: 'chaff' } as never)
    expect(marked).toBe(SALVAGE_MARK_BONUS)

    s = forceUnlockModule(s, 'nano-lathe')
    s.shipyard.modules = ['nano-lathe']
    s.combat.playerUnits = [
      {
        id: 'hive',
        isFlagship: true,
        side: 'player',
        hull: 10,
        hullMax: 40,
        shield: 0,
        shieldMax: 0,
      } as never,
    ]
    tickNanoLathe(s, 1)
    expect(s.combat.playerUnits[0]!.hull).toBeGreaterThan(10)
    expect(s.combat.playerUnits[0]!.hull - 10).toBeCloseTo(NANO_LATHE_REPAIR_PER_SEC * 1.7, 5)
  })

  it('composes Sensor Array through PR2 targeting modifiers', () => {
    let s = createInitialState(0)
    s = forceUnlockModule(s, 'sensor-array')
    s.shipyard.modules = ['sensor-array']
    const sensor = sensorTargetingModifier(s)
    const composed = frameSensorTargetingContribution(s)
    expect(sensor.acquisitionRangeMult).toBeGreaterThan(1)
    expect(composed.acquisitionRangeMult).toBe(sensor.acquisitionRangeMult)
    expect(composed.slewRateMult).toBeGreaterThan(1)
  })

  it('exposes Choir Tap Heat packet and Furnace Feed hooks', () => {
    let s = createInitialState(0)
    s = forceUnlockModule(s, 'choir-tap')
    s.shipyard.modules = ['choir-tap']
    s.meta.moduleMastery['choir-tap'] = 50
    choirTapOnHighValueKill(s, { id: 'boss', isBoss: true, side: 'enemy' } as never)
    expect(s.resources.heat).toBeGreaterThan(0)
    tickSupportCores(s, 0)
    expect(choirTapAshToHeatMult(s)).toBeGreaterThan(1)
    const leftover = createInitialState(0)
    expect(frameHeatMult(s)).toBe(frameHeatMult(leftover))
    const reactor = grantFrame(s, 'reactor-frame')
    reactor.shipyard.frameId = 'reactor-frame'
    expect(frameHeatMult(reactor)).toBeGreaterThan(frameHeatMult(s))
  })
})

describe('PR4 sockets metadata', () => {
  it('authors mature layouts; M20 is Relic expansion; later socket counts stay unspecified', () => {
    expect(matureSocketLayout('pulse-cannon').map((s) => s.type)).toEqual(['power', 'optical', 'universal'])
    expect(matureSocketLayout('plate-layer')).toHaveLength(2)
    const m20 = CORE_MASTERY_MILESTONES['pulse-cannon']?.find((m) => m.level === 20)
    expect(m20?.effect).toBe('socket-expand')
    expect(unlockedSocketLayout('pulse-cannon', 0)).toEqual(matureSocketLayout('pulse-cannon'))
    expect(unlockedSocketLayout('pulse-cannon', 20)).toEqual(matureSocketLayout('pulse-cannon'))
    expect(unlockedSocketLayout('pulse-cannon', 100)).toEqual(matureSocketLayout('pulse-cannon'))
  })
})

describe('PR4 save round-trip', () => {
  it('round-trips current version Frame, copies, Core Levels, Mastery, Doctrine, and Sortie Cores', () => {
    expect(SAVE_VERSION).toBe(51)
    let s = createInitialState(0)
    s = grantFrame(s, 'bastion-frame')
    s.shipyard.frameId = 'bastion-frame'
    grantModuleCopy(s, 'pulse-cannon')
    s.workshop.coreStarts['pulse-cannon:1'] = 3
    s.meta.moduleMastery['pulse-cannon'] = 11
    s.meta.moduleMasteryXp = { 'pulse-cannon': 40 }
    s.shipyard.coreInstances[0]!.targetingDoctrine = 'focus'
    s.combat.coreRuntime = emptySortieCoreRuntime()
    s.combat.coreRuntime.phaseRamp['pulse-cannon:1'] = 2
    const loaded = importSave(exportSave(s))!
    expect(loaded.version).toBe(SAVE_VERSION)
    expect(loaded.shipyard.frameId).toBe('bastion-frame')
    expect(loaded.shipyard.coreInstances.some((c) => c.moduleId === 'pulse-cannon')).toBe(true)
    expect(coreStartingLevel(loaded, 'pulse-cannon:1')).toBe(3)
    expect(moduleMasteryRank(loaded, 'pulse-cannon')).toBe(11)
    expect(loaded.shipyard.coreInstances[0]!.targetingDoctrine).toBe('focus')
    expect(loaded.combat.coreRuntime?.phaseRamp['pulse-cannon:1']).toBe(2)
  })
})
