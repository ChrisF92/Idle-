import type { GameState, SortieSummary } from '../game/types'
import { formatCompact } from '../game/format'
import { isFirstDefeatReport, sortieNextHints } from '../game/playerGuidance'

interface SortieReportProps {
  summary: SortieSummary
  state: GameState
  onClose: () => void
  onUpgradeCores?: () => void
}

export function SortieReport({ summary, state, onClose, onUpgradeCores }: SortieReportProps) {
  const defeat = summary.outcome === 'defeat'
  const firstDefeat = defeat && isFirstDefeatReport(state)
  const hints = firstDefeat ? [] : sortieNextHints(state)

  return (
    <div className="modal-backdrop sortie-report-backdrop" role="dialog" aria-labelledby="sortie-report-title">
      <div className="modal-sheet sortie-report-sheet">
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">{defeat ? 'Hull lost' : 'Run complete'}</p>
            <h3 id="sortie-report-title">
              {firstDefeat
                ? `You reached Sector ${summary.sector}`
                : `${defeat ? 'Defeat' : 'Complete'} · S${summary.sector} W${summary.wave}`}
            </h3>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        {firstDefeat ? (
          <>
            <p>
              You recovered <strong>{formatCompact(summary.salvageGained)} Salvage</strong>.
            </p>
            <p className="muted">
              Hull loss does not remove your Core upgrades. Spend your Salvage and launch again.
            </p>
          </>
        ) : summary.note ? (
          <p className="muted">{summary.note}</p>
        ) : null}
        {hints.length > 0 ? (
          <div className="sortie-next">
            <p className="combat-hud-kicker">Possible next steps</p>
            <ul>
              {hints.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
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
          {firstDefeat && onUpgradeCores ? (
            <button type="button" className="primary" onClick={onUpgradeCores}>
              Upgrade Cores
            </button>
          ) : (
            <button type="button" className="primary" onClick={onClose}>
              Back to Dock
            </button>
          )}
        </p>
      </div>
    </div>
  )
}
