import { useMemo, useState } from 'react'
import type { FurnaceChannelId, GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  ASH_PER_HEAT,
  furnaceActiveEffectLine,
  furnaceActiveLevel,
  furnaceChannelPreview,
  furnaceChannelUnlocked,
  furnaceConversionLine,
  furnaceLevelDef,
  furnaceLightCost,
  furnacePushChannels,
  furnaceRoman,
  type FurnaceChannelDef,
} from '../../game/furnace'
import { formatCompact } from '../../game/format'
import {
  Badge,
  BottomSheet,
  ContextBar,
  Screen,
  ScreenHeader,
  Section,
  StickyAction,
  StatPair,
} from '../../ui/primitives'

interface FurnaceTabProps {
  state: GameState
  onBack: () => void
  onConvert: () => void
  onSetChannel: (id: FurnaceChannelId, level: number) => void
}

function nextTier(ch: FurnaceChannelDef, active: number): { level: number; mult: number; heat: number } | null {
  if (active >= 3) return null
  const level = Math.max(1, active + 1)
  const def = ch.levels[level - 1]
  if (!def) return null
  const currentCost = active > 0 ? (ch.levels[active - 1]?.heat ?? 0) : 0
  return { level, mult: def.mult, heat: Math.max(0, def.heat - currentCost) }
}

export function FurnaceTab({ state, onBack, onConvert, onSetChannel }: FurnaceTabProps) {
  const open = isSystemUnlocked(state, 'furnace')
  const ash = state.resources.choirAsh ?? 0
  const heat = state.resources.heat ?? 0
  const batches = Math.floor(ash / ASH_PER_HEAT)
  const channels = furnacePushChannels()
  const [selectedId, setSelectedId] = useState<FurnaceChannelId | null>(null)
  const selected = channels.find((ch) => ch.id === selectedId) ?? null
  const selectedActive = selected ? furnaceActiveLevel(state, selected.id) : 0

  const sheetBody = useMemo(() => {
    if (!selected) return null
    return (
      <>
        <p>{selected.blurb}</p>
        {selected.levels.map((lv, index) => (
          <p key={lv.heat}>
            {furnaceRoman(index + 1)} · {selected.stat} ×{lv.mult.toFixed(2)}
            {lv.ashMult ? ` · Ash ×${lv.ashMult.toFixed(2)}` : ''} · {lv.heat} Heat
          </p>
        ))}
        {selected.detail.map((line) => (
          <p key={line} className="ui-meta">
            {line}
          </p>
        ))}
        <p className="ui-meta">Heat and channel lights last this Sortie only. They reset when the Sortie ends.</p>
      </>
    )
  }, [selected])

  return (
    <Screen className="panel screen-panel furnace-screen" label="Furnace" sticky={open}>
      <ScreenHeader
        title="Furnace"
        action={
          <button type="button" onClick={onBack}>
            Systems
          </button>
        }
      />
      <ContextBar>
        <StatPair label="Ash" value={formatCompact(ash, 1)} />
        <StatPair label="Heat" value={formatCompact(heat, 1)} />
        <StatPair label="Convert" value={furnaceConversionLine()} />
        <StatPair label="Effects" value={furnaceActiveEffectLine(state)} />
      </ContextBar>
      {!open ? (
        <p className="muted">Reach Wave {ACT1_CADENCE.furnace} to light the Furnace. Kills drop Ash after that door.</p>
      ) : (
        <div className="panel-scroll furnace-scroll">
          <Section>
            <p className="ui-meta" data-guide="furnace-ash">
              Ash persists across Sorties this cycle and resets on Rebuild. Heat is this Sortie only.
            </p>
            <div className="furnace-channel-list" data-guide="furnace-channels">
              {channels.map((ch) => {
                const unlocked = furnaceChannelUnlocked(state, ch.id)
                const active = furnaceActiveLevel(state, ch.id)
                const live = furnaceLevelDef(ch.id, active)
                const next = nextTier(ch, active)
                const currentMult = live?.mult ?? 1
                return (
                  <article
                    key={ch.id}
                    className={`furnace-channel-card${active > 0 ? ' is-lit' : ''}${unlocked ? '' : ' is-locked'}`}
                    data-guide={ch.id === 'weapons' ? 'furnace-channel-weapons' : undefined}
                  >
                    <button
                      type="button"
                      className="furnace-channel-hit"
                      onClick={() => setSelectedId(ch.id)}
                      aria-label={`${ch.name} details`}
                    >
                      <header className="furnace-channel-head">
                        <strong className="furnace-channel-name">
                          {ch.name.toUpperCase()} — {furnaceRoman(active)}
                        </strong>
                      </header>
                      <p>
                        {ch.stat} ×{currentMult.toFixed(2)}
                      </p>
                      {next ? (
                        <p className="ui-meta">
                          {furnaceRoman(next.level)} → ×{next.mult.toFixed(2)}
                        </p>
                      ) : (
                        <p className="ui-meta">Maxed this Sortie</p>
                      )}
                      <p>{next ? `${next.heat} Heat` : `${furnaceLightCost(ch.id, active)} Heat spent`}</p>
                      <p className="ui-meta">{ch.blurb}</p>
                    </button>
                    {unlocked ? (
                      <div className="furnace-tier-row">
                        {[0, 1, 2, 3].map((lv) => {
                          const preview = furnaceChannelPreview(state, ch.id, lv)
                          const selectedTier = active === lv
                          return (
                            <button
                              key={lv}
                              type="button"
                              className={selectedTier ? 'primary' : undefined}
                              disabled={lv > 0 && !preview.ok && !selectedTier}
                              title={preview.reason}
                              onClick={() => onSetChannel(ch.id, lv)}
                            >
                              {furnaceRoman(lv)}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="muted">Locked</p>
                    )}
                  </article>
                )
              })}
            </div>
          </Section>
        </div>
      )}
      {open ? (
        <StickyAction guide="furnace-bank">
          <button type="button" className="primary" disabled={batches <= 0} onClick={onConvert}>
            Convert {formatCompact(batches, 1)} Heat
          </button>
        </StickyAction>
      ) : null}
      <BottomSheet
        open={Boolean(selected)}
        title={selected?.name ?? 'Channel'}
        kicker="Furnace channel"
        onClose={() => setSelectedId(null)}
        footer={
          selected ? (
            <div className="furnace-tier-row">
              {[0, 1, 2, 3].map((lv) => {
                const preview = furnaceChannelPreview(state, selected.id, lv)
                const selectedTier = selectedActive === lv
                return (
                  <button
                    key={lv}
                    type="button"
                    className={selectedTier ? 'primary' : undefined}
                    disabled={lv > 0 && !preview.ok && !selectedTier}
                    onClick={() => onSetChannel(selected.id, lv)}
                  >
                    {furnaceRoman(lv)}
                    {lv > 0 ? ` · ${furnaceLightCost(selected.id, lv)}` : ''}
                  </button>
                )
              })}
            </div>
          ) : selectedActive > 0 ? (
            <Badge tone="ok">Lit this Sortie</Badge>
          ) : null
        }
      >
        {sheetBody}
      </BottomSheet>
    </Screen>
  )
}
