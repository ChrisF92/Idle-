/** Echo Runs — USI Warp Drive analogue. Short gauntlets into a skill tree. */

import type { GameState, EchoState, SectorRoute } from './types'
import { careerBestWave } from './progression'
import { wavesForSector } from './sectors'
import { closeSortie } from './sortieSummary'
import { noteAttempt } from './playtest'
import { ACT1_CADENCE } from './cadence'

export const ECHO_UNLOCK_SECTOR = ACT1_CADENCE.echo
export const ECHO_WAVES = 3

export interface EchoRunDef {
  id: string
  name: string
  blurb: string
  sectorPower: number
  danger: number
  reward: number
  requiresId?: string
}

export interface EchoTreeDef {
  id: string
  name: string
  blurb: string
  cost: number
  requiresId?: string
  damage?: number
  shield?: number
  salvage?: number
  network?: number
  researchXp?: number
  foundrySpeed?: number
  ash?: number
}

export const ECHO_RUNS: EchoRunDef[] = [
  {
    id: 'rift',
    name: 'Choir Rift',
    blurb: 'A thin tear. Two packs, then a Titan echo.',
    sectorPower: 22,
    danger: 1.35,
    reward: 2,
  },
  {
    id: 'keel',
    name: 'Broken Keel',
    blurb: 'A hull that never docked. Harder packs.',
    sectorPower: 24,
    danger: 1.5,
    reward: 3,
    requiresId: 'rift',
  },
  {
    id: 'veil',
    name: 'Ash Veil',
    blurb: 'The Furnace remembers this one.',
    sectorPower: 26,
    danger: 1.65,
    reward: 4,
    requiresId: 'keel',
  },
  {
    id: 'stack',
    name: 'Silent Stack',
    blurb: 'A chimney that still draws. Sector 30 power.',
    sectorPower: 30,
    danger: 1.8,
    reward: 5,
    requiresId: 'veil',
  },
  {
    id: 'delta',
    name: 'Delta Stack',
    blurb: 'A second chimney. Sector 32 power.',
    sectorPower: 32,
    danger: 1.95,
    reward: 6,
    requiresId: 'stack',
  },
  {
    id: 'fenix',
    name: 'Fenix Rift',
    blurb: 'The tear that learned to burn. Sector 37 power.',
    sectorPower: 37,
    danger: 2.1,
    reward: 8,
    requiresId: 'delta',
  },
]

export const ECHO_TREE: EchoTreeDef[] = [
  { id: 'echo-strike', name: 'Strike Echo', blurb: 'Sortie damage.', cost: 2, damage: 0.04 },
  { id: 'echo-ward', name: 'Ward Echo', blurb: 'Max shield.', cost: 2, shield: 0.04 },
  { id: 'echo-yield', name: 'Yield Echo', blurb: 'Salvage from kills.', cost: 2, salvage: 0.06 },
  {
    id: 'echo-loom',
    name: 'Loom Echo',
    blurb: 'Network fill.',
    cost: 3,
    requiresId: 'echo-strike',
    network: 0.05,
  },
  {
    id: 'echo-lab',
    name: 'Lab Echo',
    blurb: 'Research XP from kills.',
    cost: 3,
    requiresId: 'echo-ward',
    researchXp: 0.08,
  },
  {
    id: 'echo-hold',
    name: 'Hold Echo',
    blurb: 'Salvage from kills.',
    cost: 4,
    requiresId: 'echo-yield',
    salvage: 0.08,
  },
  {
    id: 'echo-bulk',
    name: 'Bulk Echo',
    blurb: 'Max shield.',
    cost: 4,
    requiresId: 'echo-loom',
    shield: 0.06,
  },
  {
    id: 'echo-smelt',
    name: 'Smelt Echo',
    blurb: 'Foundry craft speed.',
    cost: 5,
    requiresId: 'echo-lab',
    foundrySpeed: 0.08,
  },
  {
    id: 'echo-ash',
    name: 'Ash Echo',
    blurb: 'Choir-ash from kills.',
    cost: 5,
    requiresId: 'echo-hold',
    ash: 0.1,
  },
  {
    id: 'echo-keel',
    name: 'Keel Echo',
    blurb: 'Sortie damage.',
    cost: 6,
    requiresId: 'echo-bulk',
    damage: 0.08,
  },
  {
    id: 'echo-warp',
    name: 'Warp Echo',
    blurb: 'Foundry speed and salvage.',
    cost: 8,
    requiresId: 'echo-smelt',
    foundrySpeed: 0.1,
    salvage: 0.06,
  },
]

export function createEmptyEchoState(): EchoState {
  return {
    activeId: null,
    resumeSector: 1,
    resumeWave: 1,
    resumeRoute: 'A',
    points: 0,
    tree: [],
    clears: {},
  }
}

export function getEchoRun(id: string): EchoRunDef | undefined {
  return ECHO_RUNS.find((r) => r.id === id)
}

export function getEchoNode(id: string): EchoTreeDef | undefined {
  return ECHO_TREE.find((n) => n.id === id)
}

export function echoUnlocked(state: GameState): boolean {
  return careerBestWave(state) >= ECHO_UNLOCK_SECTOR
}

