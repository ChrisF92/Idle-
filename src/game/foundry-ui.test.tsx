import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FoundryTab } from '../components/tabs/FoundryTab'
import { OverlayProvider } from '../ui/overlay'
import { ACT1_CADENCE } from './cadence'
import { createInitialState } from './state'
import { atCareerWave } from './testHelpers'
import { discoverBlueprint, grantBlueprintFragment } from './blueprints'

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
    expect(screen.getAllByText(/Owned · 1 physical/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Design known — fabrication required/).length).toBeGreaterThan(0)
  })

  it('Fabrication keeps Cores / Frames / Workers / Infrastructure filters on the pane', () => {
    renderFoundry(undefined, 'fabrication')
    const cats = screen.getByLabelText('Fabrication category')
    expect(cats.textContent).toMatch(/Cores/)
    expect(cats.textContent).toMatch(/Frames/)
    expect(cats.textContent).toMatch(/Workers/)
    expect(cats.textContent).toMatch(/Infrastructure/)
    expect(screen.getByText('Blueprint discovered ≠ item owned. Copy count is physical instances.')).toBeTruthy()
  })

  it('hides UNKNOWN Blueprint names and does not offer Track', () => {
    const onTrack = vi.fn()
    const state = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    render(
      <OverlayProvider>
        <FoundryTab
          state={state}
          requestedPane="blueprints"
          onSetSlot={vi.fn()}
          onFabricateCore={vi.fn()}
          onStartFacility={vi.fn()}
          onStartJob={vi.fn()}
          onTrack={onTrack}
        />
      </OverlayProvider>,
    )
    expect(screen.queryByText('Rapid Aegis')).toBeNull()
    expect(screen.queryByText('Nano Lathe')).toBeNull()
    expect(screen.queryByText('Salvage Beacon')).toBeNull()
    expect(screen.getAllByText('Unknown Core').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('tab', { name: 'Frames' }))
    expect(screen.queryByText('Bastion')).toBeNull()
    expect(screen.getAllByText('Unknown Frame').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('tab', { name: 'Cores' }))
    fireEvent.click(screen.getAllByText('Unknown Core')[0]!.closest('button')!)
    expect(screen.queryByRole('button', { name: 'Track' })).toBeNull()
    expect(onTrack).not.toHaveBeenCalled()
    expect(screen.queryByText('Rapid Aegis')).toBeNull()
    expect(screen.queryByText(/Shield-Lattice/)).toBeNull()
  })

  it('reveals Blueprint identity after the first fragment', () => {
    const state = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    state.foundry.fragments['rapid-aegis'] = 1
    renderFoundry(state, 'blueprints')
    expect(screen.getByText('Rapid Aegis')).toBeTruthy()
    expect(screen.getByText(/Rapid Aegis Schematic 1\/4/)).toBeTruthy()
  })

  it('hides UNKNOWN Core and Frame names on the Fabrication pane', () => {
    renderFoundry(undefined, 'fabrication')
    expect(screen.queryByText('Rapid Aegis')).toBeNull()
    expect(screen.queryByText('Nano Lathe')).toBeNull()
    expect(screen.queryByText('Salvage Beacon')).toBeNull()
    expect(screen.queryByText('Heavy Lance')).toBeNull()
    expect(screen.getAllByText('Unknown Core').length).toBeGreaterThan(0)
    expect(screen.getByText('Pulse Cannon')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Frames' }))
    expect(screen.queryByText('Bastion')).toBeNull()
    expect(screen.queryByText('Reactor')).toBeNull()
    expect(screen.getAllByText('Unknown Frame').length).toBeGreaterThan(0)
  })

  it('reveals Fabrication identity after a fragment, and requirements only after discovery', () => {
    const fragmented = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    grantBlueprintFragment(fragmented, 'heavy-lance', 1)
    renderFoundry(fragmented, 'fabrication')
    const heavyRow = screen.getByText('Heavy Lance').closest('button')
    expect(heavyRow).toBeTruthy()
    expect(heavyRow?.textContent).toMatch(/Fragmented — fabrication locked/)
    expect(heavyRow?.textContent).not.toMatch(/Fabricate/)
    expect(heavyRow?.textContent).not.toMatch(/Tempered Alloy/)
    expect(heavyRow?.textContent).not.toMatch(/2m 30s/)
    expect(heavyRow).toHaveProperty('disabled', true)
    cleanup()

    const discovered = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    discoverBlueprint(discovered, 'heavy-lance')
    renderFoundry(discovered, 'fabrication')
    const known = screen.getByText('Heavy Lance').closest('button')
    expect(known?.textContent).toMatch(/Tempered Alloy/)
    expect(known?.textContent).toMatch(/Ballistic Composite/)
    expect(known?.textContent).toMatch(/2m 30s/)
    expect(known?.textContent).not.toMatch(/Fragmented — fabrication locked/)
  })
})
