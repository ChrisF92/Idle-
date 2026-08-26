import type { GameState, RelicSocketClass } from '../game/types'
import { getModule, moduleMasteryRank, moduleStatPreviews } from '../game/catalog'
import { formatCompact } from '../game/format'
import { inspectCore, inspectShard } from '../game/inspect'
import { coreContributionPct, coreDps } from '../game/uiReadout'
import {
  masteryXpToNext,
  moduleMasteryXp,
  masteryMilestoneEffect,
  nextMasteryMilestone,
} from '../game/coreProgression'
import {
  RELIC_SOCKET_LABELS,
  SHARDS,
  canUpgradeRelic,
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
import { coreInstanceAtSlot } from '../game/coreInstances'

const SLOT_LABEL: Record<string, string> = {
  weapon: 'Weapon',
  defense: 'Shield',
  utility: 'Utility',
}

interface CoreSheetProps {
  state: GameState
  compact?: boolean
  /** Relic install/remove/upgrade. Docked-only; omit during a live Sortie. */
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
  onUpgradeRelic?: (relicId: string) => void
  relicsOnly?: boolean
  inspectOnly?: boolean
}

function RelicSocket({
  state,
  moduleId,
  coreInstanceId,
  socketIndex,
  socket,
  onEquipRelic,
  onRemoveRelic,
  onUpgradeRelic,
}: {
  state: GameState
  moduleId: string
  coreInstanceId: string
  socketIndex: number
  socket: RelicSocketClass
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
  onUpgradeRelic?: (relicId: string) => void
}) {
  const label = RELIC_SOCKET_LABELS[socket]
  const fittedId = coreSocketRelics(state, coreInstanceId)[socketIndex] ?? null
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
        <button type="button" onClick={() => onRemoveRelic(coreInstanceId, socketIndex)}>
          Remove Relic
        </button>
      ) : null}
      {canEdit && fittedId && onUpgradeRelic && canUpgradeRelic(state, fittedId).ok ? (
        <button type="button" className="primary" onClick={() => onUpgradeRelic(fittedId)}>
          Upgrade Relic
        </button>
      ) : null}
      {canEdit && onEquipRelic && owned.length > 0 ? (
        <div className="relic-picks">
          {owned.map((shard) => (
            <button
              key={shard.id}
              type="button"
              className="primary"
              onClick={() => onEquipRelic(coreInstanceId, shard.id, socketIndex)}
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

export function RelicSockets({
  state,
  moduleId,
  coreInstanceId = moduleId,
  onEquipRelic,
  onRemoveRelic,
  onUpgradeRelic,
}: {
  state: GameState
  moduleId: string
  coreInstanceId?: string
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
  onUpgradeRelic?: (relicId: string) => void
}) {
  if (!isRelicsUnlocked(state)) return null
  const layout = coreSocketLayout(state, coreInstanceId)
  if (layout.length < 1) return null
  return (
    <div className="relic-sockets">
      {layout.map((socket, index) => (
        <RelicSocket
          key={`${moduleId}-${socket}-${index}`}
          state={state}
          moduleId={moduleId}
          coreInstanceId={coreInstanceId}
          socketIndex={index}
          socket={socket}
          onEquipRelic={onEquipRelic}
          onRemoveRelic={onRemoveRelic}
          onUpgradeRelic={onUpgradeRelic}
        />
      ))}
    </div>
  )
}

function CoreRow({
  state,
  moduleId,
  coreInstanceId,
  onEquipRelic,
  onRemoveRelic,
  onUpgradeRelic,
  relicsOnly = false,
}: {
  state: GameState
  moduleId: string
  coreInstanceId: string
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
  onUpgradeRelic?: (relicId: string) => void
  relicsOnly?: boolean
}) {
  const def = getModule(moduleId)
  if (!def) return null
  const mastery = moduleMasteryRank(state, moduleId)
  const xp = moduleMasteryXp(state, moduleId)
  const need = masteryXpToNext(mastery)
  const next = nextMasteryMilestone(moduleId, mastery)
  const stats = moduleStatPreviews(moduleId, 0, false, mastery)
  const dps = coreDps(state, moduleId, coreInstanceId)
  const share = coreContributionPct(state, moduleId, coreInstanceId)
  const headline = stats.map((s) => `${s.label} ${s.current}`).join(' · ')

  return (
    <article className="core-row" data-guide={`core-${moduleId}`} data-focus={`core-${moduleId}`}>
      <div className="core-row-main">
        <span className="muted">{SLOT_LABEL[def.role] ?? def.role}</span>
        <InspectName name={def.name} card={inspectCore(state, moduleId)} />
        <span className="core-row-lv">Mastery {mastery}</span>
      </div>
      {relicsOnly ? null : (
        <p className="core-row-stats muted">
          {xp} / {need} XP
          {next ? ` · Next M${next.level} ${next.name} — ${masteryMilestoneEffect(next)}` : ''}
        </p>
      )}
      {dps > 0 && !relicsOnly ? (
        <p className="core-row-stats">
          DPS {formatCompact(dps)}
          {share != null ? ` · ${share}%` : ''}
        </p>
      ) : null}
      {headline && !relicsOnly ? <p className="core-row-stats">{headline}</p> : null}
      <RelicSockets
        state={state}
        moduleId={moduleId}
        coreInstanceId={coreInstanceId}
        onEquipRelic={onEquipRelic}
        onRemoveRelic={onRemoveRelic}
        onUpgradeRelic={onUpgradeRelic}
      />
    </article>
  )
}

export function CoreSheet({
  state,
  compact = false,
  onEquipRelic,
  onRemoveRelic,
  onUpgradeRelic,
  relicsOnly = false,
}: CoreSheetProps) {
  return (
    <div className={compact ? 'core-sheet core-sheet-compact' : 'core-sheet'}>
      {state.shipyard.modules.map((moduleId, slot) => (
        <CoreRow
          key={coreInstanceAtSlot(state, slot)?.id ?? `${moduleId}-${slot}`}
          state={state}
          moduleId={moduleId}
          coreInstanceId={coreInstanceAtSlot(state, slot)?.id ?? moduleId}
          onEquipRelic={onEquipRelic}
          onRemoveRelic={onRemoveRelic}
          onUpgradeRelic={onUpgradeRelic}
          relicsOnly={relicsOnly}
        />
      ))}
    </div>
  )
}
