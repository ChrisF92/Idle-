/**
 * Late Act 1 (W140–W300) diagnosis helpers.
 *
 * Used by the career simulator and tests to explain the W160 stall without
 * retuning early-game curves. Named combat exponents stay in combat.ts.
 */

import {
  encounterForWave,
  enemyDamageScale,
  enemySectorScale,
  ENEMY_HULL_MID,
  ENEMY_WAVE_HULL_RAMP,
} from '../combat'
import { ASH_PER_HEAT, furnaceAshFromKill, furnaceLightCost } from '../furnace'
import { createInitialState } from '../state'
import { powerSectorForWave } from '../waves'

export const LATE_ACT1_WAVES = [140, 160, 170, 210, 250, 300] as const

export interface LateAct1WaveProbe {
  wave: number
  sector: number
  hullScale: number
  damageScale: number
  hullVsW140: number
  damageVsW140: number
  packRoles: string[]
  packCount: number
  packEhp: number
  packDps: number
  ashPerTrash: number
  ashPerBoss: number
  killsForWeaponsI: number
}

function packStats(wave: number) {
  const encounter = encounterForWave(wave)
  const packEhp = encounter.units.reduce((s, u) => s + u.hullMax + u.shieldMax, 0)
  const packDps = encounter.units.reduce(
    (s, u) => s + u.weapons.reduce((wSum, w) => wSum + w.damage / Math.max(0.05, w.cooldown), 0),
    0,
  )
  return {
    packRoles: encounter.units.map((u) => u.role),
    packCount: encounter.units.length,
    packEhp,
    packDps,
  }
}

export function probeLateAct1Wave(wave: number, relativeTo = 140): LateAct1WaveProbe {
  const sector = powerSectorForWave(wave)
  const hull = enemySectorScale(sector) * (1 + (waveInBandLocal(wave) - 1) * ENEMY_WAVE_HULL_RAMP)
  const dmg = enemyDamageScale(sector) * (1 + (waveInBandLocal(wave) - 1) * ENEMY_WAVE_HULL_RAMP)
  const baseSector = powerSectorForWave(relativeTo)
  const baseHull =
    enemySectorScale(baseSector) * (1 + (waveInBandLocal(relativeTo) - 1) * ENEMY_WAVE_HULL_RAMP)
  const baseDmg =
    enemyDamageScale(baseSector) * (1 + (waveInBandLocal(relativeTo) - 1) * ENEMY_WAVE_HULL_RAMP)
  const state = createInitialState(0)
  const best = Math.max(wave, 140)
  state.meta.bestWave = best
  state.combat.bestWave = best
  state.meta.highestSectorEver = sector
  state.combat.highestSector = sector
  state.combat.sector = sector
  state.combat.wave = wave
  const ashTrash = furnaceAshFromKill(state, false)
  const ashBoss = furnaceAshFromKill(state, true)
  const weaponsCost = furnaceLightCost('weapons', 1) * ASH_PER_HEAT
  return {
    wave,
    sector,
    hullScale: hull,
    damageScale: dmg,
    hullVsW140: hull / Math.max(1e-6, baseHull),
    damageVsW140: dmg / Math.max(1e-6, baseDmg),
    ...packStats(wave),
    ashPerTrash: ashTrash,
    ashPerBoss: ashBoss,
    killsForWeaponsI: ashTrash > 0 ? Math.ceil(weaponsCost / ashTrash) : Number.POSITIVE_INFINITY,
  }
}

function waveInBandLocal(wave: number): number {
  const n = Math.max(1, Math.floor(wave)) % 10
  return n === 0 ? 10 : n
}

export function diagnoseW160Wall(): {
  hullMidGrowth: number
  hullW140toW160: number
  damageW140toW160: number
  hullW160toW170: number
  densityW160: number
  densityW140: number
  ashAtW140: number
  ashAtW160: number
  killsForWeaponsI: number
  missingLever: string
} {
  const a = probeLateAct1Wave(140)
  const b = probeLateAct1Wave(160)
  const c = probeLateAct1Wave(170)
  return {
    hullMidGrowth: ENEMY_HULL_MID,
    hullW140toW160: b.hullVsW140,
    damageW140toW160: b.damageVsW140,
    hullW160toW170: c.hullScale / b.hullScale,
    densityW160: b.packCount,
    densityW140: a.packCount,
    ashAtW140: a.ashPerTrash,
    ashAtW160: b.ashPerTrash,
    killsForWeaponsI: b.killsForWeaponsI,
    missingLever:
      'Furnace Heat is a stored push, not a drip. Convert+light on a frontier Sortie; do not Rebuild-spam the bank away.',
  }
}

export function lateAct1TimelineLine(
  wave: number,
  label: string,
  activeSeconds: number | null,
): string {
  if (activeSeconds == null || !Number.isFinite(activeSeconds)) return `W${wave}  ${label.padEnd(14)} —`
  const h = activeSeconds / 3600
  return `W${wave}  ${label.padEnd(14)} ${h >= 10 ? h.toFixed(0) : h.toFixed(0)}h`
}
