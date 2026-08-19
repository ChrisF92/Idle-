import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { buyChallengeShop, buyMatterShop } from './actions'
import {
  ENEMY_PART_DROPS,
  challengeShopDropBonus,
  matterShopDropBonus,
  shopRank,
} from './catalog'
import { rollEnemyPartDrop } from './combat'
import type { GameState } from './types'

/** Research + career gate so Alloy Foundry (and thus part drops) are live. */
function withFoundry(state: GameState, sector = 22): GameState {
  state.meta.highestSectorEver = sector
  state.combat.highestSector = sector
  state.combat.sector = sector
  return state
}

describe('blueprint part drop rates', () => {
  it('keeps base family chances sparse', () => {
    const byFamily = Object.fromEntries(
      ENEMY_PART_DROPS.map((t) => [t.family, t.chance]),
    )
    expect(byFamily.swarm).toBeLessThanOrEqual(0.03)
    expect(byFamily.armored).toBeLessThanOrEqual(0.03)
    expect(byFamily.ethereal).toBeLessThanOrEqual(0.03)
    expect(byFamily.divine).toBeLessThanOrEqual(0.03)
    expect(byFamily.titan).toBeLessThanOrEqual(0.08)
  })

  it('blocks part drops until Foundry is open', () => {
    const locked = createInitialState(0)
    const hits = rollEnemyPartDrop(
      locked,
      { family: 'swarm', isBoss: true, name: 'Boss' },
      () => 0,
    )
    expect(hits).toHaveLength(0)
    expect(Object.keys(locked.parts)).toHaveLength(0)
  })

  it('matter Fragment Magnet and CP Loot Protocols buff drop chance', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 4
    state = buyMatterShop(state, 'fragment-magnet')
    expect(shopRank(state.prestige.matterShop, 'fragment-magnet')).toBe(1)
    expect(matterShopDropBonus(state.prestige.matterShop)).toBeCloseTo(0.1)

    state.prestige.prestigeCount = 1
    state.resources.challengePoints = 2
    state = buyChallengeShop(state, 'loot-protocols')
    expect(challengeShopDropBonus(state.prestige.shop)).toBeCloseTo(0.15)
  })

  it('shop drop bonus increases successful rolls vs unbuffed', () => {
    const bare = withFoundry(createInitialState(0))
    const buffed = withFoundry(createInitialState(0))
    buffed.prestige.matterShop = { 'fragment-magnet': 10 }
    // rng > chance fails. Bare swarm 2.8% after the early-career taper; rank-10 magnet ≈ 4.2%+.
    const bareHits = rollEnemyPartDrop(
      bare,
      { family: 'swarm', isBoss: false, name: 'Drone' },
      () => 0.035,
    )
    const buffHits = rollEnemyPartDrop(
      buffed,
      { family: 'swarm', isBoss: false, name: 'Drone' },
      () => 0.035,
    )
    expect(bareHits.length).toBe(0)
    expect(buffHits.length).toBeGreaterThan(0)
  })
})
