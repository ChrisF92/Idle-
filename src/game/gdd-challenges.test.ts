import { describe, expect, it } from 'vitest'
import { enterProtocol, performRebuild } from './actions'
import { ACT1_CADENCE, CHALLENGE_MIN_REBUILDS } from './cadence'
import { encounterForWave } from './combat'
import { furnaceDamageMult } from './furnace'
import {
  PROTOCOLS,
  canEnterProtocol,
  getProtocol,
  protocolBestWave,
  protocolDisabledLine,
  protocolGoalWave,
  protocolHullMult,
  protocolMutes,
  protocolRank,
  tryCompleteProtocol,
} from './protocols'
import { isSystemUnlocked } from './progression'
import { computeShipStats, createInitialState } from './state'
import { moreStationBuckets } from './moreStations'
import { armRebuildDoor, atCareerWave, markHullLost } from './testHelpers'

function challengeState(opts?: { wave?: number; rebuilds?: number; research?: boolean }) {
  const s = atCareerWave(markHullLost(createInitialState(0)), opts?.wave ?? ACT1_CADENCE.protocols)
  s.prestige.prestigeCount = opts?.rebuilds ?? CHALLENGE_MIN_REBUILDS
  if (opts?.research !== false) s.hiveResearch.completed.energy = 1
  s.combat.docked = true
  s.shipyard.moduleLevels['pulse-cannon'] = 4
  s.shipyard.moduleLevels['plate-layer'] = 4
  s.foundry.recipeLevels['slag-ingot'] = 1
  s.base.assignments['scrap-field'] = 2
  s.resources.choirAsh = 12
  s.reliquary.coreFits = { 'pulse-cannon': ['relic-test'] }
  return s
}

describe('GDD Challenges', () => {
  it('stays locked before Wave 250', () => {
    const locked = challengeState({ wave: ACT1_CADENCE.protocols - 1 })
    expect(isSystemUnlocked(locked, 'protocols')).toBe(false)
    expect(moreStationBuckets(locked).open.map((s) => s.id)).not.toContain('protocols')
  })

  it('stays locked at Wave 250 until Process is online', () => {
    const noRebuild = challengeState({ rebuilds: 1 })
    expect(isSystemUnlocked(noRebuild, 'protocols')).toBe(false)
    const noResearch = challengeState({ research: false })
    expect(isSystemUnlocked(noResearch, 'protocols')).toBe(false)
  })

  it('opens on More at Wave 250 after two Rebuilds', () => {
    const open = challengeState()
    expect(isSystemUnlocked(open, 'protocols')).toBe(true)
    expect(moreStationBuckets(open).open.map((s) => s.id)).toContain('protocols')
    expect(moreStationBuckets(open).next).toEqual([])
    expect(moreStationBuckets(open).open.map((s) => s.id)).not.toContain('reinforce')
  })

  it('lists the GDD examples with Wave goals and disabled systems', () => {
    expect(getProtocol('glass-ward')?.name).toBe('Glass Hive')
    expect(getProtocol('quiet-guns')?.name).toBe('Mono Core')
    expect(getProtocol('mute-network')?.name).toBe('Swarm Pressure')
    expect(getProtocol('dead-furnace')?.name).toBe('Cold Furnace')
    expect(getProtocol('dry-hold')?.name).toBe('Limited Economy')
    expect(getProtocol('cold-foundry')?.name).toBe('Industrial Silence')
    expect(PROTOCOLS.every((def) => def.goalWave >= 80)).toBe(true)
    const open = challengeState()
    expect(protocolGoalWave(open, 'glass-ward')).toBe(80)
    expect(protocolDisabledLine(getProtocol('dead-furnace')!)).toMatch(/Furnace/)
  })

  it('halves Hull on Glass Hive and mutes Cold Furnace', () => {
    const base = challengeState()
    const hull = computeShipStats(base).hullMax
    base.protocols.activeId = 'glass-ward'
    expect(protocolHullMult(base)).toBe(0.5)
    expect(computeShipStats(base).hullMax).toBeCloseTo(hull * 0.5)
    expect(protocolMutes(base, 'shields')).toBe(true)

    const furnace = challengeState()
    furnace.furnace.active.weapons = 1
    expect(furnaceDamageMult(furnace)).toBeGreaterThan(1)
    furnace.protocols.activeId = 'dead-furnace'
    expect(furnaceDamageMult(furnace)).toBe(1)
  })

  it('increases encounter density on Swarm Pressure', () => {
    const s = challengeState()
    const normal = encounterForWave(20, 1)
    s.protocols.activeId = 'mute-network'
    const swarm = encounterForWave(20, 1, s)
    expect(swarm.units.length).toBeGreaterThan(normal.units.length)
  })

  it('requires system familiarity before a Challenge can start', () => {
    const s = challengeState()
    s.furnace.active = { weapons: 0, shielding: 0, recovery: 0 }
    s.resources.choirAsh = 0
    s.resources.heat = 0
    expect(canEnterProtocol(s, 'dead-furnace').ok).toBe(false)
    s.resources.choirAsh = 10
    expect(canEnterProtocol(s, 'dead-furnace').ok).toBe(true)
  })

  it('ranks up when the goal Wave is reached', () => {
    let s = challengeState()
    s = enterProtocol(s, 'glass-ward')
    expect(s.protocols.activeId).toBe('glass-ward')
    s.combat.wave = protocolGoalWave(s, 'glass-ward')
    tryCompleteProtocol(s)
    expect(protocolRank(s, 'glass-ward')).toBe(1)
    expect(s.protocols.activeId).toBeNull()
    expect(protocolBestWave(s, 'glass-ward')).toBeGreaterThanOrEqual(80)
    expect(protocolGoalWave(s, 'glass-ward')).toBe(100)
  })

  it('keeps Challenge ranks across Rebuild', () => {
    let s = armRebuildDoor(createInitialState(0))
    s = atCareerWave(s, ACT1_CADENCE.protocols)
    s.combat.docked = true
    s.prestige.prestigeCount = CHALLENGE_MIN_REBUILDS
    s.hiveResearch.completed.energy = 1
    s.protocols.ranks = { 'glass-ward': 2 }
    s.protocols.bestWave = { 'glass-ward': 120 }
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.protocols.ranks['glass-ward']).toBe(2)
    expect(s.protocols.bestWave?.['glass-ward']).toBe(120)
  })
})
