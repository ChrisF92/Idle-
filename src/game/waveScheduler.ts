/** Continuous Wave scheduler: reinforcement, pending threat, Boss boundaries. */

import type { CombatUnit, GameState, WavePackageKind, WavePackageState } from './types'
import { encounterForWave, revealCodexFamilies, syncHullAggregates } from './combat'
import { resolveBossEncounter } from './bossProvider'
import { aiDoctrinesActive } from './catalog'
import {
  battlefieldClearForBoss,
  beginBossHold,
  bossBoundaryBlocksNormalWaves,
  createWavePackage,
  drainPending,
  enqueuePending,
  markWaveReached,
  packageHasLivingOrPending,
  splitSpawnCapacity,
  wavePackageKindFor,
} from './waveRuntime'
import {
  ACT1_FINAL_WAVE,
  BOSS_WARNING_DURATION,
  isBossWave,
  NORMAL_REINFORCEMENT_INTERVAL,
} from './waves'
import { salvageWaveBonus } from './workshop'
import { grantSignalCoreDrop } from './signalCores'

export interface WaveSchedulerHooks {
  pushLog: (state: GameState, line: string) => void
  onWaveReached?: (state: GameState, wave: number, kind: WavePackageKind) => void
  onWaveSecured?: (state: GameState, pkg: WavePackageState) => void
}

function stampUnits(units: CombatUnit[], pkg: WavePackageState): CombatUnit[] {
  return units.map((unit, i) => ({
    ...structuredClone(unit),
    id: `${pkg.id}-u${i + 1}`,
    packageId: pkg.id,
    sourceWave: pkg.wave,
  }))
}

function admitUnits(state: GameState, pkg: WavePackageState, units: CombatUnit[]): void {
  const stamped = stampUnits(units, pkg)
  const { spawnNow, pending } = splitSpawnCapacity(state, stamped)
  pkg.totalUnits = stamped.length
  pkg.spawnedUnitIds.push(...spawnNow.map((u) => u.id))
  state.combat.enemyUnits.push(...spawnNow)
  enqueuePending(state, pkg, pending)
  syncHullAggregates(state)
  revealCodexFamilies(
    state,
    stamped.map((u) => u.family),
  )
}

export function startWavePackage(
  state: GameState,
  wave: number,
  hooks: WaveSchedulerHooks,
  unitsOverride?: CombatUnit[],
  kindOverride?: WavePackageKind,
): WavePackageState {
  const kind = kindOverride ?? wavePackageKindFor(wave)
  const units =
    unitsOverride ??
    encounterForWave(wave, 1, state).units.map((u) => structuredClone(u))
  const pkg = createWavePackage(state, wave, kind, units.length)
  state.combat.packages.push(pkg)
  const first = markWaveReached(state, wave)
  admitUnits(state, pkg, units)
  const encounter = encounterForWave(wave, 1, state)
  state.combat.enemyName = encounter.name
  state.combat.enemyFamily = encounter.family
  state.combat.enemyTags = [...encounter.tags]
  state.combat.isBoss = kind === 'boss'
  state.combat.waveThreat = encounter.threat
    ? { seed: encounter.threat.seed, budget: encounter.threat.budget, spent: encounter.threat.spent }
    : undefined
  if (kind === 'boss') {
    state.combat.bossPhase = 0
  }
  if (first) hooks.onWaveReached?.(state, wave, kind)
  hooks.pushLog(
    state,
    `Wave ${wave} reached${kind === 'boss' ? ' — Boss' : kind === 'commander' ? ' — Commander candidate' : ''}.`,
  )
  return pkg
}

export function startBossEncounter(state: GameState, hooks: WaveSchedulerHooks): void {
  const wave = state.combat.bossBoundary.wave || state.combat.nextWave
  const spec = resolveBossEncounter({
    wave,
    seed: state.combat.sortieSeed ?? 1,
    state,
  })
  const units = (spec?.units ?? []).map((u) => {
    const copy = structuredClone(u)
    copy.isBoss = true
    copy.sourceWave = wave
    return copy
  })
  state.combat.bossBoundary = { phase: 'active', wave, warningLeft: 0 }
  state.combat.enemyName = spec?.name ?? `Boss Wave ${wave}`
  state.combat.isBoss = true
  state.combat.bossMechanic = spec?.id
  startWavePackage(state, wave, hooks, units, 'boss')
  state.combat.nextWave = wave + 1
  state.combat.nextReinforcementAt = Number.POSITIVE_INFINITY
}

