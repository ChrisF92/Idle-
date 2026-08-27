/** Continuous Wave scheduler: reinforcement, pending threat, Boss boundaries. */

import type { CombatUnit, GameState, WavePackageKind, WavePackageState } from './types'
import { encounterForWave, pruneDeadEnemyUnits, syncHullAggregates } from './combat'
import { resolveBossEncounter } from './bossProvider'
import './bossRegistry'
import { aiDoctrinesActive } from './catalog'
import {
  admitUnitToPackage,
  battlefieldClearForBoss,
  beginBossHold,
  bossBoundaryBlocksNormalWaves,
  createWavePackage,
  drainPending,
  enterBossWarning,
  markWaveReached,
  packageHasLivingOrPending,
  wavePackageKindFor,
} from './waveRuntime'
import { ACT1_FINAL_WAVE, BOSS_WARNING_DURATION, isBossWave, NORMAL_REINFORCEMENT_INTERVAL } from './waves'
import { salvageWaveBonus, scrapWaveBonus } from './workshop'
import { combatScrapMatterMult } from './matter'
import { grantGeneratedScrap } from './rebuild'
import { grantSignalCoreDrop } from './signalCores'
import { packThreat } from './threatBudget'
import { shouldReserveCommander, reserveCommander } from './commanders'
import { COMMANDER_NOTICE_DURATION } from './hostileSeeds'
import { recordBossClearSources } from './bossClear'
import { noteBacklogEnteringBossHold, noteBacklogEnteringCommander, noteBossEncounterEnd, noteBossEncounterStart } from './encounterTelemetry'

export interface WaveSchedulerHooks {
  pushLog: (state: GameState, line: string) => void
  onWaveReached?: (state: GameState, wave: number, kind: WavePackageKind) => void
  onWaveSecured?: (state: GameState, pkg: WavePackageState) => void
}

export interface WavePresentation {
  name: string
  family: string
  tags: string[]
  threat?: { seed: number; budget: number; spent: number }
}

function applyPresentation(state: GameState, presentation: WavePresentation, boss: boolean): void {
  state.combat.enemyName = presentation.name
  state.combat.enemyFamily = presentation.family
  state.combat.enemyTags = [...presentation.tags]
  state.combat.isBoss = boss
  state.combat.waveThreat = presentation.threat
}

function admitUnits(state: GameState, pkg: WavePackageState, units: CombatUnit[]): void {
  units.map((unit) => admitUnitToPackage(state, pkg, unit))
  syncHullAggregates(state)
}

