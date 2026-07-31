import { useMemo } from 'react'
import type { GameState } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { getChallenge, getFrame } from '../../game/catalog'
import {
  canReengage,
  computeFightDamage,
  enemyForSector,
  matchupHintForSector,
  repairRatePerSecond,
  totalEnemyHull,
} from '../../game/combat'
import { Battlefield, type BattlefieldMode } from '../Battlefield'

interface CombatTabProps {
  state: GameState
  onEngage: () => void
  onToggleCampaign: (on: boolean) => void
}

export function CombatTab({ state, onEngage, onToggleCampaign }: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const frame = getFrame(state.shipyard.frameId)
  const challenge = state.prestige.activeChallengeId
    ? getChallenge(state.prestige.activeChallengeId)
    : null
  const upcoming = useMemo(() => enemyForSector(combat.sector), [combat.sector])
  const fight = combat.inFight ? computeFightDamage(state) : null
  const hint = matchupHintForSector(combat.sector, state.shipyard.modules)
  const status = combatStatusLabel(combat)
  const enemyHullMax = combat.inFight
    ? Math.max(1, combat.enemyHullMax)
    : Math.max(1, totalEnemyHull(upcoming))
  const enemyHull = combat.inFight ? combat.enemyHull : enemyHullMax
  const repairRate = repairRatePerSecond(state)
  const battlefieldMode: BattlefieldMode = combat.inFight
    ? 'fighting'
    : combat.playerHull < combat.playerHullMax * 0.35
      ? 'repairing'
      : !combat.campaign
        ? 'holding'
        : 'ready'

  const previewPlayer = [
    {
      id: 'preview-flag',
      side: 'player' as const,
      name: frame?.name ?? 'Flagship',
      shape: 'triangle' as const,
      family: 'player',
      hull: combat.playerHull,
      hullMax: combat.playerHullMax,
      shield: combat.playerShield,
      shieldMax: combat.playerShieldMax,
      armor: stats.armor,
      evasion: stats.evasion,
      damageTakenMult: stats.damageTakenMult,
      weapons: [],
      isBoss: false,
      isFlagship: true,
      dots: [],
    },
    ...Array.from({ length: stats.escortCount }, (_, i) => ({
      id: `preview-escort-${i}`,
      side: 'player' as const,
      name: `Drone ${i + 1}`,
      shape: 'circle' as const,
      family: 'escort',
      hull: 1,
      hullMax: 1,
      shield: 0,
      shieldMax: 0,
      armor: 0,
      evasion: 0,
      damageTakenMult: 1,
      weapons: [],
      isBoss: false,
      isFlagship: false,
      dots: [],
    })),
  ]

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Combat</h2>
        <p>
          Advance pushes sector to sector. Hold to repair (and later farm). Loadout counters matter —
          no mid-fight toggles.
        </p>
      </header>

      <div className="stat-row">
        <div>
          <span className="muted">Sector</span>
          <strong>{combat.sector}</strong>
        </div>
        <div>
          <span className="muted">Fleet DPS</span>
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

      <div className="stat-row">
        <label className="muted" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={combat.campaign}
            onChange={(e) => onToggleCampaign(e.target.checked)}
          />
          Advance (uncheck to Hold)
        </label>
        {!combat.inFight && combat.playerHull < combat.playerHullMax ? (
          <span className="muted">Repair +{repairRate.toFixed(1)}/s</span>
        ) : null}
      </div>

      <p className="muted">{hint}</p>

      <Battlefield
        playerUnits={combat.inFight ? combat.playerUnits : previewPlayer}
        enemyUnits={combat.inFight ? combat.enemyUnits : upcoming.units}
        fx={combat.fx}
        mode={battlefieldMode}
      />

      <div className="combat-grid">
        <div className="combat-side">
          <h3>{frame?.name ?? 'Frame'}</h3>
          <p className="muted">
            {state.shipyard.modules.join(', ') || 'No modules'}
            {stats.escortCount > 0 ? ` · ${stats.escortCount} drones` : ''}
          </p>
          <Meter label="Hull" value={combat.playerHull} max={combat.playerHullMax} />
          {combat.playerShieldMax > 0 ? (
            <Meter label="Shield" value={combat.playerShield} max={combat.playerShieldMax} />
          ) : null}
          <p className="muted">
            Armor {stats.armor} · Eva {(stats.evasion * 100).toFixed(0)}%
          </p>
        </div>
        <div className="combat-side">
          <h3>{combat.inFight ? combat.enemyName : upcoming.name}</h3>
          <p className="muted">
            {combat.inFight
              ? `${combat.enemyFamily}${combat.isBoss ? ` · boss P${combat.bossPhase + 1}` : ''} · ${fight?.enemyAlive ?? 0} left`
              : `Next · ${upcoming.family}${upcoming.isBoss ? ' · boss' : ''} · ${upcoming.units.length} units`}
          </p>
          <Meter label="Hull" value={enemyHull} max={enemyHullMax} />
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
        disabled={
          combat.inFight ||
          combat.campaign ||
          (!canReengage(state) && combat.playerHull < combat.playerHullMax)
        }
        onClick={onEngage}
      >
        {combat.inFight
          ? 'Engaged…'
          : combat.campaign
            ? 'Advancing…'
            : !canReengage(state)
              ? 'Repairing…'
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
  if (combat.inFight) return combat.isBoss ? `Boss P${combat.bossPhase + 1}` : 'In fight'
  if (!combat.campaign) return 'Holding'
  if (combat.playerHull < combat.playerHullMax * 0.35) return 'Repairing'
  return 'Advancing'
}

function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))
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
