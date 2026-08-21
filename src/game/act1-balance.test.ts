import { describe, expect, it } from 'vitest'
import {
  ACT1_EXPECTED_AT,
  ACT1_TARGETS,
  ACT1_UNLOCKS,
  captureAct1Snapshot,
  inBand,
} from './balance/act1'
import {
  ENEMY_DMG_EARLY,
  ENEMY_HULL_EARLY,
  salvageFromKill,
  salvageSectorBase,
} from './combat'
import { moduleUpgradeCost } from './catalog'
import { hiveResearchNodeCost, HIVE_RESEARCH_FOCUS_MULT } from './hiveResearch'
import { NETWORK_FILL_COST, NETWORK_STARTING_DRONES } from './network'
import { FURNACE_BASE_IDLE_GEN, FURNACE_CHANNEL_MAX } from './furnace'
import { foundrySalvageReserve } from './foundry'
import { buyMaxCores } from './actions'
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
import { formatSummary } from './simulation/report'
import { createInitialState, SAVE_VERSION } from './state'
import { exportSave, importSave } from './save'

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
    expect(ACT1_UNLOCKS.foundry).toBe(6)
    expect(ACT1_UNLOCKS.reliquary).toBe(16)
    expect(ACT1_UNLOCKS.rebuildAvailable).toBe(PRESTIGE_MIN_SECTOR)
    expect(ACT1_UNLOCKS.furnace).toBe(28)
    expect(ACT1_UNLOCKS.research).toBe(34)
    expect(ACT1_UNLOCKS.protocols).toBe(52)
    expect(ACT1_UNLOCKS.echo).toBe(62)
    expect(ACT1_UNLOCKS.act1).toBe(30)
    expect(moduleUpgradeCost(0, 'pulse-cannon')).toBe(3)
    expect(moduleUpgradeCost(0, 'plate-layer')).toBe(6)
    expect(salvageFromKill(1, false)).toBe(1)
    expect(salvageFromKill(1, true)).toBe(5)
    expect(salvageFromKill(4, false)).toBe(4)
    expect(salvageSectorBase(10)).toBeLessThan(10)
    expect(salvageSectorBase(30)).toBeLessThan(30)
    expect(salvageSectorBase(30)).toBeGreaterThan(8)
    expect(NETWORK_STARTING_DRONES).toBe(4)
    expect(NETWORK_FILL_COST).toBe(12)
    expect(hiveResearchNodeCost(0)).toBe(52)
    expect(HIVE_RESEARCH_FOCUS_MULT).toBe(4)
    expect(FURNACE_CHANNEL_MAX).toBe(3)
    expect(FURNACE_BASE_IDLE_GEN).toBeGreaterThan(0)
    expect(ENEMY_HULL_EARLY).toBeGreaterThan(1)
    expect(ENEMY_DMG_EARLY).toBeGreaterThan(1)
    expect(PROCESS_NODES[0]?.cost).toBe(4)
  })

  it('lists explicit progression windows from the opening through late career doors', () => {
    const ids = ACT1_TARGETS.map((t) => t.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'sector-1',
        'foundry-unlock',
        'reliquary-unlock',
        'first-rebuild',
        'furnace-unlock',
        'hive-research-unlock',
        'first-research-bt',
        'sector-10',
        'protocols-unlock',
        'echo-unlock',
        'sector-30',
      ]),
    )
    const rebuild = ACT1_TARGETS.find((t) => t.id === 'first-rebuild')!
    expect(rebuild.min).toBeGreaterThanOrEqual(30 * 60)
    expect(rebuild.max).toBeLessThanOrEqual(5 * 60 * 60)
    const hourBeats = ACT1_TARGETS.filter((t) =>
      ['sector-1', 'foundry-unlock'].includes(t.id),
    )
    expect(hourBeats.every((t) => t.max <= 30 * 60)).toBe(true)
  })
})

describe('Act 1 onboarding audit', () => {
  it('does not pause on system doors and keeps copy free of designer jargon', () => {
    const byId = new Map(GUIDE_STEPS.map((s) => [s.id, s]))
    for (const id of ['guide-launch', 'guide-foundry-recipe', 'guide-furnace-light', 'guide-research-focus']) {
      expect(byId.has(id)).toBe(true)
      expect(byId.get(id)?.required).not.toBe(true)
    }
    expect(GUIDE_STEPS.every((s) => s.kind !== 'critical')).toBe(true)
    const blob = [
      ...GUIDE_STEPS.flatMap((s) => [s.title, ...(Array.isArray(s.body) ? s.body : [s.body])]),
      ...Object.values(SCREEN_HELP).flatMap((h) => [h.title, ...h.body]),
    ].join('\n')
    expect(blob).not.toMatch(JARGON)
    expect(blob).toMatch(/breakthrough/i)
    expect(blob).toMatch(/Heat/)
  })

  it('Skip of Research focus does not invent a later desk tour', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 7
    const skipped = skipOnboarding(s, 'guide-research-focus')
    expect(skipped.meta.seenOnboarding).toContain('guide-research-focus')
    expect(activeGuideStep(skipped, 'research')).toBeNull()
  })

  it('inspect sheets explain why damage, Network, Furnace, Rebuild, and Research change', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 8
    s.combat.highestSector = 8
    s.furnace.wanted.weapons = 1
    s.furnace.active.weapons = 1
    const blob = inspectCopyCorpus(s).join('\n')
    expect(blob).not.toMatch(JARGON)
    expect(blob.toLowerCase()).toMatch(/heat/)
    expect(blob.toLowerCase()).toMatch(/rebuild/)
    expect(blob.toLowerCase()).toMatch(/focus/)
    expect(blob.toLowerCase()).toMatch(/starvation|cycle work|half the sector/)
  })
})

