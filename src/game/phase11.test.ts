import { describe, expect, it } from 'vitest'
import { createInitialState, SAVE_VERSION } from './state'
import { buyProcessNode, convertAshToHeat, upgradeModule } from './actions'
import { setDocked, advanceSeconds } from './tick'
import { getModule } from './catalog'
import { isFoundryRecipeUnlocked, foundrySlotCount, FOUNDRY_MAX_SLOTS } from './foundry'
import { unlockedFoundryLogs, FOUNDRY_LOGS } from './logs'
import { getEchoRun, getEchoNode } from './echo'
import { PROCESS_NODES } from './process'
import { clearSector } from './testHelpers'
import { HIVE_RESEARCH_NODES_PER_BRANCH, HIVE_RESEARCH_NODES } from './hiveResearch'
import { SHARDS } from './reliquary'
import { YARD_BUILDINGS } from './yard'

describe('phase 11: run summary, logs, depth, Hiveworks name', () => {
  it('bumps save to 31', () => {
    expect(SAVE_VERSION).toBe(31)
  })

  it('records Extract salvage, spend, and sectors on the Dock summary', () => {
    let s = createInitialState(0)
    s.resources.salvage = 40
    s = setDocked(s, false)
    s = upgradeModule(s, 'pulse-cannon')
    const spent = 40 - s.resources.salvage
    expect(spent).toBeGreaterThan(0)
    s = clearSector(s)
    s = setDocked(s, true)
    expect(s.combat.lastSortie.outcome).toBe('extract')
    expect(s.combat.lastSortie.sectorsCleared).toBeGreaterThanOrEqual(1)
    expect(s.combat.lastSortie.salvageSpent).toBe(spent)
    expect(s.combat.lastSortie.salvageGained).toBeGreaterThan(0)
    expect(s.combat.sortieMark).toBeNull()
  })

  it('unlocks story logs with doors and the first wreck', () => {
    const fresh = createInitialState(0)
    const ids = unlockedFoundryLogs(fresh).map((l) => l.id)
    expect(ids).toContain('dock')
    expect(ids).toContain('network')
    expect(ids).not.toContain('boss-1')
    expect(ids).not.toContain('capital')
    fresh.meta.highestSectorEver = 1
    expect(unlockedFoundryLogs(fresh).some((l) => l.id === 'boss-1')).toBe(true)
    expect(FOUNDRY_LOGS.length).toBeGreaterThan(12)
  })

  it('opens Choir Flux at 8 and a fourth smelter slot', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 8
    s.combat.highestSector = 8
    expect(isFoundryRecipeUnlocked(s, 'choir-flux')).toBe(true)
    expect(isFoundryRecipeUnlocked(s, 'keel-strip')).toBe(false)
    expect(FOUNDRY_MAX_SLOTS).toBe(4)
    s.foundry.upgrades['fp-slot'] = 1
    s.foundry.upgrades['fp-slot-2'] = 1
    s.foundry.upgrades['fp-slot-3'] = 1
    expect(foundrySlotCount(s)).toBe(4)
  })

  it('keeps Yield Link off the battlefield', () => {
    const bay = getModule('drone-bay')
    expect(bay?.name).toBe('Yield Link')
    expect(bay?.escorts ?? 0).toBe(0)
    expect(bay?.salvageKillBonus).toBeGreaterThan(0)
  })

  it('adds Ash Bank, Silent Stack, extra shards, Yard sieve, and research nodes', () => {
    expect(PROCESS_NODES.some((n) => n.id === 'auto-bank')).toBe(true)
    expect(getEchoRun('stack')?.requiresId).toBe('veil')
    expect(getEchoNode('echo-hold')?.requiresId).toBe('echo-yield')
    expect(SHARDS.some((s) => s.id === 'loom-chip')).toBe(true)
    expect(YARD_BUILDINGS.some((b) => b.id === 'choir-sieve')).toBe(true)
    expect(HIVE_RESEARCH_NODES_PER_BRANCH).toBe(6)
    expect(HIVE_RESEARCH_NODES.material).toHaveLength(6)
  })

  it('Ash Bank converts Choir-ash without a tap', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 5
    s.combat.highestSector = 5
    s.resources.aiPoints = 20
    s.meta.aiUnlocked = true
    s = buyProcessNode(s, 'network-balance')
    s = buyProcessNode(s, 'auto-bank')
    s.resources.choirAsh = 25
    const before = s.resources.heat ?? 0
    advanceSeconds(s, 1)
    expect(s.resources.heat).toBeGreaterThan(before)
    expect(s.resources.choirAsh).toBeLessThan(25)
    const again = convertAshToHeat(s)
    expect(again.resources.choirAsh).toBe(s.resources.choirAsh)
  })
})
