/** Codex discovery on actual spawn. HOSTILES | BOSSES. Persists through Rebuild. */

import type { CodexState, CombatUnit, GameState } from './types'
import {
  COMMANDER_TRAIT_IDS,
  getHostileDef,
  HOSTILE_DEFS,
  isHostileId,
  type CommanderTraitId,
  type HostileId,
} from './hostileCatalogue'
import { getBossDef, isBossId, type BossId } from './bossRegistry'
import { noteFirstContact, noteHostileSpawn } from './encounterTelemetry'

export const CODEX_UNLOCK_WAVE = 30

export const CODEX_PANES = ['hostiles', 'bosses'] as const
export type CodexPane = (typeof CODEX_PANES)[number]

export function emptyCodexState(): CodexState {
  return {
    discoveredHostileIds: [],
    discoveredBossIds: [],
    discoveredCommanderTraitIds: [],
    hostileCommander: {},
    bossClears: [],
    milestones: [],
  }
}

export function sanitizeCodexState(raw: CodexState | undefined | null): CodexState {
  const empty = emptyCodexState()
  if (!raw || typeof raw !== 'object') return empty
  const hostiles = (raw.discoveredHostileIds ?? []).filter((id) => isHostileId(id))
  const bosses = (raw.discoveredBossIds ?? []).filter((id) => isBossId(id))
  const traits = (raw.discoveredCommanderTraitIds ?? []).filter((id) =>
    (COMMANDER_TRAIT_IDS as readonly string[]).includes(id),
  )
  const hostileCommander: CodexState['hostileCommander'] = {}
  for (const [id, row] of Object.entries(raw.hostileCommander ?? {})) {
    if (!isHostileId(id) || !row) continue
    hostileCommander[id] = {
      encounters: Math.max(0, Math.floor(Number(row.encounters) || 0)),
      defeats: Math.max(0, Math.floor(Number(row.defeats) || 0)),
      traits: (row.traits ?? []).filter((t) => (COMMANDER_TRAIT_IDS as readonly string[]).includes(t)),
    }
  }
  return {
    discoveredHostileIds: unique(hostiles),
    discoveredBossIds: unique(bosses),
    discoveredCommanderTraitIds: unique(traits) as CommanderTraitId[],
    hostileCommander,
    bossClears: unique((raw.bossClears ?? []).filter((s) => typeof s === 'string')),
    milestones: unique((raw.milestones ?? []).filter((s) => typeof s === 'string')),
  }
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)]
}

export function ensureCodex(state: GameState): CodexState {
  state.codex = sanitizeCodexState(state.codex)
  return state.codex
}

/** Actual battlefield spawn — not pending, not scheduled, not Best Wave. */
export function recordUnitSpawnDiscovery(state: GameState, unit: CombatUnit): void {
  if (unit.side !== 'enemy' || unit.hull <= 0) return
  const codex = ensureCodex(state)
  if (unit.hostileId && isHostileId(unit.hostileId)) {
    noteHostileSpawn(state, unit.hostileId)
    if (!codex.discoveredHostileIds.includes(unit.hostileId)) {
      codex.discoveredHostileIds = [...codex.discoveredHostileIds, unit.hostileId]
      noteFirstContact(state, unit.hostileId)
    }
    if (unit.isCommander) {
      const row = (codex.hostileCommander[unit.hostileId] ??= { encounters: 0, defeats: 0, traits: [] })
      row.encounters += 1
      if (unit.commanderTraitId && !row.traits.includes(unit.commanderTraitId)) {
        row.traits = [...row.traits, unit.commanderTraitId]
      }
    }
  }
  if (unit.isCommander && unit.commanderTraitId) {
    if (!codex.discoveredCommanderTraitIds.includes(unit.commanderTraitId)) {
      codex.discoveredCommanderTraitIds = [...codex.discoveredCommanderTraitIds, unit.commanderTraitId]
    }
  }
  if (unit.isBoss && unit.bossId && isBossId(unit.bossId)) {
    if (!codex.discoveredBossIds.includes(unit.bossId)) {
      codex.discoveredBossIds = [...codex.discoveredBossIds, unit.bossId]
    }
  }
}

