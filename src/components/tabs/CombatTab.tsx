import type { GameState } from '../../game/types'

interface CombatTabProps {
  state: GameState
  onEngage: () => void
}

export function CombatTab({ state, onEngage }: CombatTabProps) {
  const { combat } = state

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Combat</h2>
        <p>Push sectors against alien and godlike entities. Auto-resolve ticks.</p>
      </header>

      <div className="stat-row">
        <div>
          <span className="muted">Sector</span>
          <strong>{combat.sector}</strong>
        </div>
        <div>
          <span className="muted">Status</span>
          <strong>{combat.inFight ? 'In fight' : 'Idle'}</strong>
        </div>
      </div>

      <div className="combat-grid">
        <div className="combat-side">
          <h3>Your frame</h3>
          <p className="muted">{state.shipyard.frameId}</p>
          <Meter label="Hull" value={combat.playerHull} max={combat.playerHullMax} />
        </div>
        <div className="combat-side">
          <h3>{combat.inFight ? combat.enemyName : 'No target'}</h3>
          <p className="muted">Entity</p>
          <Meter
            label="Hull"
            value={combat.enemyHull}
            max={Math.max(1, combat.enemyHullMax)}
          />
        </div>
      </div>

      <button type="button" className="primary" disabled={combat.inFight} onClick={onEngage}>
        {combat.inFight ? 'Engaged…' : `Engage sector ${combat.sector}`}
      </button>

      <div className="log" aria-label="Combat log">
        {combat.log.map((line, i) => (
          <p key={`${i}-${line.slice(0, 12)}`}>{line}</p>
        ))}
      </div>
    </section>
  )
}

function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="meter">
      <div className="meter-label">
        <span>{label}</span>
        <span>
          {Math.ceil(value)} / {Math.ceil(max)}
        </span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
