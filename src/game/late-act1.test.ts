import { describe, expect, it } from 'vitest'
import { diagnoseW160Wall, probeLateAct1Wave } from './balance/lateAct1'
import { ACT1_TARGETS } from './balance/act1'
import { encounterForWave } from './combat'
import { ASH_PER_HEAT, furnaceActiveLevel, furnaceLightCost } from './furnace'
import { getHiveResearchNode } from './hiveResearch'
import { createInitialState } from './state'
import { defaultSimulationConfig } from './simulation/presets'
import { tendFurnace, shouldRebuild } from './simulation/actions'
import { atCareerWave, markHullLost } from './testHelpers'
import type { StrategyContext } from './simulation/types'
import { workerJobCap } from './workers'
import { canReinforce } from './reinforce'

function stubCtx(overrides: Partial<StrategyContext> = {}): StrategyContext {
  const noop = () => undefined
  return {
    config: defaultSimulationConfig({ strategy: 'balanced', stop: { type: 'wave', wave: 170 } }),
    activeSeconds: 12 * 3600,
    calendarSeconds: 12 * 3600,
    offlineSeconds: 0,
    secondsSinceHighestSectorGain: 10 * 60,
    secondsSinceBestWaveGain: 10 * 60,
    secondsSinceMeaningfulAction: 30,
    recentSectorClearMedian: 120,
    lastRebuildActive: 8 * 3600,
    previousHighestAtRebuild: 16,
    deathsThisSector: 1,
    relaunches: 8,
    logging: 'milestones',
    rng: () => 0.5,
    record: noop,
    recordMeaningful: noop,
    recordCorePurchase: noop,
    recordRebuild: noop,
    attachRebuildPurchase: noop,
    noteLimitation: noop,
    ...overrides,
  }
}

describe('late Act 1 W160 diagnosis', () => {
  it('does not treat W160 as an HP cliff vs W140', () => {
    const wall = diagnoseW160Wall()
    expect(wall.hullW140toW160).toBeLessThan(1.7)
    expect(wall.hullW160toW170).toBeLessThan(1.4)
    expect(wall.damageW140toW160).toBeLessThan(1.7)
    expect(wall.killsForWeaponsI).toBeLessThan(50)
    expect(wall.missingLever).toMatch(/Furnace/)
  })

  it('keeps W140–W170 hull continuous without a one-wave cliff', () => {
    const a = probeLateAct1Wave(159)
    const b = probeLateAct1Wave(160)
    const c = probeLateAct1Wave(161)
    expect(b.hullScale / a.hullScale).toBeLessThan(1.25)
    expect(c.hullScale / b.hullScale).toBeLessThan(1.25)
  })

  it('varies support-band packs across shields, snipers, and mixed roles', () => {
    const roles = new Set<string>()
    for (const wave of [141, 143, 145, 147, 149]) {
      for (const role of encounterForWave(wave).units.map((u) => u.role)) roles.add(role)
    }
    expect(roles.size).toBeGreaterThanOrEqual(2)
    expect([...roles].some((r) => r === 'shield' || r === 'sniper' || r === 'skirmisher')).toBe(true)
  })
})

