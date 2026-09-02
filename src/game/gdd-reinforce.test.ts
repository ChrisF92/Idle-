import { describe, expect, it } from 'vitest'
import { ACT1_CADENCE, ACT1_FINAL_WAVE } from './cadence'
import { encounterForWave } from './combat'
import { moreStationBuckets } from './moreStations'
import { dismissAct1Finale, isSystemUnlocked } from './progression'
import { reinforceUnlocked } from './reinforce'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'
import { isAct1ClimaxWave, isAct1FinaleWave, isBossWave } from './waves'

function finaleState(opts?: { wave?: number; cleared?: boolean }) {
  const state = atCareerWave(
    markHullLost(createInitialState(0)),
    opts?.wave ?? ACT1_CADENCE.reinforce,
  )
  state.combat.docked = true
  if (opts?.cleared) state.meta.act1Cleared = true
  return state
}

describe('GDD Act 1 climax and post-finale reveal', () => {
  it('treats Wave 1000 as the Act 1 finale Boss boundary', () => {
    expect(isAct1ClimaxWave(ACT1_FINAL_WAVE)).toBe(true)
    expect(isAct1FinaleWave(ACT1_FINAL_WAVE)).toBe(true)
    expect(isBossWave(ACT1_FINAL_WAVE)).toBe(true)
    expect(isAct1ClimaxWave(290)).toBe(false)
    expect(encounterForWave(ACT1_FINAL_WAVE).isBoss).toBe(false)
  })

  it('keeps Reinforce hidden until Choir Crown is defeated', () => {
    const approaching = finaleState({ wave: ACT1_CADENCE.reinforce - 1 })
    expect(reinforceUnlocked(approaching)).toBe(false)
    expect(isSystemUnlocked(approaching, 'reinforce')).toBe(false)
    expect(moreStationBuckets(approaching).open.map((door) => door.id)).not.toContain('reinforce')

    const reached = finaleState()
    expect(reinforceUnlocked(reached)).toBe(false)
    expect(isSystemUnlocked(reached, 'reinforce')).toBe(false)
  })

  it('reveals a read-only future direction after Act 1', () => {
    const state = finaleState({ cleared: true })
    expect(reinforceUnlocked(state)).toBe(true)
    expect(isSystemUnlocked(state, 'reinforce')).toBe(true)
    expect(moreStationBuckets(state).open.map((door) => door.id)).toContain('reinforce')
    state.meta.act1FinalePending = true
    const dismissed = dismissAct1Finale(state)
    expect(dismissed.meta.act1FinalePending).toBe(false)
    expect(dismissed.meta.act1Cleared).toBe(true)
  })
})
