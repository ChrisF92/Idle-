import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { DEFEAT_SEQUENCE_S, advanceSeconds, retryFrontier, setDocked, startCombat } from './tick'
import { enterEcho, enterProtocol } from './actions'

function killFlagship(state: ReturnType<typeof createInitialState>): void {
  const flag = state.combat.playerUnits.find((u) => u.isFlagship)
  if (flag) flag.hull = 0
  state.combat.playerHull = 0
}

function resolveDefeat(state: ReturnType<typeof createInitialState>): void {
  killFlagship(state)
  advanceSeconds(state, DEFEAT_SEQUENCE_S + 0.3)
}

function protocolDock(sectorEver = 52) {
  const s = createInitialState(0)
  s.meta.highestSectorEver = sectorEver
  s.combat.highestSector = sectorEver
  s.combat.docked = true
  return s
}

describe('GDD: death ends the Sortie', () => {
  it('docks on hull loss instead of Frontier Hold', () => {
    let s = setDocked(createInitialState(0), false)
    s = startCombat(s)
    resolveDefeat(s)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.inFight).toBe(false)
    expect(s.combat.frontierHold).toBe(false)
    expect(s.combat.lastSortie.outcome).toBe('defeat')
    expect(s.combat.wave).toBe(1)
    expect(s.resources.salvage).toBe(0)
  })

  it('Retry Frontier is a no-op', () => {
    const s = createInitialState(0)
    s.combat.frontierHold = true
    s.combat.frontierSector = 8
    expect(retryFrontier(s)).toBe(s)
  })

  it('Protocol hull-loss still docks', () => {
    let s = protocolDock()
    s = enterProtocol(s, 'silent-network')
    s = startCombat(s)
    resolveDefeat(s)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.lastSortie.outcome).toBe('defeat')
  })

  it('Echo hull-loss ends the Echo attempt and docks', () => {
    let s = protocolDock(62)
    s.protocols.ranks['silent-network'] = 1
    s = enterEcho(s, 'rift')
    s = startCombat(s)
    resolveDefeat(s)
    expect(s.echo.activeId).toBeNull()
    expect(s.combat.docked).toBe(true)
  })
})
