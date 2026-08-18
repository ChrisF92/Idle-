import { ACT1_TARGETS } from '../balance/act1'
import { PRESTIGE_MIN_SECTOR } from '../progression'
import type { BalanceTarget, TargetResult } from './types'
import { formatSimDuration } from './format'

export type { BalanceTarget }

/**
 * Act 1 pacing windows live in `src/game/balance/act1.ts`.
 * This file evaluates a simulated milestone time against those windows.
 */
export const BALANCE_TARGETS: BalanceTarget[] = [...ACT1_TARGETS]

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
  let note = 'Inside the authored Act 1 window.'
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
