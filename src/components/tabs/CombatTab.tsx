import { useMemo } from 'react'
import type { GameState } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { normalizeRoute } from '../../game/sectors'
import { wavesForRun, getEchoRun } from '../../game/echo'
import { activeProtocol } from '../../game/protocols'
import { formatCompact } from '../../game/format'
import { Battlefield, type BattlefieldMode } from '../Battlefield'
import { CoreSheet } from '../CoreSheet'

interface CombatTabProps {
  state: GameState
  onExtract: () => void
  onLaunch: () => void
  onUpgrade: (moduleId: string) => void
  onPickMilestone: (moduleId: string, milestoneId: string, choiceId: string) => void
}

export function CombatTab({
  state,
  onExtract,
  onLaunch,
  onUpgrade,
  onPickMilestone,
}: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const waves = wavesForRun(state)
  const dying = (combat.defeatLeft ?? 0) > 0
  const live = !combat.docked
  const protocol = activeProtocol(state)
  const echoRun = combat && state.echo?.activeId ? getEchoRun(state.echo.activeId) : undefined

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

  return (
    <section className="sortie-screen">
      <header className="combat-hud-bar">
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
        </div>
        <div className="combat-hud-readout" data-guide="sortie-shield">
          <span className="combat-hud-kicker">Shield</span>
          <strong className="combat-hud-value">
            {formatCompact(Math.ceil(combat.playerShield))}/{formatCompact(Math.ceil(stats.shieldMax))}
          </strong>
        </div>
        <div className="combat-hud-readout" data-guide="salvage-stat">
          <span className="combat-hud-kicker">Salvage</span>
          <strong className="combat-hud-value">{formatCompact(Math.floor(state.resources.salvage))}</strong>
        </div>
      </header>

      <div className="sortie-canvas" data-guide="sortie-canvas">
        <Battlefield
          playerUnits={playerUnits}
          enemyUnits={enemyUnits}
          projectiles={combat.docked && !dying ? [] : combat.projectiles}
          beams={combat.docked && !dying ? [] : combat.beams ?? []}
          fx={combat.fx}
          mode={battlefieldMode}
        />
        {dying ? (
          <p className="sortie-defeat-banner" role="status">
            Hull lost
          </p>
        ) : null}
      </div>

      <div className="sortie-sheet" data-guide="cores-sheet">
        <p className="sortie-sheet-kicker">
          Cores · tap a name for the full sheet. Salvage ranks these. Drones live on Network.
        </p>
        <CoreSheet
          state={state}
          compact
          onUpgrade={onUpgrade}
          onPickMilestone={onPickMilestone}
        />
      </div>

      <div className="sortie-actions">
        {dying ? (
          <button type="button" disabled>
            Hull lost
          </button>
        ) : live ? (
          <button type="button" onClick={onExtract}>
            Extract
          </button>
        ) : (
          <button type="button" className="primary" data-guide="launch" onClick={onLaunch}>
            Launch
          </button>
        )}
      </div>
    </section>
  )
}
