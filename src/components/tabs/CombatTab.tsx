import { useMemo } from 'react'
import type { GameState } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { wavesForSector } from '../../game/sectors'
import { Battlefield, type BattlefieldMode } from '../Battlefield'

interface CombatTabProps {
  state: GameState
  onExtract: () => void
  onLaunch: () => void
}

export function CombatTab({ state, onExtract, onLaunch }: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const waves = wavesForSector(combat.sector)
  const live = !combat.docked

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

  const battlefieldMode: BattlefieldMode = combat.docked
    ? 'docked'
    : combat.inFight
      ? 'fighting'
      : 'ready'

  const playerUnits = combat.inFight && combat.playerUnits.length > 0 ? combat.playerUnits : previewPlayer

  return (
    <section className="panel combat-hud combat-bridge">
      <header className="combat-hud-bar">
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">Sector</span>
          <strong className="combat-hud-value">{combat.sector}</strong>
        </div>
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">Wave</span>
          <strong className="combat-hud-value">
            {combat.wave}/{waves}
          </strong>
        </div>
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">Salvage</span>
          <strong className="combat-hud-value">{Math.floor(state.resources.salvage)}</strong>
        </div>
      </header>

      <Battlefield
        playerUnits={playerUnits}
        enemyUnits={combat.docked ? [] : combat.enemyUnits}
        projectiles={combat.docked ? [] : combat.projectiles}
        fx={combat.fx}
        mode={battlefieldMode}
      />

      <p className="assign-row">
        {live ? (
          <button type="button" onClick={onExtract}>
            Extract to Dock
          </button>
        ) : (
          <button type="button" className="primary" onClick={onLaunch}>
            Launch / Resume
          </button>
        )}
      </p>
      <p className="muted">
        {live
          ? combat.inFight
            ? `${combat.enemyName} — shields then hull. Extract freezes combat; Cores stay.`
            : 'Pushing to the next wave…'
          : 'Extracted. Kill-fed systems pause until you launch again.'}
      </p>
    </section>
  )
}
