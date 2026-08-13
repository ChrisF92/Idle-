import { useMemo } from 'react'
import type { GameState } from '../game/types'
import { formatCompact } from '../game/format'
import {
  FORWARD_BUILDINGS,
  buildingEffectSummary,
  buildingUpgradeCost,
  canConstructOrUpgrade,
  expeditionDroneCapacity,
  forwardBaseUnlocked,
  isBuildingUnlocked,
  totalAssignedExpeditionDrones,
  unassignedExpeditionDrones,
  type ForwardBuildingId,
} from '../game/forwardBase'

interface ForwardBasePanelProps {
  state: GameState
  onConstruct: (buildingId: ForwardBuildingId) => void
  onAssign: (buildingId: ForwardBuildingId, delta: number) => void
}

export function ForwardBasePanel({
  state,
  onConstruct,
  onAssign,
}: ForwardBasePanelProps) {
  const unlocked = forwardBaseUnlocked(state)
  const capacity = expeditionDroneCapacity(state)
  const assigned = totalAssignedExpeditionDrones(state)
  const free = unassignedExpeditionDrones(state)
  const corps = state.base.workerDrones

  const rows = useMemo(() => FORWARD_BUILDINGS, [])

  if (!unlocked) {
    return (
      <section className="forward-base-panel muted">
        <p className="combat-hud-kicker">Forward Base</p>
        <p>Unlocks at career wave 10 — deploy remote drones into temporary Expedition buildings.</p>
      </section>
    )
  }

  return (
    <section className="forward-base-panel" aria-label="Forward Base">
      <header className="upgrade-store-header">
        <div>
          <p className="combat-hud-kicker">Forward Base</p>
          <strong>
            Drones {assigned}/{capacity}
          </strong>
          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
            Unassigned {free} · Corps {corps} (Home Base unaffected)
          </p>
        </div>
      </header>

      <div className="upgrade-cards">
        {rows.map((def) => {
          const available = isBuildingUnlocked(state, def)
          const b = state.combat.forwardBase.buildings[def.id]
          const busy = (b.timerRemaining ?? 0) > 0
          const check = canConstructOrUpgrade(state, def.id)
          const cost = buildingUpgradeCost(def, b.level)
          const effect = buildingEffectSummary(state, def.id)

          return (
            <article
              key={def.id}
              className={`upgrade-card${check.ok ? ' upgrade-card-affordable' : ''}${!available ? ' upgrade-card-capped' : ''}`}
            >
              <div className="upgrade-card-top">
                <strong>{def.name}</strong>
                <span>
                  {b.level <= 0 ? 'Not built' : `Level ${b.level} / ${def.maxLevel}`}
                </span>
              </div>
              <p className="muted upgrade-card-effect">
                {!available
                  ? `Unlocks at career wave ${def.unlockWave}`
                  : busy
                    ? `${b.timerKind === 'construct' ? 'Constructing' : 'Upgrading'}… ${b.timerRemaining!.toFixed(1)}s`
                    : effect}
              </p>
              {b.level > 0 ? (
                <div className="forward-drone-row">
                  <span>
                    Drones {b.assignedDrones}/{def.droneCapacity}
                  </span>
                  <div className="upgrade-bulk">
                    <button
                      type="button"
                      disabled={b.assignedDrones <= 0}
                      onClick={() => onAssign(def.id, -1)}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      disabled={free <= 0 || b.assignedDrones >= def.droneCapacity}
                      onClick={() => onAssign(def.id, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="upgrade-card-bottom">
                <span>
                  {b.level >= def.maxLevel
                    ? 'Max level'
                    : `Cost: ${formatCompact(cost, 0)} Salvage`}
                </span>
                <button
                  type="button"
                  className={check.ok ? 'primary' : ''}
                  disabled={!check.ok}
                  onClick={() => onConstruct(def.id)}
                >
                  {b.level <= 0 ? 'Build' : 'Upgrade'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
