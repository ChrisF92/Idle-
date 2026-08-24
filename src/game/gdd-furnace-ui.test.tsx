import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FurnaceTab } from '../components/tabs/FurnaceTab'
import { OverlayProvider } from '../ui/overlay'
import { ACT1_CADENCE } from './cadence'
import { furnaceHubStatus } from './systemsHub'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'

function furnaceState() {
  const state = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.furnace)
  state.resources.choirAsh = 40
  state.resources.heat = 20
  state.furnace.active.weapons = 2
  state.furnace.wanted.weapons = 2
  return state
}

function renderFurnace(state = furnaceState()) {
  const props = {
    state,
    onBack: vi.fn(),
    onConvert: vi.fn(),
    onSetChannel: vi.fn(),
  }
  render(
    <OverlayProvider>
      <FurnaceTab {...props} />
    </OverlayProvider>,
  )
  return props
}

describe('Furnace finalisation UI', () => {
  afterEach(() => cleanup())

  it('shows Ash, Heat, conversion, and live effects in the header', () => {
    renderFurnace()
    const context = document.querySelector('.ui-context-bar')!
    expect(context.textContent).toContain('Ash')
    expect(context.textContent).toContain('40')
    expect(context.textContent).toContain('Heat')
    expect(context.textContent).toContain('20')
    expect(context.textContent).toContain('10 Ash → 1 Heat')
    expect(context.textContent).toContain('Weapon Output ×1.80')
  })

  it('uses three large channel cards instead of network rows', () => {
    renderFurnace()
    expect(screen.getByText(/WEAPONS — II/)).toBeTruthy()
    expect(screen.getByText(/WARD — Off/)).toBeTruthy()
    expect(screen.getByText(/YIELD — Off/)).toBeTruthy()
    expect(screen.getByText('Weapon Output ×1.80')).toBeTruthy()
    expect(screen.getByText(/III → ×2\.50/)).toBeTruthy()
    expect(screen.getByText('28 Heat')).toBeTruthy()
    expect(document.querySelectorAll('.furnace-channel-card').length).toBe(3)
    expect(document.querySelector('.network-row')).toBeNull()
    expect(screen.getByRole('button', { name: /Convert 4 Heat/ })).toBeTruthy()
  })

  it('opens a detail sheet with tiers, costs, trade-off, and Sortie reset', () => {
    const props = renderFurnace()
    fireEvent.click(screen.getByRole('button', { name: 'Weapons details' }))
    expect(screen.getByRole('dialog', { name: 'Weapons' })).toBeTruthy()
    expect(screen.getByText(/Weapon Output ×1\.40/)).toBeTruthy()
    expect(screen.getByText(/8 Heat/)).toBeTruthy()
    expect(screen.getByText(/48 Heat/)).toBeTruthy()
    expect(screen.getByText(/Heat not spent on Ward or Yield/)).toBeTruthy()
    expect(screen.getByText(/reset when the Sortie ends/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'II · 20' }))
    expect(props.onSetChannel).toHaveBeenCalledWith('weapons', 2)
  })

  it('prints Ash, Heat, and active channels on the Systems card', () => {
    const state = furnaceState()
    expect(furnaceHubStatus(state)).toEqual(['Ash 40', 'Heat 20', 'Weapons II'])
  })
})
