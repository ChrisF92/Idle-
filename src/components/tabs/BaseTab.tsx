import type { GameState } from '../../game/types'
import { BUILDINGS } from '../../game/catalog'

interface BaseTabProps {
  state: GameState
}

export function BaseTab({ state }: BaseTabProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Base</h2>
        <p>Industry that runs while you fight. Offline production will use these rates.</p>
      </header>

      <ul className="def-list">
        {BUILDINGS.map((b) => (
          <li key={b.id}>
            <div>
              <strong>{b.name}</strong>
              <p className="muted">{b.description}</p>
            </div>
            <span className="badge">Lv {state.base.buildings[b.id] ?? 0}</span>
          </li>
        ))}
      </ul>

      <p className="placeholder">Stub: spend scrap/alloys to upgrade buildings.</p>
    </section>
  )
}
