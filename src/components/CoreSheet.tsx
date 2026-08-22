import type { GameState, RelicSocketClass } from '../game/types'
import {
  MAX_MODULE_LEVEL,
  getModule,
  moduleLevel,
  moduleStatPreviews,
  moduleUpgradeCost,
} from '../game/catalog'
import { pendingMilestone } from '../game/milestones'
import { formatCompact } from '../game/format'
import { inspectCore, inspectShard } from '../game/inspect'
import { protocolCoreScalingAdd } from '../game/protocols'
import {
  RELIC_SOCKET_LABELS,
  SHARDS,
  coreSocketLayout,
  coreSocketRelics,
  getShard,
  isRelicsUnlocked,
  relicFitsSocket,
  relicSocketClass,
  shardEffectBlurb,
  shardOwned,
} from '../game/reliquary'
import { InspectName } from './InspectName'
import { markLocalOk, useJustBecame } from '../hooks/useJustBecame'

const SLOT_LABEL: Record<string, string> = {
  weapon: 'Weapon',
  defense: 'Shield',
  utility: 'Utility',
}

interface CoreSheetProps {
  state: GameState
  onUpgrade: (moduleId: string) => void
  onPickMilestone: (moduleId: string, milestoneId: string, choiceId: string) => void
  compact?: boolean
  onBuyMax?: () => void
  /** Relic install/remove. Docked-only; omit during a live Sortie. */
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
  /** Hide Scrap ranks and show Relic sockets only. */
  relicsOnly?: boolean
  /** Sortie inspect: stats and Relics, no Dock ranks. */
  inspectOnly?: boolean
}

