/** Wave-package runtime: reached/secured, pending threat, Boss-boundary flow. */

import type {
  BossBoundaryState,
  CombatIdSeq,
  CombatUnit,
  GameState,
  PendingReinforcement,
  WavePackageKind,
  WavePackageState,
} from './types'
import {
  ACTIVE_ENEMY_SOFT_CAP,
  BOSS_WARNING_DURATION,
  isCommanderCandidateWave,
  waveEncounterKind,
} from './waves'
import { emptyBossBoundary } from './bossProvider'
import { createSimRng } from './simRng'

export function emptyCombatIdSeq(): CombatIdSeq {
  return { unit: 0, proj: 0, beam: 0, fx: 0, package: 0 }
}

export function emptyWaveRuntime(): Pick<
  GameState['combat'],
  | 'waveReached'
  | 'nextWave'
  | 'nextReinforcementAt'
  | 'packages'
  | 'pendingReinforcements'
  | 'bossBoundary'
  | 'simTime'
  | 'simAccumulator'
  | 'idSeq'
  | 'rng'
> {
  return {
    waveReached: 0,
    nextWave: 1,
    nextReinforcementAt: 0,
    packages: [],
    pendingReinforcements: [],
    bossBoundary: emptyBossBoundary(),
    simTime: 0,
    simAccumulator: 0,
    idSeq: emptyCombatIdSeq(),
    rng: createSimRng(1),
  }
}

export function nextCombatId(state: GameState, kind: keyof CombatIdSeq, prefix: string): string {
  state.combat.idSeq[kind] += 1
  return `${prefix}-${state.combat.idSeq[kind]}`
}

export function wavePackageKindFor(wave: number): WavePackageKind {
  const kind = waveEncounterKind(wave)
  if (kind === 'boss' || kind === 'signature' || kind === 'finale') return 'boss'
  if (kind === 'commander' || isCommanderCandidateWave(wave)) return 'commander'
  return 'normal'
}

export function livingEnemyCount(state: GameState): number {
  return state.combat.enemyUnits.filter((u) => u.hull > 0).length
}

export function packageHasLivingOrPending(state: GameState, pkg: WavePackageState): boolean {
  if (pkg.pendingCount > 0) return true
  return pkg.spawnedUnitIds.some((id) => {
    const unit = state.combat.enemyUnits.find((u) => u.id === id)
    return Boolean(unit && unit.hull > 0)
  })
}

export function createWavePackage(
  state: GameState,
  wave: number,
  kind: WavePackageKind,
  totalUnits: number,
): WavePackageState {
  const id = nextCombatId(state, 'package', `pkg-w${wave}`)
  return {
    id,
    wave,
    kind,
    reached: true,
    secured: false,
    rewardPaid: false,
    spawnedUnitIds: [],
    pendingCount: 0,
    totalUnits,
  }
}

/**
 * Single package-aware admission path for Wave/Boss units, including dynamic adds.
 * Assigns a serialised ID, packageId, and sourceWave. Spawns immediately only when
 * active-enemy capacity exists; otherwise the unit enters pending reinforcement.
 */
export function admitUnitToPackage(
  state: GameState,
  pkg: WavePackageState,
  unit: CombatUnit,
): CombatUnit {
  const admitted: CombatUnit = {
    ...structuredClone(unit),
    id: nextCombatId(state, 'unit', `${pkg.id}-u`),
    packageId: pkg.id,
    sourceWave: pkg.wave,
  }
  if (livingEnemyCount(state) < ACTIVE_ENEMY_SOFT_CAP) {
    pkg.spawnedUnitIds.push(admitted.id)
    state.combat.enemyUnits.push(admitted)
  } else {
    enqueuePending(state, pkg, [admitted])
  }
  pkg.totalUnits = Math.max(pkg.totalUnits, pkg.spawnedUnitIds.length + pkg.pendingCount)
  return admitted
}

export function enqueuePending(
  state: GameState,
  pkg: WavePackageState,
  units: CombatUnit[],
): void {
  if (units.length === 0) return
  const id = nextCombatId(state, 'package', `pend-${pkg.id}`)
  state.combat.pendingReinforcements.push({
    id,
    packageId: pkg.id,
    wave: pkg.wave,
    kind: pkg.kind,
    units,
  })
  pkg.pendingCount += units.length
}

export function drainPending(state: GameState, cap = ACTIVE_ENEMY_SOFT_CAP): CombatUnit[] {
  const released: CombatUnit[] = []
  const leftover: PendingReinforcement[] = []
  for (const row of state.combat.pendingReinforcements) {
    const pkg = state.combat.packages.find((p) => p.id === row.packageId)
    if (row.units.length === 0) continue
    const room = Math.max(0, cap - livingEnemyCount(state) - released.length)
    if (room <= 0) {
      leftover.push(row)
      continue
    }
    const now = row.units.slice(0, room)
    const rest = row.units.slice(room)
    released.push(...now)
    if (pkg) {
      pkg.pendingCount = Math.max(0, pkg.pendingCount - now.length)
      pkg.spawnedUnitIds.push(...now.map((u) => u.id))
    }
    if (rest.length > 0) {
      leftover.push({ ...row, units: rest })
    }
  }
  state.combat.pendingReinforcements = leftover
  return released
}

export function markWaveReached(state: GameState, wave: number): boolean {
  const w = Math.max(1, Math.floor(wave))
  const prevReached = Math.max(0, state.combat.waveReached ?? 0)
  if (w <= prevReached) {
    state.combat.wave = state.combat.waveReached
    return false
  }
  state.combat.waveReached = w
  state.combat.wave = w
  return true
}

export function bossBoundaryBlocksNormalWaves(boundary: BossBoundaryState): boolean {
  return boundary.phase === 'holding' || boundary.phase === 'warning' || boundary.phase === 'active'
}

export function beginBossHold(state: GameState, warningDuration = BOSS_WARNING_DURATION): void {
  const wave = state.combat.nextWave
  state.combat.bossBoundary = {
    phase: 'holding',
    wave,
    warningLeft: 0,
    warningDuration,
  }
}

export function battlefieldClearForBoss(state: GameState): boolean {
  return livingEnemyCount(state) === 0 && state.combat.pendingReinforcements.length === 0
}

export function enterBossWarning(state: GameState, duration = BOSS_WARNING_DURATION): void {
  state.combat.bossBoundary = {
    phase: 'warning',
    wave: state.combat.bossBoundary.wave || state.combat.nextWave,
    warningLeft: duration,
    warningDuration: duration,
  }
}
