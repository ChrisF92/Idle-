import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  inspectCopyCorpus,
  inspectCore,
  inspectFurnaceTrack,
  inspectNetworkOverview,
} from './inspect'

const JARGON = /USI|ITRTG|analogue|black-bar|PoC|TODO|\bFlagship\b|\bSector\b/i

describe('inspect sheets', () => {
  it('Worker Drones, Cores, and Furnace sheets carry live numbers and player copy', () => {
    const s = createInitialState(0)
    s.base.workerDrones = 5
    s.base.assignments['scrap-field'] = 2
    s.combat.docked = false
    s.resources.salvage = 12
    s.resources.choirAsh = 25
    s.resources.heat = 8
    s.furnace.wanted.weapons = 1
    s.furnace.active.weapons = 1

    const overview = inspectNetworkOverview(s)
    expect(overview.title).toBe('Worker Drones')
    expect(overview.stats.find((row) => row.label === 'Assigned')?.value).toBe('2')
    expect(overview.body.join(' ')).toMatch(/Rebuild/)

    const core = inspectCore(s, 'pulse-cannon')
    expect(core?.stats.find((row) => row.label === 'Damage')?.value).toMatch(/→/)
    expect(core?.body.join(' ')).toMatch(/Mastery/)
    expect(core?.body.join(' ')).not.toMatch(JARGON)

    const attack = inspectFurnaceTrack(s, 'attack')
    expect(attack?.stats.find((row) => row.label === 'Bonus')?.value).toMatch(/1\.40/)
    expect(attack?.stats.find((row) => row.label === 'Heat')?.value).toBeTruthy()
  })

  it('keeps inspect copy free of designer jargon', () => {
    const s = createInitialState(0)
    const blob = inspectCopyCorpus(s).join('\n')
    expect(blob).not.toMatch(JARGON)
    expect(blob).toMatch(/Glass Hive/)
    expect(blob).toMatch(/every level/)
    expect(blob).toMatch(/Worker Drones/)
  })
})
