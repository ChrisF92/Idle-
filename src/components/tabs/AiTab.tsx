import type { GameState } from '../../game/types'
import { AI_NODES } from '../../game/catalog'

interface AiTabProps {
  state: GameState
  onBuy: (nodeId: string) => void
}

export function AiTab({ state, onBuy }: AiTabProps) {
  const challengeBlocks = state.prestige.activeChallengeId === 'no-ai'

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>AI Network</h2>
        <p>Tactical ship-mind upgrades: automation, QoL, and combat doctrines.</p>
      </header>

      <p>
        AI Points: <strong>{state.resources.aiPoints.toFixed(2)}</strong>
      </p>
      {challengeBlocks ? (
        <p className="notice-warn">Silent Bridge challenge: AI purchases blocked.</p>
      ) : null}

      <ul className="def-list">
        {AI_NODES.map((node) => {
          const owned = state.ai.purchased.includes(node.id)
          const canBuy =
            !owned &&
            !challengeBlocks &&
            state.resources.aiPoints >= node.costAiPoints
          return (
            <li key={node.id}>
              <div>
                <strong>{node.name}</strong>
                <p className="muted">{node.description}</p>
              </div>
              <div className="action-col">
                <span className="badge">
                  {owned ? 'Active' : `${node.costAiPoints} AI`}
                </span>
                <button
                  type="button"
                  disabled={!canBuy}
                  onClick={() => onBuy(node.id)}
                >
                  {owned ? 'Owned' : 'Buy'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="placeholder">
        Earn AI Points from sector clears (bonus every 5th sector).
      </p>
    </section>
  )
}
