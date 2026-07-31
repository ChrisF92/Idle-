import { useId, useState } from 'react'
import type { GameState } from '../../game/types'
import { AI_NODES, getAiNode, isAiNodePermanent } from '../../game/catalog'
import {
  ACHIEVEMENTS,
  achievementCompletions,
  achievementNextThreshold,
  achievementProgressValue,
  careerHighestSector,
  isAchievementUnlocked,
} from '../../game/progression'

type AiSub = 'automation' | 'qol' | 'doctrines'

interface AiTabProps {
  state: GameState
  onBuy: (nodeId: string) => void
}

export function AiTab({ state, onBuy }: AiTabProps) {
  const [showAchievements, setShowAchievements] = useState(false)
  const [sub, setSub] = useState<AiSub>('automation')
  const challengeBlocks = state.prestige.activeChallengeId === 'no-ai'
  const automation = AI_NODES.filter((n) => n.kind === 'automation')
  const qol = AI_NODES.filter((n) => n.kind === 'qol')
  const doctrines = AI_NODES.filter((n) => n.kind === 'doctrine')
  const completed = state.meta.completedAchievements.length
  const nodes =
    sub === 'automation' ? automation : sub === 'qol' ? qol : doctrines

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>AI Network</h2>
        <p>Spend AI Points on automation, combat speed, and doctrines.</p>
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

      <div className="sub-tabs" role="tablist" aria-label="AI sections">
        <button
          type="button"
          role="tab"
          className={sub === 'automation' ? 'sub-tab active' : 'sub-tab'}
          aria-selected={sub === 'automation'}
          onClick={() => setSub('automation')}
        >
          Automation
        </button>
        <button
          type="button"
          role="tab"
          className={sub === 'qol' ? 'sub-tab active' : 'sub-tab'}
          aria-selected={sub === 'qol'}
          onClick={() => setSub('qol')}
        >
          QoL
        </button>
        <button
          type="button"
          role="tab"
          className={sub === 'doctrines' ? 'sub-tab active' : 'sub-tab'}
          aria-selected={sub === 'doctrines'}
          onClick={() => setSub('doctrines')}
        >
          Doctrines
        </button>
      </div>

      <NodeList
        nodes={nodes}
        state={state}
        challengeBlocks={challengeBlocks}
        onBuy={onBuy}
      />

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
          One-offs grant AI once. Repeatables keep paying as you grind — the long AIP sink for
          combat Chrono and deep automation.
        </p>
        <ul className="def-list">
          {ACHIEVEMENTS.map((def) => {
            const done = isAchievementUnlocked(state, def.id)
            const tiers = achievementCompletions(state, def.id)
            const next = achievementNextThreshold(state, def)
            const progress = achievementProgressValue(state, def.condition)
            return (
              <li key={def.id}>
                <div>
                  <strong>{def.name}</strong>
                  <p className="muted">{def.description}</p>
                  {def.repeatable ? (
                    <p className="muted">
                      Progress {progress}/{next}
                      {tiers > 0 ? ` · claimed ×${tiers}` : ''}
                    </p>
                  ) : null}
                </div>
                <div className="action-col">
                  <span className="badge">
                    {def.repeatable
                      ? done
                        ? `×${tiers} · +${def.rewardAiPoints}`
                        : `+${def.rewardAiPoints} AI`
                      : done
                        ? 'Done'
                        : `+${def.rewardAiPoints} AI`}
                  </span>
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
        const prereqMissing =
          !!node.requiresAiNode && !state.ai.purchased.includes(node.requiresAiNode)
        const prereqName = node.requiresAiNode
          ? getAiNode(node.requiresAiNode)?.name ?? node.requiresAiNode
          : null
        const canBuy =
          !owned &&
          !challengeBlocks &&
          !gated &&
          !prereqMissing &&
          state.resources.aiPoints >= node.costAiPoints
        const permanent = isAiNodePermanent(node)
        return (
          <li key={node.id}>
            <div>
              <strong>{node.name}</strong>
              <p className="muted">{node.description}</p>
              {gated ? (
                <p className="notice-warn">Clear sector {node.requiresSectorEver}.</p>
              ) : prereqMissing ? (
                <p className="notice-warn">Requires {prereqName}.</p>
              ) : (
                <p className="muted">{permanent ? 'Permanent' : 'Per run'}</p>
              )}
            </div>
            <div className="action-col">
              <span className="badge">
                {owned ? 'Active' : gated || prereqMissing ? 'Gated' : `${node.costAiPoints} AI`}
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
