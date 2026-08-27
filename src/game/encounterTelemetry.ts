/** PR7 encounter telemetry. Lightweight; PR11 owns final analysis UI. */

import type { GameState } from './types'
import type { CommanderTraitId, HostileId } from './hostileCatalogue'

export interface EncounterTelemetry {
  hostileSpawns: Record<string, number>
  firstContacts: string[]
  commanderEvents: number
  commanderBaseSelected: Record<string, number>
  commanderTraitSelected: Record<string, number>
  commanderSurvivalSamples: number[]
  commanderOverlapPeaks: number
  commanderRewardSalvage: number
  ordinaryRewardSalvage: number
  auraUptime: Record<string, number>
  commanderTargetPicks: number
  totalTargetPicks: number
  bossEncounterStartedAt: number | null
  bossEncounterDuration: number
  bossPhaseDurations: Record<string, number>
  bossFailurePressure: number
  backlogEnteringCommander: number[]
  backlogEnteringBossHold: number[]
}

export function emptyEncounterTelemetry(): EncounterTelemetry {
  return {
    hostileSpawns: {},
    firstContacts: [],
    commanderEvents: 0,
    commanderBaseSelected: {},
    commanderTraitSelected: {},
    commanderSurvivalSamples: [],
    commanderOverlapPeaks: 0,
    commanderRewardSalvage: 0,
    ordinaryRewardSalvage: 0,
    auraUptime: {},
    commanderTargetPicks: 0,
    totalTargetPicks: 0,
    bossEncounterStartedAt: null,
    bossEncounterDuration: 0,
    bossPhaseDurations: {},
    bossFailurePressure: 0,
    backlogEnteringCommander: [],
    backlogEnteringBossHold: [],
  }
}

export function ensureEncounterTelemetry(state: GameState): EncounterTelemetry {
  if (!state.combat.encounterTelemetry) {
    state.combat.encounterTelemetry = emptyEncounterTelemetry()
  }
  return state.combat.encounterTelemetry
}

function bump(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by
}

export function noteHostileSpawn(state: GameState, hostileId: string): void {
  const tel = ensureEncounterTelemetry(state)
  bump(tel.hostileSpawns, hostileId)
}

export function noteFirstContact(state: GameState, hostileId: string): void {
  const tel = ensureEncounterTelemetry(state)
  if (!tel.firstContacts.includes(hostileId)) tel.firstContacts.push(hostileId)
}

export function noteCommanderEvent(
  state: GameState,
  hostileId: HostileId | string,
  traitId: CommanderTraitId | string,
): void {
  const tel = ensureEncounterTelemetry(state)
  tel.commanderEvents += 1
  bump(tel.commanderBaseSelected, hostileId)
  bump(tel.commanderTraitSelected, traitId)
}

export function noteCommanderOverlap(state: GameState, living: number): void {
  const tel = ensureEncounterTelemetry(state)
  tel.commanderOverlapPeaks = Math.max(tel.commanderOverlapPeaks, living)
}

export function noteCommanderDeath(state: GameState, spawnedAt: number | undefined, salvage: number): void {
  const tel = ensureEncounterTelemetry(state)
  const t = (state.combat.simTime ?? 0) - (spawnedAt ?? state.combat.simTime ?? 0)
  tel.commanderSurvivalSamples.push(Math.max(0, t))
  tel.commanderRewardSalvage += salvage
}

export function noteOrdinaryKillSalvage(state: GameState, salvage: number): void {
  ensureEncounterTelemetry(state).ordinaryRewardSalvage += salvage
}

export function noteAuraUptime(state: GameState, traitId: string, dt: number): void {
  bump(ensureEncounterTelemetry(state).auraUptime, traitId, dt)
}

export function noteTargetPick(state: GameState, commander: boolean): void {
  const tel = ensureEncounterTelemetry(state)
  tel.totalTargetPicks += 1
  if (commander) tel.commanderTargetPicks += 1
}

export function noteBacklogEnteringCommander(state: GameState): void {
  ensureEncounterTelemetry(state).backlogEnteringCommander.push(
    state.combat.enemyUnits.filter((u) => u.hull > 0).length,
  )
}

export function noteBacklogEnteringBossHold(state: GameState): void {
  ensureEncounterTelemetry(state).backlogEnteringBossHold.push(
    state.combat.enemyUnits.filter((u) => u.hull > 0).length +
      (state.combat.pendingReinforcements ?? []).reduce((n, row) => n + row.units.length, 0) +
      (state.combat.reservedCommanders ?? []).length,
  )
}

export function noteBossEncounterStart(state: GameState): void {
  const tel = ensureEncounterTelemetry(state)
  tel.bossEncounterStartedAt = state.combat.simTime ?? 0
}

export function noteBossEncounterEnd(state: GameState): void {
  const tel = ensureEncounterTelemetry(state)
  if (tel.bossEncounterStartedAt == null) return
  tel.bossEncounterDuration = Math.max(0, (state.combat.simTime ?? 0) - tel.bossEncounterStartedAt)
  tel.bossEncounterStartedAt = null
}

export function noteBossPhaseDuration(state: GameState, phase: string, dt: number): void {
  bump(ensureEncounterTelemetry(state).bossPhaseDurations, phase, dt)
}

export function noteBossFailurePressure(state: GameState, incoming: number): void {
  ensureEncounterTelemetry(state).bossFailurePressure += incoming
}

export type CommanderTelemetryFlag =
  | 'COMMANDER_WALL'
  | 'OVERLAP'
  | 'TRAIT_DOMINANCE'
  | 'TRAIT_IRRELEVANCE'
  | 'COMMANDER_FARM'
  | 'AURA_STACK_EXPLOIT'
  | 'READABILITY_FAILURE'

/** Diagnostic helpers for PR11. Not a player-facing report UI. */
export function commanderTelemetryHints(tel: EncounterTelemetry): CommanderTelemetryFlag[] {
  const flags: CommanderTelemetryFlag[] = []
  if (tel.commanderOverlapPeaks >= 2 && tel.commanderEvents >= 4) flags.push('OVERLAP')
  if (tel.commanderRewardSalvage > tel.ordinaryRewardSalvage * 3 && tel.commanderEvents > 0) {
    flags.push('COMMANDER_FARM')
  }
  const traits = Object.entries(tel.commanderTraitSelected)
  if (traits.length >= 2) {
    const max = Math.max(...traits.map(([, n]) => n))
    const min = Math.min(...traits.map(([, n]) => n))
    if (max >= min * 4 && max >= 4) flags.push('TRAIT_DOMINANCE')
  }
  for (const id of Object.keys(tel.commanderTraitSelected)) {
    if ((tel.auraUptime[id] ?? 0) <= 0 && ['vanguard', 'wardbearer', 'rallying', 'suppressor'].includes(id)) {
      flags.push('TRAIT_IRRELEVANCE')
      break
    }
  }
  return flags
}
