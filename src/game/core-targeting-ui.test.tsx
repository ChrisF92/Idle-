import React, { useEffect, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CombatTab } from '../components/tabs/CombatTab'
import { TargetingSheet, CORE_SELECTOR_MIN_HEIGHT_PX } from '../components/CombatOverlaySheet'
import { GuideOverlay } from '../components/GuideOverlay'
import { OverlayProvider } from '../ui/overlay'
import { createInitialState } from './state'
import { addCoreInstance } from './coreInstances'
import { enableFireControlDoctrineForTests, targetCapableLoadoutCores } from './coreTargeting'
import { setSortiePaused, startCombat } from './tick'
import { fitModule, unfitModule } from './actions'
import { atCareerWave, markHullLost } from './testHelpers'
import { ACT1_CADENCE } from './cadence'
import { TabNav } from '../components/TabNav'
import { selectPresentation, showGlobalBottomNav } from './presentation'
import { completeLesson, lessonFinished, prepOnboardingDoor, activeOnboardingLesson } from './onboarding'
import type { GameState } from './types'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

function liveSortie(): GameState {
  return completeLesson(
    startCombat(atCareerWave(markHullLost(createInitialState(1)), ACT1_CADENCE.workers)),
    'combat-overlay.ranges',
  )
}

function wrap(ui: React.ReactNode) {
  return <OverlayProvider>{ui}</OverlayProvider>
}

function OverlayOnboardingHarness({
  initial,
  onPause,
  onResume,
}: {
  initial: GameState
  onPause?: () => void
  onResume?: () => void
}) {
  const [state, setState] = useState(initial)
  const [overlayUi, setOverlayUi] = useState<{ open: boolean; selectedCoreId: string | null }>({
    open: false,
    selectedCoreId: null,
  })
  useEffect(() => {
    if (!overlayUi.selectedCoreId) return
    setState((cur) =>
      lessonFinished(cur, 'combat-overlay.ranges') ? cur : completeLesson(cur, 'combat-overlay.ranges'),
    )
  }, [overlayUi.selectedCoreId])
  const presentationUi = {
    tab: 'combat' as const,
    combatOverlayOpen: overlayUi.open,
    combatOverlaySelectedCoreId: overlayUi.selectedCoreId,
  }
  const item = selectPresentation(state, presentationUi, [], {})
  return (
    <>
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onPause={onPause}
        onResume={onResume}
        onCombatOverlayUi={setOverlayUi}
      />
      {item?.kind === 'onboarding' ? (
        <GuideOverlay
          item={item}
          onComplete={(id) => setState((cur) => completeLesson(cur, id))}
          onSkip={() => undefined}
        />
      ) : null}
      <span data-testid="overlay-lesson-finished">{String(lessonFinished(state, 'combat-overlay.ranges'))}</span>
      <span data-testid="overlay-selected-core">{overlayUi.selectedCoreId ?? ''}</span>
    </>
  )
}

