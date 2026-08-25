/** Deterministic radial formation primitives. Enemy-specific assignment is later content. */

import { pointFromBearing, TYPICAL_SPAWN_RADIUS, wrapTau } from './geometry'
import { hashSeed, rngFloat, rngNext, type SimRngState } from './simRng'

export type FormationId =
  | 'spear'
  | 'pincer'
  | 'encirclement'
  | 'screen'
  | 'siege'
  | 'swarm-burst'
  | 'mixed-pressure'

export const FORMATION_IDS: FormationId[] = [
  'spear',
  'pincer',
  'encirclement',
  'screen',
  'siege',
  'swarm-burst',
  'mixed-pressure',
]

export interface FormationSlot {
  x: number
  y: number
  bearing: number
  radius: number
}

export interface FormationContext {
  rng: SimRngState
  wave: number
  packageId: string
  spawnRadius?: number
  bearing?: number
}

function slot(bearing: number, radius: number): FormationSlot {
  const p = pointFromBearing(bearing, radius)
  return { x: p.x, y: p.y, bearing: wrapTau(bearing), radius }
}

function packageJitter(ctx: FormationContext): number {
  return hashSeed(ctx.wave, ctx.packageId.length, ctx.rng.s)
}

export function pickFormation(ctx: FormationContext): FormationId {
  const h = hashSeed(ctx.wave, packageJitter(ctx), 0x51ed)
  return FORMATION_IDS[h % FORMATION_IDS.length]!
}

export function baseBearing(ctx: FormationContext): number {
  if (ctx.bearing != null) return wrapTau(ctx.bearing)
  return wrapTau(rngFloat(ctx.rng, 0, Math.PI * 2))
}

export function formationSlots(id: FormationId, count: number, ctx: FormationContext): FormationSlot[] {
  const n = Math.max(1, Math.floor(count))
  const radius = ctx.spawnRadius ?? TYPICAL_SPAWN_RADIUS
  const bearing = baseBearing(ctx)
  switch (id) {
    case 'spear':
      return spearSlots(n, bearing, radius)
    case 'pincer':
      return pincerSlots(n, bearing, radius, ctx.rng)
    case 'encirclement':
      return encirclementSlots(n, bearing, radius)
    case 'screen':
      return screenSlots(n, bearing, radius)
    case 'siege':
      return siegeSlots(n, bearing, radius)
    case 'swarm-burst':
      return swarmBurstSlots(n, bearing, radius, ctx.rng)
    case 'mixed-pressure':
      return mixedPressureSlots(n, bearing, radius, ctx.rng)
  }
}

function spearSlots(n: number, bearing: number, radius: number): FormationSlot[] {
  return Array.from({ length: n }, (_, i) => slot(bearing, radius + i * 18))
}

function pincerSlots(n: number, bearing: number, radius: number, rng: SimRngState): FormationSlot[] {
  const spread = 0.55 + rngNext(rng) * 0.25
  return Array.from({ length: n }, (_, i) => {
    const left = i % 2 === 0
    const rank = Math.floor(i / 2)
    return slot(bearing + (left ? -spread : spread), radius + rank * 14)
  })
}

function encirclementSlots(n: number, bearing: number, radius: number): FormationSlot[] {
  return Array.from({ length: n }, (_, i) => slot(bearing + (i / n) * Math.PI * 2, radius))
}

function screenSlots(n: number, bearing: number, radius: number): FormationSlot[] {
  const width = Math.min(1.6, 0.28 * Math.max(1, n - 1))
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1)
    return slot(bearing - width / 2 + t * width, radius)
  })
}

function siegeSlots(n: number, bearing: number, radius: number): FormationSlot[] {
  const far = radius + 36
  const width = Math.min(2.2, 0.34 * Math.max(1, n - 1))
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1)
    return slot(bearing - width / 2 + t * width, far)
  })
}

function swarmBurstSlots(n: number, bearing: number, radius: number, rng: SimRngState): FormationSlot[] {
  return Array.from({ length: n }, () => {
    const a = bearing + rngFloat(rng, -0.22, 0.22)
    const r = radius + rngFloat(rng, -16, 16)
    return slot(a, r)
  })
}

function mixedPressureSlots(n: number, bearing: number, radius: number, rng: SimRngState): FormationSlot[] {
  return Array.from({ length: n }, (_, i) => {
    const ring = i % 3
    const a = bearing + (i / Math.max(1, n)) * Math.PI * 1.4 - 0.7 + rngFloat(rng, -0.08, 0.08)
    const r = radius + ring * 22 + rngFloat(rng, -8, 8)
    return slot(a, r)
  })
}
