import { describe, expect, it } from 'vitest'
import {
  ACT1_TARGETS,
  ACT1_UNLOCKS,
  captureAct1Snapshot,
} from './balance/act1'
import {
  ENEMY_DMG_EARLY,
  ENEMY_HULL_EARLY,
  salvageFromKill,
  salvageWaveBase,
} from './combat'
import { hiveResearchNodeCost, HIVE_RESEARCH_WORKER_ACCEL } from './hiveResearch'
import { NETWORK_FILL_COST, NETWORK_STARTING_DRONES } from './network'
import { FURNACE_BASE_IDLE_GEN, FURNACE_CHANNEL_MAX } from './furnace'
import {
  GUIDE_STEPS,
  PRESTIGE_MIN_SECTOR,
  skipOnboarding,
  activeGuideStep,
} from './progression'
import { PROCESS_NODES } from './process'
import { inspectCopyCorpus } from './inspect'
import { SCREEN_HELP } from './screenHelp'
import { defaultSimulationConfig } from './simulation/presets'
import { runSimulation } from './simulation/runner'
import { createInitialState, SAVE_VERSION } from './state'
import { exportSave, importSave } from './save'
import { canRebuild } from './rebuild'
import { ACT1_CADENCE } from './cadence'
import { atCareerWave } from './testHelpers'

const JARGON = /USI|ITRTG|analogue|black-bar/i

function firstRebuildConfig(strategy: 'active' | 'optimiser') {
  return defaultSimulationConfig({
    start: { type: 'fresh' },
    strategy,
    stop: { type: 'first-rebuild' },
    seed: 1,
    logging: 'milestones',
    deadlockSeconds: 25 * 60,
    postRebuildSeconds: 90,
    maxIterations: 400_000,
    maxCalendarSeconds: 6 * 3600,
  })
}

describe('Act 1 authored formulas', () => {
  it('keeps career doors and shop identities the redesigned systems already use', () => {
    expect(ACT1_UNLOCKS.foundry).toBe(20)
    expect(ACT1_UNLOCKS.reliquary).toBe(110)
    expect(ACT1_UNLOCKS.rebuildAvailable).toBe(PRESTIGE_MIN_SECTOR)
    expect(ACT1_UNLOCKS.furnace).toBe(140)
    expect(ACT1_UNLOCKS.research).toBe(170)
    expect(ACT1_UNLOCKS.protocols).toBe(250)
    expect(ACT1_UNLOCKS.echo).toBe(275)
    expect(ACT1_UNLOCKS.act1).toBe(1000)
    expect(salvageFromKill(1, false)).toBe(1)
    expect(salvageFromKill(1, true)).toBe(5)
    expect(salvageFromKill(4, false)).toBe(1)
    expect(salvageWaveBase(10)).toBeGreaterThan(1)
    expect(salvageWaveBase(30)).toBeGreaterThan(salvageWaveBase(10))
    expect(salvageWaveBase(1)).toBe(1)
    expect(NETWORK_STARTING_DRONES).toBe(4)
    expect(NETWORK_FILL_COST).toBe(12)
    expect(hiveResearchNodeCost(0)).toBeGreaterThan(60)
    expect(HIVE_RESEARCH_WORKER_ACCEL).toBe(0.25)
    expect(FURNACE_CHANNEL_MAX).toBe(3)
    expect(FURNACE_BASE_IDLE_GEN).toBe(0)
    expect(ENEMY_HULL_EARLY).toBeGreaterThan(1)
    expect(ENEMY_DMG_EARLY).toBeGreaterThan(1)
    expect(PROCESS_NODES.find((n) => n.id === 'buy-ten')?.cost).toBe(2)
    expect(PROCESS_NODES.find((n) => n.id === 'core-buy-max')).toBeUndefined()
  })

  it('lists explicit progression windows from the opening through late career doors', () => {
    const ids = ACT1_TARGETS.map((t) => t.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'first-wave',
        'foundry-unlock',
        'workers-unlock',
        'first-rebuild',
        'process-unlock',
        'w1000',
      ]),
    )
    expect(ids).not.toContain('echo-unlock')
    expect(ids).not.toContain('sector-1')
    const rebuild = ACT1_TARGETS.find((t) => t.id === 'first-rebuild')!
    expect(rebuild.min).toBeGreaterThanOrEqual(30 * 60)
    expect(rebuild.max).toBeLessThanOrEqual(5 * 60 * 60)
    const hourBeats = ACT1_TARGETS.filter((t) =>
      ['first-wave', 'foundry-unlock'].includes(t.id),
    )
    expect(hourBeats.every((t) => t.max <= 60 * 60)).toBe(true)
  })
})

