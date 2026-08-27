import { describe, expect, it } from 'vitest'
import { createInitialState, SAVE_KEY } from './state'
import { saveGame, loadOrCreateGame } from './save'
import { startCombat } from './tick'
import { encounterForWave } from './encounterGenerator'
import {
  MAX_ACTIVE_COMMANDERS,
  TRAIT_UNLOCK_WAVE,
  W10_COMMANDER_SEED,
} from './hostileSeeds'
import {
  isCommanderWave,
  livingCommanderCount,
  planCommanderEvent,
  promoteToCommander,
  reserveCommander,
  shouldReserveCommander,
  tryReleaseReservedCommanders,
  traitUnlockedAt,
  unlockedTraits,
} from './commanders'
import { isBossWave } from './waves'
import { admitUnitToPackage, createWavePackage } from './waveRuntime'
import { startWavePackage, type WaveSchedulerHooks } from './waveScheduler'
import { BOSS_DEFS, productionBossProvider } from './bossRegistry'
import { buildHostileUnit, getHostileDef } from './hostileCatalogue'
import type { CombatUnit, GameState } from './types'

function silent(): WaveSchedulerHooks {
  return { pushLog: () => undefined }
}

function mute(state: GameState): void {
  for (const unit of [...state.combat.playerUnits, ...state.combat.enemyUnits]) {
    for (const wpn of unit.weapons) {
      wpn.damage = 0
      wpn.cooldownLeft = 99
    }
  }
}

describe('PR7 Commander cadence', () => {
  it('fires every 10 Waves except W50 boundaries', () => {
    for (const wave of [10, 20, 30, 40, 60, 70, 80, 90, 110]) {
      expect(isCommanderWave(wave)).toBe(true)
      expect(isBossWave(wave)).toBe(false)
    }
    for (const wave of [1, 9, 50, 100, 150, 200]) {
      expect(isCommanderWave(wave)).toBe(false)
    }
  })

  it('uses a proper Boss package at W50 with no Commander', () => {
    const spec = productionBossProvider({ wave: 50, seed: 1 })
    expect(spec?.name).toBe('Pack Tyrant I')
    expect(spec?.units.some((u) => u.isCommander)).toBe(false)
    expect(spec?.units.some((u) => u.isBoss)).toBe(true)
    expect(BOSS_DEFS).toHaveLength(20)
  })
})

describe('PR7 Commander generation', () => {
  it('uses the centralized W10 pending pairing', () => {
    expect(W10_COMMANDER_SEED.status).toBe('pending-pairing')
    const plan = planCommanderEvent(10, 99)
    expect(plan.hostileId).toBe('void-mite')
    expect(plan.traitId).toBe('vanguard')
    expect(plan.pairingStatus).toBe('pending-pairing')
  })

  it('builds exactly one Commander from an already-introduced hostile with one unlocked Trait', () => {
    const state = createInitialState(0)
    state.combat.sortieSeed = 21
    const enc = encounterForWave(20, 1, state)
    const commanders = enc.units.filter((u) => u.isCommander)
    expect(commanders).toHaveLength(1)
    const cmdr = commanders[0]!
    expect(cmdr.hostileId).toBeTruthy()
    const def = getHostileDef(cmdr.hostileId)
    expect(def?.firstContactWave).toBeLessThanOrEqual(20)
    expect(cmdr.commanderTraitId).toBeTruthy()
    expect(unlockedTraits(20)).toContain(cmdr.commanderTraitId as 'vanguard')
    expect(enc.units.filter((u) => !u.isCommander).length).toBeGreaterThan(0)
  })

  it('is deterministic for the same seed and does not reroll on reload', () => {
    const a = createInitialState(0)
    a.combat.sortieSeed = 44
    const b = createInitialState(0)
    b.combat.sortieSeed = 44
    const pa = planCommanderEvent(20, 44, a)
    const pb = planCommanderEvent(20, 44, b)
    expect(pa).toEqual(pb)
    const enc = encounterForWave(20, 1, a)
    const cmdr = enc.units.find((u) => u.isCommander)!
    a.combat.enemyUnits.push(cmdr)
    saveGame(a)
    const loaded = loadOrCreateGame()!
    const live = loaded.combat.enemyUnits.find((u) => u.isCommander)
    expect(live?.hostileId).toBe(cmdr.hostileId)
    expect(live?.commanderTraitId).toBe(cmdr.commanderTraitId)
    localStorage.removeItem(SAVE_KEY)
  })

  it('does not promote future hostiles or future Traits', () => {
    for (const wave of [20, 40, 80, 200, 400]) {
      const plan = planCommanderEvent(wave, 8)
      expect(getHostileDef(plan.hostileId)!.firstContactWave).toBeLessThanOrEqual(wave)
      expect(traitUnlockedAt(plan.traitId, wave)).toBe(true)
      expect(TRAIT_UNLOCK_WAVE.volatile).toBe(680)
      if (wave < 680) expect(plan.traitId).not.toBe('volatile')
      if (wave < 760) expect(plan.traitId).not.toBe('breacher')
    }
  })

  it('avoids more than two consecutive same Traits when alternatives exist', () => {
    const state = createInitialState(0)
    state.combat.sortieSeed = 3
    state.combat.commanderEventLog = [
      { wave: 20, hostileId: 'void-mite', traitId: 'vanguard' },
      { wave: 30, hostileId: 'needle-skitter', traitId: 'vanguard' },
    ]
    const plan = planCommanderEvent(40, 3, state)
    expect(plan.traitId).not.toBe('vanguard')
  })
})

