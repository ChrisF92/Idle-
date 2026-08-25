/** One reason-based simulation pause. Components record reasons; App writes a single flag. */

export type PauseReason =
  | 'onboarding.action'
  | 'directive.choice'
  | 'confirm.blocking'
  | 'offline.report'
  | 'dev.simulator'
  | 'update.critical'

const PAUSE_ORDER: PauseReason[] = [
  'update.critical',
  'confirm.blocking',
  'onboarding.action',
  'directive.choice',
  'offline.report',
  'dev.simulator',
]

export function collectPauseReasons(flags: {
  onboardingPause?: boolean
  directiveOffer?: boolean
  confirmOpen?: boolean
  offlineOpen?: boolean
  simulatorOpen?: boolean
  updateBlocking?: boolean
}): PauseReason[] {
  const reasons: PauseReason[] = []
  if (flags.updateBlocking) reasons.push('update.critical')
  if (flags.confirmOpen) reasons.push('confirm.blocking')
  if (flags.onboardingPause) reasons.push('onboarding.action')
  if (flags.directiveOffer && !flags.onboardingPause) reasons.push('directive.choice')
  if (flags.offlineOpen) reasons.push('offline.report')
  if (flags.simulatorOpen) reasons.push('dev.simulator')
  return PAUSE_ORDER.filter((reason) => reasons.includes(reason))
}

export function isSimPaused(reasons: readonly PauseReason[]): boolean {
  return reasons.length > 0
}
