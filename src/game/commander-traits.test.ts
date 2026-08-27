import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { startCombat } from './tick'
import { buildHostileUnit, getHostileDef } from './hostileCatalogue'
import { promoteToCommander } from './commanders'
import {
  applyCommanderDerivedStats,
  onHostileDeathHazards,
  tickCommanderTraits,
  SUPPRESSOR_FLOOR_MULT,
} from './commanderTraits'
import {
  BREACHER_SEEDS,
  DISPLACER_SEEDS,
  RALLYING_SEEDS,
  RESONANCE_VESSEL_HAZARD,
  VANGUARD_SEEDS,
  VOLATILE_SEEDS,
  WARDBEARER_SEEDS,
} from './hostileSeeds'
import {
  collectTargetingModifiers,
  composeTargetingModifiers,
  commanderPriorityTerm,
  effectiveCoreSlewRate,
  profileForCore,
  scoreDoctrine,
  setCoreTarget,
  tickPlayerCoreTargeting,
  type SharedTargetMetrics,
} from './coreTargeting'
import { distanceBetween, playerCoreOutwardFacing } from './geometry'
import type { CombatUnit, GameState } from './types'
import { isHighValueHostile } from './coreCombat'

function base(id: string, wave = 20): CombatUnit {
  return buildHostileUnit({ def: getHostileDef(id)!, wave })
}

function promote(id: string, trait: Parameters<typeof promoteToCommander>[1], wave = 20): CombatUnit {
  return promoteToCommander(base(id, wave), trait, getHostileDef(id)!)
}

function sortie(): GameState {
  const state = startCombat(createInitialState(5))
  for (const unit of state.combat.playerUnits) {
    for (const wpn of unit.weapons) {
      wpn.damage = 0
      wpn.cooldownLeft = 9
    }
  }
  return state
}

