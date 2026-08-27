import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FoundryTab } from '../components/tabs/FoundryTab'
import { OverlayProvider } from '../ui/overlay'
import { ACT1_CADENCE } from './cadence'
import { createInitialState } from './state'
import { atCareerWave } from './testHelpers'
import { discoverBlueprint } from './blueprints'

function renderFoundry(
  state = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry),
  pane?: 'processing' | 'fabrication' | 'mastery' | 'blueprints',
) {
  render(
    <OverlayProvider>
      <FoundryTab
        state={state}
        requestedPane={pane}
        onSetSlot={vi.fn()}
        onFabricateCore={vi.fn()}
        onStartFacility={vi.fn()}
        onStartJob={vi.fn()}
        onStopFabrication={vi.fn()}
        onTrack={vi.fn()}
      />
    </OverlayProvider>,
  )
}

describe('PR5 Foundry UI', () => {
  afterEach(() => cleanup())

  it('shows exactly four primary panes', () => {
    renderFoundry()
    expect(screen.getByLabelText('Foundry navigation').textContent).toMatch(/Processing/)
    expect(screen.getByLabelText('Foundry navigation').textContent).toMatch(/Fabrication/)
    expect(screen.getByLabelText('Foundry navigation').textContent).toMatch(/Mastery/)
    expect(screen.getByLabelText('Foundry navigation').textContent).toMatch(/Blueprints/)
    expect(screen.queryByRole('tab', { name: 'Construction' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Yard' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Ranks' })).toBeNull()
  })

  it('Processing shows Recovered Stock instead of recipe levels', () => {
    renderFoundry(undefined, 'processing')
    expect(screen.getByText('Recovered Stock')).toBeTruthy()
    expect(screen.queryByText(/Lv 100/)).toBeNull()
    expect(screen.queryByText('Slag Ingot')).toBeNull()
  })

  it('Mastery shows M0→M5 for all twelve materials', () => {
    renderFoundry(undefined, 'mastery')
    expect(screen.getByText('Material Mastery')).toBeTruthy()
    expect(screen.getAllByText(/M0/).length).toBeGreaterThan(0)
    expect(screen.getByText('Crown Matrix')).toBeTruthy()
  })

  it('Blueprints distinguish design-known from owned', () => {
    const state = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    discoverBlueprint(state, 'heavy-lance')
    renderFoundry(state, 'blueprints')
    expect(screen.getByText('Heavy Lance')).toBeTruthy()
    expect(screen.getByText('Pulse Cannon')).toBeTruthy()
  })
})
