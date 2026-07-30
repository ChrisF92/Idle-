import type { GameState } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { getChallenge, getFrame } from '../../game/catalog'
import {
  computeFightDamage,
  enemyForSector,
  matchupHintForSector,
} from '../../game/combat'

interface CombatTabProps {
  state: GameState
  onEngage: () => void
}

export function CombatTab({ state, onEngage }: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const frame = getFrame(state.shipyard.frameId)
  const challenge = state.prestige.activeChallengeId
    ? getChallenge(state.prestige.activeChallengeId)
    : null
  const upcoming = enemyForSector(combat.sector)
  const fight = combat.inFight ? computeFightDamage(state) : null
  const hint = matchupHintForSector(combat.sector, state.shipyard.modules)

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Combat</h2>
        <p>
          Sector push with entity families. Module roles counter Swarm / Armored /
          Ethereal / Divine. Bosses every 5 sectors.
        </p>
      </header>

      <div className="stat-row">
        <div>
          <span className="muted">Sector</span>
          <strong>{combat.sector}</strong>
        </div>
        <div>
          <span className="muted">Damage</span>
          <strong>{(fight?.playerDps ?? stats.damage).toFixed(1)}</strong>
        </div>
        <div>
          <span className="muted">Status</span>
          <strong>{combat.inFight ? (combat.isBoss ? 'Boss fight' : 'In fight') : 'Idle'}</strong>
        </div>
      </div>

      {challenge ? (
        <p className="notice-warn">
          Challenge: {challenge.name} — cleared {Math.max(0, combat.sector - 1)}/
          {challenge.goalSector}
        </p>
      ) : null}

      <p className="muted">{hint}</p>

      <div className="combat-grid">
        <div className="combat-side">
          <h3>{frame?.name ?? 'Frame'}</h3>
          <p className="muted">{state.shipyard.modules.join(', ') || 'No modules'}</p>
          <Meter label="Hull" value={combat.playerHull} max={combat.playerHullMax} />
          {fight ? (
            <p className="muted">Incoming {fight.enemyDps.toFixed(1)} / tick</p>
          ) : null}
        </div>
        <div className="combat-side">
          <h3>{combat.inFight ? combat.enemyName : upcoming.name}</h3>
          <p className="muted">
            {combat.inFight
              ? `${combat.enemyFamily}${combat.isBoss ? ' · boss' : ''}`
              : `Next · ${upcoming.family}${upcoming.isBoss ? ' · boss' : ''}`}
          </p>
          <Meter
            label="Hull"
            value={combat.inFight ? combat.enemyHull : upcoming.hull}
            max={Math.max(1, combat.inFight ? combat.enemyHullMax : upcoming.hull)}
          />
          {!combat.inFight ? (
            <p className="muted">{upcoming.blurb}</p>
          ) : fight && fight.matchupNotes.length > 0 ? (
            <p className="muted">{fight.matchupNotes.join(' · ')}</p>
          ) : null}
        </div>
      </div>

      <button type="button" className="primary" disabled={combat.inFight} onClick={onEngage}>
        {combat.inFight
          ? 'Engaged…'
          : upcoming.isBoss
            ? `Engage boss sector ${combat.sector}`
            : `Engage sector ${combat.sector}`}
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
