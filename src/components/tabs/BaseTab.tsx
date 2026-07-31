import type { GameState, Resources } from '../../game/types'
import { buildingUpgradeCost, getBuilding } from '../../game/catalog'
import { isBuildingUnlocked } from '../../game/actions'
import { RESOURCE_LABELS } from '../../game/state'

interface BaseTabProps {
  state: GameState
  onUpgrade: (buildingId: string) => void
}

function costLabel(cost: Partial<Record<keyof Resources, number>>): string {
  return Object.entries(cost)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${v} ${RESOURCE_LABELS[k as keyof Resources]}`)
    .join(', ')
}

const BUILDING_ORDER = [
  'scrapYard',
  'powerCell',
  'sensorArray',
  'foundry',
  'workDroneHangar',
]

export function BaseTab({ state, onUpgrade }: BaseTabProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Base</h2>
        <p>Industry that runs while you fight. Upgrade buildings to accelerate resources.</p>
      </header>

      <ul className="def-list">
        {BUILDING_ORDER.map((id) => {
          const def = getBuilding(id)
          if (!def) return null
          const unlocked = isBuildingUnlocked(state, id)
          const level = state.base.buildings[id] ?? 0
          const cost = buildingUpgradeCost(def, level)
          const canBuy =
            unlocked &&
            Object.entries(cost).every(
              ([k, v]) => state.resources[k as keyof Resources] >= (v ?? 0),
            )

          return (
            <li key={id}>
              <div>
                <strong>{def.name}</strong>
                <p className="muted">{def.description}</p>
                {!unlocked ? (
                  <p className="muted">Requires research: {def.requiresResearch}</p>
                ) : (
                  <p className="muted">Next: {costLabel(cost)}</p>
                )}
              </div>
              <div className="action-col">
                <span className="badge">Lv {level}</span>
                <button type="button" disabled={!canBuy} onClick={() => onUpgrade(id)}>
                  Upgrade
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="placeholder">
        Foundry converts scrap → alloys once Alloy Smelting is researched. Work Drone Hangar
        (Drone Logistics) adds industrial scrap and data — not combat escorts.
      </p>
    </section>
  )
}
