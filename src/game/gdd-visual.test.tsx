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

  it('keeps Sortie Cores inspect-only and sells Run Levels in Attack', () => {
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
    expect(screen.getByText('CORES')).toBeTruthy()
    expect(screen.getByText('GLOBAL')).toBeTruthy()
    expect(screen.getByText(/Pulse Cannon/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Core Performance' }))
    expect(screen.getByText(/Run Levels reset/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Upgrade ·/ })).toBeNull()
  })

  it('inspects Mastery and Run Level instead of Dock Scrap ranks', () => {
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
    fireEvent.click(screen.getByRole('tab', { name: 'Workshop' }))
    expect(screen.getByText('Weapon Power')).toBeTruthy()
    expect(screen.getByText(/START Lv/)).toBeTruthy()
  })

  it('inspects Core Mastery, not Scrap ranks', () => {
    const s = createInitialState(0)
    const card = inspectCore(s, 'pulse-cannon')
    expect(card?.stats.find((row) => row.label === 'Mastery')?.value).toMatch(/XP/)
    expect(card?.stats.find((row) => row.label === 'Run Level')?.value).toBeTruthy()
    expect(card?.body.join(' ')).toMatch(/Mastery/)
    expect(card?.stats.find((row) => row.label === 'Layer')).toBeUndefined()
    expect(card?.stats.find((row) => row.label === 'Next level')).toBeUndefined()
  })

  it('buys Core Run Levels with Salvage and resets them on Extract', () => {
    let s = createInitialState(0)
    s.resources.scrap = 80
    s = launch(s)
    s.resources.salvage = 80
    s = upgradeModule(s, 'pulse-cannon')
    expect(s.combat.coreRunLevels?.['0']).toBe(1)
    expect(s.resources.salvage).toBeLessThan(80)
    expect(s.resources.scrap).toBe(80)
    s = setDocked(s, true)
    expect(s.combat.coreRunLevels?.['0'] ?? 0).toBe(0)
    s = upgradeModule(s, 'pulse-cannon')
    expect(s.combat.coreRunLevels?.['0'] ?? 0).toBe(0)
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
