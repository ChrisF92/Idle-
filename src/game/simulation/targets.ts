import { PRESTIGE_MIN_SECTOR } from '../progression'
import type { TargetResult } from './types'
import { formatSimDuration } from './format'

/**
 * Targets taken from USI career doors (docs/usi-reskin-plan.md) and
 * existing design intent in balance-estimate.test.ts.
 *
 * USI analogue: first sitting unfolds Foundry→Research (S2–7); first
 * Rebuild when swapping Cores (~S4–12); Challenges 18; Warp/Echo 22;
 * first real slowdown around S20–23. Act 1 in Hiveworks is sector 30.
 *
 * balance-estimate.test.ts still pins theoretical floors:
 * - First push to prestige min (S4) combat time: 2–70 minutes
 * - Fresh → S30 without Rebuild is expected to wall
 * - Career to S30: several Rebuilds, hours of combat, casual calendar days
 */
export interface BalanceTarget {
  id: string
  label: string
  /** Seconds, inclusive. */
  min: number
  max: number
  warningPad: number
  milestoneId?: string
  kind: 'milestone-time' | 'rebuild-count' | 'highest-sector'
}

export const BALANCE_TARGETS: BalanceTarget[] = [
  {
    id: 'first-rebuild-time',
    label: 'First Rebuild',
    // Prestige is legal at S4; theoretical S4 combat floor is 2–70 min.
    // A real career Rebuild is later than the S4 legal gate, so the upper
    // bound is looser than the S4-only estimate.
    min: 2 * 60,
    max: 3 * 60 * 60,
    warningPad: 20 * 60,
    milestoneId: 'first-rebuild',
    kind: 'milestone-time',
  },
  {
    id: 'sector-10',
    label: 'Sector 10',
    min: 8 * 60,
    max: 8 * 60 * 60,
    warningPad: 45 * 60,
    milestoneId: 'sector-10',
    kind: 'milestone-time',
  },
  {
    id: 'sector-20',
    label: 'Sector 20',
    min: 20 * 60,
    max: 24 * 60 * 60,
    warningPad: 2 * 60 * 60,
    milestoneId: 'sector-20',
    kind: 'milestone-time',
  },
  {
    id: 'sector-30',
    label: 'Sector 30 (Act 1)',
    min: 2 * 60 * 60,
    max: 21 * 24 * 60 * 60,
    warningPad: 2 * 24 * 60 * 60,
    milestoneId: 'sector-30',
    kind: 'milestone-time',
  },
]

export const PRESTIGE_GATE_SECTOR = PRESTIGE_MIN_SECTOR

export function evaluateTarget(
  target: BalanceTarget,
  simulated: number | null,
): TargetResult {
  if (simulated == null || !Number.isFinite(simulated)) {
    return {
      id: target.id,
      label: target.label,
      targetLabel: `${formatSimDuration(target.min)}–${formatSimDuration(target.max)}`,
      simulatedLabel: 'not reached',
      severity: 'SKIP',
      note: 'Simulation ended before this milestone.',
    }
  }
  const lo = target.min
  const hi = target.max
  const warnLo = Math.max(0, lo - target.warningPad)
  const warnHi = hi + target.warningPad
  let severity: TargetResult['severity'] = 'PASS'
  let note = 'Within expected range from existing balance tests.'
  if (simulated < lo || simulated > hi) {
    if (simulated >= warnLo && simulated <= warnHi) {
      severity = 'WARNING'
      const delta = simulated < lo ? lo - simulated : simulated - hi
      note = `${formatSimDuration(delta)} outside the ${formatSimDuration(lo)}–${formatSimDuration(hi)} range.`
    } else {
      severity = 'FAIL'
      note = `Simulated ${formatSimDuration(simulated)} vs target ${formatSimDuration(lo)}–${formatSimDuration(hi)}.`
    }
  }
  return {
    id: target.id,
    label: target.label,
    targetLabel: `${formatSimDuration(target.min)}–${formatSimDuration(target.max)}`,
    simulatedLabel: formatSimDuration(simulated),
    severity,
    note,
  }
}
