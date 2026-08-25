import { describe, expect, it } from 'vitest'
import { canEnterProtocol } from './protocols'
import { NETWORK_BARS } from './network'
import { ACHIEVEMENTS, isSystemUnlocked } from './progression'
import { exportSave, importSave } from './save'
import { createInitialState, SAVE_VERSION } from './state'
import { careerBestWave } from './waves'
import { normalizeRoute, routeDangerMult, routeSalvageMult, isRouteBUnlocked } from './sectors'
import { atCareerWave } from './testHelpers'

describe('GDD Act 1 leftover gates and hydrate', () => {
  it('bumps SAVE_VERSION so leftover route and Best Wave hydrate', () => {
    expect(SAVE_VERSION).toBe(41)
  })

  it('forces Route A and ignores leftover Route B multipliers', () => {
    expect(normalizeRoute('B')).toBe('A')
    expect(normalizeRoute('A')).toBe('A')
    expect(isRouteBUnlocked(999)).toBe(false)
    expect(routeDangerMult('B')).toBe(1)
    expect(routeSalvageMult('B')).toBe(1)
  })

  it('reads leftover 10-wave bands as career Best Wave', () => {
    const s = createInitialState(0)
    s.meta.bestWave = 0
    s.combat.bestWave = 0
    s.meta.highestSectorEver = 7
    s.combat.highestSector = 7
    expect(careerBestWave(s)).toBe(70)
    expect(isSystemUnlocked(s, 'foundry')).toBe(true)
    expect(isSystemUnlocked(s, 'furnace')).toBe(false)
  })

  it('hydrates a version-40 Route B save onto Route A and backfills Best Wave', () => {
    const raw = createInitialState(0)
    raw.version = 40
    raw.combat.route = 'B'
    raw.meta.bestWave = 0
    raw.combat.bestWave = 0
    raw.meta.highestSectorEver = 7
    raw.combat.highestSector = 7
    const back = importSave(exportSave(raw))
    expect(back).toBeTruthy()
    expect(back!.version).toBe(41)
    expect(back!.combat.route).toBe('A')
    expect(careerBestWave(back!)).toBe(70)
    expect(back!.meta.bestWave).toBe(70)
    expect(back!.combat.bestWave).toBe(70)
    expect(back!.echo.activeId).toBeNull()
  })

  it('does not block Challenges with leftover Echo state', () => {
    const s = atCareerWave(createInitialState(0), 250)
    s.prestige.prestigeCount = 2
    s.hiveResearch.completed.energy = 1
    s.combat.docked = true
    s.echo.activeId = 'rift'
    const check = canEnterProtocol(s, 'glass-ward')
    expect(check.reason).not.toMatch(/Echo/)
  })

  it('does not gate leftover Network bars on NETWORK_CADENCE', () => {
    expect(NETWORK_BARS.every((bar) => bar.requiresBestWave === 0)).toBe(true)
  })

  it('keeps Echo Mapped and deferred systems out of live achievements and doors', () => {
    expect(ACHIEVEMENTS.some((row) => row.id === 'echo-clear')).toBe(false)
    const open = atCareerWave(createInitialState(0), 300)
    open.meta.act1Cleared = true
    expect(isSystemUnlocked(open, 'echo')).toBe(false)
    expect(isSystemUnlocked(open, 'specialists')).toBe(false)
    expect(isSystemUnlocked(open, 'tasks')).toBe(false)
    expect(isSystemUnlocked(open, 'capital')).toBe(false)
  })
})
