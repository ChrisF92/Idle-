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
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.getByText('Salvage')).toBeTruthy()
    expect(screen.getByText('Scrap')).toBeTruthy()
    expect(screen.queryByText('Pressure')).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Directives' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Attack' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show upgrades' }))
    expect(screen.getByRole('tab', { name: 'Attack' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Cores' })).toBeNull()
    expect(screen.getByText('Weapon Power')).toBeTruthy()
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

  it('keeps Core upgrades out of the Sortie shop and Extract in the menu', () => {
    const state = markHullLost(createInitialState(0))
    state.combat.docked = false
    state.resources.scrap = 80
    state.resources.salvage = 80
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show upgrades' }))
    expect(screen.queryByRole('tab', { name: 'Cores' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Attack' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    expect(screen.getByRole('menuitem', { name: 'Extract' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Core Performance' })).toBeNull()
  })

  it('keeps Core Levels in the Dock loadout', () => {
    const state = markHullLost(createInitialState(0))
    state.resources.scrap = 40
    render(
      <DockTab
        state={state}
        onLaunch={() => undefined}
        onOpenSortie={() => undefined}
        onRebuild={() => undefined}
      />,
    )
    expect(screen.queryByText(/Permanent strength is Mastery/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /Upgrade · .* Scrap/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Workshop/ }))
    expect(screen.getByText('Weapon Power')).toBeTruthy()
    expect(screen.getByText(/START Lv/)).toBeTruthy()
  })

  it('inspects shared Mastery and Dock Core Level', () => {
    const s = createInitialState(0)
    const card = inspectCore(s, 'pulse-cannon')
    expect(card?.stats.find((row) => row.label === 'Mastery')?.value).toMatch(/XP/)
    expect(card?.stats.find((row) => row.label === 'Core Level')?.value).toBeTruthy()
    expect(card?.body.join(' ')).toMatch(/Mastery/)
    expect(card?.stats.find((row) => row.label === 'Layer')).toBeUndefined()
    expect(card?.stats.find((row) => row.label === 'Next level')).toBeUndefined()
  })

  it('does not buy Core Levels with Salvage during a Sortie', () => {
    let s = createInitialState(0)
    s.resources.scrap = 80
    s = launch(s)
    s.resources.salvage = 80
    s = upgradeModule(s, 'pulse-cannon')
    expect(s.combat.coreRunLevels?.['0'] ?? 0).toBe(0)
    expect(s.resources.salvage).toBe(80)
    expect(s.resources.scrap).toBe(80)
  })

  it('exposes Sortie speed and hub status without player-facing Pressure', () => {
    const docked = createInitialState(0)
    expect(livePressureLabel(docked)).toBe('Docked')
    expect(sortieSpeed(docked)).toBe(1)
    expect(formatRunTime(75)).toBe('1:15')
    expect(researchHubStatus(docked)[0]).toMatch(/No project/)
    expect(processHubStatus(docked)[0]).toMatch(/capabilities/)
  })

  it('keeps Mastery and wipes leftover ranks on Rebuild', () => {
    let s = armRebuildDoor(createInitialState(0))
    s.meta.moduleMastery = { 'pulse-cannon': 4 }
    s.shipyard.moduleLevels = { 'pulse-cannon': 1 }
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)
    expect(s.workshop?.coreStarts['pulse-cannon'] ?? 0).toBe(0)
    expect(s.meta.moduleMastery['pulse-cannon']).toBe(4)
  })
})
