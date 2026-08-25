import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { systemsHubCards, type SystemsHubId } from '../../game/systemsHub'
import { workerAllocationSummary } from '../../game/workers'
import { formatCompact } from '../../game/format'
import { droneCap } from '../../game/catalog'

type Props = {
  state: GameState
  onManage: (id: SystemsHubId) => void
}

export function SystemsTab({ state, onManage }: Props) {
  const cards = systemsHubCards(state)
  const workers = workerAllocationSummary(state)

  return (
    <section className="tab-panel systems-tab systems-dashboard" aria-label="Systems">
      <header className="systems-dash-head">
        <h2>Systems</h2>
      </header>

      <button
        type="button"
        className="systems-workers-card"
        data-guide="systems-workers"
        onClick={() => onManage('network')}
      >
        <div className="systems-workers-title">
          <strong>Worker Drones</strong>
          <span className="systems-workers-total">{formatCompact(workers.total)}</span>
        </div>
        <p className="systems-workers-line">
          {formatCompact(workers.assigned)} assigned · {formatCompact(workers.idle)} idle · capacity {formatCompact(droneCap(state))}
        </p>
      </button>

      <div className="systems-dash-grid">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className="systems-dash-card"
            data-guide={`systems-${card.id}`}
            onClick={() => onManage(card.id)}
          >
            <strong>{card.name}</strong>
            {card.status.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </button>
        ))}
      </div>

      {isSystemUnlocked(state, 'foundry') &&
      state.foundry.fabrication.some((slot) => slot.complete && slot.kind !== 'facility') ? (
        <p className="panel-note">A Fabrication job is ready. Open Foundry to claim it while Docked.</p>
      ) : null}
    </section>
  )
}
