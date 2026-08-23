import { useState } from 'react'
import type { GameState } from '../game/types'
import {
  MATTER_SHOP_CATEGORIES,
  canBuyMatterShop,
  getFrame,
  getModule,
  matterShopEffectBlurb,
  matterShopItemsIn,
  moduleMasteryRank,
  shopRank,
} from '../game/catalog'
import { canPrestige, prestigeGainFor } from '../game/actions'
import { yardPendingSummary } from '../game/yard'
import { isSystemUnlocked } from '../game/progression'
import { rebuildConsequenceLists } from '../game/playerGuidance'
import { ConsequencePanel } from './ConsequencePanel'
import { cycleBestWave, rebuildCycle, rebuildWaveNeed, workshopInvestment } from '../game/rebuild'
import { formatCompact } from '../game/format'
import { computeShipStats, RESOURCE_LABELS } from '../game/state'
import { coreDps, coreShieldOutput, rebuildPowerPreview } from '../game/uiReadout'
import { prefersReducedMotion } from '../hooks/usePrefersReducedMotion'

interface RebuildHangarProps {
  state: GameState
  onConfirm: (hangar: { frameId: string; modules: string[] }) => void
  onClose: () => void
  onBuyMatter?: (itemId: string) => void
}

export function MatterShopSheet({
  state,
  onClose,
  onBuyMatter,
}: {
  state: GameState
  onClose: () => void
  onBuyMatter?: (itemId: string) => void
}) {
  const matter = state.resources.prestigeMatter
  const label = RESOURCE_LABELS.prestigeMatter
  return (
    <div className="sheet-overlay" role="dialog" aria-labelledby="matter-shop-title">
      <div className="sheet-card">
        <header className="modal-header">
          <h3 id="matter-shop-title">Matter upgrades</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <p>
          {formatCompact(matter, 1)} {label}
        </p>
        <p className="muted">Permanent ranks by category. There is no separate Slag screen.</p>
        {MATTER_SHOP_CATEGORIES.map((cat) => (
          <div key={cat.id} className="matter-shop-cat">
            <h4 className="foundry-heading">{cat.name}</h4>
            {matterShopItemsIn(cat.id).map((item) => {
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
                    disabled={!onBuyMatter || !can.ok}
                    onClick={() => onBuyMatter?.(item.id)}
                  >
                    {can.ok ? `${can.cost} ${label}` : can.reason}
                  </button>
                </article>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export function RebuildHangar({ state, onConfirm, onClose, onBuyMatter }: RebuildHangarProps) {
  const ready = canPrestige(state)
  const need = rebuildWaveNeed(state)
  const cycle = rebuildCycle(state)
  const gain = prestigeGainFor(state)
  const lists = rebuildConsequenceLists(state)
  const shopAvailable = isSystemUnlocked(state, 'slag') || (state.resources.prestigeMatter ?? 0) > 0
  const [shopOpen, setShopOpen] = useState(false)
  const [collapsing, setCollapsing] = useState(false)
  const label = RESOURCE_LABELS.prestigeMatter
  const hive = computeShipStats(state)
  const preview = rebuildPowerPreview(state, gain)
  const frame = getFrame(state.shipyard.frameId)

  function confirm() {
    if (!ready || collapsing) return
    const hangar = { frameId: state.shipyard.frameId, modules: [...state.shipyard.modules] }
    if (prefersReducedMotion()) {
      onConfirm(hangar)
      return
    }
    setCollapsing(true)
    window.setTimeout(() => onConfirm(hangar), 720)
  }

  return (
    <div className="modal-backdrop hangar-backdrop" role="dialog" aria-labelledby="rebuild-title">
      <div className={`hangar-sheet${collapsing ? ' is-collapsing' : ''}`}>
        <header className="modal-header">
          <div>
            <h3 id="rebuild-title">Rebuild</h3>
            <p className="muted">Should this cycle reset now?</p>
          </div>
          <button type="button" onClick={onClose} disabled={collapsing}>
            Close
          </button>
        </header>

        <div className="hangar-body">
          <section className="hangar-cycle">
            <p className="combat-hud-kicker">Current cycle</p>
            <div className="stat-row dock-stats">
              <div>
                <span className="muted">Best Wave</span>
                <strong>{cycleBestWave(state) || '—'}</strong>
              </div>
              <div>
                <span className="muted">Sorties</span>
                <strong>{cycle.sorties}</strong>
              </div>
              <div>
                <span className="muted">Scrap generated</span>
                <strong>{formatCompact(cycle.scrapEarned)}</strong>
              </div>
              <div>
                <span className="muted">Workshop</span>
                <strong>{workshopInvestment(state)} ranks</strong>
              </div>
            </div>
          </section>

          <section className="hangar-hive">
            <p className="combat-hud-kicker">Current Hive</p>
            <p>
              <strong>{frame?.name ?? 'Hive'}</strong>
              {' · '}
              DPS {formatCompact(hive.damage)} · Hull {formatCompact(hive.hullMax)} · Sh{' '}
              {formatCompact(hive.shieldMax)}
            </p>
            <ul className="dock-core-list">
              {state.shipyard.modules.map((id) => {
                const def = getModule(id)
                const mastery = moduleMasteryRank(state, id)
                const dps = coreDps(state, id)
                const shield = coreShieldOutput(state, id)
                const stat =
                  dps > 0
                    ? `${formatCompact(dps)} DPS`
                    : shield > 0
                      ? `${formatCompact(shield)} Shield`
                      : def?.role ?? ''
                return (
                  <li key={id}>
                    {def?.name ?? id}
                    {mastery > 0 ? ` · M${mastery}` : ''}
                    {stat ? ` · ${stat}` : ''}
                  </li>
                )
              })}
            </ul>
          </section>

          <ConsequencePanel lists={lists} />

          <section>
            <p className="combat-hud-kicker">You gain</p>
            <p className="rebuild-gain">+{gain} {label.toUpperCase()}</p>
            <p className="muted">
              Damage ×{preview.now.damage.toFixed(2)} → ×{preview.afterBank.damage.toFixed(2)}
              {' · '}
              Defense ×{preview.now.defense.toFixed(2)} → ×{preview.afterBank.defense.toFixed(2)}
              {' · '}
              Industry ×{preview.now.industry.toFixed(2)} → ×{preview.afterBank.industry.toFixed(2)}
            </p>
            <p className="muted">
              Workshop Weapon Power rank 1 is ×{preview.workshopRank1.toFixed(2)}. Matter Edge rank 1 is ×
              {preview.edgeRank1.toFixed(2)}
              {preview.edgeBeatsWorkshop ? ' — stronger than one Workshop rank, and it survives Rebuild.' : '.'}
            </p>
          </section>

          {isSystemUnlocked(state, 'yard') ? (
            <p className="muted">Construction: {yardPendingSummary(state)}.</p>
          ) : null}

          {shopAvailable ? (
            <p className="assign-row">
              <button type="button" onClick={() => setShopOpen(true)}>
                Matter upgrades
              </button>
            </p>
          ) : null}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={collapsing}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            data-guide="hangar-confirm"
            disabled={!ready || collapsing}
            onClick={confirm}
          >
            {ready ? `Rebuild · +${gain} Matter` : `Reach Wave ${need} this cycle`}
          </button>
        </div>
      </div>

      {shopOpen ? (
        <MatterShopSheet state={state} onClose={() => setShopOpen(false)} onBuyMatter={onBuyMatter} />
      ) : null}
    </div>
  )
}
