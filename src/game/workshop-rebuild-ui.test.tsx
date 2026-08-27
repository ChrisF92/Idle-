import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OverlayProvider } from '../ui/overlay'
import { DockTab } from '../components/tabs/DockTab'
import { CombatTab } from '../components/tabs/CombatTab'
import { RebuildHangar } from '../components/RebuildHangar'
import { createInitialState } from './state'
import { armRebuildDoor, markHullLost } from './testHelpers'
import { setDocked } from './tick'
import { activeOnboardingLesson } from './onboarding'
import { buyRunUpgrade, buyWorkshopUpgrade } from './actions'
import { matterGainBreakdown } from './rebuild'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

describe('Workshop and Rebuild onboarding UI', () => {
  it('first W1 shop shows only three basics', () => {
    const s = setDocked(createInitialState(0), false)
    render(
      <OverlayProvider>
        <CombatTab
          state={s}
          onLaunch={() => undefined}
        />
      </OverlayProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /shop|upgrades/i }))
    expect(screen.getByText('Weapon Power')).toBeTruthy()
    expect(screen.getByText('Hull')).toBeTruthy()
    expect(screen.getByText('Salvage / Kill')).toBeTruthy()
    expect(screen.queryByText('Cycle Rate')).toBeNull()
    expect(screen.queryByText('Shield Capacity')).toBeNull()
  })

  it('first Salvage lesson highlights Weapon Power and does not auto-buy', () => {
    let s = setDocked(createInitialState(0), false)
    s.resources.salvage = 12
    const lesson = activeOnboardingLesson(s, { tab: 'combat' })
    expect(lesson?.id).toBe('opening.salvage')
    expect(lesson?.target).toBe('onboarding.salvage.weapon-power')
    s = buyRunUpgrade(s, 'weapon-power')
    expect(s.combat.runUpgrades['weapon-power']).toBe(1)
    expect(activeOnboardingLesson(s, { tab: 'combat' })?.id).not.toBe('opening.salvage')
  })

  it('first-death Workshop distinguishes cycle levels from permanent unlocks', () => {
    let s = markHullLost(createInitialState(0))
    s.combat.docked = true
    s.resources.scrap = 40
    const lesson = activeOnboardingLesson(s, { tab: 'dock' })
    expect(lesson?.id).toBe('first-defeat.workshop')
    expect(lesson?.body.join(' ')).toMatch(/survive Rebuild/)
    expect(lesson?.body.join(' ')).toMatch(/zero levels/)
    render(
      <OverlayProvider>
        <DockTab
          state={s}
          pane="workshop"
          onLaunch={() => undefined}
          onOpenSortie={() => undefined}
          onRebuild={() => undefined}
          onBuyWorkshop={() => undefined}
        />
      </OverlayProvider>,
    )
    expect(screen.getByText('NEXT UPGRADE')).toBeTruthy()
    expect(screen.getByText('PERMANENT UNLOCK')).toBeTruthy()
    s = buyWorkshopUpgrade(s, 'weapon-power')
    const payoff = activeOnboardingLesson(s, { tab: 'dock' })
    expect(payoff?.phase).toBe('payoff')
  })

  it('Rebuild sheet shows projected Matter and reset/keep lists', () => {
    const s = armRebuildDoor(createInitialState(0))
    const breakdown = matterGainBreakdown(s)
    render(
      <OverlayProvider>
        <div style={{ width: 360 }}>
          <RebuildHangar
            state={s}
            onConfirm={() => undefined}
            onClose={() => undefined}
          />
        </div>
      </OverlayProvider>,
    )
    expect(screen.getByText(/PROJECTED MATTER/i)).toBeTruthy()
    expect(screen.getByText(`+${breakdown.waveScore}`)).toBeTruthy()
    expect(screen.getByText(/WHAT RESETS/i)).toBeTruthy()
    expect(screen.getByText(/WHAT STAYS/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Rebuild/ }).hasAttribute('disabled')).toBe(false)
  })
})
