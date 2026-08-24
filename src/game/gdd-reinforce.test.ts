import { describe, expect, it } from 'vitest'
import { canPrestige, performReinforce } from './actions'
import { rebuildCycle } from './rebuild'
import { ACT1_CADENCE, ACT1_FINAL_WAVE } from './cadence'
import { ACT1_CLIMAX_BLURB, ACT1_CLIMAX_NAME, encounterForWave } from './combat'
import { moreStationBuckets } from './moreStations'
import { dismissAct1Finale, isSystemUnlocked } from './progression'
import { reinforceConsequenceLists } from './playerGuidance'
import { canReinforce } from './reinforce'
import { createInitialState } from './state'
import { atCareerWave, clearCurrentWave, markHullLost } from './testHelpers'
import { startCombat } from './tick'
import { isAct1ClimaxWave } from './waves'

function climaxState(opts?: { wave?: number; cleared?: boolean }) {
  const s = atCareerWave(markHullLost(createInitialState(0)), opts?.wave ?? ACT1_CADENCE.reinforce)
  s.prestige.prestigeCount = 2
  s.hiveResearch.completed.energy = 1
  s.combat.docked = true
  if (opts?.cleared) s.meta.act1Cleared = true
  return s
}

describe('GDD Act 1 climax and Reinforce', () => {
  it('authors a unique Wave 300 boss instead of the generic titan pack', () => {
    expect(isAct1ClimaxWave(ACT1_FINAL_WAVE)).toBe(true)
    expect(isAct1ClimaxWave(290)).toBe(false)
    const climax = encounterForWave(ACT1_FINAL_WAVE)
    const prior = encounterForWave(ACT1_FINAL_WAVE - 10)
    expect(climax.isBoss).toBe(true)
    expect(climax.name).toBe(ACT1_CLIMAX_NAME)
    expect(climax.id).toBe('w300-climax')
    expect(climax.blurb).toBe(ACT1_CLIMAX_BLURB)
    expect(climax.mechanicId).toBe('climax-choir')
    expect(climax.units.some((u) => u.name === ACT1_CLIMAX_NAME && u.isBoss)).toBe(true)
    expect(climax.units.some((u) => u.name === 'Crown Plate')).toBe(true)
    expect(climax.units.some((u) => u.name === 'Loop Mite')).toBe(true)
    expect(climax.units.some((u) => u.name === 'Veil Echo')).toBe(true)
    expect(prior.units.some((u) => u.name === 'Crown Plate')).toBe(false)
    expect(prior.mechanicId).not.toBe('climax-choir')
    expect(new Set(climax.units.map((u) => u.family)).size).toBeGreaterThan(1)
  })

  it('keeps Reinforce locked until the Wave 300 climax is defeated', () => {
    const approaching = climaxState({ wave: ACT1_CADENCE.reinforce - 1 })
    expect(isSystemUnlocked(approaching, 'reinforce')).toBe(false)
    expect(canReinforce(approaching).ok).toBe(false)
    expect(moreStationBuckets(approaching).open.map((s) => s.id)).not.toContain('reinforce')
    expect(moreStationBuckets(approaching).next).toEqual([])

    const reached = climaxState({ wave: ACT1_CADENCE.reinforce })
    expect(reached.meta.act1Cleared).toBe(false)
    expect(isSystemUnlocked(reached, 'reinforce')).toBe(false)
    expect(canReinforce(reached).reason).toMatch(/Clear Wave 300/)
  })

  it('reveals Reinforce after the climax is cleared', () => {
    let s = climaxState({ wave: ACT1_CADENCE.reinforce - 1 })
    s.combat.wave = ACT1_FINAL_WAVE
    s = startCombat(s)
    expect(s.combat.enemyName).toBe(ACT1_CLIMAX_NAME)
    s.combat.playerHull = 10_000
    s.combat.playerHullMax = 10_000
    s = clearCurrentWave(s)
    expect(s.meta.act1Cleared).toBe(true)
    expect(s.meta.act1FinalePending).toBe(true)
    expect(isSystemUnlocked(s, 'reinforce')).toBe(true)
    expect(moreStationBuckets(s).open.map((door) => door.id)).toContain('reinforce')
    expect(moreStationBuckets(s).next).toEqual([])
    const dismissed = dismissAct1Finale(s)
    expect(dismissed.meta.act1FinalePending).toBe(false)
    expect(dismissed.meta.act1Cleared).toBe(true)
  })

  it('refuses Reinforce mid-Sortie and resets the cycle from Dock', () => {
    const live = climaxState({ cleared: true })
    live.combat.docked = false
    expect(canReinforce(live).ok).toBe(false)
    expect(canReinforce(live).reason).toMatch(/Dock/)

    let s = climaxState({ cleared: true })
    s.resources.scrap = 40
    s.workshop.levels['weapon-power'] = 2
    s.foundry.recipeLevels['slag-ingot'] = 3
    const matter = s.resources.prestigeMatter
    expect(canReinforce(s).ok).toBe(true)
    s = performReinforce(s)
    expect(s.meta.ascensionCount).toBe(1)
    expect(s.resources.prestigeMatter).toBeGreaterThan(matter)
    expect(s.resources.scrap).not.toBe(40)
    expect(s.workshop.levels['weapon-power'] ?? 0).toBe(0)
    expect(s.foundry.recipeLevels['slag-ingot']).toBe(3)
    expect(rebuildCycle(s)).toEqual({ bestWave: 0, sorties: 0, scrapEarned: 0 })
    expect(s.meta.act1Cleared).toBe(true)
    expect(canPrestige(s)).toBe(false)
  })

  it('prints YOU RESET, YOU KEEP, and WHAT CHANGES without opening Capital', () => {
    const s = climaxState({ cleared: true })
    const lists = reinforceConsequenceLists(s)
    expect(lists.reset.length).toBeGreaterThan(lists.keep.length ? 0 : 1)
    expect(lists.reset.some((line) => /Salvage/.test(line))).toBe(true)
    expect(lists.keep.some((line) => /Act 1 completion/.test(line))).toBe(true)
    expect(lists.change.some((line) => /starting architecture/.test(line))).toBe(true)
    expect(lists.change.some((line) => /No Capital/.test(line))).toBe(true)
    expect(lists.change.some((line) => /No Act 2 shop/.test(line))).toBe(true)
    expect(lists.change.join(' ')).not.toMatch(/Capital shop|Act 2 shop opens/)
  })
})
