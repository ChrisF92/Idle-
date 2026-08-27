import { describe, expect, it } from 'vitest'
import { MORE_STATIONS, moreStationBuckets, nextMajorDoor } from './moreStations'
import { foundryHubStatus, showSystemsHub, systemsHubCards, workersHubStatus } from './systemsHub'
import { systemsTabAttention, tabAttention } from './hubAttention'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'
import { ACT1_CADENCE } from './cadence'
import { isSystemUnlocked } from './progression'

describe('GDD information architecture', () => {
  it('keeps More to unlocked secondary systems and hides locked doors', () => {
    expect(MORE_STATIONS.map((s) => s.id)).toEqual(['codex', 'protocols', 'reinforce'])
    expect(MORE_STATIONS.some((s) => s.id === 'network')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'furnace')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'research')).toBe(false)
    expect(MORE_STATIONS.some((s) => s.id === 'process')).toBe(false)

    const fresh = moreStationBuckets(createInitialState(0))
    expect(fresh.open).toEqual([])
    expect(fresh.next).toEqual([])
    expect(fresh.later).toEqual([])

    const afterCodex = moreStationBuckets(atCareerWave(createInitialState(0), ACT1_CADENCE.codex))
    expect(afterCodex.open.map((s) => s.id)).toEqual(['codex'])
    expect(afterCodex.next).toEqual([])

    const afterWorkers = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    expect(moreStationBuckets(afterWorkers).next).toEqual([])
    expect(nextMajorDoor(afterWorkers)?.id).toBe('furnace')

    const afterFurnace = atCareerWave(createInitialState(0), ACT1_CADENCE.furnace)
    expect(moreStationBuckets(afterFurnace).next).toEqual([])
    expect(nextMajorDoor(afterFurnace)?.id).toBe('research')

    const afterResearch = atCareerWave(createInitialState(0), ACT1_CADENCE.research)
    expect(moreStationBuckets(afterResearch).next).toEqual([])
    expect(nextMajorDoor(afterResearch)?.id).toBe('process')

    const processOpen = atCareerWave(createInitialState(0), ACT1_CADENCE.process)
    processOpen.prestige.prestigeCount = 2
    processOpen.hiveResearch.completed.energy = 1
    expect(moreStationBuckets(processOpen).open.map((s) => s.id)).toEqual(['codex'])
    expect(moreStationBuckets(processOpen).next).toEqual([])
    expect(nextMajorDoor(processOpen)?.id).toBe('protocols')

    const challengesOpen = atCareerWave(createInitialState(0), ACT1_CADENCE.protocols)
    challengesOpen.prestige.prestigeCount = 2
    challengesOpen.hiveResearch.completed.energy = 1
    expect(moreStationBuckets(challengesOpen).open.map((s) => s.id)).toEqual(['codex', 'protocols'])
    expect(moreStationBuckets(challengesOpen).next).toEqual([])
    expect(nextMajorDoor(challengesOpen)?.id).toBe('reinforce')
  })

  it('lands Systems on a hub once Foundry and Workers unlock', () => {
    const pre = atCareerWave(markHullLost(createInitialState(0)), 49)
    expect(showSystemsHub(pre)).toBe(false)

    const workers = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.workers)
    expect(showSystemsHub(workers)).toBe(true)
    expect(systemsHubCards(workers).map((c) => c.id)).toEqual(['foundry'])
    expect(workersHubStatus(workers)[0]).toMatch(/assigned/)
    expect(foundryHubStatus(workers).some((line) => /idle/i.test(line))).toBe(true)

    workers.foundry.masteryXp['recovered-stock'] = 3
    workers.foundry.slots[0] = { recipeId: 'recovered-stock', progress: 0.4, paid: true }
    workers.base.workerDrones = 4
    workers.base.assignments['alloy-foundry'] = 2
    const foundry = foundryHubStatus(workers)
    expect(foundry.some((line) => /2 Foundry workers/.test(line))).toBe(true)
    expect(foundry.some((line) => /Processors 1\/1 · Fabricators 0\/1/.test(line))).toBe(true)
    expect(foundry.some((line) => /Processing Recovered Stock 40%/.test(line))).toBe(true)

    const furnace = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.furnace)
    expect(systemsHubCards(furnace).map((c) => c.id)).toEqual(['foundry', 'furnace'])

    const research = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.research)
    expect(systemsHubCards(research).map((c) => c.id)).toEqual(['foundry', 'furnace', 'research'])

    const process = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.process)
    process.prestige.prestigeCount = 2
    process.hiveResearch.completed.energy = 1
    expect(systemsHubCards(process).map((c) => c.id)).toEqual(['foundry', 'furnace', 'research', 'process'])
  })

  it('badges Systems for idle Worker Drones as well as Foundry', () => {
    const workers = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.workers)
    expect(tabAttention(workers, 'foundry').spend).toBe(true)
    expect(tabAttention(workers, 'network').spend).toBe(true)
    expect(systemsTabAttention(workers).spend).toBe(true)
    expect(systemsTabAttention(workers).fresh).toBe(true)
  })

  it('does not open Furnace or Research before their Wave doors', () => {
    const mid = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced)
    mid.research.unlocked = ['alloy-smelting']
    mid.hiveResearch.completed.energy = 1
    expect(isSystemUnlocked(mid, 'furnace')).toBe(false)
    expect(isSystemUnlocked(mid, 'research')).toBe(false)
    expect(systemsHubCards(markHullLost(mid)).map((c) => c.id)).toEqual(['foundry'])

    const furnace = atCareerWave(createInitialState(0), ACT1_CADENCE.furnace)
    expect(isSystemUnlocked(furnace, 'furnace')).toBe(true)
    expect(isSystemUnlocked(furnace, 'research')).toBe(false)

    const research = atCareerWave(createInitialState(0), ACT1_CADENCE.research)
    expect(isSystemUnlocked(research, 'research')).toBe(true)
  })
})