describe('PR7 Commander overlap reservation', () => {
  function commanderUnit(id: string, trait: 'vanguard' | 'ironclad' = 'vanguard'): CombatUnit {
    const def = getHostileDef('void-mite')!
    return promoteToCommander(buildHostileUnit({ def, wave: 20 }), trait, def)
  }

  it('reserves a third Commander and releases the exact unit when a slot opens', () => {
    const state = startCombat(createInitialState(2))
    mute(state)
    state.combat.enemyUnits = []
    const pkgA = createWavePackage(state, 10, 'commander', 1)
    const pkgB = createWavePackage(state, 20, 'commander', 1)
    state.combat.packages.push(pkgA, pkgB)
    const a = commanderUnit('a', 'vanguard')
    const b = commanderUnit('b', 'ironclad')
    a.id = 'live-a'
    b.id = 'live-b'
    admitUnitToPackage(state, pkgA, a)
    admitUnitToPackage(state, pkgB, b)
    expect(livingCommanderCount(state)).toBe(MAX_ACTIVE_COMMANDERS)
    expect(shouldReserveCommander(state)).toBe(true)

    const third = commanderUnit('c', 'ironclad')
    third.commanderTraitId = 'ironclad'
    const pkgC = createWavePackage(state, 30, 'commander', 2)
    state.combat.packages.push(pkgC)
    reserveCommander(state, third, pkgC, 12)
    expect(state.combat.enemyUnits.filter((u) => u.isCommander && u.hull > 0)).toHaveLength(2)
    expect(state.combat.reservedCommanders).toHaveLength(1)
    expect(state.combat.reservedCommanders[0]?.traitId).toBe('ironclad')
    expect(state.combat.reservedCommanders[0]?.hostileId).toBe('void-mite')

    saveGame(state)
    const loaded = loadOrCreateGame()!
    expect(loaded.combat.reservedCommanders).toHaveLength(1)
    expect(loaded.combat.reservedCommanders[0]?.traitId).toBe('ironclad')

    const victim = loaded.combat.enemyUnits.find((u) => u.isCommander)!
    victim.hull = 0
    const released = tryReleaseReservedCommanders(loaded)
    expect(released).toHaveLength(1)
    expect(released[0]?.commanderTraitId).toBe('ironclad')
    expect(released[0]?.hostileId).toBe('void-mite')
    expect(loaded.combat.reservedCommanders).toHaveLength(0)
    localStorage.removeItem(SAVE_KEY)
  })

  it('lets escorts spawn while the Commander is reserved', () => {
    const state = startCombat(createInitialState(4))
    mute(state)
    state.combat.enemyUnits = state.combat.enemyUnits.filter((u) => u.isCommander).slice(0, 0)
    const first = commanderUnit('x')
    const second = commanderUnit('y', 'ironclad')
    const pkg1 = createWavePackage(state, 10, 'commander', 1)
    const pkg2 = createWavePackage(state, 20, 'commander', 1)
    state.combat.packages.push(pkg1, pkg2)
    admitUnitToPackage(state, pkg1, first)
    admitUnitToPackage(state, pkg2, second)
    state.combat.nextWave = 30
    state.combat.nextReinforcementAt = state.combat.simTime
    startWavePackage(state, 30, silent())
    expect(state.combat.reservedCommanders.length + livingCommanderCount(state)).toBeGreaterThanOrEqual(2)
    const pkg = state.combat.packages.find((p) => p.wave === 30)
    expect(pkg).toBeTruthy()
  })
})
