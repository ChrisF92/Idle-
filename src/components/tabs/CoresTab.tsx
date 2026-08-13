import type { GameState } from '../../game/types'
import {
  MAX_MODULE_LEVEL,
  getModule,
  moduleLevel,
  moduleUpgradeCost,
} from '../../game/catalog'
import { computeShipStats } from '../../game/state'
import { formatCompact } from '../../game/format'

const STARTER_CORES = [
  { id: 'pulse-cannon', slot: 'Weapon' },
  { id: 'plate-layer', slot: 'Ward' },
] as const

interface CoresTabProps {
  state: GameState
  onUpgrade: (moduleId: string) => void
}

export function CoresTab({ state, onUpgrade }: CoresTabProps) {
  const stats = computeShipStats(state)
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Cores</h2>
        <p>
          USI-style loadout. Spend Salvage to level fitted Cores. Levels persist until Rebuild.
          Swap which Cores are fitted later via Rebuild.
        </p>
      </header>
      <p className="muted">
        Ship DPS {formatCompact(stats.damage)} · Hull {formatCompact(stats.hullMax)} · Armour{' '}
        {formatCompact(stats.armor)}
      </p>
      <div className="stack">
        {STARTER_CORES.map((core) => {
          const def = getModule(core.id)
          const level = moduleLevel(state.shipyard.moduleLevels, core.id)
          const cost = moduleUpgradeCost(level)
          const maxed = level >= MAX_MODULE_LEVEL
          const can = !maxed && state.resources.salvage >= cost
          return (
            <article key={core.id} className="core-card">
              <header>
                <span className="muted">{core.slot}</span>
                <h3>{def?.name ?? core.id}</h3>
              </header>
              <p>{def?.description}</p>
              <p>
                Rank {level}
                {maxed ? ' (max)' : ` · next ${cost} Salvage`}
              </p>
              <button
                type="button"
                className="primary"
                disabled={!can}
                onClick={() => onUpgrade(core.id)}
              >
                {maxed ? 'Maxed' : `Level up (${cost} Salvage)`}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
