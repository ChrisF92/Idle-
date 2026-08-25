/** Boss registry/provider. PR7 populates the authored Act 1 catalogue. */

import type { CombatUnit, GameState } from './types'
import { BOSS_WARNING_DURATION, isBossWave } from './waves'
import { TYPICAL_SPAWN_RADIUS, pointFromBearing } from './geometry'

export interface BossBuildContext {
  wave: number
  seed: number
  state?: GameState
}

export interface BossEncounterSpec {
  id: string
  name: string
  warningDuration: number
  units: CombatUnit[]
  blurb: string
}

export type BossProvider = (ctx: BossBuildContext) => BossEncounterSpec | null

let productionProvider: BossProvider | null = null
let testProvider: BossProvider | null = null

export function setBossProvider(provider: BossProvider | null): void {
  productionProvider = provider
}

export function setTestBossProvider(provider: BossProvider | null): void {
  testProvider = provider
}

export function resolveBossEncounter(ctx: BossBuildContext): BossEncounterSpec | null {
  if (!isBossWave(ctx.wave)) return null
  const fromTest = testProvider?.(ctx)
  if (fromTest) return fromTest
  const fromProduction = productionProvider?.(ctx)
  if (fromProduction) return fromProduction
  return developmentBossFallback(ctx)
}

/**
 * Isolated noncanonical development fallback so the engine does not deadlock
 * before PR7 authors the Boss catalogue. Unreachable in normal Act 1 once
 * `setBossProvider` is populated.
 */
export function developmentBossFallback(ctx: BossBuildContext): BossEncounterSpec {
  if (typeof console !== 'undefined') {
    console.warn(
      `[Hiveworks] Noncanonical development Boss fallback for Wave ${ctx.wave}. PR7 must replace this provider.`,
    )
  }
  const pos = pointFromBearing(0, TYPICAL_SPAWN_RADIUS)
  const unit: CombatUnit = {
    id: `dev-boss-w${ctx.wave}`,
    side: 'enemy',
    name: `Development Boundary ${ctx.wave}`,
    shape: 'hex',
    family: 'titan',
    hull: 80,
    hullMax: 80,
    shield: 0,
    shieldMax: 0,
    armor: 2,
    evasion: 0,
    damageTakenMult: 1,
    weapons: [
      {
        id: `dev-boss-w${ctx.wave}-wpn`,
        name: 'Boundary strike',
        damage: 4,
        cooldown: 2.2,
        cooldownLeft: 1,
        range: 90,
        tags: ['kinetic'],
        splash: 0,
        dotDuration: 0,
        dotDamage: 0,
        telegraphDuration: 0.4,
        telegraphLeft: 0,
      },
    ],
    isBoss: true,
    isFlagship: true,
    dots: [],
    x: pos.x,
    y: pos.y,
    heading: 0,
    speed: 18,
    engageRange: 96,
    kite: false,
    phaseWarnLeft: 0,
    regenDelay: 0,
    rewardWeight: 1,
    sourceWave: ctx.wave,
  }
  return {
    id: `dev-boss-w${ctx.wave}`,
    name: `Development Boundary ${ctx.wave}`,
    warningDuration: BOSS_WARNING_DURATION,
    units: [unit],
    blurb: 'Noncanonical development Boss. PR7 replaces this provider.',
  }
}

export function emptyBossBoundary(wave = 0): import('./types').BossBoundaryState {
  return { phase: 'idle', wave, warningLeft: 0 }
}
