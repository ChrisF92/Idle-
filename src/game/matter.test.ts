import { describe, expect, it } from 'vitest'
import { buyMatterShop, enterChallenge, performRebuild } from './actions'
import { computeShipStats, createInitialState } from './state'
import { armRebuildDoor, markHullLost } from './testHelpers'
import { setDocked, advanceSeconds, beginFight } from './tick'
import {
  MATTER_SHOP,
  TIME_COMPRESSION_I_COST,
  TIME_COMPRESSION_II_COST,
  TIME_COMPRESSION_III_COST,
  availableTimeCompressionSpeeds,
  canBuyMatterShop,
  combatScrapMatterMult,
  foundryThroughputMult,
  matterHullMult,
  matterShieldMult,
  matterWorkerCapacityBonus,
  reconstitutionStartingScrap,
  sortieProvisioningSalvage,
  weaponCalibrationMult,
} from './matter'
import { droneCap } from './catalog'
import { targetingServosContribution, matterTraverseContribution, collectTargetingModifiers, composeTargetingModifiers } from './coreTargeting'

describe('Matter shop catalogue', () => {
  it('contains only the canonical twelve nodes', () => {
    expect(MATTER_SHOP.map((row) => row.id)).toEqual([
      'weapon-calibration',
      'traverse-actuators',
      'structural-memory',
      'field-memory',
      'recovery-charter',
      'foundry-throughput',
      'worker-racks',
      'reconstitution-cache',
      'sortie-provisioning',
      'time-compression-1',
      'time-compression-2',
      'time-compression-3',
    ])
    expect(MATTER_SHOP.find((row) => row.id === 'weapon-calibration')?.maxRank).toBe(5)
    expect(MATTER_SHOP.find((row) => row.id === 'traverse-actuators')?.maxRank).toBe(4)
    expect(MATTER_SHOP.find((row) => row.id === 'worker-racks')?.maxRank).toBe(4)
    expect(MATTER_SHOP.find((row) => row.id === 'time-compression-1')?.costs).toEqual([TIME_COMPRESSION_I_COST])
    expect(MATTER_SHOP.find((row) => row.id === 'time-compression-2')?.costs).toEqual([TIME_COMPRESSION_II_COST])
    expect(MATTER_SHOP.find((row) => row.id === 'time-compression-3')?.costs).toEqual([TIME_COMPRESSION_III_COST])
    expect(MATTER_SHOP.some((row) => /gain|blade|forge|tempo|clock|kit/.test(row.id))).toBe(false)
  })

  it('requires Time Compression in order', () => {
    const s = createInitialState(0)
    s.resources.prestigeMatter = 200
    expect(canBuyMatterShop(s, 'time-compression-2').ok).toBe(false)
    expect(canBuyMatterShop(s, 'time-compression-3').ok).toBe(false)
    const i = buyMatterShop(s, 'time-compression-1')
    expect(i.prestige.matterShop['time-compression-1']).toBe(1)
    expect(canBuyMatterShop(i, 'time-compression-2').ok).toBe(true)
    const ii = buyMatterShop(i, 'time-compression-2')
    expect(canBuyMatterShop(ii, 'time-compression-3').ok).toBe(true)
  })

  it('gives unspent Matter no combat or industry power', () => {
    const a = createInitialState(0)
    a.prestige.matterShop = { 'weapon-calibration': 1 }
    const b = structuredClone(a)
    a.resources.prestigeMatter = 0
    b.resources.prestigeMatter = 500
    expect(computeShipStats(a).damage).toBe(computeShipStats(b).damage)
    expect(computeShipStats(a).hullMax).toBe(computeShipStats(b).hullMax)
  })
})

