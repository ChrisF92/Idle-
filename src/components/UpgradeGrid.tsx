import { useState } from 'react'
import type { GameState, RunUpgradeCategory, RunUpgradeId } from '../game/types'
import { formatCompact } from '../game/format'
import {
  effectiveUpgradeLevel,
  maxAffordableRunPurchases,
  maxAffordableWorkshopPurchases,
  RUN_UPGRADE_CAP,
  runPurchasedLevel,
  runUpgradeBulkCost,
  runUpgradeEffectLine,
  runUpgradePreview,
  shopEconomyRoi,
  shopTimeToAfford,
  unlockedBuyModes,
  visibleRunUpgrades,
  workshopBulkCost,
  workshopLevel,
  type BuyMode,
} from '../game/workshop'
import { BottomSheet } from '../ui/primitives'

export type UpgradeGridKind = 'run' | 'workshop'

interface UpgradeGridProps {
  state: GameState
  category: RunUpgradeCategory
  kind: UpgradeGridKind
  buyMode: BuyMode
  onBuy?: (id: RunUpgradeId, count: number) => void
}

function purchaseCount(state: GameState, id: RunUpgradeId, kind: UpgradeGridKind, mode: BuyMode): number {
  if (mode === 1) return 1
  if (mode === 10) return 10
  return kind === 'run' ? maxAffordableRunPurchases(state, id) : maxAffordableWorkshopPurchases(state, id)
}

export function BuyModeRow({
  state,
  value,
  onChange,
}: {
  state: GameState
  value: BuyMode
  onChange: (mode: BuyMode) => void
}) {
  const modes = unlockedBuyModes(state)
  if (modes.length <= 1) return null
  return (
    <div className="buy-mode-row" role="group" aria-label="Buy amount">
      <span className="muted">Buy</span>
      {modes.map((mode) => (
        <button
          key={String(mode)}
          type="button"
          className={value === mode ? 'sheet-tab active' : 'sheet-tab'}
          onClick={() => onChange(mode)}
        >
          {mode === 'max' ? 'MAX' : `×${mode}`}
        </button>
      ))}
    </div>
  )
}

export function UpgradeGrid({
  state,
  category,
  kind,
  buyMode,
  onBuy,
}: UpgradeGridProps) {
  const best = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0, state.combat.wave ?? 1)
  const rows = visibleRunUpgrades(best, category)
  const [infoId, setInfoId] = useState<string | null>(null)
  if (rows.length === 0) {
    return <p className="muted">More upgrades open as Best Wave climbs.</p>
  }
  const info = rows.find((row) => row.id === infoId)

  return (
    <div className="upgrade-grid">
      {rows.length > 0 ? (
        <>
          {rows.map((def) => {
            const start = workshopLevel(state, def.id)
            const run = runPurchasedLevel(state, def.id)
            const level = effectiveUpgradeLevel(state, def.id)
            const count = Math.max(1, purchaseCount(state, def.id, kind, buyMode))
            const cost =
              kind === 'run'
                ? runUpgradeBulkCost(state, def.id, count)
                : workshopBulkCost(start, count)
            const bank = kind === 'run' ? state.resources.salvage : state.resources.scrap
            const currency = kind === 'run' ? 'Salvage' : 'Scrap'
            const affordable = bank >= cost && level < RUN_UPGRADE_CAP && cost > 0
            const maxed = level >= RUN_UPGRADE_CAP
            const preview = runUpgradePreview(state, def.id, kind)
            const guide =
              def.id === 'weapon-power'
                ? kind === 'workshop'
                  ? 'workshop-weapon-power'
                  : 'run-upgrade-weapon-power'
                : def.id === 'hull' && kind === 'run'
                  ? 'run-upgrade-hull'
                  : undefined
            return (
              <article
                key={def.id}
                className={`upgrade-tile${affordable ? ' is-affordable' : maxed ? ' is-maxed' : ' is-short'}`}
                data-guide={guide}
              >
                <button
                  type="button"
                  className="upgrade-tile-buy"
                  disabled={!onBuy || maxed}
                  onClick={() => onBuy?.(def.id, count)}
                  aria-label={`${def.name}. ${affordable ? `Buy ${count} for ${formatCompact(cost)} ${currency}` : maxed ? 'Maxed' : `Need ${formatCompact(cost)} ${currency}`}`}
                >
                  <span className="upgrade-tile-top">
                    <strong>{def.name}</strong>
                  </span>
                  <span className="upgrade-tile-level">
                    {kind === 'workshop' ? (
                      <>START Lv{start} → {start + count}</>
                    ) : (
                      <>
                        Lv{level}
                        {run > 0 ? ` · +${run}` : ''}
                      </>
                    )}
                  </span>
                  <span className="upgrade-tile-preview">
                    {preview.current} → {preview.next}
                  </span>
                  <span className={`upgrade-tile-cost${affordable ? ' is-ok' : maxed ? '' : ' is-short'}`}>
                    {maxed ? 'Maxed' : `${formatCompact(cost)} ${currency}`}
                  </span>
                </button>
                <button
                  type="button"
                  className="upgrade-tile-info"
                  aria-label={`${def.name} details`}
                  onClick={() => setInfoId(def.id)}
                >
                  i
                </button>
              </article>
            )
          })}
        </>
      ) : null}

      {info ? (
        <BottomSheet
          open
          title={info.name}
          onClose={() => setInfoId(null)}
          size="standard"
          overlayId={`upgrade-info-${info.id}`}
        >
          <p>{runUpgradeEffectLine(info.id)}</p>
          <p>
            Level {kind === 'workshop' ? workshopLevel(state, info.id) : effectiveUpgradeLevel(state, info.id)} /{' '}
            {RUN_UPGRADE_CAP}
          </p>
          {kind === 'workshop' ? (
            <p className="muted">
              Workshop Lv{workshopLevel(state, info.id)} means every Sortie begins with that many
              effective levels. The temporary Sortie purchase-cost ladder still begins from its
              base cost.
            </p>
          ) : (
            <p className="muted">
              Workshop Lv{workshopLevel(state, info.id)}
              {runPurchasedLevel(state, info.id) > 0
                ? ` · Sortie +${runPurchasedLevel(state, info.id)}`
                : ''}{' '}
              · Effective Lv{effectiveUpgradeLevel(state, info.id)}
            </p>
          )}
          <p className="muted">
            {runUpgradePreview(state, info.id, kind).current} → {runUpgradePreview(state, info.id, kind).next}
          </p>
          <p className="muted">
            {kind === 'workshop'
              ? 'Permanent this cycle. Resets on Rebuild.'
              : 'Temporary this Sortie. Cost is Salvage.'}
          </p>
          {shopTimeToAfford(state, kind === 'run' ? runUpgradeBulkCost(state, info.id, 1) : workshopBulkCost(workshopLevel(state, info.id), 1), kind === 'run' ? state.resources.salvage : state.resources.scrap) ? (
            <p className="muted">
              {shopTimeToAfford(
                state,
                kind === 'run' ? runUpgradeBulkCost(state, info.id, 1) : workshopBulkCost(workshopLevel(state, info.id), 1),
                kind === 'run' ? state.resources.salvage : state.resources.scrap,
              )}
            </p>
          ) : null}
          {shopEconomyRoi(state, info.id) ? <p className="muted">{shopEconomyRoi(state, info.id)}</p> : null}
        </BottomSheet>
      ) : null}
    </div>
  )
}
