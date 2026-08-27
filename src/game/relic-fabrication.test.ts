import { afterEach, describe, expect, it } from 'vitest'
import { startFabrication, upgradeRelic } from './actions'
import {
  blueprintLifecycle,
  discoverBlueprint,
  physicalProductOwned,
  getBlueprint,
} from './blueprints'
import { ACT1_CADENCE } from './cadence'
import { canStartFabrication, tickFoundry } from './foundry'
import { RELIC_FABRICATION_RECIPES } from './foundryCatalogue'
import { applyOfflineCatchUp } from './offline'
import {
  addRelicInstance,
  canStartRelicUpgrade,
  physicalRelicOwned,
  relicFamilyOwnedCount,
  relicState,
  setRelicSocketActivationProvider,
} from './relics'
import { RELIC_DESIGN_PENDING_LABEL, RELIC_FAMILIES, isRelicFamilyFabricatable } from './relicCatalogue'
import { relicTier1Recipe, relicUpgradeJobId, relicUpgradeRecipe } from './relicSeeds'
import { setRelicTemperCapabilityProvider } from './relicSources'
import {
  FIXTURE_POWER_STANDARD,
  installAuthoredRelicFixtures,
  resetRelicTestFixtures,
} from './relicTestFixtures'
import { createInitialState } from './state'
import { atCareerWave, equipPostTutorialLoadout } from './testHelpers'

function relicFoundry() {
  let s = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
  s = equipPostTutorialLoadout(s)
  s.combat.docked = true
  return s
}

function stock(state: ReturnType<typeof createInitialState>, materials: Record<string, number>) {
  for (const [id, n] of Object.entries(materials)) state.foundry.materials[id] = n
}

afterEach(() => {
  setRelicTemperCapabilityProvider(null)
  setRelicSocketActivationProvider(null)
  resetRelicTestFixtures()
})

describe('PR6 Relic fabrication', () => {
  it('does not fabricate pending-design final families even after Blueprint discovery', () => {
    const s = relicFoundry()
    expect(blueprintLifecycle(s, 'power-coupler')).toBe('unknown')
    expect(canStartFabrication(s, 'relic', 'power-coupler').ok).toBe(false)
    discoverBlueprint(s, 'power-coupler')
    expect(blueprintLifecycle(s, 'power-coupler')).toBe('discovered')
    expect(physicalProductOwned(s, getBlueprint('power-coupler')!)).toBe(false)
    stock(s, { 'conductive-filament': 8, 'recovered-stock': 4 })
    expect(canStartFabrication(s, 'relic', 'power-coupler').ok).toBe(false)
    expect(canStartFabrication(s, 'relic', 'power-coupler').reason).toBe(RELIC_DESIGN_PENDING_LABEL)
    for (const row of RELIC_FAMILIES) {
      expect(isRelicFamilyFabricatable(row)).toBe(false)
      expect(relicTier1Recipe(row.id)).toBeNull()
    }
    expect(RELIC_FABRICATION_RECIPES).toHaveLength(20)
  })

  it('does not create a Relic from Blueprint discovery alone', () => {
    const s = relicFoundry()
    discoverBlueprint(s, 'reinforcement-plate')
    expect(relicState(s).instances).toHaveLength(0)
    expect(blueprintLifecycle(s, 'reinforcement-plate')).toBe('discovered')
  })

  it('rejects unknown Relic jobs and Challenge Relics until their source exists', () => {
    const s = relicFoundry()
    expect(canStartFabrication(s, 'relic', 'any').ok).toBe(false)
    expect(canStartFabrication(s, 'relic', 'battle-chip').ok).toBe(false)
    expect(blueprintLifecycle(s, 'tracking-gimbal')).toBe('unknown')
    expect(canStartFabrication(s, 'relic', 'tracking-gimbal').ok).toBe(false)
  })

  it('fabricates a fully-authored fixture Relic through the Foundry relic kind', () => {
    installAuthoredRelicFixtures()
    let s = relicFoundry()
    stock(s, { 'conductive-filament': 8, 'recovered-stock': 4 })
    const recipe = relicTier1Recipe(FIXTURE_POWER_STANDARD.id)!
    expect(recipe).toBeTruthy()
    expect(canStartFabrication(s, 'relic', FIXTURE_POWER_STANDARD.id).ok).toBe(true)
    s = startFabrication(s, 'relic', FIXTURE_POWER_STANDARD.id)
    tickFoundry(s, recipe.craftTime)
    expect(relicState(s).instances).toHaveLength(1)
    expect(relicState(s).instances[0]).toEqual({
      id: `${FIXTURE_POWER_STANDARD.id}:1`,
      familyId: FIXTURE_POWER_STANDARD.id,
      tier: 1,
    })
    s = startFabrication(s, 'relic', FIXTURE_POWER_STANDARD.id)
    tickFoundry(s, recipe.craftTime)
    expect(relicFamilyOwnedCount(s, FIXTURE_POWER_STANDARD.id)).toBe(2)
    expect(relicState(s).instances.map((row) => row.id)).toEqual([
      `${FIXTURE_POWER_STANDARD.id}:1`,
      `${FIXTURE_POWER_STANDARD.id}:2`,
    ])
    expect(physicalRelicOwned(s, FIXTURE_POWER_STANDARD.id)).toBe(true)
  })

  it('does not apply Core-copy discounts to Relic jobs', () => {
    installAuthoredRelicFixtures()
    const s = relicFoundry()
    addRelicInstance(s, FIXTURE_POWER_STANDARD.id)
    stock(s, { 'conductive-filament': 4, 'recovered-stock': 2 })
    const first = canStartFabrication(s, 'relic', FIXTURE_POWER_STANDARD.id)
    expect(first.ok).toBe(true)
    expect(first.cost).toEqual(relicTier1Recipe(FIXTURE_POWER_STANDARD.id)?.costs)
  })

  it('transforms a fitted Relic on upgrade completion without duplicating', () => {
    installAuthoredRelicFixtures()
    let s = relicFoundry()
    const relic = addRelicInstance(s, FIXTURE_POWER_STANDARD.id)!
    setRelicTemperCapabilityProvider({
      canUpgradeRelicToTier2: () => true,
      canUpgradeRelicToTier3: () => true,
    })
    const t2 = relicUpgradeRecipe(FIXTURE_POWER_STANDARD.id, 2)
    stock(s, {
      'conductive-filament': 40,
      'recovered-stock': 20,
      'phase-crystal': 4,
    })
    expect(canStartRelicUpgrade(s, relic.id).ok).toBe(true)
    s = upgradeRelic(s, relic.id)
    expect(s.foundry.fabrication[0]?.targetRelicId).toBe(relic.id)
    expect(s.foundry.fabrication[0]?.jobId).toBe(relicUpgradeJobId(relic.id, 2))
    s.lastTickAt = 0
    const { state: next } = applyOfflineCatchUp(s, t2.craftTime * 1000)
    expect(relicState(next).instances).toHaveLength(1)
    expect(relicState(next).instances[0]?.tier).toBe(2)
    expect(relicState(next).instances[0]?.id).toBe(relic.id)
  })

  it('does not let Relics run before the Relic system door', () => {
    installAuthoredRelicFixtures()
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    stock(s, { 'conductive-filament': 8, 'recovered-stock': 4 })
    expect(canStartFabrication(s, 'relic', FIXTURE_POWER_STANDARD.id).ok).toBe(false)
    expect(canStartFabrication(s, 'relic', FIXTURE_POWER_STANDARD.id).reason).toMatch(/320/)
    expect(canStartFabrication(s, 'relic', 'power-coupler').ok).toBe(false)
  })
})
