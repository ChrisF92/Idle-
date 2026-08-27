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
import {
  canRebuild,
  cycleBestWave,
  cycleNormalSorties,
  matterGainBreakdown,
  matterGainFor,
  rebuildCycle,
  rebuildIneligibleReason,
  REBUILD_MIN_WAVE,
} from '../game/rebuild'
import { isSystemUnlocked } from '../game/progression'
import { rebuildConsequenceLists } from '../game/playerGuidance'
import { ConsequencePanel } from './ConsequencePanel'
import { formatCompact } from '../game/format'
import { computeShipStats, RESOURCE_LABELS } from '../game/state'
import { coreDps, coreShieldOutput } from '../game/uiReadout'
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
      <div className="sheet-card matter-shop-sheet">
        <header className="modal-header">
          <h3 id="matter-shop-title">Matter shop</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <p data-onboarding="onboarding.rebuild.matter">
          {formatCompact(matter, 1)} {label}
        </p>
        <p className="muted">Unspent Matter has no power. Only purchased ranks do.</p>
        {MATTER_SHOP_CATEGORIES.map((cat) => (
          <div key={cat.id} className="matter-shop-cat">
            <h4 className="foundry-heading">{cat.name.toUpperCase()}</h4>
            {matterShopItemsIn(cat.id).map((item) => {
              const rank = shopRank(state.prestige.matterShop, item.id)
              const can = canBuyMatterShop(state, item.id)
              return (
                <article key={item.id} className="network-row matter-node-card">
                  <div className="network-row-main">
                    <strong>{item.name}</strong>
                    <span className="muted">
                      {rank}/{item.maxRank}
                    </span>
                  </div>
                  <p className="network-row-stats">{item.description}</p>
                  <p className="muted">{matterShopEffectBlurb(item, rank)}</p>
                  {item.requiresId && rank < 1 ? (
                    <p className="muted">Requires {item.requiresId.replace('time-compression-', 'Time Compression ')}</p>
                  ) : null}
                  <button
                    type="button"
                    className="primary matter-buy-btn"
                    disabled={!onBuyMatter || !can.ok}
                    onClick={() => onBuyMatter?.(item.id)}
                  >
                    {rank >= item.maxRank ? 'Max rank' : can.ok ? `${can.cost} ${label}` : can.reason}
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
  const ready = canRebuild(state)
  const need = REBUILD_MIN_WAVE
  const cycle = rebuildCycle(state)
  const breakdown = matterGainBreakdown(state)
  const gain = matterGainFor(state)
  const lists = rebuildConsequenceLists(state)
  const shopAvailable = isSystemUnlocked(state, 'slag') || (state.resources.prestigeMatter ?? 0) > 0
  const [shopOpen, setShopOpen] = useState(false)
  const [collapsing, setCollapsing] = useState(false)
  const hive = computeShipStats(state)
  const frame = getFrame(state.shipyard.frameId)
  const blocked = rebuildIneligibleReason(state)

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
            <p className="muted">Reset this cycle for permanent Matter.</p>
          </div>
          <button type="button" onClick={onClose} disabled={collapsing}>
            Close
          </button>
        </header>

        <div className="hangar-body">
          <section className="hangar-cycle">
            <p className="combat-hud-kicker">PROJECTED MATTER</p>
            <div className="stat-row dock-stats matter-breakdown" data-onboarding="onboarding.rebuild.preview">
              <div>
                <span className="muted">Cycle Best W{breakdown.cycleBestWave || '—'}</span>
                <strong>+{breakdown.waveScore}</strong>
              </div>
              <div>
                <span className="muted">Scrap generated</span>
                <strong>+{breakdown.scrapScore}</strong>
              </div>
              <div>
                <span className="muted">Matter gained</span>
                <strong>{breakdown.total}</strong>
              </div>
            </div>
            <p className="muted">
              Cycle Best W{cycleBestWave(state) || 0} · {cycleNormalSorties(state)} normal Sorties ·{' '}
              {formatCompact(cycle.scrapGenerated)} Scrap generated
            </p>
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

          {!ready && blocked ? <p className="muted">{blocked}</p> : null}

          {isSystemUnlocked(state, 'foundry') ? (
            <p className="muted">Foundry infrastructure and Worker jobs continue through Rebuild.</p>
          ) : null}

          {shopAvailable ? (
            <p className="assign-row">
              <button type="button" onClick={() => setShopOpen(true)}>
                Matter shop
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
            {ready ? `Rebuild · +${gain} Matter` : `Reach Wave ${need}`}
          </button>
        </div>
      </div>

      {shopOpen ? (
        <MatterShopSheet state={state} onClose={() => setShopOpen(false)} onBuyMatter={onBuyMatter} />
      ) : null}
    </div>
  )
}