export function echoClears(state: GameState, id: string): number {
  return Math.max(0, Math.floor(state.echo?.clears[id] ?? 0))
}

export function echoHasNode(state: GameState, id: string): boolean {
  return (state.echo?.tree ?? []).includes(id)
}

export function wavesForRun(state: GameState): number {
  if (state.echo?.activeId) return ECHO_WAVES
  return wavesForSector(state.combat.sector)
}

export function echoIsBossWave(state: GameState, wave: number): boolean {
  if (!state.echo?.activeId) return false
  return wave >= ECHO_WAVES
}

export function echoTreeSum(
  state: GameState,
  key: 'damage' | 'shield' | 'salvage' | 'network' | 'researchXp' | 'foundrySpeed' | 'ash',
): number {
  let n = 0
  for (const id of state.echo?.tree ?? []) {
    const def = getEchoNode(id)
    if (def) n += def[key] ?? 0
  }
  return n
}

export function echoDamageMult(state: GameState): number {
  return 1 + echoTreeSum(state, 'damage')
}

export function echoShieldMult(state: GameState): number {
  return 1 + echoTreeSum(state, 'shield')
}

export function echoSalvageMult(state: GameState): number {
  return 1 + echoTreeSum(state, 'salvage')
}

export function echoNetworkMult(state: GameState): number {
  return 1 + echoTreeSum(state, 'network')
}

export function echoResearchXpMult(state: GameState): number {
  return 1 + echoTreeSum(state, 'researchXp')
}

export function echoFoundrySpeedMult(state: GameState): number {
  return 1 + echoTreeSum(state, 'foundrySpeed')
}

export function echoAshMult(state: GameState): number {
  return 1 + echoTreeSum(state, 'ash')
}

export function canEnterEcho(
  state: GameState,
  id: string,
): { ok: boolean; reason?: string } {
  if (!state.combat.docked || state.combat.inFight) {
    return { ok: false, reason: 'Dock first' }
  }
  if (state.protocols?.activeId) return { ok: false, reason: 'Finish the Protocol first' }
  if (state.echo?.activeId) return { ok: false, reason: 'Already in an Echo' }
  if (!echoUnlocked(state)) {
    return { ok: false, reason: `Reach Wave ${ECHO_UNLOCK_SECTOR}` }
  }
  const def = getEchoRun(id)
  if (!def) return { ok: false, reason: 'Unknown Echo' }
  if (def.requiresId && echoClears(state, def.requiresId) < 1) {
    const need = getEchoRun(def.requiresId)?.name ?? def.requiresId
    return { ok: false, reason: `Clear ${need} first` }
  }
  return { ok: true }
}

export function canBuyEchoNode(
  state: GameState,
  id: string,
): { ok: boolean; reason?: string } {
  if (!echoUnlocked(state)) {
    return { ok: false, reason: `Reach Wave ${ECHO_UNLOCK_SECTOR}` }
  }
  const def = getEchoNode(id)
  if (!def) return { ok: false, reason: 'Unknown node' }
  if (echoHasNode(state, id)) return { ok: false, reason: 'Owned' }
  if (def.requiresId && !echoHasNode(state, def.requiresId)) {
    return { ok: false, reason: 'Need prior node' }
  }
  if ((state.echo?.points ?? 0) < def.cost) return { ok: false, reason: `Need ${def.cost} Echo` }
  return { ok: true }
}

export function restoreEchoResume(state: GameState): void {
  const echo = state.echo
  if (!echo) return
  state.combat.sector = Math.max(1, echo.resumeSector || 1)
  state.combat.wave = Math.max(1, echo.resumeWave || 1)
  state.combat.route = (echo.resumeRoute === 'B' ? 'B' : 'A') as SectorRoute
}

export function tryCompleteEcho(state: GameState): boolean {
  const id = state.echo?.activeId
  if (!id) return false
  const def = getEchoRun(id)
  if (!def) {
    state.echo.activeId = null
    return true
  }
  if (!state.echo) state.echo = createEmptyEchoState()
  state.echo.clears = { ...state.echo.clears, [id]: echoClears(state, id) + 1 }
  state.echo.points = (state.echo.points ?? 0) + def.reward
  state.echo.activeId = null
  restoreEchoResume(state)
  state.combat.docked = true
  state.combat.inFight = false
  state.combat.wave = 1
  closeSortie(state, 'extract', `${def.name} complete. +${def.reward} Echo.`)
  noteAttempt(state, 'echo', id, 'clear', def.name)
  state.combat.log = [state.combat.lastSortie.note, ...state.combat.log].slice(0, 40)
  return true
}

export function failEcho(state: GameState, reason: string): void {
  const id = state.echo?.activeId
  if (!id) return
  const name = getEchoRun(id)?.name ?? 'Echo'
  restoreEchoResume(state)
  state.echo.activeId = null
  state.combat.docked = true
  state.combat.inFight = false
  state.combat.wave = 1
  closeSortie(state, 'defeat', `${name} failed. ${reason}`)
  noteAttempt(state, 'echo', id, 'end', name)
  state.combat.log = [state.combat.lastSortie.note, ...state.combat.log].slice(0, 40)
}
