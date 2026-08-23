import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DockTab } from '../components/tabs/DockTab'
import { StatsTab } from '../components/tabs/StatsTab'
import { SystemsTab } from '../components/tabs/SystemsTab'
import { TabNav } from '../components/TabNav'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'
import { ACT1_CADENCE } from './cadence'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

describe('GDD shell information architecture', () => {
  it('marks Systems active while Worker Drones are open', () => {
    const state = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.workers)
    render(<TabNav active="network" onChange={() => undefined} state={state} />)
    expect(screen.getByRole('button', { name: /Systems/ }).className).toMatch(/\bactive\b/)
    expect(screen.getByRole('button', { name: /More/ }).className).not.toMatch(/\bactive\b/)
  })

  it('shows Foundry and Worker Drones as Systems cards', () => {
    const state = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.workers)
    render(<SystemsTab state={state} onManage={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Systems' })).toBeTruthy()
    expect(screen.getByText('Foundry')).toBeTruthy()
    expect(screen.getByText('Worker Drones')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Manage/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Worker Drones/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Foundry/ })).toBeTruthy()
  })

  it('lists Codex as Coming up and hides the later-systems dump', () => {
    render(
      <StatsTab
        state={createInitialState(0)}
        onHardReset={() => undefined}
        onImport={() => false}
        onDevAction={() => undefined}
        onOpenStation={() => undefined}
      />,
    )
    expect(screen.getByText('Next system')).toBeTruthy()
    expect(screen.getByText('Codex')).toBeTruthy()
    expect(screen.queryByText(/Later systems/)).toBeNull()
    expect(screen.queryByText('Furnace')).toBeNull()
    expect(screen.queryByText('Workers')).toBeNull()
  })

  it('groups Dock around Best Wave, Scrap, Matter, Loadout, Workshop, and Rebuild', () => {
    const state = markHullLost(createInitialState(0))
    state.resources.scrap = 40
    render(
      <DockTab
        state={state}
        onLaunch={() => undefined}
        onOpenSortie={() => undefined}
        onOpenInventory={() => undefined}
        onRebuild={() => undefined}
      />,
    )
    expect(screen.getByText('Best Wave')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Loadout/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Workshop/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Rebuild/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Inventory' })).toBeNull()
    expect(screen.queryByText(/Permanent strength is Mastery/i)).toBeNull()
    expect(screen.queryByText(/Equip Cores and Relics here/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Workshop/ }))
    expect(screen.getByText('Weapon Power')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Defense' }))
    expect(screen.queryByText('Weapon Power')).toBeNull()
    expect(screen.getAllByText('Hull').length).toBeGreaterThan(0)
  })
})
