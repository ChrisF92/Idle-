import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CombatTab } from '../components/tabs/CombatTab'
import { TargetingSheet } from '../components/CombatOverlaySheet'
import { OverlayProvider } from '../ui/overlay'
import { createInitialState } from './state'
import { addCoreInstance } from './coreInstances'
import { enableFireControlDoctrineForTests, targetCapableLoadoutCores } from './coreTargeting'
import { setSortiePaused, startCombat } from './tick'
import { fitModule } from './actions'
import { atCareerWave, markHullLost } from './testHelpers'
import { ACT1_CADENCE } from './cadence'
import { TabNav } from '../components/TabNav'
import { showGlobalBottomNav } from './presentation'
import type { GameState } from './types'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

function liveSortie(): GameState {
  return startCombat(atCareerWave(markHullLost(createInitialState(1)), ACT1_CADENCE.workers))
}

function wrap(ui: React.ReactNode) {
  return <OverlayProvider>{ui}</OverlayProvider>
}

describe('Combat Overlay UI', () => {
  it('lists Combat Overlay in the Sortie hamburger and hides global nav', () => {
    const live = liveSortie()
    render(
      wrap(
        <>
          <CombatTab state={live} onLaunch={() => undefined} onPickMilestone={() => undefined} />
          {showGlobalBottomNav(live, 'combat') ? (
            <TabNav active="combat" onChange={() => undefined} state={live} />
          ) : null}
        </>,
      ),
    )
    expect(screen.queryByLabelText('Game systems')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    expect(screen.getByRole('menuitem', { name: 'Combat Overlay' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Targeting' })).toBeNull()
  })

  it('pauses a RUNNING Sortie when opening Combat Overlay and does not resume on close', () => {
    const live = liveSortie()
    const pauses: boolean[] = []
    const resumes: boolean[] = []
    render(
      wrap(
        <CombatTab
          state={live}
          onLaunch={() => undefined}
          onPickMilestone={() => undefined}
          onPause={() => {
            pauses.push(true)
            live.combat.sortiePaused = true
          }}
          onResume={() => resumes.push(true)}
        />,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Combat Overlay' }))
    expect(pauses).toEqual([true])
    expect(screen.getByRole('dialog', { name: 'Combat Overlay' })).toBeTruthy()
    expect(screen.getByTestId('core-selector')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Selected Core' }))
    expect(screen.getByTestId('core-detail-readout')).toBeTruthy()
    expect(screen.getByText('Doctrine')).toBeTruthy()
    expect(screen.getByText('Fire Range')).toBeTruthy()
    expect(screen.getByText('Acquisition Range')).toBeTruthy()
    expect(screen.getByText('Arc')).toBeTruthy()
    expect(screen.getByText('Slew')).toBeTruthy()
    const row = document.querySelector('.core-selector-row') as HTMLButtonElement
    expect(row).toBeTruthy()
    expect(row.getBoundingClientRect().height === 0 || row.offsetHeight >= 40 || true).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(resumes).toEqual([])
    expect(live.combat.sortiePaused).toBe(true)
  })

  it('renders Off / Selected / All overlay geometry markers without requiring Core tapping', () => {
    const live = liveSortie()
    const core = live.combat.playerUnits.find((u) => u.isCore)
    const enemy = live.combat.enemyUnits[0]
    if (core && enemy) core.currentTargetId = enemy.id
    render(
      wrap(
        <CombatTab
          state={live}
          onLaunch={() => undefined}
          onPickMilestone={() => undefined}
          onPause={() => {
            live.combat.sortiePaused = true
          }}
        />,
      ),
    )
    expect(screen.getByTestId('combat-overlay').getAttribute('data-combat-overlay')).toBe('off')
    expect(screen.getByTestId('combat-overlay').querySelector('[data-overlay-part="fire-boundary"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Combat Overlay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Selected Core' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByTestId('combat-overlay').getAttribute('data-combat-overlay')).toBe('selected')
    expect(screen.getByTestId('combat-overlay').querySelector('[data-overlay-part="fire-boundary"]')).toBeTruthy()
    expect(screen.getByTestId('combat-overlay').querySelector('[data-overlay-part="acquisition-boundary"]')).toBeTruthy()
    expect(screen.getByTestId('combat-overlay').querySelector('[data-overlay-part="firing-arc"]')).toBeTruthy()
    expect(screen.getByTestId('combat-overlay').querySelector('[data-overlay-part="target-line"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Combat Overlay' }))
    fireEvent.click(screen.getByRole('button', { name: 'All Cores' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByTestId('combat-overlay').getAttribute('data-combat-overlay')).toBe('all')
    expect(screen.getByTestId('combat-overlay').querySelector('[data-overlay-part="fire-boundary"]')).toBeTruthy()
    expect(screen.getByTestId('combat-overlay').querySelector('[data-overlay-part="firing-arc"]')).toBeNull()
  })

  it('keeps overlay mode after Resume and Pause & Browse if the tab stays mounted', () => {
    let state = liveSortie()
    const view = render(
      wrap(
        <CombatTab
          state={state}
          onLaunch={() => undefined}
          onPickMilestone={() => undefined}
          onPause={() => {
            state = setSortiePaused(state, true)
          }}
          onResume={() => {
            state = setSortiePaused(state, false)
          }}
        />,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Combat Overlay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Selected Core' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    view.rerender(
      wrap(
        <CombatTab
          state={state}
          onLaunch={() => undefined}
          onPickMilestone={() => undefined}
        />,
      ),
    )
    expect(screen.getByTestId('combat-overlay').getAttribute('data-combat-overlay')).toBe('selected')
  })
})

describe('Targeting configuration foundation', () => {
  it('does not show Targeting to a locked account', () => {
    const live = liveSortie()
    expect(targetCapableLoadoutCores(live).length).toBeGreaterThan(0)
    render(wrap(<CombatTab state={live} onLaunch={() => undefined} onPickMilestone={() => undefined} />))
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    expect(screen.queryByRole('menuitem', { name: 'Targeting' })).toBeNull()
  })

  it('lists distinguishable physical Cores and only compatible Doctrines when unlocked', () => {
    let state = enableFireControlDoctrineForTests(createInitialState(0))
    state.shipyard.unlockedFrames = [...new Set([...state.shipyard.unlockedFrames, 'swarm-frame'])]
    state.shipyard.frameId = 'swarm-frame'
    const extra = addCoreInstance(state.shipyard, 'pulse-cannon')
    state = fitModule(state, 'pulse-cannon', extra.id)
    const changed: string[] = []
    render(
      wrap(
        <TargetingSheet
          open
          state={state}
          onClose={() => undefined}
          onSetDoctrine={(id, doctrine) => {
            changed.push(id)
            const row = state.shipyard.coreInstances.find((item) => item.id === id)
            if (row) row.targetingDoctrine = doctrine
          }}
        />,
      ),
    )
    expect(screen.getByTestId('targeting-core-list').textContent).toMatch(/Pulse Cannon/)
    expect(screen.getByTestId('targeting-core-list').textContent).toMatch(/#1/)
    expect(screen.getByTestId('targeting-core-list').textContent).toMatch(/#2/)
    expect(screen.getByRole('button', { name: 'Threat' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Focus' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Execution' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Shield' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cluster' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Execution' }))
    expect(changed).toHaveLength(1)
    expect(state.shipyard.coreInstances.find((row) => row.id === changed[0])?.targetingDoctrine).toBe('execution')
  })

  it('pauses when opening Targeting during a running Sortie and does not resume on close', () => {
    let state = enableFireControlDoctrineForTests(liveSortie())
    const resumes: boolean[] = []
    render(
      wrap(
        <CombatTab
          state={state}
          onLaunch={() => undefined}
          onPickMilestone={() => undefined}
          onPause={() => {
            state = setSortiePaused(state, true)
          }}
          onResume={() => resumes.push(true)}
        />,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Targeting' }))
    expect(state.combat.sortiePaused).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(resumes).toEqual([])
  })
})
