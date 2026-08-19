import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats, SAVE_VERSION } from './state'
import { assignWorker, buyNetworkLink, performRebuild } from './actions'
import {
  NETWORK_STARTING_DRONES,
  canBuyNetworkLink,
  isNetworkBarUnlocked,
  networkCycleMult,
  networkDiagnostics,
  networkExponent,
  networkFillCap,
  networkFillCost,
  networkFillRate,
  networkFormulaHooks,
  networkLevelEffectiveness,
  networkLevels,
  networkLinkPower,
  networkLinkRank,
  networkSalvageMult,
  networkStrikeMult,
  networkWardMult,
  tickNetwork,
} from './network'
import { droneCap, dronePower, idleWorkers } from './catalog'
import { isSystemUnlocked } from './progression'
import { advanceSeconds } from './tick'
import { salvageFromKill } from './combat'
import { exportSave, importSave } from './save'

describe('phase 4: drone network', () => {
  it('starts with a corps; Network tab waits for first hull loss', () => {
    const s = createInitialState(0)
    expect(SAVE_VERSION).toBe(33)
    expect(s.base.workerDrones).toBe(NETWORK_STARTING_DRONES)
    expect(droneCap(s)).toBe(10)
    expect(idleWorkers(s)).toBe(NETWORK_STARTING_DRONES)
    expect(isSystemUnlocked(s, 'network')).toBe(false)
    s.meta.hullLostOnce = true
    expect(isSystemUnlocked(s, 'network')).toBe(true)
    expect(isSystemUnlocked(s, 'cores')).toBe(false)
    expect(isNetworkBarUnlocked(s, 'strike')).toBe(true)
    expect(isNetworkBarUnlocked(s, 'ward')).toBe(true)
    expect(isNetworkBarUnlocked(s, 'yield')).toBe(false)
    expect(isNetworkBarUnlocked(s, 'archive')).toBe(false)
  })

  it('assigns drones onto Strike and fills levels over time', () => {
    let s = createInitialState(0)
    s = assignWorker(s, 'strike', 2)
    expect(s.base.assignments.strike).toBe(2)
    expect(networkFillRate(s, 'strike')).toBeGreaterThan(0)
    s.combat.docked = false
    tickNetwork(s, 25)
    expect(networkLevels(s, 'strike')).toBeGreaterThanOrEqual(1)
  })

  it('Strike levels raise ship DPS; Ward raises max shield', () => {
    let s = createInitialState(0)
    const dmg0 = computeShipStats(s).damage
    const shield0 = computeShipStats(s).shieldMax
    expect(networkStrikeMult(s)).toBe(1)
    expect(networkWardMult(s)).toBe(1)

    s = assignWorker(s, 'strike', 4)
    s.combat.docked = false
    tickNetwork(s, 30)
    expect(networkLevels(s, 'strike')).toBeGreaterThan(0)
    expect(computeShipStats(s).damage).toBeGreaterThan(dmg0)

    s = assignWorker(s, 'strike', -4)
    s = assignWorker(s, 'ward', 4)
    s.combat.docked = false
    tickNetwork(s, 30)
    expect(networkLevels(s, 'ward')).toBeGreaterThan(0)
    expect(computeShipStats(s).shieldMax).toBeGreaterThan(shield0)
  })

  it('extra drones fill a bar faster until the fill cap', () => {
    let slow = createInitialState(0)
    slow.combat.docked = false
    slow = assignWorker(slow, 'strike', 1)
    tickNetwork(slow, 20)
    const slowLv = networkLevels(slow, 'strike')

    let fast = createInitialState(0)
    fast.combat.docked = false
    fast = assignWorker(fast, 'strike', 2)
    tickNetwork(fast, 20)
    expect(networkLevels(fast, 'strike')).toBeGreaterThanOrEqual(slowLv)
  })

  it('Yield opens at S4 before Loom at S9 and boosts salvage + Strike fill', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 4
    s.combat.highestSector = 4
    expect(isNetworkBarUnlocked(s, 'yield')).toBe(true)
    expect(isNetworkBarUnlocked(s, 'loom')).toBe(false)

    s = assignWorker(s, 'yield', 4)
    s.combat.docked = false
    tickNetwork(s, 40)
    expect(networkLevels(s, 'yield')).toBeGreaterThan(0)
    expect(networkSalvageMult(s)).toBeGreaterThan(1)

    const boosted = salvageFromKill(1, false) * networkSalvageMult(s)
    expect(boosted).toBeGreaterThan(1)

    s = assignWorker(s, 'yield', -4)
    s = assignWorker(s, 'strike', 2)
    const withYield = networkFillRate(s, 'strike')

    const fresh = createInitialState(0)
    const unboosted = assignWorker(fresh, 'strike', 2)
    expect(withYield).toBeGreaterThan(networkFillRate(unboosted, 'strike'))
  })

  it('manufactures drones from the start up to corps cap', () => {
    const s = createInitialState(0)
    expect(s.base.workerDrones).toBe(NETWORK_STARTING_DRONES)
    advanceSeconds(s, 90 * 8)
    expect(s.base.workerDrones).toBe(droneCap(s))
    expect(s.base.workerDrones).toBe(10)
  })

  it('Rebuild wipes bar levels and assignments, keeps the corps', () => {
    let s = createInitialState(0)
    s.combat.sector = 12
    s.meta.highestSectorEver = 12
    s.combat.highestSector = 12
    s = assignWorker(s, 'strike', 4)
    s.combat.docked = false
    tickNetwork(s, 25)
    expect(networkLevels(s, 'strike')).toBeGreaterThan(0)
    const corps = s.base.workerDrones

    s = performRebuild(s, {
      frameId: 'scout-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.network.bars.strike.levels).toBe(0)
    expect(s.network.bars.ward.levels).toBe(0)
    expect(s.base.assignments.strike ?? 0).toBe(0)
    expect(s.base.workerDrones).toBe(corps)
    expect(networkStrikeMult(s)).toBe(1)
  })

  it('buys Corps racks with scrap, then Heat after the Furnace', () => {
    let s = createInitialState(0)
    expect(canBuyNetworkLink(s, 'racks').ok).toBe(false)
    s.resources.scrap = 40
    expect(canBuyNetworkLink(s, 'racks').ok).toBe(true)
    expect(canBuyNetworkLink(s, 'acuity').ok).toBe(false)
    expect(canBuyNetworkLink(s, 'cycle').reason).toMatch(/Furnace/)

    s = buyNetworkLink(s, 'racks')
    expect(networkLinkRank(s, 'racks')).toBe(1)
    expect(droneCap(s)).toBe(11)
    expect(s.resources.scrap).toBe(0)

    s.meta.highestSectorEver = 28
    s.combat.highestSector = 28
    s.resources.heat = 20
    s = buyNetworkLink(s, 'racks')
    expect(networkLinkRank(s, 'racks')).toBe(2)
    expect(droneCap(s)).toBe(12)
    expect(s.resources.heat).toBeLessThan(20)
  })

  it('acuity raises efficiency and cycle speed raises fill rate; Rebuild keeps Links', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 28
    s.combat.highestSector = 28
    s.combat.sector = 28
    s.resources.heat = 80
    s = assignWorker(s, 'strike', 2)
    const rate0 = networkFillRate(s, 'strike')
    const power0 = dronePower(s)
    const link0 = networkLinkPower(s)

    s = buyNetworkLink(s, 'acuity')
    expect(networkLinkRank(s, 'acuity')).toBe(1)
    expect(dronePower(s)).toBeGreaterThan(power0)
    expect(networkLinkPower(s)).toBeGreaterThan(link0)
    expect(networkFillRate(s, 'strike')).toBeGreaterThan(rate0)

    const afterAcuity = networkFillRate(s, 'strike')
    expect(networkCycleMult(s)).toBe(1)
    s = buyNetworkLink(s, 'cycle')
    expect(networkCycleMult(s)).toBeCloseTo(1.12, 5)
    expect(networkFillRate(s, 'strike')).toBeGreaterThan(afterAcuity)

    s.network.bars.strike.levels = 6
    const racks = networkLinkRank(s, 'racks')
    const acuity = networkLinkRank(s, 'acuity')
    const cycle = networkLinkRank(s, 'cycle')
    s = performRebuild(s, {
      frameId: 'scout-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.network.bars.strike.levels).toBe(0)
    expect(networkLinkRank(s, 'racks')).toBe(racks)
    expect(networkLinkRank(s, 'acuity')).toBe(acuity)
    expect(networkLinkRank(s, 'cycle')).toBe(cycle)
    expect(droneCap(s)).toBe(10 + racks)
  })
})

describe('Network layers', () => {
  function sector(n: number) {
    const s = createInitialState(0)
    s.meta.highestSectorEver = n
    s.combat.highestSector = n
    s.meta.hullLostOnce = true
    return s
  }

  it('unlocks Relays and Lattices on career sector, not as extra damage shops', () => {
    const early = sector(11)
    expect(isNetworkBarUnlocked(early, 'strike-relay')).toBe(false)
    expect(isNetworkBarUnlocked(early, 'ward-relay')).toBe(false)

    const s8 = sector(12)
    expect(isNetworkBarUnlocked(s8, 'strike-relay')).toBe(true)
    expect(isNetworkBarUnlocked(s8, 'ward-relay')).toBe(false)
    expect(isNetworkBarUnlocked(s8, 'yield-relay')).toBe(false)

    expect(isNetworkBarUnlocked(sector(15), 'ward-relay')).toBe(true)
    expect(isNetworkBarUnlocked(sector(20), 'yield-relay')).toBe(true)
    expect(isNetworkBarUnlocked(sector(24), 'loom-relay')).toBe(true)
    expect(isNetworkBarUnlocked(sector(38), 'archive-relay')).toBe(true)
    expect(isNetworkBarUnlocked(sector(43), 'strike-lattice')).toBe(false)
    expect(isNetworkBarUnlocked(sector(44), 'strike-lattice')).toBe(true)
    expect(isNetworkBarUnlocked(sector(48), 'ward-lattice')).toBe(true)
  })

  it('Strike Relay raises Strike fill, level strength, and fill cap', () => {
    const plain = sector(12)
    plain.network.bars.strike.levels = 12
    const relayed = sector(12)
    relayed.network.bars.strike.levels = 12
    relayed.network.bars['strike-relay'].levels = 16

    expect(networkFillCap(relayed, 'strike')).toBeGreaterThan(networkFillCap(plain, 'strike'))
    expect(networkFillCost(relayed, 'strike')).toBeLessThan(networkFillCost(plain, 'strike'))
    expect(networkStrikeMult(relayed)).toBeGreaterThan(networkStrikeMult(plain))
    expect(networkLevelEffectiveness(relayed, 'strike')).toBeGreaterThan(1)

    const assigned = assignWorker(relayed, 'strike', 4)
    const assignedPlain = assignWorker(plain, 'strike', 4)
    expect(networkFillRate(assigned, 'strike')).toBeGreaterThan(networkFillRate(assignedPlain, 'strike'))
  })

  it('Strike Lattice improves Relay strength and Strike exponent, not a flat damage shop', () => {
    const relayOnly = sector(44)
    relayOnly.network.bars.strike.levels = 20
    relayOnly.network.bars['strike-relay'].levels = 16

    const latticed = sector(44)
    latticed.network.bars.strike.levels = 20
    latticed.network.bars['strike-relay'].levels = 16
    latticed.network.bars['strike-lattice'].levels = 9

    expect(networkLevelEffectiveness(latticed, 'strike')).toBeGreaterThan(
      networkLevelEffectiveness(relayOnly, 'strike'),
    )
    expect(networkExponent(latticed, 'strike')).toBeGreaterThan(networkExponent(relayOnly, 'strike'))
    expect(networkStrikeMult(latticed)).toBeGreaterThan(networkStrikeMult(relayOnly))

    const relayAssigned = assignWorker(latticed, 'strike-relay', 3)
    const relayPlain = assignWorker(relayOnly, 'strike-relay', 3)
    expect(networkFillRate(relayAssigned, 'strike-relay')).toBeGreaterThan(
      networkFillRate(relayPlain, 'strike-relay'),
    )
  })

  it('assigns drones onto Relays and fills them on a sortie', () => {
    let s = sector(12)
    s.combat.docked = false
    s = assignWorker(s, 'strike-relay', 3)
    expect(s.base.assignments['strike-relay']).toBe(3)
    tickNetwork(s, 40)
    expect(networkLevels(s, 'strike-relay')).toBeGreaterThan(0)
  })

  it('Rebuild wipes Relay levels and assignments, keeps Links and the corps', () => {
    let s = sector(12)
    s.combat.sector = 12
    s.resources.heat = 40
    s = buyNetworkLink(s, 'racks')
    s = assignWorker(s, 'strike-relay', 3)
    s.combat.docked = false
    tickNetwork(s, 40)
    expect(networkLevels(s, 'strike-relay')).toBeGreaterThan(0)
    const corps = s.base.workerDrones
    const racks = networkLinkRank(s, 'racks')

    s = performRebuild(s, {
      frameId: 'scout-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.network.bars['strike-relay'].levels).toBe(0)
    expect(s.network.bars.strike.levels).toBe(0)
    expect(s.base.assignments['strike-relay'] ?? 0).toBe(0)
    expect(s.base.workerDrones).toBe(corps)
    expect(networkLinkRank(s, 'racks')).toBe(racks)
  })

  it('hydrates missing Relay keys on old Network saves', () => {
    const s = sector(12)
    s.network.bars.strike.levels = 7
    const parsed = JSON.parse(decodeURIComponent(escape(atob(exportSave(s))))) as {
      network: { bars: Record<string, { progress: number; levels: number }> }
    }
    delete parsed.network.bars['strike-relay']
    delete parsed.network.bars['ward-lattice']
    const imported = importSave(btoa(unescape(encodeURIComponent(JSON.stringify(parsed)))))
    expect(imported).toBeTruthy()
    expect(imported!.network.bars.strike.levels).toBe(7)
    expect(imported!.network.bars['strike-relay']).toEqual({ progress: 0, levels: 0 })
    expect(imported!.network.bars['ward-lattice']).toEqual({ progress: 0, levels: 0 })
    expect(imported!.network.bars['archive-relay'].levels).toBe(0)
  })

  it('exposes identity Protocol formula hooks and diagnostics', () => {
    let s = sector(12)
    s = assignWorker(s, 'strike', 2)
    const hooks = networkFormulaHooks(s)
    expect(hooks).toEqual({
      fillGrowthMult: 1,
      droneEfficiencyMult: 1,
      relayEffectivenessMult: 1,
      exponentAdd: 0,
      fillCapMult: 1,
    })
    const diag = networkDiagnostics(s)
    expect(diag.drones).toBe(s.base.workerDrones)
    expect(diag.assigned).toBe(2)
    expect(diag.levels.strike).toBeGreaterThanOrEqual(0)
    expect(diag.fillRates.strike).toBeGreaterThan(0)
    expect(diag.multipliers.strike).toBeGreaterThanOrEqual(1)
  })

  it('bars crawl while docked and cycle on a sortie', () => {
    let dock = sector(1)
    dock.combat.docked = true
    dock = assignWorker(dock, 'strike', 4)

    let fly = sector(1)
    fly.combat.docked = false
    fly = assignWorker(fly, 'strike', 4)
    expect(networkFillRate(dock, 'strike')).toBeLessThan(networkFillRate(fly, 'strike'))

    tickNetwork(dock, 60)
    tickNetwork(fly, 60)
    expect(networkLevels(fly, 'strike')).toBeGreaterThan(networkLevels(dock, 'strike'))
  })
})