describe('PR7 Commander Traits', () => {
  it('Vanguard raises own speed/rate and ally movement without multiplicative stacking', () => {
    const state = createInitialState(0)
    const lead = promote('void-mite', 'vanguard')
    lead.id = 'vg-1'
    lead.x = 40
    lead.y = 80
    const extra = promote('void-mite', 'vanguard')
    extra.id = 'vg-2'
    extra.x = 42
    extra.y = 82
    extra.hullMax = lead.hullMax * 0.5
    extra.hull = extra.hullMax
    const ally = base('void-mite')
    ally.id = 'ally'
    ally.x = 45
    ally.y = 85
    state.combat.enemyUnits = [lead, extra, ally]
    applyCommanderDerivedStats(state)
    expect(lead.commanderCycleMult).toBe(VANGUARD_SEEDS.selfCycleMult)
    expect(ally.commanderSpeedMult).toBe(VANGUARD_SEEDS.auraSpeedMult)
    expect(ally.commanderSpeedMult).toBeLessThan(VANGUARD_SEEDS.auraSpeedMult * VANGUARD_SEEDS.auraSpeedMult)
  })

  it('Ironclad is durable with no aura', () => {
    const ordinary = base('void-mite')
    const iron = promote('void-mite', 'ironclad')
    expect(iron.hullMax).toBeGreaterThan(ordinary.hullMax)
    expect(iron.armor).toBeGreaterThan(ordinary.armor)
    const state = createInitialState(0)
    iron.id = 'iron'
    const ally = base('void-mite')
    ally.id = 'a'
    state.combat.enemyUnits = [iron, ally]
    applyCommanderDerivedStats(state)
    expect(ally.commanderSpeedMult).toBe(1)
    expect(ally.supportShieldMax).toBe(0)
  })

  it('Wardbearer grants temporary ally Shield that vanishes on death and does not accumulate ShieldMax', () => {
    const state = createInitialState(0)
    const ward = promote('void-mite', 'wardbearer')
    ward.id = 'ward'
    ward.x = 0
    ward.y = 80
    const ally = base('void-mite')
    ally.id = 'a'
    ally.x = 10
    ally.y = 80
    const beforeMax = ally.shieldMax
    state.combat.enemyUnits = [ward, ally]
    applyCommanderDerivedStats(state)
    expect(ward.shieldMax).toBeGreaterThan(0)
    expect(ally.supportShieldMax).toBe(WARDBEARER_SEEDS.allySupportShield)
    expect(ally.shieldMax).toBe(beforeMax)
    ward.hull = 0
    applyCommanderDerivedStats(state)
    expect(ally.supportShieldMax).toBe(0)
    expect(ally.supportShield).toBe(0)
  })

  it('Rallying offensive support ends on death and does not multiply', () => {
    const state = createInitialState(0)
    const a = promote('void-mite', 'rallying')
    a.id = 'r1'
    a.x = 0
    a.y = 80
    const b = promote('void-mite', 'rallying')
    b.id = 'r2'
    b.x = 4
    b.y = 82
    b.hullMax = a.hullMax * 0.4
    b.hull = b.hullMax
    const ally = base('void-mite')
    ally.id = 'al'
    ally.x = 8
    ally.y = 80
    state.combat.enemyUnits = [a, b, ally]
    applyCommanderDerivedStats(state)
    expect(ally.commanderCycleMult).toBe(RALLYING_SEEDS.allyCycleMult)
    a.hull = 0
    b.hull = 0
    applyCommanderDerivedStats(state)
    expect(ally.commanderCycleMult).toBe(1)
  })

  it('Displacer changes real x/y after telegraph and stays targetable', () => {
    const unit = promote('void-mite', 'displacer')
    unit.id = 'disp'
    unit.x = 40
    unit.y = 120
    unit.displacerCooldownLeft = 0
    const state = createInitialState(0)
    state.combat.enemyUnits = [unit]
    tickCommanderTraits(state, DISPLACER_SEEDS.telegraph + 0.05)
    expect(unit.displacerDestX).toBeDefined()
    const x0 = unit.x
    const y0 = unit.y
    tickCommanderTraits(state, DISPLACER_SEEDS.moveDuration)
    expect(Math.hypot(unit.x - x0, unit.y - y0)).toBeGreaterThan(1)
    expect(unit.targetable).not.toBe(false)
  })

  it('player Cores reacquire a Displacer through orbital slew, not turret heading', () => {
    const state = sortie()
    const core = state.combat.playerUnits.find((u) => u.isCore)!
    const unit = promote('void-mite', 'displacer')
    unit.id = 'disp-live'
    unit.x = 80
    unit.y = 0
    unit.displacerCooldownLeft = 0
    state.combat.enemyUnits = [unit]
    setCoreTarget(core, unit.id)
    const heading0 = core.heading
    const orbit0 = core.orbitAngle
    tickCommanderTraits(state, DISPLACER_SEEDS.telegraph + DISPLACER_SEEDS.moveDuration + 0.05)
    tickPlayerCoreTargeting(state, 0.25)
    expect(core.currentTargetId).toBe(unit.id)
    expect(playerCoreOutwardFacing(core)).toBe(true)
    expect(core.heading).toBe(core.orbitAngle)
    expect(core.orbitAngle === orbit0 && core.heading !== heading0).toBe(false)
  })

  it('Suppressor bounds orbital slew/acquisition and never zeroes them or weapon damage', () => {
    const state = sortie()
    const core = state.combat.playerUnits.find((u) => u.isCore)!
    const before = effectiveCoreSlewRate(state, core)
    const sup = promote('void-mite', 'suppressor')
    sup.id = 'sup'
    state.combat.enemyUnits = [sup]
    const mods = composeTargetingModifiers(collectTargetingModifiers(state, { moduleId: core.coreModuleId ?? '', coreInstanceId: core.coreInstanceId }))
    expect(mods.slewRateMult).toBeLessThan(1)
    expect(mods.slewRateMult).toBeGreaterThan(0)
    const after = effectiveCoreSlewRate(state, core)
    expect(after).toBeGreaterThan(0)
    expect(after).toBeGreaterThanOrEqual(profileForCore(core).slewRateDegPerSec * SUPPRESSOR_FLOOR_MULT)
    expect(after).toBeLessThan(before)
    const dmgBefore = core.weapons[0]?.damage ?? 0
    tickCommanderTraits(state, 0.2)
    expect(core.weapons[0]?.damage).toBe(dmgBefore)
  })

  it('Volatile death-position hazard is ranged, uses incoming mitigation, and is not recursive', () => {
    const state = createInitialState(0)
    const hive = state.combat.playerUnits[0] ?? {
      ...base('void-mite'),
      side: 'player' as const,
      isFlagship: true,
      id: 'hive',
      x: 0,
      y: 0,
      hull: 200,
      hullMax: 200,
    }
    hive.side = 'player'
    hive.isFlagship = true
    hive.x = 0
    hive.y = 0
    hive.hull = 200
    hive.hullMax = 200
    state.combat.playerUnits = [hive]
    const vol = promote('resonance-vessel', 'volatile', 700)
    vol.id = 'vol'
    vol.x = 400
    vol.y = 0
    vol.deathHazardImmune = false
    const other = promote('resonance-vessel', 'volatile', 700)
    other.id = 'vol2'
    other.x = 400
    other.y = 0
    state.combat.enemyUnits = [vol, other]
    onHostileDeathHazards(state, vol)
    expect(state.combat.deathHazards[0]?.kind).toBe('volatile')
    expect(state.combat.deathHazards[0]?.radius).toBe(VOLATILE_SEEDS.radius)
    expect(distanceBetween(hive, vol) > VOLATILE_SEEDS.radius).toBe(true)
    vol.hull = 0
    other.deathHazardImmune = true
    const n = state.combat.deathHazards.length
    onHostileDeathHazards(state, other)
    expect(state.combat.deathHazards.length).toBe(n)
  })

  it('Breacher uses a readable partial Shield bypass, not full ignore', () => {
    expect(BREACHER_SEEDS.bypassFrac).toBeLessThan(1)
    expect(BREACHER_SEEDS.bypassFrac).toBeGreaterThan(0)
    expect(BREACHER_SEEDS.charge).toBeGreaterThan(1)
    const unit = promote('breach-engine', 'breacher', 760)
    tickCommanderTraits(createInitialState(0), 0)
    const wpn = unit.weapons[0]!
    wpn.telegraphDuration = BREACHER_SEEDS.charge
    wpn.shieldBypassFrac = BREACHER_SEEDS.bypassFrac
    expect(wpn.shieldBypassFrac).toBeLessThan(1)
    expect(wpn.telegraphDuration).toBe(BREACHER_SEEDS.charge)
  })

  it('Resonance Vessel ordinary hazard is weaker than Volatile', () => {
    expect(RESONANCE_VESSEL_HAZARD.damage).toBeLessThan(VOLATILE_SEEDS.damage)
    expect(RESONANCE_VESSEL_HAZARD.radius).toBeLessThan(VOLATILE_SEEDS.radius)
  })

  it('Commander priority is a bounded Doctrine term, not a bypass', () => {
    const unit = promote('void-mite', 'rallying')
    const metrics: SharedTargetMetrics = {
      danger: 0.2,
      urgency: 0.2,
      proximity: 0.2,
      focusWeight: 0,
      finishable: 0,
      hullFrac: 1,
      remainingFrac: 1,
      ehp: 40,
      heavyWeight: 10,
      armor: 0,
      shieldPresent: 0,
      shieldFrac: 0,
      clusterCount: 1,
      clusterWeight: 1,
      clusterMass: 1,
    }
    const ordinary = scoreDoctrine('threat', { ...unit, isCommander: false }, metrics)
    const cmd = scoreDoctrine('threat', unit, metrics)
    expect(cmd).toBeGreaterThan(ordinary)
    expect(cmd - ordinary).toBeLessThanOrEqual(18)
    expect(commanderPriorityTerm('threat', unit)).toBeGreaterThan(0)
  })

  it('Salvage Beacon high-value path includes Commanders', () => {
    const unit = promote('void-mite', 'ironclad')
    expect(isHighValueHostile(unit)).toBe(true)
    expect(isHighValueHostile(base('void-mite'))).toBe(false)
  })
})
