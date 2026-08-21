import type { GameState } from '../game/types'
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
  SHARDS,
  coreRelicId,
  getShard,
  isRelicsUnlocked,
  relicSocketCount,
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
  onEquipRelic?: (moduleId: string, relicId: string) => void
  onRemoveRelic?: (moduleId: string) => void
  /** Hide Salvage ranks and show Relic sockets only. */
  relicsOnly?: boolean
}

function RelicSocket({
  state,
  moduleId,
  onEquipRelic,
  onRemoveRelic,
}: {
  state: GameState
  moduleId: string
  onEquipRelic?: (moduleId: string, relicId: string) => void
  onRemoveRelic?: (moduleId: string) => void
}) {
  if (!isRelicsUnlocked(state) || relicSocketCount(state, moduleId) < 1) return null
  const fittedId = coreRelicId(state, moduleId)
  const fitted = fittedId ? getShard(fittedId) : undefined
  const docked = Boolean(state.combat.docked)
  const canEdit = docked && Boolean(onEquipRelic || onRemoveRelic)
  const owned = SHARDS.filter((shard) => shardOwned(state, shard.id) > 0 && shard.id !== fittedId)
  return (
    <div className="relic-socket" data-guide={`relic-${moduleId}`}>
      <p className="core-row-stats">
        <span className="muted">Relic </span>
        {fitted ? (
          <>
            <InspectName name={fitted.name} card={inspectShard(state, fitted.id)} />
            <span className="muted"> · {shardEffectBlurb(fitted)}</span>
          </>
        ) : (
          <span className="muted">{docked ? 'Empty socket' : 'Empty — install at Dock'}</span>
        )}
      </p>
      {canEdit && fitted && onRemoveRelic ? (
        <button type="button" onClick={() => onRemoveRelic(moduleId)}>
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
              onClick={() => onEquipRelic(moduleId, shard.id)}
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

function CoreRow({
  state,
  moduleId,
  onUpgrade,
  onPickMilestone,
  onEquipRelic,
  onRemoveRelic,
  relicsOnly = false,
}: {
  state: GameState
  moduleId: string
  onUpgrade: (moduleId: string) => void
  onPickMilestone: (moduleId: string, milestoneId: string, choiceId: string) => void
  onEquipRelic?: (moduleId: string, relicId: string) => void
  onRemoveRelic?: (moduleId: string) => void
  relicsOnly?: boolean
}) {
  const def = getModule(moduleId)
  const level = moduleLevel(state.shipyard.moduleLevels, moduleId)
  const cost = moduleUpgradeCost(level, moduleId, protocolCoreScalingAdd(state, def?.role))
  const maxed = level >= MAX_MODULE_LEVEL
  const can = Boolean(def) && !maxed && state.resources.salvage >= cost
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
      <RelicSocket
        state={state}
        moduleId={moduleId}
        onEquipRelic={onEquipRelic}
        onRemoveRelic={onRemoveRelic}
      />
      {relicsOnly ? null : pending ? (
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
          {maxed ? 'Maxed' : `Upgrade · ${formatCompact(cost)} Salvage`}
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
}: CoreSheetProps) {
  return (
    <div className={compact ? 'core-sheet core-sheet-compact' : 'core-sheet'}>
      {onBuyMax && !relicsOnly ? (
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
        />
      ))}
    </div>
  )
}
