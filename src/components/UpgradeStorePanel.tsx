import { useMemo, useState } from 'react'
import type { GameState } from '../game/types'
import { formatCompact } from '../game/format'
import {
  type BulkBuyMode,
  type UpgradeCategory,
  fittedModuleUpgradeRows,
  formatUpgradeEffect,
  listLockedUpgrades,
  listVisibleUpgrades,
  resolveBuyCount,
  upgradeCostAtRank,
  upgradeCostForRanks,
  upgradeRank,
} from '../game/expeditionUpgrades'

interface UpgradeStorePanelProps {
  state: GameState
  onBuyUpgrade: (upgradeId: string, mode: BulkBuyMode) => void
  onUpgradeModule: (moduleId: string) => void
}

const FILTERS: Array<{ id: UpgradeCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'offence', label: 'Offence' },
  { id: 'defence', label: 'Defence' },
  { id: 'economy', label: 'Economy' },
  { id: 'utility', label: 'Utility' },
  { id: 'modules', label: 'Modules' },
]

const BULK: Array<{ id: BulkBuyMode; label: string }> = [
  { id: 1, label: '×1' },
  { id: 10, label: '×10' },
  { id: 'max', label: 'MAX' },
]

export function UpgradeStorePanel({
  state,
  onBuyUpgrade,
  onUpgradeModule,
}: UpgradeStorePanelProps) {
  const [filter, setFilter] = useState<UpgradeCategory | 'all'>('all')
  const [bulk, setBulk] = useState<BulkBuyMode>(1)
  const salvage = state.resources.salvage

  const visible = useMemo(() => listVisibleUpgrades(state), [state])
  const locked = useMemo(() => listLockedUpgrades(state), [state])
  const modules = useMemo(() => fittedModuleUpgradeRows(state), [state])

  const filtered = useMemo(() => {
    if (filter === 'all') return visible
    if (filter === 'modules') return []
    return visible.filter((u) => u.category === filter)
  }, [visible, filter])

  return (
    <section className="upgrade-store" aria-label="Expedition upgrades">
      <header className="upgrade-store-header">
        <div>
          <p className="combat-hud-kicker">Salvage store</p>
          <strong>{formatCompact(salvage, 1)} Salvage</strong>
        </div>
        <div className="upgrade-bulk" role="group" aria-label="Bulk buy">
          {BULK.map((b) => (
            <button
              key={String(b.id)}
              type="button"
              className={bulk === b.id ? 'primary mode-active' : ''}
              aria-pressed={bulk === b.id}
              onClick={() => setBulk(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </header>

      <div className="upgrade-filters" role="tablist" aria-label="Upgrade categories">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={filter === f.id ? 'primary mode-active' : ''}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="upgrade-cards">
        {filter !== 'modules'
          ? filtered.map((def) => {
              const rank = upgradeRank(state.combat.upgrades, def.id)
              const capped = rank >= def.cap
              const effects = formatUpgradeEffect(def, rank)
              const buyCount = capped
                ? 0
                : resolveBuyCount(def, rank, salvage, bulk)
              const cost =
                buyCount > 0 ? upgradeCostForRanks(def, rank, buyCount) : upgradeCostAtRank(def, rank)
              const affordable = buyCount > 0
              return (
                <article
                  key={def.id}
                  className={`upgrade-card${affordable ? ' upgrade-card-affordable' : ''}${capped ? ' upgrade-card-capped' : ''}`}
                >
                  <div className="upgrade-card-top">
                    <strong>{def.name}</strong>
                    <span>
                      Rank {rank} / {def.cap}
                    </span>
                  </div>
                  <p className="muted upgrade-card-effect">
                    {effects.current}
                    {capped ? null : <> → {effects.next}</>}
                  </p>
                  <div className="upgrade-card-bottom">
                    <span>Cost: {capped ? '—' : formatCompact(cost, 0)} Salvage</span>
                    <button
                      type="button"
                      className={affordable ? 'primary' : ''}
                      disabled={!affordable}
                      onClick={() => onBuyUpgrade(def.id, bulk)}
                    >
                      {capped ? 'Capped' : buyCount > 1 ? `Buy ${buyCount}` : 'Buy'}
                    </button>
                  </div>
                </article>
              )
            })
          : null}

        {filter === 'modules' || filter === 'all'
          ? modules.map((row) => {
              const canBuy = !row.capped && salvage >= row.cost
              return (
                <article
                  key={row.moduleId}
                  className={`upgrade-card${canBuy ? ' upgrade-card-affordable' : ''}${row.capped ? ' upgrade-card-capped' : ''}`}
                >
                  <div className="upgrade-card-top">
                    <strong>{row.name}</strong>
                    <span>
                      Rank {row.rank} / {row.cap}
                    </span>
                  </div>
                  <p className="muted upgrade-card-effect">Temporary fitted-module power</p>
                  <div className="upgrade-card-bottom">
                    <span>Cost: {row.capped ? '—' : formatCompact(row.cost, 0)} Salvage</span>
                    <button
                      type="button"
                      className={canBuy ? 'primary' : ''}
                      disabled={!canBuy}
                      onClick={() => onUpgradeModule(row.moduleId)}
                    >
                      {row.capped ? 'Capped' : 'Buy 1'}
                    </button>
                  </div>
                </article>
              )
            })
          : null}
      </div>

      {locked.length > 0 && filter !== 'modules' ? (
        <details className="upgrade-locked">
          <summary>Locked upgrades ({locked.length})</summary>
          <ul>
            {locked.map((def) => (
              <li key={def.id}>
                {def.name} — career wave {def.unlockWave}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
