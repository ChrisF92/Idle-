/** Lane range drawn at the canvas rim. Spawn sits just outside so the close is visible. */
export const RADIAL_EDGE_RANGE = 172

/** Screen-space helpers for radial combat presentation. */

export function shotTravelHeading(
  from: { side: 'player' | 'enemy'; heading?: number },
  to: { heading?: number },
): number {
  if (from.side === 'player') return to.heading ?? 0
  return from.heading ?? 0
}

/** 0 at muzzle, 1 at the current target. */
export function shotTravelT(
  side: 'player' | 'enemy',
  range: number,
  originRange: number,
  destRange: number,
): number {
  if (side === 'player') {
    const span = Math.max(0.001, destRange - originRange)
    return Math.max(0, Math.min(1, (range - originRange) / span))
  }
  const span = Math.max(0.001, originRange - destRange)
  return Math.max(0, Math.min(1, (originRange - range) / span))
}

export function lerp2(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  t: number,
): { x: number; y: number } {
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t }
}

/** Screen point along the muzzle → target line for the current sim range. */
export function projectileScreenPoint(
  side: 'player' | 'enemy',
  range: number,
  originRange: number,
  destRange: number,
  fromScreen: { x: number; y: number },
  toScreen: { x: number; y: number },
): { x: number; y: number } {
  const t = shotTravelT(side, range, originRange, destRange)
  return lerp2(fromScreen.x, fromScreen.y, toScreen.x, toScreen.y, t)
}

export function coreRoleColor(role: 'weapon' | 'defense' | 'utility'): string {
  if (role === 'weapon') return '#e07070'
  if (role === 'defense') return '#6eb4ff'
  return '#e8c04a'
}

export function weaponIdToCoreId(weaponId?: string): string | null {
  if (!weaponId) return null
  const tagged = weaponId.match(/^(.*)-wpn(?:-\d+)?$/)
  return tagged ? tagged[1] : weaponId
}

/** Half-width of a weapon Core's outward firing cone, in radians. */
export const CORE_FIRE_ARC = 0.82

export function wrapAngle(angle: number): number {
  const tau = Math.PI * 2
  return ((angle + Math.PI) % tau + tau) % tau - Math.PI
}

export function shortestAngleDelta(from: number, to: number): number {
  return wrapAngle(to - from)
}

export function easeAngle(current: number, dest: number, dt: number, stiffness = 10): number {
  const delta = shortestAngleDelta(current, dest)
  return current + delta * (1 - Math.exp(-Math.max(0, dt) * stiffness))
}

export function pointOnRing(
  center: { x: number; y: number },
  radius: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  }
}

export function ringAngleToward(
  center: { x: number; y: number },
  point: { x: number; y: number },
): number {
  return Math.atan2(point.y - center.y, point.x - center.x)
}

/** True if segment a→b enters the disk at center with the given radius. */
export function segmentHitsCircle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  center: { x: number; y: number },
  radius: number,
): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const fx = a.x - center.x
  const fy = a.y - center.y
  const aa = dx * dx + dy * dy
  if (aa <= 1e-8) return fx * fx + fy * fy < radius * radius
  const bb = 2 * (fx * dx + fy * dy)
  const cc = fx * fx + fy * fy - radius * radius
  const disc = bb * bb - 4 * aa * cc
  if (disc < 0) return false
  const root = Math.sqrt(disc)
  const t1 = (-bb - root) / (2 * aa)
  const t2 = (-bb + root) / (2 * aa)
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1)
}

export function isOutwardFiringArc(
  coreAngle: number,
  targetAngle: number,
  arcHalf = CORE_FIRE_ARC,
): boolean {
  return Math.abs(shortestAngleDelta(coreAngle, targetAngle)) <= arcHalf
}

/** Nearest angle on the ring that still faces the target inside the firing arc. */
export function closestValidFacing(
  current: number,
  targetAngle: number,
  arcHalf = CORE_FIRE_ARC,
): number {
  const delta = shortestAngleDelta(current, targetAngle)
  if (Math.abs(delta) <= arcHalf) return current
  return targetAngle - Math.sign(delta) * arcHalf
}

/** Keep a muzzle on the ring if the straight shot would clip the Hive. */
export function muzzleClearOfHive(
  from: { x: number; y: number },
  to: { x: number; y: number },
  hive: { x: number; y: number },
  hiveRadius: number,
  orbit: number,
): { x: number; y: number } {
  if (!segmentHitsCircle(from, to, hive, hiveRadius)) return from
  return pointOnRing(hive, Math.max(orbit, hiveRadius + 2), ringAngleToward(hive, to))
}
