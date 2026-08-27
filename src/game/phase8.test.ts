import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState, SAVE_VERSION } from './state'
import {
  abandonProtocol,
  buyEchoNode,
  buyProcessNode,
  enterEcho,
  enterProtocol,
  performRebuild,
} from './actions'
import { networkStrikeMult } from './network'
import { foundryDamageMult } from './foundry'
import { isSystemUnlocked } from './progression'
import { PROTOCOL_UNLOCK_SECTOR, protocolMutes, protocolRank, tryCompleteProtocol } from './protocols'
import { ECHO_UNLOCK_SECTOR, echoClears, echoHasNode, tryCompleteEcho, wavesForRun } from './echo'
import { hasProcess } from './process'
import { applyOfflineCatchUp } from './offline'
import { beginFight } from './tick'

describe('phase 8: Protocols, Echo, Process', () => {
  it('bumps save and keeps Protocols / Echo locked until 52 / 62', () => {
    expect(SAVE_VERSION).toBe(46)
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'protocols')).toBe(false)
    expect(isSystemUnlocked(fresh, 'echo')).toBe(false)
    expect(isSystemUnlocked(fresh, 'process')).toBe(false)
    fresh.meta.highestSectorEver = PROTOCOL_UNLOCK_SECTOR
    expect(isSystemUnlocked(fresh, 'protocols')).toBe(true)
    expect(isSystemUnlocked(fresh, 'echo')).toBe(false)
    fresh.meta.highestSectorEver = ECHO_UNLOCK_SECTOR
    fresh.protocols.ranks['mute-network'] = 1
    expect(isSystemUnlocked(fresh, 'echo')).toBe(false)
  })

  it('opens Process only after its sector, Rebuild and Research mastery gates', () => {
    const s = createInitialState(0)
    s.meta.aiUnlocked = true
    expect(isSystemUnlocked(s, 'process')).toBe(false)
    s.meta.highestSectorEver = 42
    s.prestige.prestigeCount = 2
    s.research.unlocked.push('basic-optics')
    expect(isSystemUnlocked(s, 'process')).toBe(true)
  })

  it('Protocol start wipes cores and mutes the system until the goal sector', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 52
    s.combat.docked = true
    s.resources.salvage = 40
    s.network.bars.strike.levels = 5
    const dmgBefore = computeShipStats(s).damage
    expect(networkStrikeMult(s)).toBeGreaterThan(1)

    s = enterProtocol(s, 'mute-network')
    expect(s.protocols.activeId).toBe('mute-network')
    expect(s.resources.salvage).toBe(0)
    expect(s.network.bars.strike.levels).toBe(0)
    expect(protocolMutes(s, 'network')).toBe(true)
    expect(networkStrikeMult(s)).toBe(1)
    expect(computeShipStats(s).damage).toBeLessThanOrEqual(dmgBefore)

    tryCompleteProtocol(s)
    expect(s.protocols.activeId).toBeNull()
    expect(protocolRank(s, 'mute-network')).toBe(1)
    expect(protocolMutes(s, 'network')).toBe(false)
  })

  it('Cold Foundry mutes foundry combat bonuses', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 52
    s.combat.docked = true
    s.foundry.upgrades['fp-damage'] = 2
    expect(foundryDamageMult(s)).toBeGreaterThan(1)
    s = enterProtocol(s, 'cold-foundry')
    expect(foundryDamageMult(s)).toBe(1)
    s = abandonProtocol(s)
    expect(s.protocols.activeId).toBeNull()
  })

  it('Echo queues a 3-wave gauntlet and grants tree points on complete', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 62
    s.protocols.ranks['mute-network'] = 1
    s.combat.docked = true
    s = enterEcho(s, 'rift')
    expect(s.echo.activeId).toBe('rift')
    expect(s.echo.resumeSector).toBe(12)
    expect(wavesForRun(s)).toBe(3)
    beginFight(s)
    expect(s.combat.inFight).toBe(true)
    expect(s.combat.isBoss).toBe(false)

    s.combat.wave = 3
    expect(tryCompleteEcho(s)).toBe(true)
    expect(s.echo.activeId).toBeNull()
    expect(echoClears(s, 'rift')).toBe(1)
    expect(s.echo.points).toBe(2)
    expect(s.combat.docked).toBe(true)

    s = buyEchoNode(s, 'echo-strike')
    expect(echoHasNode(s, 'echo-strike')).toBe(true)
    expect(computeShipStats(s).damage).toBeGreaterThan(0)
  })

  it('Process Ghost Sortie pushes sectors while launched offline', () => {
    let s = createInitialState(0)
    s.meta.aiUnlocked = true
    s.meta.highestSectorEver = 4
    s.resources.aiPoints = 40
    s.combat.docked = true
    s = buyProcessNode(s, 'auto-extract')
    s = buyProcessNode(s, 'offline-sortie')
    expect(hasProcess(s, 'offline-sortie')).toBe(true)
    s.combat.docked = false
    s.lastTickAt = 0
    const { state: next, report } = applyOfflineCatchUp(s, 30 * 60 * 1000)
    expect(report?.sectorsCleared ?? 0).toBeGreaterThan(0)
  })

  it('Rebuild keeps Protocol ranks and Echo tree', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 62
    s.protocols.ranks['mute-network'] = 2
    s.protocols.bestSector['mute-network'] = 9
    s.echo.points = 4
    s.echo.tree = ['echo-strike']
    s.process.purchased = ['auto-salvage']
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(protocolRank(s, 'mute-network')).toBe(2)
    expect(s.protocols.bestSector['mute-network']).toBe(9)
    expect(s.echo.tree).toContain('echo-strike')
    expect(hasProcess(s, 'auto-salvage')).toBe(false)
    expect(s.protocols.activeId).toBeNull()
    expect(s.echo.activeId).toBeNull()
  })
})