function payWaveSecureReward(state: GameState, pkg: WavePackageState, hooks: WaveSchedulerHooks): void {
  if (pkg.rewardPaid) return
  pkg.rewardPaid = true
  pkg.secured = true
  const salvageBonus = salvageWaveBonus(state)
  if (salvageBonus > 0) state.resources.salvage += salvageBonus
  let drip = Math.max(1, 5 + Math.floor(pkg.wave / 5))
  if (aiDoctrinesActive(state, 'scavenger')) drip *= 1.3
  drip = Math.max(1, Math.floor(drip))
  state.resources.scrap += drip
  if (pkg.kind === 'boss') {
    grantSignalCoreDrop(state, 'boss')
  }
  hooks.pushLog(
    state,
    `Wave ${pkg.wave} secured. +${drip} scrap.${salvageBonus ? ` +${salvageBonus} salvage.` : ''}`,
  )
  hooks.onWaveSecured?.(state, pkg)
}

export function resolveWaveSecurity(state: GameState, hooks: WaveSchedulerHooks): WavePackageState[] {
  const newly: WavePackageState[] = []
  for (const pkg of state.combat.packages) {
    if (pkg.secured || pkg.rewardPaid) continue
    if (packageHasLivingOrPending(state, pkg)) continue
    payWaveSecureReward(state, pkg, hooks)
    newly.push(pkg)
  }
  return newly
}

function releasePending(state: GameState): void {
  const released = drainPending(state)
  if (released.length === 0) return
  state.combat.enemyUnits.push(...released)
  syncHullAggregates(state)
}

function scheduleNextNormal(state: GameState, fromWave: number): void {
  state.combat.nextWave = fromWave + 1
  state.combat.nextReinforcementAt =
    (state.combat.simTime ?? 0) + NORMAL_REINFORCEMENT_INTERVAL
}

export function tickWaveScheduler(state: GameState, dt: number, hooks: WaveSchedulerHooks): void {
  if (state.combat.docked) return
  releasePending(state)
  const secured = resolveWaveSecurity(state, hooks)

  const boundary = state.combat.bossBoundary
  if (boundary.phase === 'active') {
    const bossPkg = state.combat.packages.find((p) => p.wave === boundary.wave && p.kind === 'boss')
    const bossDead = bossPkg?.secured || secured.some((p) => p.kind === 'boss' && p.wave === boundary.wave)
    if (bossDead) {
      state.combat.bossBoundary = { phase: 'cleared', wave: boundary.wave, warningLeft: 0 }
      state.combat.isBoss = false
      scheduleNextNormal(state, boundary.wave)
    }
    return
  }

  if (boundary.phase === 'holding') {
    if (battlefieldClearForBoss(state)) {
      state.combat.bossBoundary = {
        phase: 'warning',
        wave: boundary.wave,
        warningLeft: BOSS_WARNING_DURATION,
      }
      hooks.pushLog(state, `Boss warning — Wave ${boundary.wave}.`)
    }
    return
  }

  if (boundary.phase === 'warning') {
    state.combat.bossBoundary.warningLeft = Math.max(0, boundary.warningLeft - dt)
    if (state.combat.bossBoundary.warningLeft <= 0) {
      startBossEncounter(state, hooks)
    }
    return
  }

  if (bossBoundaryBlocksNormalWaves(boundary)) return

  if (isBossWave(state.combat.nextWave) && state.combat.nextWave <= ACT1_FINAL_WAVE) {
    beginBossHold(state)
    return
  }

  if ((state.combat.simTime ?? 0) + 1e-9 >= (state.combat.nextReinforcementAt ?? 0)) {
    const wave = state.combat.nextWave
    if (wave > ACT1_FINAL_WAVE) return
    startWavePackage(state, wave, hooks)
    scheduleNextNormal(state, wave)
  }
}
