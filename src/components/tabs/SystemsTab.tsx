import type { GameState, TabId } from '../../game/types'
import { attentionAria } from '../../game/hubAttention'
import { systemsHubCards } from '../../game/systemsHub'
import { AttentionPips } from '../AttentionPips'

interface SystemsTabProps {
  state: GameState
  onManage: (tab: Extract<TabId, 'foundry' | 'network' | 'furnace'>) => void
}

export function SystemsTab({ state, onManage }: SystemsTabProps) {
  const cards = systemsHubCards(state)

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <h2>Systems</h2>
        <p>Industrial Hive systems. Status stays here; Manage opens the controls.</p>
      </header>
      <div className="panel-scroll">
        {cards.length === 0 ? (
          <p className="muted empty-state">No industrial systems online yet.</p>
        ) : (
          cards.map((card) => (
            <article
              key={card.id}
              className={card.spend ? 'network-row is-affordable' : 'network-row is-ready'}
              data-focus={`system-${card.id}`}
            >
              <div className="network-row-main">
                <strong>
                  {card.name}
                  <AttentionPips spend={card.spend} fresh={card.fresh} layout="inline" />
                </strong>
                <span className="muted">{card.status[0] ?? 'Open'}</span>
              </div>
              {card.status.slice(1).map((line) => (
                <p key={line} className="network-row-stats">
                  {line}
                </p>
              ))}
              <button
                type="button"
                className="primary"
                data-guide={`system-${card.id}`}
                aria-label={attentionAria(`Manage ${card.name}`, card)}
                onClick={() => onManage(card.id)}
              >
                Manage
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
