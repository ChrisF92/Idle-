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
import { inspectCore } from '../game/inspect'
import { protocolCoreScalingAdd } from '../game/protocols'
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
}

function CoreRow({
  state,
  moduleId,
  onUpgrade,
  onPickMilestone,
}: {
  state: GameState
  moduleId: string
  onUpgrade: (moduleId: string) => void
  onPickMilestone: (moduleId: string, milestoneId: string, choiceId: string) => void
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
      {headline ? <p className="core-row-stats">{headline}</p> : null}
      {pending ? (
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
}: CoreSheetProps) {
  return (
    <div className={compact ? 'core-sheet core-sheet-compact' : 'core-sheet'}>
      {onBuyMax ? (
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
        />
      ))}
    </div>
  )
}
