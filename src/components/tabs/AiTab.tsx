import type { GameState } from '../../game/types'
import { AI_NODES } from '../../game/catalog'

interface AiTabProps {
  state: GameState
  onBuy: (nodeId: string) => void
}

export function AiTab({ state, onBuy }: AiTabProps) {
  const challengeBlocks = state.prestige.activeChallengeId === 'no-ai'
  const automation = AI_NODES.filter((n) => n.kind === 'automation')
  const doctrines = AI_NODES.filter((n) => n.kind === 'doctrine')

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>AI Network</h2>
        <p>Automation and combat doctrines. Silent Bridge disables all of this.</p>
      </header>

      <p>
        AI Points: <strong>{state.resources.aiPoints.toFixed(2)}</strong>
      </p>
      {challengeBlocks ? (
        <p className="notice-warn">Silent Bridge challenge: AI purchases and doctrines blocked.</p>
      ) : null}

      <h3>Automation</h3>
      <NodeList
        nodes={automation}
        state={state}
        challengeBlocks={challengeBlocks}
        onBuy={onBuy}
      />

      <h3>Doctrines</h3>
      <NodeList
        nodes={doctrines}
        state={state}
        challengeBlocks={challengeBlocks}
        onBuy={onBuy}
      />

      <p className="placeholder">
        Earn AI Points from sector clears (bonus on bosses). Doctrines reset on prestige;
        re-buy each run.
      </p>
    </section>
  )
}

function NodeList({
  nodes,
  state,
  challengeBlocks,
  onBuy,
}: {
  nodes: typeof AI_NODES
  state: GameState
  challengeBlocks: boolean
  onBuy: (nodeId: string) => void
}) {
  return (
    <ul className="def-list">
      {nodes.map((node) => {
        const owned = state.ai.purchased.includes(node.id)
        const canBuy =
          !owned && !challengeBlocks && state.resources.aiPoints >= node.costAiPoints
        return (
          <li key={node.id}>
            <div>
              <strong>{node.name}</strong>
              <p className="muted">{node.description}</p>
            </div>
            <div className="action-col">
              <span className="badge">{owned ? 'Active' : `${node.costAiPoints} AI`}</span>
              <button type="button" disabled={!canBuy} onClick={() => onBuy(node.id)}>
                {owned ? 'Owned' : 'Buy'}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
