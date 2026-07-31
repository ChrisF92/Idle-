import { useEffect, useId, useMemo, useState } from 'react'
import type { GameState, UnitShape } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { getChallenge, getFrame } from '../../game/catalog'
import { WAVES_PER_SECTOR } from '../../game/progression'
import {
  enemyForSector,
  estimateHoldFarmRates,
  repairRatePerSecond,
  sectorRoster,
  totalEnemyHull,
  type EnemyFamily,
} from '../../game/combat'
import { Battlefield, type BattlefieldMode } from '../Battlefield'

interface CombatTabProps {
  state: GameState
  onSetCampaign: (on: boolean) => void
  onSetDocked: (docked: boolean) => void
  onWarp: (sector: number) => void
}

type Overlay = 'none' | 'sector' | 'warp' | 'launch-confirm'

export function CombatTab({ state, onSetCampaign, onSetDocked, onWarp }: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const frame = getFrame(state.shipyard.frameId)
  const challenge = state.prestige.activeChallengeId
    ? getChallenge(state.prestige.activeChallengeId)
    : null
  const encounter = useMemo(() => enemyForSector(combat.sector, combat.wave), [combat.sector, combat.wave])
  const roster = useMemo(() => sectorRoster(combat.sector), [combat.sector])
  const [overlay, setOverlay] = useState<Overlay>('none')

  const needsRepair =
    combat.docked &&
    (combat.playerHull < combat.playerHullMax - 0.5 ||
      combat.playerShield < combat.playerShieldMax - 0.5)
  const battlefieldMode: BattlefieldMode = combat.docked
    ? needsRepair
      ? 'repairing'
      : 'docked'
    : combat.inFight
      ? 'fighting'
      : combat.campaign
        ? 'ready'
        : 'holding'

  const previewPlayer = useMemo(
    () => [
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
        x: 0,
        y: 0,
        speed: 0,
        engageRange: 0,
        kite: false,
        phaseWarnLeft: 0,
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
        x: 12,
        y: i % 2 === 0 ? -24 : 24,
        speed: 0,
        engageRange: 0,
        kite: false,
        phaseWarnLeft: 0,
      })),
    ],
    [
      frame?.name,
      combat.playerHull,
      combat.playerHullMax,
      combat.playerShield,
      combat.playerShieldMax,
      stats.armor,
      stats.evasion,
      stats.damageTakenMult,
      stats.escortCount,
    ],
  )

  const warpTargets = useMemo(() => {
    const max = combat.highestSector
    if (max < 1) return [] as number[]
    return Array.from({ length: max }, (_, i) => i + 1)
  }, [combat.highestSector])

  const modeLabel = combat.docked ? 'DOCKED' : combat.campaign ? 'ADVANCE' : 'HOLD'
  const bossCharging =
    combat.inFight &&
    combat.isBoss &&
    combat.enemyUnits.some(
      (u) =>
        u.isBoss &&
        (u.phaseWarnLeft > 0 || u.weapons.some((w) => w.telegraphLeft > 0)),
    )
  const statusLabel = combat.docked
    ? needsRepair
      ? 'REPAIRING'
      : 'REFIT'
    : combat.inFight
      ? combat.isBoss
        ? bossCharging
          ? `BOSS P${combat.bossPhase + 1} · CHARGING`
          : `BOSS P${combat.bossPhase + 1}`
        : 'ENGAGED'
      : 'STANDBY'
  const repairRate = combat.docked ? repairRatePerSecond(state) : 0
  const holdRates = useMemo(
    () =>
      !combat.docked && !combat.campaign && state.ai.purchased.includes('hold-accountant')
        ? estimateHoldFarmRates(state)
        : null,
    [combat.docked, combat.campaign, combat.sector, state],
  )

  return (
    <section className="panel combat-hud">
      <header className="combat-hud-bar">
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">Sector</span>
          <strong className="combat-hud-value">{combat.sector}</strong>
        </div>
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">Wave</span>
          <strong className="combat-hud-value">
            {combat.wave}/{WAVES_PER_SECTOR}
          </strong>
        </div>
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">Mode</span>
          <strong className="combat-hud-value">{modeLabel}</strong>
        </div>
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">Status</span>
          <strong className="combat-hud-value">{statusLabel}</strong>
        </div>
        <div className="combat-hud-readout combat-hud-readout-wide">
          <span className="combat-hud-kicker">Contact</span>
          <strong className="combat-hud-value combat-hud-contact">
            {combat.docked
              ? 'Hangar bay'
              : combat.inFight
                ? combat.enemyName
                : encounter.name}
          </strong>
        </div>
        <button
          type="button"
          className="combat-intel-btn"
          onClick={() => setOverlay('sector')}
        >
          Sector info
        </button>
      </header>

      {challenge ? (
        <p className="notice-warn combat-challenge">
          Challenge: {challenge.name} — cleared {combat.highestSector}/{challenge.goalSector}
        </p>
      ) : null}

      {holdRates ? (
        <p className="muted combat-dock-hint">
          Hold farm ~{holdRates.scrapPerSec.toFixed(2)} scrap/s ·{' '}
          {holdRates.dataPerSec.toFixed(2)} data/s · {holdRates.salvagePerSec.toFixed(2)} salvage/s
          {' '}(~{holdRates.clearSeconds.toFixed(0)}s / {WAVES_PER_SECTOR}-wave clear ·{' '}
          {holdRates.scrapPerClear.toFixed(0)} scrap total).
        </p>
      ) : null}

      {state.meta.act1Cleared ? (
        <p className="notice">Act 1 complete — infinite push / prestige / challenges are the long game.</p>
      ) : null}

      <Battlefield
        playerUnits={combat.inFight ? combat.playerUnits : previewPlayer}
        enemyUnits={combat.docked ? [] : combat.inFight ? combat.enemyUnits : encounter.units}
        projectiles={combat.inFight ? combat.projectiles : []}
        fx={combat.fx}
        mode={battlefieldMode}
      />

      {combat.docked ? (
        <p className="muted combat-dock-hint">
          Docked — Shipyard open
          {needsRepair ? ` · repairing +${repairRate.toFixed(1)} hull/s` : ''}
          {!state.shipyard.frameLocked
            ? ' · choose your frame before Launch (locks until prestige/challenge)'
            : ''}
          . Launch to resume {combat.campaign ? 'Advance' : 'Hold'}.
        </p>
      ) : (
        <p className="muted combat-dock-hint">
          Advance pushes sectors · Hold farms this sector · Dock pauses combat to refit modules
          and repair.
        </p>
      )}

      <div className="combat-controls" role="group" aria-label="Fleet controls">
        <button
          type="button"
          className={combat.campaign && !combat.docked ? 'primary mode-active' : ''}
          aria-pressed={combat.campaign}
          onClick={() => onSetCampaign(true)}
        >
          Advance
        </button>
        <button
          type="button"
          className={!combat.campaign && !combat.docked ? 'primary mode-active' : ''}
          aria-pressed={!combat.campaign}
          onClick={() => onSetCampaign(false)}
        >
          Hold
        </button>
        <button
          type="button"
          data-guide="launch-btn"
          className={combat.docked ? 'primary mode-active' : ''}
          aria-pressed={combat.docked}
          onClick={() => {
            if (combat.docked && !state.shipyard.frameLocked) {
              setOverlay('launch-confirm')
              return
            }
            onSetDocked(!combat.docked)
          }}
        >
          {combat.docked ? 'Launch' : 'Dock'}
        </button>
        <button
          type="button"
          disabled={
            !state.ai.purchased.includes('warp-navigator') || warpTargets.length === 0
          }
          onClick={() => setOverlay('warp')}
          title={
            !state.ai.purchased.includes('warp-navigator')
              ? 'Buy Warp Navigator (AI) to unlock Warp'
              : warpTargets.length === 0
                ? 'Clear a sector this prestige to unlock Warp'
                : 'Warp to a cleared sector'
          }
        >
          Warp
        </button>
      </div>

      {overlay === 'launch-confirm' ? (
        <LaunchConfirmModal
          frameName={frame?.name ?? 'current frame'}
          onConfirm={() => {
            setOverlay('none')
            onSetDocked(false)
          }}
          onClose={() => setOverlay('none')}
        />
      ) : null}

      {overlay === 'sector' ? (
        <SectorInfoModal
          sector={combat.sector}
          encounterName={encounter.name}
          family={encounter.family}
          isBoss={encounter.isBoss}
          blurb={encounter.blurb}
          roster={roster}
          rewards={{
            scrap: encounter.scrapReward,
            data: encounter.dataReward,
            ai: encounter.aiReward,
            salvage: encounter.salvageReward,
            essence: encounter.essenceReward,
          }}
          hullMax={totalEnemyHull(encounter)}
          onClose={() => setOverlay('none')}
        />
      ) : null}

      {overlay === 'warp' ? (
        <WarpModal
          current={combat.sector}
          targets={warpTargets}
          onWarp={(sector) => {
            onWarp(sector)
            setOverlay('none')
          }}
          onClose={() => setOverlay('none')}
        />
      ) : null}
    </section>
  )
}

