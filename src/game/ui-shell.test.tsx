import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CombatTab } from '../components/tabs/CombatTab'
import { NetworkTab } from '../components/tabs/NetworkTab'
import { ScreenHelp } from '../components/ScreenHelp'
import { StatsTab } from '../components/tabs/StatsTab'
import { createInitialState } from './state'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

describe('shell UX', () => {
  it('keeps Network off the Sortie sheet', () => {
    const state = createInitialState(0)
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onSetPushMode={() => undefined}
        onUpgrade={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Network' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Cores' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Launch' })).toBeTruthy()
    expect(document.querySelector('[data-guide="sortie-canvas"]')).toBeTruthy()
    expect(document.querySelector('[data-guide="sortie-hull"]')).toBeTruthy()
    expect(document.querySelector('[data-guide="cores-sheet"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cores' }))
    expect(screen.getByText(/Salvage ranks these/i)).toBeTruthy()
    expect(screen.getByText(/Drones live on Network/i)).toBeTruthy()
    expect(document.querySelector('[data-guide="core-pulse-cannon"]')).toBeTruthy()
  })

  it('spotlights Network manufacture, corps, and Links', () => {
    render(
      <NetworkTab
        state={createInitialState(0)}
        onAssign={() => undefined}
        onBuyLink={() => undefined}
      />,
    )
    expect(document.querySelector('[data-guide="network-manufacture"]')).toBeTruthy()
    expect(document.querySelector('[data-guide="network-corps"]')).toBeTruthy()
    expect(document.querySelector('[data-guide="network-strike"]')).toBeTruthy()
    expect(document.querySelector('[data-guide="network-links"]')).toBeTruthy()
  })

  it('opens per-screen help from the info button', () => {
    render(<ScreenHelp screen="combat" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sortie info' }))
    expect(screen.getByRole('dialog', { name: 'Sortie' })).toBeTruthy()
    expect(screen.getByText(/Drones belong on the Network tab/i)).toBeTruthy()
  })

  it('lists Coming up stations and folds later systems on More', () => {
    const state = createInitialState(0)
    render(
      <StatsTab
        state={state}
        onHardReset={() => undefined}
        onImport={() => false}
        onDevAction={() => undefined}
        onOpenStation={() => undefined}
      />,
    )
    expect(screen.getByText('Coming up')).toBeTruthy()
    expect(screen.getByText('Reliquary')).toBeTruthy()
    expect(screen.getByText(/Later systems/)).toBeTruthy()
    expect(screen.getByText('Capital')).toBeTruthy()
  })
})
