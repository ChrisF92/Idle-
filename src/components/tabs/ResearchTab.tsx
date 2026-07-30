import type { GameState } from '../../game/types'
import { RESEARCH } from '../../game/catalog'

interface ResearchTabProps {
  state: GameState
  onBuy: (researchId: string) => void
}

export function ResearchTab({ state, onBuy }: ResearchTabProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Research</h2>
        <p>Spend Data to unlock systems, buildings, and combat bonuses.</p>
      </header>

      <p>
        Data: <strong>{state.resources.data.toFixed(1)}</strong>
      </p>

      <ul className="def-list">
        {RESEARCH.map((r) => {
          const owned = state.research.unlocked.includes(r.id)
          const canBuy = !owned && state.resources.data >= r.costData
          return (
            <li key={r.id}>
              <div>
                <strong>{r.name}</strong>
                <p className="muted">{r.description}</p>
              </div>
              <div className="action-col">
                <span className="badge">{owned ? 'Done' : `${r.costData} Data`}</span>
                <button
                  type="button"
                  disabled={!canBuy}
                  onClick={() => onBuy(r.id)}
                >
                  {owned ? 'Owned' : 'Research'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
