import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CombatTab } from '../components/tabs/CombatTab'
import { NetworkTab } from '../components/tabs/NetworkTab'
import { ScreenHelp } from '../components/ScreenHelp'
import { StatsTab } from '../components/tabs/StatsTab'
import { TabNav } from '../components/TabNav'
import { GuideOverlay } from '../components/GuideOverlay'
import { ToastStack } from '../components/ToastStack'
import { createInitialState } from './state'
import { markHullLost } from './testHelpers'
import { acknowledgeOnboarding, activeGuideStep, GUIDE_STEPS } from './progression'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

describe('shell UX', () => {
  it('hides Cores and Salvage on Sortie until first hull loss', () => {
    const state = createInitialState(0)
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onSetPushMode={() => undefined}
        onUpgrade={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Network' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Cores/ })).toBeNull()
    expect(screen.queryByText('Salvage')).toBeNull()
    expect(screen.getByRole('button', { name: 'Launch' })).toBeTruthy()
    expect(document.querySelector('[data-guide="sortie-canvas"]')).toBeTruthy()
    expect(document.querySelector('[data-guide="sortie-hull"]')).toBeTruthy()
  })

  it('keeps Network off the Sortie sheet and opens Cores after hull loss', () => {
    const state = markHullLost(createInitialState(0))
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onSetPushMode={() => undefined}
        onUpgrade={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Network' })).toBeNull()
    expect(screen.getByRole('button', { name: /Cores/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Launch' })).toBeTruthy()
    expect(document.querySelector('[data-guide="cores-sheet"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Cores/ }))
    expect(screen.getByText(/Salvage ranks these/i)).toBeTruthy()
    expect(screen.getByText(/Drones live on Network/i)).toBeTruthy()
    expect(document.querySelector('[data-guide="core-pulse-cannon"]')).toBeTruthy()
  })

  it('layers inspect cards on document.body above other sheets', () => {
    const state = markHullLost(createInitialState(0))
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onSetPushMode={() => undefined}
        onUpgrade={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Cores/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Pulse Cannon' }))
    const dialog = screen.getByRole('dialog', { name: 'Pulse Cannon' })
    expect(dialog).toBeTruthy()
    expect(dialog.parentElement?.classList.contains('inspect-backdrop')).toBe(true)
    expect(dialog.parentElement?.parentElement).toBe(document.body)
  })

  it('does not inspect locked Network bars', () => {
    render(
      <NetworkTab
        state={markHullLost(createInitialState(0))}
        onAssign={() => undefined}
        onBuyLink={() => undefined}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Inspect Archive' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Inspect Strike' })).toBeTruthy()
  })

  it('hides Network and More until first hull loss', () => {
    const fresh = createInitialState(0)
    const { rerender } = render(<TabNav active="dock" onChange={() => undefined} state={fresh} />)
    expect(screen.queryByRole('button', { name: /Network/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /More/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Dock/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sortie/ })).toBeTruthy()

    const live = createInitialState(0)
    live.combat.docked = false
    rerender(<TabNav active="combat" onChange={() => undefined} state={live} />)
    expect(screen.queryByRole('button', { name: /Dock/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Sortie/ })).toBeTruthy()

    rerender(
      <TabNav active="combat" onChange={() => undefined} state={markHullLost(fresh)} />,
    )
    expect(screen.getByRole('button', { name: /Network/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /More/ })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Network/ }).querySelector('.attention-pip-spend'),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Sortie/ }).querySelector('.attention-pip-fresh'),
    ).toBeTruthy()
  })

  it('closes the Cores modal when Network onboarding needs the tab bar', () => {
    const persist = markHullLost(createInitialState(0))
    persist.combat.docked = true
    persist.resources.salvage = 8
    persist.shipyard.moduleLevels['pulse-cannon'] = 1
    persist.shipyard.moduleLevels['plate-layer'] = 1
    persist.meta.seenOnboarding = [
      'guide-shipyard-tab',
      'guide-frame-select',
      'guide-launch',
      'guide-sortie-field',
      'guide-sortie-guns',
      'guide-sortie-hull',
      'guide-salvage-lesson',
      'guide-cores-sheet',
      'guide-upgrade-pulse',
      'guide-upgrade-plate',
      'guide-cores-inspect',
    ]
    const persistStep = activeGuideStep(persist, 'combat')
    expect(persistStep?.id).toBe('guide-cores-persist')

    const { rerender } = render(
      <CombatTab
        state={persist}
        onLaunch={() => undefined}
        onSetPushMode={() => undefined}
        onUpgrade={() => undefined}
        onPickMilestone={() => undefined}
        guide={persistStep}
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Cores' })).toBeTruthy()

    const next = acknowledgeOnboarding(persist, 'guide-cores-persist')
    const networkStep = activeGuideStep(next, 'combat')
    expect(networkStep?.id).toBe('guide-drone-cap')
    rerender(
      <CombatTab
        state={next}
        onLaunch={() => undefined}
        onSetPushMode={() => undefined}
        onUpgrade={() => undefined}
        onPickMilestone={() => undefined}
        guide={networkStep}
      />,
    )
    expect(screen.queryByRole('dialog', { name: 'Cores' })).toBeNull()
  })

  it('shows Continue only on look-only onboarding tips', () => {
    const tap = GUIDE_STEPS.find((s) => s.id === 'guide-drone-cap')
    const look = GUIDE_STEPS.find((s) => s.id === 'guide-sortie-field')
    expect(tap && look).toBeTruthy()
    const { rerender } = render(
      <GuideOverlay step={tap!} onComplete={() => undefined} onSkip={() => undefined} />,
    )
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
    expect(screen.getByText(/Tap the highlighted control/i)).toBeTruthy()
    rerender(
      <GuideOverlay step={look!} onComplete={() => undefined} onSkip={() => undefined} />,
    )
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy()
  })

  it('spotlights Network manufacture, corps, and Links', () => {
    render(
      <NetworkTab
        state={createInitialState(0)}
        onAssign={() => undefined}
        onBuyLink={() => undefined}
      />,
    )
    expect(document.querySelector('[data-guide="network-manufacture"]')).toBeTruthy()
    expect(document.querySelector('[data-guide="network-corps"]')).toBeTruthy()
    expect(document.querySelector('[data-guide="network-strike"]')).toBeTruthy()
    expect(document.querySelector('[data-guide="network-links"]')).toBeTruthy()
  })

  it('opens per-screen help from the info button', () => {
    render(<ScreenHelp screen="combat" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sortie info' }))
    expect(screen.getByRole('dialog', { name: 'Sortie' })).toBeTruthy()
    expect(screen.getByText(/Drones belong on the Network tab/i)).toBeTruthy()
  })

  it('renders actionable toasts without covering as a modal', () => {
    render(
      <ToastStack
        toasts={[
          {
            id: 'sys:research',
            key: 1,
            createdAt: 0,
            category: 'SYSTEM ONLINE',
            title: 'Research unlocked',
            body: 'Permanent Hive Research is now available.',
            action: { label: 'OPEN RESEARCH', nav: { kind: 'tab', tab: 'research' } },
          },
        ]}
        onDismiss={() => undefined}
        onAction={() => undefined}
      />,
    )
    expect(screen.getByText('Research unlocked')).toBeTruthy()
    expect(screen.getByRole('button', { name: /OPEN RESEARCH/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy()
  })

  it('lists Coming up stations and folds later systems on More', () => {
    const state = createInitialState(0)
    render(
      <StatsTab
        state={state}
        onHardReset={() => undefined}
        onImport={() => false}
        onDevAction={() => undefined}
        onOpenStation={() => undefined}
      />,
    )
    expect(screen.getByText('Coming up')).toBeTruthy()
    expect(screen.getByText('Reliquary')).toBeTruthy()
    expect(screen.getByText(/Later systems/)).toBeTruthy()
    expect(screen.getByText('Capital')).toBeTruthy()
  })
})
