import type { GameState, SortieSummary } from '../game/types'
import { formatCompact } from '../game/format'
import { isFirstDefeatReport, sortieNextHints } from '../game/playerGuidance'
import { buildSortieDiagnostic } from '../game/sortieTelemetry'

interface SortieReportProps {
  summary: SortieSummary
  state: GameState
  onClose: () => void
  onUpgradeCores?: () => void
}

const PRESSURE_LABEL: Record<string, string> = {
  SURVIVABILITY: 'SURVIVABILITY',
  DAMAGE: 'DAMAGE',
  MIXED: 'MIXED',
  HEALTHY: 'HEALTHY PUSH',
}

export function SortieReport({ summary, state, onClose }: SortieReportProps) {
  const defeat = summary.outcome === 'defeat'
  const firstDefeat = defeat && isFirstDefeatReport(state)
  const hints = firstDefeat ? [] : sortieNextHints(state)
  const diagnostic = firstDefeat ? null : buildSortieDiagnostic(summary, state)

  return (
    <div className="modal-backdrop sortie-report-backdrop" role="dialog" aria-labelledby="sortie-report-title">
      <div className="modal-sheet sortie-report-sheet">
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">{defeat ? 'SORTIE COMPLETE' : 'EXTRACTED'}</p>
            <h3 id="sortie-report-title">
              {firstDefeat
                ? `Wave ${summary.wave}${summary.newBest ? ' · New Best' : ''}`
                : diagnostic
                  ? diagnostic.title
                  : `${defeat ? 'Defeat' : 'Extract'} · Wave ${summary.wave}`}
            </h3>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        {firstDefeat ? (
          <>
            <p>
              You recovered <strong>{formatCompact(summary.scrapEarned)} Scrap</strong>.
            </p>
            <p className="muted">
              Salvage from that Sortie is gone. Scrap survives. Spend it in Workshop so the next
              Sortie starts stronger.
            </p>
          </>
        ) : (
          <>
            {summary.note ? <p className="muted">{summary.note}</p> : null}
            {diagnostic ? (
              <div className="sortie-diagnosis">
                {diagnostic.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {diagnostic.threat ? (
                  <p>
                    Primary pressure: <strong>{diagnostic.threat}</strong>
                  </p>
                ) : null}
                <p>
                  Pressure: <strong>{PRESSURE_LABEL[diagnostic.pressure] ?? diagnostic.pressure}</strong>
                </p>
                {diagnostic.improvements.length > 0 ? (
                  <div className="sortie-next">
                    <p className="combat-hud-kicker">Possible improvements</p>
                    <ul>
                      {diagnostic.improvements.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
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
          <button type="button" className="primary" onClick={onClose}>
            Continue
          </button>
        </p>
      </div>
    </div>
  )
}
