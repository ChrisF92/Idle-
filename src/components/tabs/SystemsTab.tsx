import type { GameState } from '../../game/types'
import { systemsHubCards, type SystemsHubId } from '../../game/systemsHub'
import { workerAllocationSummary } from '../../game/workers'
import { formatCompact } from '../../game/format'
import { droneCap } from '../../game/catalog'
import { isSystemUnlocked } from '../../game/progression'
import { attentionAria, networkAttention } from '../../game/hubAttention'
import { AttentionPips } from '../AttentionPips'
import './SystemsTab.css'

type Props = {
  state: GameState
  onManage: (id: SystemsHubId) => void
}

export function SystemsTab({ state, onManage }: Props) {
  const cards = systemsHubCards(state)
  const workers = workerAllocationSummary(state)
  const workersUnlocked = isSystemUnlocked(state, 'network')
  const workerFlags = networkAttention(state)

  return (
    <section className="tab-panel systems-tab systems-dashboard" aria-label="Systems">
      <header className="systems-dash-head">
        <h2>Systems</h2>
      </header>

      {workersUnlocked ? (
        <button
          type="button"
          className="systems-workers-card"
          data-guide="systems-workers"
          aria-label={attentionAria('Worker Drones', workerFlags)}
          onClick={() => onManage('network')}
        >
          <div className="systems-workers-title">
            <strong>Worker Drones</strong>
            <span className="systems-card-signals">
              <span className="systems-workers-total">{formatCompact(workers.total)}</span>
              <AttentionPips {...workerFlags} layout="inline" />
            </span>
          </div>
          <p className="systems-workers-line">
            {formatCompact(workers.assigned)} assigned · {formatCompact(workers.idle)} idle · capacity {formatCompact(droneCap(state))}
          </p>
        </button>
      ) : null}

      <div className="systems-dash-grid">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className="systems-dash-card"
            data-guide={`systems-${card.id}`}
            aria-label={attentionAria(card.name, card)}
            onClick={() => onManage(card.id)}
          >
            <span className="systems-card-title">
              <strong>{card.name}</strong>
              <AttentionPips spend={card.spend} fresh={card.fresh} layout="inline" />
            </span>
            {card.status.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </button>
        ))}
      </div>
    </section>
  )
}
