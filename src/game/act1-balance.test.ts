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
import { formatSummary } from './simulation/report'
import { tendReliquary } from './simulation/actions'
import type { StrategyContext } from './simulation/types'
import { createInitialState, SAVE_VERSION } from './state'
import { exportSave, importSave } from './save'
import { atCareerWave, equipPostTutorialLoadout } from './testHelpers'
import { ACT1_CADENCE } from './cadence'
import { reliquaryDamageMult } from './reliquary'
import {
  RUN_UPGRADE_OPENING_RANKS,
  RUN_UPGRADE_POWER_SCALE,
  RUN_UPGRADE_POWER_SCALE_OPENING,
  WORKSHOP_WEAPON_POWER_PER_LEVEL,
  runUpgradeRunFactor,
} from './workshop'

const JARGON = /USI|ITRTG|analogue|black-bar/i

function firstRebuildConfig(strategy: 'active' | 'casual' | 'balanced' | 'offensive' | 'defensive' | 'economy-first' | 'optimiser') {
  return defaultSimulationConfig({
    start: { type: 'fresh' },
    strategy,
    stop: { type: 'first-rebuild' },
    seed: 1,
    logging: 'milestones',
    deadlockSeconds: 25 * 60,
    postRebuildSeconds: 30 * 60,
    maxIterations: 400_000,
    maxCalendarSeconds: 6 * 3600,
  })
}

function dummyStrategyCtx(): StrategyContext {
  return {
    config: firstRebuildConfig('balanced'),
    activeSeconds: 0,
    calendarSeconds: 0,
    offlineSeconds: 0,
    secondsSinceHighestSectorGain: 0,
    secondsSinceMeaningfulAction: 0,
    recentSectorClearMedian: null,
    lastRebuildActive: null,
    previousHighestAtRebuild: 0,
    deathsThisSector: 0,
    relaunches: 0,
    logging: 'summary',
    rng: () => 0.5,
    record: () => {},
    recordMeaningful: () => {},
    recordCorePurchase: () => {},
    recordRebuild: () => {},
    attachRebuildPurchase: () => {},
    noteLimitation: () => {},
  }
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
    expect(ACT1_UNLOCKS.act1).toBe(300)
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
    expect(hiveResearchNodeCost(0)).toBeGreaterThan(60)
    expect(HIVE_RESEARCH_WORKER_ACCEL).toBe(0.25)
    expect(FURNACE_CHANNEL_MAX).toBe(3)
    expect(FURNACE_BASE_IDLE_GEN).toBe(0)
    expect(ENEMY_HULL_EARLY).toBeGreaterThan(1)
    expect(ENEMY_DMG_EARLY).toBeGreaterThan(1)
    expect(PROCESS_NODES.find((n) => n.id === 'buy-ten')?.cost).toBe(2)
    expect(PROCESS_NODES.find((n) => n.id === 'core-buy-max')).toBeUndefined()
    const opening = runUpgradeRunFactor(RUN_UPGRADE_OPENING_RANKS, WORKSHOP_WEAPON_POWER_PER_LEVEL)
    const flat = Math.pow(1 + WORKSHOP_WEAPON_POWER_PER_LEVEL * RUN_UPGRADE_POWER_SCALE, RUN_UPGRADE_OPENING_RANKS)
    expect(opening).toBeGreaterThan(flat)
    expect(RUN_UPGRADE_POWER_SCALE_OPENING).toBeGreaterThan(RUN_UPGRADE_POWER_SCALE)
  })

  it('seats owned Relics into Core sockets at Dock so they actually multiply damage', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    s = equipPostTutorialLoadout(s)
    s.combat.docked = true
    s.reliquary.owned['battle-chip'] = 1
    expect(reliquaryDamageMult(s)).toBe(1)
    s = tendReliquary(s, dummyStrategyCtx())
    expect(s.reliquary.coreFits['pulse-cannon:1']?.[0]).toBe('battle-chip')
    expect(reliquaryDamageMult(s)).toBeGreaterThan(1)
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
        'w300',
      ]),
    )
    expect(ids).not.toContain('echo-unlock')
    expect(ids).not.toContain('sector-1')
    const rebuild = ACT1_TARGETS.find((t) => t.id === 'first-rebuild')!
    expect(rebuild.min).toBe(2 * 60 * 60)
    expect(rebuild.max).toBe(4 * 60 * 60)
    const hourBeats = ACT1_TARGETS.filter((t) =>
      ['first-wave', 'foundry-unlock'].includes(t.id),
    )
    expect(hourBeats.every((t) => t.max <= 60 * 60)).toBe(true)
  })
})

