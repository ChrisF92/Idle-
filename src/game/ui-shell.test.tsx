import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CombatTab } from '../components/tabs/CombatTab'
import { DockTab } from '../components/tabs/DockTab'
import { FoundryTab } from '../components/tabs/FoundryTab'
import { WorkerDronesTab } from '../components/tabs/WorkerDronesTab'
import { ScreenHelp } from '../components/ScreenHelp'
import { StatsTab } from '../components/tabs/StatsTab'
import { TabNav } from '../components/TabNav'
import { GuideOverlay } from '../components/GuideOverlay'
import { ToastStack } from '../components/ToastStack'
import { OfflineBanner } from '../components/OfflineBanner'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'
import { ACT1_CADENCE } from './cadence'
import { activeGuideStep, GUIDE_STEPS } from './progression'

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
    state.meta.seenOnboarding = [...GUIDE_STEPS.map((s) => s.id)]
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

  it('shows real Worker Drone jobs without obsolete combat work', () => {
    render(
      <WorkerDronesTab
        state={atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.workers)}
        onAssign={() => undefined}
      />,
    )
    expect(screen.getByText('Salvage Operations')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/\bNetwork\b|\bStrike\b|\bWard\b|\bYield\b/)
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
    expect(screen.queryByRole('button', { name: /Network/ })).toBeNull()
    expect(screen.getByRole('button', { name: /More/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Dock/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sortie/ })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Sortie/ }).querySelector('.attention-pip-fresh'),
    ).toBeTruthy()
  })

  it('keeps the Cores sheet closed unless the player opens it', () => {
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
    persist.meta.lifetimeCoreRunBuys = 2
    const persistStep = activeGuideStep(persist, 'dock')
    expect(persistStep?.id === 'guide-core-mastery' || persistStep?.id === 'guide-relaunch').toBe(true)

    render(
      <CombatTab
        state={persist}
        onLaunch={() => undefined}
        onPickMilestone={() => undefined}
        guide={persistStep}
      />,
    )
    expect(screen.queryByRole('dialog', { name: 'Cores' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /CORES/i }))
    expect(screen.getByRole('dialog', { name: 'Cores' })).toBeTruthy()
  })

  it('shows Got it only on look-only onboarding tips', () => {
    const tap = GUIDE_STEPS.find((s) => s.id === 'guide-network-strike')
    const look = GUIDE_STEPS.find((s) => s.id === 'guide-core-mastery')
    expect(tap && look).toBeTruthy()
    const { rerender } = render(
      <GuideOverlay step={tap!} onComplete={() => undefined} onSkip={() => undefined} />,
    )
    expect(screen.queryByRole('button', { name: 'Got it' })).toBeNull()
    expect(screen.getByText(/Tap the highlight/i)).toBeTruthy()
    rerender(
      <GuideOverlay step={look!} onComplete={() => undefined} onSkip={() => undefined} />,
    )
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy()
  })

  it('spotlights Worker Drone jobs without Network combat labels', () => {
    render(
      <WorkerDronesTab
        state={atCareerWave(createInitialState(0), ACT1_CADENCE.workers)}
        onAssign={() => undefined}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Worker Drones' })).toBeTruthy()
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
    expect(screen.getByText('Codex')).toBeTruthy()
    expect(screen.getByText(/Later systems/)).toBeTruthy()
    expect(screen.getByText('Reinforce')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Copy export code' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    expect(screen.getByRole('button', { name: 'Copy export code' })).toBeTruthy()
  })

  it('splits Foundry into Processing, Fabrication, Mastery, and Blueprints', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 90
    state.combat.highestSector = 9
    render(
      <FoundryTab
        state={state}
        onSetSlot={() => undefined}
        onFabricateCore={() => undefined}
        onTrack={() => undefined}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Processing' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Fabrication' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Mastery' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Blueprints' })).toBeTruthy()
    expect(document.querySelector('[data-guide="foundry-smelters"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Blueprints' }))
    expect(screen.getByRole('tab', { name: 'Cores' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Build' })).toBeNull()
  })

  it('opens Foundry Blueprints when a Blueprint is focused', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 90
    state.combat.highestSector = 9
    render(
      <FoundryTab
        state={state}
        onSetSlot={() => undefined}
        onFabricateCore={() => undefined}
        onTrack={() => undefined}
        focusTarget="blueprint-flak-array"
      />,
    )
    expect(screen.getByRole('tab', { name: 'Blueprints' }).getAttribute('aria-selected')).toBe('true')
  })

  it('keeps Foundry production off the Sortie HUD', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 6
    state.combat.highestSector = 6
    state.foundry.slots[0] = { recipeId: 'slag-ingot', progress: 0.4, paid: true }
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.queryByRole('button', { name: /Foundry Processing/i })).toBeNull()
  })
})
