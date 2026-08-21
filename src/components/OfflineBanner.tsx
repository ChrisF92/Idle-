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
    <div
      className="modal-backdrop offline-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-report-title"
    >
      <div className="modal-sheet offline-modal-sheet">
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">Offline</p>
            <h3 id="offline-report-title">Welcome back</h3>
          </div>
          <button type="button" onClick={onDismiss}>
            Close
          </button>
        </header>
        <div className="offline-modal-body">
          <p className="muted">
            Away {formatDuration(report.elapsedMs)}
            {report.capped ? ` · applied ${formatDuration(report.appliedMs)} (cap)` : ''}
            {' · '}
            {report.modeLabel} · Wave {report.wave}
          </p>
          {gainLines.length > 0 ? (
            <ul className="offline-gains">
              {gainLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No notable resource gains.</p>
          )}
        </div>
        <div className="offline-modal-actions">
          <button type="button" className="primary" onClick={onDismiss}>
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
