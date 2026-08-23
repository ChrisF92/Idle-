import type { FurnaceChannelId, GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  ASH_PER_HEAT,
  GDD_FURNACE_CHANNEL_IDS,
  FURNACE_CHANNELS,
  furnaceChannelEffectLine,
  furnaceActiveLevel,
  furnaceChannelPreview,
  furnaceChannelUnlocked,
  furnaceLevelDef,
  furnaceLightCost,
} from '../../game/furnace'
import { formatCompact } from '../../game/format'
import { inspectFurnaceChannel, inspectFurnaceOverview } from '../../game/inspect'
import { InspectName } from '../InspectName'

interface FurnaceTabProps {
  state: GameState
  onBack: () => void
  onConvert: () => void
  onSetChannel: (id: FurnaceChannelId, level: number) => void
}

function roman(n: number): string {
  return n === 1 ? 'I' : n === 2 ? 'II' : n === 3 ? 'III' : String(n)
}

export function FurnaceTab({ state, onBack, onConvert, onSetChannel }: FurnaceTabProps) {
  const open = isSystemUnlocked(state, 'furnace')
  const ash = state.resources.choirAsh ?? 0
  const heat = state.resources.heat ?? 0
  const batches = Math.floor(ash / ASH_PER_HEAT)
  const channels = FURNACE_CHANNELS.filter((ch) => GDD_FURNACE_CHANNEL_IDS.includes(ch.id))

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            Systems
          </button>
        </p>
        <h2>
          <InspectName name="Furnace" card={inspectFurnaceOverview(state)} />
        </h2>
        <p>
          {open
            ? 'Convert Ash to Heat, then spend Heat on this Sortie.'
            : `Reach Wave ${ACT1_CADENCE.furnace} to light the Furnace.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">Kills drop Ash after Wave {ACT1_CADENCE.furnace}. Ash persists this Rebuild cycle.</p>
      ) : (
        <div className="panel-scroll">
          <div className="furnace-ledger">
            <p data-guide="furnace-ash">
              <span className="muted">Ash</span>
              <strong>{formatCompact(ash, 1)}</strong>
            </p>
            <p data-guide="furnace-heat">
              <span className="muted">Heat</span>
              <strong>{formatCompact(heat, 1)}</strong>
            </p>
          </div>
          <p className="muted">
            Ash persists across Sorties this cycle and resets on Rebuild. Heat is this Sortie only — it dumps when you
            Dock. {ASH_PER_HEAT} Ash → 1 Heat.
          </p>
          <p className="assign-row">
            <button
              type="button"
              className="primary"
              disabled={batches <= 0}
              onClick={onConvert}
              data-guide="furnace-bank"
            >
              Convert {formatCompact(batches, 1)} Heat
            </button>
          </p>

          <h3 className="foundry-heading" data-guide="furnace-channels">
            Channels
          </h3>
          {channels.map((ch) => {
            const unlocked = furnaceChannelUnlocked(state, ch.id)
            const active = furnaceActiveLevel(state, ch.id)
            return (
              <article
                key={ch.id}
                className={`network-row${active > 0 ? ' is-active' : unlocked ? '' : ' locked'}`}
                data-guide={ch.id === 'weapons' ? 'furnace-channel-weapons' : undefined}
              >
                <div className="network-row-main">
                  <InspectName name={ch.name} card={unlocked ? inspectFurnaceChannel(state, ch.id) : null} />
                  <span className="muted">{unlocked ? (active > 0 ? `${roman(active)} lit` : 'Dark') : 'Locked'}</span>
                </div>
                <p className="network-row-stats">
                  {unlocked
                    ? active > 0
                      ? `${ch.stat} ×${furnaceLevelDef(ch.id, active)?.mult.toFixed(2)} this Sortie`
                      : `${furnaceChannelEffectLine(ch)} · I costs ${formatCompact(furnaceLightCost(ch.id, 1), 1)} Heat`
                    : ch.detail[0]}
                </p>
                {unlocked ? (
                  <p className="assign-row">
                    {[0, 1, 2, 3].map((lv) => {
                      const preview = furnaceChannelPreview(state, ch.id, lv)
                      const selected = active === lv
                      return (
                        <button
                          key={lv}
                          type="button"
                          className={selected ? 'primary' : undefined}
                          disabled={lv > 0 && !preview.ok && !selected}
                          title={preview.reason}
                          onClick={() => onSetChannel(ch.id, lv)}
                        >
                          {lv === 0 ? 'Off' : roman(lv)}
                          {lv > 0 ? ` · ${formatCompact(furnaceLightCost(ch.id, lv), 0)}` : ''}
                        </button>
                      )
                    })}
                  </p>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
