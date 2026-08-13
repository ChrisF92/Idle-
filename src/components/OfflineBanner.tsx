import type { OfflineReport } from '../game/offline'
import { RESOURCE_LABELS } from '../game/state'
import type { Resources } from '../game/types'
import { formatCompact } from '../game/format'

interface OfflineBannerProps {
  report: OfflineReport
  onDismiss: () => void
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${totalSec}s`
}

export function OfflineBanner({ report, onDismiss }: OfflineBannerProps) {
  const gainLines = Object.entries(report.gains)
    .filter(([, v]) => (v ?? 0) > 0.05)
    .map(
      ([k, v]) =>
        `+${formatCompact(v ?? 0)} ${RESOURCE_LABELS[k as keyof Resources]}`,
    )

  return (
    <aside className="offline-banner" role="status">
      <div>
        <strong>Welcome back</strong>
        <p className="muted">
          Away {formatDuration(report.elapsedMs)}
          {report.capped ? ` · applied ${formatDuration(report.appliedMs)} (cap)` : ''}
          {' · '}
          {report.modeLabel} · sector {report.sectorsAfter}
          {' · no fight sim'}
        </p>
        {gainLines.length > 0 ? (
          <p className="offline-gains">{gainLines.join(' · ')}</p>
        ) : (
          <p className="muted">No notable resource gains.</p>
        )}
      </div>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </aside>
  )
}
