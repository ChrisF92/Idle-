import { describe, expect, it } from 'vitest'
import { canPrestige, performReinforce } from './actions'
import { rebuildCycle } from './rebuild'
import { ACT1_CADENCE, ACT1_FINAL_WAVE } from './cadence'
import { encounterForWave } from './combat'
import { moreStationBuckets } from './moreStations'
import { dismissAct1Finale, isSystemUnlocked } from './progression'
import { reinforceConsequenceLists } from './playerGuidance'
import { canReinforce } from './reinforce'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'
import { isAct1ClimaxWave, isAct1FinaleWave, isBossWave } from './waves'

function finaleState(opts?: { wave?: number; cleared?: boolean }) {
  const s = atCareerWave(markHullLost(createInitialState(0)), opts?.wave ?? ACT1_CADENCE.reinforce)
  s.prestige.prestigeCount = 2
  s.hiveResearch.completed.energy = 1
  s.combat.docked = true
  if (opts?.cleared) s.meta.act1Cleared = true
  return s
}

describe('GDD Act 1 climax and Reinforce', () => {
  it('treats Wave 1000 as the Act 1 finale Boss boundary without an authored identity', () => {
    expect(isAct1ClimaxWave(ACT1_FINAL_WAVE)).toBe(true)
    expect(isAct1FinaleWave(ACT1_FINAL_WAVE)).toBe(true)
    expect(isBossWave(ACT1_FINAL_WAVE)).toBe(true)
    expect(isAct1ClimaxWave(290)).toBe(false)
    const normal = encounterForWave(ACT1_FINAL_WAVE)
    expect(normal.isBoss).toBe(false)
  })

  it('keeps Reinforce locked until the Wave 1000 finale is defeated', () => {
    const approaching = finaleState({ wave: ACT1_CADENCE.reinforce - 1 })
    expect(isSystemUnlocked(approaching, 'reinforce')).toBe(false)
    expect(canReinforce(approaching).ok).toBe(false)
    expect(moreStationBuckets(approaching).open.map((s) => s.id)).not.toContain('reinforce')
    expect(moreStationBuckets(approaching).next).toEqual([])

    const reached = finaleState({ wave: ACT1_CADENCE.reinforce })
    expect(reached.meta.act1Cleared).toBe(false)
    expect(isSystemUnlocked(reached, 'reinforce')).toBe(false)
    expect(canReinforce(reached).reason).toMatch(/Choir Crown/)
  })

  it('reveals Reinforce after Act 1 is marked cleared', () => {
    const s = finaleState({ cleared: true })
    expect(isSystemUnlocked(s, 'reinforce')).toBe(true)
    expect(moreStationBuckets(s).open.map((door) => door.id)).toContain('reinforce')
    expect(moreStationBuckets(s).next).toEqual([])
    s.meta.act1FinalePending = true
    const dismissed = dismissAct1Finale(s)
    expect(dismissed.meta.act1FinalePending).toBe(false)
    expect(dismissed.meta.act1Cleared).toBe(true)
  })

  it('refuses Reinforce mid-Sortie and resets the cycle from Dock', () => {
    const live = finaleState({ cleared: true })
    live.combat.docked = false
    expect(canReinforce(live).ok).toBe(false)
    expect(canReinforce(live).reason).toMatch(/Dock/)

    let s = finaleState({ cleared: true })
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
    const s = finaleState({ cleared: true })
    const lists = reinforceConsequenceLists(s)
    expect(lists.reset.length).toBeGreaterThan(lists.keep.length ? 0 : 1)
    expect(lists.reset.some((line) => /Salvage/.test(line))).toBe(true)
    expect(lists.keep.some((line) => /Act 1 completion/.test(line))).toBe(true)
    expect(lists.change.some((line) => /starting architecture/.test(line))).toBe(true)
    expect(lists.change.some((line) => /No Act 2 shop/.test(line))).toBe(true)
    expect(lists.change.join(' ')).not.toMatch(/Act 2 shop is open|Capital/)
  })
})
