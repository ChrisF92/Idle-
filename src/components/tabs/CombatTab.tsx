import { useEffect, useId, useMemo, useState } from 'react'
import type { CombatPushMode, GameState } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { COMBAT_PUSH_MODES, normalizePushMode, normalizeRoute, pushModeLabel } from '../../game/sectors'
import { wavesForRun, getEchoRun } from '../../game/echo'
import { activeProtocol } from '../../game/protocols'
import { formatCompact } from '../../game/format'
import { activeGuideStep } from '../../game/progression'
import { Battlefield, type BattlefieldMode } from '../Battlefield'
import { CoreSheet } from '../CoreSheet'

interface CombatTabProps {
  state: GameState
  onLaunch: () => void
  onSetPushMode: (mode: CombatPushMode) => void
  onUpgrade: (moduleId: string) => void
  onPickMilestone: (moduleId: string, milestoneId: string, choiceId: string) => void
  paused?: boolean
}

function coresGuideActive(state: GameState): boolean {
  const step = activeGuideStep(state, 'combat')
  if (!step) return false
  const target = step.target
  return (
    target === 'cores-sheet' ||
    target.startsWith('core-') ||
    target.startsWith('upgrade-')
  )
}

export function CombatTab({
  state,
  onLaunch,
  onSetPushMode,
  onUpgrade,
  onPickMilestone,
  paused = false,
}: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const waves = wavesForRun(state)
  const dying = (combat.defeatLeft ?? 0) > 0
  const live = !combat.docked
  const protocol = activeProtocol(state)
  const echoRun = combat && state.echo?.activeId ? getEchoRun(state.echo.activeId) : undefined
  const pushMode = normalizePushMode(combat.pushMode, combat.campaign)
  const titleId = useId()
  const forceCores = coresGuideActive(state)
  const [coresOpen, setCoresOpen] = useState(false)
  const sheetOpen = coresOpen || forceCores

  useEffect(() => {
    if (forceCores) setCoresOpen(true)
  }, [forceCores])

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !forceCores) setCoresOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen, forceCores])

  const previewPlayer = useMemo(
    () => [
      {
        id: 'preview-flag',
        side: 'player' as const,
        name: 'Hiveworks hull',
        shape: 'triangle' as const,
        family: 'player',
        hull: combat.playerHull,
        hullMax: combat.playerHullMax || stats.hullMax,
        shield: combat.playerShield,
        shieldMax: combat.playerShieldMax || stats.shieldMax,
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
    ],
    [
      combat.playerHull,
      combat.playerHullMax,
      combat.playerShield,
      combat.playerShieldMax,
      stats.armor,
      stats.evasion,
      stats.damageTakenMult,
      stats.hullMax,
      stats.shieldMax,
    ],
  )

  const battlefieldMode: BattlefieldMode =
    combat.inFight || dying ? 'fighting' : 'ready'

  const playerUnits =
    combat.playerUnits.length > 0 ? combat.playerUnits : previewPlayer
  const enemyUnits = combat.docked && !dying ? [] : combat.enemyUnits

  const hullPct = Math.max(0, Math.min(1, combat.playerHull / Math.max(1, stats.hullMax)))
  const shieldPct = Math.max(0, Math.min(1, combat.playerShield / Math.max(1, stats.shieldMax)))

  return (
    <section className="sortie-screen">
      <div className="sortie-canvas" data-guide="sortie-canvas">
        <Battlefield
          playerUnits={playerUnits}
          enemyUnits={enemyUnits}
          projectiles={combat.docked && !dying ? [] : combat.projectiles}
          beams={combat.docked && !dying ? [] : combat.beams ?? []}
          fx={combat.fx}
          mode={battlefieldMode}
          paused={paused}
        />
        <header className="combat-hud-bar sortie-hud">
          <div className="combat-hud-readout">
            <span className="combat-hud-kicker">
              {echoRun
                ? echoRun.name
                : protocol
                  ? `P${protocol.goalSector}`
                  : `S${combat.sector}${normalizeRoute(combat.route) === 'B' ? 'B' : ''}`}
            </span>
            <strong className="combat-hud-value">
              W{combat.wave}/{waves}
            </strong>
          </div>
          <div className="combat-hud-readout" data-guide="sortie-hull">
            <span className="combat-hud-kicker">Hull</span>
            <strong className="combat-hud-value">
              {formatCompact(Math.ceil(combat.playerHull))}/{formatCompact(Math.ceil(stats.hullMax))}
            </strong>
            <span className="sortie-hud-meter" aria-hidden>
              <span className="sortie-hud-meter-fill hull" style={{ width: `${Math.round(hullPct * 100)}%` }} />
            </span>
          </div>
          <div className="combat-hud-readout" data-guide="sortie-shield">
            <span className="combat-hud-kicker">Shield</span>
            <strong className="combat-hud-value">
              {formatCompact(Math.ceil(combat.playerShield))}/{formatCompact(Math.ceil(stats.shieldMax))}
            </strong>
            <span className="sortie-hud-meter" aria-hidden>
              <span className="sortie-hud-meter-fill shield" style={{ width: `${Math.round(shieldPct * 100)}%` }} />
            </span>
          </div>
          <div className="combat-hud-readout" data-guide="salvage-stat">
            <span className="combat-hud-kicker">Salvage</span>
            <strong className="combat-hud-value">{formatCompact(Math.floor(state.resources.salvage))}</strong>
          </div>
        </header>
        {dying ? (
          <p className="sortie-defeat-banner" role="status">
            Hull lost
          </p>
        ) : null}
      </div>

      <div className="sortie-actions">
        {dying ? (
          <button type="button" disabled>
            Hull lost
          </button>
        ) : live ? (
          <div className="sheet-tabs sortie-push-tabs" data-guide="sortie-push">
            {COMBAT_PUSH_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={pushMode === mode ? 'sheet-tab active' : 'sheet-tab'}
                onClick={() => onSetPushMode(mode)}
              >
                {pushModeLabel(mode)}
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="primary" data-guide="launch" onClick={onLaunch}>
            Launch
          </button>
        )}
        <button
          type="button"
          className={sheetOpen ? 'primary sortie-cores-btn' : 'sortie-cores-btn'}
          data-guide={sheetOpen ? undefined : 'cores-sheet'}
          aria-expanded={sheetOpen}
          onClick={() => setCoresOpen((open) => !open)}
        >
          Cores
        </button>
      </div>

      {sheetOpen ? (
        <div
          className="screen-help-backdrop cores-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!forceCores) setCoresOpen(false)
          }}
        >
          <div
            className="screen-help-card cores-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-guide="cores-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="combat-hud-kicker">Cores</p>
            <h3 id={titleId}>Cores</h3>
            <p className="sortie-sheet-kicker">
              Tap a name for the full sheet. Salvage ranks these. Drones live on Network.
            </p>
            <CoreSheet
              state={state}
              compact
              onUpgrade={onUpgrade}
              onPickMilestone={onPickMilestone}
            />
            <button
              type="button"
              className="primary"
              disabled={forceCores}
              onClick={() => setCoresOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
