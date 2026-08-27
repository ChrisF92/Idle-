import { describe, expect, it } from 'vitest'
import { createInitialState, SAVE_KEY } from './state'
import { saveGame, loadOrCreateGame } from './save'
import { startCombat } from './tick'
import { buildHostileUnit, getHostileDef } from './hostileCatalogue'
import { promoteToCommander } from './commanders'
import { admitUnitToPackage, createWavePackage } from './waveRuntime'
import { emptyChoirCrown } from './choirCrown'
import { performRebuild } from './actions'
import { armRebuildDoor } from './testHelpers'

describe('PR7 encounter save integrity', () => {
  it('preserves live Commander identity, Trait, HP, and geometry', () => {
    const state = startCombat(createInitialState(6))
    const def = getHostileDef('bulwark')!
    const unit = promoteToCommander(buildHostileUnit({ def, wave: 40 }), 'ironclad', def)
    unit.hull = unit.hullMax * 0.4
    unit.x = 111
    unit.y = 77
    unit.displacerCooldownLeft = 3.5
    const pkg = createWavePackage(state, 40, 'commander', 1)
    state.combat.packages.push(pkg)
    admitUnitToPackage(state, pkg, unit)
    const live = state.combat.enemyUnits.find((u) => u.isCommander)!
    saveGame(state)
    const loaded = loadOrCreateGame()!
    const restored = loaded.combat.enemyUnits.find((u) => u.isCommander)
    expect(restored?.hostileId).toBe('bulwark')
    expect(restored?.commanderTraitId).toBe('ironclad')
    expect(restored?.hull).toBeCloseTo(live.hull, 5)
    expect(restored?.x).toBeCloseTo(111, 5)
    expect(restored?.y).toBeCloseTo(77, 5)
    localStorage.removeItem(SAVE_KEY)
  })

  it('preserves reserved Commanders across reload', () => {
    const state = startCombat(createInitialState(6))
    const def = getHostileDef('void-mite')!
    const reserved = promoteToCommander(buildHostileUnit({ def, wave: 30 }), 'vanguard', def)
    state.combat.reservedCommanders = [
      {
        unit: reserved,
        packageId: 'pkg-w30-1',
        wave: 30,
        threat: 18,
        traitId: 'vanguard',
        hostileId: 'void-mite',
      },
    ]
    saveGame(state)
    const loaded = loadOrCreateGame()!
    expect(loaded.combat.reservedCommanders[0]?.traitId).toBe('vanguard')
    expect(loaded.combat.reservedCommanders[0]?.hostileId).toBe('void-mite')
    expect(loaded.combat.reservedCommanders[0]?.wave).toBe(30)
    localStorage.removeItem(SAVE_KEY)
  })

  it('preserves Choir Crown phase in combat state', () => {
    const state = startCombat(createInitialState(6))
    state.combat.choirCrown = { ...emptyChoirCrown(12), phase: 'reconstruction', reconstructionSpawned: true }
    saveGame(state)
    const loaded = loadOrCreateGame()!
    expect(loaded.combat.choirCrown?.phase).toBe('reconstruction')
    expect(loaded.combat.choirCrown?.reconstructionSpawned).toBe(true)
    localStorage.removeItem(SAVE_KEY)
  })

  it('Rebuild keeps Codex and clears live Commanders/hazards', () => {
    const state = startCombat(createInitialState(6))
    state.codex.discoveredHostileIds = ['void-mite', 'needle-skitter']
    state.codex.discoveredBossIds = ['pack-tyrant-i']
    state.combat.deathHazards = [
      { x: 1, y: 2, radius: 10, damage: 4, delayLeft: 0.2, sourceId: 'x', kind: 'volatile' },
    ]
    const armed = armRebuildDoor(state)
    armed.codex = structuredClone(state.codex)
    const rebuilt = performRebuild(armed, {
      frameId: armed.shipyard.frameId,
      modules: [...armed.shipyard.modules],
    })
    expect(rebuilt.codex.discoveredHostileIds).toEqual(['void-mite', 'needle-skitter'])
    expect(rebuilt.codex.discoveredBossIds).toEqual(['pack-tyrant-i'])
    expect(rebuilt.combat.enemyUnits).toEqual([])
    expect(rebuilt.combat.deathHazards).toEqual([])
  })
})
