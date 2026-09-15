import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InventoryScreen } from '../components/InventoryScreen'
import { OverlayProvider } from '../ui/overlay'
import { grantModuleCopy } from './coreProgression'
import { createInitialState } from './state'

afterEach(cleanup)

function renderInventory(docked = true) {
  const state = createInitialState(0)
  grantModuleCopy(state, 'pulse-cannon')
  state.combat.docked = docked
  state.combat.sortiePaused = !docked
  const onFitCore = vi.fn()
  render(
    <OverlayProvider>
      <InventoryScreen
        state={state}
        open
        onClose={() => undefined}
        onFitCore={onFitCore}
        onUpgradeCore={() => undefined}
      />
    </OverlayProvider>,
  )
  return { state, onFitCore }
}

describe('Loadout and Inventory navigation', () => {
  it('uses one overlay layer for Inventory inspection and restores the parent screen', () => {
    renderInventory()
    const available = screen.getByText(/Attack Core · Copy 2 · Available/).closest('button')
    expect(available).toBeTruthy()
    fireEvent.click(available!)
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(screen.queryByRole('dialog', { name: 'Inventory' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Fit Core' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('dialog', { name: 'Inventory' })).toBeTruthy()
    expect(screen.getByText(/Attack Core · Copy 2 · Available/)).toBeTruthy()
  })

  it('makes Inventory visibly read-only during a suspended live Sortie', () => {
    renderInventory(false)
    expect(screen.getByText('Inventory is read-only while a Sortie is live.')).toBeTruthy()
    fireEvent.click(screen.getByText(/Attack Core · Copy 2 · Available/).closest('button')!)
    const locked = screen.getByRole('button', { name: 'Locked until Dock' }) as HTMLButtonElement
    expect(locked.disabled).toBe(true)
  })
})
