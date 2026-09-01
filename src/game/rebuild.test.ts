import { describe, expect, it } from 'vitest'
import { buyCoreStartingLevel, buyMatterShop, buyWorkshopUpgrade, enterChallenge, performRebuild } from './actions'
import { addCoreInstance } from './coreInstances'
import { applyMasteryXp, coreStartingLevel } from './coreProgression'
import { createInitialState } from './state'
import { armRebuildDoor, atCareerWave, completeDefeat, markHullLost } from './testHelpers'
import {
  canRebuild,
  cycleBestWave,
  cycleNormalSorties,
  cycleScrapGenerated,
  grantGeneratedScrap,
  matterGainBreakdown,
  matterGainFor,
  matterScoresFrom,
  noteRebuildCycleSortie,
  rebuildDoorMet,
} from './rebuild'
import { extractSortie, setDocked } from './tick'
import { workshopLevel } from './workshop'
import { addRelicInstance } from './relics'

function docked(state = createInitialState(0)) {
  const next = markHullLost(state)
  next.combat.docked = true
  return next
}

describe('Matter formula', () => {
  it('uses the canonical wave and scrap scores', () => {
    const w210 = matterScoresFrom(210, 0)
    expect(w210.waveScore).toBe(Math.floor((210 / 25) ** 1.25))
    expect(w210.scrapScore).toBe(0)
    expect(w210.total).toBe(Math.max(1, w210.waveScore))
    const capped = matterScoresFrom(210, 1e12)
    expect(capped.scrapScore).toBe(Math.floor(capped.waveScore * 0.3))
  })

  it('is independent of banked Scrap, Workshop, Rebuild count, Ascension, and Challenge medals', () => {
    const base = armRebuildDoor(docked())
    base.prestige.cycle.scrapGenerated = 8000
    const a = structuredClone(base)
    const b = structuredClone(base)
    b.resources.scrap = 99999
    b.workshop.levels['weapon-power'] = 20
    b.prestige.prestigeCount = 50
    b.meta.ascensionCount = 9
    b.challenges = { ...b.challenges, medals: { 'glass-frame': 3 } }
    expect(matterGainFor(a)).toBe(matterGainFor(b))
    expect(matterGainBreakdown(a).cycleScrapGenerated).toBe(8000)
  })
})

