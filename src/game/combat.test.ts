import { describe, expect, it } from 'vitest'
import { buildFlagshipWeapons, createInitialState } from './state'
import { startCombat, advanceTicks } from './tick'
import {
  computeFightDamage,
  dealCombatDamage,
  enemyForSector,
  isBossSector,
  PROJECTILE_SPEED,
  projectileSpeedForTag,
  resolveCombatTick,
  sectorRoster,
  simulateCombat,
} from './combat'
import { fitModule, unlockModule } from './actions'
import { equipPostTutorialLoadout } from './testHelpers'
import type { CombatUnit } from './types'
import { bossWaveForBand, waveForBand } from './waves'

describe('enemy catalog', () => {
  it('rotates families and marks bosses every 5 sectors', () => {
    expect(enemyForSector(1).family).toBe('swarm')
    expect(enemyForSector(2).family).toBe('armored')
    expect(enemyForSector(3).family).toBe('ethereal')
    expect(enemyForSector(4).family).toBe('divine')
    expect(isBossSector(5)).toBe(true)
    expect(enemyForSector(5, 1).isBoss).toBe(false)
    expect(enemyForSector(5, 7).isBoss).toBe(true)
    expect(enemyForSector(5, 7).family).toBe('titan')
    expect(enemyForSector(5, 7).essenceReward).toBeGreaterThan(0)
    expect(enemyForSector(1, 1).units.length).toBeGreaterThan(0)
    expect(enemyForSector(5, 7).units.some((u) => u.isBoss)).toBe(true)
    // Waves in a sector are not identical
    expect(enemyForSector(1, 1).units.map((u) => u.name).join()).not.toBe(
      enemyForSector(1, 3).units.map((u) => u.name).join(),
    )
  })
})

describe('role matchups', () => {
  it('weapons deal more to armored enemies', () => {
    let state = createInitialState(0)
    state.combat.wave = waveForBand(2)
    state = startCombat(state)
    expect(state.combat.enemyFamily).toBe('armored')

    const withWeapon = computeFightDamage(state).playerDps

    state.shipyard.modules = []
    const bare = computeFightDamage(state).playerDps
    expect(withWeapon).toBeGreaterThan(bare)
  })

  it('defense reduces swarm incoming damage estimate', () => {
    let state = createInitialState(0)
    state.combat.sector = 1
    state.resources.scrap = 999
    state.resources.alloys = 999
    state = unlockModule(state, 'plate-layer')
    state = fitModule(state, 'plate-layer')
    state = startCombat(state)
    expect(state.combat.enemyFamily).toBe('swarm')

    const defended = computeFightDamage(state).enemyDps
    state.shipyard.modules = ['pulse-cannon']
    const exposed = computeFightDamage(state).enemyDps
    expect(defended).toBeLessThan(exposed)
  })

  it('bosses punish missing defense', () => {
    let state = createInitialState(0)
    state.combat.wave = bossWaveForBand(5)
    state = startCombat(state)
    expect(state.combat.isBoss).toBe(true)

    const nakedIncoming = computeFightDamage(state).enemyDps
    state.resources.scrap = 999
    state.resources.alloys = 999
    state = unlockModule(state, 'plate-layer')
    state.shipyard.modules = [...state.shipyard.modules, 'plate-layer']
    const platedIncoming = computeFightDamage(state).enemyDps
    expect(platedIncoming).toBeLessThan(nakedIncoming)
  })
})

describe('sector roster intel', () => {
  it('lists unique enemies with combat stats for sector info', () => {
    const roster = sectorRoster(1)
    expect(roster.length).toBeGreaterThan(0)
    for (const entry of roster) {
      expect(entry.hull).toBeGreaterThan(0)
      expect(entry.dps).toBeGreaterThan(0)
      expect(entry.speed).toBeGreaterThan(0)
      expect(entry.range).toBeGreaterThan(0)
      expect(entry.weaponTags.length).toBeGreaterThan(0)
      expect(entry.summary.length).toBeGreaterThan(0)
    }
  })
})

describe('starter reach', () => {
  it('starter weapons can hit sector 3 ethereal engage range', () => {
    const state = createInitialState(0)
    const maxRange = Math.max(...buildFlagshipWeapons(state).map((w) => w.range))
    const ethereal = enemyForSector(3)
    const maxEngage = Math.max(...ethereal.units.map((u) => u.engageRange))
    expect(ethereal.family).toBe('ethereal')
    expect(maxRange).toBeGreaterThanOrEqual(maxEngage)
  })
})

