import type { GameState } from '../../game/types'
import { RESEARCH } from '../../game/catalog'

interface ResearchTabProps {
  state: GameState
}

export function ResearchTab({ state }: ResearchTabProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Research</h2>
        <p>Spend Data to unlock systems, buildings, and doctrines.</p>
      </header>

      <ul className="def-list">
        {RESEARCH.map((r) => {
          const owned = state.research.unlocked.includes(r.id)
          return (
            <li key={r.id}>
              <div>
                <strong>{r.name}</strong>
                <p className="muted">{r.description}</p>
              </div>
              <span className="badge">{owned ? 'Done' : `${r.costData} Data`}</span>
            </li>
          )
        })}
      </ul>

      <p className="placeholder">Stub: purchase research nodes when Data is available.</p>
    </section>
  )
}
