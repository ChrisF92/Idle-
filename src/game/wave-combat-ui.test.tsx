import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CombatTab } from '../components/tabs/CombatTab'
import { LiveWaveControl } from '../components/LiveWaveControl'
import { TabNav } from '../components/TabNav'
import { createInitialState } from './state'
import {
  advanceSeconds,
  extractSortie,
  setSortiePaused,
  startCombat,
} from './tick'
import {
  isSortieActive,
  showGlobalBottomNav,
  showSortieReturnControl,
} from './presentation'
import { atCareerWave, markHullLost } from './testHelpers'
import { ACT1_CADENCE } from './cadence'
import type { GameState, TabId } from './types'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

function liveSortie(): GameState {
  return startCombat(atCareerWave(markHullLost(createInitialState(1)), ACT1_CADENCE.workers))
}

function SortieChrome({
  state,
  tab,
  onTab,
}: {
  state: GameState
  tab: TabId
  onTab: (next: TabId) => void
}) {
  return (
    <>
      {tab === 'combat' ? (
        <CombatTab
          state={state}
          onLaunch={() => undefined}
          onExtract={() => undefined}
          onPause={() => undefined}
          onResume={() => undefined}
          onPauseAndBrowse={() => undefined}
        />
      ) : null}
      {showSortieReturnControl(state, tab) ? (
        <LiveWaveControl
          wave={Math.max(1, state.combat.waveReached || state.combat.wave)}
          onReturn={() => onTab('combat')}
        />
      ) : null}
      {showGlobalBottomNav(state, tab) ? (
        <TabNav active={tab} onChange={onTab} state={state} />
      ) : null}
    </>
  )
}

