import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { startCombat } from './tick'
import { BOSS_DEFS, bossDefForWave, productionBossProvider } from './bossRegistry'
import { resolveBossEncounter, setTestBossProvider } from './bossProvider'
import { tickWaveScheduler, type WaveSchedulerHooks } from './waveScheduler'
import { battlefieldClearForBoss, beginBossHold, enterBossWarning } from './waveRuntime'
import { tickChoirCrown, choirCrownPhaseOf } from './choirCrown'
import { CHOIR_CROWN_SEEDS } from './hostileSeeds'
import { saveGame, loadOrCreateGame } from './save'
import { SAVE_KEY } from './state'
import type { GameState } from './types'

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

describe('PR7 Boss registry', () => {
  it('resolves all 20 Act 1 proper Bosses with exact names and no development fallback', () => {
    expect(BOSS_DEFS).toHaveLength(20)
    const names = [
      [50, 'Pack Tyrant I', 'pack-tyrant-i'],
      [100, 'Broodheart Matriarch', 'broodheart-matriarch'],
      [150, 'Iron Behemoth I', 'iron-behemoth-i'],
      [200, 'Iron Regent', 'iron-regent'],
      [250, 'Veil Seer I', 'veil-seer-i'],
      [300, 'Veil Architect', 'veil-architect'],
      [350, 'Siege Node I', 'siege-node-i'],
      [400, 'Bastion Engine', 'bastion-engine'],
      [450, 'Choir Exarch I', 'choir-exarch-i'],
      [500, 'Ember Cantor', 'ember-cantor'],
      [550, 'Pack Tyrant II', 'pack-tyrant-ii'],
      [600, 'Canticle Engine', 'canticle-engine'],
      [650, 'Iron Behemoth II', 'iron-behemoth-ii'],
      [700, 'Reclaimer Leviathan', 'reclaimer-leviathan'],
      [750, 'Veil Seer II', 'veil-seer-ii'],
      [800, 'Null Battery', 'null-battery'],
      [850, 'Siege Node II', 'siege-node-ii'],
      [900, 'Crown Shepherd', 'crown-shepherd'],
      [950, 'Choir Exarch II', 'choir-exarch-ii'],
      [1000, 'Choir Crown', 'choir-crown'],
    ] as const
    for (const [wave, name, id] of names) {
      const spec = resolveBossEncounter({ wave, seed: 1 })
      expect(spec).not.toBeNull()
      expect(spec?.name).toBe(name)
      expect(spec?.id).toBe(id)
      expect(spec?.name).not.toMatch(/Development Boundary/)
      expect(spec?.units.some((u) => u.isBoss)).toBe(true)
      expect(bossDefForWave(wave)?.wave).toBe(wave)
    }
  })

  it('marks non-Crown unique mechanics pending and authors Choir Crown', () => {
    for (const def of BOSS_DEFS) {
      if (def.id === 'choir-crown') {
        expect(def.mechanicStatus).toBe('authored')
      } else {
        expect(def.mechanicStatus).toBe('pending')
        expect(def.mechanicSummary).toBeNull()
      }
    }
  })
})

describe('PR7 Boss boundary', () => {
  it('does not enter warning with living, pending, or reserved Commanders', () => {
    const state = startCombat(createInitialState(8))
    mute(state)
    expect(battlefieldClearForBoss(state)).toBe(false)
    state.combat.enemyUnits = []
    state.combat.pendingReinforcements = []
    state.combat.reservedCommanders = []
    expect(battlefieldClearForBoss(state)).toBe(true)
    state.combat.reservedCommanders = [
      {
        unit: state.combat.playerUnits[0]!,
        packageId: 'x',
        wave: 40,
        threat: 4,
        traitId: 'vanguard',
        hostileId: 'void-mite',
      },
    ]
    expect(battlefieldClearForBoss(state)).toBe(false)
  })

  it('holds, warns, then starts the production package without deleting backlog', () => {
    setTestBossProvider(null)
    const state = startCombat(createInitialState(9))
    mute(state)
    const leftover = state.combat.enemyUnits.filter((u) => u.hull > 0)
    leftover.forEach((u) => {
      u.hull = 1_000_000
    })
    state.combat.nextWave = 50
    beginBossHold(state, 2)
    expect(state.combat.bossBoundary.phase).toBe('holding')
    expect(leftover.every((u) => u.hull > 0)).toBe(true)
    state.combat.enemyUnits = []
    state.combat.pendingReinforcements = []
    state.combat.reservedCommanders = []
    enterBossWarning(state, 2)
    expect(state.combat.bossBoundary.warningDuration).toBe(2)
    expect(state.combat.bossBoundary.warningLeft).toBe(2)
    tickWaveScheduler(state, 2, silent())
    expect(state.combat.bossBoundary.phase).toBe('active')
    expect(state.combat.enemyUnits.some((u) => u.isBoss && u.name === 'Pack Tyrant I')).toBe(true)
    setTestBossProvider(null)
  })
})

describe('PR7 Choir Crown', () => {
  it('walks CONVERGENCE → RECONSTRUCTION → LOOPBREAK without giant regen', () => {
    const spec = productionBossProvider({ wave: 1000, seed: 7 })!
    const state = startCombat(createInitialState(7))
    mute(state)
    state.combat.enemyUnits = spec.units.map((u, i) => ({ ...u, id: `crown-${i}` }))
    const boss = state.combat.enemyUnits.find((u) => u.bossId === 'choir-crown')!
    const hull0 = boss.hull
    tickChoirCrown(state, 0.2)
    expect(choirCrownPhaseOf(state)).toBe('convergence')
    boss.hull = hull0 * CHOIR_CROWN_SEEDS.reconstructionHullFrac
    tickChoirCrown(state, 0.2)
    expect(choirCrownPhaseOf(state)).toBe('reconstruction')
    expect(boss.hull).toBeLessThanOrEqual(hull0 * CHOIR_CROWN_SEEDS.reconstructionHullFrac + 1)
    const pkg = state.combat.packages.find((p) => p.kind === 'boss') ?? state.combat.packages[0]
    if (pkg) {
      pkg.wave = 1000
      pkg.kind = 'boss'
    } else {
      state.combat.packages.push({
        id: 'pkg-w1000',
        wave: 1000,
        kind: 'boss',
        reached: true,
        secured: false,
        rewardPaid: false,
        spawnedUnitIds: state.combat.enemyUnits.map((u) => u.id),
        pendingCount: 0,
        totalUnits: state.combat.enemyUnits.length,
      })
    }
    boss.hull = hull0 * CHOIR_CROWN_SEEDS.loopbreakHullFrac
    tickChoirCrown(state, 0.2)
    expect(choirCrownPhaseOf(state)).toBe('loopbreak')
    tickChoirCrown(state, CHOIR_CROWN_SEEDS.jamCooldown + CHOIR_CROWN_SEEDS.jamTelegraph + 0.1)
    const jammed = (state.combat.coreJams ?? []).length > 0 ||
      state.combat.playerUnits.some((u) => (u.coreJamTelegraphLeft ?? 0) > 0 || (u.coreJamLeft ?? 0) > 0)
    expect(jammed).toBe(true)
    expect(boss.hull).toBeLessThan(hull0)

    saveGame(state)
    const loaded = loadOrCreateGame()!
    expect(loaded.combat.choirCrown?.phase).toBe('loopbreak')
    localStorage.removeItem(SAVE_KEY)
  })
})