function RelicSocket({
  state,
  moduleId,
  socketIndex,
  socket,
  onEquipRelic,
  onRemoveRelic,
}: {
  state: GameState
  moduleId: string
  socketIndex: number
  socket: RelicSocketClass
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
}) {
  const label = RELIC_SOCKET_LABELS[socket]
  const fittedId = coreSocketRelics(state, moduleId)[socketIndex] ?? null
  const fitted = fittedId ? getShard(fittedId) : undefined
  const docked = Boolean(state.combat.docked)
  const canEdit = docked && Boolean(onEquipRelic || onRemoveRelic)
  const owned = SHARDS.filter((shard) => {
    if (shardOwned(state, shard.id) < 1) return false
    if (shard.id === fittedId) return false
    return relicFitsSocket(relicSocketClass(shard), socket)
  })
  return (
    <div className="relic-socket" data-guide={socketIndex === 0 ? `relic-${moduleId}` : undefined}>
      <p className="core-row-stats">
        <span className="muted">{label} </span>
        {fitted ? (
          <>
            <InspectName name={fitted.name} card={inspectShard(state, fitted.id)} />
            <span className="muted"> · {shardEffectBlurb(fitted)}</span>
          </>
        ) : (
          <span className="muted">{docked ? `Empty ${label} socket` : 'Empty — install at Dock'}</span>
        )}
      </p>
      {canEdit && fitted && onRemoveRelic ? (
        <button type="button" onClick={() => onRemoveRelic(moduleId, socketIndex)}>
          Remove Relic
        </button>
      ) : null}
      {canEdit && onEquipRelic && owned.length > 0 ? (
        <div className="relic-picks">
          {owned.map((shard) => (
            <button
              key={shard.id}
              type="button"
              className="primary"
              onClick={() => onEquipRelic(moduleId, shard.id, socketIndex)}
            >
              {shard.name}
              <span className="muted"> ×{shardOwned(state, shard.id)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function RelicSockets({
  state,
  moduleId,
  onEquipRelic,
  onRemoveRelic,
}: {
  state: GameState
  moduleId: string
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
}) {
  if (!isRelicsUnlocked(state)) return null
  const layout = coreSocketLayout(state, moduleId)
  if (layout.length < 1) return null
  return (
    <div className="relic-sockets">
      {layout.map((socket, index) => (
        <RelicSocket
          key={`${moduleId}-${socket}-${index}`}
          state={state}
          moduleId={moduleId}
          socketIndex={index}
          socket={socket}
          onEquipRelic={onEquipRelic}
          onRemoveRelic={onRemoveRelic}
        />
      ))}
    </div>
  )
}

function CoreRow({
  state,
  moduleId,
  onUpgrade,
  onPickMilestone,
  onEquipRelic,
  onRemoveRelic,
  relicsOnly = false,
  inspectOnly = false,
}: {
  state: GameState
  moduleId: string
  onUpgrade: (moduleId: string) => void
  onPickMilestone: (moduleId: string, milestoneId: string, choiceId: string) => void
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
  relicsOnly?: boolean
  inspectOnly?: boolean
}) {
  const def = getModule(moduleId)
  const level = moduleLevel(state.shipyard.moduleLevels, moduleId)
  const cost = moduleUpgradeCost(level, moduleId, protocolCoreScalingAdd(state, def?.role))
  const maxed = level >= MAX_MODULE_LEVEL
  const can = Boolean(def) && !maxed && !inspectOnly && (state.resources.scrap ?? 0) >= cost
  const pending = pendingMilestone(moduleId, level, state.shipyard.corePicks?.[moduleId])
  const justReady = useJustBecame(can)
  if (!def) return null
  const stats = moduleStatPreviews(moduleId, level, !maxed)
  const headline = stats
    .map((s) => `${s.label} ${s.current}${s.next ? `→${s.next}` : ''}`)
    .join(' · ')

  return (
    <article
      className={`core-row${pending ? ' is-pending' : can ? ' is-affordable' : ''}${justReady ? ' just-ready' : ''}`}
      data-guide={`core-${moduleId}`}
      data-focus={`core-${moduleId}`}
    >
      <div className="core-row-main">
        <span className="muted">{SLOT_LABEL[def.role] ?? def.role}</span>
        <InspectName name={def.name} card={inspectCore(state, moduleId)} />
        <span className="core-row-lv">Lv {level}</span>
      </div>
      {headline && !relicsOnly ? <p className="core-row-stats">{headline}</p> : null}
      <RelicSockets
        state={state}
        moduleId={moduleId}
        onEquipRelic={onEquipRelic}
        onRemoveRelic={onRemoveRelic}
      />
      {relicsOnly ? null : inspectOnly ? (
        <p className="muted">
          {maxed ? 'Maxed' : `Rank at Dock · ${formatCompact(cost)} Scrap`}
        </p>
      ) : pending ? (
        <div className="core-picks">
          {pending.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className="primary"
              onClick={() => onPickMilestone(moduleId, pending.id, choice.id)}
            >
              {choice.name}
              <span className="muted"> {choice.blurb}</span>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          className="primary"
          data-guide={`upgrade-${moduleId}`}
          disabled={!can}
          onClick={(e) => {
            markLocalOk(e.currentTarget)
            onUpgrade(moduleId)
          }}
        >
          {maxed ? 'Maxed' : `Upgrade · ${formatCompact(cost)} Scrap`}
        </button>
      )}
    </article>
  )
}

export function CoreSheet({
  state,
  onUpgrade,
  onPickMilestone,
  compact = false,
  onBuyMax,
  onEquipRelic,
  onRemoveRelic,
  relicsOnly = false,
  inspectOnly = false,
}: CoreSheetProps) {
  return (
    <div className={compact ? 'core-sheet core-sheet-compact' : 'core-sheet'}>
      {onBuyMax && !relicsOnly && !inspectOnly ? (
        <p className="assign-row">
          <button type="button" className="primary" data-guide="core-buy-max" onClick={onBuyMax}>
            Buy Max
          </button>
        </p>
      ) : null}
      {state.shipyard.modules.map((moduleId) => (
        <CoreRow
          key={moduleId}
          state={state}
          moduleId={moduleId}
          onUpgrade={onUpgrade}
          onPickMilestone={onPickMilestone}
          onEquipRelic={onEquipRelic}
          onRemoveRelic={onRemoveRelic}
          relicsOnly={relicsOnly}
          inspectOnly={inspectOnly}
        />
      ))}
    </div>
  )
}