describe('Act 1 Buy Max / Foundry reserve', () => {
  it('leaves Salvage for a slag craft once starter Cores are ranked', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 4
    s.combat.highestSector = 4
    s.shipyard.moduleLevels['pulse-cannon'] = 4
    s.shipyard.moduleLevels['plate-layer'] = 2
    s.shipyard.unlockedModules = ['pulse-cannon', 'plate-layer']
    s.shipyard.modules = ['pulse-cannon', 'plate-layer']
    s.process.purchased = ['core-buy-max']
    s.resources.salvage = 40
    const reserve = foundrySalvageReserve(s)
    expect(reserve).toBeGreaterThanOrEqual(10)
    const after = buyMaxCores(s)
    expect(after.resources.salvage).toBeGreaterThanOrEqual(reserve)
    expect(moduleLevelAfter(after)).toBeGreaterThan(4)
  })
})

function moduleLevelAfter(state: ReturnType<typeof createInitialState>): number {
  return state.shipyard.moduleLevels['pulse-cannon'] ?? 0
}

describe('Act 1 career simulations', () => {
  it('active player reaches a first Rebuild inside the authored window', () => {
    const report = runSimulation(firstRebuildConfig('active'))
    const run = report.runs[0]!
    // eslint-disable-next-line no-console
    console.log('\n' + formatSummary(report) + '\n')
    expect(run.safety.filter((s) => s.kind === 'nan' || s.kind === 'infinity')).toHaveLength(0)
    expect(run.rebuilds).toBeGreaterThanOrEqual(1)
    const first = run.milestones.find((m) => m.id === 'first-rebuild')
    expect(first).toBeTruthy()
    const window = ACT1_TARGETS.find((t) => t.id === 'first-rebuild')!
    expect(first!.activeSeconds).toBeGreaterThanOrEqual(window.min - window.warningPad)
    expect(first!.activeSeconds).toBeLessThanOrEqual(window.max + window.warningPad)
    expect(run.milestones.some((m) => m.id === 'foundry-unlock')).toBe(true)
    expect(run.milestones.some((m) => m.id === 'reliquary-unlock')).toBe(false)
    const end = run.snapshots[run.snapshots.length - 1]!
    const atRebuild = run.snapshots.find((s) => s.at === 'first-rebuild') ?? end
    expect(end.drones).toBeGreaterThanOrEqual(NETWORK_STARTING_DRONES)
    expect(end.processEarned).toBeGreaterThanOrEqual(4)
    expect(atRebuild.foundryRecipes).toBeGreaterThanOrEqual(1)
    // Active sims can finish a second Material breakthrough during a survivability wall.
    expect(atRebuild.researchBreakthroughs).toBe(0)
    expect(atRebuild.strike).toBeLessThan(40)
    expect(atRebuild.contribution.networkDamage).toBeLessThan(1.6)
    const s4 = ACT1_EXPECTED_AT['sector-4']!
    expect(inBand(end.pulse, [0, s4.pulse[1] + 8])).toBe(true)
  }, 120_000)

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

  it('casual offline catch-up does not explode sector from a closed app', () => {
    const report = runSimulation(
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
    expect(run.highestSectorEver).toBeGreaterThanOrEqual(4)
    expect(run.highestSectorEver).toBeLessThan(18)
    expect(run.safety.some((s) => s.kind === 'nan')).toBe(false)
  }, 120_000)

  it('roundtrips a mid-Act-1 save without bumping SAVE_VERSION', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 10
    s.combat.highestSector = 10
    s.hiveResearch.completed.energy = 2
    s.foundry.recipeLevels['slag-ingot'] = 4
    s.furnace.wanted.weapons = 1
    const json = exportSave(s)
    const back = importSave(json)
    expect(SAVE_VERSION).toBe(33)
    expect(back).toBeTruthy()
    expect(back!.hiveResearch.completed.energy).toBe(2)
    expect(back!.foundry.recipeLevels['slag-ingot']).toBe(4)
    expect(back!.furnace.wanted.weapons).toBe(1)
  })
})