describe('Furnace banks Ash for a frontier push', () => {
  it('does not drip-convert Ash while Docked', () => {
    let s = markHullLost(atCareerWave(createInitialState(0), 155))
    s.combat.docked = true
    s.resources.choirAsh = 80
    s.resources.heat = 0
    s = tendFurnace(s, stubCtx())
    expect(s.resources.choirAsh).toBe(80)
    expect(s.resources.heat).toBe(0)
    expect(furnaceActiveLevel(s, 'weapons')).toBe(0)
  })

  it('does not light Weapons at the start of a reclaim', () => {
    let s = markHullLost(atCareerWave(createInitialState(0), 160))
    s.combat.docked = false
    s.combat.wave = 12
    s.combat.consecutiveLosses = 0
    s.resources.choirAsh = 80
    s.resources.heat = 0
    s = tendFurnace(s, stubCtx())
    expect(furnaceActiveLevel(s, 'weapons')).toBe(0)
    expect(s.resources.choirAsh).toBe(80)
  })

  it('converts a full Weapons I bank on a frontier Sortie', () => {
    let s = markHullLost(atCareerWave(createInitialState(0), 160))
    s.combat.docked = false
    s.combat.wave = 155
    s.resources.choirAsh = 80
    s.resources.heat = 0
    s = tendFurnace(s, stubCtx())
    expect(furnaceActiveLevel(s, 'weapons')).toBe(1)
    expect(s.resources.heat).toBeLessThan(furnaceLightCost('weapons', 1))
    expect(s.resources.choirAsh).toBeLessThan(ASH_PER_HEAT)
  })

  it('does not Rebuild-spam a banked Furnace push', () => {
    let s = markHullLost(atCareerWave(createInitialState(0), 160))
    s.combat.docked = true
    s.prestige.prestigeCount = 2
    s.prestige.cycle = { bestWave: 160, sorties: 4, scrapEarned: 400 }
    s.resources.choirAsh = 90
    const decision = shouldRebuild(
      s,
      stubCtx({ secondsSinceHighestSectorGain: 70 * 60, lastRebuildActive: 1000 }),
    )
    expect(decision.yes).toBe(false)
  })

  it('does not Rebuild a Furnace bank mid-band while Best Wave is still moving', () => {
    let s = markHullLost(atCareerWave(createInitialState(0), 176))
    s.combat.docked = true
    s.prestige.prestigeCount = 8
    s.prestige.cycle = { bestWave: 176, sorties: 12, scrapEarned: 4000 }
    s.resources.choirAsh = 80_000
    const decision = shouldRebuild(
      s,
      stubCtx({
        secondsSinceHighestSectorGain: 4 * 3600,
        secondsSinceBestWaveGain: 20 * 60,
        lastRebuildActive: 1000,
        activeSeconds: 20 * 3600,
      }),
    )
    expect(decision.yes).toBe(false)
  })

  it('Rebuilds a spent Furnace wall after a three-hour stall so Matter can take over', () => {
    let s = markHullLost(atCareerWave(createInitialState(0), 176))
    s.combat.docked = true
    s.prestige.prestigeCount = 6
    s.prestige.cycle = { bestWave: 176, sorties: 20, scrapEarned: 8000 }
    s.resources.choirAsh = 500_000
    s.combat.consecutiveLosses = 0
    const decision = shouldRebuild(
      s,
      stubCtx({
        secondsSinceHighestSectorGain: 3 * 3600 + 60,
        secondsSinceBestWaveGain: 3 * 3600 + 60,
        lastRebuildActive: 1000,
        activeSeconds: 20 * 3600,
      }),
    )
    expect(decision.yes).toBe(true)
  })

  it('keeps leftover Ash after lighting Weapons I + Ward I on the wall', () => {
    let s = markHullLost(atCareerWave(createInitialState(0), 160))
    s.combat.docked = false
    s.combat.wave = 155
    s.resources.choirAsh = 250
    s.resources.heat = 0
    s = tendFurnace(s, stubCtx())
    expect(furnaceActiveLevel(s, 'weapons')).toBe(1)
    expect(furnaceActiveLevel(s, 'shielding')).toBe(1)
    expect(s.resources.choirAsh).toBeGreaterThan(80)
  })

  it('does not spend Weapons II on a healthy frontier Sortie', () => {
    let s = markHullLost(atCareerWave(createInitialState(0), 160))
    s.combat.docked = false
    s.combat.wave = 155
    s.resources.choirAsh = 500
    s.resources.heat = 0
    s = tendFurnace(s, stubCtx({ secondsSinceHighestSectorGain: 8 * 60 }))
    expect(furnaceActiveLevel(s, 'weapons')).toBe(1)
  })

  it('escalates a stalled Ash bank to Weapons II+', () => {
    let s = markHullLost(atCareerWave(createInitialState(0), 176))
    s.combat.docked = false
    s.combat.wave = 170
    s.resources.choirAsh = 500
    s.resources.heat = 0
    s = tendFurnace(s, stubCtx({ secondsSinceHighestSectorGain: 22 * 60 }))
    expect(furnaceActiveLevel(s, 'weapons')).toBeGreaterThanOrEqual(2)
  })

  it('upgrades an already-lit Weapons I when the wall does not break', () => {
    let s = markHullLost(atCareerWave(createInitialState(0), 176))
    s.combat.docked = false
    s.combat.wave = 176
    s.resources.choirAsh = 80
    s.resources.heat = 0
    s = tendFurnace(s, stubCtx({ secondsSinceHighestSectorGain: 8 * 60 }))
    expect(furnaceActiveLevel(s, 'weapons')).toBe(1)
    s.resources.choirAsh = 600
    s = tendFurnace(s, stubCtx({ secondsSinceHighestSectorGain: 40 * 60 }))
    expect(furnaceActiveLevel(s, 'weapons')).toBe(3)
  })

  it('lights a hard-stalled bank at Sortie start instead of waiting for the last eight waves', () => {
    let s = markHullLost(atCareerWave(createInitialState(0), 176))
    s.combat.docked = false
    s.combat.wave = 1
    s.combat.consecutiveLosses = 0
    s.resources.choirAsh = 600
    s.resources.heat = 0
    s = tendFurnace(s, stubCtx({ secondsSinceHighestSectorGain: 40 * 60 }))
    expect(furnaceActiveLevel(s, 'weapons')).toBeGreaterThanOrEqual(2)
  })
})

describe('late Act 1 authored windows and first Research', () => {
  it('keeps Furnace / Research / Process / Challenges / W300 on the late-career bands', () => {
    const byId = Object.fromEntries(ACT1_TARGETS.map((t) => [t.id, t]))
    expect(byId['furnace-unlock']?.min).toBe(8 * 3600)
    expect(byId['hive-research-unlock']?.min).toBe(12 * 3600)
    expect(byId['process-unlock']?.min).toBe(25 * 3600)
    expect(byId['challenges-unlock']?.min).toBe(40 * 3600)
    expect(byId['w300']?.min).toBe(70 * 3600)
  })

  it('makes the first Research nodes mechanical breakthroughs, not four-hour +2% shops', () => {
    for (const id of ['plate-bank', 'priority-lock', 'second-processor']) {
      const node = getHiveResearchNode(id)!
      expect(node.kind).toBe('breakthrough')
      expect(node.duration).toBeLessThanOrEqual(15 * 60)
      expect(node.duration).toBeGreaterThanOrEqual(8 * 60)
    }
    expect(getHiveResearchNode('plate-bank')?.coreStartLevel).toBe(1)
    expect(getHiveResearchNode('priority-lock')?.focusFire).toBe(true)
    expect(getHiveResearchNode('second-processor')?.foundrySlots).toBe(1)
  })

  it('gives a growing Worker corps more real jobs through W300', () => {
    const demand =
      workerJobCap('scrap-field').hard +
      workerJobCap('sensor-net').hard +
      workerJobCap('alloy-foundry').hard +
      workerJobCap('drone-fab').hard +
      workerJobCap('fab-bay').hard +
      workerJobCap('construction').hard
    expect(demand).toBeGreaterThanOrEqual(80)
    expect(canReinforce(createInitialState(0)).ok).toBe(false)
  })
})
