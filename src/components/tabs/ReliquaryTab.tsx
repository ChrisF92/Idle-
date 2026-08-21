import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  RELIC_SOCKET_LABELS,
  SHARDS,
  canUpgradeRelic,
  getShard,
  isRelicsUnlocked,
  relicSocketClass,
  relicTier,
  shardEffectBlurb,
  shardOwned,
} from '../../game/reliquary'
import { inspectShard } from '../../game/inspect'
import { InspectName } from '../InspectName'
import { CoreSheet } from '../CoreSheet'

interface ReliquaryTabProps {
  state: GameState
  onBack: () => void
  onEquipRelic: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic: (moduleId: string, socketIndex?: number) => void
  onUpgradeRelic: (relicId: string) => void
}

export function ReliquaryTab({
  state,
  onBack,
  onEquipRelic,
  onRemoveRelic,
  onUpgradeRelic,
}: ReliquaryTabProps) {
  const open = isRelicsUnlocked(state) || isSystemUnlocked(state, 'reliquary')
  const owned = SHARDS.filter((shard) => shardOwned(state, shard.id) > 0)

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>Relics</h2>
        <p>
          {open
            ? 'Install Relics into matching Core sockets while Docked. Spare copies plus Slag Ingots raise authored tiers.'
            : `Reach Wave ${ACT1_CADENCE.reliquary} to open Relic sockets on Cores.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">Relics drop from wrecks once this door is open.</p>
      ) : (
        <div className="panel-scroll">
          <h3 className="foundry-heading">Inventory</h3>
          {owned.length === 0 ? (
            <p className="muted">No Relics in stock. Recover them from wrecks, then install at Dock.</p>
          ) : (
            owned.map((shard) => {
              const def = getShard(shard.id) ?? shard
              const check = canUpgradeRelic(state, def.id)
              return (
                <article key={def.id} className="network-row">
                  <div className="network-row-main">
                    <InspectName name={def.name} card={inspectShard(state, def.id)} />
                    <span className="muted">
                      {RELIC_SOCKET_LABELS[relicSocketClass(def)]} · T{relicTier(def)} · ×
                      {shardOwned(state, def.id)}
                    </span>
                  </div>
                  <p className="network-row-stats">
                    {def.blurb} · {shardEffectBlurb(def)}
                  </p>
                  {def.upgradesTo ? (
                    <button
                      type="button"
                      className="primary"
                      disabled={!check.ok}
                      onClick={() => onUpgradeRelic(def.id)}
                    >
                      {check.ok
                        ? `Upgrade · ${check.cost?.amount ?? 0} Slag Ingots`
                        : (check.reason ?? 'Upgrade')}
                    </button>
                  ) : null}
                </article>
              )
            })
          )}
          <h3 className="foundry-heading" data-guide="relic-sockets">
            Core sockets
          </h3>
          <CoreSheet
            state={state}
            compact
            relicsOnly
            onUpgrade={() => undefined}
            onPickMilestone={() => undefined}
            onEquipRelic={onEquipRelic}
            onRemoveRelic={onRemoveRelic}
          />
        </div>
      )}
    </section>
  )
}
