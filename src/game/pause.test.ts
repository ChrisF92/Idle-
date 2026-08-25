import { describe, expect, it } from 'vitest'
import { collectPauseReasons, isSimPaused } from './pause'

describe('simulation pause reasons', () => {
  it('pauses for required onboarding and directive choice, not for toasts', () => {
    expect(isSimPaused(collectPauseReasons({}))).toBe(false)
    expect(isSimPaused(collectPauseReasons({ onboardingPause: true }))).toBe(true)
    expect(isSimPaused(collectPauseReasons({ directiveOffer: true }))).toBe(true)
    expect(collectPauseReasons({ updateBlocking: true, onboardingPause: true })[0]).toBe('update.critical')
    expect(collectPauseReasons({ onboardingPause: true, directiveOffer: true })).toEqual(['onboarding.action'])
  })
})
