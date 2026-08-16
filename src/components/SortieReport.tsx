import type { SortieSummary } from '../game/types'
import { formatCompact } from '../game/format'

interface SortieReportProps {
  summary: SortieSummary
  onClose: () => void
}

export function SortieReport({ summary, onClose }: SortieReportProps) {
  const defeat = summary.outcome === 'defeat'
  return (
    <div className="modal-backdrop sortie-report-backdrop" role="dialog" aria-labelledby="sortie-report-title">
      <div className="modal-sheet sortie-report-sheet">
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">{defeat ? 'Hull lost' : 'Run complete'}</p>
            <h3 id="sortie-report-title">
              {defeat ? 'Defeat' : 'Complete'} · S{summary.sector} W{summary.wave}
            </h3>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        {summary.note ? <p className="muted">{summary.note}</p> : null}
        <div className="stat-row dock-stats">
          <div>
            <span className="muted">Sectors</span>
            <strong>{summary.sectorsCleared}</strong>
          </div>
          <div>
            <span className="muted">Salvage</span>
            <strong>+{formatCompact(summary.salvageGained)}</strong>
          </div>
          <div>
            <span className="muted">Spent</span>
            <strong>{formatCompact(summary.salvageSpent)}</strong>
          </div>
        </div>
        <div className="stat-row dock-stats">
          <div>
            <span className="muted">Milestones</span>
            <strong>{summary.milestones}</strong>
          </div>
          <div>
            <span className="muted">Research</span>
            <strong>+{formatCompact(summary.researchXp)}</strong>
          </div>
          <div>
            <span className="muted">Network</span>
            <strong>+{summary.networkLevels}</strong>
          </div>
        </div>
        <p className="assign-row">
          <button type="button" className="primary" onClick={onClose}>
            Back to Dock
          </button>
        </p>
      </div>
    </div>
  )
}
