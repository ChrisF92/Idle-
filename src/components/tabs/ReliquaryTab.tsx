import type { GameState, ReliquaryColor } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  RELIQUARY_RESONANCE_NEED,
  RELIQUARY_SLOTS,
  SHARDS,
  fittedShardId,
  getShard,
  isReliquarySlotUnlocked,
  shardEffectScale,
  shardOwned,
  shardResonance,
  shardEffectBlurb,
} from '../../game/reliquary'
import { formatCompact } from '../../game/format'
import { inspectReliquarySlot, inspectShard } from '../../game/inspect'
import { InspectName } from '../InspectName'
import { SheetTabs } from '../SheetTabs'
import { useSyncedPane } from '../../hooks/useSyncedPane'

type ReliquaryPane = 'slots' | 'index'

const RELIQUARY_PANES: { id: ReliquaryPane; label: string; guide?: string }[] = [
  { id: 'slots', label: 'Slots' },
  { id: 'index', label: 'Index', guide: 'reliquary-copies' },
]

interface ReliquaryTabProps {
  state: GameState
  onBack: () => void
  onInsert: (shardId: string) => void
  onRemove: (color: ReliquaryColor) => void
  guideTarget?: string | null
}

export function ReliquaryTab({ state, onBack, onInsert, onRemove, guideTarget = null }: ReliquaryTabProps) {
  const open = isSystemUnlocked(state, 'reliquary')
  const hint = guideTarget === 'reliquary-copies' ? 'index' : guideTarget === 'reliquary-slots' ? 'slots' : null
  const [pane, setPane] = useSyncedPane<ReliquaryPane>('slots', hint)

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>Reliquary</h2>
        <p>
          {open
            ? 'One shard per colour. Fit a shard for a permanent bonus.'
            : `Reach Wave ${ACT1_CADENCE.reliquary} to open the Reliquary.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">Shards drop from kills once this door is open.</p>
      ) : (
        <>
          <SheetTabs value={pane} onChange={setPane} options={RELIQUARY_PANES} label="Reliquary panes" />
          <div className="panel-scroll">
          {pane === 'slots' ? (
            <>
          <h3 className="foundry-heading" data-guide="reliquary-slots">
            Slots
          </h3>
          {RELIQUARY_SLOTS.map((slot) => {
            const unlocked = isReliquarySlotUnlocked(state, slot.color)
            const fitted = fittedShardId(state, slot.color)
            const fittedDef = fitted ? getShard(fitted) : undefined
            const scale = fitted ? shardEffectScale(state, fitted) : 0
            const res = fitted ? shardResonance(state, fitted) : 0
            const candidates = SHARDS.filter((s) => s.color === slot.color)
            return (
              <article
                key={slot.color}
                className={unlocked ? `network-row slot-${slot.color}` : 'network-row locked'}
              >
                <div className="network-row-main">
                  <InspectName
                    name={slot.name}
                    card={unlocked ? inspectReliquarySlot(state, slot.color) : null}
                  />
                  <span className="muted">
                    {unlocked
                      ? fittedDef
                        ? `${fittedDef.name} · ${Math.round(res * 100)}%`
                        : 'Empty — Fit shard'
                      : `Sector ${slot.requiresSectorEver}`}
                  </span>
                </div>
                {unlocked && fittedDef ? (
                  <>
                    <p className="network-row-stats">
                      {fittedDef.blurb} · {shardEffectBlurb(fittedDef)} · ×{formatCompact(scale, 2)}
                    </p>
                    <div className="network-fill" aria-hidden>
                      <span style={{ width: `${Math.round(res * 100)}%` }} />
                    </div>
                    <p className="muted">
                      {Math.max(0, shardOwned(state, fittedDef.id) - 1)}/{RELIQUARY_RESONANCE_NEED} extra
                    </p>
                    <button type="button" onClick={() => onRemove(slot.color)}>
                      Remove
                    </button>
                  </>
                ) : null}
                {unlocked ? (
                  <div className="station-actions">
                    {candidates.map((shard) => {
                      const owned = shardOwned(state, shard.id)
                      const isFit = fitted === shard.id
                      const gated =
                        (shard.requiresSectorEver ?? 0) > 0 &&
                        (shard.requiresSectorEver ?? 0) >
                          Math.max(state.meta.highestSectorEver ?? 0, state.combat.highestSector ?? 0)
                      return (
                        <button
                          key={shard.id}
                          type="button"
                          className={isFit ? 'primary' : undefined}
                          disabled={owned < 1 || isFit || gated}
                          onClick={() => onInsert(shard.id)}
                        >
                          {isFit ? 'Fitted' : owned < 1 ? shard.name : `Fit ${shard.name}`}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="network-row-stats">{slot.name} slot later.</p>
                )}
              </article>
            )
          })}
            </>
          ) : (
            <>
          <h3 className="foundry-heading" data-guide="reliquary-copies">
            Shard glossary
          </h3>
          {SHARDS.map((shard) => {
            const gated = (shard.requiresSectorEver ?? 0) > Math.max(state.meta.highestSectorEver ?? 0, state.combat.highestSector ?? 0)
            return (
              <article key={shard.id} className={gated ? 'network-row locked' : 'network-row'}>
                <div className="network-row-main">
                  <InspectName
                    name={shard.name}
                    card={gated ? null : inspectShard(state, shard.id)}
                  />
                  <span className="muted">
                    {shard.color}
                    {shard.requiresSectorEver ? ` · S${shard.requiresSectorEver}` : ''}
                  </span>
                </div>
                <p className="network-row-stats">
                  {shard.blurb} · {shardEffectBlurb(shard)}
                </p>
              </article>
            )
          })}
            </>
          )}
          </div>
        </>
      )}
    </section>
  )
}
