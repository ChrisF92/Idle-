import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach } from 'vitest'
import { createInitialState, SAVE_VERSION } from './state'
import { exportSave, importSave } from './save'
import {
  PLAYTEST_MAX_EVENTS,
  addPlaytime,
  buildPlaytestReport,
  exportPlaytestJson,
  formatPlaytimeMs,
  hydratePlaytest,
  longestProgressionStall,
  noteAssembledCore,
  noteHighestSector,
  noteSessionEnd,
  noteSessionStart,
  playtestUsesNetwork,
  recordPlaytest,
} from './playtest'
import {
  buildSortieDiagnostic,
  classifyPressure,
  emptySortieRunStats,
  hydrateSortieRunStats,
  noteSortieIncoming,
  noteSortieOutgoing,
  possibleImprovements,
  primaryThreat,
} from './sortieTelemetry'
import { captureSortieMark, closeSortie } from './sortieSummary'
import { setDocked, startCombat, tickGame } from './tick'
import { assembleBlueprint, fitModule, performRebuild, selectFrame, setSectorRoute, upgradeModule } from './actions'
import { markHullLost } from './testHelpers'
import { SortieReport } from '../components/SortieReport'
import type { SortieRunStats } from './types'
import { applyDevAction } from './dev'
import { PlaytestReport } from '../components/PlaytestReport'
import { DevTools } from '../components/DevTools'

afterEach(cleanup)

function stats(partial: Partial<SortieRunStats>): SortieRunStats {
  return { ...emptySortieRunStats(), ...partial }
}

describe('local playtest log', () => {
  it('records compact events without network I/O', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const s = createInitialState(0)
    noteSessionStart(s, 0)
    recordPlaytest(s, 'first_launch', { firstKey: 'launch' })
    addPlaytime(s, 12_340)
    noteHighestSector(s, 5)
    expect(playtestUsesNetwork()).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(s.playtest.events.some((e) => e.k === 'session_start')).toBe(true)
    expect(s.playtest.events.some((e) => e.k === 'first_launch')).toBe(true)
    expect(s.playtest.firsts.launch).toBe(0)
    expect(s.playtest.firsts['sector:5']).toBe(12_340)
    fetchSpy.mockRestore()
  })

  it('deduplicates first-events', () => {
    const s = createInitialState(0)
    expect(recordPlaytest(s, 'first_kill', { firstKey: 'kill' })).toBe(true)
    expect(recordPlaytest(s, 'first_kill', { firstKey: 'kill' })).toBe(false)
    expect(s.playtest.events.filter((e) => e.k === 'first_kill')).toHaveLength(1)
  })

  it('caps the event ring so the log stays compact', () => {
    const s = createInitialState(0)
    for (let i = 0; i < PLAYTEST_MAX_EVENTS + 80; i++) {
      recordPlaytest(s, 'hold', { n: 'advance', v: i })
    }
    expect(s.playtest.events.length).toBe(PLAYTEST_MAX_EVENTS)
    const json = exportPlaytestJson(s)
    expect(json.length).toBeLessThan(120_000)
  })

  it('persists playtime and events across save/load', () => {
    const s = createInitialState(1_000)
    noteSessionStart(s, 1_000)
    recordPlaytest(s, 'first_launch', { firstKey: 'launch' })
    addPlaytime(s, 45_000)
    noteHighestSector(s, 3)
    noteSessionEnd(s)
    const loaded = importSave(exportSave(s))
    expect(loaded).toBeTruthy()
    expect(loaded!.playtest.playtimeMs).toBe(45_000)
    expect(loaded!.playtest.firsts.launch).toBe(0)
    expect(loaded!.playtest.events.some((e) => e.k === 'session_end')).toBe(true)
    expect(loaded!.version).toBe(SAVE_VERSION)
  })

  it('hydrates missing playtest data on old saves', () => {
    const s = createInitialState(0)
    const raw = JSON.parse(JSON.stringify(s)) as { playtest?: unknown; combat: { lastSortie: { stats?: unknown } } }
    delete raw.playtest
    delete raw.combat.lastSortie.stats
    const loaded = importSave(btoa(unescape(encodeURIComponent(JSON.stringify(raw)))))
    expect(loaded?.playtest).toBeTruthy()
    expect(loaded?.playtest.events).toEqual([])
    expect(loaded?.combat.lastSortie.stats.damageDealt).toBe(0)
    expect(hydratePlaytest(undefined).v).toBe(1)
    expect(hydrateSortieRunStats(undefined).kills).toBe(0)
  })

  it('formats timing and stall windows for the playtest report', () => {
    expect(formatPlaytimeMs(12 * 60_000 + 34_000)).toBe('12m 34s')
    expect(formatPlaytimeMs(8 * 60_000 + 22_000, 'clock')).toBe('08:22')
    const s = createInitialState(0)
    addPlaytime(s, 8 * 60_000 + 22_000)
    noteHighestSector(s, 5)
    addPlaytime(s, 6 * 60_000)
    noteHighestSector(s, 10)
    addPlaytime(s, 8 * 60_000 + 42_000)
    const stall = longestProgressionStall(s)
    expect(stall?.from).toBe(10)
    expect(stall?.to).toBe(11)
    expect(formatPlaytimeMs(stall!.ms)).toBe('8m 42s')
    const report = buildPlaytestReport(s)
    expect(report).toMatch(/PLAYTEST REPORT/)
    expect(report).toMatch(/S5/)
    expect(report).toMatch(/Longest progression stall/)
    expect(exportPlaytestJson(s)).toMatch(/"events"/)
  })

  it('logs rebuild, route, and assembled cores from game actions', () => {
    let s = markHullLost(createInitialState(0))
    s.combat.sector = 12
    s.combat.highestSector = 12
    s.meta.highestSectorEver = 12
    s.resources.salvage = 40
    s = upgradeModule(s, 'pulse-cannon')
    expect(s.playtest.events.some((e) => e.k === 'core_buy')).toBe(true)
    s = setSectorRoute(s, 'A')
    s.shipyard.unlockedModules = [...s.shipyard.unlockedModules, 'heavy-lance']
    s.shipyard.unlockedFrames = [...s.shipyard.unlockedFrames, 'line-frame']
    s = selectFrame(s, 'line-frame')
    s = fitModule(s, 'heavy-lance')
    expect(s.playtest.events.some((e) => e.k === 'core_fitted' && e.n === 'Heavy Lance')).toBe(true)
    s.meta.discoveredModules = [...s.meta.discoveredModules, 'flak-array']
    noteAssembledCore(s, 'Flak Array')
    s = performRebuild(s, { frameId: s.shipyard.frameId, modules: s.shipyard.modules })
    expect(s.playtest.events.some((e) => e.k === 'rebuild')).toBe(true)
    expect(s.playtest.firsts.rebuild).toBeDefined()
    expect(s.playtest.cores).toContain('Flak Array')
  })
})

