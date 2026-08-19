import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  DEFEAT_SEQUENCE_S,
  advanceSeconds,
  retryFrontier,
  setDocked,
  setPushMode,
  startCombat,
} from './tick'
import {
  enterEcho,
  enterProtocol,
  performRebuild,
  setSectorRoute,
  upgradeModule,
} from './actions'
import { applyOfflineCatchUp } from './offline'
import { exportSave, importSave } from './save'
import { addCombatClockMs, addOfflineCombatMs, attemptKey, canRetryFrontier } from './frontier'
import { buildPlaytestReport } from './playtest'
import { clearSector } from './testHelpers'
import { activeGuideStep } from './progression'

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
  s.combat.inFight = false
  return s
}

describe('continuous combat frontier', () => {
  it('retreats from an uncleared sector into Frontier Hold without docking', () => {
    let s = createInitialState(0)
    s.combat.sector = 20
    s.combat.highestSector = 19
    s.meta.highestSectorEver = 19
    s = startCombat(s)
    resolveDefeat(s)
    expect(s.combat.docked).toBe(false)
    expect(s.combat.inFight).toBe(true)
    expect(s.combat.frontierHold).toBe(true)
    expect(s.combat.frontierSector).toBe(20)
    expect(s.combat.sector).toBe(19)
    expect(s.combat.wave).toBe(1)
    expect(s.combat.lastSortie.outcome).toBe('defeat')
    expect(s.meta.hullLostOnce).toBe(true)
    const rec = s.playtest.sectorAttempts[attemptKey('A', 20)]
    expect(rec.attempts).toBe(1)
    expect(rec.failures).toBe(1)
    expect(rec.clears).toBe(0)
    expect(s.combat.frontierNotice?.kind).toBe('repelled')
  })

  it('Retry Frontier starts the failed sector and clears hold for the attempt', () => {
    let s = createInitialState(0)
    s.combat.sector = 20
    s.combat.highestSector = 19
    s = startCombat(s)
    resolveDefeat(s)
    expect(canRetryFrontier(s)).toBe(true)
    s = retryFrontier(s)
    expect(s.combat.frontierHold).toBe(false)
    expect(s.combat.sector).toBe(20)
    expect(s.combat.wave).toBe(1)
    expect(s.combat.docked).toBe(false)
    expect(s.combat.inFight).toBe(true)
    expect(s.combat.pushMode).toBe('advance')
    expect(s.playtest.sectorAttempts[attemptKey('A', 20)].attempts).toBe(2)
    expect(canRetryFrontier(s)).toBe(false)
  })

  it('repeat failure returns to the fallback with accumulated attempt data', () => {
    let s = createInitialState(0)
    s.combat.sector = 20
    s.combat.highestSector = 19
    s = startCombat(s)
    resolveDefeat(s)
    s = retryFrontier(s)
    resolveDefeat(s)
    expect(s.combat.frontierHold).toBe(true)
    expect(s.combat.sector).toBe(19)
    expect(s.combat.frontierSector).toBe(20)
    const rec = s.playtest.sectorAttempts[attemptKey('A', 20)]
    expect(rec.attempts).toBe(2)
    expect(rec.failures).toBe(2)
    expect(rec.clears).toBe(0)
  })

  it('successful retry clears the frontier, updates highest, and resumes Advance', () => {
    let s = createInitialState(0)
    s.shipyard.moduleLevels = { 'pulse-cannon': 40, 'plate-layer': 40 }
    s.combat.sector = 20
    s.combat.highestSector = 19
    s.meta.highestSectorEver = 19
    s = startCombat(s)
    resolveDefeat(s)
    s = retryFrontier(s)
    s = clearSector(s)
    expect(s.combat.highestSector).toBeGreaterThanOrEqual(20)
    expect(s.combat.frontierHold).toBe(false)
    expect(s.combat.frontierSector).toBe(0)
    expect(s.combat.sector).toBeGreaterThanOrEqual(21)
    expect(s.combat.pushMode).toBe('advance')
    expect(s.playtest.sectorAttempts[attemptKey('A', 20)].clears).toBe(1)
    expect(s.combat.frontierNotice?.kind).toBe('cleared')
  })

  it('first-ever defeat teaches retreat and keeps combat live', () => {
    let s = createInitialState(0)
    s = setDocked(s, false)
    s = startCombat(s)
    resolveDefeat(s)
    expect(s.combat.frontierNotice?.first).toBe(true)
    expect(s.combat.frontierHold).toBe(true)
    expect(s.combat.docked).toBe(false)
    s.shipyard.moduleLevels['pulse-cannon'] = 1
    s.shipyard.moduleLevels['plate-layer'] = 1
    expect(activeGuideStep(s, 'combat')?.id).toBe('guide-cores-persist')
  })

  it('deliberate Hold on a cleared sector is not Frontier Hold', () => {
    let s = createInitialState(0)
    s.combat.sector = 4
    s.combat.highestSector = 4
    s = setPushMode(s, 'hold-sector')
    s = startCombat(s)
    resolveDefeat(s)
    expect(s.combat.frontierHold).toBe(false)
    expect(s.combat.pushMode).toBe('hold-sector')
    expect(s.combat.sector).toBe(4)
    expect(s.combat.docked).toBe(false)
    expect(s.combat.frontierNotice).toBeNull()
  })

  it('Frontier Hold does not auto-advance into the failed sector', () => {
    let s = createInitialState(0)
    s.shipyard.moduleLevels = { 'pulse-cannon': 40, 'plate-layer': 40 }
    s.combat.sector = 20
    s.combat.highestSector = 19
    s = startCombat(s)
    resolveDefeat(s)
    expect(s.combat.sector).toBe(19)
    s = clearSector(s)
    expect(s.combat.frontierHold).toBe(true)
    expect(s.combat.sector).toBe(19)
    expect(s.combat.frontierSector).toBe(20)
  })

  it('records Route B failure and clears hold when the player changes route', () => {
    let s = createInitialState(0)
    s.combat.highestSector = 24
    s.meta.highestSectorEver = 24
    s.combat.docked = true
    s = setSectorRoute(s, 'B')
    s.combat.sector = 25
    s.combat.highestSector = 24
    s = startCombat(s)
    resolveDefeat(s)
    expect(s.combat.frontierRoute).toBe('B')
    expect(s.combat.frontierSector).toBe(25)
    expect(s.combat.sector).toBe(24)
    s = setDocked(s, true)
    s = setSectorRoute(s, 'A')
    expect(s.combat.frontierHold).toBe(false)
    expect(s.combat.frontierSector).toBe(0)
  })

  it('Rebuild clears stale Frontier Hold', () => {
    let s = createInitialState(0)
    s.combat.sector = 13
    s.combat.highestSector = 12
    s.meta.highestSectorEver = 12
    s.shipyard.moduleLevels['pulse-cannon'] = 6
    s = startCombat(s)
    resolveDefeat(s)
    expect(s.combat.frontierHold).toBe(true)
    s = performRebuild(s, { frameId: 'scout-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.combat.frontierHold).toBe(false)
    expect(s.combat.frontierSector).toBe(0)
    expect(s.combat.docked).toBe(true)
    expect(s.playtest.consecutiveFrontierOneShots).toBe(0)
  })

  it('Protocol hull-loss still docks and does not enter Frontier Hold', () => {
    let s = protocolDock()
    s = enterProtocol(s, 'mute-network')
    s = startCombat(s)
    resolveDefeat(s)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.frontierHold).toBe(false)
    expect(s.protocols.activeId).toBe('mute-network')
    expect(s.combat.lastSortie.outcome).toBe('defeat')
  })

  it('Echo hull-loss ends the Echo attempt and docks', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 62
    s.combat.highestSector = 62
    s.protocols.ranks['mute-network'] = 1
    s.combat.docked = true
    s = enterEcho(s, 'rift')
    s = startCombat(s)
    resolveDefeat(s)
    expect(s.combat.docked).toBe(true)
    expect(s.echo.activeId).toBeNull()
    expect(s.combat.frontierHold).toBe(false)
    expect(s.combat.lastSortie.outcome).toBe('defeat')
  })

  it('save/load during Frontier Hold resumes farming the fallback', () => {
    let s = createInitialState(0)
    s.combat.sector = 20
    s.combat.highestSector = 19
    s = startCombat(s)
    resolveDefeat(s)
    const loaded = importSave(exportSave(s))
    expect(loaded).toBeTruthy()
    expect(loaded!.combat.frontierHold).toBe(true)
    expect(loaded!.combat.frontierSector).toBe(20)
    expect(loaded!.combat.sector).toBe(19)
    expect(loaded!.combat.docked).toBe(false)
    expect(loaded!.playtest.sectorAttempts[attemptKey('A', 20)].failures).toBe(1)
  })

  it('old saves hydrate empty frontier telemetry without forcing a launch', () => {
    const s = createInitialState(0)
    const raw = JSON.parse(JSON.stringify(s)) as {
      combat: { frontierHold?: boolean; frontierSector?: number }
      playtest?: { sectorAttempts?: unknown }
    }
    delete raw.combat.frontierHold
    delete raw.combat.frontierSector
    delete raw.playtest?.sectorAttempts
    const loaded = importSave(btoa(unescape(encodeURIComponent(JSON.stringify(raw)))))
    expect(loaded?.combat.frontierHold).toBe(false)
    expect(loaded?.combat.frontierSector).toBe(0)
    expect(loaded?.combat.docked).toBe(true)
    expect(loaded?.playtest.sectorAttempts).toEqual({})
    expect(loaded?.playtest.activeCombatMs).toBe(0)
  })

  it('tracks combat clocks, attempts, one-shots, interventions, and offline separately', () => {
    let s = createInitialState(0)
    s.shipyard.moduleLevels = { 'pulse-cannon': 40, 'plate-layer': 40 }
    s = setDocked(s, false)
    s = startCombat(s)
    addCombatClockMs(s, 0.4)
    expect(s.playtest.activeCombatMs).toBeGreaterThanOrEqual(400)
    expect(s.playtest.frontierCombatMs).toBeGreaterThanOrEqual(400)
    s = clearSector(s)
    expect(s.playtest.consecutiveFrontierOneShots).toBeGreaterThanOrEqual(1)
    s = clearSector(s)
    expect(s.playtest.consecutiveFrontierOneShots).toBeGreaterThanOrEqual(2)
    expect(s.playtest.lastSteamroll?.n).toBeGreaterThanOrEqual(2)

    s.combat.inFight = false
    s.combat.sector = 20
    s.combat.highestSector = 19
    s.combat.frontierHold = false
    s.combat.frontierAttemptOpen = false
    s = startCombat(s)
    resolveDefeat(s)
    expect(s.playtest.consecutiveFrontierOneShots).toBe(0)
    s.shipyard.moduleLevels['pulse-cannon'] = 2
    s.resources.salvage = 80
    s = upgradeModule(s, 'pulse-cannon')
    expect(s.shipyard.moduleLevels['pulse-cannon']).toBe(3)
    addCombatClockMs(s, 1.2)
    expect(s.playtest.retreatFarmMs).toBeGreaterThanOrEqual(1200)
    const rec = s.playtest.sectorAttempts[attemptKey('A', 20)]
    expect(rec.retreatFarmMs).toBeGreaterThanOrEqual(1200)
    expect(s.playtest.pendingInterventions.some((i) => i.k === 'core_buy')).toBe(true)

    addOfflineCombatMs(s, 8_000)
    expect(s.playtest.offlineRetreatFarmMs).toBeGreaterThanOrEqual(8000)
    expect(s.playtest.offlineCombatMs).toBe(0)

    s.lastTickAt = 0
    const caught = applyOfflineCatchUp(s, 90_000)
    expect(caught.state.playtest.offlineRetreatFarmMs).toBeGreaterThan(s.playtest.offlineRetreatFarmMs)
    expect(caught.state.playtest.activeCombatMs).toBe(s.playtest.activeCombatMs)

    const report = buildPlaytestReport(caught.state)
    expect(report).toMatch(/FRONTIER HISTORY/)
    expect(report).toMatch(/Active combat/)
    expect(report).toMatch(/Retreat farming/)
    expect(report).toMatch(/S20/)
  })

  it('failure on S1 with no clears farms S1 and Retry retries S1', () => {
    let s = createInitialState(0)
    s = startCombat(s)
    resolveDefeat(s)
    expect(s.combat.sector).toBe(1)
    expect(s.combat.frontierSector).toBe(1)
    s = retryFrontier(s)
    expect(s.combat.sector).toBe(1)
    expect(s.combat.frontierHold).toBe(false)
  })
})
