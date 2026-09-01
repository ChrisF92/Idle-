import { describe, expect, it } from 'vitest'
import {
  inspectCopyCorpus,
  inspectCore,
  inspectFurnaceChannel,
  inspectNetworkOverview,
} from './inspect'
import { createInitialState } from './state'

const JARGON = /\b(?:USI|ITRTG|analogue|black-bar|PoC|TODO|Flagship|Sector)\b/i

describe('inspect sheets', () => {
  it('Worker Drones, Cores, and Furnace sheets carry live numbers and player copy', () => {
    const s = createInitialState(0)
    s.base.workerDrones = 5
    s.base.assignments['scrap-field'] = 2
    s.combat.docked = false
    s.combat.inFight = true
    s.resources.salvage = 12
    s.resources.choirAsh = 25
    s.resources.heat = 20
    s.furnace = {
      ignited: true,
      channels: { overdrive: 1, bulwark: 0, guidance: 0, harvest: 0 },
      effectStrengthMult: 1,
    }

    const overview = inspectNetworkOverview(s)
    expect(overview.title).toBe('Worker Drones')
    expect(overview.stats.find((row) => row.label === 'Assigned')?.value).toBe('2')
    expect(overview.body.join(' ')).toMatch(/Rebuild/)

    const core = inspectCore(s, 'pulse-cannon')
    expect(core?.stats.find((row) => row.label === 'Damage')?.value).toMatch(/→/)
    expect(core?.body.join(' ')).toMatch(/Mastery/)
    expect(core?.body.join(' ')).not.toMatch(JARGON)

    const overdrive = inspectFurnaceChannel(s, 'overdrive')
    expect(overdrive?.title).toBe('Overdrive')
    expect(overdrive?.stats.find((row) => row.label === 'Level')?.value).toBe('I')
    expect(overdrive?.stats.find((row) => row.label === 'Ignite cost')?.value).toBe('10 Heat')
  })

  it('keeps inspect copy free of designer jargon', () => {
    const s = createInitialState(0)
    const blob = inspectCopyCorpus(s).join('\n')
    expect(blob).not.toMatch(JARGON)
    expect(blob).toMatch(/Glass Frame/)
    expect(blob).toMatch(/Core Levels use Scrap/)
    expect(blob).toMatch(/Worker Drones/)
  })
})
