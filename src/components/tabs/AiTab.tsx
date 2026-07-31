import type { GameState } from '../../game/types'
import { AI_NODES, isAiNodePermanent } from '../../game/catalog'
import { careerHighestSector } from '../../game/progression'

interface AiTabProps {
  state: GameState
  onBuy: (nodeId: string) => void
}

export function AiTab({ state, onBuy }: AiTabProps) {
  const challengeBlocks = state.prestige.activeChallengeId === 'no-ai'
  const automation = AI_NODES.filter((n) => n.kind === 'automation')
  const qol = AI_NODES.filter((n) => n.kind === 'qol')
  const doctrines = AI_NODES.filter((n) => n.kind === 'doctrine')

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>AI Network</h2>
        <p>
          Permanent automation / QoL unlocks (kept on prestige) plus per-run combat doctrines.
          Silent Bridge disables all of this.
        </p>
      </header>

      <p>
        AI Points: <strong>{state.resources.aiPoints.toFixed(2)}</strong>
      </p>
      {challengeBlocks ? (
        <p className="notice-warn">Silent Bridge challenge: AI purchases and doctrines blocked.</p>
      ) : null}

      <h3>Automation</h3>
      <NodeList nodes={automation} state={state} challengeBlocks={challengeBlocks} onBuy={onBuy} />

      <h3>Quality of Life</h3>
      <NodeList nodes={qol} state={state} challengeBlocks={challengeBlocks} onBuy={onBuy} />

      <h3>Doctrines (per run)</h3>
      <NodeList nodes={doctrines} state={state} challengeBlocks={challengeBlocks} onBuy={onBuy} />
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
  const ever = careerHighestSector(state)
  return (
    <ul className="def-list">
      {nodes.map((node) => {
        const owned = state.ai.purchased.includes(node.id)
        const gated = (node.requiresSectorEver ?? 0) > ever
        const canBuy =
          !owned &&
          !challengeBlocks &&
          !gated &&
          state.resources.aiPoints >= node.costAiPoints
        const permanent = isAiNodePermanent(node)
        return (
          <li key={node.id}>
            <div>
              <strong>{node.name}</strong>
              <p className="muted">{node.description}</p>
              {gated ? (
                <p className="notice-warn">
                  Clear sector {node.requiresSectorEver} to unlock this node.
                </p>
              ) : null}
              <p className="muted">{permanent ? 'Permanent' : 'Resets on prestige'}</p>
            </div>
            <div className="action-col">
              <span className="badge">
                {owned ? 'Active' : gated ? 'Gated' : `${node.costAiPoints} AI`}
              </span>
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
