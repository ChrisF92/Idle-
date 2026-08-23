import { describe, expect, it } from 'vitest'
import { assignWorker } from './actions'
import { ACT1_CADENCE } from './cadence'
import { isStationUnlocked } from './catalog'
import {
  canStartFabrication,
  foundrySlotCount,
  hasFacility,
  startFabrication,
} from './foundry'
import { MORE_STATIONS } from './moreStations'
import { isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { atCareerWave } from './testHelpers'
import { constructionSpeedMult, isConstructionUnlocked, yardGridSize } from './yard'

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
    expect(yardGridSize(s)).toBe(0)
  })

  it('starts facilities as Fabrication jobs sped by Construction workers', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced)
    s.foundry.materials['slag-ingot'] = 20
    s.foundry.materials['hardened-plate'] = 10
    expect(canStartFabrication(s, 'facility', 'processing-line').ok).toBe(true)
    s = startFabrication(s, 'facility', 'processing-line')
    expect(s.foundry.fabrication[0]?.kind).toBe('facility')
    s.base.workerDrones = 4
    s = assignWorker(s, 'construction', 4)
    expect(constructionSpeedMult(s)).toBeGreaterThan(1)
    expect(hasFacility(s, 'processing-line')).toBe(false)
  })

  it('adds a second processor from a Processing Line, not a rank shop', () => {
    const early = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    expect(foundrySlotCount(early)).toBe(1)
    expect(canStartFabrication(early, 'facility', 'processing-line').ok).toBe(false)

    const open = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced)
    open.foundry.facilities = ['processing-line']
    expect(foundrySlotCount(open)).toBe(2)
  })
})
