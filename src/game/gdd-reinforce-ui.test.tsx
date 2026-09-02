import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Act1FinaleOverlay } from '../components/Act1FinaleOverlay'
import { ReinforceTab } from '../components/tabs/ReinforceTab'
import { OverlayProvider } from '../ui/overlay'
import { createInitialState } from './state'

function clearedState() {
  const state = createInitialState(0)
  state.meta.act1Cleared = true
  state.meta.bestWave = 1000
  state.combat.bestWave = 1000
  return state
}

describe('Act 1 finale and Reinforce UI', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  it('presents Reinforce as a read-only future direction', () => {
    render(
      <OverlayProvider>
        <ReinforceTab state={clearedState()} onBack={vi.fn()} />
      </OverlayProvider>,
    )
    expect(screen.getByRole('heading', { name: 'Beyond Act 1' })).toBeTruthy()
    expect(screen.getByText(/future direction, not an active reset/i)).toBeTruthy()
    expect(screen.getByText(/whether Hiveworks needs a second prestige layer/i)).toBeTruthy()
    expect(screen.getByText(/No resources are spent/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Reinforce/i })).toBeNull()
    expect(screen.queryByText(/YOU RESET|YOU KEEP|WHAT CHANGES/)).toBeNull()
  })

  it('presents the Act 1 completion overlay with the time-loop hint', () => {
    const onOpenReinforce = vi.fn()
    render(
      <OverlayProvider>
        <Act1FinaleOverlay open onContinue={vi.fn()} onOpenReinforce={onOpenReinforce} />
      </OverlayProvider>,
    )
    expect(screen.getByRole('dialog', { name: 'Act 1 complete' })).toBeTruthy()
    expect(screen.getByText(/remembers this reconstruction/)).toBeTruthy()
    expect(screen.getByText(/no second reset or Act 2 economy/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'View what lies beyond' }))
    expect(onOpenReinforce).toHaveBeenCalledOnce()
  })
})