export function recordCommanderDefeat(state: GameState, unit: CombatUnit): void {
  if (!unit.isCommander || !unit.hostileId || !isHostileId(unit.hostileId)) return
  const codex = ensureCodex(state)
  const row = (codex.hostileCommander[unit.hostileId] ??= { encounters: 0, defeats: 0, traits: [] })
  row.defeats += 1
}

export function recordCodexMilestone(state: GameState, milestone: string): void {
  const codex = ensureCodex(state)
  if (!codex.milestones.includes(milestone)) codex.milestones.push(milestone)
}

export function recordBossClearId(state: GameState, bossId: string): void {
  const codex = ensureCodex(state)
  if (!codex.bossClears.includes(bossId)) codex.bossClears.push(bossId)
}

export function isHostileDiscovered(state: GameState, id: HostileId | string): boolean {
  return ensureCodex(state).discoveredHostileIds.includes(id)
}

export function isBossDiscovered(state: GameState, id: BossId | string): boolean {
  return ensureCodex(state).discoveredBossIds.includes(id)
}

export function discoveredHostileRecords(state: GameState) {
  const codex = ensureCodex(state)
  return HOSTILE_DEFS.filter((d) => codex.discoveredHostileIds.includes(d.id)).map((def) => {
    const cmd = codex.hostileCommander[def.id]
    return {
      def,
      commanderEncounters: cmd?.encounters ?? 0,
      commanderDefeats: cmd?.defeats ?? 0,
      traitsEncountered: (cmd?.traits ?? []) as CommanderTraitId[],
    }
  })
}

export function unknownHostilePlaceholderCount(state: GameState): number {
  return HOSTILE_DEFS.length - ensureCodex(state).discoveredHostileIds.length
}

export function hostileCodexLines(def: ReturnType<typeof getHostileDef>): {
  family: string
  role: string
  mechanic: string
  profile: string
  softCounter: string
} {
  if (!def) {
    return {
      family: 'Unknown',
      role: 'Unknown',
      mechanic: 'Unknown',
      profile: 'Unknown',
      softCounter: 'Unknown',
    }
  }
  const family =
    def.familyStatus === 'authored' && def.family
      ? def.family.charAt(0).toUpperCase() + def.family.slice(1)
      : 'Family pending design'
  const role = def.roleStatus === 'authored' && def.role ? 'Elite' : 'Role pending design'
  const mechanic =
    def.mechanicStatus === 'authored' && def.mechanicSummary
      ? def.mechanicSummary
      : 'Unique combat mechanic pending design'
  const profile = def.role === 'elite' ? 'High-durability elite-role profile.' : 'Relative combat profile pending design'
  const softCounter =
    def.mechanicId === 'death-position-hazard'
      ? 'Soft answers: kill at range; Barrier/Bulwark if the hazard reaches the Hive.'
      : def.mechanicId === 'partial-shield-bypass-spike'
        ? 'Soft answers: interrupt during charge; Barrier, Ablative, Damage Control.'
        : def.role === 'elite'
          ? 'Soft answers: Heavy, Armor Penetration, Focus. Multiple legitimate paths.'
          : 'Soft counters pending authored mechanics.'
  return { family, role, mechanic, profile, softCounter }
}

export function bossCodexLines(bossId: string): {
  name: string
  wave: number
  mechanic: string
  profile: string
  softAnswer: string
} {
  const def = getBossDef(bossId)
  if (!def) {
    return { name: 'Unknown', wave: 0, mechanic: 'Unknown', profile: 'Unknown', softAnswer: 'Unknown' }
  }
  return {
    name: def.name,
    wave: def.wave,
    mechanic:
      def.mechanicStatus === 'authored' && def.mechanicSummary
        ? def.mechanicSummary
        : 'Unique Boss mechanic pending design',
    profile: 'Proper Boss encounter. Role-aware durability seed; not a raw HP sponge.',
    softAnswer:
      def.id === 'choir-crown'
        ? 'Soft answers: Shield breakers in Convergence; Armor/Heavy in Reconstruction; responsive fire-control in Loopbreak.'
        : 'Soft-answer paths pending authored unique mechanics. Generalist offense and defense remain valid.',
  }
}
