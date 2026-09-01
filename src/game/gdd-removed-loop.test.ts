import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { setDocked } from './tick'
import { enterEcho } from './actions'
import { MORE_STATIONS, REMOVED_ACT1_TABS, isMoreNavTab, isRemovedAct1Tab } from './moreStations'
import { LIVE_SCREENS } from './screenHelp'
import { isSystemUnlocked } from './progression'
import { canEnterEcho, echoDamageMult } from './echo'

describe('GDD removed Route A/B, Frontier Hold, and Echo', () => {
  it('keeps every Sortie launching at Wave 1 without Route or Sector', () => {
    const s = createInitialState(0)
    s.combat.docked = true
    expect('pushMode' in s.combat).toBe(false)
    expect('route' in s.combat).toBe(false)
    expect('sector' in s.combat).toBe(false)
    s.combat.wave = 18
    expect(s.combat.wave).toBe(18)
  })

  it('Launch still starts Wave 1', () => {
    let s = createInitialState(0)
    s = setDocked(s, false)
    expect(s.combat.waveReached).toBe(1)
    expect(s.combat.docked).toBe(false)
  })

  it('does not list a standalone Reliquary, Yard, Echo, Workers, or future Systems door on More', () => {
    expect(MORE_STATIONS.some((s) => s.id === 'reliquary')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'yard')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'echo')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'network')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'furnace')).toBe(false)
    expect(MORE_STATIONS.map((s) => s.name).join(' ')).not.toMatch(/Route B|Frontier Hold|Yard|Echo|Workers|Furnace/)
  })

  it('does not route leftover Act 1 tabs and does not treat them as More nav', () => {
    expect(REMOVED_ACT1_TABS).toEqual(['reliquary', 'slag', 'echo', 'specialists', 'tasks', 'capital'])
    for (const id of REMOVED_ACT1_TABS) {
      expect(isRemovedAct1Tab(id)).toBe(true)
      expect(isMoreNavTab(id)).toBe(false)
      expect(LIVE_SCREENS).not.toContain(id)
      expect(MORE_STATIONS.some((s) => s.id === id)).toBe(false)
    }
    expect(isMoreNavTab('stats')).toBe(true)
    expect(isMoreNavTab('challenges')).toBe(true)
    expect(isMoreNavTab('reinforce')).toBe(true)
    expect(isMoreNavTab('logs')).toBe(true)
    expect(isMoreNavTab('codex')).toBe(true)
  })

  it('does not import leftover Act 1 tab modules from App', () => {
    const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../App.tsx'), 'utf8')
    for (const name of ['ReliquaryTab', 'SlagTab', 'EchoTab', 'SpecialistsTab', 'TasksTab', 'CapitalTab']) {
      expect(app, name).not.toContain(name)
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
