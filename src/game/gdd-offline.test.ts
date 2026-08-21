import { describe, expect, it } from 'vitest'
import { assignWorker, setFoundrySlot } from './actions'
import { ACT1_CADENCE } from './cadence'
import { applyOfflineCatchUp } from './offline'
import { createInitialState } from './state'
import { atCareerWave } from './testHelpers'
import { setDocked, startCombat } from './tick'

function dockedHive() {
  let s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
  s.combat.docked = true
  s.base.workerDrones = Math.max(2, s.base.workerDrones)
  s = assignWorker(s, 'scrap-field', 2)
  s.lastTickAt = 0
  return s
}

describe('GDD offline Sortie freeze', () => {
  it('keeps Docked Hive industry running while away', () => {
    const s = dockedHive()
    const { state: next, report } = applyOfflineCatchUp(s, 10 * 60 * 1000)
    expect(next.combat.docked).toBe(true)
    expect(next.resources.scrap).toBeGreaterThan(s.resources.scrap)
    expect(report?.sortieFrozen).toBe(false)
    expect(report?.modeLabel).toBe('Docked')
  })

  it('advances Foundry crafts while Docked offline', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    s.combat.docked = true
    s.resources.salvage = 80
    s = setFoundrySlot(s, 0, 'slag-ingot')
    s.lastTickAt = 0
    const { state: next } = applyOfflineCatchUp(s, 20 * 1000)
    expect(next.foundry.materials['slag-ingot'] ?? 0).toBeGreaterThanOrEqual(2)
    expect(next.combat.wave).toBe(s.combat.wave)
  })

  it('freezes a live Sortie and resumes the same fight', () => {
    let s = setDocked(createInitialState(0), false)
    s = startCombat(s)
    s.lastTickAt = 0
    const hull = s.combat.playerHull
    const enemy = s.combat.enemyHull
    const units = s.combat.enemyUnits.length
    const wave = s.combat.wave
    const { state: next, report } = applyOfflineCatchUp(s, 15 * 60 * 1000)
    expect(next.combat.docked).toBe(false)
    expect(next.combat.inFight).toBe(true)
    expect(next.combat.wave).toBe(wave)
    expect(next.combat.playerHull).toBe(hull)
    expect(next.combat.enemyHull).toBe(enemy)
    expect(next.combat.enemyUnits).toHaveLength(units)
    expect(report?.sortieFrozen).toBe(true)
    expect(report?.modeLabel).toBe('Sortie frozen')
    expect(report?.wave).toBe(wave)
  })

  it('still runs Hive industry while the Sortie is frozen', () => {
    let s = dockedHive()
    s = setDocked(s, false)
    s = startCombat(s)
    s.lastTickAt = 0
    const scrap = s.resources.scrap
    const wave = s.combat.wave
    const { state: next } = applyOfflineCatchUp(s, 10 * 60 * 1000)
    expect(next.resources.scrap).toBeGreaterThan(scrap)
    expect(next.combat.wave).toBe(wave)
    expect(next.combat.inFight).toBe(true)
  })

  it('does not let Ghost Sortie push Waves in Act 1', () => {
    let s = setDocked(createInitialState(0), false)
    s = startCombat(s)
    s.process.purchased = [...(s.process.purchased ?? []), 'offline-sortie']
    s.combat.wave = 18
    s.combat.sector = 6
    s.lastTickAt = 0
    const { state: next, report } = applyOfflineCatchUp(s, 30 * 60 * 1000)
    expect(next.combat.wave).toBe(18)
    expect(next.combat.sector).toBe(6)
    expect(report?.sectorsCleared ?? 0).toBe(0)
  })
})
