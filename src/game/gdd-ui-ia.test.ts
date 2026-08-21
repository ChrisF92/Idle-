import { describe, expect, it } from 'vitest'
import { MORE_STATIONS, moreStationBuckets, nextMajorDoor } from './moreStations'
import { foundryHubStatus, showSystemsHub, systemsHubCards, workersHubStatus } from './systemsHub'
import { systemsTabAttention, tabAttention } from './hubAttention'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'
import { ACT1_CADENCE } from './cadence'

describe('GDD information architecture', () => {
  it('keeps More to secondary systems and previews one major door', () => {
    expect(MORE_STATIONS.map((s) => s.id)).toEqual(['codex', 'protocols', 'reinforce'])
    expect(MORE_STATIONS.some((s) => s.id === 'network')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'furnace')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'research')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'process')).toBe(false)

    const fresh = moreStationBuckets(createInitialState(0))
    expect(fresh.open).toEqual([])
    expect(fresh.next.map((s) => s.id)).toEqual(['codex'])
    expect(fresh.later).toEqual([])

    const afterCodex = moreStationBuckets(atCareerWave(createInitialState(0), ACT1_CADENCE.codex))
    expect(afterCodex.open.map((s) => s.id)).toEqual(['codex'])
    expect(afterCodex.next.map((s) => s.id)).toEqual(['foundry'])
    expect(afterCodex.next[0]?.home).toBe('systems')

    const afterWorkers = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    expect(moreStationBuckets(afterWorkers).next.map((s) => s.id)).toEqual(['furnace'])
    expect(nextMajorDoor(afterWorkers)?.id).toBe('furnace')
    expect(nextMajorDoor(afterWorkers)?.home).toBe('systems')

    const afterFurnace = atCareerWave(createInitialState(0), ACT1_CADENCE.furnace)
    expect(moreStationBuckets(afterFurnace).next.map((s) => s.id)).toEqual(['research'])
    expect(nextMajorDoor(afterFurnace)?.home).toBe('systems')
  })

  it('lands Systems on a hub once Worker Drones unlock', () => {
    const pre = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.foundry)
    expect(showSystemsHub(pre)).toBe(false)
    expect(systemsHubCards(pre).map((c) => c.id)).toEqual(['foundry'])

    const workers = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.workers)
    expect(showSystemsHub(workers)).toBe(true)
    expect(systemsHubCards(workers).map((c) => c.id)).toEqual(['foundry', 'network'])
    expect(workersHubStatus(workers)[0]).toMatch(/assigned/)
    expect(foundryHubStatus(workers).some((line) => /idle/i.test(line))).toBe(true)

    const furnace = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.furnace)
    expect(systemsHubCards(furnace).map((c) => c.id)).toEqual(['foundry', 'network', 'furnace'])
  })

  it('badges Systems for idle Worker Drones as well as Foundry', () => {
    const workers = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.workers)
    expect(tabAttention(workers, 'foundry').spend).toBe(true)
    expect(tabAttention(workers, 'network').spend).toBe(true)
    expect(systemsTabAttention(workers).spend).toBe(true)
    expect(systemsTabAttention(workers).fresh).toBe(true)
  })
})
