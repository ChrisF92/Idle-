import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { setCampaign, setPushMode, retryFrontier, warpToSector, setDocked } from './tick'
import { setLaunchSector, setSectorRoute } from './actions'
import { MORE_STATIONS } from './moreStations'

describe('GDD removed Route A/B and Frontier Hold', () => {
  it('keeps every Sortie on Advance from Wave 1', () => {
    let s = createInitialState(0)
    s.combat.docked = true
    s = setPushMode(s, 'hold-wave')
    expect(s.combat.pushMode).toBe('advance')
    expect(s.combat.campaign).toBe(true)

    s = setCampaign(s, false)
    expect(s.combat.pushMode).toBe('advance')

    s.combat.wave = 18
    s = setLaunchSector(s, 6)
    expect(s.combat.wave).toBe(1)
    expect(s.combat.sector).toBe(1)

    s = setSectorRoute(s, 'B')
    expect(s.combat.route).toBe('A')

    s = warpToSector(s, 12)
    expect(s.combat.wave).toBe(1)
    expect(s.combat.sector).toBe(1)
  })

  it('does not enter Frontier Hold and treats Retry as a no-op', () => {
    let s = createInitialState(0)
    s.combat.frontierHold = true
    s.combat.frontierSector = 8
    expect(retryFrontier(s)).toBe(s)
    s = setDocked(s, false)
    expect(s.combat.frontierHold).toBe(false)
    expect(s.combat.wave).toBe(1)
  })

  it('does not list a standalone Reliquary or Route B station', () => {
    expect(MORE_STATIONS.some((s) => s.id === 'reliquary')).toBe(false)
    expect(MORE_STATIONS.map((s) => s.name).join(' ')).not.toMatch(/Route B|Frontier Hold/)
  })
})
