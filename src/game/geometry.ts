/** True 2D radial combat geometry. Hive origin is (0, 0). +Y is up. */

export const HIVE_ORIGIN = { x: 0, y: 0 } as const

/** Typical enemy reinforcement spawn radius, formation-adjusted. */
export const TYPICAL_SPAWN_RADIUS = 300

/**
 * Bearing 0 faces +Y (screen-up). Positive bearings rotate clockwise
 * in world space: right = π/2, bottom = π, left = 3π/2.
 */
export function pointFromBearing(bearing: number, radius: number): { x: number; y: number } {
  return {
    x: Math.sin(bearing) * radius,
    y: Math.cos(bearing) * radius,
  }
}

export function bearingOf(x: number, y: number): number {
  return Math.atan2(x, y)
}

export function hypot2(x: number, y: number): number {
  return Math.hypot(x, y)
}

export function distanceToHive(x: number, y: number): number {
  return Math.hypot(x, y)
}

export function distanceBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function scaleToDistance(
  x: number,
  y: number,
  targetDistance: number,
): { x: number; y: number } {
  const dist = Math.hypot(x, y)
  if (dist <= 1e-8) {
    return { x: 0, y: targetDistance }
  }
  const s = targetDistance / dist
  return { x: x * s, y: y * s }
}

/** Move along the radial line toward (or away from) the Hive. */
export function moveRadially(
  x: number,
  y: number,
  deltaDistance: number,
): { x: number; y: number } {
  const dist = Math.hypot(x, y)
  if (dist <= 1e-8) return { x, y }
  return scaleToDistance(x, y, Math.max(0, dist + deltaDistance))
}

export function coreWorldPosition(orbitRadius: number, orbitAngle: number): { x: number; y: number } {
  return pointFromBearing(orbitAngle, orbitRadius)
}

export function wrapTau(angle: number): number {
  const tau = Math.PI * 2
  return ((angle % tau) + tau) % tau
}
