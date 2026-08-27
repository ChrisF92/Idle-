import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CodexTab } from '../components/tabs/CodexTab'
import { createInitialState } from './state'
import { startCombat } from './tick'
import { performRebuild } from './actions'
import { saveGame, loadOrCreateGame } from './save'
import { SAVE_KEY } from './state'
import { admitUnitToPackage, createWavePackage } from './waveRuntime'
import { CODEX_PANES } from './codex'
import { maybeGrantSystemUnlocks } from './progression'
import { ACT1_CADENCE } from './cadence'
import { productionBossProvider } from './bossRegistry'
import { armRebuildDoor } from './testHelpers'

afterEach(() => {
  cleanup()
  localStorage.removeItem(SAVE_KEY)
})

function openCodex(state = createInitialState(0)) {
  state.meta.bestWave = ACT1_CADENCE.codex
  maybeGrantSystemUnlocks(state)
  render(<CodexTab state={state} onBack={() => undefined} />)
  return state
}

describe('PR7 Codex HOSTILES | BOSSES', () => {
  it('exposes exactly two top-level panes', () => {
    expect([...CODEX_PANES]).toEqual(['hostiles', 'bosses'])
    openCodex()
    expect(screen.getByLabelText('Codex panes').textContent).toMatch(/Hostiles/)
    expect(screen.getByLabelText('Codex panes').textContent).toMatch(/Bosses/)
    expect(screen.queryByRole('tab', { name: 'Families' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Roles' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Commanders' })).toBeNull()
  })

  it('records W1 Void Mite before the Codex UI unlocks, then shows it at W30', () => {
    const locked = startCombat(createInitialState(1))
    expect(locked.codex.discoveredHostileIds).toContain('void-mite')
    expect(locked.meta.bestWave).toBeLessThan(ACT1_CADENCE.codex)
    render(<CodexTab state={locked} onBack={() => undefined} />)
    expect(screen.queryByText('Void Mite')).toBeNull()
    cleanup()
    locked.meta.bestWave = ACT1_CADENCE.codex
    maybeGrantSystemUnlocks(locked)
    render(<CodexTab state={locked} onBack={() => undefined} />)
    expect(screen.getByText('Void Mite')).toBeTruthy()
    expect(screen.queryByText('Needle Skitter')).toBeNull()
    expect(screen.queryByText('1.011')).toBeNull()
  })

  it('hides future Boss names until actual spawn', () => {
    const s = createInitialState(0)
    s.meta.bestWave = 1000
    maybeGrantSystemUnlocks(s)
    render(<CodexTab state={s} onBack={() => undefined} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Bosses' }))
    expect(screen.queryByText('Choir Crown')).toBeNull()
    expect(screen.getAllByText('Unknown boundary').length).toBeGreaterThan(0)
    cleanup()
    const pkg = createWavePackage(s, 1000, 'boss', 1)
    s.combat.packages.push(pkg)
    const crown = productionBossProvider({ wave: 1000, seed: 1 })!.units.find((u) => u.isBoss)!
    admitUnitToPackage(s, pkg, crown)
    render(<CodexTab state={s} onBack={() => undefined} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Bosses' }))
    expect(screen.getByText('Choir Crown')).toBeTruthy()
  })

  it('shows discovered Commander Traits only as a glossary', () => {
    const s = createInitialState(0)
    s.meta.bestWave = 30
    maybeGrantSystemUnlocks(s)
    s.codex.discoveredHostileIds = ['void-mite']
    s.codex.discoveredCommanderTraitIds = ['vanguard']
    s.codex.hostileCommander = { 'void-mite': { encounters: 1, defeats: 0, traits: ['vanguard'] } }
    render(<CodexTab state={s} onBack={() => undefined} />)
    expect(screen.getAllByText(/Vanguard/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Commander Traits/)).toBeTruthy()
    expect(screen.queryByText('Volatile')).toBeNull()
  })

  it('Rebuild and save/reload preserve Codex discoveries', () => {
    const live = startCombat(createInitialState(2))
    const discovered = [...live.codex.discoveredHostileIds]
    expect(discovered).toContain('void-mite')
    saveGame(live)
    const loaded = loadOrCreateGame()!
    expect(loaded.codex.discoveredHostileIds).toEqual(discovered)
    const docked = armRebuildDoor(loaded)
    docked.codex = structuredClone(loaded.codex)
    const rebuilt = performRebuild(docked, {
      frameId: docked.shipyard.frameId,
      modules: [...docked.shipyard.modules],
    })
    expect(rebuilt.codex.discoveredHostileIds).toEqual(discovered)
    expect(rebuilt.combat.inFight).toBe(false)
  })
})
