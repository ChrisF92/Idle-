import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState, SAVE_VERSION } from './state'
import {
  abandonProtocol,
  enterProtocol,
  performRebuild,
  prestigeGainFor,
  setFurnaceChannel,
} from './actions'
import { tickAutomation } from './automation'
import { salvageFromKill } from './combat'
import { moduleUpgradeCost } from './catalog'
import { craftsForNextLevel, foundryCostMult } from './foundry'
import { furnaceChannelHeatCost, furnaceDamageMult } from './furnace'
import { hiveResearchNodeCost } from './hiveResearch'
import { networkFormulaHooks, networkStrikeMult } from './network'
import {
  STARTER_GUIDE_IDS,
  activeGuideStep,
} from './progression'
import { canBuyProcessNode, hasProcessMastery, hydrateProcessState } from './process'
import {
  PROTOCOL_MAX_RANK,
  PROTOCOLS,
  canEnterProtocol,
  emptyProtocolModifiers,
  protocolBestSector,
  protocolBonusMult,
  protocolCoreScalingAdd,
  protocolCumulativeLine,
  protocolGoalSector,
  protocolModifiers,
  protocolMutes,
  protocolNextRewards,
  protocolRank,
  tryCompleteProtocol,
} from './protocols'
import { exportSave, importSave } from './save'

function protocolDock(sectorEver = 18) {
  const s = createInitialState(0)
  s.meta.highestSectorEver = sectorEver
  s.combat.highestSector = sectorEver
  s.combat.docked = true
  s.combat.inFight = false
  return s
}

describe('Protocol formula rewards', () => {
  it('keeps save version and rank-0 formulas identical to the unranked game', () => {
    expect(SAVE_VERSION).toBe(33)
    const s = createInitialState(0)
    s.combat.sector = 10
    expect(protocolModifiers(s)).toEqual(emptyProtocolModifiers())
    expect(protocolBonusMult(s, 'network')).toBe(1)
    expect(moduleUpgradeCost(1, 'pulse-cannon')).toBe(Math.ceil(3 * 1.21))
    expect(moduleUpgradeCost(1, 'plate-layer')).toBe(Math.ceil(6 * 1.2))
    expect(salvageFromKill(1, false)).toBe(1)
    expect(salvageFromKill(4, false, 'A', s)).toBe(4)
    expect(craftsForNextLevel(10)).toBe(craftsForNextLevel(10, s))
    expect(foundryCostMult(6)).toBe(foundryCostMult(6, s))
    expect(hiveResearchNodeCost(0)).toBe(hiveResearchNodeCost(0, s))
    expect(prestigeGainFor(s)).toBe(6)
    expect(networkFormulaHooks(s)).toEqual({
      fillGrowthMult: 1,
      droneEfficiencyMult: 1,
      relayEffectivenessMult: 1,
      exponentAdd: 0,
      fillCapMult: 1,
    })
  })

  it('Mute Network ranks add exponent and later ease fill growth', () => {
    const s = createInitialState(0)
    s.network.bars.strike.levels = 12
    const strike0 = networkStrikeMult(s)
    s.protocols.ranks['mute-network'] = 1
    expect(networkFormulaHooks(s).exponentAdd).toBeCloseTo(0.02)
    expect(networkStrikeMult(s)).toBeGreaterThan(strike0)
    expect(protocolBonusMult(s, 'network')).toBe(1)

    s.protocols.ranks['mute-network'] = 3
    expect(networkFormulaHooks(s).exponentAdd).toBeCloseTo(0.035)
    expect(networkFormulaHooks(s).fillGrowthMult).toBeCloseTo(0.94)
    expect(protocolNextRewards(s, 'mute-network')[0]?.hook.kind).toBe('networkExponent')
    expect(protocolCumulativeLine(s, 'mute-network')).toMatch(/Network/)
  })

  it('Cold Foundry eases recipe XP and later research node cost', () => {
    const s = createInitialState(0)
    const need0 = craftsForNextLevel(10, s)
    s.protocols.ranks['cold-foundry'] = 1
    expect(craftsForNextLevel(10, s)).toBeLessThan(need0)
    s.protocols.ranks['cold-foundry'] = 7
    expect(hiveResearchNodeCost(3, s)).toBeLessThan(hiveResearchNodeCost(3))
  })

  it('Dead Furnace reduces Heat drain and Quiet Guns eases weapon Core scaling', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 5
    s.combat.highestSector = 5
    s.resources.heat = 8
    s = setFurnaceChannel(s, 'weapons', 1)
    const drain0 = furnaceChannelHeatCost(s, 'weapons')
    const dmg0 = furnaceDamageMult(s)
    expect(drain0).toBeGreaterThan(0)
    expect(dmg0).toBeGreaterThan(1)
    s.protocols.ranks['dead-furnace'] = 1
    expect(furnaceChannelHeatCost(s, 'weapons')).toBeCloseTo(drain0 * 0.94)
    s.protocols.ranks['dead-furnace'] = 3
    expect(furnaceDamageMult(s)).toBeGreaterThan(dmg0)

    const pulse10 = moduleUpgradeCost(10, 'pulse-cannon')
    s.protocols.ranks['quiet-guns'] = 1
    expect(protocolCoreScalingAdd(s, 'weapon')).toBeCloseTo(-0.01)
    expect(moduleUpgradeCost(10, 'pulse-cannon', protocolCoreScalingAdd(s, 'weapon'))).toBeLessThan(
      pulse10,
    )
  })

  it('Glass Ward and Dry Hold change rebuild Matter and salvage sector growth', () => {
    const s = createInitialState(0)
    s.combat.sector = 50
    const matter0 = prestigeGainFor(s)
    s.protocols.ranks['glass-ward'] = 4
    expect(prestigeGainFor(s)).toBeGreaterThan(matter0)

    const drop0 = salvageFromKill(40, false, 'A', createInitialState(0))
    s.protocols.ranks['dry-hold'] = 1
    expect(salvageFromKill(40, false, 'A', s)).toBeGreaterThan(drop0)
  })

  it('repeat clears raise the goal and stay meaningful through max rank', () => {
    const s = protocolDock()
    expect(protocolGoalSector(s, 'mute-network')).toBe(6)
    s.protocols.ranks['mute-network'] = 2
    expect(protocolGoalSector(s, 'mute-network')).toBe(8)
    s.protocols.ranks['mute-network'] = PROTOCOL_MAX_RANK
    expect(protocolNextRewards(s, 'mute-network')).toHaveLength(0)
    expect(canEnterProtocol(s, 'mute-network').reason).toBe('Maxed')
    expect(PROTOCOLS.every((p) => p.rewards.some((step) => step.at === 5))).toBe(true)
    expect(PROTOCOLS.every((p) => p.rewards.some((step) => step.at === 8))).toBe(true)
  })
})

