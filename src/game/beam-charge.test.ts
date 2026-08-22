import { describe, expect, it } from 'vitest'
import { fitModule, unfitModule } from './actions'
import {
  BEAM_DURATION,
  CHARGE_LASER_SPEED,
  PROJECTILE_SPEED,
  SHIELD_REGEN_DELAY,
  enemyForSector,
  projectileSpeedForDelivery,
  projectileSpeedForTag,
  simulateCombat,
} from './combat'
import { wavesForSector } from './sectors'
import { createInitialState } from './state'
import { forceUnlockModule } from './testHelpers'
import { startCombat } from './tick'

describe('charge lasers and Phase Beam', () => {
  it('keeps one bolt speed by tag; charge lasers are the only faster shots', () => {
    expect(projectileSpeedForTag('kinetic')).toBe(PROJECTILE_SPEED)
    expect(projectileSpeedForTag('energy')).toBe(PROJECTILE_SPEED)
    expect(projectileSpeedForDelivery()).toBe(PROJECTILE_SPEED)
    expect(projectileSpeedForDelivery('bolt')).toBe(PROJECTILE_SPEED)
    expect(projectileSpeedForDelivery('beam')).toBe(PROJECTILE_SPEED)
    expect(projectileSpeedForDelivery('charge')).toBe(CHARGE_LASER_SPEED)
    expect(CHARGE_LASER_SPEED).toBe(PROJECTILE_SPEED * 1.5)
  })

  it('S1 trash never uses beams or charge lasers', () => {
    for (const wave of [1, 2, 3]) {
      for (const unit of enemyForSector(1, wave).units) {
        for (const weapon of unit.weapons) {
          expect(weapon.delivery === 'beam' || weapon.delivery === 'charge').toBe(false)
        }
      }
    }
  })

  it('S3 snipers lock a charge laser then fire a fast bolt', () => {
    const catalog = enemyForSector(11, 1).units.find((u) => u.role === 'sniper')
    expect(catalog?.weapons[0]?.delivery).toBe('charge')
    expect(catalog?.weapons[0]?.telegraphDuration).toBeGreaterThan(0)

    let state = createInitialState(0)
    state.combat.wave = 101
    state.combat.docked = false
    state = startCombat(state)
    const sniper = state.combat.enemyUnits.find((u) => u.role === 'sniper')
    expect(sniper).toBeTruthy()
    const weapon = sniper!.weapons[0]!
    expect(weapon.delivery).toBe('charge')

    state.combat.enemyUnits = [sniper!]
    for (const u of state.combat.playerUnits) {
      for (const w of u.weapons) w.cooldownLeft = 99
    }
    sniper!.x = 90
    weapon.cooldownLeft = 0
    weapon.telegraphLeft = 0
    weapon.telegraphToId = undefined
    state.combat.projectiles = []
    state.combat.beams = []
    simulateCombat(state, 0.05, () => undefined)
    expect(weapon.telegraphLeft).toBeGreaterThan(0)
    expect(weapon.telegraphToId).toBeTruthy()
    expect(state.combat.projectiles.filter((p) => p.fromId === sniper!.id)).toHaveLength(0)
    expect(state.combat.beams.filter((b) => b.fromId === sniper!.id)).toHaveLength(0)

    weapon.telegraphLeft = 0.01
    simulateCombat(state, 0.05, () => undefined)
    expect(weapon.telegraphLeft).toBe(0)
    const shot = state.combat.projectiles.find((p) => p.fromId === sniper!.id)
    expect(shot).toBeTruthy()
    expect(shot!.delivery).toBe('charge')
    expect(shot!.speed).toBe(CHARGE_LASER_SPEED)
    expect(state.combat.beams.filter((b) => b.fromId === sniper!.id)).toHaveLength(0)
  })

  it('boss slam stays a telegraph ring that fires a normal-speed projectile', () => {
    const boss = enemyForSector(1, wavesForSector(1)).units.find((u) => u.isBoss)
    expect(boss).toBeTruthy()
    expect(boss!.weapons[0]!.delivery === 'charge' || boss!.weapons[0]!.delivery === 'beam').toBe(
      false,
    )

    let state = createInitialState(0)
    state.combat.wave = 10
    state.combat.docked = false
    state = startCombat(state)
    const live = state.combat.enemyUnits.find((u) => u.isBoss)!
    const weapon = live.weapons[0]!
    state.combat.enemyUnits = [live]
    for (const u of state.combat.playerUnits) {
      for (const w of u.weapons) w.cooldownLeft = 99
    }
    live.x = 90
    weapon.cooldownLeft = 0
    weapon.telegraphLeft = 0
    state.combat.projectiles = []
    simulateCombat(state, 0.05, () => undefined)
    expect(weapon.telegraphLeft).toBeGreaterThan(0)
    weapon.telegraphLeft = 0.01
    simulateCombat(state, 0.05, () => undefined)
    const shot = state.combat.projectiles.find((p) => p.fromId === live.id)
    expect(shot).toBeTruthy()
    expect(shot!.speed).toBe(PROJECTILE_SPEED)
    expect(shot!.delivery === 'charge' || shot!.delivery === 'beam').toBe(false)
  })

  it('fitted Phase Beam connects a dwell beam instead of a bolt', () => {
    let state = createInitialState(0)
    state = forceUnlockModule(state, 'phase-beam')
    state = unfitModule(state, 'pulse-cannon')
    state = fitModule(state, 'phase-beam')
    expect(state.shipyard.modules).toContain('phase-beam')
    expect(state.shipyard.modules).not.toContain('pulse-cannon')

    state.combat.sector = 1
    state.combat.wave = 1
    state.combat.docked = false
    state = startCombat(state)
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    expect(flag.weapons.some((w) => w.delivery === 'beam')).toBe(true)
    for (const e of state.combat.enemyUnits) {
      e.x = 40
      for (const w of e.weapons) w.cooldownLeft = 99
    }
    for (const w of flag.weapons) w.cooldownLeft = 0
    state.combat.projectiles = []
    state.combat.beams = []
    simulateCombat(state, 0.05, () => undefined)
    expect(state.combat.beams.some((b) => b.fromId === flag.id)).toBe(true)
    expect(state.combat.projectiles.filter((p) => p.fromId === flag.id)).toHaveLength(0)
    const beam = state.combat.beams.find((b) => b.fromId === flag.id)!
    expect(beam.duration).toBe(BEAM_DURATION)
    expect(beam.remaining).toBe(BEAM_DURATION)

    const target = state.combat.enemyUnits.find((u) => u.id === beam.toId)!
    const hullBefore = target.hull
    const shieldBefore = target.shield
    simulateCombat(state, 0.16, () => undefined)
    expect(target.regenDelay ?? 0).toBeGreaterThan(SHIELD_REGEN_DELAY - 0.3)
    expect(target.hull < hullBefore || target.shield < shieldBefore).toBe(true)
  })

  it('beam ticks do not overflow a remaining shield layer', () => {
    let state = createInitialState(0)
    state = forceUnlockModule(state, 'phase-beam')
    state = unfitModule(state, 'pulse-cannon')
    state = fitModule(state, 'phase-beam')
    state.combat.wave = 71
    state.combat.docked = false
    state = startCombat(state)
    const flag = state.combat.playerUnits.find((u) => u.isFlagship)!
    const shielded = state.combat.enemyUnits.find((u) => u.shieldMax > 0)!
    expect(shielded.shield).toBeGreaterThan(0)
    const hullBefore = shielded.hull
    state.combat.enemyUnits = [shielded]
    for (const w of shielded.weapons) w.cooldownLeft = 99
    shielded.x = 40
    shielded.shield = 8
    for (const w of flag.weapons) {
      w.cooldownLeft = 0
      w.damage = 400
    }
    state.combat.projectiles = []
    state.combat.beams = []
    simulateCombat(state, 0.05, () => undefined)
    expect(state.combat.beams.length).toBeGreaterThan(0)
    simulateCombat(state, 0.05, () => undefined)
    expect(shielded.shield).toBe(0)
    expect(shielded.hull).toBe(hullBefore)
    expect(shielded.regenDelay ?? 0).toBeGreaterThan(0)
  })
})
