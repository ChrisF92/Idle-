import type { GameState, Resources } from '../../game/types'
import { SHIP_FRAMES, SHIP_MODULES } from '../../game/catalog'
import { RESOURCE_LABELS, computeShipStats } from '../../game/state'

interface ShipyardTabProps {
  state: GameState
  onUnlockFrame: (frameId: string) => void
  onSelectFrame: (frameId: string) => void
  onUnlockModule: (moduleId: string) => void
  onFitModule: (moduleId: string) => void
  onUnfitModule: (moduleId: string) => void
}

function costLabel(cost: Partial<Record<keyof Resources, number>>): string {
  const parts = Object.entries(cost)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${v} ${RESOURCE_LABELS[k as keyof Resources]}`)
  return parts.length ? parts.join(', ') : 'Free'
}

export function ShipyardTab({
  state,
  onUnlockFrame,
  onSelectFrame,
  onUnlockModule,
  onFitModule,
  onUnfitModule,
}: ShipyardTabProps) {
  const frame = SHIP_FRAMES.find((f) => f.id === state.shipyard.frameId)
  const stats = computeShipStats(state)
  const slotsUsed = state.shipyard.modules.length
  const slotsMax = frame?.slots ?? 0

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Shipyard</h2>
        <p>
          Unlock frames and modules, then fit a loadout. Weapons have cooldowns and tags; drones join
          the fleet. Loadouts persist through prestige.
        </p>
      </header>

      <div className="stat-row">
        <div>
          <span className="muted">Fleet DPS</span>
          <strong>{stats.damage.toFixed(1)}</strong>
        </div>
        <div>
          <span className="muted">Hull</span>
          <strong>{Math.round(stats.hullMax)}</strong>
        </div>
        <div>
          <span className="muted">Shield</span>
          <strong>{Math.round(stats.shieldMax)}</strong>
        </div>
        <div>
          <span className="muted">Armor / Eva</span>
          <strong>
            {stats.armor} / {(stats.evasion * 100).toFixed(0)}%
          </strong>
        </div>
        <div>
          <span className="muted">Drones</span>
          <strong>{stats.escortCount}</strong>
        </div>
        <div>
          <span className="muted">Slots</span>
          <strong>
            {slotsUsed}/{slotsMax}
          </strong>
        </div>
      </div>

      <h3>Frames</h3>
      <ul className="def-list">
        {SHIP_FRAMES.map((f) => {
          const unlocked = state.shipyard.unlockedFrames.includes(f.id)
          const active = state.shipyard.frameId === f.id
          const canUnlock =
            !unlocked &&
            Object.entries(f.unlockCost).every(
              ([k, v]) => state.resources[k as keyof Resources] >= (v ?? 0),
            )
          return (
            <li key={f.id}>
              <div>
                <strong>{f.name}</strong>
                <p className="muted">
                  {f.slots} slots · {f.baseDamage} dmg · {f.baseHull} hull
                </p>
                {!unlocked ? (
                  <p className="muted">Unlock: {costLabel(f.unlockCost)}</p>
                ) : null}
              </div>
              <div className="action-col">
                <span className="badge">{active ? 'Active' : unlocked ? 'Owned' : 'Locked'}</span>
                {!unlocked ? (
                  <button type="button" disabled={!canUnlock} onClick={() => onUnlockFrame(f.id)}>
                    Unlock
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={active || state.combat.inFight}
                    onClick={() => onSelectFrame(f.id)}
                  >
                    {active ? 'Selected' : 'Select'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <h3>Modules</h3>
      <ul className="def-list">
        {SHIP_MODULES.map((m) => {
          const unlocked = state.shipyard.unlockedModules.includes(m.id)
          const fitted = state.shipyard.modules.includes(m.id)
          const canUnlock =
            !unlocked &&
            Object.entries(m.unlockCost).every(
              ([k, v]) => state.resources[k as keyof Resources] >= (v ?? 0),
            )
          const canFit = unlocked && !fitted && slotsUsed < slotsMax && !state.combat.inFight
          return (
            <li key={m.id}>
              <div>
                <strong>{m.name}</strong>
                <p className="muted">
                  {m.role} — {m.description}
                </p>
                {!unlocked ? (
                  <p className="muted">Unlock: {costLabel(m.unlockCost)}</p>
                ) : null}
              </div>
              <div className="action-col">
                <span className="badge">{fitted ? 'Fitted' : unlocked ? 'Owned' : 'Locked'}</span>
                {!unlocked ? (
                  <button type="button" disabled={!canUnlock} onClick={() => onUnlockModule(m.id)}>
                    Unlock
                  </button>
                ) : fitted ? (
                  <button
                    type="button"
                    disabled={state.combat.inFight}
                    onClick={() => onUnfitModule(m.id)}
                  >
                    Unfit
                  </button>
                ) : (
                  <button type="button" disabled={!canFit} onClick={() => onFitModule(m.id)}>
                    Fit
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
