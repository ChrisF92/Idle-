import { afterEach, describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  encounterForWave,
  resetEncounterModifierProvider,
} from './encounterGenerator'
import { packDps, packEhp, packThreat, threatBudgetForWave } from './threatBudget'
import {
  planCommanderEvent,
  promoteToCommander,
} from './commanders'
import {
  applyCommanderDerivedStats,
  movementSpeed,
} from './commanderTraits'
import {
  buildHostileUnit,
  getHostileDef,
  HOSTILE_DEFS,
} from './hostileCatalogue'
import {
  COMMANDER_PROMOTION,
  COMMANDER_SELF_THREAT_SHARE,
  COMMANDER_WAVE_THREAT_MULT,
  CHOIR_CROWN_SEEDS,
  VANGUARD_SEEDS,
} from './hostileSeeds'
import { productionBossProvider, BOSS_DEFS } from './bossRegistry'
import { tickChoirCrown } from './choirCrown'
import {
  admitUnitToPackage,
  createWavePackage,
  packageHasLivingOrPending,
} from './waveRuntime'
import { bossCodexLines, hostileCodexLines } from './codex'
import { bossClearMilestoneId, recordBossClearSources } from './bossClear'
import * as combatExports from './combat'
import type { CombatUnit, GameState } from './types'

function stateForSeed(seed: number): GameState {
  const state = createInitialState(0)
  state.combat.sortieSeed = seed
  state.combat.packages = []
  return state
}

function commanderFrom(
  trait: 'vanguard' | 'wardbearer' | 'rallying',
  wave = 200,
): CombatUnit {
  const def = getHostileDef('void-mite')!
  return promoteToCommander(buildHostileUnit({ def, wave }), trait, def)
}

afterEach(() => resetEncounterModifierProvider())

describe('PR7 correction A — controlled threat budgets', () => {
  it('keeps ordinary same-Wave seeds tightly budgeted and broadly comparable', () => {
    for (const wave of [41, 201, 401, 601]) {
      const rows = Array.from({ length: 24 }, (_, seed) => encounterForWave(wave, 1, stateForSeed(seed + 1)))
      const spent = rows.map((row) => row.threat!.spent)
      const ehp = rows.map((row) => packEhp(row.units))
      const dps = rows.map((row) => packDps(row.units))
      for (const value of spent) {
        expect(value / threatBudgetForWave(wave)).toBeGreaterThanOrEqual(0.98)
        expect(value / threatBudgetForWave(wave)).toBeLessThanOrEqual(1.02)
      }
      expect(Math.max(...ehp) / Math.min(...ehp)).toBeLessThan(1.35)
      expect(Math.max(...dps) / Math.min(...dps)).toBeLessThan(1.35)
    }
  })

  it('targets Commander Waves at 1.30–1.50x and enforces Commander self share', () => {
    for (const wave of [40, 290, 740, 890]) {
      for (const seed of [1, 7, 19, 43]) {
        const row = encounterForWave(wave, 1, stateForSeed(seed))
        const ratio = row.threat!.spent / threatBudgetForWave(wave)
        expect(ratio).toBeGreaterThanOrEqual(1.3)
        expect(ratio).toBeLessThanOrEqual(1.5)
        expect(row.threat!.budget / threatBudgetForWave(wave)).toBeCloseTo(COMMANDER_WAVE_THREAT_MULT, 6)
        const commander = row.units.find((unit) => unit.isCommander)!
        const selfShare = packThreat([commander]) / packThreat(row.units)
        expect(selfShare).toBeCloseTo(COMMANDER_SELF_THREAT_SHARE, 2)
      }
    }
  })
})

