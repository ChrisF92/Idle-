import { useState } from 'react'
import type { GameState, RunUpgradeCategory, RunUpgradeId } from '../game/types'
import { formatCompact } from '../game/format'
import {
  canUnlockNextGeneric,
  effectiveUpgradeLevel,
  maxAffordableRunPurchases,
  maxAffordableWorkshopPurchases,
  nextUnlockDef,
  nextUnlockCost,
  runPurchasedLevel,
  runUpgradeBulkCost,
  runUpgradeEffectLine,
  runUpgradePreview,
  shopEconomyRoi,
  shopTimeToAfford,
  sortieCap,
  unlockedBuyModes,
  visibleRunUpgrades,
  workshopBulkCost,
  workshopCap,
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
  onUnlock?: (category: RunUpgradeCategory) => void
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
  onUnlock,
}: UpgradeGridProps) {
  const rows = visibleRunUpgrades(state, category)
  const [infoId, setInfoId] = useState<string | null>(null)
  const next = kind === 'workshop' ? nextUnlockDef(state, category) : null
  const nextCost = kind === 'workshop' ? nextUnlockCost(state, category) : null
  const unlockCheck = kind === 'workshop' ? canUnlockNextGeneric(state, category) : null
  if (rows.length === 0 && !next) {
    return <p className="muted">No upgrades in this category yet.</p>
  }
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
            : workshopBulkCost(start, count, def.id)
        const bank = kind === 'run' ? state.resources.salvage : state.resources.scrap
        const currency = kind === 'run' ? 'Salvage' : 'Scrap'
        const maxed = kind === 'workshop' ? start >= workshopCap(def.id) : run >= sortieCap(def.id)
        const affordable = bank >= cost && !maxed && cost > 0
        const preview = runUpgradePreview(state, def.id, kind === 'workshop' ? 'workshop' : 'run')
        const onboarding =
          def.id === 'weapon-power'
            ? kind === 'workshop'
              ? 'onboarding.workshop.weapon-power'
              : 'onboarding.salvage.weapon-power'
            : undefined
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
            data-onboarding={onboarding}
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
                  <>Workshop Lv{start}{start > 0 ? ` → ${start + count}` : ' · Lv0'}</>
                ) : (
                  <>
                    Workshop {start} · Sortie +{run} · Effective {level}
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

      {next && nextCost != null ? (
        <article className="upgrade-tile next-upgrade-card" data-guide="workshop-next-unlock">
          <button
            type="button"
            className="upgrade-tile-buy"
            disabled={!onUnlock || !unlockCheck?.ok}
            onClick={() => onUnlock?.(category)}
            aria-label={`Permanent unlock ${next.name} for ${formatCompact(nextCost)} Scrap`}
          >
            <span className="upgrade-tile-top">
              <strong>NEXT UPGRADE</strong>
              <span className="unlock-chip">PERMANENT UNLOCK</span>
            </span>
            <span className="upgrade-tile-level">{next.name} · starts Lv0</span>
            <span className="upgrade-tile-preview">{next.blurb}</span>
            <span className={`upgrade-tile-cost${unlockCheck?.ok ? ' is-ok' : ' is-short'}`}>
              {formatCompact(nextCost)} Scrap
              {unlockCheck && !unlockCheck.ok && !/^Need \d/.test(unlockCheck.reason)
                ? ` · ${unlockCheck.reason}`
                : ''}
            </span>
          </button>
        </article>
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
            Workshop {workshopLevel(state, info.id)} / {workshopCap(info.id)}
            {kind === 'run'
              ? ` · Sortie +${runPurchasedLevel(state, info.id)} / ${sortieCap(info.id)} · Effective ${effectiveUpgradeLevel(state, info.id)}`
              : ''}
          </p>
          {kind === 'workshop' ? (
            <p className="muted">
              Workshop levels last this Rebuild cycle and start every Sortie. Permanent unlocks
              survive Rebuild but grant no free levels.
            </p>
          ) : (
            <p className="muted">
              Workshop {workshopLevel(state, info.id)}
              {runPurchasedLevel(state, info.id) > 0
                ? ` · Sortie +${runPurchasedLevel(state, info.id)}`
                : ''}{' '}
              · Effective {effectiveUpgradeLevel(state, info.id)}
            </p>
          )}
          <p className="muted">
            {runUpgradePreview(state, info.id).current} → {runUpgradePreview(state, info.id).next}
          </p>
          <p className="muted">
            {kind === 'workshop'
              ? 'Cycle power. Resets on Rebuild.'
              : 'Temporary this Sortie. Cost is Salvage and ignores Workshop level.'}
          </p>
          {shopTimeToAfford(state, kind === 'run' ? runUpgradeBulkCost(state, info.id, 1) : workshopBulkCost(workshopLevel(state, info.id), 1, info.id), kind === 'run' ? state.resources.salvage : state.resources.scrap) ? (
            <p className="muted">
              {shopTimeToAfford(
                state,
                kind === 'run' ? runUpgradeBulkCost(state, info.id, 1) : workshopBulkCost(workshopLevel(state, info.id), 1, info.id),
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
