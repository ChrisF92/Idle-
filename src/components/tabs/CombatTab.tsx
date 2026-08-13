import { useMemo, useState } from 'react'
import type { GameState } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { wavesForSector } from '../../game/sectors'
import { Battlefield, type BattlefieldMode } from '../Battlefield'
import { CoreSheet } from '../CoreSheet'
import { NetworkSheet } from '../NetworkSheet'

interface CombatTabProps {
  state: GameState
  onExtract: () => void
  onLaunch: () => void
  onUpgrade: (moduleId: string) => void
  onPickMilestone: (moduleId: string, milestoneId: string, choiceId: string) => void
  onAssign: (barId: string, delta: number) => void
}

export function CombatTab({
  state,
  onExtract,
  onLaunch,
  onUpgrade,
  onPickMilestone,
  onAssign,
}: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const waves = wavesForSector(combat.sector)
  const live = !combat.docked
  const [sheet, setSheet] = useState<'cores' | 'network'>('cores')

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
    <section className="sortie-screen">
      <header className="combat-hud-bar">
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">S{combat.sector}</span>
          <strong className="combat-hud-value">
            W{combat.wave}/{waves}
          </strong>
        </div>
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">Hull</span>
          <strong className="combat-hud-value">
            {Math.ceil(combat.playerHull)}/{Math.ceil(stats.hullMax)}
          </strong>
        </div>
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">Shield</span>
          <strong className="combat-hud-value">
            {Math.ceil(combat.playerShield)}/{Math.ceil(stats.shieldMax)}
          </strong>
        </div>
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">Salvage</span>
          <strong className="combat-hud-value">{Math.floor(state.resources.salvage)}</strong>
        </div>
      </header>

      <div className="sortie-canvas">
        <Battlefield
          playerUnits={playerUnits}
          enemyUnits={combat.docked ? [] : combat.enemyUnits}
          projectiles={combat.docked ? [] : combat.projectiles}
          fx={combat.fx}
          mode={battlefieldMode}
        />
      </div>

      <div className="sortie-sheet">
        <div className="sheet-tabs">
          <button
            type="button"
            className={sheet === 'cores' ? 'sheet-tab active' : 'sheet-tab'}
            onClick={() => setSheet('cores')}
          >
            Cores
          </button>
          <button
            type="button"
            className={sheet === 'network' ? 'sheet-tab active' : 'sheet-tab'}
            onClick={() => setSheet('network')}
          >
            Network
          </button>
        </div>
        {sheet === 'cores' ? (
          <CoreSheet
            state={state}
            compact
            onUpgrade={onUpgrade}
            onPickMilestone={onPickMilestone}
          />
        ) : (
          <NetworkSheet state={state} compact onAssign={onAssign} />
        )}
      </div>

      <div className="sortie-actions">
        {live ? (
          <button type="button" onClick={onExtract}>
            Extract
          </button>
        ) : (
          <button type="button" className="primary" onClick={onLaunch}>
            Launch
          </button>
        )}
      </div>
    </section>
  )
}
