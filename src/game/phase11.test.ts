import { describe, expect, it } from 'vitest'
import { createInitialState, SAVE_VERSION } from './state'
import { buyProcessNode, buyRunUpgrade, convertAshToHeat } from './actions'
import { setDocked, advanceSeconds } from './tick'
import { getModule } from './catalog'
import { isFoundryRecipeUnlocked, foundrySlotCount, FOUNDRY_MAX_SLOTS } from './foundry'
import { FOUNDRY_FACILITIES } from './foundryCatalogue'
import { unlockedFoundryLogs, FOUNDRY_LOGS } from './logs'
import { getEchoRun, getEchoNode } from './echo'
import { PROCESS_NODES } from './process'
import { clearSector } from './testHelpers'
import { HIVE_RESEARCH_NODES_PER_BRANCH, HIVE_RESEARCH_NODES } from './hiveResearch'
import { RELIC_FAMILIES } from './relicCatalogue'

describe('phase 11: run summary, logs, depth, Hiveworks name', () => {
  it('bumps save to 45', () => {
    expect(SAVE_VERSION).toBe(49)
  })

  it('records Defeat salvage, spend, and wave on the Dock summary', () => {
    let s = createInitialState(0)
    s = setDocked(s, false)
    s.resources.salvage = 40
    s = buyRunUpgrade(s, 'weapon-power')
    const spent = 40 - s.resources.salvage
    expect(spent).toBeGreaterThan(0)
    s = clearSector(s)
    const flag = s.combat.playerUnits.find((u) => u.isFlagship)
    if (flag) flag.hull = 0
    s.combat.playerHull = 0
    advanceSeconds(s, 2)
    expect(s.combat.lastSortie.outcome).toBe('defeat')
    expect(s.combat.lastSortie.sectorsCleared).toBeGreaterThanOrEqual(1)
    expect(s.combat.lastSortie.salvageSpent).toBe(spent)
    expect(s.combat.lastSortie.salvageGained).toBeGreaterThan(0)
    expect(s.combat.sortieMark).toBeNull()
    expect(s.combat.docked).toBe(true)
    expect(s.resources.salvage).toBe(0)
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

  it('keeps Crown Matrix locked until the recipe is authored', () => {
    const s = createInitialState(0)
    s.meta.bestWave = 900
    s.combat.bestWave = 900
    expect(isFoundryRecipeUnlocked(s, 'crown-matrix')).toBe(false)
    expect(isFoundryRecipeUnlocked(s, 'recovered-stock')).toBe(true)
    expect(FOUNDRY_MAX_SLOTS).toBe(5)
    expect(foundrySlotCount(s)).toBe(1)
  })

  it('keeps Yield Link off the battlefield', () => {
    const bay = getModule('drone-bay')
    expect(bay?.name).toBe('Yield Link')
    expect(bay?.escorts ?? 0).toBe(0)
    expect(bay?.salvageKillBonus).toBeGreaterThan(0)
  })

  it('adds Ash Bank, Silent Stack, extra shards, Foundry infrastructure, and research nodes', () => {
    expect(PROCESS_NODES.some((n) => n.id === 'auto-bank')).toBe(true)
    expect(PROCESS_NODES.some((n) => n.id === 'smart-smelt')).toBe(true)
    expect(PROCESS_NODES.some((n) => n.id === 'auto-extract')).toBe(true)
    expect(PROCESS_NODES.some((n) => n.id === 'combat-tempo')).toBe(false)
    expect(getEchoRun('stack')?.requiresId).toBe('veil')
    expect(getEchoNode('echo-hold')?.requiresId).toBe('echo-yield')
    expect(RELIC_FAMILIES.some((row) => row.id === 'salvage-matrix')).toBe(true)
    expect(FOUNDRY_FACILITIES.some((b) => b.id === 'recovery-storage')).toBe(true)
    expect(HIVE_RESEARCH_NODES_PER_BRANCH).toBeGreaterThanOrEqual(6)
    expect(HIVE_RESEARCH_NODES.material.length).toBeGreaterThanOrEqual(6)
  })

  it('Ash Bank does not auto-convert Choir-ash; converting Ash is a Sortie decision', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 28
    s.resources.aiPoints = 20
    s.meta.aiUnlocked = true
    s = buyProcessNode(s, 'auto-bank')
    s.resources.choirAsh = 25
    const before = s.resources.heat ?? 0
    advanceSeconds(s, 1)
    expect(s.resources.heat).toBe(before)
    expect(s.resources.choirAsh).toBe(25)
    const again = convertAshToHeat(s)
    expect(again.resources.choirAsh).toBe(s.resources.choirAsh)
  })
})
