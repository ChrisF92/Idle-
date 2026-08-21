import { describe, expect, it } from 'vitest'
import { assignWorker, buyFoundryUpgrade, placeYardBuilding } from './actions'
import { ACT1_CADENCE } from './cadence'
import { isStationUnlocked } from './catalog'
import { canBuyFoundryUpgrade } from './foundry'
import { MORE_STATIONS } from './moreStations'
import { isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { atCareerWave } from './testHelpers'
import { advanceSeconds } from './tick'
import {
  constructionSpeedMult,
  isConstructionUnlocked,
  yardGood,
  yardGridSize,
} from './yard'

describe('GDD Foundry construction', () => {
  it('stays locked before Wave 90 even after Rebuilds', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced - 1)
    s.prestige.prestigeCount = 4
    expect(isConstructionUnlocked(s)).toBe(false)
    expect(isSystemUnlocked(s, 'yard')).toBe(false)
    expect(isStationUnlocked(s, 'construction')).toBe(false)
  })

  it('opens at career Best Wave 90 inside Foundry, not as a More station', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced)
    expect(isConstructionUnlocked(s)).toBe(true)
    expect(isSystemUnlocked(s, 'yard')).toBe(true)
    expect(isStationUnlocked(s, 'construction')).toBe(true)
    expect(MORE_STATIONS.some((station) => station.id === 'yard')).toBe(false)
    expect(yardGridSize(s)).toBe(3)
  })

  it('lets buildings produce and Worker Drones speed construction', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced)
    s = placeYardBuilding(s, 0, 'slag-heap')
    expect(s.yard.cells[0]?.buildingId).toBe('slag-heap')
    const idle = yardGood(s, 'ore')
    advanceSeconds(s, 10)
    const withoutCrew = yardGood(s, 'ore')
    expect(withoutCrew).toBeGreaterThan(idle)

    s.base.workerDrones = 4
    s = assignWorker(s, 'construction', 4)
    expect(constructionSpeedMult(s)).toBeGreaterThan(1)
    const beforeCrewed = yardGood(s, 'ore')
    advanceSeconds(s, 10)
    expect(yardGood(s, 'ore') - beforeCrewed).toBeGreaterThan(withoutCrew - idle - 0.01)
  })

  it('holds the third smelter until Wave 90', () => {
    const early = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    early.foundry.points = 40
    expect(canBuyFoundryUpgrade(early, 'fp-slot').ok).toBe(true)
    expect(canBuyFoundryUpgrade(early, 'fp-slot-2').ok).toBe(false)
    expect(canBuyFoundryUpgrade(early, 'fp-slot-2').reason).toMatch(/Wave 90/)

    let open = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced)
    open.foundry.points = 40
    expect(canBuyFoundryUpgrade(open, 'fp-slot-2').ok).toBe(true)
    open = buyFoundryUpgrade(open, 'fp-slot')
    open = buyFoundryUpgrade(open, 'fp-slot-2')
    expect(open.foundry.slots).toHaveLength(3)
  })
})
