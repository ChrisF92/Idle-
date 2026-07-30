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
  onToggleCampaign: (on: boolean) => void
  onResumeCampaign: () => void
}

export function CombatTab({
  state,
  onEngage,
  onToggleCampaign,
  onResumeCampaign,
}: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const frame = getFrame(state.shipyard.frameId)
  const challenge = state.prestige.activeChallengeId
    ? getChallenge(state.prestige.activeChallengeId)
    : null
  const upcoming = enemyForSector(combat.sector)
  const fight = combat.inFight ? computeFightDamage(state) : null
  const hint = matchupHintForSector(combat.sector, state.shipyard.modules)
  const status = combatStatusLabel(combat)

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Combat</h2>
        <p>
          Campaign keeps fighting for you. Set your loadout, then leave it running — no mid-fight
          micromanagement.
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
          <strong>{status}</strong>
        </div>
      </div>

      {challenge ? (
        <p className="notice-warn">
          Challenge: {challenge.name} — cleared {Math.max(0, combat.sector - 1)}/
          {challenge.goalSector}
        </p>
      ) : null}

      {combat.walled ? (
        <div className="notice-box">
          <p>Walled at sector {combat.sector}. Upgrade loadout, then resume campaign.</p>
          <button type="button" className="primary" onClick={onResumeCampaign}>
            Resume campaign
          </button>
        </div>
      ) : null}

      <div className="stat-row">
        <label className="muted" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={combat.campaign}
            disabled={combat.walled}
            onChange={(e) => onToggleCampaign(e.target.checked)}
          />
          Campaign (continuous push)
        </label>
        {combat.repairTimer > 0 ? (
          <span className="muted">Repair {combat.repairTimer}s</span>
        ) : null}
      </div>

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
              ? `${combat.enemyFamily}${combat.isBoss ? ` · boss P${combat.bossPhase + 1}` : ''}`
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

      <button
        type="button"
        className="primary"
        disabled={combat.inFight || combat.repairTimer > 0 || combat.campaign}
        onClick={onEngage}
      >
        {combat.inFight
          ? 'Engaged…'
          : combat.campaign
            ? 'Campaign running…'
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

function combatStatusLabel(combat: GameState['combat']): string {
  if (combat.walled) return 'Walled'
  if (combat.repairTimer > 0) return `Repair ${combat.repairTimer}s`
  if (combat.inFight) return combat.isBoss ? `Boss P${combat.bossPhase + 1}` : 'In fight'
  if (combat.campaign) return 'Campaign'
  return 'Idle'
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
