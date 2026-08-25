import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { CombatTab } from '../components/tabs/CombatTab'
import { DockTab } from '../components/tabs/DockTab'
import { FoundryTab } from '../components/tabs/FoundryTab'
import { FurnaceTab } from '../components/tabs/FurnaceTab'
import { NetworkTab } from '../components/tabs/NetworkTab'
import { ProcessTab } from '../components/tabs/ProcessTab'
import { ProtocolsTab } from '../components/tabs/ProtocolsTab'
import { ReinforceTab } from '../components/tabs/ReinforceTab'
import { ResearchTab } from '../components/tabs/ResearchTab'
import { TabNav } from '../components/TabNav'
import { OverlayProvider } from '../ui/overlay'
import { GuideOverlay } from '../components/GuideOverlay'
import { ToastStack } from '../components/ToastStack'
import { createInitialState } from './state'
import { createFreshCareerState } from './freshStart'
import {
  ONBOARDING_LESSONS,
  activeOnboardingLesson,
  prepOnboardingDoor,
  targetSelector,
  type OnboardingLessonId,
} from './onboarding'
import { enqueueToasts, selectPresentation } from './presentation'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

function renderDoor(id: OnboardingLessonId) {
  const state = prepOnboardingDoor(createInitialState(0), id)
  const lesson = ONBOARDING_LESSONS.find((row) => row.id === id)!
  const noop = () => undefined
  const tree = (() => {
    switch (id) {
      case 'opening.salvage':
      case 'directives.choice':
        return (
          <CombatTab
            state={state}
            onLaunch={noop}
            onPickMilestone={noop}
            onboardingTarget={lesson.target}
          />
        )
      case 'first-defeat.workshop':
        return (
          <DockTab
            state={state}
            pane="workshop"
            onLaunch={noop}
            onOpenSortie={noop}
            onRebuild={noop}
            onBuyWorkshop={noop}
          />
        )
      case 'rebuild.preview':
        return (
          <DockTab
            state={state}
            pane="rebuild"
            onLaunch={noop}
            onOpenSortie={noop}
            onRebuild={noop}
          />
        )
      case 'relic.install':
        return (
          <DockTab
            state={state}
            pane="loadout"
            onLaunch={noop}
            onOpenSortie={noop}
            onRebuild={noop}
          />
        )
      case 'foundry.processing':
        return (
          <FoundryTab
            state={state}
            requestedPane="processing"
            onSetSlot={noop}
            onFabricateCore={noop}
          />
        )
      case 'workers.assignment':
        return <NetworkTab state={state} onAssign={noop} />
      case 'furnace.channel':
        return <FurnaceTab state={state} onBack={noop} onConvert={noop} onSetChannel={noop} />
      case 'research.project':
        return <ResearchTab state={state} onBack={noop} onStart={noop} guideTarget={lesson.target} />
      case 'process.capability':
        return (
          <ProcessTab
            state={state}
            onBack={noop}
            onBuy={noop}
            guideTarget={lesson.target}
          />
        )
      case 'challenges.start':
        return <ProtocolsTab state={state} onBack={noop} onEnter={noop} onAbandon={noop} />
      case 'reinforce':
        return <ReinforceTab state={state} onBack={noop} onReinforce={noop} />
      default:
        return null
    }
  })()
  return { state, lesson, ...render(<OverlayProvider>{tree}</OverlayProvider>) }
}

describe('onboarding door targets', () => {
  it.each([
    'opening.salvage',
    'first-defeat.workshop',
    'foundry.processing',
    'workers.assignment',
    'directives.choice',
    'rebuild.preview',
    'relic.install',
    'furnace.channel',
    'research.project',
    'process.capability',
    'challenges.start',
    'reinforce',
  ] as OnboardingLessonId[])('mounts %s on the correct screen', (id) => {
    const { state, lesson } = renderDoor(id)
    const step = activeOnboardingLesson(state, { tab: lesson.nav.tab })
    expect(step?.id).toBe(id)
    const el = document.querySelector(targetSelector(lesson.target))
    expect(el, lesson.target).toBeTruthy()
  })

  it('does not render a toast beside onboarding', () => {
    const state = prepOnboardingDoor(createInitialState(0), 'opening.salvage')
    const item = selectPresentation(state, { tab: 'combat' }, enqueueToasts([], [{
      id: 'sys:foundry',
      category: 'SYSTEM ONLINE',
      title: 'Foundry online',
      body: 'Wait',
      tier: 'action',
    }], 1), {})
    expect(item?.kind).toBe('onboarding')
    render(
      <OverlayProvider>
        <GuideOverlay item={item!} onComplete={() => undefined} onSkip={() => undefined} />
        <ToastStack item={null} onDismiss={() => undefined} onAction={() => undefined} />
      </OverlayProvider>,
    )
    expect(document.querySelector('.toast-card')).toBeNull()
    expect(document.querySelector('.guide-root')).toBeTruthy()
  })

  it('hides bottom nav while a Sortie is live and shows it when Docked', () => {
    const live = createFreshCareerState(0)
    expect(live.combat.docked).toBe(false)
    const docked = createInitialState(0)
    const { rerender } = render(<TabNav active="dock" onChange={() => undefined} state={docked} />)
    expect(document.querySelector('.bottom-nav')).toBeTruthy()
    rerender(<div className="app is-sortie" />)
    expect(document.querySelector('.bottom-nav')).toBeNull()
  })
})
