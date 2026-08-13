import type { GameState } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { wavesForSector } from '../../game/sectors'
import { formatCompact } from '../../game/format'

interface DockTabProps {
  state: GameState
  onLaunch: () => void
  onOpenSortie: () => void
}

export function DockTab({ state, onLaunch, onOpenSortie }: DockTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const live = !combat.docked
  const waves = wavesForSector(combat.sector)
  const summary = combat.lastSortie

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Dock</h2>
        <p>Hiveworks foundry — launch the remaining ship. Combat keeps running if you come back here mid-sortie.</p>
      </header>

      {live ? (
        <div className="sortie-live-card">
          <p>
            <strong>Sortie live</strong> — Sector {combat.sector}, wave {combat.wave}/{waves}. Kill-fed systems keep ticking.
          </p>
          <p className="assign-row">
            <button type="button" className="primary" onClick={onOpenSortie}>
              Open battlefield
            </button>
          </p>
        </div>
      ) : (
        <p className="assign-row">
          <button type="button" className="primary" data-guide="launch" onClick={onLaunch}>
            Launch sortie
          </button>
        </p>
      )}

      {summary.outcome ? (
        <p className="notice">
          Last: {summary.outcome === 'defeat' ? 'Defeat' : 'Extract'} — sector {summary.sector}{' '}
          W{summary.wave}. {summary.note}
        </p>
      ) : (
        <p className="muted">No sortie logged yet.</p>
      )}

      <div className="stat-row">
        <div>
          <span className="muted">Hull</span>
          <strong>
            {Math.ceil(combat.playerHull)}/{Math.ceil(stats.hullMax)}
          </strong>
        </div>
        <div>
          <span className="muted">Shield</span>
          <strong>
            {Math.ceil(combat.playerShield)}/{Math.ceil(stats.shieldMax)}
          </strong>
        </div>
        <div>
          <span className="muted">DPS</span>
          <strong>{formatCompact(stats.damage)}</strong>
        </div>
        <div>
          <span className="muted">Career sector</span>
          <strong>{Math.max(combat.highestSector, combat.sector)}</strong>
        </div>
      </div>
    </section>
  )
}