describe('live Sortie chrome and pause/browse contract', () => {
  it('renders DOCK | SYSTEMS | MORE while docked', () => {
    const docked = atCareerWave(markHullLost(createInitialState(1)), ACT1_CADENCE.workers)
    render(<TabNav active="dock" onChange={() => undefined} state={docked} />)
    expect(screen.getByLabelText('Game systems')).toBeTruthy()
    expect(screen.getByText('Dock')).toBeTruthy()
    expect(screen.getByText('Systems')).toBeTruthy()
    expect(screen.getByText('More')).toBeTruthy()
    expect(isSortieActive(docked)).toBe(false)
    expect(showGlobalBottomNav(docked, 'dock')).toBe(true)
  })

  it('hides global nav on a running Sortie combat view', () => {
    const live = liveSortie()
    const { rerender } = render(<SortieChrome state={live} tab="combat" onTab={() => undefined} />)
    expect(showGlobalBottomNav(live, 'combat')).toBe(false)
    expect(screen.queryByLabelText('Game systems')).toBeNull()
    expect(screen.queryByText('Dock')).toBeNull()
    rerender(<SortieChrome state={live} tab="combat" onTab={() => undefined} />)
    expect(document.querySelector('.tab-nav, nav.tab-nav, [aria-label="Game systems"]')).toBeNull()
  })

  it('lists Pause and Pause & Browse; Extract stays locked before W210', () => {
    const live = liveSortie()
    render(
      <CombatTab
        state={live}
        onLaunch={() => undefined}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    expect(screen.getByRole('menuitem', { name: 'Pause' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Pause & Browse' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Extract' })).toBeNull()
    expect(screen.getByText(/Unlocks at Best Wave 210/i)).toBeTruthy()
  })

  it('Pause freezes simTime, enemies, Wave timers, and cooldowns until Resume', () => {
    let state = liveSortie()
    for (const unit of [...state.combat.playerUnits, ...state.combat.enemyUnits]) {
      for (const weapon of unit.weapons) {
        weapon.damage = 0
        weapon.cooldownLeft = 4
      }
    }
    advanceSeconds(state, 0.5)
    const sim = state.combat.simTime
    const nextAt = state.combat.nextReinforcementAt
    const pos = state.combat.enemyUnits.map((u) => ({ id: u.id, x: u.x, y: u.y }))
    const cd = state.combat.playerUnits.flatMap((u) => u.weapons.map((w) => w.cooldownLeft))
    state = setSortiePaused(state, true)
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
      />,
    )
    expect(screen.getByText('SORTIE PAUSED')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy()
    advanceSeconds(state, 2)
    expect(state.combat.simTime).toBe(sim)
    expect(state.combat.nextReinforcementAt).toBe(nextAt)
    expect(state.combat.enemyUnits.map((u) => ({ id: u.id, x: u.x, y: u.y }))).toEqual(pos)
    expect(state.combat.playerUnits.flatMap((u) => u.weapons.map((w) => w.cooldownLeft))).toEqual(cd)
    state = setSortiePaused(state, false)
    advanceSeconds(state, 0.4)
    expect(state.combat.simTime).toBeGreaterThan(sim)
  })

  it('Pause & Browse freezes combat, shows account nav, and Return does not Resume', () => {
    let state = liveSortie()
    const sim = state.combat.simTime
    let tab: TabId = 'combat'
    function Harness() {
      const [, setN] = useState(0)
      return (
        <>
          {tab === 'combat' ? (
            <CombatTab
              state={state}
              onLaunch={() => undefined}
              onPause={() => {
                state = setSortiePaused(state, true)
                setN((n) => n + 1)
              }}
              onPauseAndBrowse={() => {
                state = setSortiePaused(state, true)
                tab = 'dock'
                setN((n) => n + 1)
              }}
              onResume={() => {
                state = setSortiePaused(state, false)
                setN((n) => n + 1)
              }}
            />
          ) : null}
          {showSortieReturnControl(state, tab) ? (
            <LiveWaveControl
              wave={Math.max(1, state.combat.waveReached || state.combat.wave)}
              onReturn={() => {
                tab = 'combat'
                setN((n) => n + 1)
              }}
            />
          ) : null}
          {showGlobalBottomNav(state, tab) ? (
            <TabNav
              active={tab}
              onChange={(next) => {
                tab = next
                setN((n) => n + 1)
              }}
              state={state}
            />
          ) : null}
        </>
      )
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pause & Browse' }))
    expect(state.combat.sortiePaused).toBe(true)
    expect(state.combat.docked).toBe(false)
    expect(isSortieActive(state)).toBe(true)
    advanceSeconds(state, 1.5)
    expect(state.combat.simTime).toBe(sim)
    expect(screen.getByLabelText('Game systems')).toBeTruthy()
    expect(screen.getByText('Dock')).toBeTruthy()
    expect(screen.getByText('Systems')).toBeTruthy()
    expect(screen.getByText('More')).toBeTruthy()
    expect(
      screen.getByText(`SORTIE PAUSED · W${Math.max(1, state.combat.waveReached || state.combat.wave)}`),
    ).toBeTruthy()
    expect(screen.getByText('Return to Sortie')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Return to Sortie/i }))
    expect(tab).toBe('combat')
    expect(state.combat.sortiePaused).toBe(true)
    expect(showGlobalBottomNav(state, 'combat')).toBe(false)
    expect(screen.queryByLabelText('Game systems')).toBeNull()
    expect(screen.getByText('SORTIE PAUSED')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(state.combat.sortiePaused).toBe(false)
    const after = state.combat.simTime
    advanceSeconds(state, 0.3)
    expect(state.combat.simTime).toBeGreaterThan(after)
  })

  it('Extract terminates the Sortie instead of pausing it', () => {
    const live = setSortiePaused(liveSortie(), true)
    expect(live.combat.sortiePaused).toBe(true)
    live.meta.bestWave = Math.max(live.meta.bestWave ?? 0, 210)
    live.combat.bestWave = Math.max(live.combat.bestWave ?? 0, 210)
    const extracted = extractSortie(live)
    expect(extracted.combat.docked).toBe(true)
    expect(extracted.combat.inFight).toBe(false)
    expect(isSortieActive(extracted)).toBe(false)
    expect(showGlobalBottomNav(extracted, 'dock')).toBe(true)
    expect(extracted.combat.sortiePaused).toBe(false)
  })
})
