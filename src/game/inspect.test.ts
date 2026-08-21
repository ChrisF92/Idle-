import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  inspectCopyCorpus,
  inspectCore,
  inspectFurnaceTrack,
  inspectNetworkBar,
  inspectNetworkLink,
  inspectNetworkOverview,
} from './inspect'
import { NETWORK_BARS, NETWORK_LINKS } from './network'

const JARGON = /USI|ITRTG|analogue|black-bar|PoC|TODO/i

describe('inspect sheets', () => {
  it('Network, Cores, and Furnace sheets carry live numbers and player copy', () => {
    const s = createInitialState(0)
    s.base.assignments.strike = 2
    s.network.bars.strike.levels = 4
    s.network.bars.strike.progress = 0.4
    s.shipyard.moduleLevels['pulse-cannon'] = 3
    s.resources.salvage = 12
    s.resources.choirAsh = 25
    s.resources.heat = 8
    s.meta.highestSectorEver = 5
    s.combat.highestSector = 5
    s.furnace.wanted.weapons = 1
    s.furnace.active.weapons = 1

    const overview = inspectNetworkOverview(s)
    expect(overview.stats.some((row) => row.label === 'Link power')).toBe(true)
    expect(overview.body.join(' ')).toMatch(/Rebuild/)

    const strike = inspectNetworkBar(s, 'strike')
    expect(strike?.stats.find((row) => row.label === 'Status')?.value).toMatch(/Level 4/)
    expect(strike?.stats.find((row) => row.label === 'Assigned')?.value).toBe('2')
    expect(strike?.body.join(' ')).toMatch(/damage/i)

    const racks = inspectNetworkLink(s, 'racks')
    expect(racks?.title).toBe('Corps racks')
    expect(racks?.body.join(' ')).toMatch(/Rebuild/)

    const core = inspectCore(s, 'pulse-cannon')
    expect(core?.stats.find((row) => row.label === 'Damage')?.value).toMatch(/→/)
    expect(core?.body.join(' ')).toMatch(/Salvage/)
    expect(core?.body.join(' ')).not.toMatch(JARGON)

    const attack = inspectFurnaceTrack(s, 'attack')
    expect(attack?.stats.find((row) => row.label === 'Bonus')?.value).toMatch(/1\.40/)
    expect(attack?.stats.find((row) => row.label === 'Heat')?.value).toBeTruthy()
  })

  it('keeps inspect copy free of designer jargon', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 8
    s.combat.highestSector = 8
    const blob = inspectCopyCorpus(s).join('\n')
    expect(blob).not.toMatch(JARGON)
    expect(blob).toMatch(/Mute Network/)
    expect(blob).toMatch(/not a flat shop|every level/)
    expect(NETWORK_BARS.every((bar) => inspectNetworkBar(s, bar.id))).toBe(true)
    expect(NETWORK_LINKS.every((link) => inspectNetworkLink(s, link.id))).toBe(true)
  })
})
