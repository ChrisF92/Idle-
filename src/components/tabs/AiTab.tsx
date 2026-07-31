import { useId, useState } from 'react'
import type { GameState } from '../../game/types'
import { AI_NODES, isAiNodePermanent } from '../../game/catalog'
import {
  ACHIEVEMENTS,
  careerHighestSector,
  isAchievementUnlocked,
} from '../../game/progression'

interface AiTabProps {
  state: GameState
  onBuy: (nodeId: string) => void
}

export function AiTab({ state, onBuy }: AiTabProps) {
  const [showAchievements, setShowAchievements] = useState(false)
  const challengeBlocks = state.prestige.activeChallengeId === 'no-ai'
  const automation = AI_NODES.filter((n) => n.kind === 'automation')
  const qol = AI_NODES.filter((n) => n.kind === 'qol')
  const doctrines = AI_NODES.filter((n) => n.kind === 'doctrine')
  const completed = state.meta.completedAchievements.length

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>AI Network</h2>
        <p>
          Achievements grant AI Points. Spend them on permanent automation / QoL
          and per-run combat doctrines. Silent Bridge disables purchases.
        </p>
      </header>

      <div className="ai-toolbar">
        <p>
          AI Points: <strong>{state.resources.aiPoints.toFixed(2)}</strong>
        </p>
        <button
          type="button"
          className="primary"
          data-guide="achievements-btn"
          onClick={() => setShowAchievements(true)}
        >
          Achievements ({completed}/{ACHIEVEMENTS.length})
        </button>
      </div>
      {challengeBlocks ? (
        <p className="notice-warn">Silent Bridge challenge: AI purchases and doctrines blocked.</p>
      ) : null}

      <h3>Automation</h3>
      <NodeList nodes={automation} state={state} challengeBlocks={challengeBlocks} onBuy={onBuy} />

      <h3>Quality of Life</h3>
      <NodeList nodes={qol} state={state} challengeBlocks={challengeBlocks} onBuy={onBuy} />

      <h3>Doctrines (per run)</h3>
      <NodeList nodes={doctrines} state={state} challengeBlocks={challengeBlocks} onBuy={onBuy} />

      {showAchievements ? (
        <AchievementsModal state={state} onClose={() => setShowAchievements(false)} />
      ) : null}
    </section>
  )
}

function AchievementsModal({
  state,
  onClose,
}: {
  state: GameState
  onClose: () => void
}) {
  const titleId = useId()
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">AI Network</p>
            <h3 id={titleId}>Achievements</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <p className="muted">
          Each unlock grants AI Points once. Progress is permanent across prestige.
        </p>
        <ul className="def-list">
          {ACHIEVEMENTS.map((def) => {
            const done = isAchievementUnlocked(state, def.id)
            return (
              <li key={def.id}>
                <div>
                  <strong>{def.name}</strong>
                  <p className="muted">{def.description}</p>
                </div>
                <div className="action-col">
                  <span className="badge">{done ? 'Done' : `+${def.rewardAiPoints} AI`}</span>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
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
