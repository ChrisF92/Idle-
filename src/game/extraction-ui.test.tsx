import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CombatTab } from '../components/tabs/CombatTab'
import { OverlayProvider } from '../ui/overlay'
import { grantGeneratedScrap } from './rebuild'
import { createInitialState } from './state'
import { markHullLost } from './testHelpers'
import { setDocked } from './tick'
import type { GameState } from './types'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

function liveCombat(bestWave = 1): GameState {
  const state = setDocked(markHullLost(createInitialState(0)), false)
  state.meta.bestWave = bestWave
  state.combat.bestWave = Math.max(state.combat.bestWave ?? 0, bestWave)
  return state
}

function renderCombat(
  state: GameState,
  handlers: Partial<{ extract: () => void; pause: () => void; resume: () => void; browse: () => void }> = {},
) {
  return render(
    <OverlayProvider>
      <div style={{ width: 360 }}>
        <CombatTab
          state={state}
          onLaunch={() => undefined}
          onExtract={handlers.extract}
          onPause={handlers.pause}
          onResume={handlers.resume}
          onPauseAndBrowse={handlers.browse}
        />
      </div>
    </OverlayProvider>,
  )
}

function openLeaveSheet() {
  fireEvent.click(screen.getByRole('button', { name: /menu|more/i }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Leave Sortie' }))
  return screen.getByRole('dialog', { name: 'Leave Sortie' })
}

describe('Leave Sortie UI', () => {
  it('always offers Suspend but keeps Withdraw locked before W210', () => {
    renderCombat(liveCombat(20))
    const dialog = openLeaveSheet()
    expect(within(dialog).getByRole('button', { name: 'Suspend Sortie' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Withdraw' }).hasAttribute('disabled')).toBe(true)
    expect(within(dialog).getByText(/Unlocks at Best Wave 210/i)).toBeTruthy()
  })

  it('pauses on open, resumes on Keep Fighting, and withdraws only on confirmation', () => {
    let paused = 0
    let resumed = 0
    let withdrawn = 0
    const state = liveCombat(210)
    grantGeneratedScrap(state, 100, 'combat-kill')
    renderCombat(state, {
      pause: () => { paused += 1 },
      resume: () => { resumed += 1 },
      extract: () => { withdrawn += 1 },
    })
    let dialog = openLeaveSheet()
    expect(within(dialog).getByText(/No Matter/i)).toBeTruthy()
    expect(within(dialog).getByText(/Withdrawal bonus \+12/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep Fighting' }))
    expect(paused).toBe(1)
    expect(resumed).toBe(1)
    expect(withdrawn).toBe(0)

    dialog = openLeaveSheet()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw' }))
    expect(withdrawn).toBe(1)
  })

  it('suspends to browse while keeping the live loadout locked', () => {
    let browsed = false
    const state = liveCombat(210)
    state.shipyard.frameLocked = true
    renderCombat(state, { browse: () => { browsed = true } })
    const dialog = openLeaveSheet()
    expect(within(dialog).getByText(/loadout stays locked/i)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend Sortie' }))
    expect(browsed).toBe(true)
    expect(state.shipyard.frameLocked).toBe(true)
  })

  it('keeps Withdraw disabled during an active Challenge', () => {
    const state = liveCombat(210)
    state.challenges.activeId = 'glass-frame'
    state.combat.sortieMark = { ...state.combat.sortieMark!, challengeSortie: true }
    renderCombat(state)
    const dialog = openLeaveSheet()
    expect(within(dialog).getByRole('button', { name: 'Withdraw' }).hasAttribute('disabled')).toBe(true)
    expect(within(dialog).getByText(/Challenges cannot Withdraw/i)).toBeTruthy()
  })
})
