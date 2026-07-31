import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import { buyAiNode, buyMatterShop, buyResearch } from './actions'
import {
  CHALLENGES,
  RESEARCH,
  getMatterShopItem,
  researchDamageMultiplier,
  researchEssenceMultiplier,
  workerManufactureSpeed,
} from './catalog'

describe('system cuts', () => {
  it('basic-optics and entity-anatomy grant no research damage', () => {
    const optics = RESEARCH.find((r) => r.id === 'basic-optics')
    const anatomy = RESEARCH.find((r) => r.id === 'entity-anatomy')
    expect(optics?.damageBonus).toBeUndefined()
    expect(anatomy?.damageBonus).toBeUndefined()
    expect(anatomy?.essenceBonus).toBe(0.25)

    let state = createInitialState(0)
    const before = computeShipStats(state).damage
    state.resources.data = 200
    state = buyResearch(state, 'basic-optics')
    state = buyResearch(state, 'entity-anatomy')
    expect(researchDamageMultiplier(state.research.unlocked)).toBe(1)
    expect(computeShipStats(state).damage).toBe(before)
    expect(researchEssenceMultiplier(state.research.unlocked)).toBeGreaterThan(1)
  })

  it('manufacture speed only from drone-fab station + AI overclock', () => {
    expect(
      RESEARCH.find((r) => r.id === 'drone-logistics')?.manufactureBonus,
    ).toBeUndefined()
    expect(getMatterShopItem('drone-corps')?.manufactureBonus).toBeUndefined()

    let state = createInitialState(0)
    state.research.unlocked = ['drone-logistics']
    state.meta.highestSectorEver = 10
    expect(workerManufactureSpeed(state)).toBe(1)

    state.base.assignments['drone-fab'] = 1
    expect(workerManufactureSpeed(state)).toBeGreaterThan(1)

    const withFab = workerManufactureSpeed(state)
    state.resources.prestigeMatter = 20
    state.prestige.prestigeCount = 2
    state = buyMatterShop(state, 'drone-corps')
    expect(workerManufactureSpeed(state)).toBe(withFab)

    state.resources.aiPoints = 3
    state = buyAiNode(state, 'fabricator-overclock')
    expect(workerManufactureSpeed(state)).toBeGreaterThan(withFab)
  })

  it('every challenge goalSector is 30', () => {
    expect(CHALLENGES.every((c) => c.goalSector === 30)).toBe(true)
  })
})
