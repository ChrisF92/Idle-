import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  buyCoreRunSlot,
  buyMaxCores,
  buyProcessNode,
  fitModule,
  performRebuild,
  upgradeModule,
} from './actions'
import { importSave, exportSave } from './save'
import { setDocked } from './tick'
import { armRebuildDoor, forceUnlockModule, markHullLost } from './testHelpers'
import {
  CORE_RUN_LEVEL_CAP,
  applyMasteryXp,
  awardEquippedMasteryXp,
  corePrimaryOutput,
  coreRunCategory,
  coreRunLevel,
  coreRunUpgradeCost,
  legacyRankToMastery,
  masteryFrontierMult,
  masteryWaveXp,
  maxAffordableCoreRunPurchases,
  migrateLegacyCoreProgression,
  moduleCopyCount,
} from './coreProgression'
import { moduleMasteryRank } from './catalog'

function live(state = createInitialState(0)) {
  return setDocked(state, false)
}

describe('Core Run Levels', () => {
  it('starts every Sortie at Run Lv0', () => {
    const s = live()
    expect(coreRunLevel(s, 0)).toBe(0)
    expect(s.combat.coreRunLevels ?? {}).toEqual({})
  })

  it('purchases with Salvage and raises that slot only', () => {
    let s = live()
    s.resources.salvage = 80
    const cost = coreRunUpgradeCost(0, 'pulse-cannon')
    const before = computeShipStats(s).damage
    s = buyCoreRunSlot(s, 0, 1)
    expect(coreRunLevel(s, 0)).toBe(1)
    expect(s.resources.salvage).toBe(80 - cost)
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)
    expect(computeShipStats(s).damage).toBeGreaterThan(before)
  })

  it('refuses Dock Scrap ranking', () => {
    let s = createInitialState(0)
    s.combat.docked = true
    s.resources.scrap = 80
    s.resources.salvage = 80
    s = upgradeModule(s, 'pulse-cannon')
    expect(coreRunLevel(s, 0)).toBe(0)
    expect(s.resources.scrap).toBe(80)
    expect(s.resources.salvage).toBe(80)
  })

  it('keeps duplicate Pulse instances on separate Run ladders', () => {
    let s = live()
    s = forceUnlockModule(s, 'pulse-cannon')
    s.shipyard.moduleCopies = { 'pulse-cannon': 2 }
    s.shipyard.modules = ['pulse-cannon', 'pulse-cannon']
    s.resources.salvage = 200
    s = buyCoreRunSlot(s, 0, 3)
    s = buyCoreRunSlot(s, 1, 1)
    expect(coreRunLevel(s, 0)).toBe(3)
    expect(coreRunLevel(s, 1)).toBe(1)
    expect(moduleMasteryRank(s, 'pulse-cannon')).toBe(0)
  })

  it('costs from the slot Run Level, not Mastery', () => {
    const s = live()
    s.meta.moduleMastery = { 'pulse-cannon': 40 }
    expect(coreRunUpgradeCost(coreRunLevel(s, 0), 'pulse-cannon')).toBe(coreRunUpgradeCost(0, 'pulse-cannon'))
    s.combat.coreRunLevels = { '0': 5 }
    expect(coreRunUpgradeCost(coreRunLevel(s, 0), 'pulse-cannon')).toBe(coreRunUpgradeCost(5, 'pulse-cannon'))
  })

  it('×10 and MAX follow the temporary ladder', () => {
    let s = live()
    s.resources.salvage = 10_000
    s = buyCoreRunSlot(s, 0, 10)
    expect(coreRunLevel(s, 0)).toBe(10)
    const bank = s.resources.salvage
    const max = maxAffordableCoreRunPurchases(s, 0)
    expect(max).toBeGreaterThan(1)
    s = buyCoreRunSlot(s, 0, Number.POSITIVE_INFINITY)
    expect(coreRunLevel(s, 0)).toBe(10 + max)
    expect(s.resources.salvage).toBeLessThan(bank)
    expect(coreRunLevel(s, 0)).toBeLessThanOrEqual(CORE_RUN_LEVEL_CAP)
  })

  it('resets on death, Extract, and a new Sortie', () => {
    let s = live()
    s.resources.salvage = 80
    s = buyCoreRunSlot(s, 0, 2)
    expect(coreRunLevel(s, 0)).toBe(2)
    s = setDocked(s, true)
    expect(coreRunLevel(s, 0)).toBe(0)
    s = live(s)
    expect(coreRunLevel(s, 0)).toBe(0)
  })

  it('does not survive Rebuild as a cycle rank', () => {
    let s = armRebuildDoor(createInitialState(0))
    s.combat.docked = false
    s.resources.salvage = 80
    s = buyCoreRunSlot(s, 0, 2)
    s = setDocked(s, true)
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon'] })
    expect(coreRunLevel(s, 0)).toBe(0)
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)
  })

  it('saves and loads mid-Sortie Run Levels', () => {
    let s = live()
    s.resources.salvage = 80
    s = buyCoreRunSlot(s, 0, 2)
    const loaded = importSave(exportSave(s))
    expect(loaded).toBeTruthy()
    expect(coreRunLevel(loaded!, 0)).toBe(2)
  })
})