export function startWavePackage(
  state: GameState,
  wave: number,
  hooks: WaveSchedulerHooks,
  unitsOverride?: CombatUnit[],
  kindOverride?: WavePackageKind,
  presentationOverride?: WavePresentation,
): WavePackageState {
  const kind = kindOverride ?? wavePackageKindFor(wave)
  const encounter = unitsOverride ? null : encounterForWave(wave, 1, state)
  let units = unitsOverride ?? encounter!.units.map((u) => structuredClone(u))
  const pkg = createWavePackage(state, wave, kind, units.length)
  state.combat.packages.push(pkg)
  const first = markWaveReached(state, wave)
  if (kind === 'commander') {
    noteBacklogEnteringCommander(state)
    const commander = units.find((u) => u.isCommander)
    if (commander && shouldReserveCommander(state)) {
      units = units.filter((u) => !u.isCommander)
      reserveCommander(state, commander, pkg, packThreat([commander]))
    }
    if (wave === 10 && !state.combat.commanderNotice) {
      state.combat.commanderNotice = {
        title: 'COMMANDER CONTACT',
        body: 'Promoted hostiles carry one enhanced trait and improved rewards.',
        untilSim: (state.combat.simTime ?? 0) + COMMANDER_NOTICE_DURATION,
      }
    }
  }
  admitUnits(state, pkg, units)
  if (presentationOverride) {
    applyPresentation(state, presentationOverride, kind === 'boss')
  } else if (encounter) {
    applyPresentation(
      state,
      {
        name: encounter.name,
        family: encounter.family,
        tags: [...encounter.tags],
        threat: encounter.threat
          ? { seed: encounter.threat.seed, budget: encounter.threat.budget, spent: encounter.threat.spent }
          : undefined,
      },
      kind === 'boss',
    )
  } else {
    const lead = units[0]
    applyPresentation(
      state,
      {
        name: lead?.name ?? `Wave ${wave}`,
        family: lead?.family ?? '',
        tags: lead ? [lead.family, ...(kind === 'boss' ? ['boss'] : [])] : [],
      },
      kind === 'boss',
    )
  }
  if (kind === 'boss') state.combat.bossPhase = 0
  if (first) hooks.onWaveReached?.(state, wave, kind)
  hooks.pushLog(
    state,
    `Wave ${wave} reached${kind === 'boss' ? ' — Boss' : kind === 'commander' ? ' — Commander' : ''}.`,
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
    copy.sourceWave = wave
    return copy
  })
  if (units.length > 0 && !units.some((u) => u.isBoss)) {
    units[0]!.isBoss = true
  }
  const lead = units.find((u) => u.isBoss) ?? units[0]
  state.combat.bossBoundary = {
    phase: 'active',
    wave,
    warningLeft: 0,
    warningDuration: spec?.warningDuration ?? state.combat.bossBoundary.warningDuration,
  }
  state.combat.bossMechanic = spec?.id
  noteBossEncounterStart(state)
  startWavePackage(state, wave, hooks, units, 'boss', {
    name: spec?.name ?? `Boss Wave ${wave}`,
    family: lead?.family ?? '',
    tags: spec ? ['boss', spec.id] : ['boss'],
  })
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
  const waveScrap = (drip + scrapWaveBonus(state)) * combatScrapMatterMult(state)
  grantGeneratedScrap(state, waveScrap, 'combat-wave')
  if (pkg.kind === 'boss') {
    grantSignalCoreDrop(state, 'boss')
    recordBossClearSources(state, pkg.wave)
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
  state.combat.nextReinforcementAt = (state.combat.simTime ?? 0) + NORMAL_REINFORCEMENT_INTERVAL
}

function authoredWarningDuration(state: GameState, wave: number): number {
  const spec = resolveBossEncounter({
    wave,
    seed: state.combat.sortieSeed ?? 1,
    state,
  })
  return spec?.warningDuration ?? BOSS_WARNING_DURATION
}

export function tickWaveScheduler(state: GameState, dt: number, hooks: WaveSchedulerHooks): void {
  if (state.combat.docked) return
  pruneDeadEnemyUnits(state)
  releasePending(state)
  const secured = resolveWaveSecurity(state, hooks)

  const boundary = state.combat.bossBoundary
  if (boundary.phase === 'active') {
    const bossPkg = state.combat.packages.find((p) => p.wave === boundary.wave && p.kind === 'boss')
    const bossDead = bossPkg?.secured || secured.some((p) => p.kind === 'boss' && p.wave === boundary.wave)
    if (bossDead) {
      state.combat.bossBoundary = {
        phase: 'cleared',
        wave: boundary.wave,
        warningLeft: 0,
        warningDuration: boundary.warningDuration,
      }
      state.combat.isBoss = false
      noteBossEncounterEnd(state)
      scheduleNextNormal(state, boundary.wave)
    }
    return
  }

  if (boundary.phase === 'holding') {
    if (battlefieldClearForBoss(state)) {
      const duration = boundary.warningDuration || authoredWarningDuration(state, boundary.wave)
      enterBossWarning(state, duration)
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

  if ((state.combat.simTime ?? 0) + 1e-9 >= (state.combat.nextReinforcementAt ?? 0)) {
    const wave = state.combat.nextWave
    if (wave > ACT1_FINAL_WAVE) return
    if (isBossWave(wave)) {
      noteBacklogEnteringBossHold(state)
      beginBossHold(state, authoredWarningDuration(state, wave))
      return
    }
    startWavePackage(state, wave, hooks)
    scheduleNextNormal(state, wave)
  }
}