describe('fleet combat resolution', () => {
  it('weapons fire and reduce enemy hull once enemies close into range', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    const before = state.combat.enemyHull
    // Swarms spawn far and must close before anyone can shoot
    for (let i = 0; i < 6; i += 1) resolveCombatTick(state, () => {})
    expect(state.combat.enemyHull).toBeLessThan(before)
  })

  it('defers damage until projectiles impact', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    // Place foes at mid-lane so a shot must travel before impact
    for (const u of state.combat.enemyUnits) {
      u.x = 90
      u.engageRange = 200
    }
    for (const u of state.combat.playerUnits) {
      for (const w of u.weapons) {
        w.range = 200
        w.cooldownLeft = 0
      }
    }

    const before = state.combat.enemyHull
    simulateCombat(state, 1 / 60, () => {})
    expect(state.combat.projectiles.length).toBeGreaterThan(0)
    expect(state.combat.enemyHull).toBe(before)

    // Travel long enough for mid-lane shots (PROJECTILE_SPEED) to arrive
    const frames = Math.ceil((90 / PROJECTILE_SPEED) * 60) + 5
    for (let i = 0; i < frames; i += 1) simulateCombat(state, 1 / 60, () => {})
    expect(state.combat.enemyHull).toBeLessThan(before)
  })

  it('stamps radial heading and weapon id on player and enemy shots', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    const enemy = state.combat.enemyUnits[0]
    enemy.x = 70
    enemy.heading = 2.1
    enemy.engageRange = 200
    for (const weapon of enemy.weapons) {
      weapon.range = 200
      weapon.cooldownLeft = 0
    }
    for (const unit of state.combat.playerUnits) {
      for (const weapon of unit.weapons) {
        weapon.range = 200
        weapon.cooldownLeft = 0
      }
    }
    simulateCombat(state, 1 / 60, () => {})
    const enemyShot = state.combat.projectiles.find((p) => p.side === 'enemy')
    const playerShot = state.combat.projectiles.find((p) => p.side === 'player')
    expect(enemyShot?.heading).toBeCloseTo(enemy.heading ?? 0)
    expect(enemyShot?.originX).toBeCloseTo(enemy.x)
    expect(playerShot?.heading).toBeCloseTo(enemy.heading ?? 0)
    expect(playerShot?.weaponId).toMatch(/-wpn(?:-\d+)?$/)
  })

  it('uses one projectile speed for all weapon tags', () => {
    expect(projectileSpeedForTag('kinetic')).toBe(PROJECTILE_SPEED)
    expect(projectileSpeedForTag('pierce')).toBe(PROJECTILE_SPEED)
    expect(projectileSpeedForTag('energy')).toBe(projectileSpeedForTag('splash'))
  })

  it('clears a sector with multi-unit packs', () => {
    let state = equipPostTutorialLoadout(createInitialState(0))
    state.combat.coreRunLevels = { '0': 1, '1': 1 }
    state = startCombat(state)
    expect(state.combat.enemyUnits.length).toBeGreaterThan(1)
    advanceTicks(state, 120)
    // May still be on S1 after a death warp; cleared progress is on highestSector.
    expect(state.combat.highestSector).toBeGreaterThanOrEqual(1)
  })
})

describe('shield layers', () => {
  function dummy(partial: Partial<CombatUnit> = {}): CombatUnit {
    return {
      id: 't',
      side: 'enemy',
      name: 'Dummy',
      shape: 'circle',
      family: 'ethereal',
      hull: 50,
      hullMax: 50,
      shield: 20,
      shieldMax: 20,
      armor: 0,
      evasion: 0,
      damageTakenMult: 1,
      weapons: [],
      isBoss: false,
      isFlagship: false,
      dots: [],
      x: 0,
      y: 0,
      speed: 0,
      engageRange: 0,
      kite: false,
      phaseWarnLeft: 0,
      regenDelay: 0,
      ...partial,
    }
  }

  it('does not spill leftover damage into hull on the shield-break hit', () => {
    const u = dummy()
    dealCombatDamage(u, 200, ['energy'])
    expect(u.shield).toBe(0)
    expect(u.hull).toBe(50)
    dealCombatDamage(u, 200, ['energy'])
    expect(u.hull).toBe(0)
  })

  it('lets a later hit damage hull once the shield is already empty', () => {
    const u = dummy({ shield: 0, shieldMax: 20, hull: 40, hullMax: 40 })
    dealCombatDamage(u, 15, ['energy'])
    expect(u.hull).toBe(25)
  })

  it('stops Pulse from deleting a shielded ethereal in one shot', () => {
    const pack = enemyForSector(3, 1)
    const shielded = pack.units.find((u) => u.shieldMax > 0)
    expect(shielded).toBeTruthy()
    const hullBefore = shielded!.hull
    dealCombatDamage(shielded!, 200, ['energy'])
    expect(shielded!.shield).toBe(0)
    expect(shielded!.hull).toBe(hullBefore)
  })

  it('emits a damage number when a projectile hits', () => {
    let state = createInitialState(0)
    state.combat.docked = false
    state = startCombat(state)
    const player = state.combat.playerUnits.find((u) => u.isFlagship)!
    const enemy = state.combat.enemyUnits[0]!
    enemy.x = 8
    enemy.y = 0
    state.combat.projectiles = [
      {
        id: 'hit-test',
        fromId: player.id,
        toId: enemy.id,
        side: 'player',
        tag: 'energy',
        x: enemy.x,
        y: enemy.y,
        damage: 12,
        tags: ['energy'],
        dotDuration: 0,
        dotDamage: 0,
        speed: 400,
        attackerFamily: 'player',
      },
    ]
    simulateCombat(state, 0.05, () => undefined)
    const hit = state.combat.fx.find((f) => f.toId === enemy.id && (f.amount ?? 0) > 0)
    expect(hit).toBeTruthy()
    expect(hit!.hit === 'hull' || hit!.hit === 'shield').toBe(true)
  })
})
