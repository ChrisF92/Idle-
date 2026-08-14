import type { GameState } from '../../game/types'
import {
  ACHIEVEMENTS,
  isAchievementUnlocked,
  isSystemUnlocked,
} from '../../game/progression'
import {
  PROCESS_NODES,
  canBuyProcessNode,
  hasProcess,
} from '../../game/process'
import { formatCompact } from '../../game/format'

interface ProcessTabProps {
  state: GameState
  onBack: () => void
  onBuy: (id: string) => void
}

export function ProcessTab({ state, onBack, onBuy }: ProcessTabProps) {
  const open = isSystemUnlocked(state, 'process')
  const points = state.resources.aiPoints

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>Process</h2>
        <p>
          {open
            ? `${formatCompact(points, 1)} Process · achievements fund automation`
            : 'Clear sector 1 to wake Process.'}
        </p>
      </header>
      {!open ? (
        <p className="muted">Achievements grant Process points. Spend them on QoL nodes.</p>
      ) : (
        <div className="panel-scroll">
          <h3 className="foundry-heading">Nodes</h3>
          {PROCESS_NODES.map((node) => {
            const owned = hasProcess(state, node.id)
            const check = canBuyProcessNode(state, node.id)
            return (
              <article key={node.id} className="network-row">
                <div className="network-row-main">
                  <strong>{node.name}</strong>
                  <span className="muted">{owned ? 'Owned' : `${node.cost} Process`}</span>
                </div>
                <p className="network-row-stats">{node.blurb}</p>
                <button
                  type="button"
                  className="primary"
                  disabled={owned || !check.ok}
                  onClick={() => onBuy(node.id)}
                >
                  {owned ? 'Owned' : check.ok ? 'Buy' : check.reason}
                </button>
              </article>
            )
          })}
          <h3 className="foundry-heading">Achievements</h3>
          {ACHIEVEMENTS.filter((a) => !a.repeatable).slice(0, 8).map((a) => (
            <article key={a.id} className="network-row">
              <div className="network-row-main">
                <strong>{a.name}</strong>
                <span className="muted">
                  {isAchievementUnlocked(state, a.id) ? 'Done' : `+${a.rewardAiPoints}`}
                </span>
              </div>
              <p className="network-row-stats">{a.description}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
