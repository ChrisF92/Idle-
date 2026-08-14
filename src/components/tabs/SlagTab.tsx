import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  MATTER_SHOP,
  canBuyMatterShop,
  matterShopEffectBlurb,
  shopRank,
} from '../../game/catalog'
import { formatCompact } from '../../game/format'
import { RESOURCE_LABELS } from '../../game/state'

interface SlagTabProps {
  state: GameState
  onBack: () => void
  onBuy: (itemId: string) => void
}

export function SlagTab({ state, onBack, onBuy }: SlagTabProps) {
  const open = isSystemUnlocked(state, 'slag')
  const matter = state.resources.prestigeMatter
  const label = RESOURCE_LABELS.prestigeMatter

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>Slag Bank</h2>
        <p>
          {open
            ? `${formatCompact(matter, 1)} ${label}`
            : 'Rebuild once to open the Slag Bank.'}
        </p>
      </header>
      {!open ? (
        <p className="muted">
          Unspent {label} still banks a small damage and production bonus. Ranks beat banking.
        </p>
      ) : (
        <div className="panel-scroll">
          <p className="muted">
            Unspent {label} still banks a small damage and production bonus. Ranks beat banking.
          </p>
          <h3 className="foundry-heading">Ranks</h3>
          {MATTER_SHOP.map((item) => {
            const rank = shopRank(state.prestige.matterShop, item.id)
            const can = canBuyMatterShop(state, item.id)
            return (
              <article key={item.id} className="network-row">
                <div className="network-row-main">
                  <strong>{item.name}</strong>
                  <span className="muted">Lv {rank}</span>
                </div>
                <p className="network-row-stats">{item.description}</p>
                <p className="muted">{matterShopEffectBlurb(item, rank)}</p>
                <button
                  type="button"
                  className="primary"
                  disabled={!can.ok}
                  onClick={() => onBuy(item.id)}
                >
                  {can.ok ? `${can.cost} ${label}` : can.reason}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
