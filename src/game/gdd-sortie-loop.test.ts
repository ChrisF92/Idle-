import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { setDocked, startCombat, advanceTicks } from './tick'
import { buyRunUpgrade, buyWorkshopUpgrade, upgradeModule } from './actions'
import { clearSector } from './testHelpers'
import { encounterForWave } from './combat'
import { isBossWave, powerSectorForWave } from './waves'
import { effectiveUpgradeLevel, reclaimSpeed, weaponPowerMult } from './workshop'

function launch(state = createInitialState()) {
  return setDocked(state, false)
}

describe('GDD sortie loop', () => {
  it('starts every Launch at Wave 1', () => {
    let s = createInitialState()
    s.combat.wave = 18
    s.combat.sector = 2
    s.combat.docked = true
    s = launch(s)
    expect(s.combat.docked).toBe(false)
    expect(s.combat.wave).toBe(1)
    expect(s.combat.sector).toBe(1)
  })

  it('introduces a new enemy idea at each GDD wave band', () => {
    expect(encounterForWave(1).family).toBe('swarm')
    expect(encounterForWave(11).family).toBe('swarm')
    expect(encounterForWave(21).units.every((u) => u.role === 'skirmisher')).toBe(true)
    expect(encounterForWave(41).family).toBe('armored')
    expect(encounterForWave(1).family).toBe(encounterForWave(4).family)
    expect(encounterForWave(11).family).not.toBe('armored')
  })

  it('places a boss on every 10th Wave', () => {
    expect(isBossWave(10)).toBe(true)
    expect(isBossWave(9)).toBe(false)
    expect(encounterForWave(10).isBoss).toBe(true)
    expect(encounterForWave(1).isBoss).toBe(false)
    expect(powerSectorForWave(11)).toBe(2)
  })

  it('spawns enemies around the Hive instead of a single lane', () => {
    const pack = encounterForWave(4).units
    const headings = new Set(pack.map((u) => Number((u.heading ?? 0).toFixed(3))))
    expect(headings.size).toBeGreaterThan(1)
  })

  it('ends the Sortie and docks on hull loss', () => {
    let s = startCombat(createInitialState())
    const hive = s.combat.playerUnits.find((u) => u.isFlagship)
    if (hive) hive.hull = 0
    s.combat.playerHull = 0
    advanceTicks(s, 3)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.inFight).toBe(false)
    expect(s.combat.lastSortie.outcome).toBe('defeat')
    expect(s.combat.wave).toBe(1)
    expect(s.resources.salvage).toBe(0)
  })

  it('Extract returns to Dock with a Scrap bonus', () => {
    let s = launch(createInitialState())
    s = startCombat(s)
    s.resources.scrap += 50
    if (s.combat.sortieMark) s.combat.sortieMark.scrap = s.resources.scrap - 50
    s = setDocked(s, true)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.lastSortie.outcome).toBe('extract')
    expect(s.combat.lastSortie.scrapEarned).toBeGreaterThanOrEqual(50)
    expect(s.resources.scrap).toBeGreaterThan(createInitialState().resources.scrap + 50)
  })

  it('Workshop starting levels persist across Sorties and Salvage ranks do not', () => {
    let s = createInitialState()
    s.meta.hullLostOnce = true
    s.combat.docked = true
    s.resources.scrap = 500
    s = buyWorkshopUpgrade(s, 'weapon-power')
    expect(effectiveUpgradeLevel(s, 'weapon-power')).toBe(1)

    s = launch(s)
    s.resources.salvage = 200
    const before = weaponPowerMult(s)
    s = buyRunUpgrade(s, 'weapon-power')
    expect(weaponPowerMult(s)).toBeGreaterThan(before)

    s = setDocked(s, true)
    expect(s.combat.runUpgrades['weapon-power'] ?? 0).toBe(0)
    expect(effectiveUpgradeLevel(s, 'weapon-power')).toBe(1)
  })

  it('keeps Core upgrades out of the Sortie', () => {
    let s = launch(createInitialState())
    s.resources.salvage = 80
    s.resources.scrap = 80
    s = upgradeModule(s, 'pulse-cannon')
    expect(s.combat.coreRunLevels?.['0'] ?? 0).toBe(0)
    expect(s.resources.salvage).toBe(80)
    expect(s.resources.scrap).toBe(80)
  })

  it('clearing ten waves records a band clear for existing system gates', () => {
    let s = launch(createInitialState())
    s.combat.playerHull = 10_000
    s.combat.playerHullMax = 10_000
    s = clearSector(s)
    expect(s.combat.highestSector).toBeGreaterThanOrEqual(1)
    expect(s.meta.bestWave).toBeGreaterThanOrEqual(10)
  })

  it('compresses solved Waves without adding combat power', () => {
    const s = createInitialState()
    s.meta.bestWave = 40
    s.combat.bestWave = 40
    s.combat.wave = 1
    expect(reclaimSpeed(s)).toBeGreaterThan(1)
    expect(reclaimSpeed(s)).toBeLessThanOrEqual(4)
    s.combat.wave = 40
    expect(reclaimSpeed(s)).toBe(1)
  })
})
