import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CombatTab } from '../components/tabs/CombatTab'
import { DockTab } from '../components/tabs/DockTab'
import { performRebuild, upgradeModule } from './actions'
import { inspectCore } from './inspect'
import { processHubStatus, researchHubStatus } from './systemsHub'
import { createInitialState } from './state'
import { formatRunTime, livePressureLabel, sortieSpeed } from './uiReadout'
import { armRebuildDoor, markHullLost } from './testHelpers'
import { setDocked } from './tick'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

function launch(state = createInitialState()) {
  return setDocked(state, false)
}

describe('GDD visual layout and Dock Core ranks', () => {
  it('shows a compact Sortie HUD without Pressure or permanent Cores tabs', () => {
    const state = markHullLost(createInitialState(0))
    state.combat.docked = false
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onUpgrade={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.getByText('Salvage')).toBeTruthy()
    expect(screen.getByText('Scrap')).toBeTruthy()
    expect(screen.queryByText('Pressure')).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Upgrades' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Cores' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Directives' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Attack' })).toBeTruthy()
    expect(screen.getByText('Weapon Power')).toBeTruthy()
    expect(screen.getByRole('button', { name: /CORES/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Weapon Power details' }))
    expect(screen.getByRole('dialog', { name: 'Weapon Power' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hide upgrades' }))
    expect(screen.queryByText('Weapon Power')).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Attack' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show upgrades' }))
    expect(screen.getByText('Weapon Power')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Attack' })).toBeTruthy()
  })

  it('keeps Sortie Cores inspect-only', () => {
    const state = markHullLost(createInitialState(0))
    state.combat.docked = false
    state.resources.scrap = 80
    state.resources.salvage = 80
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onUpgrade={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /CORES/i }))
    expect(screen.getByText(/Rank and equip Cores at Dock/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Upgrade/ })).toBeNull()
  })

  it('ranks Cores from Dock Loadout with Scrap', () => {
    const state = markHullLost(createInitialState(0))
    state.resources.scrap = 40
    render(
      <DockTab
        state={state}
        onLaunch={() => undefined}
        onOpenSortie={() => undefined}
        onRebuild={() => undefined}
        onUpgrade={() => undefined}
      />,
    )
    expect(screen.getByText(/Equip and rank Cores here with Scrap/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Upgrade · 3 Scrap/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Workshop' }))
    expect(screen.getByText('Weapon Power')).toBeTruthy()
    expect(screen.getByText(/START Lv/)).toBeTruthy()
  })

  it('inspects Core ranks in Scrap, not Salvage', () => {
    const s = createInitialState(0)
    s.resources.scrap = 12
    const card = inspectCore(s, 'pulse-cannon')
    expect(card?.stats.find((row) => row.label === 'Scrap')?.value).toBeTruthy()
    expect(card?.stats.find((row) => row.label === 'Mastery')?.value).toBeTruthy()
    expect(card?.stats.find((row) => row.label === 'Layer')?.value).toMatch(/Dock Scrap/)
    expect(card?.stats.find((row) => row.label === 'Next level')?.value).toMatch(/Scrap/)
    expect(card?.stats.find((row) => row.label === 'Salvage')).toBeUndefined()
  })

  it('refuses in-run Core buys and persists Dock Scrap ranks through Extract', () => {
    let s = createInitialState(0)
    s.resources.scrap = 80
    s.resources.salvage = 80
    s = launch(s)
    s = upgradeModule(s, 'pulse-cannon')
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)

    s = setDocked(s, true)
    s = upgradeModule(s, 'pulse-cannon')
    expect(s.shipyard.moduleLevels['pulse-cannon']).toBe(1)
    expect(s.resources.scrap).toBe(77)
    s = launch(s)
    expect(s.shipyard.moduleLevels['pulse-cannon']).toBe(1)
    s = setDocked(s, true)
    expect(s.shipyard.moduleLevels['pulse-cannon']).toBe(1)
  })

  it('exposes Sortie speed and hub status without player-facing Pressure', () => {
    const docked = createInitialState(0)
    expect(livePressureLabel(docked)).toBe('Docked')
    expect(sortieSpeed(docked)).toBe(1)
    expect(formatRunTime(75)).toBe('1:15')
    expect(researchHubStatus(docked)[0]).toMatch(/No project/)
    expect(processHubStatus(docked)[0]).toMatch(/capabilities/)
  })

  it('wipes Core ranks on Rebuild', () => {
    let s = armRebuildDoor(createInitialState(0))
    s.resources.scrap = 40
    s = upgradeModule(s, 'pulse-cannon')
    expect(s.shipyard.moduleLevels['pulse-cannon']).toBe(1)
    s = performRebuild(s, { frameId: 'scout-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)
    expect(s.workshop?.coreStarts['pulse-cannon'] ?? 0).toBe(0)
  })
})
