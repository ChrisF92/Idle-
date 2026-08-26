import { describe, expect, it } from 'vitest'
import {
  BLUEPRINTS,
  ENEMY_PART_DROPS,
  GDD_ROSTER_CORE_IDS,
  familyCanDropPrint,
  isFarmableModule,
  listFarmableCores,
  printFragmentNeeds,
} from './catalog'
import { createInitialState } from './state'

describe('leftover Foundry print isolation', () => {
  it('keeps leftover recipes off the final 14 Cores', () => {
    for (const id of GDD_ROSTER_CORE_IDS) {
      expect(isFarmableModule(id), id).toBe(false)
      expect(BLUEPRINTS.some((b) => b.moduleId === id), id).toBe(false)
    }
    expect(BLUEPRINTS.some((b) => b.moduleId === 'charge-prism')).toBe(true)
    expect(BLUEPRINTS.some((b) => b.moduleId === 'swarm-rack')).toBe(true)
    expect(printFragmentNeeds(6)).toEqual({ casing: 2, core: 1, lens: 1 })
  })

  it('does not list leftover recipes as live farmable Cores', () => {
    const open = createInitialState(0)
    open.meta.highestSectorEver = 80
    open.meta.bestWave = 400
    expect(listFarmableCores(open).map((m) => m.id)).toEqual([])
  })

  it('does not award final Core IDs from leftover part tables', () => {
    for (const table of ENEMY_PART_DROPS) {
      for (const entry of table.entries) {
        expect(GDD_ROSTER_CORE_IDS).not.toContain(entry.moduleId)
      }
    }
    expect(familyCanDropPrint('armored', 'heavy-lance', 400)).toBe(false)
    expect(familyCanDropPrint('titan', 'barrier-projector', 400)).toBe(false)
    expect(familyCanDropPrint('titan', 'rail-driver', 400)).toBe(true)
  })
})
