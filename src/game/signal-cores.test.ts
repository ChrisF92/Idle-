import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  enterChallenge,
  performPrestige,
  tryCompleteChallenge,
} from './actions'
import {
  canEquipSignalCore,
  computeSignalCoreBonuses,
  equipSignalCore,
  getSignalCoreDef,
  grantSignalCoreDrop,
  makeSignalCoreInstance,
  mergeSignalCores,
  signalCoresUnlocked,
  unequipAllSignalCores,
} from './signalCores'
import { CHALLENGES, getChallenge, isChallengeUnlocked } from './catalog'

describe('Signal Cores', () => {
  it('equip in allowed slot applies bonus; wrong slot rejected', () => {
    let state = createInitialState(0)
    const core = makeSignalCoreInstance('kinetic-shard', 1)
    state.signalCores.inventory = [core]

    const rejected = equipSignalCore(state, core.uid, 'ward-0')
    expect(rejected).toBe(state)
    expect(canEquipSignalCore(state, core.uid, 'ward-0')).toBe(false)

    state = equipSignalCore(state, core.uid, 'assault-0')
    expect(state.signalCores.equipped['assault-0']).toBe(core.uid)
    const bonuses = computeSignalCoreBonuses(state)
    expect(bonuses.damage).toBeGreaterThan(0)
    expect(computeShipStats(state).damage).toBeGreaterThan(
      computeShipStats(createInitialState(0)).damage,
    )
  })

  it('merge 3× rank1 → 1× rank2', () => {
    let state = createInitialState(0)
    state.signalCores.inventory = [
      makeSignalCoreInstance('salvage-ping', 1),
      makeSignalCoreInstance('salvage-ping', 1),
      makeSignalCoreInstance('salvage-ping', 1),
    ]
    state = mergeSignalCores(state, 'salvage-ping', 1)
    expect(state.signalCores.inventory).toHaveLength(1)
    expect(state.signalCores.inventory[0]!.defId).toBe('salvage-ping')
    expect(state.signalCores.inventory[0]!.rank).toBe(2)
  })

  it('prestige wipes without carryOver; keeps with flag', () => {
    let state = createInitialState(0)
    const a = makeSignalCoreInstance('ablative-echo', 2)
    const b = makeSignalCoreInstance('kinetic-shard', 1)
    state.signalCores.inventory = [a, b]
    state.signalCores.equipped = { 'ward-0': a.uid }
    state.combat.sector = 10
    state.meta.highestSectorEver = 8

    state = performPrestige(state, 1000)
    expect(state.signalCores.inventory).toHaveLength(0)
    expect(Object.keys(state.signalCores.equipped)).toHaveLength(0)

    let kept = createInitialState(0)
    const c = makeSignalCoreInstance('freight-beacon', 3)
    kept.signalCores.inventory = [c]
    kept.signalCores.equipped = { 'signal-0': c.uid }
    kept.meta.signalCoresCarryOver = true
    kept.combat.sector = 10
    kept.meta.highestSectorEver = 8
    kept = performPrestige(kept, 2000)
    expect(kept.signalCores.inventory).toHaveLength(1)
    expect(kept.signalCores.inventory[0]!.defId).toBe('freight-beacon')
    expect(kept.signalCores.inventory[0]!.rank).toBe(3)
    expect(kept.signalCores.equipped['signal-0']).toBe(c.uid)
    expect(kept.meta.signalCoresCarryOver).toBe(true)
  })

  it('Null Signal blocks equip; first clear sets carryOver', () => {
    expect(getChallenge('null-signal')?.goalSector).toBe(30)
    expect(getChallenge('null-signal')?.rewardChallengePoints).toBe(4)
    expect(getChallenge('null-signal')?.maxClears).toBe(5)

    const locked = createInitialState(0)
    expect(isChallengeUnlocked(locked, 'null-signal')).toBe(false)
    locked.meta.highestSectorEver = 25
    expect(isChallengeUnlocked(locked, 'null-signal')).toBe(false)
    locked.meta.act1Cleared = true
    expect(isChallengeUnlocked(locked, 'null-signal')).toBe(true)
    expect(getChallenge('null-signal')?.entryCost).toBe('ascension')

    let state = createInitialState(0)
    state.prestige.prestigeCount = 3
    state.meta.act1Cleared = true
    state.combat.sector = 30
    state.meta.highestSectorEver = 30
    const core = makeSignalCoreInstance('kinetic-shard', 1)
    state.signalCores.inventory = [core]
    state.signalCores.equipped = { 'assault-0': core.uid }
    state.meta.signalCoresCarryOver = true

    const beforeAscensions = state.meta.ascensionCount
    state = enterChallenge(state, 'null-signal', 3000)
    expect(state.prestige.activeChallengeId).toBe('null-signal')
    expect(state.meta.ascensionCount).toBe(beforeAscensions + 1)
    expect(Object.keys(state.signalCores.equipped)).toHaveLength(0)
    expect(state.signalCores.inventory).toHaveLength(1)
    expect(canEquipSignalCore(state, core.uid, 'assault-0')).toBe(false)
    const blocked = equipSignalCore(state, state.signalCores.inventory[0]!.uid, 'assault-0')
    expect(blocked.signalCores.equipped['assault-0']).toBeUndefined()

    state.combat.highestSector = 30
    tryCompleteChallenge(state)
    expect(state.meta.signalCoresCarryOver).toBe(true)
    expect(state.prestige.activeChallengeId).toBeNull()
    expect(state.prestige.challengeClears['null-signal']).toBe(1)
    expect(state.resources.challengePoints).toBeGreaterThanOrEqual(4)
  })

  it('gates drops until prestige or career sector 10', () => {
    const locked = createInitialState(0)
    expect(signalCoresUnlocked(locked)).toBe(false)
    expect(
      grantSignalCoreDrop(locked, 'kill', { family: 'swarm', rng: () => 0 }),
    ).toBeNull()
    expect(locked.signalCores.inventory).toHaveLength(0)

    locked.meta.highestSectorEver = 10
    expect(signalCoresUnlocked(locked)).toBe(true)

    const viaPrestige = createInitialState(0)
    viaPrestige.prestige.prestigeCount = 1
    expect(signalCoresUnlocked(viaPrestige)).toBe(true)
  })

  it('drop helper adds to inventory when unlocked', () => {
    const state = createInitialState(0)
    state.prestige.prestigeCount = 1
    const drop = grantSignalCoreDrop(state, 'kill', {
      family: 'swarm',
      rng: () => 0, // always succeed + first weighted pick
    })
    expect(drop).not.toBeNull()
    expect(state.signalCores.inventory).toHaveLength(1)
    expect(getSignalCoreDef(drop!.defId)?.rarity).toBe('common')

    const before = state.signalCores.inventory.length
    const sectorDrop = grantSignalCoreDrop(state, 'sector', { rng: () => 0 })
    expect(sectorDrop).not.toBeNull()
    expect(state.signalCores.inventory.length).toBe(before + 1)

    unequipAllSignalCores(state)
    expect(Object.keys(state.signalCores.equipped)).toHaveLength(0)
  })

  it('all challenges target sector 30', () => {
    for (const c of CHALLENGES) {
      expect(c.goalSector).toBe(30)
    }
  })
})
