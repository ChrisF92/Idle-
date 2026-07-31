import type { GameState, Resources } from '../../game/types'
import {
  STATIONS,
  WORKER_MANUFACTURE_SECONDS,
  idleWorkers,
  isStationUnlocked,
  workerManufactureSpeed,
} from '../../game/catalog'
import { COMBAT_DRONES_UNLOCK_SECTOR } from '../../game/catalog'
import { RESOURCE_LABELS } from '../../game/state'

interface BaseTabProps {
  state: GameState
  onAssign: (stationId: string, delta: number) => void
  onAutoBalance: () => void
}

function rateLabel(rates: Partial<Record<keyof Resources, number>>): string {
  const parts = Object.entries(rates)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${v}/${RESOURCE_LABELS[k as keyof Resources].toLowerCase()}s`)
  return parts.join(', ')
}

export function BaseTab({ state, onAssign, onAutoBalance }: BaseTabProps) {
  const idle = idleWorkers(state)
  const speed = workerManufactureSpeed(state)
  const secondsLeft =
    ((1 - state.base.manufactureProgress) * WORKER_MANUFACTURE_SECONDS) / speed
  const canAuto = state.ai.purchased.includes('auto-assign-workers')

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Base</h2>
        <p>
          Manufacture worker drones, then assign them to named stations. Assignments reset on
          prestige; drone count is permanent.
        </p>
      </header>

      <div className="stat-row">
        <div>
          <span className="muted">Workers</span>
          <strong>{state.base.workerDrones}</strong>
        </div>
        <div>
          <span className="muted">Idle</span>
          <strong>{idle}</strong>
        </div>
        <div>
          <span className="muted">Next drone</span>
          <strong>{secondsLeft.toFixed(0)}s</strong>
        </div>
        <div>
          <span className="muted">Fab speed</span>
          <strong>×{speed.toFixed(2)}</strong>
        </div>
      </div>

      <div className="manufacture-bar" aria-label="Manufacture progress">
        <div
          className="manufacture-bar-fill"
          style={{ width: `${Math.min(100, state.base.manufactureProgress * 100)}%` }}
        />
      </div>

      {canAuto ? (
        <p>
          <button type="button" className="primary" onClick={onAutoBalance}>
            Auto-Balance Workers
          </button>
        </p>
      ) : (
        <p className="muted">Buy Labor Router (AI) to auto-balance assignments.</p>
      )}

      <h3>Stations</h3>
      <ul className="def-list">
        {STATIONS.map((station) => {
          const unlocked = isStationUnlocked(state, station.id)
          const assigned = state.base.assignments[station.id] ?? 0
          const extras: string[] = []
          if (station.repairPerDrone) {
            extras.push(`+${station.repairPerDrone} hull/s repair each`)
          }
          if (station.manufactureBonusPerDrone) {
            extras.push(`+${(station.manufactureBonusPerDrone * 100).toFixed(0)}% fab speed each`)
          }
          if (station.upkeepScrapPerDrone) {
            extras.push(`${station.upkeepScrapPerDrone} scrap/s upkeep each`)
          }
          return (
            <li key={station.id}>
              <div>
                <strong>{station.name}</strong>
                <p className="muted">{station.description}</p>
                {!unlocked ? (
                  <p className="muted">
                    {station.requiresSystem && !station.requiresResearch
                      ? `Requires ${station.requiresSystem} system`
                      : station.requiresResearch
                        ? `Requires research: ${station.requiresResearch}`
                        : 'Locked'}
                  </p>
                ) : (
                  <p className="muted">
                    {rateLabel(station.rates) || 'Special duty'}
                    {extras.length ? ` · ${extras.join(' · ')}` : ''}
                  </p>
                )}
              </div>
              <div className="action-col">
                <span className="badge">{assigned} assigned</span>
                <div className="assign-row">
                  <button
                    type="button"
                    disabled={!unlocked || assigned <= 0}
                    onClick={() => onAssign(station.id, -1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    data-guide={`station-${station.id}-plus`}
                    disabled={!unlocked || idle <= 0}
                    onClick={() => onAssign(station.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <h3>Combat Drones</h3>
      {state.meta.combatDronesUnlocked ? (
        <p className="muted">
          Pool size: {state.base.combatDrones}. Assignment roles unlock in a later update.
        </p>
      ) : (
        <p className="muted">
          Locked — clear sector {COMBAT_DRONES_UNLOCK_SECTOR} (separate pool from workers).
        </p>
      )}
    </section>
  )
}