describe('Act 1 onboarding audit', () => {
  it('does not pause on system doors and keeps copy free of designer jargon', () => {
    const byId = new Map(GUIDE_STEPS.map((s) => [s.id, s]))
    for (const id of ['foundry.processing', 'furnace.channel', 'research.project']) {
      expect(byId.has(id)).toBe(true)
      expect(byId.get(id)?.required).not.toBe(true)
      expect(byId.get(id)?.pause).toBe(false)
    }
    expect(byId.has('opening.salvage')).toBe(true)
    const blob = [
      ...GUIDE_STEPS.flatMap((s) => {
        const body = typeof s.body === 'function' ? [] : Array.isArray(s.body) ? s.body : [s.body]
        return [s.title, ...body]
      }),
      ...Object.values(SCREEN_HELP).flatMap((h) => [h.title, ...h.body]),
    ].join('\n')
    expect(blob).not.toMatch(JARGON)
    expect(blob).toMatch(/breakthrough/i)
    expect(blob).toMatch(/Heat/)
  })

  it('Skip of Research focus does not invent a later desk tour', () => {
    const s = createInitialState(0)
    const skipped = skipOnboarding(s, 'research.project')
    expect(skipped.meta.seenOnboarding).toContain('research.project')
    expect(activeGuideStep(skipped, 'research')).toBeNull()
  })

  it('inspect sheets explain why damage, Network, Furnace, Rebuild, and Research change', () => {
    const s = createInitialState(0)
    s.furnace.wanted.weapons = 1
    s.furnace.active.weapons = 1
    const blob = inspectCopyCorpus(s).join('\n')
    expect(blob).not.toMatch(JARGON)
    expect(blob.toLowerCase()).toMatch(/heat/)
    expect(blob.toLowerCase()).toMatch(/rebuild/)
    expect(blob.toLowerCase()).toMatch(/focus/)
    expect(blob.toLowerCase()).toMatch(/efficient range|diminishing returns/)
  })
})

describe('Act 1 career simulations', () => {
  it('first Rebuild door is W210, after Relics, and is eligible with three normal Sorties', () => {
    // PR11 owns the live grind-to-Rebuild calendar. PR3 only owns the canonical door.
    expect(ACT1_CADENCE.rebuild).toBe(210)
    expect(ACT1_UNLOCKS.rebuildAvailable).toBe(210)
    expect(ACT1_UNLOCKS.reliquary).toBe(110)
    expect(ACT1_UNLOCKS.reliquary).toBeLessThan(ACT1_CADENCE.rebuild)

    const short = atCareerWave(createInitialState(0), 209)
    short.combat.docked = true
    short.prestige.cycle = { bestWave: 209, normalSortiesCompleted: 3, scrapGenerated: 0 }
    expect(canRebuild(short)).toBe(false)

    const ready = atCareerWave(createInitialState(0), 210)
    ready.combat.docked = true
    ready.prestige.prestigeCount = 0
    ready.prestige.cycle = { bestWave: 210, normalSortiesCompleted: 3, scrapGenerated: 0 }
    expect(canRebuild(ready)).toBe(true)
  })

  it.skip('optimiser first Rebuild is not a spam-reset and still spends Cores', () => {
    const report = runSimulation(firstRebuildConfig('optimiser'))
    const run = report.runs[0]!
    expect(run.rebuilds).toBeGreaterThanOrEqual(1)
    expect(run.coreSpending.some((c) => c.levelsPurchased > 0)).toBe(true)
    const rec = run.rebuildLog[0]!
    expect(rec.highestSector).toBeGreaterThanOrEqual(4)
    expect(rec.previousPushSeconds).toBeGreaterThan(6 * 60)
    const atRebuild = run.snapshots.find((s) => s.at === 'first-rebuild')
    expect((atRebuild?.foundryRecipes ?? 0) + (run.foundry.points > 0 ? 1 : 0)).toBeGreaterThanOrEqual(1)
    const contrib = captureAct1Snapshot(
      createInitialState(0),
      'fresh',
      0,
      0,
    ).contribution
    expect(contrib.networkDamage).toBe(0)
    expect(contrib.furnaceDamage).toBe(0)
    expect(contrib.researchDamage).toBe(0)
  }, 120_000)

  it('casual offline catch-up does not explode sector from a closed app', async () => {
    const report = await runSimulation(
      defaultSimulationConfig({
        start: { type: 'fresh' },
        strategy: 'casual',
        stop: { type: 'duration', calendarSeconds: 8 * 3600 },
        seed: 2,
        session: { activeSeconds: 8 * 60, offlineSeconds: 3 * 3600 },
        deadlockSeconds: 25 * 60,
        maxIterations: 200_000,
        maxCalendarSeconds: 10 * 3600,
      }),
    )
    const run = report.runs[0]!
    expect(run.offlineSeconds).toBeGreaterThan(2 * 3600)
    // Death docks the Sortie, so 8-minute active slices no longer farm a held sector.
    // Offline catch-up must not explode the career; a couple of bands is enough progress.
    expect(run.highestWave).toBeGreaterThanOrEqual(1)
    expect(run.highestWave).toBeLessThan(18)
    expect(run.safety.some((s) => s.kind === 'nan')).toBe(false)
  }, 120_000)

  it('roundtrips a mid-Act-1 save without bumping SAVE_VERSION', () => {
    const s = createInitialState(0)
    s.hiveResearch.completed.energy = 2
    s.foundry.recipeLevels['slag-ingot'] = 4
    s.furnace.wanted.weapons = 1
    const json = exportSave(s)
    const back = importSave(json)
    expect(SAVE_VERSION).toBe(45)
    expect(back).toBeTruthy()
    expect(back!.hiveResearch.completed.energy).toBe(2)
    expect(back!.foundry.recipeLevels['slag-ingot']).toBe(4)
    expect(back!.furnace.wanted.weapons).toBe(1)
  })
})
