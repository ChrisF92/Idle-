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
    expect(screen.getByRole('button', { name: 'Launch Sortie' })).toBeTruthy()
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
    expect(screen.getByRole('button', { name: 'Launch Sortie' })).toBeTruthy()
    expect(document.querySelector('[data-guide="cores-sheet"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Cores/ }))
    expect(screen.getByText(/Salvage ranks these/i)).toBeTruthy()
    expect(document.querySelector('[data-guide="core-pulse-cannon"]')).toBeTruthy()
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
        onSetPushMode={() => undefined}
        onUpgrade={() => undefined}
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
        onSetPushMode={() => undefined}
        onUpgrade={() => undefined}
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
      note: 'Hull lost in sector 2 wave 2. Knocked back',
      salvageGained: 4,
      salvageSpent: 6,
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
    expect(summary?.querySelectorAll('.dock-stats')).toHaveLength(2)
    expect(summary?.querySelectorAll('.dock-stats > div')).toHaveLength(6)
    expect(screen.getByText(/Hull lost in sector 2 wave 2/)).toBeTruthy()
    expect(document.querySelector('.dock-screen .panel-scroll')).toBeTruthy()
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
    const relaunch = activeGuideStep(next, 'combat')
    expect(relaunch?.id).toBe('guide-relaunch')
    rerender(
      <CombatTab
        state={next}
        onLaunch={() => undefined}
        onSetPushMode={() => undefined}
        onUpgrade={() => undefined}
        onPickMilestone={() => undefined}
        guide={relaunch}
      />,
    )
    expect(screen.queryByRole('dialog', { name: 'Cores' })).toBeNull()
  })

  it('shows Got it only on look-only onboarding tips', () => {
    const tap = GUIDE_STEPS.find((s) => s.id === 'guide-network-strike')
    const look = GUIDE_STEPS.find((s) => s.id === 'guide-cores-persist')
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
    expect(screen.queryByText('Corps racks')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Links' }))
    expect(screen.getByText('Corps racks')).toBeTruthy()
  })

  it('opens per-screen help from the info button', () => {
    render(<ScreenHelp screen="combat" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sortie info' }))
    expect(screen.getByRole('dialog', { name: 'Sortie' })).toBeTruthy()
    expect(screen.getByText(/Drones are assigned on the Network tab/i)).toBeTruthy()
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
          modeLabel: 'Paused',
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
    expect(screen.getByText('Reliquary')).toBeTruthy()
    expect(screen.getByText(/Later systems/)).toBeTruthy()
    expect(screen.getByText('Capital')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Copy export code' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    expect(screen.getByRole('button', { name: 'Copy export code' })).toBeTruthy()
  })

  it('splits Foundry into Smelt, Ranks, Prints, and Fit', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 2
    state.combat.highestSector = 2
    render(
      <FoundryTab
        state={state}
        onSetSlot={() => undefined}
        onBuyUpgrade={() => undefined}
        onEquip={() => undefined}
        onUnequip={() => undefined}
        onAssemble={() => undefined}
        onTrack={() => undefined}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Smelt' })).toBeTruthy()
    expect(document.querySelector('[data-guide="foundry-smelters"]')).toBeTruthy()
    expect(document.querySelector('[data-guide="foundry-recipes"]')).toBeTruthy()
    expect(screen.queryByText('Core prints')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Prints' }))
    expect(screen.getByText('Core prints')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Track' }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Fit' }))
    expect(screen.getByText(/fitted bits/i)).toBeTruthy()
  })

  it('opens Foundry prints when a print is focused', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 2
    state.combat.highestSector = 2
    render(
      <FoundryTab
        state={state}
        onSetSlot={() => undefined}
        onBuyUpgrade={() => undefined}
        onEquip={() => undefined}
        onUnequip={() => undefined}
        onAssemble={() => undefined}
        onTrack={() => undefined}
        focusTarget="print-pulse-cannon"
      />,
    )
    expect(screen.getByText('Core prints')).toBeTruthy()
  })

  it('shows running Foundry crafts on Sortie and opens Foundry from the strip', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 2
    state.combat.highestSector = 2
    state.foundry.slots[0] = { recipeId: 'slag-ingot', progress: 0.4, paid: true }
    let opened = false
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onSetPushMode={() => undefined}
        onUpgrade={() => undefined}
        onPickMilestone={() => undefined}
        onOpenFoundry={() => {
          opened = true
        }}
      />,
    )
    const strip = screen.getByRole('button', { name: /Foundry smelting Slag Ingot/i })
    expect(strip).toBeTruthy()
    fireEvent.click(strip)
    expect(opened).toBe(true)
  })

  it('hides the Sortie craft strip when no smelter is running', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 2
    state.combat.highestSector = 2
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onSetPushMode={() => undefined}
        onUpgrade={() => undefined}
        onPickMilestone={() => undefined}
        onOpenFoundry={() => undefined}
      />,
    )
    expect(screen.queryByRole('button', { name: /Foundry smelting/i })).toBeNull()
  })
})
