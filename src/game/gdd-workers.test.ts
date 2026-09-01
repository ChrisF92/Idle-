import { describe, expect, it } from 'vitest'
import { assignWorker } from './actions'
import { ACT1_CADENCE } from './cadence'
import { isStationUnlocked, stationEffectiveDrones, visibleWorkerJobIds } from './catalog'
import {
  networkDataRate,
  networkManufactureMult,
  networkSalvageMult,
  networkScrapRate,
  networkStrikeMult,
  networkWardMult,
  tickNetwork,
} from './network'
import { isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'
import { advanceSeconds } from './tick'
import { isWorkersUnlocked, WORKER_JOB_IDS, workerJobCap, workerJobCapLine, workerJobLabel } from './workers'
import { startFabrication } from './foundry'
import { tickAutomation } from './automation'

describe('GDD Worker Drones', () => {
  it('stays locked before Wave 50, even after the first hull loss', () => {
    const dead = markHullLost(atCareerWave(createInitialState(0), 49))
    expect(isWorkersUnlocked(dead)).toBe(false)
    expect(isSystemUnlocked(dead, 'network')).toBe(false)
    expect(isSystemUnlocked(dead, 'base')).toBe(false)
    expect(isStationUnlocked(dead, 'scrap-field')).toBe(false)
  })

  it('opens industrial jobs with Foundry at Wave 50', () => {
    const open = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    expect(isWorkersUnlocked(open)).toBe(true)
    expect(isSystemUnlocked(open, 'network')).toBe(true)
    expect(isSystemUnlocked(open, 'base')).toBe(true)
    expect(isStationUnlocked(open, 'scrap-field')).toBe(true)
    expect(isStationUnlocked(open, 'sensor-net')).toBe(true)
    expect(isStationUnlocked(open, 'construction')).toBe(true)
    expect(WORKER_JOB_IDS).toEqual([
      'scrap-field',
      'sensor-net',
      'alloy-foundry',
      'drone-fab',
      'fab-bay',
      'construction',
    ])
    expect(isStationUnlocked(open, 'drone-fab')).toBe(false)
  })

  it('does not let drones buy Strike or Ward combat power', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.base.workerDrones = 8
    s.base.assignments.strike = 4
    s.network.bars.strike.levels = 12
    s.network.bars.ward.levels = 12
    const blocked = assignWorker(s, 'strike', 1)
    expect(blocked.base.assignments.strike).toBe(4)
    expect(networkStrikeMult(s)).toBe(1)
    expect(networkWardMult(s)).toBe(1)
  })

  it('produces scrap from the salvage job', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.combat.docked = true
    s.base.workerDrones = 4
    s = assignWorker(s, 'scrap-field', 2)
    expect(s.base.assignments['scrap-field']).toBe(2)
    const before = s.resources.scrap
    advanceSeconds(s, 10)
    expect(s.resources.scrap).toBeGreaterThan(before)
  })

  it('hard-caps a job so extra drones do not raise output', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.base.workerDrones = 40
    s = assignWorker(s, 'scrap-field', 20)
    const atCap = stationEffectiveDrones(s, 'scrap-field')
    s = assignWorker(s, 'scrap-field', 10)
    expect(stationEffectiveDrones(s, 'scrap-field')).toBe(atCap)
  })

  it('does not fill leftover Network bars', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.base.workerDrones = 8
    s.base.assignments.strike = 4
    s.network.bars.strike.levels = 0
    s.network.bars.strike.progress = 0
    expect(tickNetwork(s, 30)).toBe(false)
    expect(s.network.bars.strike.levels).toBe(0)
    expect(s.network.bars.strike.progress).toBe(0)
    expect(s.base.assignments.strike).toBeUndefined()
  })

  it('never turns Worker Drone labour into a combat Salvage multiplier', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.network.bars.yield.levels = 40
    expect(networkSalvageMult(s)).toBe(1)
    s.base.workerDrones = 16
    s.base.assignments['scrap-field'] = 8
    expect(networkSalvageMult(s)).toBe(1)
  })

  it('does not let unrelated Fabrication jobs multiply Worker Drone production', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.network.bars.loom.levels = 40
    expect(networkManufactureMult(s)).toBe(1)
    s.base.workerDrones = 16
    s.foundry.facilities = ['worker-fabricator']
    s.base.assignments['drone-fab'] = 8
    expect(networkManufactureMult(s)).toBe(1)
  })

  it('shows efficient ranges and applies diminishing returns', () => {
    expect(workerJobLabel('scrap-field')).toBe('Salvage Operations')
    expect(workerJobLabel('sensor-net')).toBe('Research')
    expect(workerJobLabel('alloy-foundry')).toBe('Processing')
    expect(workerJobLabel('fab-bay')).toBe('Fabrication')
    expect(workerJobCap('construction')).toEqual({ min: 2, efficient: 4, hard: 8 })
    expect(workerJobCapLine(2, 'construction')).toBe('2/4 efficient · cap 8')

    const s = atCareerWave(createInitialState(0), 120)
    s.base.workerDrones = 20
    s.base.assignments['scrap-field'] = 7
    const seven = stationEffectiveDrones(s, 'scrap-field')
    s.base.assignments['scrap-field'] = 8
    const eight = stationEffectiveDrones(s, 'scrap-field')
    s.base.assignments['scrap-field'] = 9
    const nine = stationEffectiveDrones(s, 'scrap-field')
    expect(nine - eight).toBeLessThan(eight - seven)
  })

  it('shows Infrastructure only while a real project is active', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced)
    expect(visibleWorkerJobIds(s)).not.toContain('construction')
    s.foundry.materials['recovered-stock'] = 20
    s.foundry.materials['tempered-alloy'] = 10
    s = startFabrication(s, 'facility', 'processing-line')
    expect(visibleWorkerJobIds(s)).toContain('construction')
  })

  it('manufactures Worker Drones only through the Worker Fabricator job', () => {
    let idle = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    idle.foundry.facilities = ['worker-fabricator']
    idle.foundry.materials['recovered-stock'] = 40
    idle.foundry.materials['conductive-filament'] = 20
    idle.resources.scrap = 80
    const before = idle.base.workerDrones
    advanceSeconds(idle, 120)
    expect(idle.base.workerDrones).toBe(before)

    let staffed = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    staffed.foundry.facilities = ['worker-fabricator']
    staffed.foundry.materials['recovered-stock'] = 40
    staffed.foundry.materials['conductive-filament'] = 20
    staffed.resources.scrap = 80
    staffed = startFabrication(staffed, 'worker', 'worker')
    advanceSeconds(staffed, 120)
    expect(staffed.base.workerDrones).toBe(before + 1)
  })

  it('keeps automatic reassignment inside Process progression', () => {
    const retired = atCareerWave(createInitialState(0), 120)
    retired.base.workerDrones = 8
    retired.ai.purchased = ['auto-assign-workers', 'labor-loop']
    tickAutomation(retired)
    expect(retired.base.assignments).toEqual({})

    const process = atCareerWave(createInitialState(0), ACT1_CADENCE.process)
    process.hiveResearch.completedIds = ['c1-queue-buffer', 'c2-combat-telemetry', 'c3-deep-queue', 'c4-process-kernel']
    process.base.workerDrones = 8
    process.resources.scrap = 80
    process.foundry.slots[0] = { recipeId: 'recovered-stock', progress: 0, paid: false }
    process.process.purchased = ['worker-presets', 'worker-auto-fill']
    process.process.config.network.enabled = true
    tickAutomation(process)
    expect(Object.values(process.base.assignments).reduce((sum, n) => sum + n, 0)).toBeGreaterThan(0)
    expect(Object.keys(process.base.assignments)).toEqual(
      expect.arrayContaining(['scrap-field', 'alloy-foundry']),
    )
  })

  it('does not drip extra scrap or data from retired bars', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.network.bars.yield.levels = 20
    s.network.bars.archive.levels = 20
    s.base.assignments.yield = 6
    s.base.assignments.archive = 6
    expect(networkScrapRate(s)).toBe(0)
    expect(networkDataRate(s)).toBe(0)
  })
})
