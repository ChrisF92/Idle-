import type { FurnaceChannelId, FurnacePresetId, FurnaceUpgradeId, GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  ASH_PER_HEAT,
  FURNACE_CHANNELS,
  FURNACE_PRESETS,
  FURNACE_UPGRADES,
  canBuyFurnaceUpgrade,
  furnaceActiveCount,
  furnaceActiveLevel,
  furnaceAshBurnPerSec,
  furnaceCapacity,
  furnaceChannelHeatCost,
  furnaceChannelPreview,
  furnaceChannelSlots,
  furnaceChannelUnlocked,
  furnaceConsumptionPerSec,
  furnaceGenerationPerSec,
  furnaceLevelDef,
  furnaceNetPerSec,
  furnacePriority,
  furnaceUpgradeCost,
  furnaceUpgradeRank,
  furnaceWantedLevel,
} from '../../game/furnace'
import { hiveResearchHeatFromAshMult } from '../../game/hiveResearch'
import { foundryAshHeatMult } from '../../game/foundryBonuses'
import { formatCompact } from '../../game/format'
import { inspectFurnaceChannel, inspectFurnaceOverview, inspectFurnaceUpgrade } from '../../game/inspect'
import { InspectName } from '../InspectName'
import { hasProcess, processConfig, processFurnaceHooks } from '../../game/process'

interface FurnaceTabProps {
  state: GameState
  onBack: () => void
  onConvert: () => void
  onSetChannel: (id: FurnaceChannelId, level: number) => void
  onSetPriority: (priority: FurnaceChannelId[]) => void
  onBuyUpgrade: (id: FurnaceUpgradeId) => void
  onPreset?: (preset: FurnacePresetId) => void
}

function roman(n: number): string {
  return n === 1 ? 'I' : n === 2 ? 'II' : n === 3 ? 'III' : String(n)
}

function signed(n: number): string {
  const mag = formatCompact(Math.abs(n), 2)
  if (n > 0.0005) return `+${mag}`
  if (n < -0.0005) return `−${mag}`
  return '0'
}

