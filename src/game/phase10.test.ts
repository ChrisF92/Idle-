import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState, SAVE_VERSION } from './state'
import { performRebuild, performReinforce, rankCapital } from './actions'
import { applyDevAction } from './dev'
import { getFrame } from './catalog'
import { GUIDE_STEPS, isSystemUnlocked, maybeGrantSystemUnlocks } from './progression'
import { TASK_UNLOCK_SECTOR, taskListComplete, taskListProgress } from './tasks'
import { CAPITAL_UNLOCK_SECTOR, capitalDamageMult, capitalRank } from './capital'
import { REINFORCE_UNLOCK_SECTOR, canReinforce, reinforceCount } from './reinforce'
import { unlockedFoundryLogs } from './logs'
import { yardGridSize, YARD_EXPAND_SECTOR_3, YARD_EXPAND_SECTOR_4, YARD_MAX_SIZE } from './yard'

function seedTasks(s: ReturnType<typeof createInitialState>) {
  s.prestige.prestigeCount = 1
  s.resources.heat = 10
  s.specialists.ranks.gunner = 1
  s.echo.clears = { rift: 1 }
  s.protocols.ranks = { 'mute-network': 1 }
}

describe('phase 10: Task List, Capital, Reinforce, logs', () => {
  it('bumps save and keeps Task List / Capital / Reinforce on USI doors', () => {
    expect(SAVE_VERSION).toBe(34)
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'tasks')).toBe(false)
    expect(isSystemUnlocked(fresh, 'capital')).toBe(false)
    expect(isSystemUnlocked(fresh, 'reinforce')).toBe(false)
    expect(isSystemUnlocked(fresh, 'logs')).toBe(true)

    fresh.meta.highestSectorEver = TASK_UNLOCK_SECTOR
    expect(isSystemUnlocked(fresh, 'tasks')).toBe(true)
    expect(isSystemUnlocked(fresh, 'capital')).toBe(false)

    seedTasks(fresh)
    fresh.meta.highestSectorEver = CAPITAL_UNLOCK_SECTOR
    fresh.combat.highestSector = CAPITAL_UNLOCK_SECTOR
    expect(taskListComplete(fresh)).toBe(true)
    expect(isSystemUnlocked(fresh, 'capital')).toBe(true)

    fresh.meta.highestSectorEver = REINFORCE_UNLOCK_SECTOR
    expect(isSystemUnlocked(fresh, 'reinforce')).toBe(true)
    expect(GUIDE_STEPS.some((s) => s.id === 'guide-tasks')).toBe(false)
  })

  it('unlocks Capital Hull at 75 only after the Task List is done', () => {
    expect(getFrame('capital-frame')?.requiresSectorEver).toBe(75)
    expect(getFrame('capital-frame')?.weaponSlots).toBe(4)
    expect(getFrame('capital-frame')?.baseHull).toBe(160)

    const blocked = createInitialState(0)
    blocked.meta.highestSectorEver = 75
    blocked.combat.highestSector = 75
    maybeGrantSystemUnlocks(blocked)
    expect(blocked.shipyard.unlockedFrames).not.toContain('capital-frame')

    seedTasks(blocked)
    maybeGrantSystemUnlocks(blocked)
    expect(blocked.shipyard.unlockedFrames).toContain('capital-frame')
  })

  it('expands Yard to 6×6 at 40 and 7×7 at 55', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = YARD_EXPAND_SECTOR_3
    expect(yardGridSize(s)).toBe(6)
    s.meta.highestSectorEver = YARD_EXPAND_SECTOR_4
    expect(yardGridSize(s)).toBe(YARD_MAX_SIZE)
  })

  it('ranks Capital Broadside and persists across Rebuild', () => {
    let s = createInitialState(0)
    seedTasks(s)
    s.meta.highestSectorEver = 75
    s.combat.highestSector = 75
    s.resources.salvage = 5000
    s.resources.heat = 800
    s.combat.sector = 75
    s.combat.docked = true
    s.shipyard.moduleLevels['pulse-cannon'] = 8
    const dmg0 = computeShipStats(s).damage
    s = rankCapital(s, 'broadside')
    expect(capitalRank(s, 'broadside')).toBe(1)
    expect(capitalDamageMult(s)).toBeCloseTo(1.04)
    expect(computeShipStats(s).damage).toBeGreaterThan(dmg0)

    s = performRebuild(s, {
      frameId: 'scout-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(capitalRank(s, 'broadside')).toBe(1)
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)
  })

  it('Reinforces at 80, increments the second prestige, and keeps Capital ranks', () => {
    let s = createInitialState(0)
    seedTasks(s)
    s.meta.highestSectorEver = 80
    s.combat.highestSector = 80
    s.combat.sector = 80
    s.combat.docked = true
    s.capital.ranks.broadside = 3
    s.shipyard.moduleLevels['pulse-cannon'] = 8
    expect(canReinforce(s).ok).toBe(true)
    s = performReinforce(s)
    expect(reinforceCount(s)).toBe(1)
    expect(capitalRank(s, 'broadside')).toBe(3)
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)
  })

  it('opens Foundry Logs as doors unlock', () => {
    const s = createInitialState(0)
    expect(unlockedFoundryLogs(s).some((l) => l.id === 'dock')).toBe(true)
    expect(unlockedFoundryLogs(s).some((l) => l.id === 'capital')).toBe(false)
    s.meta.highestSectorEver = 75
    expect(unlockedFoundryLogs(s).some((l) => l.id === 'capital')).toBe(true)
  })

  it('dev seed-late-game opens Reinforce without Capital', () => {
    let s = createInitialState(0)
    s = applyDevAction(s, { type: 'seed-late-game' })
    expect(s.meta.act1Cleared).toBe(true)
    expect(isSystemUnlocked(s, 'reinforce')).toBe(true)
    expect(isSystemUnlocked(s, 'capital')).toBe(false)
  })
})
