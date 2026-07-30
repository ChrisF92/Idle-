import type { GameState } from '../../game/types'
import { SHIP_FRAMES, SHIP_MODULES } from '../../game/catalog'

interface ShipyardTabProps {
  state: GameState
}

export function ShipyardTab({ state }: ShipyardTabProps) {
  const frame = SHIP_FRAMES.find((f) => f.id === state.shipyard.frameId)

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Shipyard</h2>
        <p>Frames and modules for entity engagements. Loadout editing comes next.</p>
      </header>

      <div className="card-list">
        <article>
          <h3>Active frame</h3>
          <p>{frame?.name ?? state.shipyard.frameId}</p>
          <p className="muted">Module slots: {frame?.slots ?? '?'}</p>
        </article>
        <article>
          <h3>Fitted modules</h3>
          <ul>
            {state.shipyard.modules.map((id) => {
              const mod = SHIP_MODULES.find((m) => m.id === id)
              return (
                <li key={id}>
                  {mod?.name ?? id} <span className="muted">({mod?.role})</span>
                </li>
              )
            })}
          </ul>
        </article>
      </div>

      <p className="placeholder">Stub: swap frames, fit modules, save presets.</p>
    </section>
  )
}
