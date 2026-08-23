import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CombatTab } from '../components/tabs/CombatTab'
import { DockTab } from '../components/tabs/DockTab'
import { InventoryScreen } from '../components/InventoryScreen'
import { OverlayProvider, useOverlay, useOverlayLayer } from '../ui/overlay'
import { createInitialState } from './state'
import { grantModuleCopy } from './coreProgression'
import { markHullLost } from './testHelpers'
import { useState } from 'react'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

function OverlayProbe({
  updateOpen,
  onboardOpen,
}: {
  updateOpen: boolean
  onboardOpen: boolean
}) {
  const [onboard, setOnboard] = useState(onboardOpen)
  const overlays = useOverlay()
  useOverlayLayer({
    id: 'probe-update',
    kind: 'update',
    open: updateOpen,
    onClose: () => undefined,
  })
  const onboardAllowed = useOverlayLayer({
    id: 'probe-onboard',
    kind: 'onboarding',
    open: onboard,
    onClose: () => setOnboard(false),
  })
  return (
    <div>
      <span>top:{overlays.topBlockingKind ?? 'none'}</span>
      <span>onboard:{onboardAllowed.allowed ? 'yes' : 'no'}</span>
    </div>
  )
}

describe('UI architecture reset', () => {
  it('keeps Dock Loadout as rows and opens Core detail in a sheet', () => {
    const state = markHullLost(createInitialState(0))
    render(
      <OverlayProvider>
        <DockTab
          state={state}
          onLaunch={() => undefined}
          onOpenSortie={() => undefined}
          onRebuild={() => undefined}
        />
      </OverlayProvider>,
    )
    expect(document.querySelector('.core-sheet')).toBeNull()
    expect(screen.queryByText(/Equip Cores and Relics here/i)).toBeNull()
    expect(screen.getByText('Pulse Cannon')).toBeTruthy()
    fireEvent.click(document.querySelector('.ui-item-row[data-guide="core-pulse-cannon"]')!)
    expect(screen.getByRole('dialog', { name: /Pulse Cannon/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change Core' })).toBeTruthy()
  })

  it('keeps Dock tabs and a reserved Launch control', () => {
    const state = markHullLost(createInitialState(0))
    render(
      <OverlayProvider>
        <DockTab
          state={state}
          onLaunch={() => undefined}
          onOpenSortie={() => undefined}
          onRebuild={() => undefined}
        />
      </OverlayProvider>,
    )
    expect(screen.getByRole('tab', { name: 'Loadout' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Workshop' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Rebuild' })).toBeTruthy()
    expect(document.querySelector('.ui-sticky-action')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Launch Sortie' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Rebuild' }))
    expect(screen.getByText('Preview Rebuild')).toBeTruthy()
    expect(screen.queryByText(/Permanent · Damage/)).toBeNull()
  })

  it('shows a calm pre-launch Sortie without live HUD chrome', () => {
    const state = createInitialState(0)
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onUpgrade={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.getByText('Ready')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Launch Sortie' })).toBeTruthy()
    expect(screen.queryByText('Salvage')).toBeNull()
    expect(document.querySelector('[data-guide="sortie-hull"]')).toBeNull()
    expect(screen.queryByRole('button', { name: /CORES/i })).toBeNull()
  })

  it('shows live Sortie shop without a competing Cores button', () => {
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
    expect(screen.getByRole('tab', { name: 'Attack' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /CORES ·/ })).toBeNull()
    expect(document.querySelector('[data-guide="sortie-hull"]')).toBeTruthy()
  })

  it('lists Inventory categories and Core copy counts', () => {
    const state = createInitialState(0)
    grantModuleCopy(state, 'pulse-cannon')
    render(
      <OverlayProvider>
        <InventoryScreen state={state} open onClose={() => undefined} />
      </OverlayProvider>,
    )
    expect(screen.getByRole('tab', { name: 'Equipment' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Relics' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Materials' })).toBeTruthy()
    expect(screen.getByText(/×2 · Eq 1/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Relics' }))
    expect(screen.getByText(/No Relics yet/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Materials' }))
    expect(screen.getByText('Industrial')).toBeTruthy()
  })

  it('blocks onboarding while an update overlay is active', () => {
    render(
      <OverlayProvider>
        <OverlayProbe updateOpen onboardOpen />
      </OverlayProvider>,
    )
    expect(screen.getByText('top:update')).toBeTruthy()
    expect(screen.getByText('onboard:no')).toBeTruthy()
  })
})
