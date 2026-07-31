/** Shared display helpers — keep combat floats out of the UI. */

export function formatStat(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '0'
  const f = 10 ** decimals
  const rounded = Math.round((n + Number.EPSILON) * f) / f
  return rounded.toFixed(decimals)
}

/** Whole numbers without trailing .00; otherwise fixed decimals. */
export function formatCompact(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '0'
  const f = 10 ** decimals
  const rounded = Math.round((n + Number.EPSILON) * f) / f
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return String(Math.round(rounded))
  }
  return rounded.toFixed(decimals)
}