describe('Act 1 onboarding audit', () => {
  it('does not pause on system doors and keeps copy free of designer jargon', () => {
    const byId = new Map(GUIDE_STEPS.map((s) => [s.id, s]))
    for (const id of ['guide-launch', 'guide-foundry-recipe', 'guide-furnace-light', 'guide-research-focus', 'guide-rebuild', 'guide-reinforce']) {
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
    expect(blob.toLowerCase()).toMatch(/efficient range|diminishing returns/)
  })
})

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
    const end = run.snapshots[run.snapshots.length - 1]!
    const atRebuild = run.snapshots.find((s) => s.at === 'first-rebuild') ?? end
    expect(end.drones).toBeGreaterThanOrEqual(NETWORK_STARTING_DRONES)
    expect(end.processEarned).toBeGreaterThanOrEqual(4)
    expect(atRebuild.foundryRecipes).toBeGreaterThanOrEqual(1)
    expect(atRebuild.researchBreakthroughs).toBe(0)
    expect(atRebuild.strike).toBeLessThan(40)
    expect(atRebuild.contribution.networkDamage).toBeLessThan(1.6)
    expect(run.sorties.some((s) => s.salvageSpent > 0)).toBe(true)
    expect(run.coreSpending.some((c) => c.levelsPurchased > 0)).toBe(true)
    const defeat = run.milestones.find((m) => m.id === 'first-defeat')
    expect(defeat).toBeTruthy()
    const defeatWindow = ACT1_TARGETS.find((t) => t.id === 'first-defeat')!
    expect(defeat!.activeSeconds).toBeGreaterThanOrEqual(defeatWindow.min - defeatWindow.warningPad)
    expect(defeat!.activeSeconds).toBeLessThanOrEqual(defeatWindow.max + defeatWindow.warningPad)
    const rec = run.rebuildLog[0]!
    expect((rec.coresLost['pulse-cannon'] ?? 0) + (rec.coresLost['plate-layer'] ?? 0)).toBeGreaterThan(0)
    const s4 = ACT1_EXPECTED_AT['sector-4']!
    expect(inBand(rec.coresLost['pulse-cannon'] ?? 0, [0, s4.pulse[1] + 8])).toBe(true)
    const early = run.sorties.filter((s) => s.previousBest > 0 && s.previousBest < 40 && s.newBest)
    const earlyDelta = early.map((s) => s.endWave - s.previousBest)
    // eslint-disable-next-line no-console
    console.log('early Best Δ', earlyDelta.slice(0, 12).join(', ') || '(none)')
  }, 120_000)

  it('offensive first Rebuild still sits inside the 2–4h pad', () => {
    const report = runSimulation(firstRebuildConfig('offensive'))
    const run = report.runs[0]!
    // eslint-disable-next-line no-console
    console.log('\n' + formatSummary(report) + '\n')
    const first = run.milestones.find((m) => m.id === 'first-rebuild')
    expect(first).toBeTruthy()
    const window = ACT1_TARGETS.find((t) => t.id === 'first-rebuild')!
    expect(first!.activeSeconds).toBeGreaterThanOrEqual(window.min - window.warningPad)
    expect(first!.activeSeconds).toBeLessThanOrEqual(window.max + window.warningPad)
  }, 120_000)

  it('balanced player lights Furnace Weapons after the door', () => {
    const report = runSimulation(
      defaultSimulationConfig({
        start: { type: 'fresh' },
        strategy: 'balanced',
        stop: { type: 'wave', wave: 165 },
        seed: 1,
        logging: 'milestones',
        deadlockSeconds: 60 * 60,
        maxIterations: 1_200_000,
        maxCalendarSeconds: 24 * 3600,
      }),
    )
    const run = report.runs[0]!
    // eslint-disable-next-line no-console
    console.log('\n' + formatSummary(report) + '\n')
    expect(run.milestones.some((m) => m.id === 'furnace-unlock')).toBe(true)
    expect(run.milestones.some((m) => m.id === 'reliquary-unlock')).toBe(true)
    expect(run.rebuilds).toBeGreaterThanOrEqual(1)
    expect(run.rebuilds).toBeLessThan(20)
    expect(run.furnace.heatSpent).toBeGreaterThan(0)
    const end = run.snapshots[run.snapshots.length - 1]!
    expect(end.contribution.reliquaryDamage).toBeGreaterThan(0)
    expect(end.drones).toBeGreaterThan(4)
    expect(end.droneCap).toBeGreaterThan(4)
    const mastery = Object.values(run.foundry.recipeLevels ?? {}).reduce((s, n) => Math.max(s, n ?? 0), 0)
    expect(mastery).toBeLessThan(50)
    expect(
      run.meaningfulActions.some((a) => /Furnace weapons/i.test(a.label)),
    ).toBe(true)
  }, 180_000)

  it.skipIf(!process.env.RUN_WAVE_300)(
    'balanced career reaches Wave 300 inside the 70–100h pad',
    () => {
      const report = runSimulation(
        defaultSimulationConfig({
          start: { type: 'fresh' },
          strategy: 'balanced',
          stop: { type: 'wave', wave: 300 },
          seed: 1,
          logging: 'milestones',
          deadlockSeconds: 90 * 60,
          maxIterations: 2_000_000,
          maxCalendarSeconds: 21 * 24 * 3600,
        }),
      )
      const run = report.runs[0]!
      // eslint-disable-next-line no-console
      console.log('\n' + formatSummary(report) + '\n')
      const w300 = run.milestones.find((m) => m.id === 'wave-300')
      expect(w300).toBeTruthy()
      const window = ACT1_TARGETS.find((t) => t.id === 'w300')!
      expect(w300!.activeSeconds).toBeGreaterThanOrEqual(window.min - window.warningPad)
      expect(w300!.activeSeconds).toBeLessThanOrEqual(window.max + window.warningPad)
    },
    600_000,
  )

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
    // Death docks the Sortie, so 8-minute active slices no longer farm a held sector.
    // Offline catch-up must not explode the career; a couple of bands is enough progress.
    expect(run.highestSectorEver).toBeGreaterThanOrEqual(1)
    expect(run.highestSectorEver).toBeLessThan(18)
    expect(run.safety.some((s) => s.kind === 'nan')).toBe(false)
  }, 120_000)

  it('roundtrips a mid-Act-1 save without bumping SAVE_VERSION', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 10
    s.combat.highestSector = 10
    s.hiveResearch.completedIds = ['plate-bank', 'extra-tap']
    s.hiveResearch.completed.energy = 2
    s.foundry.recipeLevels['slag-ingot'] = 4
    s.furnace.wanted.weapons = 1
    const json = exportSave(s)
    const back = importSave(json)
    expect(SAVE_VERSION).toBe(41)
    expect(back).toBeTruthy()
    expect(back!.hiveResearch.completedIds).toEqual(expect.arrayContaining(['plate-bank', 'extra-tap']))
    expect(back!.foundry.recipeLevels['slag-ingot']).toBe(4)
    expect(back!.furnace.wanted.weapons).toBe(1)
  })

  it.skipIf(!process.env.RUN_PROFILE_SWEEP)(
    'logs Casual / Balanced / Economy / Offensive / Defensive / Optimiser first Rebuilds',
    () => {
      const profiles = ['casual', 'balanced', 'economy-first', 'offensive', 'defensive', 'optimiser'] as const
      for (const strategy of profiles) {
        const cfg = firstRebuildConfig(strategy)
        if (strategy === 'casual') {
          cfg.maxCalendarSeconds = 3 * 24 * 3600
          cfg.deadlockSeconds = 45 * 60
        }
        const report = runSimulation(cfg)
        // eslint-disable-next-line no-console
        console.log('\n' + formatSummary(report) + '\n')
        expect(report.runs[0]?.safety.some((s) => s.kind === 'nan')).toBe(false)
      }
    },
    600_000,
  )
})
