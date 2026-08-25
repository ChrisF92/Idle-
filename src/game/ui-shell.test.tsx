import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CombatTab } from '../components/tabs/CombatTab'
import { DockTab } from '../components/tabs/DockTab'
import { FoundryTab } from '../components/tabs/FoundryTab'
import { NetworkTab } from '../components/tabs/NetworkTab'
import { ScreenHelp } from '../components/ScreenHelp'
import { StatsTab } from '../components/tabs/StatsTab'
import { TabNav } from '../components/TabNav'
import { GuideOverlay } from '../components/GuideOverlay'
import { ToastStack } from '../components/ToastStack'
import { OfflineBanner } from '../components/OfflineBanner'
import { createInitialState } from './state'
import { markHullLost } from './testHelpers'
import { ONBOARDING_LESSONS } from './onboarding'
import { OverlayProvider } from '../ui/overlay'
import type { PresentationItem } from './presentation'

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
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Network' })).toBeNull()
    expect(screen.getByRole('button', { name: /CORES/i })).toBeTruthy()
    expect(screen.getByText('Salvage')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Launch Sortie' })).toBeTruthy()
    expect(document.querySelector('[data-guide="sortie-canvas"]')).toBeTruthy()
    expect(document.querySelector('[data-guide="sortie-hull"]')).toBeTruthy()
  })

  it('keeps Network and Core upgrades off the Sortie sheet', () => {
    const state = markHullLost(createInitialState(0))
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Network' })).toBeNull()
    expect(screen.queryByRole('button', { name: /CORES/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Launch Sortie' })).toBeTruthy()
  })

  it('does not auto-open Cores when opening Sortie during a live run', () => {
    const state = markHullLost(createInitialState(0))
    state.combat.docked = false
    state.shipyard.moduleLevels['pulse-cannon'] = 1
    state.shipyard.moduleLevels['plate-layer'] = 1
    state.meta.seenOnboarding = [...ONBOARDING_LESSONS.map((s) => s.id)]
    let handled = 0
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onPickMilestone={() => undefined}
        coresRequest={{ key: 1, moduleId: 'pulse-cannon' }}
        onCoresRequestHandled={() => {
          handled += 1
        }}
      />,
    )
    expect(screen.queryByRole('dialog', { name: 'Cores' })).toBeNull()
    expect(handled).toBe(1)
  })

  it('opens Cores once from an Upgrade Cores request while docked', () => {
    const state = markHullLost(createInitialState(0))
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onPickMilestone={() => undefined}
        coresRequest={{ key: 1, moduleId: 'pulse-cannon' }}
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Cores' })).toBeTruthy()
  })

  it('keeps Dock defeat stats in three columns and the last-run note on screen', () => {
    const state = markHullLost(createInitialState(0))
    state.combat.lastSortie = {
      ...state.combat.lastSortie,
      outcome: 'defeat',
      sector: 2,
      wave: 2,
      note: 'Hull lost at Wave 2. Knocked back',
      salvageGained: 4,
      salvageSpent: 6,
      scrapEarned: 12,
      newBest: true,
      networkLevels: 7,
    }
    render(
      <DockTab
        state={state}
        onLaunch={() => undefined}
        onOpenSortie={() => undefined}
        onRebuild={() => undefined}
      />,
    )
    const summary = document.querySelector('.dock-summary')
    expect(summary).toBeTruthy()
    expect(summary?.querySelectorAll('.dock-stats')).toHaveLength(1)
    expect(summary?.querySelectorAll('.dock-stats > div')).toHaveLength(3)
    expect(screen.getByText(/Hull lost at Wave 2/)).toBeTruthy()
    expect(document.querySelector('.dock-screen .panel-scroll')).toBeTruthy()
  })

  it('layers inspect cards on document.body above other sheets', () => {
    const state = markHullLost(createInitialState(0))
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /CORES/i }))
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
    expect(screen.queryByRole('button', { name: /Sortie/ })).toBeNull()

    rerender(
      <TabNav active="dock" onChange={() => undefined} state={markHullLost(fresh)} />,
    )
    expect(screen.queryByRole('button', { name: /Network/ })).toBeNull()
    expect(screen.getByRole('button', { name: /More/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Dock/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Sortie/ })).toBeNull()
  })

  it('keeps the Cores sheet closed unless the player opens it', () => {
    const persist = markHullLost(createInitialState(0))
    persist.combat.docked = false
    persist.combat.inFight = true
    render(
      <CombatTab
        state={persist}
        onLaunch={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.queryByRole('dialog', { name: 'Cores' })).toBeNull()
  })

  it('shows Continue on payoff and tap copy on required actions', () => {
    const tap = ONBOARDING_LESSONS.find((s) => s.id === 'workers.assignment')
    const look = ONBOARDING_LESSONS.find((s) => s.id === 'challenges.start')
    expect(tap && look).toBeTruthy()
    const tapItem: PresentationItem = {
      id: 'onboarding:workers.assignment',
      class: 'blocking',
      priority: 80,
      title: tap!.title,
      body: ['Assign a Worker'],
      actionLabel: tap!.actionLabel,
      required: tap!.required,
      dismissible: true,
      skippable: true,
      lessonId: tap!.id,
      dedupeKey: tap!.id,
      timestamp: 0,
      order: 0,
      pause: false,
      kind: 'onboarding',
      phase: 'action',
    }
    const lookItem: PresentationItem = {
      ...tapItem,
      id: 'onboarding:challenges.start',
      title: look!.title,
      body: ['Hint'],
      actionLabel: undefined,
      required: false,
      lessonId: look!.id,
      dedupeKey: look!.id,
    }
    const { rerender } = render(
      <OverlayProvider>
        <GuideOverlay item={tapItem} onComplete={() => undefined} onSkip={() => undefined} />
      </OverlayProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
    expect(screen.getByText(/Tap the highlight/i)).toBeTruthy()
    rerender(
      <OverlayProvider>
        <GuideOverlay item={lookItem} onComplete={() => undefined} onSkip={() => undefined} />
      </OverlayProvider>,
    )
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy()
  })

  it('spotlights Worker Drone jobs without Network combat labels', () => {
    render(
      <NetworkTab
        state={createInitialState(0)}
        onAssign={() => undefined}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Worker Drones' })).toBeTruthy()
    expect(document.querySelector('[data-guide="network-manufacture"]')).toBeTruthy()
    expect(document.querySelector('[data-guide="worker-scrap-field"]')).toBeTruthy()
    expect(screen.queryByText(/Strike/)).toBeNull()
    expect(screen.queryByText(/Ward/)).toBeNull()
    expect(screen.queryByText(/Yield/)).toBeNull()
  })

  it('opens per-screen help from the info button', () => {
    render(<ScreenHelp screen="combat" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sortie info' }))
    expect(screen.getByRole('dialog', { name: 'Sortie' })).toBeTruthy()
    expect(screen.getByText(/Worker Drones unlock at Wave 30 under Systems/i)).toBeTruthy()
  })

  it('renders offline rewards as a dismissable modal', () => {
    let dismissed = false
    render(
      <OfflineBanner
        report={{
          elapsedMs: 5 * 60 * 1000,
          appliedMs: 5 * 60 * 1000,
          capped: false,
          sectorsBefore: 7,
          sectorsAfter: 7,
          sectorsCleared: 0,
          wave: 7,
          modeLabel: 'Paused',
          sortieFrozen: false,
          gains: { scrap: 672.88, heat: 6.76 },
          summary: 'Away 5m',
        }}
        onDismiss={() => {
          dismissed = true
        }}
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Welcome back' })).toBeTruthy()
    expect(screen.getByText(/\+672\.88 Scrap/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(dismissed).toBe(true)
  })

  it('renders actionable toasts without covering as a modal', () => {
    render(
      <OverlayProvider>
        <ToastStack
          item={{
            id: 'sys:research',
            class: 'action',
            priority: 40,
            title: 'Research unlocked',
            body: ['Permanent Hive Research is now available.'],
            kicker: 'SYSTEM ONLINE',
            action: { label: 'OPEN RESEARCH', nav: { kind: 'tab', tab: 'research' } },
            dismissible: true,
            skippable: true,
            dedupeKey: 'sys:research',
            timestamp: 0,
            order: 0,
            pause: false,
            kind: 'toast',
          }}
          onDismiss={() => undefined}
          onAction={() => undefined}
        />
      </OverlayProvider>,
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
    expect(screen.getByText('Codex')).toBeTruthy()
    expect(screen.getByText(/Later systems/)).toBeTruthy()
    expect(screen.getByText('Reinforce')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Copy export code' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    expect(screen.getByRole('button', { name: 'Copy export code' })).toBeTruthy()
  })

  it('splits Foundry into Processing, Fabrication, Mastery, and Blueprints', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 6
    render(
      <FoundryTab
        state={state}
        onSetSlot={() => undefined}
        onFabricateCore={() => undefined}
        onTrack={() => undefined}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Processing' })).toBeTruthy()
    expect(document.querySelector('[data-guide="foundry-smelters"]')).toBeTruthy()
    expect(screen.queryByText('Core prints')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Blueprints' }))
    expect(screen.getByText(/Blueprints/i)).toBeTruthy()
  })

  it('opens Foundry blueprints when a print is focused', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 6
    render(
      <FoundryTab
        state={state}
        onSetSlot={() => undefined}
        onFabricateCore={() => undefined}
        onTrack={() => undefined}
        focusTarget="print-pulse-cannon"
      />,
    )
    expect(screen.getByRole('tab', { name: 'Blueprints' }).getAttribute('aria-selected')).toBe('true')
  })

  it('does not put Foundry craft controls on Sortie', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 6
    state.foundry.slots[0] = { recipeId: 'slag-ingot', progress: 0.4, paid: true }
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.queryByRole('button', { name: /Foundry smelting/i })).toBeNull()
  })

  it('hides the Sortie craft strip when no smelter is running', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 6
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.queryByRole('button', { name: /Foundry smelting/i })).toBeNull()
  })
})
