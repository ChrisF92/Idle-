import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CombatTab } from '../components/tabs/CombatTab'
import { DockTab } from '../components/tabs/DockTab'
import { SystemsTab } from '../components/tabs/SystemsTab'
import { SortieReport } from '../components/SortieReport'
import { createInitialState } from './state'
import { markHullLost } from './testHelpers'
import { setDocked } from './tick'
import { buyRunUpgrade, buyWorkshopUpgrade } from './actions'
import { nextRunUpgradeCost, runPurchasedLevel, runUpgradeCost, workshopLevel } from './workshop'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

describe('UI/UX pass regression', () => {
  it('hides Pressure from Sortie and the report', () => {
    const state = markHullLost(createInitialState(0))
    state.combat.docked = false
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.queryByText(/Pressure/i)).toBeNull()
    cleanup()
    render(
      <SortieReport
        summary={{ ...state.combat.lastSortie, outcome: 'defeat', wave: 12, previousBest: 8, newBest: true }}
        state={state}
        onClose={() => undefined}
      />,
    )
    expect(screen.queryByText(/Pressure/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Dock' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Continue|Run Again/ })).toBeTruthy()
  })

  it('locks Dock loadout copy while a Sortie is live', () => {
    const state = markHullLost(createInitialState(0))
    state.combat.docked = false
    render(
      <DockTab
        state={state}
        onLaunch={() => undefined}
        onOpenSortie={() => undefined}
        onRebuild={() => undefined}
      />,
    )
    expect(screen.getByText(/Prep is locked until this Sortie docks/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Return to Sortie/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Loadout/ }))
    expect(screen.getByText(/Loadout is locked until this Sortie docks/i)).toBeTruthy()
  })

  it('keeps Worker Drones as the Systems header without Manage buttons', () => {
    const state = markHullLost(createInitialState(0))
    state.meta.bestWave = 40
    state.combat.bestWave = 40
    render(<SystemsTab state={state} onManage={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Systems' })).toBeTruthy()
    expect(screen.getByText('Worker Drones')).toBeTruthy()
    expect(screen.queryByText(/Network/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Manage/ })).toBeNull()
  })

  it('resets the Sortie cost ladder independently of Workshop after Extract', () => {
    let s = createInitialState(0)
    s.meta.hullLostOnce = true
    s.combat.docked = true
    s.resources.scrap = 10_000
    s = buyWorkshopUpgrade(s, 'weapon-power')
    s = buyWorkshopUpgrade(s, 'weapon-power')
    expect(workshopLevel(s, 'weapon-power')).toBe(2)
    s = setDocked(s, false)
    s.resources.salvage = 10_000
    const first = nextRunUpgradeCost(s, 'weapon-power')
    expect(first).toBe(runUpgradeCost(0))
    s = buyRunUpgrade(s, 'weapon-power')
    expect(runPurchasedLevel(s, 'weapon-power')).toBe(1)
    s = setDocked(s, true)
    expect(runPurchasedLevel(s, 'weapon-power')).toBe(0)
    s = setDocked(s, false)
    expect(nextRunUpgradeCost(s, 'weapon-power')).toBe(runUpgradeCost(0))
  })
})