describe('Matter effects', () => {
  it('Weapon Calibration raises weapon-Core output only modestly', () => {
    const a = createInitialState(0)
    const b = structuredClone(a)
    b.prestige.matterShop = { 'weapon-calibration': 1 }
    expect(weaponCalibrationMult(b)).toBeCloseTo(1.04)
    expect(computeShipStats(b).damage).toBeGreaterThan(computeShipStats(a).damage)
  })

  it('Traverse Actuators raise slew only', () => {
    const a = createInitialState(0)
    const b = structuredClone(a)
    b.prestige.matterShop = { 'traverse-actuators': 2 }
    const am = composeTargetingModifiers(collectTargetingModifiers(a, { moduleId: 'pulse-cannon' } as never))
    const bm = composeTargetingModifiers(collectTargetingModifiers(b, { moduleId: 'pulse-cannon' } as never))
    expect(matterTraverseContribution(b).slewRateMult).toBeGreaterThan(1)
    expect(targetingServosContribution(a).acquisitionRangeMult ?? 1).toBe(1)
    expect(bm.slewRateMult).toBeGreaterThan(am.slewRateMult ?? 1)
  })

  it('Worker Racks raise capacity without fabricating Workers', () => {
    const s = createInitialState(0)
    s.base.workerDrones = 8
    const before = droneCap(s)
    s.prestige.matterShop = { 'worker-racks': 1 }
    expect(matterWorkerCapacityBonus(s)).toBe(1)
    expect(droneCap(s)).toBe(before + 1)
    expect(s.base.workerDrones).toBe(8)
  })

  it('Reconstitution Cache starts Scrap that is not cycle-generated', () => {
    let s = armRebuildDoor(markHullLost(createInitialState(0)))
    s.prestige.matterShop = { 'reconstitution-cache': 2 }
    expect(reconstitutionStartingScrap(s)).toBe(48)
    s = performRebuild(s, { frameId: s.shipyard.frameId, modules: s.shipyard.modules })
    expect(s.resources.scrap).toBe(48)
    expect(s.prestige.cycle.scrapGenerated).toBe(0)
  })

  it('Sortie Provisioning grants Salvage once per normal launch', () => {
    let s = markHullLost(createInitialState(0))
    s.prestige.matterShop = { 'sortie-provisioning': 2 }
    s.resources.salvage = 99
    expect(sortieProvisioningSalvage(s)).toBe(16)
    expect(MATTER_SHOP.find((row) => row.id === 'sortie-provisioning')?.description).not.toMatch(
      /Challenges suppress/i,
    )
    s = setDocked(s, false)
    expect(s.resources.salvage).toBe(16)
    expect(s.combat.sortieMark?.provisioningGranted).toBe(true)
    const mid = s.resources.salvage
    s = structuredClone(s)
    s.combat.sortiePaused = true
    expect(s.resources.salvage).toBe(mid)
    beginFight(s)
    expect(s.resources.salvage).toBe(16)
    expect(s.combat.sortieMark?.provisioningGranted).toBe(true)
  })

  it('grants only Matter Sortie Provisioning on a normal Rebuild or launch', () => {
    let s = armRebuildDoor(markHullLost(createInitialState(0)))
    s.prestige.matterShop = { 'sortie-provisioning': 2 }
    s = performRebuild(s, { frameId: s.shipyard.frameId, modules: s.shipyard.modules })
    expect(s.resources.salvage).toBe(0)
    s = setDocked(s, false)
    expect(s.resources.salvage).toBe(16)
  })

  it('Sortie Provisioning grants Salvage once on a Challenge Sortie', () => {
    let s = markHullLost(createInitialState(0))
    s.meta.act1Cleared = true
    s.meta.bestWave = 1000
    s.prestige.matterShop = { 'sortie-provisioning': 2 }
    s.combat.docked = true
    s = enterChallenge(s, 'glass-frame')
    expect(s.challenges.activeId).toBe('glass-frame')
    expect(s.resources.salvage).toBe(0)
    s = setDocked(s, false)
    expect(s.combat.sortieMark?.challengeSortie).toBe(true)
    expect(s.resources.salvage).toBe(16)
    expect(s.combat.sortieMark?.provisioningGranted).toBe(true)
    beginFight(s)
    expect(s.resources.salvage).toBe(16)
  })

  it('does not add a legacy Challenge-shop kit to Matter Sortie Provisioning', () => {
    let s = markHullLost(createInitialState(0))
    s.meta.act1Cleared = true
    s.meta.bestWave = 1000
    s.prestige.matterShop = { 'sortie-provisioning': 2 }
    s.combat.docked = true
    s = enterChallenge(s, 'glass-frame')
    expect(s.resources.salvage).toBe(0)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.sortieMark?.provisioningGranted).toBeFalsy()
    s = setDocked(s, false)
    expect(s.resources.salvage).toBe(16)
    expect(s.combat.sortieMark?.provisioningGranted).toBe(true)
    expect(s.combat.sortieMark?.challengeSortie).toBe(true)
    beginFight(s)
    expect(s.resources.salvage).toBe(16)
  })

  it('Recovery Charter boosts combat Scrap and not Worker Scrap', () => {
    const a = createInitialState(0)
    a.base.assignments = { 'scrap-field': 4 }
    a.base.workerDrones = 4
    a.meta.bestWave = 40
    a.combat.bestWave = 40
    const b = structuredClone(a)
    b.prestige.matterShop = { 'recovery-charter': 5 }
    expect(combatScrapMatterMult(b)).toBeGreaterThan(1)
    const a0 = a.resources.scrap
    const b0 = b.resources.scrap
    advanceSeconds(a, 10)
    advanceSeconds(b, 10)
    expect(a.resources.scrap - a0).toBeCloseTo(b.resources.scrap - b0, 5)
  })

  it('Foundry Throughput does not change Research duration', () => {
    const a = createInitialState(0)
    const b = structuredClone(a)
    b.prestige.matterShop = { 'foundry-throughput': 5 }
    expect(foundryThroughputMult(b)).toBeGreaterThan(1)
    expect(matterHullMult(b)).toBe(1)
    expect(matterShieldMult(b)).toBe(1)
  })
})

describe('Time Compression options', () => {
  it('unlocks 1 / 1.5 / 2 / 3', () => {
    const s = createInitialState(0)
    expect(availableTimeCompressionSpeeds(s)).toEqual([1])
    s.prestige.matterShop = { 'time-compression-1': 1 }
    expect(availableTimeCompressionSpeeds(s)).toEqual([1, 1.5])
    s.prestige.matterShop['time-compression-2'] = 1
    expect(availableTimeCompressionSpeeds(s)).toEqual([1, 1.5, 2])
    s.prestige.matterShop['time-compression-3'] = 1
    expect(availableTimeCompressionSpeeds(s)).toEqual([1, 1.5, 2, 3])
  })
})