describe('Rebuild gate', () => {
  it('requires W210 and 3 normal Sorties on the first cycle', () => {
    let s = atCareerWave(docked(), 209)
    s.prestige.cycle.normalSortiesCompleted = 3
    s.combat.docked = true
    expect(canRebuild(s)).toBe(false)
    s = atCareerWave(docked(), 210)
    s.prestige.cycle.normalSortiesCompleted = 2
    s.combat.docked = true
    expect(canRebuild(s)).toBe(false)
    s = armRebuildDoor(docked())
    expect(rebuildDoorMet(s)).toBe(true)
    expect(canRebuild(s)).toBe(true)
  })

  it('blocks Challenges and undocked Sorties', () => {
    const s = armRebuildDoor(docked())
    s.challenges.activeId = 'glass-frame'
    expect(canRebuild(s)).toBe(false)
    const live = structuredClone(s)
    live.challenges.activeId = null
    live.combat.docked = false
    expect(canRebuild(live)).toBe(false)
  })

  it('after the first Rebuild needs one normal Sortie even below W210', () => {
    let s = performRebuild(armRebuildDoor(docked()), {
      frameId: 'starter-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(cycleBestWave(s)).toBe(0)
    expect(canRebuild(s)).toBe(false)
    s.prestige.cycle.bestWave = 40
    s.prestige.cycle.normalSortiesCompleted = 1
    s.combat.docked = true
    expect(canRebuild(s)).toBe(true)
  })
})

describe('Rebuild reset matrix', () => {
  it('resets cycle power and preserves permanent systems', () => {
    let s = armRebuildDoor(docked())
    s.resources.scrap = 400
    s.resources.salvage = 22
    s.resources.choirAsh = 40
    s.resources.heat = 12
    s.combat.runUpgrades = { 'weapon-power': 4 }
    s = buyWorkshopUpgrade({ ...s, resources: { ...s.resources, scrap: 80 } }, 'weapon-power')
    s.resources.scrap = 400
    s.resources.prestigeMatter = 7
    s.prestige.matterShop = { 'weapon-calibration': 1 }
    s.meta.genericUpgradeUnlocks = { attack: 3, defense: 2, economy: 2 }
    s.workshop.coreStarts = { 'pulse-cannon:1': 3, 'pulse-cannon:2': 2 }
    s.shipyard.coreInstances = [
      { id: 'pulse-cannon:1', moduleId: 'pulse-cannon', targetingDoctrine: 'focus-fire' },
      { id: 'pulse-cannon:2', moduleId: 'pulse-cannon', targetingDoctrine: 'nearest' },
      { id: 'plate-layer:1', moduleId: 'plate-layer' },
    ]
    s.meta.moduleMastery = { 'pulse-cannon': 2 }
    s.base.workerDrones = 8
    s.meta.sortieSpeed = 2
    s.prestige.matterShop['time-compression-2'] = 1
    s.prestige.matterShop['time-compression-1'] = 1
    s.foundry.slots = s.foundry.slots.map((slot, i) =>
      i === 0 ? { ...slot, recipeId: 'recovered-stock', progress: 0.4, paid: true } : slot,
    )
    s.hiveResearch.active = true
    s.hiveResearch.activeNodeId = 'priority-lock'
    s.hiveResearch.progress = 12
    addRelicInstance(s, 'power-coupler')
    s.foundry.fabrication = [
      { kind: 'core', jobId: 'flak-array', progress: 0.33, paid: true },
    ]
    const foundryProgress = s.foundry.slots[0]?.progress
    const fabProgress = s.foundry.fabrication[0]?.progress
    const researchElapsed = s.hiveResearch.progress
    s = performRebuild(s, { frameId: s.shipyard.frameId, modules: s.shipyard.modules })
    expect(s.resources.salvage).toBe(0)
    expect(s.resources.choirAsh).toBe(0)
    expect(s.combat.runUpgrades['weapon-power'] ?? 0).toBe(0)
    expect(workshopLevel(s, 'weapon-power')).toBe(0)
    expect(s.workshop.coreStarts['pulse-cannon:1'] ?? 0).toBe(0)
    expect(s.workshop.coreStarts['pulse-cannon:2'] ?? 0).toBe(0)
    expect(s.meta.genericUpgradeUnlocks.attack).toBe(3)
    expect(s.meta.moduleMastery['pulse-cannon']).toBe(2)
    expect(s.shipyard.coreInstances.find((row) => row.id === 'pulse-cannon:1')?.targetingDoctrine).toBe(
      'focus-fire',
    )
    expect(s.prestige.matterShop['weapon-calibration']).toBe(1)
    expect(s.base.workerDrones).toBe(8)
    expect(s.foundry.slots[0]?.progress).toBe(foundryProgress)
    expect(s.foundry.fabrication[0]?.progress).toBe(fabProgress)
    expect(s.foundry.fabrication[0]?.paid).toBe(true)
    expect(s.hiveResearch.progress).toBe(researchElapsed)
    expect(s.relics.instances.some((row) => row.familyId === 'power-coupler')).toBe(true)
    expect(s.meta.bestWave).toBeGreaterThanOrEqual(210)
    expect(s.meta.sortieSpeed).toBe(2)
    expect(cycleScrapGenerated(s)).toBe(0)
  })

  it('does not reduce Matter score when Scrap is spent', () => {
    const a = armRebuildDoor(docked())
    grantGeneratedScrap(a, 1000, 'combat-kill')
    const b = structuredClone(a)
    b.resources.scrap = 10
    expect(cycleScrapGenerated(a)).toBe(cycleScrapGenerated(b))
    expect(matterGainFor(a)).toBe(matterGainFor(b))
  })
})

describe('Challenge / Rebuild separation', () => {
  it('does not consume Rebuild when entering a Challenge', () => {
    let s = armRebuildDoor(docked())
    s.meta.act1Cleared = true
    s.meta.bestWave = 1000
    const cycle = { ...s.prestige.cycle }
    const matter = s.resources.prestigeMatter
    const rebuilds = s.prestige.prestigeCount
    s = enterChallenge(s, 'glass-frame')
    expect(s.resources.prestigeMatter).toBe(matter)
    expect(s.prestige.prestigeCount).toBe(rebuilds)
    expect(s.prestige.cycle.bestWave).toBe(cycle.bestWave)
    expect(s.prestige.cycle.normalSortiesCompleted).toBe(cycle.normalSortiesCompleted)
    expect(s.prestige.cycle.scrapGenerated).toBe(cycle.scrapGenerated)
    grantGeneratedScrap(s, 500, 'combat-kill')
    noteRebuildCycleSortie(s)
    expect(cycleScrapGenerated(s)).toBe(cycle.scrapGenerated)
    expect(cycleNormalSorties(s)).toBe(cycle.normalSortiesCompleted)
  })

  it('does not raise normal cycle Best Wave during a Challenge', () => {
    let s = armRebuildDoor(docked())
    s.meta.act1Cleared = true
    const before = cycleBestWave(s)
    s = enterChallenge(s, 'glass-frame')
    s.combat.wave = 80
    s.combat.waveReached = 80
    expect(cycleBestWave(s)).toBe(before)
  })
})

describe('physical Core Level lifecycle', () => {
  it('persists through real defeat, relaunch, and Extraction, then resets on Rebuild', () => {
    let s = docked()
    s.resources.scrap = 400
    s = buyCoreStartingLevel(s, 'pulse-cannon:1')
    const extra = addCoreInstance(s.shipyard, 'pulse-cannon')
    extra.targetingDoctrine = 'nearest'
    s = buyCoreStartingLevel(s, extra.id)
    applyMasteryXp(s, 'pulse-cannon', 10_000)
    const mastery = s.meta.moduleMastery['pulse-cannon']
    expect(coreStartingLevel(s, 'pulse-cannon:1')).toBe(1)
    expect(coreStartingLevel(s, extra.id)).toBe(1)
    expect(mastery).toBeGreaterThan(0)

    s = setDocked(s, false)
    s = completeDefeat(s)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.lastSortie.outcome).toBe('defeat')
    expect(coreStartingLevel(s, 'pulse-cannon:1')).toBe(1)
    expect(coreStartingLevel(s, extra.id)).toBe(1)
    expect(s.meta.moduleMastery['pulse-cannon']).toBe(mastery)
    expect(s.shipyard.coreInstances.find((row) => row.id === extra.id)?.targetingDoctrine).toBe('nearest')

    s = setDocked(s, false)
    expect(coreStartingLevel(s, 'pulse-cannon:1')).toBe(1)
    expect(coreStartingLevel(s, extra.id)).toBe(1)

    s.meta.bestWave = Math.max(s.meta.bestWave ?? 0, 210)
    s.combat.bestWave = Math.max(s.combat.bestWave ?? 0, 210)
    s = extractSortie(s)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.lastSortie.outcome).toBe('extract')
    expect(coreStartingLevel(s, 'pulse-cannon:1')).toBe(1)
    expect(coreStartingLevel(s, extra.id)).toBe(1)
    expect(s.meta.moduleMastery['pulse-cannon']).toBe(mastery)
    expect(s.shipyard.coreInstances.find((row) => row.id === extra.id)?.targetingDoctrine).toBe('nearest')

    s = armRebuildDoor(s)
    s.combat.docked = true
    s = performRebuild(s, { frameId: s.shipyard.frameId, modules: s.shipyard.modules })
    expect(coreStartingLevel(s, 'pulse-cannon:1')).toBe(0)
    expect(coreStartingLevel(s, extra.id)).toBe(0)
    expect(s.meta.moduleMastery['pulse-cannon']).toBe(mastery)
    expect(s.shipyard.coreInstances.find((row) => row.id === extra.id)?.targetingDoctrine).toBe('nearest')
  })
})

