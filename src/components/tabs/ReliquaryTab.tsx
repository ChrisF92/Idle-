import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  SHARDS,
  getShard,
  isRelicsUnlocked,
  shardEffectBlurb,
  shardOwned,
} from '../../game/reliquary'
import { inspectShard } from '../../game/inspect'
import { InspectName } from '../InspectName'
import { CoreSheet } from '../CoreSheet'

interface ReliquaryTabProps {
  state: GameState
  onBack: () => void
  onEquipRelic: (moduleId: string, relicId: string) => void
  onRemoveRelic: (moduleId: string) => void
}

export function ReliquaryTab({ state, onBack, onEquipRelic, onRemoveRelic }: ReliquaryTabProps) {
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
            ? 'Install Relics into fitted Cores while Docked. There is no colour-slot Reliquary.'
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
              return (
                <article key={def.id} className="network-row">
                  <div className="network-row-main">
                    <InspectName name={def.name} card={inspectShard(state, def.id)} />
                    <span className="muted">×{shardOwned(state, def.id)}</span>
                  </div>
                  <p className="network-row-stats">
                    {def.blurb} · {shardEffectBlurb(def)}
                  </p>
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
