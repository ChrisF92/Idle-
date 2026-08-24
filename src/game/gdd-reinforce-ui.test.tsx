import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReinforceTab } from '../components/tabs/ReinforceTab'
import { Act1FinaleOverlay } from '../components/Act1FinaleOverlay'
import { OverlayProvider } from '../ui/overlay'
import { ACT1_CADENCE } from './cadence'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'

function reinforceState() {
  const s = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.reinforce)
  s.prestige.prestigeCount = 2
  s.hiveResearch.completed.energy = 1
  s.combat.docked = true
  s.meta.act1Cleared = true
  return s
}

function renderReinforce(state = reinforceState()) {
  const props = {
    state,
    onBack: vi.fn(),
    onReinforce: vi.fn(),
  }
  render(
    <OverlayProvider>
      <ReinforceTab {...props} />
    </OverlayProvider>,
  )
  return props
}

describe('Act 1 finale and Reinforce UI', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: String(query).includes('prefers-reduced-motion: reduce'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
        onchange: null,
      }),
    })
  })

  it('shows Act 1 status, Reinforce count, and YOU RESET / YOU KEEP / WHAT CHANGES', () => {
    renderReinforce()
    const context = document.querySelector('.ui-context-bar')!
    expect(context.textContent).toMatch(/Act 1/)
    expect(context.textContent).toMatch(/Complete/)
    expect(context.textContent).toMatch(/Reinforce count/)
    expect(screen.getByText('YOU RESET')).toBeTruthy()
    expect(screen.getByText('YOU KEEP')).toBeTruthy()
    expect(screen.getByText('WHAT CHANGES')).toBeTruthy()
    expect(screen.queryByText('GAIN')).toBeNull()
    expect(screen.getByText(/No Capital/)).toBeTruthy()
    expect(screen.getByText(/No Act 2 shop/)).toBeTruthy()
    expect(document.querySelector('.network-row')).toBeNull()
  })

  it('confirms Reinforce before reconstructing', () => {
    const props = renderReinforce()
    fireEvent.click(screen.getByRole('button', { name: 'Reinforce' }))
    expect(screen.getByRole('dialog', { name: 'Reinforce' })).toBeTruthy()
    expect(screen.getAllByText('YOU RESET').length).toBeGreaterThan(1)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Reinforce' }))
    expect(props.onReinforce).toHaveBeenCalled()
  })

  it('presents the Act 1 completion overlay with a time-loop hint', () => {
    const onContinue = vi.fn()
    const onOpenReinforce = vi.fn()
    render(
      <OverlayProvider>
        <Act1FinaleOverlay open onContinue={onContinue} onOpenReinforce={onOpenReinforce} />
      </OverlayProvider>,
    )
    expect(screen.getByRole('dialog', { name: 'Act 1 complete' })).toBeTruthy()
    expect(screen.getByText(/remembers this reconstruction/)).toBeTruthy()
    expect(screen.getByText(/stutter in time/)).toBeTruthy()
    expect(screen.getByText(/No Act 2 shop/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Reinforce' }))
    expect(onOpenReinforce).toHaveBeenCalled()
  })
})
