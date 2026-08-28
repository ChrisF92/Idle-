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
  state.combat.docked = false
  state.combat.inFight = true
  state.resources.choirAsh = 40
  state.resources.heat = 100
  return state
}

function renderFurnace(state = furnaceState()) {
  const props = {
    state,
    onBack: vi.fn(),
    onConvert: vi.fn(),
    onIgnite: vi.fn(),
  }
  render(
    <OverlayProvider>
      <FurnaceTab {...props} />
    </OverlayProvider>,
  )
  return props
}

describe('PR8 Furnace UI', () => {
  afterEach(() => cleanup())

  it('shows Ash, Heat, 10:1 conversion, and CONFIGURE state', () => {
    renderFurnace()
    const context = document.querySelector('.ui-context-bar')!
    expect(context.textContent).toContain('Ash')
    expect(context.textContent).toContain('40')
    expect(context.textContent).toContain('Heat')
    expect(context.textContent).toContain('100')
    expect(context.textContent).toContain('10 Ash → 1 Heat')
    expect(context.textContent).toContain('CONFIGURE')
  })

  it('renders exactly Overdrive, Bulwark, Guidance, and Harvest', () => {
    renderFurnace()
    expect(screen.getByText(/OVERDRIVE — OFF/)).toBeTruthy()
    expect(screen.getByText(/BULWARK — OFF/)).toBeTruthy()
    expect(screen.getByText(/GUIDANCE — OFF/)).toBeTruthy()
    expect(screen.getByText(/HARVEST — OFF/)).toBeTruthy()
    expect(document.querySelectorAll('.furnace-channel-card').length).toBe(4)
    expect(document.querySelector('[data-onboarding="onboarding.furnace.channel"]')).toBeTruthy()
  })

  it('requires Configure → Prime → Ignite and sends the selected locked configuration', () => {
    const props = renderFurnace()
    fireEvent.click(screen.getAllByRole('button', { name: 'II · 25' })[0]!)
    expect(screen.getByText(/Selected 1\/2 · Ignite cost 25 Heat/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Prime configuration' }))
    expect(screen.getByText(/PRIMED/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ignite and Lock' }))
    expect(props.onIgnite).toHaveBeenCalledWith({ overdrive: 2, bulwark: 0, guidance: 0, harvest: 0 })
  })

  it('prints Ash, Heat, and canonical lit channels on the Systems card', () => {
    const state = furnaceState()
    state.resources.heat = 20
    state.furnace = {
      ignited: true,
      channels: { overdrive: 2, bulwark: 0, guidance: 0, harvest: 1 },
      effectStrengthMult: 1,
    }
    expect(furnaceHubStatus(state)).toEqual(['Ash 40', 'Heat 20', 'Overdrive II · Harvest I'])
  })
})
