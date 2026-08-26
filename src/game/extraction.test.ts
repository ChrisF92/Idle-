import { describe, expect, it } from 'vitest'
import { buyMatterShop, buyWorkshopUpgrade, performRebuild } from './actions'
import { canExtract, EXTRACTION_SCRAP_BONUS, extractionBonusFor, projectedExtractionBonus } from './extraction'
import { createInitialState } from './state'
import { armRebuildDoor, markHullLost } from './testHelpers'
import { extractSortie, setDocked, setSortiePaused } from './tick'
import { grantGeneratedScrap } from './rebuild'
import { workshopLevel } from './workshop'

describe('Extraction', () => {
  it('unlocks at career Best Wave 210 for a normal live Sortie', () => {
    let s = setDocked(markHullLost(createInitialState(0)), false)
    expect(canExtract(s)).toBe(false)
    s.meta.bestWave = 210
    expect(canExtract(s)).toBe(true)
    s.prestige.activeChallengeId = 'no-ai'
    s.combat.sortieMark = { ...s.combat.sortieMark!, challengeSortie: true }
    expect(canExtract(s)).toBe(false)
  })

  it('uses 12.5% of gross Sortie Scrap with floor and no minimum +1', () => {
    expect(EXTRACTION_SCRAP_BONUS).toBe(0.125)
    expect(projectedExtractionBonus(100)).toBe(12)
    expect(projectedExtractionBonus(0)).toBe(0)
    expect(projectedExtractionBonus(7)).toBe(0)
  })

  it('counts spent combat Scrap, excludes Worker Scrap and starting cache', () => {
    let s = setDocked(markHullLost(createInitialState(0)), false)
    s.meta.bestWave = 210
    grantGeneratedScrap(s, 100, 'combat-kill')
    s.resources.scrap -= 80
    expect(extractionBonusFor(s)).toBe(12)
    grantGeneratedScrap(s, 50, 'industry')
    expect(extractionBonusFor(s)).toBe(12)
    const extracted = extractSortie(s)
    expect(extracted.combat.lastSortie.extractionBonusScrap).toBe(12)
    expect(extracted.combat.lastSortie.outcome).toBe('extract')
    expect(extracted.combat.docked).toBe(true)
    expect(extracted.resources.salvage).toBe(0)
    expect(extracted.resources.prestigeMatter).toBe(s.resources.prestigeMatter)
  })

  it('defeat does not grant the bonus; Core and Workshop levels persist', () => {
    let s = markHullLost(createInitialState(0))
    s.resources.scrap = 40
    s = buyWorkshopUpgrade(s, 'weapon-power')
    const workshop = workshopLevel(s, 'weapon-power')
    s.workshop.coreStarts = { 'pulse-cannon:1': 4 }
    s = setDocked(s, false)
    s.combat.playerUnits = [{ ...(s.combat.playerUnits[0] ?? { hull: 1, hullMax: 10, isFlagship: true, x: 0, y: 0, vx: 0, vy: 0, weapons: [] } as never), hull: 0, isFlagship: true }]
    const extracted = extractSortie({ ...s, meta: { ...s.meta, bestWave: 210 } })
    expect(extracted.workshop.coreStarts['pulse-cannon:1']).toBe(4)
    expect(workshopLevel(extracted, 'weapon-power')).toBe(workshop)
    expect(extracted.combat.runUpgrades['weapon-power'] ?? 0).toBe(0)
  })

  it('opening confirmation leaves the Sortie PAUSED on cancel path', () => {
    let s = setDocked(markHullLost(createInitialState(0)), false)
    s.meta.bestWave = 210
    grantGeneratedScrap(s, 100, 'combat-kill')
    s = setSortiePaused(s, true)
    expect(s.combat.sortiePaused).toBe(true)
    expect(s.combat.docked).toBe(false)
    expect(s.combat.lastSortie?.extractionBonusScrap ?? 0).toBe(0)
    expect(extractionBonusFor(s)).toBe(12)
  })

  it('A: docking an active Sortie does not award Extraction', () => {
    let s = setDocked(markHullLost(createInitialState(0)), false)
    s.meta.bestWave = 210
    s.combat.bestWave = 210
    grantGeneratedScrap(s, 100, 'combat-kill')
    const bank = s.resources.scrap
    const generated = s.prestige.cycle.scrapGenerated
    const docked = setDocked(s, true)
    expect(docked.combat.docked).toBe(false)
    expect(docked.combat.inFight).toBe(true)
    expect(docked.resources.scrap).toBe(bank)
    expect(docked.prestige.cycle.scrapGenerated).toBe(generated)
    expect(docked.combat.lastSortie?.extractionBonusScrap ?? 0).toBe(0)
  })

  it('B: confirmed extractSortie awards floor(100 × 0.125) = 12 once', () => {
    let s = setDocked(markHullLost(createInitialState(0)), false)
    s.meta.bestWave = 210
    s.combat.bestWave = 210
    grantGeneratedScrap(s, 100, 'combat-kill')
    const extracted = extractSortie(s)
    expect(extracted.combat.docked).toBe(true)
    expect(extracted.combat.lastSortie.outcome).toBe('extract')
    expect(extracted.combat.lastSortie.extractionBonusScrap).toBe(12)
    expect(extracted.prestige.cycle.scrapGenerated).toBe(s.prestige.cycle.scrapGenerated + 12)
  })

  it('C: extracting again after Dock does not pay a second bonus', () => {
    let s = setDocked(markHullLost(createInitialState(0)), false)
    s.meta.bestWave = 210
    s.combat.bestWave = 210
    grantGeneratedScrap(s, 100, 'combat-kill')
    s = extractSortie(s)
    const bank = s.resources.scrap
    const generated = s.prestige.cycle.scrapGenerated
    const again = extractSortie(s)
    expect(again.resources.scrap).toBe(bank)
    expect(again.prestige.cycle.scrapGenerated).toBe(generated)
    expect(again.combat.lastSortie.extractionBonusScrap).toBe(12)
  })
})

describe('Rebuild reconstitution vs extraction accounting', () => {
  it('does not treat reconstitution Scrap as Sortie-earned', () => {
    let s = armRebuildDoor(markHullLost(createInitialState(0)))
    s = buyMatterShop({ ...s, resources: { ...s.resources, prestigeMatter: 40 } }, 'reconstitution-cache')
    s = performRebuild(s, { frameId: s.shipyard.frameId, modules: s.shipyard.modules })
    s = setDocked(s, false)
    s.meta.bestWave = 210
    expect(extractionBonusFor(s)).toBe(0)
  })
})
