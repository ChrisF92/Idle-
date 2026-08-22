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
  return weaponId.endsWith('-wpn') ? weaponId.slice(0, -4) : weaponId
}
