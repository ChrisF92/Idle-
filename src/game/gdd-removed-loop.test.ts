import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { setCampaign, setPushMode, retryFrontier, warpToSector, setDocked } from './tick'
import { enterEcho, setLaunchSector, setSectorRoute } from './actions'
import { MORE_STATIONS, REMOVED_ACT1_TABS, isRemovedAct1Tab } from './moreStations'
import { isSystemUnlocked } from './progression'
import { canEnterEcho, echoDamageMult } from './echo'

describe('GDD removed Route A/B, Frontier Hold, and Echo', () => {
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

  it('does not list a standalone Reliquary, Yard, Echo, Workers, or future Systems door on More', () => {
    expect(MORE_STATIONS.some((s) => s.id === 'reliquary')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'yard')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'echo')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'network')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'furnace')).toBe(false)
    expect(MORE_STATIONS.map((s) => s.name).join(' ')).not.toMatch(/Route B|Frontier Hold|Yard|Echo|Workers|Furnace/)
  })

  it('does not route Reliquary, Slag, Echo, Specialists, Tasks, or Capital', () => {
    expect(REMOVED_ACT1_TABS).toEqual(['reliquary', 'slag', 'echo', 'specialists', 'tasks', 'capital'])
    for (const id of REMOVED_ACT1_TABS) {
      expect(isRemovedAct1Tab(id)).toBe(true)
      expect(MORE_STATIONS.some((s) => s.id === id)).toBe(false)
    }
  })

  it('never unlocks Echo and ignores leftover trees', () => {
    const s = createInitialState(0)
    s.echo.tree = ['echo-strike']
    s.echo.clears = { rift: 2 }
    s.echo.activeId = 'rift'
    s.echo.points = 8
    expect(isSystemUnlocked(s, 'echo')).toBe(false)
    expect(enterEcho(s, 'rift')).toBe(s)
    expect(echoDamageMult(s)).toBe(1)
    expect(canEnterEcho(s, 'rift').ok).toBe(false)
  })
})
