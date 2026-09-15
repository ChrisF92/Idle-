import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CombatTab } from '../components/tabs/CombatTab'
import { OverlayProvider } from '../ui/overlay'
import { createInitialState } from './state'
import { markHullLost } from './testHelpers'
import { setDocked } from './tick'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

function renderSortie() {
  const state = setDocked(markHullLost(createInitialState(0)), false)
  state.combat.fightElapsed = 42
  state.combat.enemyName = 'Choir Skirmisher'
  const pause = vi.fn()
  const resume = vi.fn()
  render(
    <OverlayProvider>
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onPause={pause}
        onResume={resume}
        onPauseAndBrowse={() => undefined}
      />
    </OverlayProvider>,
  )
  return { pause, resume }
}

describe('Sortie navigation surface', () => {
  it('keeps telemetry out of the primary HUD and exposes it through Run Details', () => {
    const { pause, resume } = renderSortie()
    const primary = document.querySelector('.sortie-hud-mid')
    expect(primary?.textContent?.trim()).toBe('W1')
    expect(primary?.textContent).not.toContain('DPS')
    expect(primary?.textContent).not.toContain('hostiles')

    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Run Details' }))
    const details = screen.getByRole('dialog', { name: 'Run Details' })
    expect(within(details).getByText('DPS')).toBeTruthy()
    expect(within(details).getByText('Elapsed')).toBeTruthy()
    expect(within(details).getByText('Hostiles')).toBeTruthy()
    expect(within(details).getByText(/Choir Skirmisher/)).toBeTruthy()
    expect(pause).toHaveBeenCalledOnce()

    fireEvent.click(within(details).getByRole('button', { name: 'Close' }))
    expect(resume).toHaveBeenCalledOnce()
  })

  it('opens Upgrades as the dedicated categorized drawer', () => {
    renderSortie()
    const drawer = screen.getByLabelText('Sortie upgrades')
    expect(drawer.classList.contains('is-collapsed')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Show upgrades' }))
    expect(drawer.classList.contains('is-collapsed')).toBe(false)
    expect(screen.getByRole('tab', { name: 'Attack' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Defense' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Economy' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Cores' })).toBeNull()
  })
})
