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
  runUpgradePreview,
  unlockedBuyModes,
  visibleRunUpgrades,
  workshopBulkCost,
  workshopLevel,
  type BuyMode,
} from '../game/workshop'

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

export function UpgradeGrid({ state, category, kind, buyMode, onBuy }: UpgradeGridProps) {
  const best = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0, state.combat.wave ?? 1)
  const rows = visibleRunUpgrades(best, category)
  const [infoId, setInfoId] = useState<string | null>(null)
  if (rows.length === 0) return <p className="muted">More upgrades open as Best Wave climbs.</p>
  const info = rows.find((row) => row.id === infoId)

  return (
    <div className="upgrade-grid">
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
        const preview = runUpgradePreview(state, def.id)
        const guide = kind === 'run' && def.id === 'weapon-power' ? 'run-upgrade-weapon-power' : undefined
        return (
          <article
            key={def.id}
            className={`upgrade-tile${affordable ? ' is-affordable' : ''}`}
            data-guide={guide}
          >
            <button
              type="button"
              className="upgrade-tile-buy"
              disabled={!onBuy || level >= RUN_UPGRADE_CAP}
              onClick={() => onBuy?.(def.id, count)}
              aria-label={`${def.name}. ${affordable ? `Buy ${count} for ${formatCompact(cost)} ${currency}` : `Need ${formatCompact(cost)} ${currency}`}`}
            >
              <span className="upgrade-tile-top">
                <strong>{def.name}</strong>
                <span className={`upgrade-tile-cost${affordable ? '' : ' is-short'}`}>
                  {level >= RUN_UPGRADE_CAP ? 'Maxed' : formatCompact(cost)}
                </span>
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

      {info ? (
        <div
          className="upgrade-info-modal"
          role="dialog"
          aria-labelledby={`upgrade-info-${info.id}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) setInfoId(null)
          }}
        >
          <div className="upgrade-info-card">
            <header className="modal-header">
              <h3 id={`upgrade-info-${info.id}`}>{info.name}</h3>
              <button type="button" onClick={() => setInfoId(null)}>
                Close
              </button>
            </header>
            <p>{info.blurb}</p>
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
              {runUpgradePreview(state, info.id).current} → {runUpgradePreview(state, info.id).next}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
