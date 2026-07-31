import type { GameState } from '../../game/types'
import { ESSENCE_UPGRADES, RESEARCH } from '../../game/catalog'

interface ResearchTabProps {
  state: GameState
  onBuyResearch: (researchId: string) => void
  onBuyEssence: (upgradeId: string) => void
}

export function ResearchTab({ state, onBuyResearch, onBuyEssence }: ResearchTabProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Research</h2>
        <p>Spend Data to unlock systems. Essence binds permanent constructs.</p>
      </header>

      <div className="stat-row">
        <div>
          <span className="muted">Data</span>
          <strong>{state.resources.data.toFixed(1)}</strong>
        </div>
        <div>
          <span className="muted">Essence</span>
          <strong>{state.resources.essence.toFixed(1)}</strong>
        </div>
      </div>

      <h3>Projects</h3>
      <ul className="def-list">
        {RESEARCH.map((r) => {
          const owned = state.research.unlocked.includes(r.id)
          const essenceNeed = r.costEssence ?? 0
          const canBuy =
            !owned &&
            state.resources.data >= r.costData &&
            state.resources.essence >= essenceNeed
          const costLabel =
            essenceNeed > 0 ? `${r.costData} Data + ${essenceNeed} Essence` : `${r.costData} Data`
          return (
            <li key={r.id}>
              <div>
                <strong>{r.name}</strong>
                <p className="muted">{r.description}</p>
              </div>
              <div className="action-col">
                <span className="badge">{owned ? 'Done' : costLabel}</span>
                <button
                  type="button"
                  disabled={!canBuy}
                  onClick={() => onBuyResearch(r.id)}
                >
                  {owned ? 'Owned' : 'Research'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <h3>Essence constructs</h3>
      <ul className="def-list">
        {ESSENCE_UPGRADES.map((u) => {
          const owned = state.essence.purchased.includes(u.id)
          const canBuy = !owned && state.resources.essence >= u.costEssence
          return (
            <li key={u.id}>
              <div>
                <strong>{u.name}</strong>
                <p className="muted">{u.description}</p>
              </div>
              <div className="action-col">
                <span className="badge">{owned ? 'Bound' : `${u.costEssence} Essence`}</span>
                <button type="button" disabled={!canBuy} onClick={() => onBuyEssence(u.id)}>
                  {owned ? 'Owned' : 'Bind'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