describe('normal Rebuild starting kits', () => {
  it('starts with zero Scrap without Reconstitution Cache', () => {
    let s = armRebuildDoor(docked())
    s = performRebuild(s, { frameId: s.shipyard.frameId, modules: s.shipyard.modules })
    expect(s.resources.scrap).toBe(0)
    expect(s.resources.salvage).toBe(0)
    expect(s.prestige.cycle.scrapGenerated).toBe(0)
  })

  it('starts with exactly the Reconstitution Cache grant and zero cycle Scrap', () => {
    let s = armRebuildDoor(docked())
    s.resources.prestigeMatter = 40
    s = buyMatterShop(s, 'reconstitution-cache')
    s = performRebuild(s, { frameId: s.shipyard.frameId, modules: s.shipyard.modules })
    expect(s.resources.scrap).toBe(24)
    expect(s.prestige.cycle.scrapGenerated).toBe(0)
  })

  it('grants only Sortie Provisioning Salvage on a normal launch', () => {
    let s = armRebuildDoor(docked())
    s.resources.prestigeMatter = 40
    s = buyMatterShop(s, 'sortie-provisioning')
    s = performRebuild(s, { frameId: s.shipyard.frameId, modules: s.shipyard.modules })
    expect(s.resources.salvage).toBe(0)
    s = setDocked(s, false)
    expect(s.resources.salvage).toBe(8)
  })

  it('does not invent a Challenge-entry resource kit', () => {
    let s = armRebuildDoor(docked())
    s.meta.act1Cleared = true
    s.meta.bestWave = 1000
    const ai = s.resources.aiPoints
    s.resources.scrap = 0
    s.resources.salvage = 0
    s = enterChallenge(s, 'glass-frame')
    expect(s.challenges.activeId).toBe('glass-frame')
    expect(s.resources.scrap).toBe(0)
    expect(s.resources.salvage).toBe(0)
    expect(s.resources.aiPoints).toBe(ai)
    s = setDocked(s, false)
    expect(s.resources.salvage).toBe(0)
  })
})