describe('Combat Overlay UI', () => {
  it('lists Combat Overlay in the Sortie hamburger and hides global nav', () => {
    const live = liveSortie()
    render(
      wrap(
        <>
          <CombatTab state={live} onLaunch={() => undefined} />
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
    expect(CORE_SELECTOR_MIN_HEIGHT_PX).toBe(44)
    expect(row.style.minHeight).toBe('44px')
    expect(row.className).toMatch(/is-selected/)
    expect(row.textContent).toMatch(/SELECTED/)
    expect(row.getAttribute('aria-pressed')).toBe('true')
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
    expect(screen.getByTestId('combat-overlay').querySelector('[data-overlay-part="firing-arc"]')).toBeTruthy()
    expect(screen.getByTestId('combat-overlay').querySelector('[data-overlay-part="target-line"]')).toBeNull()
  })

  it('keeps overlay mode after Resume and Pause & Browse if the tab stays mounted', () => {
    let state = liveSortie()
    const view = render(
      wrap(
        <CombatTab
          state={state}
          onLaunch={() => undefined}
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
    render(wrap(<CombatTab state={live} onLaunch={() => undefined} />))
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
    expect(screen.getByTestId('core-detail-readout')).toBeTruthy()
    expect(screen.getByText('Fire Range')).toBeTruthy()
    expect(screen.getByText('Acquisition Range')).toBeTruthy()
    expect(screen.getByText('Arc')).toBeTruthy()
    expect(screen.getByText('Slew')).toBeTruthy()
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

describe('Combat Overlay onboarding', () => {
  it('pauses, explains ranges, and requires a stationary Core selection', () => {
    const state = prepOnboardingDoor(createInitialState(1), 'combat-overlay.ranges')
    state.combat.sortiePaused = false
    const pauses: boolean[] = []
    const resumes: boolean[] = []
    render(
      wrap(
        <OverlayOnboardingHarness
          initial={state}
          onPause={() => {
            pauses.push(true)
            state.combat.sortiePaused = true
          }}
          onResume={() => resumes.push(true)}
        />,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Combat Overlay' }))
    expect(pauses).toEqual([true])
    expect(state.combat.sortiePaused).toBe(true)
    expect(screen.getByTestId('core-selector').getAttribute('data-onboarding')).toBe(
      'onboarding.combat-overlay.core-selector',
    )
    expect(screen.getByTestId('overlay-selected-core').textContent).toBe('')
    const lesson = activeOnboardingLesson(state, { tab: 'combat', combatOverlayOpen: true })
    expect(lesson?.id).toBe('combat-overlay.ranges')
    expect(lesson?.completeOnTap).toBe(false)
    expect(lesson?.body.join(' ')).toMatch(/Fire Range/)
    expect(lesson?.body.join(' ')).toMatch(/Acquisition Range/)
    expect(lesson?.body.join(' ')).toMatch(/Firing Arc/)
    expect(lesson?.body.join(' ')).toMatch(/Slew/)
    expect(document.querySelector('.core-selector-row.is-selected')).toBeNull()
    expect(screen.getByTestId('overlay-lesson-finished').textContent).toBe('false')
    const row = document.querySelector('.core-selector-row') as HTMLButtonElement
    fireEvent.click(row)
    expect(screen.getByTestId('overlay-selected-core').textContent).toBeTruthy()
    expect(screen.getByTestId('overlay-lesson-finished').textContent).toBe('true')
    expect(screen.getByTestId('combat-overlay').getAttribute('data-combat-overlay')).toBe('selected')
    expect(resumes).toEqual([])
    expect(state.combat.sortiePaused).toBe(true)
  })

  it('does not complete overlay onboarding from a heading or blank selector click', () => {
    const state = prepOnboardingDoor(createInitialState(1), 'combat-overlay.ranges')
    render(
      wrap(
        <OverlayOnboardingHarness
          initial={state}
          onPause={() => {
            state.combat.sortiePaused = true
          }}
        />,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Combat Overlay' }))
    expect(screen.getByTestId('core-selector')).toBeTruthy()
    expect(document.querySelector('.guide-root')).toBeTruthy()
    fireEvent.click(screen.getByText('Cores'))
    fireEvent.click(screen.getByTestId('core-selector'))
    expect(screen.getByTestId('overlay-selected-core').textContent).toBe('')
    expect(screen.getByTestId('overlay-lesson-finished').textContent).toBe('false')
    expect(document.querySelector('.core-selector-row.is-selected')).toBeNull()
    expect(lessonFinished(state, 'combat-overlay.ranges')).toBe(false)
  })

  it('does not start required overlay onboarding with zero target-capable Cores', () => {
    let state = prepOnboardingDoor(createInitialState(1), 'combat-overlay.ranges')
    state = unfitModule(state, 'pulse-cannon')
    expect(targetCapableLoadoutCores(state)).toHaveLength(0)
    expect(lessonFinished(state, 'combat-overlay.ranges')).toBe(false)
    const view = render(
      wrap(
        <CombatTab
          state={state}
          onLaunch={() => undefined}
          onPause={() => {
            state.combat.sortiePaused = true
          }}
        />,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Combat Overlay' }))
    expect(screen.getByTestId('combat-overlay-empty').textContent).toMatch(/No target-capable Cores fitted/)
    expect(activeOnboardingLesson(state, { tab: 'combat', combatOverlayOpen: true })).toBeNull()
    expect(lessonFinished(state, 'combat-overlay.ranges')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Combat Overlay' })).toBeNull()
    expect(lessonFinished(state, 'combat-overlay.ranges')).toBe(false)

    state = fitModule(state, 'pulse-cannon')
    expect(targetCapableLoadoutCores(state).length).toBeGreaterThan(0)
    view.rerender(
      wrap(
        <CombatTab
          state={state}
          onLaunch={() => undefined}
          onPause={() => {
            state.combat.sortiePaused = true
          }}
        />,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Combat Overlay' }))
    expect(screen.queryByTestId('combat-overlay-empty')).toBeNull()
    expect(activeOnboardingLesson(state, { tab: 'combat', combatOverlayOpen: true })?.id).toBe(
      'combat-overlay.ranges',
    )
    expect(lessonFinished(state, 'combat-overlay.ranges')).toBe(false)
    expect(document.querySelector('.core-selector-row')).toBeTruthy()
  })

  it('reports selectedCoreId through presentation overlay UI', () => {
    const live = liveSortie()
    const reports: Array<{ open: boolean; selectedCoreId: string | null }> = []
    render(
      wrap(
        <CombatTab
          state={live}
          onLaunch={() => undefined}
          onPause={() => {
            live.combat.sortiePaused = true
          }}
          onCombatOverlayUi={(info) => reports.push(info)}
        />,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Combat Overlay' }))
    expect(reports.some((row) => row.open && row.selectedCoreId)).toBe(true)
    const selected = reports.filter((row) => row.open).at(-1)
    expect(selected?.selectedCoreId).toBe(targetCapableLoadoutCores(live)[0]?.coreInstanceId)
  })
})