describe('sortie counters and pressure', () => {
  it('accumulates run counters without per-frame history', () => {
    let s = createInitialState(0)
    s = setDocked(s, false)
    s.combat.sortieMark = captureSortieMark(s)
    noteSortieOutgoing(s, 40)
    noteSortieIncoming(s, 12, { shieldBefore: 20, shieldAfter: 8, role: 'sniper' })
    noteSortieIncoming(s, 8, { shieldBefore: 8, shieldAfter: 0, role: 'sniper' })
    expect(s.combat.sortieMark.stats.damageDealt).toBe(40)
    expect(s.combat.sortieMark.stats.damageTaken).toBe(20)
    expect(s.combat.sortieMark.stats.shieldBreaks).toBe(1)
    expect(s.combat.sortieMark.stats.takenByRole.sniper).toBe(20)
    closeSortie(s, 'defeat', 'test', { sector: 14, wave: 3 })
    expect(s.combat.lastSortie.stats.damageDealt).toBe(40)
  })

  it('samples enemy counts during a live fight', () => {
    let s = createInitialState(0)
    s = setDocked(s, false)
    s = startCombat(s)
    expect(s.combat.sortieMark?.stats.enemyCountSamples).toBeGreaterThan(0)
    s = tickGame(s, s.lastTickAt + 2500)
    const statsNow = s.combat.sortieMark?.stats ?? s.combat.lastSortie.stats
    expect(statsNow.enemyCountMax).toBeGreaterThan(0)
  })

  it('classifies survivability, damage, mixed, and healthy pressure', () => {
    expect(
      classifyPressure(
        stats({
          finalFightTime: 8,
          shieldBreaks: 4,
          damageDealt: 200,
          finalEnemyHp: 20,
          finalEnemyHpMax: 100,
        }),
        'defeat',
      ),
    ).toBe('SURVIVABILITY')
    expect(
      classifyPressure(
        stats({
          finalFightTime: 28,
          shieldBreaks: 0,
          damageDealt: 40,
          finalEnemyHp: 70,
          finalEnemyHpMax: 100,
        }),
        'defeat',
      ),
    ).toBe('DAMAGE')
    expect(
      classifyPressure(
        stats({
          finalFightTime: 24,
          shieldBreaks: 4,
          damageDealt: 50,
          finalEnemyHp: 55,
          finalEnemyHpMax: 100,
        }),
        'defeat',
      ),
    ).toBe('MIXED')
    expect(classifyPressure(stats({ playerHp: 8, playerHpMax: 40 }), 'extract')).toBe('HEALTHY')
  })

  it('names a threat only when one role dominates measured damage', () => {
    expect(
      primaryThreat(
        stats({
          takenByRole: { sniper: 80, fighter: 10 },
        }),
      ),
    ).toBe('Sniper volleys')
    expect(
      primaryThreat(
        stats({
          takenByRole: { sniper: 20, juggernaut: 19 },
        }),
      ),
    ).toBeNull()
    expect(
      primaryThreat(
        stats({
          lastEnemyName: 'Throne Husk',
          takenByRole: { boss: 90 },
        }),
      ),
    ).toBe('Throne Husk')
  })

  it('suggests only unlocked systems and never claims an optimal build', () => {
    const s = markHullLost(createInitialState(0))
    s.shipyard.moduleLevels['pulse-cannon'] = 1
    const names = possibleImprovements(s, 'SURVIVABILITY')
    expect(names).toContain('Plate')
    expect(names).toContain('Ward')
    expect(names.join(' ')).not.toMatch(/Furnace/)
    expect(names.join(' ')).not.toMatch(/Gunner|Broadside|Bulkhead/)
    const text = buildSortieDiagnostic(
      {
        ...s.combat.lastSortie,
        outcome: 'defeat',
        sector: 14,
        stats: stats({
          finalFightTime: 28,
          shieldBreaks: 4,
          lastIsBoss: true,
          finalEnemyHp: 31,
          finalEnemyHpMax: 100,
          takenByRole: { sniper: 50 },
        }),
      },
      s,
    )
    expect(text.title).toMatch(/SECTOR 14 BOSS/)
    expect(text.improvements.length).toBeGreaterThan(0)
    expect(JSON.stringify(text)).not.toMatch(/optimal/i)
  })

  it('keeps the first-defeat report simple', () => {
    const s = markHullLost(createInitialState(0))
    render(
      <SortieReport
        summary={{ ...s.combat.lastSortie, outcome: 'defeat', salvageGained: 4, sector: 1 }}
        state={s}
        onClose={() => undefined}
        onUpgradeCores={() => undefined}
      />,
    )
    expect(screen.getByText(/You reached Sector 1/)).toBeTruthy()
    expect(screen.queryByText(/Pressure/)).toBeNull()
    expect(screen.queryByText(/Possible improvements/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Upgrade Cores' })).toBeTruthy()
  })

  it('shows diagnosis after the first-defeat lesson', () => {
    const s = markHullLost(createInitialState(0))
    s.shipyard.moduleLevels['pulse-cannon'] = 2
    s.shipyard.moduleLevels['plate-layer'] = 1
    s.combat.lastSortie = {
      ...s.combat.lastSortie,
      outcome: 'defeat',
      sector: 14,
      wave: 5,
      note: 'Hull lost in sector 14.',
      stats: stats({
        finalFightTime: 28,
        shieldBreaks: 4,
        lastIsBoss: true,
        finalEnemyHp: 31,
        finalEnemyHpMax: 100,
        damageDealt: 80,
        damageTaken: 120,
        takenByRole: { sniper: 80 },
      }),
    }
    render(<SortieReport summary={s.combat.lastSortie} state={s} onClose={() => undefined} />)
    expect(screen.getByText(/REPELLED — SECTOR 14 BOSS/)).toBeTruthy()
    expect(screen.getByText(/Boss HP remaining: 31%/)).toBeTruthy()
    expect(screen.getByText(/Pressure:/)).toBeTruthy()
    expect(screen.getByText(/Possible improvements/)).toBeTruthy()
    expect(screen.queryByText(/optimal/i)).toBeNull()
  })
})

describe('debug export', () => {
  it('opens the playtest report from enabled dev tools', () => {
    const s = createInitialState(0)
    noteSessionStart(s, 0)
    addPlaytime(s, 47 * 60_000 + 13_000)
    render(<DevTools state={s} onDevAction={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Playtest report' }))
    expect(screen.getByRole('dialog', { name: 'Playtest report' })).toBeTruthy()
    expect(screen.getByText(/PLAYTEST REPORT/)).toBeTruthy()
    expect(screen.getByText(/Raw JSON/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' }))
  })

  it('renders copyable JSON in the report sheet', () => {
    const s = createInitialState(0)
    render(<PlaytestReport state={s} onClose={() => undefined} />)
    expect(screen.getByRole('dialog', { name: 'Playtest report' })).toBeTruthy()
    const json = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(json.value).toMatch(/"v": 1/)
  })
})

describe('dev jumps still record sector evidence', () => {
  it('stamps a new highest sector from a jump', () => {
    let s = createInitialState(0)
    s = applyDevAction(s, { type: 'jump-sector', sector: 10 })
    expect(s.playtest.firsts['sector:9']).toBeDefined()
    expect(s.playtest.sectorAt).toBe(9)
  })
})

describe('assembleBlueprint stays first-only for starter cores', () => {
  it('does not treat Pulse as a new assembled Core', () => {
    const s = createInitialState(0)
    expect(assembleBlueprint(s, 'pulse-cannon')).toBe(s)
    expect(s.playtest.cores).toEqual([])
  })
})