describe('Core Mastery', () => {
  it('awards equipped Cores the same baseline Wave XP', () => {
    let s = live()
    s = forceUnlockModule(s, 'plate-layer')
    s.shipyard.modules = ['pulse-cannon', 'plate-layer']
    const grants = awardEquippedMasteryXp(s, 12, {
      boss: false,
      newBest: false,
      careerBestBefore: 20,
    })
    expect(grants.map((g) => g.moduleId).sort()).toEqual(['plate-layer', 'pulse-cannon'])
    expect(grants[0]!.xp).toBe(grants[1]!.xp)
    expect(s.meta.moduleMasteryXp['pulse-cannon']).toBeGreaterThan(0)
  })

  it('does not award unequipped Cores', () => {
    const s = live()
    s.shipyard.unlockedModules = ['pulse-cannon', 'plate-layer']
    s.shipyard.modules = ['pulse-cannon']
    awardEquippedMasteryXp(s, 8, { boss: false, newBest: false, careerBestBefore: 8 })
    expect(s.meta.moduleMasteryXp['pulse-cannon'] ?? 0).toBeGreaterThan(0)
    expect(s.meta.moduleMasteryXp['plate-layer'] ?? 0).toBe(0)
  })

  it('pays more for later Waves, bosses, and new Bests', () => {
    const early = masteryWaveXp({ wave: 2, careerBestBefore: 40 })
    const late = masteryWaveXp({ wave: 36, careerBestBefore: 40 })
    const boss = masteryWaveXp({ wave: 36, careerBestBefore: 40, boss: true })
    const best = masteryWaveXp({ wave: 41, careerBestBefore: 40, newBest: true })
    expect(late).toBeGreaterThan(early)
    expect(boss).toBeGreaterThan(late)
    expect(best).toBeGreaterThan(late)
    expect(masteryFrontierMult(2, 40)).toBeLessThan(masteryFrontierMult(38, 40))
  })

  it('levels Mastery from XP and keeps authored milestones', () => {
    const s = createInitialState(0)
    const grant = applyMasteryXp(s, 'pulse-cannon', 10_000)
    expect(grant.to).toBeGreaterThan(grant.from)
    expect(moduleMasteryRank(s, 'pulse-cannon')).toBe(grant.to)
    expect(s.meta.moduleMasteryXp['pulse-cannon']).toBeGreaterThanOrEqual(0)
  })

  it('persists through Extract and Rebuild', () => {
    let s = live()
    applyMasteryXp(s, 'pulse-cannon', 400)
    const mastery = moduleMasteryRank(s, 'pulse-cannon')
    const xp = s.meta.moduleMasteryXp['pulse-cannon']
    s = setDocked(s, true)
    expect(moduleMasteryRank(s, 'pulse-cannon')).toBe(mastery)
    s = armRebuildDoor(s)
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon'] })
    expect(moduleMasteryRank(s, 'pulse-cannon')).toBe(mastery)
    expect(s.meta.moduleMasteryXp['pulse-cannon']).toBe(xp)
  })

  it('shares Mastery across duplicate copies', () => {
    const s = live()
    s.shipyard.moduleCopies = { 'pulse-cannon': 2 }
    s.shipyard.modules = ['pulse-cannon', 'pulse-cannon']
    awardEquippedMasteryXp(s, 10, { boss: true, newBest: true, careerBestBefore: 8 })
    expect(s.combat.coreMasteryXp['pulse-cannon']).toBeGreaterThan(0)
    expect(Object.keys(s.combat.coreMasteryXp ?? {}).filter((id) => id === 'pulse-cannon')).toHaveLength(1)
  })
})

