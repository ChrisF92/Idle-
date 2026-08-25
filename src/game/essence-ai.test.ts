import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import { buyAiNode, buyEssenceUpgrade, buyResearch, performPrestige } from './actions'
import { startCombat } from './tick'
import { computeFightDamage } from './combat'
import {
  essenceBossEssenceMultiplier,
  essenceDamageMultiplier,
  essenceProductionMultiplier,
  essenceAlloyUpkeepMult,
} from './catalog'
import { clearSector } from './testHelpers'
import { bossWaveForBand } from './waves'

describe('essence upgrades', () => {
  it('lattice boosts boss essence, not combat damage', () => {
    let state = createInitialState(0)
    const beforeDmg = computeShipStats(state).damage
    state.resources.essence = 2
    state = buyEssenceUpgrade(state, 'essence-lattice')
    expect(state.essence.purchased).toContain('essence-lattice')
    expect(computeShipStats(state).damage).toBe(beforeDmg)
    expect(essenceDamageMultiplier(state.essence.purchased)).toBe(1)
    expect(essenceBossEssenceMultiplier(state.essence.purchased)).toBeGreaterThan(1)
  })

  it('catalyst reduces alloy upkeep, not production', () => {
    let state = createInitialState(0)
    state.resources.essence = 3
    state = buyEssenceUpgrade(state, 'catalyst-feed')
    expect(state.essence.purchased).toContain('catalyst-feed')
    expect(essenceProductionMultiplier(state.essence.purchased)).toBe(1)
    expect(essenceAlloyUpkeepMult(state.essence.purchased)).toBeLessThan(1)
  })

  it('keeps essence upgrades across prestige', () => {
    let state = createInitialState(0)
    state.resources.essence = 5
    state = buyEssenceUpgrade(state, 'essence-lattice')
    state.combat.sector = 10
    state = performPrestige(state, 1000)
    expect(state.essence.purchased).toContain('essence-lattice')
    expect(state.resources.essence).toBeGreaterThanOrEqual(0)
  })

  it('research boss-harvester needs essence', () => {
    let state = createInitialState(0)
    state.resources.data = 100
    state.resources.essence = 0
    state = buyResearch(state, 'boss-harvester')
    expect(state.research.unlocked).not.toContain('boss-harvester')

    state.resources.essence = 1
    state = buyResearch(state, 'boss-harvester')
    expect(state.research.unlocked).toContain('boss-harvester')
  })
})

describe('AI doctrines', () => {
  it('focus-fire increases ship damage', () => {
    let state = createInitialState(0)
    const before = computeShipStats(state).damage
    state.resources.aiPoints = 2
    state = buyAiNode(state, 'focus-fire')
    expect(computeShipStats(state).damage).toBeGreaterThan(before)
  })

  it('boss-protocol boosts boss damage', () => {
    let state = createInitialState(0)
    state.resources.aiPoints = 3
    state = buyAiNode(state, 'boss-protocol')
    state.combat.wave = bossWaveForBand(5)
    state = startCombat(state)
    expect(state.combat.isBoss).toBe(true)
    const notes = computeFightDamage(state).matchupNotes.join(' ')
    expect(notes).toContain('Boss Doctrine')
  })

  it('scavenger increases scrap rewards', () => {
    let state = createInitialState(0)
    state.resources.aiPoints = 2
    state = buyAiNode(state, 'scavenger')
    state = startCombat(state)
    const scrapBefore = state.resources.scrap
    state = clearSector(state)
    expect(state.resources.scrap - scrapBefore).toBeGreaterThan(5)
  })
})
