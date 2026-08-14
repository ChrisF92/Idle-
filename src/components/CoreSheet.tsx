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
}

export function CoreSheet({
  state,
  onUpgrade,
  onPickMilestone,
  compact = false,
}: CoreSheetProps) {
  return (
    <div className={compact ? 'core-sheet core-sheet-compact' : 'core-sheet'}>
      {state.shipyard.modules.map((moduleId) => {
        const def = getModule(moduleId)
        if (!def) return null
        const level = moduleLevel(state.shipyard.moduleLevels, moduleId)
        const cost = moduleUpgradeCost(level, moduleId)
        const maxed = level >= MAX_MODULE_LEVEL
        const can = !maxed && state.resources.salvage >= cost
        const pending = pendingMilestone(moduleId, level, state.shipyard.corePicks?.[moduleId])
        const stats = moduleStatPreviews(moduleId, level, !maxed)
        const headline = stats
          .filter((s) => s.label === 'Damage' || s.label === 'Shield' || s.label === 'RoF')
          .map((s) => `${s.label} ${s.current}${s.next ? `→${s.next}` : ''}`)
          .join(' · ')

        return (
          <article key={moduleId} className="core-row">
            <div className="core-row-main">
              <span className="muted">{SLOT_LABEL[def.role] ?? def.role}</span>
              <strong>{def.name}</strong>
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
                onClick={() => onUpgrade(moduleId)}
              >
                {maxed ? 'Maxed' : `Lv up · ${formatCompact(cost)} salvage`}
              </button>
            )}
          </article>
        )
      })}
    </div>
  )
}
