import type { GameState } from '../../game/types'
import { AI_NODES } from '../../game/catalog'

interface AiTabProps {
  state: GameState
}

export function AiTab({ state }: AiTabProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>AI Network</h2>
        <p>Tactical ship-mind upgrades: automation, QoL, and combat doctrines.</p>
      </header>

      <p>
        AI Points: <strong>{state.resources.aiPoints.toFixed(1)}</strong>
      </p>

      <ul className="def-list">
        {AI_NODES.map((node) => {
          const owned = state.ai.purchased.includes(node.id)
          return (
            <li key={node.id}>
              <div>
                <strong>{node.name}</strong>
                <p className="muted">{node.description}</p>
              </div>
              <span className="badge">
                {owned ? 'Active' : `${node.costAiPoints} AI`}
              </span>
            </li>
          )
        })}
      </ul>

      <p className="placeholder">Stub: earn AI Points from milestones; buy nodes.</p>
    </section>
  )
}