describe('PR7 correction B — Commander eligibility and runtime', () => {
  it('keeps first-contact collisions ordinary and promotes only already-known hostiles', () => {
    for (const wave of [30, 140, 290, 740]) {
      const row = encounterForWave(wave, 1, stateForSeed(wave + 3))
      const commander = row.units.find((unit) => unit.isCommander)!
      const commanderDef = getHostileDef(commander.hostileId)!
      expect(commanderDef.firstContactWave).toBeLessThan(wave)
      const contact = HOSTILE_DEFS.find((def) => def.firstContactWave === wave)!
      expect(row.units.some((unit) => !unit.isCommander && unit.hostileId === contact.id)).toBe(true)
    }
  })

  it('marks pending compatibility as provisional rather than authored', () => {
    const plan = planCommanderEvent(290, 17)
    const def = getHostileDef(plan.hostileId)!
    expect(def.traitCompatibilityStatus).toBe('pending')
    expect(def.traitCompatibility).toBeNull()
    expect(plan.compatibilityStatus).toBe('provisional')
    expect(JSON.stringify(hostileCodexLines(def))).not.toMatch(/compatib/i)
  })

  it('applies Vanguard effective self-speed exactly once', () => {
    const def = getHostileDef('void-mite')!
    const base = buildHostileUnit({ def, wave: 20 })
    const baseSpeed = base.speed
    const commander = promoteToCommander(base, 'vanguard', def)
    const state = createInitialState(0)
    state.combat.enemyUnits = [commander]
    applyCommanderDerivedStats(state)
    expect(movementSpeed(commander)).toBeCloseTo(
      baseSpeed * COMMANDER_PROMOTION.pending.speed * VANGUARD_SEEDS.selfSpeedMult,
      8,
    )
  })

  it('resolves same-Trait auras per recipient and clears stale Wardbearer Shield', () => {
    const state = createInitialState(0)
    const vStrong = commanderFrom('vanguard')
    const vWeak = commanderFrom('vanguard')
    vStrong.id = 'v-strong'
    vWeak.id = 'v-weak'
    vStrong.x = 0; vStrong.y = 0; vStrong.hullMax *= 2
    vWeak.x = 300; vWeak.y = 0
    const nearStrong = buildHostileUnit({ def: getHostileDef('void-mite')!, wave: 200 })
    const nearWeak = buildHostileUnit({ def: getHostileDef('void-mite')!, wave: 200 })
    nearStrong.id = 'ally-a'; nearStrong.x = 20; nearStrong.y = 0
    nearWeak.id = 'ally-b'; nearWeak.x = 280; nearWeak.y = 0
    state.combat.enemyUnits = [vStrong, vWeak, nearStrong, nearWeak]
    applyCommanderDerivedStats(state)
    expect(nearStrong.commanderSpeedMult).toBeCloseTo(VANGUARD_SEEDS.auraSpeedMult, 8)
    expect(nearWeak.commanderSpeedMult).toBeCloseTo(VANGUARD_SEEDS.auraSpeedMult, 8)

    const ward = commanderFrom('wardbearer')
    ward.id = 'ward'; ward.x = 0; ward.y = 0
    nearStrong.x = 20; nearStrong.y = 0
    state.combat.enemyUnits = [ward, nearStrong]
    applyCommanderDerivedStats(state)
    expect(nearStrong.supportShieldMax ?? 0).toBeGreaterThan(0)
    expect(nearStrong.supportShield ?? 0).toBeGreaterThan(0)
    nearStrong.x = 500
    applyCommanderDerivedStats(state)
    expect(nearStrong.supportShieldMax).toBe(0)
    expect(nearStrong.supportShield).toBe(0)
  })
})

