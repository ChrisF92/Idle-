/** Shared display helpers — keep combat floats out of the UI. */

export type NumberNotation = 'engineering' | 'scientific'

/** Values at or above this use the player's notation toggle. */
export const LARGE_NUMBER_THRESHOLD = 1000

let activeNumberNotation: NumberNotation = 'engineering'

export function setActiveNumberNotation(mode: NumberNotation): void {
  activeNumberNotation = mode === 'scientific' ? 'scientific' : 'engineering'
}

export function getActiveNumberNotation(): NumberNotation {
  return activeNumberNotation
}

function trimZeros(s: string): string {
  if (!s.includes('.')) return s
  return s.replace(/\.?0+$/, '')
}

function formatMantissa(mant: number, decimals: number): string {
  const rounded = Number(mant.toFixed(decimals))
  return trimZeros(rounded.toFixed(decimals))
}

/**
 * Scientific: 1.23e4 (mantissa in [1, 10)).
 * Engineering: 12.3e3 (exponent a multiple of 3, mantissa in [1, 1000)).
 */
export function formatLargeNumber(
  n: number,
  notation: NumberNotation = activeNumberNotation,
): string {
  if (!Number.isFinite(n)) return '0'
  if (n === 0) return '0'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs < LARGE_NUMBER_THRESHOLD) {
    return sign + formatCompactSmall(abs)
  }

  if (notation === 'scientific') {
    let exp = Math.floor(Math.log10(abs))
    let mant = abs / 10 ** exp
    if (mant >= 9.995) {
      mant = 1
      exp += 1
    }
    return `${sign}${formatMantissa(mant, 2)}e${exp}`
  }

  let exp = Math.floor(Math.log10(abs) / 3) * 3
  let mant = abs / 10 ** exp
  if (mant >= 999.5) {
    mant = 1
    exp += 3
  }
  const decimals = mant >= 100 ? 0 : mant >= 10 ? 1 : 2
  return `${sign}${formatMantissa(mant, decimals)}e${exp}`
}

function formatCompactSmall(abs: number, decimals = 2): string {
  const f = 10 ** decimals
  const rounded = Math.round((abs + Number.EPSILON) * f) / f
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return String(Math.round(rounded))
  }
  return rounded.toFixed(decimals)
}

export function formatStat(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '0'
  if (Math.abs(n) >= LARGE_NUMBER_THRESHOLD) {
    return formatLargeNumber(n)
  }
  const f = 10 ** decimals
  const rounded = Math.round((n + Number.EPSILON) * f) / f
  return rounded.toFixed(decimals)
}

/** Whole numbers without trailing .00; large values follow the notation toggle. */
export function formatCompact(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '0'
  if (Math.abs(n) >= LARGE_NUMBER_THRESHOLD) {
    return formatLargeNumber(n)
  }
  const sign = n < 0 ? '-' : ''
  return sign + formatCompactSmall(Math.abs(n), decimals)
}

/** Alias used by HUD / resource chips. */
export function formatNumber(n: number, notation?: NumberNotation): string {
  if (notation) return formatLargeNumber(n, notation)
  return formatLargeNumber(n)
}
