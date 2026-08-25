import { describe, expect, it } from 'vitest'
import { CURVE_LAYERS, ENEMY_HULL_EARLY, WORKSHOP_WEAPON_POWER_PER_LEVEL } from './balance/curves'
import { ACT1_TARGETS } from './balance/act1'
import { createInitialState } from './state'
import {
  buildPlaytestReport,
  formatLastSortieTelemetry,
  formatPlaytestScript,
  noteCareerWave,
} from './playtest'
import { detectGddWarnings } from './simulation/analysis'
import { GDD_SIM_PROFILES, GDD_WARNING_CODES } from './simulation/types'
import { getStrategy, spendProfileFor, STRATEGIES } from './simulation/strategies'
import { defaultSimulationConfig, SIMULATION_PRESETS, stopLabel } from './simulation/presets'
import { runSimulation } from './simulation/runner'
import { formatSummary } from './simulation/report'
import { WORKER_JOB_IDS } from './workers'

const LEFTOVER = /\bSector\b|\bFlagship\b|\bEcho\b|\bFrontier\b|\bSlag Bank\b|\bStrike\b|\bWard\b/

describe('GDD Phase 9 simulator + playtest', () => {
  it('names the curve layers without retuning live combat numbers', () => {
    expect(CURVE_LAYERS).toEqual(
      expect.arrayContaining([
        'enemy-hull',
        'enemy-damage',
        'salvage',
        'scrap',
        'workshop-start',
        'matter',
        'reclaim',
      ]),
    )
    expect(ENEMY_HULL_EARLY).toBeGreaterThan(1)
    expect(WORKSHOP_WEAPON_POWER_PER_LEVEL).toBe(0.08)
  })

  it('exposes all six GDD profiles and keeps Balanced as the active alias', () => {
    expect(GDD_SIM_PROFILES).toEqual([
      'casual',
      'balanced',
      'offensive',
      'defensive',
      'economy-first',
      'optimiser',
    ])
    for (const id of GDD_SIM_PROFILES) {
      expect(STRATEGIES[id]?.label).toBeTruthy()
    }
    expect(spendProfileFor('active')).toBe('balanced')
    expect(getStrategy('balanced').label).toBe('Balanced')
    expect(getStrategy('active').label).toBe('Balanced')
  })

  it('stops and presets speak Wave, not leftover Sector 30', () => {
    expect(stopLabel({ type: 'wave', wave: 300 })).toBe('Wave 300')
    expect(stopLabel({ type: 'sector', sector: 30 })).toBe('Wave 300')
    expect(SIMULATION_PRESETS.some((p) => p.id === 'fresh-wave-300')).toBe(true)
    expect(SIMULATION_PRESETS.some((p) => /sector 30/i.test(p.label + p.blurb))).toBe(false)
    expect(SIMULATION_PRESETS.map((p) => p.config.strategy)).toEqual(
      expect.arrayContaining(['casual', 'balanced', 'offensive', 'defensive', 'economy-first', 'optimiser']),
    )
  })

  it('keeps Act 1 targets on GDD beats and drops Echo', () => {
    const ids = ACT1_TARGETS.map((t) => t.id)
    expect(ids).toEqual(
      expect.arrayContaining(['first-wave', 'foundry-unlock', 'first-rebuild', 'process-unlock', 'w1000']),
    )
    expect(ids).not.toContain('echo-unlock')
    expect(GDD_WARNING_CODES).toEqual(
      expect.arrayContaining(['WALL', 'HARD WALL', 'STEAMROLL', 'ECON TRAP', 'DEAD UPGRADE', 'REBUILD WEAK']),
    )
  })

  it('emits GDD warning codes from fixtures', () => {
    const emptyRebuild = {
      index: 1,
      activeSeconds: 400,
      calendarSeconds: 400,
      highestSector: 8,
      matterEarned: 2,
      matterBalanceAfter: 2,
      reasons: ['stall'],
      coresLost: {},
      workshopLost: {},
      networkLevelsLost: {},
      linksKept: {},
      permanentPurchases: [],
      previousPushSeconds: 400,
      repushSeconds: 40,
      repushRatio: 0.05,
      newHighestAfter: 20,
    }
    const codes = detectGddWarnings({
      walls: [
        {
          sector: 8,
          clearSeconds: 400,
          recentMedian: 80,
          ratio: 5,
          likelyConstraint: 'Damage',
          detail: 'slow',
        },
      ],
      rebuildLog: [emptyRebuild],
      spending: [{ moduleId: 'pulse-cannon', name: 'Pulse', levelsPurchased: 12, salvageSpent: 90, share: 0.9 }],
      milestones: [
        { id: 'foundry-unlock', label: 'Foundry', activeSeconds: 60, calendarSeconds: 60 },
        { id: 'first-rebuild', label: 'First Rebuild', activeSeconds: 400, calendarSeconds: 400 },
      ],
      highestWave: 80,
      foundryRecipes: 0,
      workerDrones: 4,
      furnaceLit: 0,
      researchBreakthroughs: 0,
      salvageEarned: 200,
      salvageSpentOnRunUpgrades: 10,
      salvageSpentOnCores: 10,
      scrapEarned: 1,
      workshopLevels: {},
      failedPushStreak: 7,
      activeSeconds: 20 * 60,
    }).map((w) => w.code)
    expect(codes).toEqual(expect.arrayContaining(['HARD WALL', 'STEAMROLL', 'SYSTEM IRRELEVANT', 'REBUILD EXPLOSIVE']))
  })

  it('balanced sim spends Salvage on run upgrades during the opening Sortie', async () => {
    const report = await runSimulation(
      defaultSimulationConfig({
        start: { type: 'fresh' },
        strategy: 'balanced',
        stop: { type: 'active-duration', seconds: 4 * 60 },
        seed: 1,
        logging: 'milestones',
        deadlockSeconds: 8 * 60,
        maxIterations: 80_000,
        maxCalendarSeconds: 10 * 60,
      }),
    )
    const run = report.runs[0]!
    expect(run.sorties.reduce((s, row) => s + row.salvageSpent, 0)).toBeGreaterThan(0)
    expect(run.milestones.some((m) => m.id === 'first-defeat' || m.id === 'wave-1')).toBe(true)
  }, 40_000)

  it('writes Wave-native sim summaries without leftover loop language', async () => {
    const report = await runSimulation(
      defaultSimulationConfig({
        start: { type: 'fresh' },
        strategy: 'idle',
        stop: { type: 'active-duration', seconds: 4 },
        seed: 9,
        logging: 'milestones',
        deadlockSeconds: 60,
        maxIterations: 20_000,
      }),
    )
    const text = formatSummary(report)
    expect(report.runs[0]?.highestWave).toBeGreaterThanOrEqual(0)
    expect(text).toMatch(/Highest Wave/)
    expect(text).toMatch(/WORKERS/)
    expect(text).not.toMatch(LEFTOVER)
    expect(text).not.toMatch(/Highest Sector/)
  }, 20_000)

  it('writes a GDD playtest script and last-Sortie blob without leftover loop language', () => {
    const state = createInitialState(0)
    noteCareerWave(state, 10)
    state.meta.bestWave = 10
    state.combat.bestWave = 10
    state.combat.lastSortie = {
      ...state.combat.lastSortie,
      outcome: 'defeat',
      wave: 8,
      previousBest: 4,
      newBest: true,
      salvageGained: 12,
      salvageSpent: 6,
      scrapEarned: 3,
      spendByCategory: { attack: 4, defense: 2, economy: 0 },
      stats: {
        ...state.combat.lastSortie.stats,
        sortieSeed: 17,
        finalFightTime: 42,
        lastEnemyName: 'Skirmisher',
        lastIsBoss: false,
      },
    }
    state.playtest.firsts.rebuild = 12 * 60 * 1000
    state.playtest.playtimeMs = 31 * 60 * 1000
    state.furnace.active = { ...state.furnace.active, weapons: 1 }
    state.playtest.protocols['pack-pressure'] = { a: 1, c: 1 }

    const report = buildPlaytestReport(state)
    const script = formatPlaytestScript(state).join('\n')
    const telemetry = formatLastSortieTelemetry(state).join('\n')
    expect(script).toMatch(/GDD PLAYTEST SCRIPT/)
    expect(script).toMatch(/\[x\] First 30 min/)
    expect(script).toMatch(/\[x\] First Rebuild/)
    expect(script).toMatch(/\[x\] One Furnace push/)
    expect(script).toMatch(/\[x\] One Challenge/)
    expect(script).toMatch(/\[ \] W1000 finale/)
    expect(telemetry).toMatch(/LAST SORTIE/)
    expect(telemetry).toMatch(/Seed: 17/)
    expect(telemetry).toMatch(/Start Best: W4/)
    expect(telemetry).toMatch(/End Wave: W8/)
    expect(telemetry).toMatch(/Attack share/)
    expect(report).toMatch(/Highest Wave: 10/)
    expect(report).not.toMatch(LEFTOVER)
    expect(report).not.toMatch(/FRONTIER HISTORY/)
    expect(report).not.toMatch(/Echo attempts/)
  })

  it('keeps Worker jobs industrial', () => {
    expect(WORKER_JOB_IDS).not.toContain('strike')
    expect(WORKER_JOB_IDS).not.toContain('ward')
    expect(WORKER_JOB_IDS).toContain('scrap-field')
  })
})
