import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { systemsHubCards, type SystemsHubId } from '../../game/systemsHub'
import { workerAllocationSummary } from '../../game/workers'
import { formatCompact } from '../../game/format'

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
        <p className="panel-note">Industrial status. Open a card for the full station.</p>
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
          {formatCompact(workers.total)} total · {formatCompact(workers.assigned)} assigned ·{' '}
          {formatCompact(workers.idle)} idle
        </p>
        <p className="systems-workers-split">
          Foundry {formatCompact(workers.foundry)} · Research {formatCompact(workers.research)} · Fabrication{' '}
          {formatCompact(workers.fabrication)}
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
            <span>{card.status[0] ?? 'Idle'}</span>
            {card.status.length > 1 ? <em>{card.status.slice(1).join(' · ')}</em> : null}
          </button>
        ))}
      </div>

      {isSystemUnlocked(state, 'foundry') &&
      state.foundry.slots.filter((slot) => slot.recipeId).length > 1 ? (
        <p className="panel-note">
          Foundry queue: {state.foundry.slots.filter((slot) => slot.recipeId).length - 1} waiting
          behind the current job.
        </p>
      ) : null}
    </section>
  )
}
