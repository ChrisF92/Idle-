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
  it('shows Scrap on the Sortie HUD and UPGRADES | CORES | DIRECTIVES panes', () => {
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
    expect(screen.getByText('Speed')).toBeTruthy()
    expect(screen.getByText('Pressure')).toBeTruthy()
    expect(screen.getByText('Time')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Upgrades' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Cores' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Directives' })).toBeTruthy()
    expect(screen.getByText('Weapon Power')).toBeTruthy()
    expect(screen.getByText('Current')).toBeTruthy()
    expect(screen.getByText('Next')).toBeTruthy()
    expect(screen.getByText('Cost')).toBeTruthy()
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
    fireEvent.click(screen.getByRole('tab', { name: 'Cores' }))
    expect(screen.getAllByText(/Scrap at Dock/i).length).toBeGreaterThan(0)
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
    expect(screen.getByText('Weapon Power')).toBeTruthy()
    expect(screen.getAllByText('Current').length).toBeGreaterThan(0)
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

  it('exposes Sortie speed, pressure, and hub status the GDD asks for', () => {
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
