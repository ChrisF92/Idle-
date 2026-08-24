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
import {
  CORE_RUN_LEVEL_CAP,
  corePrimaryOutput,
  coreRunBulkCost,
  coreRunLevel,
  coreStartingLevelAtSlot,
  equippedCoreSlots,
  maxAffordableCoreRunPurchases,
} from '../game/coreProgression'
import { getModule, moduleMasteryRank } from '../game/catalog'
import { masteryMilestoneEffect, nextMasteryMilestone } from '../game/coreProgression'
import { BottomSheet } from '../ui/primitives'

export type UpgradeGridKind = 'run' | 'workshop'

interface UpgradeGridProps {
  state: GameState
  category: RunUpgradeCategory
  kind: UpgradeGridKind
  buyMode: BuyMode
  coresOnly?: boolean
  onBuy?: (id: RunUpgradeId, count: number) => void
  onBuyCore?: (slot: number, count: number) => void
}

function purchaseCount(state: GameState, id: RunUpgradeId, kind: UpgradeGridKind, mode: BuyMode): number {
  if (mode === 1) return 1
  if (mode === 10) return 10
  return kind === 'run' ? maxAffordableRunPurchases(state, id) : maxAffordableWorkshopPurchases(state, id)
}

function corePurchaseCount(state: GameState, slot: number, mode: BuyMode): number {
  if (mode === 1) return 1
  if (mode === 10) return 10
  return maxAffordableCoreRunPurchases(state, slot)
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
  coresOnly = false,
  onBuy,
  onBuyCore,
}: UpgradeGridProps) {
  const best = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0, state.combat.wave ?? 1)
  const rows = coresOnly ? [] : visibleRunUpgrades(best, category)
  const cores = kind === 'run' && coresOnly ? equippedCoreSlots(state) : []
  const [infoId, setInfoId] = useState<string | null>(null)
  const [coreInfo, setCoreInfo] = useState<number | null>(null)
  if (rows.length === 0 && cores.length === 0) {
    return <p className="muted">More upgrades open as Best Wave climbs.</p>
  }
  const info = rows.find((row) => row.id === infoId)
  const coreSlot = coreInfo != null ? cores.find((row) => row.slot === coreInfo) : null

  return (
    <div className="upgrade-grid">
      {cores.length > 0 ? (
        <>
          <p className="shop-kicker">CORES</p>
          {cores.map((row) => {
            const def = getModule(row.moduleId)
            if (!def) return null
            const level = coreRunLevel(state, row.slot)
            const startingLevel = coreStartingLevelAtSlot(state, row.slot)
            const effectiveLevel = startingLevel + level
            const count = Math.max(1, corePurchaseCount(state, row.slot, buyMode))
            const cost = coreRunBulkCost(state, row.slot, count)
            const bank = state.resources.salvage ?? 0
            const affordable = bank >= cost && effectiveLevel < CORE_RUN_LEVEL_CAP && cost > 0
            const maxed = effectiveLevel >= CORE_RUN_LEVEL_CAP
            const out = corePrimaryOutput(state, row.slot)
            const guide =
              row.moduleId === 'pulse-cannon' && row.slot === state.shipyard.modules.indexOf('pulse-cannon')
                ? 'core-run-pulse-cannon'
                : `core-run-${row.slot}`
            return (
              <article
                key={`core-${row.slot}`}
                className={`upgrade-tile core-tile${affordable ? ' is-affordable' : maxed ? ' is-maxed' : ' is-short'}`}
                data-guide={guide}
              >
                <button
                  type="button"
                  className="upgrade-tile-buy"
                  disabled={!onBuyCore || maxed}
                  onClick={() => onBuyCore?.(row.slot, count)}
                  aria-label={`${def.name}. ${affordable ? `Buy ${count} Run Levels for ${formatCompact(cost)} Salvage` : maxed ? 'Maxed' : `Need ${formatCompact(cost)} Salvage`}`}
                >
                  <span className="upgrade-tile-top">
                    <strong>{def.name}</strong>
                  </span>
                  <span className="upgrade-tile-level">
                    {startingLevel > 0 ? `Lv${startingLevel} + Run ${level}` : `Run Lv${level}`}
                  </span>
                  <span className="upgrade-tile-preview">
                    {out
                      ? `${formatCompact(out.current)} → ${formatCompact(out.next)} ${out.label}`
                      : 'Run Level'}
                  </span>
                  <span className={`upgrade-tile-cost${affordable ? ' is-ok' : maxed ? '' : ' is-short'}`}>
                    {maxed ? 'Maxed' : `${formatCompact(cost)} Salvage`}
                  </span>
                </button>
                <button
                  type="button"
                  className="upgrade-tile-info"
                  aria-label={`${def.name} details`}
                  onClick={() => setCoreInfo(row.slot)}
                >
                  i
                </button>
              </article>
            )
          })}
        </>
      ) : null}

      {rows.length > 0 ? (
        <>
          {kind === 'run' && cores.length > 0 ? <p className="shop-kicker">GLOBAL</p> : null}
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
            const preview = runUpgradePreview(state, def.id)
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
            {runUpgradePreview(state, info.id).current} → {runUpgradePreview(state, info.id).next}
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

      {coreSlot ? (
        <BottomSheet
          open
          title={getModule(coreSlot.moduleId)?.name ?? 'Core'}
          onClose={() => setCoreInfo(null)}
          size="standard"
          overlayId={`core-info-${coreSlot.slot}`}
        >
          <p>
            Core Level {coreStartingLevelAtSlot(state, coreSlot.slot)} + Run Level{' '}
            {coreRunLevel(state, coreSlot.slot)} / {CORE_RUN_LEVEL_CAP}
          </p>
          <p className="muted">
            Mastery {moduleMasteryRank(state, coreSlot.moduleId)} · Run Lv
            {coreRunLevel(state, coreSlot.slot)}
          </p>
          <p>Run Levels use Salvage and last only for this Sortie.</p>
          <p className="muted">Mastery is earned while the Core is equipped and survives Rebuild.</p>
          {(() => {
            const next = nextMasteryMilestone(coreSlot.moduleId, moduleMasteryRank(state, coreSlot.moduleId))
            return next ? (
              <p className="muted">
                Next: M{next.level} · {next.name} — {masteryMilestoneEffect(next)}
              </p>
            ) : null
          })()}
          <p className="muted">Loadout and Relics stay locked until Dock.</p>
        </BottomSheet>
      ) : null}
    </div>
  )
}