describe('PR7 correction C/D — neutral Bosses and Choir Crown support', () => {
  it('keeps every pending non-Crown Boss body neutral across seeds', () => {
    for (const wave of [700, 750, 800, 950]) {
      let signature: unknown = null
      for (const seed of [1, 2, 7, 19, 41]) {
        const spec = productionBossProvider({ wave, seed })!
        const body = spec.units.find((unit) => unit.isBoss)!
        expect(body.hostileId).toBeUndefined()
        expect(body.resonanceArmed).toBeFalsy()
        expect(body.volatileArmed).toBeFalsy()
        expect(body.role).toBe('boss')
        expect(body.weapons.some((weapon) => (weapon.shieldBypassFrac ?? 0) > 0)).toBe(false)
        const current = {
          hull: body.hullMax,
          shield: body.shieldMax,
          armor: body.armor,
          damage: body.weapons[0]?.damage,
          cooldown: body.weapons[0]?.cooldown,
          tags: body.weapons[0]?.tags,
        }
        if (signature == null) signature = current
        else expect(current).toEqual(signature)
      }
    }
    expect(BOSS_DEFS.filter((def) => def.id !== 'choir-crown').every((def) => def.mechanicStatus === 'pending')).toBe(true)
  })

  it('uses dedicated shell nodes that block W1000 package security', () => {
    const state = createInitialState(0)
    state.combat.docked = false
    state.combat.inFight = true
    state.combat.sortieSeed = 7
    state.combat.enemyUnits = []
    const pkg = createWavePackage(state, 1000, 'boss', 0)
    state.combat.packages = [pkg]
    const spec = productionBossProvider({ wave: 1000, seed: 7 })!
    for (const [index, source] of spec.units.entries()) {
      const unit = structuredClone(source)
      unit.id = `crown-base-${index}`
      admitUnitToPackage(state, pkg, unit)
    }
    const boss = state.combat.enemyUnits.find((unit) => unit.bossId === 'choir-crown')!
    boss.hull = boss.hullMax * CHOIR_CROWN_SEEDS.reconstructionHullFrac
    tickChoirCrown(state, 0.05)
    const shells = state.combat.enemyUnits.filter((unit) => unit.name === 'Crown shell node')
    expect(shells).toHaveLength(CHOIR_CROWN_SEEDS.reconstructionNodes)
    for (const shell of shells) {
      expect(shell.isBossSupport).toBe(true)
      expect(shell.hostileId).toBeUndefined()
      expect(shell.resonanceArmed).toBeFalsy()
      expect(shell.weapons).toHaveLength(0)
    }
    for (const unit of state.combat.enemyUnits) {
      if (!shells.includes(unit)) unit.hull = 0
    }
    expect(packageHasLivingOrPending(state, pkg)).toBe(true)
    shells.forEach((shell) => { shell.hull = 0 })
    expect(packageHasLivingOrPending(state, pkg)).toBe(false)
  })

  it('backs off jam selection when every eligible Core is already jammed', () => {
    const state = createInitialState(0)
    const cores = state.combat.playerUnits.filter((unit) => unit.isCore && unit.coreModuleId)
    state.combat.coreJams = cores.map((core) => ({
      coreId: core.coreInstanceId ?? core.id,
      telegraphLeft: 0,
      jamLeft: 1,
    }))
    state.combat.choirCrown = {
      phase: 'loopbreak',
      phaseStartedAt: 0,
      reconstructionSpawned: true,
      loopbreakSpawned: true,
      jamCooldownLeft: 0,
    }
    const spec = productionBossProvider({ wave: 1000, seed: 11 })!
    state.combat.enemyUnits = spec.units.map((unit, index) => ({ ...unit, id: `jam-${index}` }))
    tickChoirCrown(state, 0.01)
    const count = state.combat.coreJams.length
    expect(state.combat.choirCrown.jamCooldownLeft).toBeGreaterThan(0)
    tickChoirCrown(state, 0.01)
    expect(state.combat.coreJams).toHaveLength(count)
    expect(state.combat.choirCrown.jamCooldownLeft).toBeGreaterThan(0)
  })
})

describe('PR7 correction E/F/G/H — presentation and boundaries', () => {
  it('keeps implementation-status language out of production Codex and uses neutral pending silhouettes', () => {
    for (const def of HOSTILE_DEFS) {
      const text = JSON.stringify(hostileCodexLines(def))
      expect(text).not.toMatch(/pending design|pending authored|mechanic pending/i)
      expect(def.shape).toBe('circle')
    }
    for (const def of BOSS_DEFS) {
      expect(JSON.stringify(bossCodexLines(def.id))).not.toMatch(/pending design|pending authored|role-aware durability seed/i)
    }
  })

  it('removes retired combat compatibility exports and legacy density imports', () => {
    for (const key of [
      'enemySectorScale',
      'ENEMY_EARLY_SECTOR',
      'ENEMY_MID_SECTOR',
      'ENEMY_OPENING_SECTOR',
      'ENEMY_HULL_BASE',
      'ENEMY_HULL_OPENING',
      'ENEMY_HULL_EARLY',
      'ENEMY_HULL_MID',
      'ENEMY_HULL_LATE',
      'ENEMY_DMG_BASE',
      'ENEMY_DMG_OPENING',
      'ENEMY_DMG_EARLY',
      'ENEMY_DMG_MID',
      'ENEMY_DMG_LATE',
      'ENEMY_WAVE_HULL_RAMP',
      'SALVAGE_MID_EXPONENT',
      'CODEX_ROLES',
      'roleIntel',
      'familyIntel',
      'softCounterForFamily',
      'familyShape',
    ]) {
      expect(key in combatExports).toBe(false)
    }
  })

  it('records W1000 exactly once and hands off to the PR11 finale', () => {
    const state = createInitialState(0)
    const rebuilds = state.prestige.prestigeCount
    recordBossClearSources(state, 1000)
    recordBossClearSources(state, 1000)
    expect(state.meta.act1Cleared).toBe(true)
    expect(Boolean(state.meta.act1FinalePending)).toBe(true)
    expect(state.codex.milestones.filter((id) => id === bossClearMilestoneId(1000))).toHaveLength(1)
    expect(state.codex.milestones.filter((id) => id === 'act1-boss-clear')).toHaveLength(1)
    expect(state.prestige.prestigeCount).toBe(rebuilds)
  })
})
