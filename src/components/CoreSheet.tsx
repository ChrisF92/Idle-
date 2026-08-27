import type { GameState, RelicSocketSpec } from '../game/types'
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
  canStartRelicUpgrade,
  coreSocketRelics,
  coreSocketViews,
  eligibleRelicsForSocket,
  getRelicInstance,
  inspectRelicEffectText,
  isRelicsUnlocked,
  matureLayoutLine,
  relicFitBlockReason,
  relicFitsSocket,
  relicTierLabel,
  resolveRelicDescriptor,
  socketSpecLabel,
  unfittedRelicInstances,
} from '../game/relics'
import { InspectName } from './InspectName'
import { coreInstanceAtSlot, coreInstanceCopyNumber } from '../game/coreInstances'

const SLOT_LABEL: Record<string, string> = {
  weapon: 'Weapon',
  defense: 'Shield',
  utility: 'Utility',
}

interface CoreSheetProps {
  state: GameState
  compact?: boolean
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
  spec,
  active,
  unlockLabel,
  onEquipRelic,
  onRemoveRelic,
  onUpgradeRelic,
}: {
  state: GameState
  moduleId: string
  coreInstanceId: string
  socketIndex: number
  spec: RelicSocketSpec
  active: boolean
  unlockLabel: string
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
  onUpgradeRelic?: (relicId: string) => void
}) {
  const label = socketSpecLabel(spec)
  const fittedId = coreSocketRelics(state, coreInstanceId)[socketIndex] ?? null
  const fitted = fittedId ? getRelicInstance(state, fittedId) : undefined
  const family = fitted ? resolveRelicDescriptor(fitted.familyId) : undefined
  const docked = Boolean(state.combat.docked)
  const canEdit = docked && active && Boolean(onEquipRelic || onRemoveRelic)
  const owned = eligibleRelicsForSocket(state, coreInstanceId, socketIndex)
  const behaviouralBlocked = unfittedRelicInstances(state).filter((row) => {
    const def = resolveRelicDescriptor(row.familyId)
    if (def?.kind !== 'behavioural') return false
    if (!relicFitsSocket(def.socket, spec)) return false
    return !owned.some((ok) => ok.id === row.id)
  })
  return (
    <div className="relic-socket" data-guide={socketIndex === 0 ? `relic-${moduleId}` : undefined}>
      <p className="core-row-stats">
        <span className="muted">{label} </span>
        {!active ? (
          <span className="muted">{unlockLabel}</span>
        ) : family && fitted ? (
          <>
            <InspectName
              name={`${family.name} ${relicTierLabel(fitted.tier)}`}
              card={inspectShard(state, fitted.id)}
            />
            <span className="muted">
              {' '}
              · {family.kind === 'behavioural' ? 'Behavioural' : 'Standard'} · {inspectRelicEffectText(family.id)}
            </span>
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
      {canEdit && fittedId && onUpgradeRelic && canStartRelicUpgrade(state, fittedId).ok ? (
        <button type="button" className="primary" onClick={() => onUpgradeRelic(fittedId)}>
          Upgrade Relic
        </button>
      ) : canEdit && fittedId && onUpgradeRelic ? (
        <p className="muted">{canStartRelicUpgrade(state, fittedId).reason}</p>
      ) : null}
      {canEdit && onEquipRelic && owned.length > 0 ? (
        <div className="relic-picks">
          {owned.map((row) => {
            const def = resolveRelicDescriptor(row.familyId)
            return (
              <button
                key={row.id}
                type="button"
                className="primary"
                onClick={() => onEquipRelic(coreInstanceId, row.id, socketIndex)}
              >
                {def?.name ?? row.familyId} {relicTierLabel(row.tier)}
                <span className="muted">
                  {' '}
                  · {def?.kind === 'behavioural' ? 'Behavioural' : 'Standard'} · {row.id}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
      {canEdit && onEquipRelic && behaviouralBlocked.length > 0 ? (
        <div className="relic-picks">
          {behaviouralBlocked.map((row) => {
            const def = resolveRelicDescriptor(row.familyId)
            return (
              <button key={row.id} type="button" disabled title={relicFitBlockReason('behavioural-limit')}>
                {def?.name ?? row.familyId} {relicTierLabel(row.tier)}
                <span className="muted"> · Behavioural · {relicFitBlockReason('behavioural-limit')}</span>
              </button>
            )
          })}
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
  const views = coreSocketViews(state, coreInstanceId)
  if (views.length < 1) return null
  return (
    <div className="relic-sockets">
      <p className="muted">Mature layout: {matureLayoutLine(moduleId)}</p>
      {views.map((row) => (
        <RelicSocket
          key={`${moduleId}-${row.spec.type}-${row.index}`}
          state={state}
          moduleId={moduleId}
          coreInstanceId={coreInstanceId}
          socketIndex={row.index}
          spec={row.spec}
          active={row.active}
          unlockLabel={row.unlockLabel}
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
  const copies = state.shipyard.coreInstances.filter((row) => row.moduleId === moduleId).length
  const copy = coreInstanceCopyNumber(state, coreInstanceId)
  const title = copies > 1 ? `${def.name} #${copy}` : def.name

  return (
    <article className="core-row" data-guide={`core-${moduleId}`} data-focus={`core-${moduleId}`}>
      <div className="core-row-main">
        <span className="muted">{SLOT_LABEL[def.role] ?? def.role}</span>
        <InspectName name={title} card={inspectCore(state, moduleId)} />
        <span className="core-row-lv">Mastery {mastery}</span>
      </div>
      <p className="muted">{coreInstanceId}</p>
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