describe('Protocol challenge runs', () => {
  it('wipes loadout, mutes the system, and ranks on the scaled goal', () => {
    let s = protocolDock()
    s.resources.salvage = 40
    s.shipyard.moduleLevels = { 'pulse-cannon': 3 }
    s.network.bars.strike.levels = 5
    s = enterProtocol(s, 'mute-network')
    expect(s.protocols.activeId).toBe('mute-network')
    expect(s.resources.salvage).toBe(0)
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)
    expect(s.network.bars.strike.levels).toBe(0)
    expect(s.combat.sector).toBe(1)
    expect(protocolMutes(s, 'network')).toBe(true)
    expect(networkStrikeMult(s)).toBe(1)

    s.combat.highestSector = 6
    tryCompleteProtocol(s)
    expect(s.protocols.activeId).toBeNull()
    expect(protocolRank(s, 'mute-network')).toBe(1)
    expect(protocolBestSector(s, 'mute-network')).toBeGreaterThanOrEqual(6)
    expect(protocolModifiers(s).networkExponentAdd).toBeCloseTo(0.02)

    s = enterProtocol(s, 'mute-network')
    s.combat.highestSector = 6
    tryCompleteProtocol(s)
    expect(protocolRank(s, 'mute-network')).toBe(1)
    s.combat.highestSector = 7
    tryCompleteProtocol(s)
    expect(protocolRank(s, 'mute-network')).toBe(2)
  })

  it('Quiet Guns, Glass Ward, and Dry Hold mute their systems', () => {
    let guns = enterProtocol(protocolDock(), 'quiet-guns')
    guns.shipyard.moduleLevels['pulse-cannon'] = 4
    const gunIds = computeShipStats(guns)
    expect(gunIds.damage).toBeGreaterThan(0)
    expect(protocolMutes(guns, 'weapons')).toBe(true)

    const open = protocolDock()
    open.shipyard.moduleLevels['pulse-cannon'] = 4
    expect(computeShipStats(open).damage).toBeGreaterThan(computeShipStats(guns).damage)

    let ward = enterProtocol(protocolDock(), 'glass-ward')
    ward.shipyard.moduleLevels['plate-layer'] = 4
    expect(protocolMutes(ward, 'shields')).toBe(true)
    expect(computeShipStats(ward).shieldMax).toBe(0)

    const dry = enterProtocol(protocolDock(), 'dry-hold')
    expect(protocolMutes(dry, 'salvage')).toBe(true)
    expect(salvageFromKill(8, false, 'A', dry)).toBe(0)
  })

  it('abandon records best sector and Rebuild keeps ranks plus best sector', () => {
    let s = enterProtocol(protocolDock(), 'cold-foundry')
    s.combat.highestSector = 5
    s.combat.sector = 5
    s = abandonProtocol(s)
    expect(s.protocols.activeId).toBeNull()
    expect(protocolBestSector(s, 'cold-foundry')).toBe(5)
    expect(protocolRank(s, 'cold-foundry')).toBe(0)

    s.protocols.ranks['mute-network'] = 3
    s.protocols.bestSector['mute-network'] = 11
    s.combat.sector = 4
    s = performRebuild(s, { frameId: 'scout-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(protocolRank(s, 'mute-network')).toBe(3)
    expect(protocolBestSector(s, 'mute-network')).toBe(11)
    expect(s.protocols.activeId).toBeNull()
  })

  it('hydrates old Protocol saves that lack bestSector', () => {
    let s = createInitialState(0)
    s.protocols.ranks['mute-network'] = 2
    const parsed = JSON.parse(decodeURIComponent(escape(atob(exportSave(s))))) as {
      protocols: { ranks: Record<string, number>; bestSector?: Record<string, number> }
    }
    delete parsed.protocols.bestSector
    const imported = importSave(btoa(unescape(encodeURIComponent(JSON.stringify(parsed)))))
    expect(imported).toBeTruthy()
    expect(imported!.protocols.ranks['mute-network']).toBe(2)
    expect(imported!.protocols.bestSector).toEqual({})
    expect(protocolModifiers(imported!).networkExponentAdd).toBeCloseTo(0.035)
  })
})

describe('Protocol Process automation and onboarding', () => {
  it('refuses automated entry until the first hand clear', () => {
    const locked = protocolDock()
    locked.resources.aiPoints = 20
    expect(hasProcessMastery(locked, 'protocols')).toBe(false)
    expect(canBuyProcessNode(locked, 'protocol-repeat').reason).toBe('Clear a Protocol first')

    const s = protocolDock()
    s.process.purchased = ['protocol-repeat']
    s.process.config.sortie.protocolRepeat = true
    s.process.config.sortie.lastProtocolId = 'mute-network'
    expect(canEnterProtocol(s, 'mute-network', { automated: true }).ok).toBe(false)

    tickAutomation(s)
    expect(s.protocols.activeId).toBeNull()

    s.protocols.ranks['mute-network'] = 1
    expect(canEnterProtocol(s, 'mute-network', { automated: true }).ok).toBe(true)
    tickAutomation(s)
    expect(s.protocols.activeId).toBe('mute-network')
  })

  it('grantProcessPrereqs fills Protocol Repeat under Presets', () => {
    const hydrated = hydrateProcessState({ purchased: ['protocol-presets'] } as never)
    expect(hydrated.purchased).toContain('protocol-repeat')
    expect(hydrated.purchased).toContain('protocol-presets')
    expect(hydrated.config.sortie.protocolId).toBeNull()
  })

  it('does not force a Protocol formula tour', () => {
    let s = protocolDock()
    s.meta.seenOnboarding = [...STARTER_GUIDE_IDS]
    expect(activeGuideStep(s, 'protocols')).toBeNull()
  })
})