export function FurnaceTab({
  state,
  onBack,
  onConvert,
  onSetChannel,
  onSetPriority,
  onBuyUpgrade,
  onPreset,
}: FurnaceTabProps) {
  const open = isSystemUnlocked(state, 'furnace')
  const ash = state.resources.choirAsh ?? 0
  const heat = state.resources.heat ?? 0
  const hive = hiveResearchHeatFromAshMult(state) * foundryAshHeatMult(state)
  const cap = furnaceCapacity(state)
  const gen = furnaceGenerationPerSec(state, hive)
  const use = furnaceConsumptionPerSec(state)
  const net = furnaceNetPerSec(state, hive)
  const batches = Math.floor(ash / ASH_PER_HEAT)
  const slots = furnaceChannelSlots(state)
  const lit = furnaceActiveCount(state)
  const hooks = processFurnaceHooks(state)
  const priority = furnacePriority(state)
  const starve = state.furnace?.starveNote ?? ''
  const presetsOn = hasProcess(state, 'furnace-presets')
  const managerOn = hooks.managerUnlocked

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>
          <InspectName name="Furnace" card={inspectFurnaceOverview(state)} />
        </h2>
        <p>
          {open
            ? 'Spend Heat to power temporary boosts.'
            : `Reach Wave ${ACT1_CADENCE.furnace} to light the Furnace.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">Kills drop Choir-ash automatically — no clicker.</p>
      ) : (
        <div className="panel-scroll">
          <div className="furnace-ledger">
            <p data-guide="furnace-heat">
              <span className="muted">Heat</span>
              <strong>
                {formatCompact(heat, 1)} / {formatCompact(cap, 1)}
              </strong>
            </p>
            <p className={net < -0.0005 ? 'furnace-net is-drain' : 'furnace-net'} data-guide="furnace-net">
              <span className="muted">Net</span>
              <strong>{signed(net)}/s</strong>
            </p>
            <p data-guide="furnace-slots">
              <span className="muted">Channels</span>
              <strong>
                {lit} / {slots}
              </strong>
            </p>
          </div>
          <details className="network-explain">
            <summary>Heat details</summary>
            <p data-guide="furnace-cap">
              Capacity {formatCompact(cap, 1)} · Generating {signed(gen)}/s · Consuming {formatCompact(use, 2)}/s
            </p>
            <p data-guide="furnace-gen" className="muted">
              Ash burn {formatCompact(furnaceAshBurnPerSec(state, hive), 2)}/s
            </p>
          </details>
          {starve ? <p className="furnace-starve">{starve}</p> : null}
          <p className="muted" data-guide="furnace-ash">
            {formatCompact(ash, 1)} Choir-ash · {formatCompact(furnaceAshBurnPerSec(state, hive), 2)} ash/s
            while the tank has room.
            {hooks.reserveHeat > 0 ? ` Reserve ${formatCompact(hooks.reserveHeat, 1)} Heat.` : ''}
          </p>
          <p className="assign-row">
            <button
              type="button"
              className="primary"
              disabled={batches <= 0 || heat >= cap - 1e-6}
              onClick={onConvert}
              data-guide="furnace-bank"
            >
              Bank {formatCompact(Math.min(batches, Math.max(0, cap - heat)), 1)} Heat
            </button>
          </p>
          {presetsOn && onPreset ? (
            <div className="process-config-block" data-guide="furnace-presets">
              <p className="muted">Presets set which channels you want lit.</p>
              <p className="assign-row">
                {(Object.keys(FURNACE_PRESETS) as FurnacePresetId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={processConfig(state).furnace.preset === id ? 'primary' : undefined}
                    onClick={() => onPreset(id)}
                  >
                    {FURNACE_PRESETS[id].name}
                  </button>
                ))}
              </p>
            </div>
          ) : null}
          {managerOn ? (
            <p className="muted" data-guide="furnace-manager">
              Manager is on. It keeps your wanted lights while Heat lasts
              {hooks.autoChannel ? ', and may raise or drop levels to stay sustainable' : ''}.
            </p>
          ) : null}

          <h3 className="foundry-heading" data-guide="furnace-channels">
            Channels
          </h3>
          {FURNACE_CHANNELS.map((ch) => {
            const unlocked = furnaceChannelUnlocked(state, ch.id)
            const active = furnaceActiveLevel(state, ch.id)
            const wanted = furnaceWantedLevel(state, ch.id)
            const pri = priority.indexOf(ch.id) + 1
            return (
              <article
                key={ch.id}
                className={`network-row${active > 0 ? ' is-active' : unlocked ? '' : ' locked'}`}
                data-guide={ch.id === 'weapons' ? 'furnace-channel-weapons' : undefined}
              >
                <div className="network-row-main">
                  <InspectName name={ch.name} card={unlocked ? inspectFurnaceChannel(state, ch.id) : null} />
                  <span className="muted">
                    {unlocked ? (active > 0 ? `${roman(active)} lit` : 'Dark') : 'Locked'}
                    {wanted !== active && wanted > 0 ? ` · want ${roman(wanted)}` : ''}
                    {` · P${pri}`}
                  </span>
                </div>
                <p className="network-row-stats">
                  {unlocked
                    ? active > 0
                      ? `${ch.stat} ×${furnaceLevelDef(ch.id, active)?.mult.toFixed(2)} · ${formatCompact(furnaceChannelHeatCost(state, ch.id, active), 2)} Heat/s`
                      : `${ch.blurb} · I costs ${formatCompact(furnaceChannelHeatCost(state, ch.id, 1), 2)} Heat/s`
                    : ch.detail[0]}
                </p>
                {unlocked ? (
                  <p className="assign-row">
                    {[0, 1, 2, 3].map((lv) => {
                      const preview = furnaceChannelPreview(state, ch.id, lv, hive)
                      const selected = wanted === lv
                      const warn = lv > 0 && preview.ok && preview.net < -0.0005
                      return (
                        <button
                          key={lv}
                          type="button"
                          className={selected ? 'primary' : undefined}
                          disabled={lv > 0 && !preview.ok && !selected}
                          title={
                            warn
                              ? `NET ${signed(preview.net)}/s. Tank lasts ~${Math.max(1, Math.round(preview.lastsSec ?? 0))}s.`
                              : preview.reason
                          }
                          onClick={() => onSetChannel(ch.id, lv)}
                        >
                          {lv === 0 ? 'Off' : lv === 1 && wanted === 0 ? 'Light' : roman(lv)}
                          {warn ? ' · drain' : ''}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      disabled={pri <= 1}
                      onClick={() => {
                        const next = [...priority]
                        const i = next.indexOf(ch.id)
                        if (i <= 0) return
                        const swap = next[i - 1]
                        next[i - 1] = next[i]!
                        next[i] = swap!
                        onSetPriority(next)
                      }}
                    >
                      Priority up
                    </button>
                  </p>
                ) : null}
                {unlocked && wanted > 0 ? <ChannelWarn state={state} id={ch.id} level={wanted} hive={hive} /> : null}
              </article>
            )
          })}

          <h3 className="foundry-heading">Upgrades</h3>
          <p className="muted">These persist on Rebuild. Heat in the tank does not, unless Ember Lock is ranked.</p>
          {FURNACE_UPGRADES.map((up) => {
            const rank = furnaceUpgradeRank(state, up.id)
            const cost = furnaceUpgradeCost(state, up.id)
            const can = canBuyFurnaceUpgrade(state, up.id)
            return (
              <article key={up.id} className="network-row">
                <div className="network-row-main">
                  <InspectName name={up.name} card={inspectFurnaceUpgrade(state, up.id)} />
                  <span className="muted">
                    {rank}/{up.maxRank}
                  </span>
                </div>
                <p className="network-row-stats">{up.blurb}</p>
                <button type="button" className="primary" disabled={!can.ok} onClick={() => onBuyUpgrade(up.id)}>
                  {can.ok ? `${cost} Heat` : can.reason}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ChannelWarn({
  state,
  id,
  level,
  hive,
}: {
  state: GameState
  id: FurnaceChannelId
  level: number
  hive: number
}) {
  const preview = furnaceChannelPreview(state, id, level, hive)
  if (preview.ok && preview.net >= -0.0005) return null
  if (!preview.ok) return <p className="muted">{preview.reason}</p>
  return (
    <p className="furnace-starve">
      This lighting makes NET {signed(preview.net)}/s
      {preview.lastsSec != null ? ` · tank lasts ~${Math.max(1, Math.round(preview.lastsSec))}s` : ''}.
    </p>
  )
}