function SectorInfoModal({
  sector,
  encounterName,
  family,
  isBoss,
  blurb,
  roster,
  rewards,
  hullMax,
  onClose,
}: {
  sector: number
  encounterName: string
  family: EnemyFamily
  isBoss: boolean
  blurb: string
  roster: ReturnType<typeof sectorRoster>
  rewards: { scrap: number; data: number; ai: number; salvage: number; essence: number }
  hullMax: number
  onClose: () => void
}) {
  const titleId = useId()
  useEscapeClose(onClose)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">Sector {sector}</p>
            <h3 id={titleId}>{encounterName}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        <p className="muted">
          {isBoss ? 'Boss sector' : 'Standard sector'} · {family} · pack hull{' '}
          {Math.ceil(hullMax)}
        </p>
        <p>{blurb}</p>

        <ul className="sector-roster">
          {roster.map((entry) => (
            <li key={entry.key} className="sector-roster-item">
              <EnemyGlyph
                id={entry.key}
                family={entry.family}
                shape={entry.shape}
                boss={entry.isBoss}
              />
              <div>
                <strong>
                  {entry.name}
                  {entry.count > 1 ? ` ×${entry.count}` : ''}
                </strong>
                <p className="muted">{entry.summary}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="muted">
          Clear reward: {rewards.scrap} scrap · {rewards.data} data · {rewards.ai} AI ·{' '}
          {rewards.salvage} salvage
          {rewards.essence > 0 ? ` · ${rewards.essence} essence` : ''}
        </p>
      </div>
    </div>
  )
}

function WarpModal({
  current,
  targets,
  onWarp,
  onClose,
}: {
  current: number
  targets: number[]
  onWarp: (sector: number) => void
  onClose: () => void
}) {
  const titleId = useId()
  useEscapeClose(onClose)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">Navigation</p>
            <h3 id={titleId}>Warp</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <p className="muted">
          Jump to any sector cleared this prestige. Aborts the current fight.
        </p>
        <div className="warp-grid">
          {targets.map((sector) => (
            <button
              key={sector}
              type="button"
              className={sector === current ? 'primary' : ''}
              onClick={() => onWarp(sector)}
            >
              {sector}
              {sector === current ? ' · here' : ''}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function LaunchConfirmModal({
  frameName,
  onConfirm,
  onClose,
}: {
  frameName: string
  onConfirm: () => void
  onClose: () => void
}) {
  const titleId = useId()
  useEscapeClose(onClose)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">Hangar</p>
            <h3 id={titleId}>Confirm Launch</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <p>
          Launching locks <strong>{frameName}</strong> until the next prestige or
          challenge. You can still Dock later to change modules.
        </p>
        <p className="muted">Launch anyway?</p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Stay Docked
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            Launch
          </button>
        </div>
      </div>
    </div>
  )
}

function EnemyGlyph({
  id,
  family,
  shape,
  boss,
}: {
  id: string
  family: EnemyFamily
  shape: UnitShape
  boss: boolean
}) {
  const fill = familyColor(family)
  const gradId = `glyph-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  return (
    <svg
      className="enemy-glyph"
      viewBox="0 0 64 64"
      width="56"
      height="56"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={fill} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0e141c" stopOpacity="0.9" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" fill="#0e141c" />
      <circle cx="32" cy="32" r="28" fill={`url(#${gradId})`} opacity="0.35" />
      <g transform="translate(32 32)" fill={fill} stroke="#e7edf5" strokeWidth="1.5">
        {shapePath(shape, boss ? 18 : 14)}
      </g>
    </svg>
  )
}

function shapePath(shape: UnitShape, r: number) {
  switch (shape) {
    case 'triangle':
      return (
        <path d={`M ${r} 0 L ${-r * 0.85} ${-r} L ${-r * 0.85} ${r} Z`} />
      )
    case 'square':
      return <rect x={-r * 0.85} y={-r * 0.85} width={r * 1.7} height={r * 1.7} />
    case 'diamond':
      return <path d={`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`} />
    case 'hex': {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6
        return `${Math.cos(a) * r},${Math.sin(a) * r}`
      }).join(' ')
      return <polygon points={pts} />
    }
    default:
      return <circle r={r} />
  }
}

function familyColor(family: EnemyFamily): string {
  switch (family) {
    case 'swarm':
      return '#9eb4cc'
    case 'armored':
      return '#c4a574'
    case 'ethereal':
      return '#7ec8ff'
    case 'divine':
      return '#e0c07a'
    case 'titan':
      return '#ff6b6b'
  }
}

function useEscapeClose(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}