describe('Core stat composition', () => {
  it('combines Mastery, Run Level, and global Sortie upgrades without old Scrap ranks', () => {
    let s = live()
    s.shipyard.moduleLevels = { 'pulse-cannon': 40 }
    const leftover = computeShipStats(s).damage
    s.shipyard.moduleLevels = {}
    expect(computeShipStats(s).damage).toBe(leftover)

    applyMasteryXp(s, 'pulse-cannon', 2000)
    const mastered = computeShipStats(s).damage
    expect(mastered).toBeGreaterThan(leftover)

    s.resources.salvage = 400
    s = buyCoreRunSlot(s, 0, 4)
    const run = computeShipStats(s).damage
    expect(run).toBeGreaterThan(mastered)
    const out = corePrimaryOutput(s, 0)
    expect(out?.label).toBe('DPS')
    expect(out!.next).toBeGreaterThan(out!.current)
  })
})

describe('Run purchase categories', () => {
  it('places Cores by contribution, not only permanent role', () => {
    expect(coreRunCategory('pulse-cannon')).toBe('attack')
    expect(coreRunCategory('plate-layer')).toBe('defense')
    expect(coreRunCategory('salvage-rig')).toBe('economy')
    expect(coreRunCategory('nano-lathe')).toBe('defense')
    expect(coreRunCategory('sensor-whisker')).toBe('attack')
  })
})

describe('Core Process automation', () => {
  it('Buy Max spends Salvage on Run Levels while live', () => {
    let s = live()
    s.resources.salvage = 400
    s.process.purchased = ['core-buy-max']
    s = buyMaxCores(s)
    expect(coreRunLevel(s, 0)).toBeGreaterThan(0)
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)
  })

  it('does not Buy Max at Dock', () => {
    let s = createInitialState(0)
    s.combat.docked = true
    s.resources.salvage = 400
    s.resources.scrap = 400
    s.process.purchased = ['core-buy-max']
    s = buyMaxCores(s)
    expect(coreRunLevel(s, 0)).toBe(0)
  })

  it('still gates Core Buy Max behind practised Core work', () => {
    const s = markHullLost(createInitialState(0))
    s.meta.aiUnlocked = true
    s.meta.highestSectorEver = 42
    s.combat.highestSector = 42
    s.prestige.prestigeCount = 2
    s.resources.aiPoints = 20
    expect(buyProcessNode(s, 'core-buy-max')).toBe(s)
    s.meta.lifetimeCoreRunBuys = 2
    expect(buyProcessNode(s, 'core-buy-max')).not.toBe(s)
  })
})

describe('legacy Core rank migration', () => {
  it('converts leftover Scrap ranks into bounded Mastery and starts Run Lv0', () => {
    const s = createInitialState(0)
    s.meta.coreProgressionMigrated = false
    s.shipyard.moduleLevels = { 'pulse-cannon': 12, 'plate-layer': 8 }
    s.workshop.coreStarts = { 'pulse-cannon': 12 }
    s.combat.docked = false
    migrateLegacyCoreProgression(s)
    expect(s.meta.coreProgressionMigrated).toBe(true)
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)
    expect(moduleMasteryRank(s, 'pulse-cannon')).toBeGreaterThan(0)
    expect(moduleMasteryRank(s, 'pulse-cannon')).toBeLessThanOrEqual(18)
    expect(coreRunLevel(s, 0)).toBe(0)
    const mapped = legacyRankToMastery(80)
    expect(mapped.level).toBeLessThanOrEqual(18)
  })

  it('keeps duplicate copies on one Mastery track after hydration', () => {
    let s = createInitialState(0)
    s.shipyard.unlockedFrames = [...s.shipyard.unlockedFrames, 'swarm-frame']
    s.shipyard.frameId = 'swarm-frame'
    s.shipyard.unlockedModules = ['pulse-cannon']
    s.shipyard.moduleCopies = { 'pulse-cannon': 2 }
    s.shipyard.modules = ['pulse-cannon']
    s = fitModule(s, 'pulse-cannon')
    expect(s.shipyard.modules.filter((id) => id === 'pulse-cannon')).toHaveLength(2)
    expect(moduleCopyCount(s, 'pulse-cannon')).toBe(2)
  })
})
