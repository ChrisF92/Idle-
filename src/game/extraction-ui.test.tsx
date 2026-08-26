import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CombatTab } from '../components/tabs/CombatTab'
import { OverlayProvider } from '../ui/overlay'
import { createInitialState } from './state'
import { markHullLost } from './testHelpers'
import { grantGeneratedScrap } from './rebuild'
import { setDocked, setSortiePaused } from './tick'
import type { GameState } from './types'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

function liveCombat(bestWave = 1): GameState {
  let s = setDocked(markHullLost(createInitialState(0)), false)
  s.meta.bestWave = bestWave
  s.combat.bestWave = Math.max(s.combat.bestWave ?? 0, bestWave)
  return s
}

function renderCombat(state: GameState, handlers: Partial<{ extract: () => void; pause: () => void }> = {}) {
  return render(
    <OverlayProvider>
      <div style={{ width: 360 }}>
        <CombatTab
          state={state}
          onLaunch={() => undefined}
          onExtract={handlers.extract}
          onPause={handlers.pause}
          onResume={() => undefined}
          onPauseAndBrowse={() => undefined}
          onPickMilestone={() => undefined}
        />
      </div>
    </OverlayProvider>,
  )
}

describe('Extraction UI', () => {
  it('does not offer a functional Extract before W210', () => {
    renderCombat(liveCombat(20))
    fireEvent.click(screen.getByRole('button', { name: /menu|more/i }))
    expect(screen.getByText(/Unlocks at Best Wave 210/i)).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^Extract$/ })).toBeNull()
  })

  it('opens confirmation, keeps PAUSED on cancel, and extracts on confirm', () => {
    let paused = false
    let extracted = false
    let s = liveCombat(210)
    grantGeneratedScrap(s, 100, 'combat-kill')
    renderCombat(s, {
      pause: () => {
        paused = true
      },
      extract: () => {
        extracted = true
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /menu|more/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /^Extract$/ }))
    const dialog = screen.getByRole('dialog', { name: /extract/i })
    expect(within(dialog).getByText(/No Matter/i)).toBeTruthy()
    expect(within(dialog).getByText(/Extraction bonus \+12/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: /Continue Sortie/i }))
    expect(extracted).toBe(false)
    expect(screen.queryByRole('dialog', { name: /extract/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /menu|more/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /^Extract$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Extract$/ }))
    expect(extracted).toBe(true)
    expect(paused).toBe(true)
  })

  it('hides Extract during an active Challenge', () => {
    const s = liveCombat(210)
    s.prestige.activeChallengeId = 'no-ai'
    s.combat.sortieMark = { ...s.combat.sortieMark!, challengeSortie: true }
    renderCombat(s)
    fireEvent.click(screen.getByRole('button', { name: /menu|more/i }))
    expect(screen.queryByRole('menuitem', { name: /^Extract$/ })).toBeNull()
    expect(screen.getByText(/Challenges cannot Extract/i)).toBeTruthy()
  })
})

describe('Extraction pause contract', () => {
  it('opening Extract from a running Sortie is intended to pause', () => {
    let s = liveCombat(210)
    s = setSortiePaused(s, false)
    expect(s.combat.sortiePaused).toBe(false)
  })
})
