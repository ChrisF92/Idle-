import { useEffect, useMemo, useState } from 'react'
import type { FurnaceChannelId, FurnaceChannelLevel, GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  FURNACE_CHANNEL_IDS,
  FURNACE_CHANNELS,
  canIgniteFurnace,
  furnaceActiveEffectLine,
  furnaceChannelCost,
  furnaceChannelLimit,
  furnaceConversionLine,
  furnaceConversionPreview,
  furnaceLitLine,
} from '../../game/furnace'
import { formatCompact } from '../../game/format'
import { ContextBar, Screen, ScreenHeader, Section, StatPair } from '../../ui/primitives'

interface FurnaceTabProps {
  state: GameState
  onBack: () => void
  onConvert: () => void
  onIgnite: (channels: Partial<Record<FurnaceChannelId, FurnaceChannelLevel>>) => void
}

function emptyDraft(): Record<FurnaceChannelId, FurnaceChannelLevel> {
  return { overdrive: 0, bulwark: 0, guidance: 0, harvest: 0 }
}

function roman(level: FurnaceChannelLevel): string {
  return level === 0 ? 'OFF' : level === 1 ? 'I' : level === 2 ? 'II' : 'III'
}

export function FurnaceTab({ state, onBack, onConvert, onIgnite }: FurnaceTabProps) {
  const open = isSystemUnlocked(state, 'furnace')
  const [draft, setDraft] = useState<Record<FurnaceChannelId, FurnaceChannelLevel>>(emptyDraft)
  const [primed, setPrimed] = useState(false)
  const locked = state.furnace.ignited
  const conversion = furnaceConversionPreview(state)
  const ignite = canIgniteFurnace(state, draft)
  const limit = furnaceChannelLimit(state)

  useEffect(() => {
    if (locked) {
      setDraft({ ...state.furnace.channels })
      setPrimed(false)
    }
  }, [locked, state.furnace.channels])

  const selected = FURNACE_CHANNEL_IDS.filter((id) => draft[id] > 0).length
  const cost = useMemo(
    () => FURNACE_CHANNEL_IDS.reduce((sum, id) => sum + furnaceChannelCost(draft[id]), 0),
    [draft],
  )

  function setLevel(id: FurnaceChannelId, level: FurnaceChannelLevel) {
    if (locked) return
    const next = { ...draft, [id]: level }
    const count = FURNACE_CHANNEL_IDS.filter((key) => next[key] > 0).length
    if (count > limit) return
    setDraft(next)
    setPrimed(false)
  }

  return (
    <Screen className="panel screen-panel furnace-screen" label="Furnace" sticky={false}>
      <ScreenHeader title="Furnace" action={<button type="button" onClick={onBack}>Systems</button>} />
      <ContextBar>
        <StatPair label="Ash" value={formatCompact(state.resources.choirAsh ?? 0, 1)} />
        <StatPair label="Heat" value={formatCompact(state.resources.heat ?? 0, 1)} />
        <StatPair label="Convert" value={furnaceConversionLine()} />
        <StatPair label="State" value={locked ? 'LOCK' : primed ? 'PRIME' : 'CONFIGURE'} />
      </ContextBar>
      {!open ? (
        <p className="muted">Reach Wave {ACT1_CADENCE.furnace} to unlock Furnace.</p>
      ) : (
        <div className="panel-scroll furnace-scroll">
          <Section>
            <p className="ui-meta">
              Ash lasts through the Rebuild cycle. Heat and the Ignited Furnace last only this Sortie.
              Configure locally, Prime to review, then Ignite once. Closing this sheet discards an un-Ignited draft.
            </p>
            {locked ? <p><strong>LOCKED THIS SORTIE</strong> · {furnaceLitLine(state)}</p> : null}
            {locked ? <p className="ui-meta">{furnaceActiveEffectLine(state)}</p> : null}
            <div className="furnace-channel-list" data-guide="furnace-channels" data-onboarding="onboarding.furnace.channel">
              {FURNACE_CHANNELS.map((ch) => {
                const active = locked ? state.furnace.channels[ch.id] : draft[ch.id]
                return (
                  <article key={ch.id} className={`furnace-channel-card${active > 0 ? ' is-lit' : ''}`}>
                    <header className="furnace-channel-head">
                      <strong className="furnace-channel-name">{ch.name.toUpperCase()} — {roman(active)}</strong>
                    </header>
                    <p>{ch.blurb}</p>
                    <div className="furnace-tier-row">
                      {([0, 1, 2, 3] as FurnaceChannelLevel[]).map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          className={active === lv ? 'primary' : undefined}
                          disabled={locked}
                          onClick={() => setLevel(ch.id, lv)}
                        >
                          {roman(lv)}{lv > 0 ? ` · ${furnaceChannelCost(lv)}` : ''}
                        </button>
                      ))}
                    </div>
                    {active > 0 ? (
                      <p className="ui-meta">
                        {ch.levels[active - 1]?.effect != null ? `Primary effect +${Math.round(ch.levels[active - 1]!.effect * 100)}% seed` : ''}
                      </p>
                    ) : null}
                  </article>
                )
              })}
            </div>
            {!locked ? <p className="ui-meta">Selected {selected}/{limit} · Ignite cost {cost} Heat</p> : null}
            {!locked ? (
              <div className="furnace-ignite-actions">
                {!primed ? (
                  <button type="button" className="primary" disabled={!ignite.ok} title={ignite.reason} onClick={() => setPrimed(true)}>
                    Prime configuration
                  </button>
                ) : (
                  <>
                    <p><strong>PRIMED</strong> · {selected} channel{selected === 1 ? '' : 's'} · {cost} Heat</p>
                    <button type="button" onClick={() => setPrimed(false)}>Back to Configure</button>
                    <button type="button" className="primary" disabled={!ignite.ok} title={ignite.reason} onClick={() => { onIgnite(draft); setPrimed(false) }}>
                      Ignite and Lock
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </Section>
          <Section>
            <p className="ui-meta">Ash → Heat is manual. There is no passive Heat generation, drain, or capacity.</p>
            <button type="button" disabled={!conversion.ok} title={conversion.reason} onClick={onConvert}>
              {conversion.ok ? `Convert ${formatCompact(conversion.ashUsed)} Ash → ${formatCompact(conversion.heatGain, 1)} Heat` : conversion.reason ?? 'Convert Ash'}
            </button>
          </Section>
        </div>
      )}
    </Screen>
  )
}
