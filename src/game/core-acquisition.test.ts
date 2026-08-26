import { describe, expect, it } from 'vitest'
import {
  BLUEPRINTS,
  GDD_ROSTER_CORE_IDS,
  earlyCareerFragmentMult,
  isFarmableModule,
} from './catalog'
import { assembleBlueprint, canAssembleBlueprint } from './actions'
import { logisticsDropMult } from './core'
import { foundryPartDropMult } from './foundryBonuses'
import { createInitialState } from './state'
import { moduleCopyCount } from './coreProgression'

describe('PR4 / PR5 acquisition boundary', () => {
  it('keeps the leftover fragment taper independent of final Core ownership', () => {
    expect(earlyCareerFragmentMult(4)).toBe(3.25)
    expect(earlyCareerFragmentMult(22)).toBe(1)
    const late = createInitialState(0)
    late.meta.highestSectorEver = 20
    late.core.ranks.logistics = 20
    expect(logisticsDropMult(late)).toBeGreaterThan(1)
    expect(foundryPartDropMult(late)).toBe(1)
    late.foundry.upgrades['fp-print'] = 4
    expect(foundryPartDropMult(late)).toBeCloseTo(1.32)
  })

  it('does not assemble a physical copy of a final Core from leftover recipes', () => {
    const state = createInitialState(0)
    const before = state.shipyard.coreInstances.map((row) => row.id).sort()
    for (const id of GDD_ROSTER_CORE_IDS) {
      expect(isFarmableModule(id)).toBe(false)
      expect(canAssembleBlueprint(state, id).ok).toBe(false)
      const after = assembleBlueprint(state, id)
      expect(after.shipyard.coreInstances.map((row) => row.id).sort()).toEqual(before)
      expect(moduleCopyCount(after, id)).toBe(moduleCopyCount(state, id))
    }
    expect(BLUEPRINTS.every((b) => !(GDD_ROSTER_CORE_IDS as readonly string[]).includes(b.moduleId))).toBe(
      true,
    )
  })
})
