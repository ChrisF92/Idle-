/** Orbital-defence arena constants and helpers (Phase 1). */

/** Logical arena half-width used for spawn / range math. */
export const ARENA_RADIUS = 210

/** Enemies appear on this ring around the flagship at (0,0). */
export const SPAWN_RADIUS = 200

/**
 * Legacy alias — older lane code and the canvas used SPAWN_DISTANCE as the
 * far-edge approach length. In the orbital arena it is the spawn ring radius.
 */
export const SPAWN_DISTANCE = SPAWN_RADIUS

/** Shared projectile travel speed (arena units / second). */
export const PROJECTILE_SPEED = 140

export function polarToCartesian(
  radius: number,
  angleRad: number,
): { x: number; y: number } {
  return {
    x: Math.cos(angleRad) * radius,
    y: Math.sin(angleRad) * radius,
  }
}

export function cartesianRadius(x: number, y: number): number {
  return Math.hypot(x, y)
}

export function cartesianAngle(x: number, y: number): number {
  return Math.atan2(y, x)
}

/** Euclidean distance between two arena positions. */
export function arenaDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Move a point radially toward a target radius, preserving angle. */
export function moveRadial(
  x: number,
  y: number,
  targetRadius: number,
  speed: number,
  dt: number,
): { x: number; y: number } {
  const r = Math.hypot(x, y)
  if (r < 1e-6) {
    return polarToCartesian(Math.max(0, targetRadius), 0)
  }
  const angle = Math.atan2(y, x)
  const delta = targetRadius - r
  const step = Math.sign(delta) * Math.min(Math.abs(delta), speed * dt)
  const nextR = Math.max(0, r + step)
  return polarToCartesian(nextR, angle)
}

/** Eight spawn sectors around the perimeter (N, NE, E, …). */
export function spawnSectorAngle(sectorIndex: number, jitter = 0): number {
  const base = -Math.PI / 2 + (sectorIndex % 8) * (Math.PI / 4)
  return base + jitter
}
