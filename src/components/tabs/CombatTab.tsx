import type { CombatUnit, GameState, UnitShape } from '../../game/types'
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
  const upcoming = enemyForSector(combat.sector)
  const fight = combat.inFight ? computeFightDamage(state) : null
  const hint = matchupHintForSector(combat.sector, state.shipyard.modules)
  const status = combatStatusLabel(combat)
  const enemyHullMax = combat.inFight
    ? Math.max(1, combat.enemyHullMax)
    : Math.max(1, totalEnemyHull(upcoming))
  const enemyHull = combat.inFight ? combat.enemyHull : enemyHullMax
  const repairRate = repairRatePerSecond(state)

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
        playerUnits={
          combat.inFight
            ? combat.playerUnits
            : [
                {
                  id: 'preview-flag',
                  side: 'player',
                  name: frame?.name ?? 'Flagship',
                  shape: 'triangle',
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
        }
        enemyUnits={combat.inFight ? combat.enemyUnits : upcoming.units}
        fx={combat.fx}
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

function Battlefield({
  playerUnits,
  enemyUnits,
  fx,
}: {
  playerUnits: CombatUnit[]
  enemyUnits: CombatUnit[]
  fx: GameState['combat']['fx']
}) {
  const width = 640
  const height = 200
  const livingPlayer = playerUnits.filter((u) => u.hull > 0)
  const livingEnemy = enemyUnits.filter((u) => u.hull > 0)

  const place = (units: CombatUnit[], side: 'player' | 'enemy') => {
    const xBase = side === 'player' ? 70 : width - 70
    return units.map((u, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x =
        side === 'player' ? xBase + col * 36 : xBase - col * 36
      const y = 40 + row * 42 + (u.isFlagship || u.isBoss ? 8 : 0)
      return { unit: u, x, y, r: u.isBoss ? 22 : u.isFlagship ? 18 : 12 }
    })
  }

  const pPos = place(livingPlayer, 'player')
  const ePos = place(livingEnemy, 'enemy')
  const byId = new Map([...pPos, ...ePos].map((p) => [p.unit.id, p]))

  return (
    <svg
      className="battlefield"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Fleet battlefield"
    >
      <defs>
        <linearGradient id="bf-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#121820" />
          <stop offset="100%" stopColor="#1a2430" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill="url(#bf-bg)" />
      <line
        x1={width / 2}
        y1={12}
        x2={width / 2}
        y2={height - 12}
        stroke="rgba(255,255,255,0.08)"
        strokeDasharray="4 6"
      />

      {fx.map((shot) => {
        const from = byId.get(shot.fromId)
        const to = byId.get(shot.toId)
        if (!from || !to) return null
        const color =
          shot.tag === 'energy'
            ? '#7ec8ff'
            : shot.tag === 'pierce'
              ? '#ffb347'
              : shot.tag === 'splash'
                ? '#d4a574'
                : '#c8e0d0'
        return (
          <line
            key={shot.id}
            className="bf-shot"
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={color}
            strokeWidth={2}
          />
        )
      })}

      {[...pPos, ...ePos].map(({ unit, x, y, r }) => (
        <g key={unit.id} transform={`translate(${x}, ${y})`}>
          <UnitShapeGraphic
            shape={unit.shape}
            r={r}
            side={unit.side}
            boss={unit.isBoss}
            dead={unit.hull <= 0}
          />
          <rect
            x={-r}
            y={r + 3}
            width={r * 2}
            height={3}
            fill="#0d1117"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={0.5}
          />
          <rect
            x={-r}
            y={r + 3}
            width={r * 2 * Math.max(0, unit.hull / Math.max(1, unit.hullMax))}
            height={3}
            fill={unit.side === 'player' ? '#e0b06a' : '#e07070'}
          />
        </g>
      ))}
    </svg>
  )
}

function UnitShapeGraphic({
  shape,
  r,
  side,
  boss,
  dead,
}: {
  shape: UnitShape
  r: number
  side: 'player' | 'enemy'
  boss: boolean
  dead: boolean
}) {
  const fill =
    side === 'player'
      ? boss
        ? '#f0c987'
        : '#d4a574'
      : boss
        ? '#e07070'
        : '#8aa0b8'
  const opacity = dead ? 0.25 : 0.95
  const stroke = side === 'player' ? '#ffe8c7' : '#c8d4e0'

  if (shape === 'triangle') {
    const points = `0,${-r} ${r},${r * 0.85} ${-r},${r * 0.85}`
    return <polygon points={points} fill={fill} stroke={stroke} strokeWidth={1.2} opacity={opacity} />
  }
  if (shape === 'square') {
    return (
      <rect
        x={-r * 0.85}
        y={-r * 0.85}
        width={r * 1.7}
        height={r * 1.7}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.2}
        opacity={opacity}
      />
    )
  }
  if (shape === 'diamond') {
    const points = `0,${-r} ${r},0 0,${r} ${-r},0`
    return <polygon points={points} fill={fill} stroke={stroke} strokeWidth={1.2} opacity={opacity} />
  }
  if (shape === 'hex') {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6
      return `${Math.cos(a) * r},${Math.sin(a) * r}`
    }).join(' ')
    return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={1.2} opacity={opacity} />
  }
  return <circle cx={0} cy={0} r={r} fill={fill} stroke={stroke} strokeWidth={1.2} opacity={opacity} />
}
