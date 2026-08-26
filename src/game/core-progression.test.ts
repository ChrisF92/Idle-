import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  buyCoreRunSlot,
  buyCoreStartingLevel,
  fitModule,
  performRebuild,
} from './actions'
import { importSave, exportSave } from './save'
import { extractSortie, setDocked } from './tick'
import { armRebuildDoor, forceUnlockModule } from './testHelpers'
import {
  applyMasteryXp,
  awardEquippedMasteryXp,
  corePrimaryOutput,
  coreRunLevel,
  coreStartingLevel,
  coreStartingUpgradeCost,
  masteryFrontierMult,
  masteryWaveXp,
  moduleCopyCount,
  grantModuleCopy,
} from './coreProgression'
import { moduleMasteryRank } from './catalog'

function live(state = createInitialState(0)) {
  return setDocked(state, false)
}

describe('Dock Core Levels', () => {
  it('does not sell Core upgrades during a Sortie', () => {
    let s = live()
    s.resources.salvage = 80
    const before = computeShipStats(s).damage
    s = buyCoreRunSlot(s, 0, 1)
    expect(coreRunLevel(s, 0)).toBe(0)
    expect(s.resources.salvage).toBe(80)
    expect(computeShipStats(s).damage).toBe(before)
  })

  it('buys separate physical Core levels with Scrap while sharing Mastery', () => {
    let s = createInitialState(0)
    s.shipyard.unlockedFrames.push('swarm-frame')
    s.shipyard.frameId = 'swarm-frame'
    grantModuleCopy(s, 'pulse-cannon')
    s = fitModule(s, 'pulse-cannon')
    const pulseIds = s.shipyard.modules.flatMap((moduleId, slot) =>
      moduleId === 'pulse-cannon' ? [s.shipyard.equippedCoreIds[slot]!] : [],
    )
    expect(pulseIds).toHaveLength(2)

    s.meta.moduleMastery['pulse-cannon'] = 7
    s.resources.scrap = 80
    const cost = coreStartingUpgradeCost(s, pulseIds[1]!)
    s = buyCoreStartingLevel(s, pulseIds[1]!)

    expect(coreStartingLevel(s, pulseIds[0]!)).toBe(0)
    expect(coreStartingLevel(s, pulseIds[1]!)).toBe(1)
    expect(s.resources.scrap).toBe(80 - cost)
    expect(moduleMasteryRank(s, 'pulse-cannon')).toBe(7)

    s = live(s)
    const pulseSlots = s.shipyard.modules.flatMap((moduleId, slot) =>
      moduleId === 'pulse-cannon' ? [slot] : [],
    )
    expect(corePrimaryOutput(s, pulseSlots[1]!)!.current).toBeGreaterThan(
      corePrimaryOutput(s, pulseSlots[0]!)!.current,
    )
  })

  it('does not survive Rebuild as a cycle rank', () => {
    let s = armRebuildDoor(createInitialState(0))
    s.resources.scrap = 100
    s = buyCoreStartingLevel(s, 'pulse-cannon:1')
    expect(coreStartingLevel(s, 'pulse-cannon:1')).toBe(1)
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon'] })
    expect(coreStartingLevel(s, 'pulse-cannon:1')).toBe(0)
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)
  })

  it('saves and loads cycle Core Levels', () => {
    let s = createInitialState(0)
    s.resources.scrap = 100
    s = buyCoreStartingLevel(s, 'pulse-cannon:1')
    const loaded = importSave(exportSave(s))
    expect(loaded).toBeTruthy()
    expect(coreStartingLevel(loaded!, 'pulse-cannon:1')).toBe(1)
    expect(loaded!.workshop.coreStarts['pulse-cannon:1']).toBe(1)
  })

  it('reads physical Core Levels by instance id only', () => {
    const s = createInitialState(0)
    s.workshop.coreStarts = { 'pulse-cannon': 4 }
    expect(coreStartingLevel(s, 'pulse-cannon:1')).toBe(0)
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
    const start = createInitialState(0)
    start.shipyard.unlockedModules = ['pulse-cannon', 'plate-layer']
    start.shipyard.modules = ['pulse-cannon']
    const s = live(start)
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
    s.meta.bestWave = Math.max(s.meta.bestWave ?? 0, 210)
    s.combat.bestWave = Math.max(s.combat.bestWave ?? 0, 210)
    s = extractSortie(s)
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

describe('Core stat composition', () => {
  it('combines shared Mastery and the physical copy Core Level', () => {
    let s = createInitialState(0)
    const leftover = computeShipStats(s).damage

    applyMasteryXp(s, 'pulse-cannon', 2000)
    const mastered = computeShipStats(s).damage
    expect(mastered).toBeGreaterThan(leftover)

    s.resources.scrap = 400
    s = buyCoreStartingLevel(s, 'pulse-cannon:1', 4)
    const leveled = computeShipStats(s).damage
    expect(leveled).toBeGreaterThan(mastered)
    const out = corePrimaryOutput(s, 0)
    expect(out?.label).toBe('DPS')
    expect(out!.next).toBeGreaterThan(out!.current)
  })
})
