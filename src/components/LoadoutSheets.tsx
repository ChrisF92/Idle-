import type { GameState } from '../game/types'
import {
  type ModuleRole,
  SHIP_FRAMES,
  SHIP_MODULES,
  canFitModuleOnFrame,
  frameUnlockLine,
  getFrame,
  getModule,
  moduleMasteryRank,
  trimModulesToFrame,
} from '../game/catalog'
import { usableCoreSlots } from '../game/coreSlots'
import {
  moduleMasteryXp,
  masteryXpToNext,
  masteryMilestonesFor,
  masteryMilestoneEffect,
  nextMasteryMilestone,
  CORE_START_LEVEL_CAP,
  coreStartingLevel,
  coreStartingUpgradeCost,
} from '../game/coreProgression'
import { targetingProfileFor } from '../game/targetingProfiles'
import { formatCompact } from '../game/format'
import {
  coreContributionPct,
  coreDps,
  coreShieldOutput,
  formatStatShift,
  previewLoadoutStats,
} from '../game/uiReadout'
import { coreCopyBreakdown } from '../game/inventory'
import { inspectCore } from '../game/inspect'
import { InspectName } from './InspectName'
import { BottomSheet, Kicker, StatPair } from '../ui/primitives'
import {
  availableCoreInstances,
  coreInstanceCopyNumber,
} from '../game/coreInstances'

const ROLE_LABEL: Record<ModuleRole, string> = {
  weapon: 'Weapon',
  defense: 'Defense',
  utility: 'Utility',
}

interface FrameSheetProps {
  state: GameState
  locked?: boolean
  onEquip?: (frameId: string) => void
  onClose: () => void
}

export function FrameSheet({ state, locked, onEquip, onClose }: FrameSheetProps) {
  const current = getFrame(state.shipyard.frameId)
  const slotsNow = usableCoreSlots(state)

  return (
    <BottomSheet open title="Hive Frame" onClose={onClose} overlayId="frame-sheet" size="full">
        {locked ? <p className="muted">Frame changes are locked until Dock.</p> : null}
          {SHIP_FRAMES.map((frame) => {
            const owned = state.shipyard.unlockedFrames.includes(frame.id)
            const nextSlots = usableCoreSlots(state, frame.id)
            const nextModules = trimModulesToFrame(state.shipyard.modules, nextSlots)
            const compare = previewLoadoutStats(state, frame.id, nextModules)
            const selected = frame.id === state.shipyard.frameId
            return (
              <article key={frame.id} className={selected ? 'upgrade-card is-affordable' : 'upgrade-card'}>
                <header className="upgrade-card-head">
                  <strong>{frame.name}</strong>
                  {selected ? <span className="muted">Equipped</span> : owned ? null : <span className="muted">Locked</span>}
                </header>
                <p>{frame.identity}</p>
                <p className="muted">{frame.tradeoff}</p>
                <p className="muted">{frame.description}</p>
                <dl className="upgrade-card-stats">
                  <div>
                    <dt>Hull</dt>
                    <dd>{formatCompact(frame.baseHull)}</dd>
                  </div>
                  <div>
                    <dt>Core slots</dt>
                    <dd>{nextSlots}</dd>
                  </div>
                </dl>
                {owned && !selected ? (
                  <dl className="upgrade-card-stats">
                    <div>
                      <dt>Hull</dt>
                      <dd>{formatStatShift(compare.current.hullMax, compare.next.hullMax)}</dd>
                    </div>
                    <div>
                      <dt>Shield</dt>
                      <dd>{formatStatShift(compare.current.shieldMax, compare.next.shieldMax)}</dd>
                    </div>
                    <div>
                      <dt>DPS</dt>
                      <dd>{formatStatShift(compare.current.damage, compare.next.damage)}</dd>
                    </div>
                    <div>
                      <dt>Slots</dt>
                      <dd>{formatStatShift(slotsNow, nextSlots)}</dd>
                    </div>
                  </dl>
                ) : null}
                {!owned ? <p className="muted">{frameUnlockLine(frame)}</p> : null}
                <button
                  type="button"
                  className="primary"
                  disabled={locked || selected || !owned || !onEquip}
                  onClick={() => onEquip?.(frame.id)}
                >
                  {selected ? 'Equipped' : owned ? 'Equip' : 'Locked'}
                </button>
              </article>
            )
          })}
        {current ? <p className="muted">{current.name} is the current Frame.</p> : null}
    </BottomSheet>
  )
}

interface CoreDetailSheetProps {
  state: GameState
  moduleId: string
  coreInstanceId?: string
  locked?: boolean
  onChange?: () => void
  onClose: () => void
  onUpgradeCore?: (coreInstanceId: string, count?: number) => void
}

export function CoreDetailSheet({
  state,
  moduleId,
  coreInstanceId = moduleId,
  locked,
  onChange,
  onClose,
  onUpgradeCore,
}: CoreDetailSheetProps) {
  const def = getModule(moduleId)
  if (!def) return null
  const mastery = moduleMasteryRank(state, moduleId)
  const dps = coreDps(state, moduleId, coreInstanceId)
  const share = coreContributionPct(state, moduleId, coreInstanceId)
  const shield = coreShieldOutput(state, moduleId, coreInstanceId)
  const xp = moduleMasteryXp(state, moduleId)
  const need = masteryXpToNext(mastery)
  const next = nextMasteryMilestone(moduleId, mastery)
  const milestones = masteryMilestonesFor(moduleId)
  const copyCount = state.shipyard.coreInstances.filter(
    (instance) => instance.moduleId === moduleId,
  ).length
  const copyLabel =
    copyCount > 1 ? ` · Copy ${coreInstanceCopyNumber(state, coreInstanceId)}` : ''
  const coreLevel = coreStartingLevel(state, coreInstanceId)
  const coreUpgradeCost = coreStartingUpgradeCost(state, coreInstanceId)
  const coreMaxed = coreLevel >= CORE_START_LEVEL_CAP
  const canAffordCore = (state.resources.scrap ?? 0) >= coreUpgradeCost

  return (
    <BottomSheet
      open
      title={<InspectName name={def.name} card={inspectCore(state, moduleId)} />}
      kicker={`${ROLE_LABEL[def.role]} Core${copyLabel}`}
      onClose={onClose}
      overlayId={`core-detail-${moduleId}`}
      size="full"
      footer={
        <button type="button" className="primary" disabled={locked || !onChange} onClick={onChange}>
          {locked ? 'Locked until Dock' : 'Change Core'}
        </button>
      }
    >
      <Kicker>Mastery {mastery}</Kicker>
      <span className="ui-progress" aria-hidden>
        <span style={{ transform: `scaleX(${need > 0 ? Math.min(1, xp / need) : 1})` }} />
      </span>
      <p className="ui-meta">
        {xp} / {need} XP
      </p>
      <p>{def.identity}</p>
      <p className="muted">{def.description}</p>
      <p className="ui-meta">Instance {coreInstanceId}</p>
      {(() => {
        const profile = targetingProfileFor(moduleId)
        if (profile.fireRange <= 0) return null
        return (
          <div className="ui-context-bar">
            <StatPair label="Doctrine" value={profile.defaultDoctrine} />
            <StatPair label="Arc" value={`${profile.firingArcDeg}°`} />
            <StatPair label="Slew" value={profile.slewClass} />
          </div>
        )
      })()}
      <div className="ui-context-bar">
        <StatPair label="Core level" value={`${coreLevel} / ${CORE_START_LEVEL_CAP}`} />
        <StatPair label="Mastery" value={mastery} />
        {dps > 0 ? <StatPair label="Primary output" value={`${formatCompact(dps)} DPS`} /> : null}
        {shield > 0 ? <StatPair label="Shield" value={`+${formatCompact(shield)}`} /> : null}
        {share != null && dps > 0 ? <StatPair label="Hive share" value={`${share}%`} /> : null}
      </div>
      {onUpgradeCore ? (
        <button
          type="button"
          className="primary"
          disabled={locked || coreMaxed || !canAffordCore}
          onClick={() => onUpgradeCore(coreInstanceId, 1)}
        >
          {coreMaxed
            ? 'Core Level Maxed'
            : canAffordCore
              ? `Upgrade Core · ${formatCompact(coreUpgradeCost)} Scrap`
              : `Need ${formatCompact(coreUpgradeCost)} Scrap`}
        </button>
      ) : null}
      {def.weapon ? (
        <div className="ui-context-bar">
          <StatPair label="Damage" value={formatCompact(def.weapon.damage)} />
          <StatPair label="Cycle" value={`${def.weapon.cooldown.toFixed(2)}s`} />
          <StatPair label="Range" value={def.weapon.range} />
        </div>
      ) : null}
      <section className="mastery-track" aria-label="Mastery milestones">
        <Kicker>Milestones</Kicker>
        {milestones.map((ms) => {
          const unlocked = mastery >= ms.level
          const upcoming = next?.level === ms.level
          return (
            <article
              key={`${moduleId}-${ms.level}`}
              className={`mastery-ms${unlocked ? ' is-unlocked' : ''}${upcoming ? ' is-next' : ''}`}
            >
              <strong>
                M{ms.level} · {ms.name}
              </strong>
              <span className="ui-meta">{unlocked ? 'Unlocked' : upcoming ? 'Next' : 'Locked'}</span>
              <p>{masteryMilestoneEffect(ms)}</p>
            </article>
          )
        })}
      </section>
    </BottomSheet>
  )
}

interface CorePickerProps {
  state: GameState
  replaceId?: string
  replaceCoreInstanceId?: string
  role?: ModuleRole
  locked?: boolean
  onEquip: (moduleId: string, coreInstanceId: string) => void
  onClose: () => void
}

export function CorePicker({
  state,
  replaceId,
  replaceCoreInstanceId,
  role: _role,
  locked,
  onEquip,
  onClose,
}: CorePickerProps) {
  const slots = usableCoreSlots(state)
  const replaceSlot = replaceCoreInstanceId
    ? state.shipyard.equippedCoreIds.indexOf(replaceCoreInstanceId)
    : replaceId
      ? state.shipyard.modules.lastIndexOf(replaceId)
      : -1
  const without =
    replaceSlot >= 0
      ? state.shipyard.modules.filter((_, index) => index !== replaceSlot)
      : state.shipyard.modules
  const options = availableCoreInstances(state, undefined, replaceCoreInstanceId)
    .filter((instance) => instance.id !== replaceCoreInstanceId)
    .flatMap((instance) => {
      const mod = SHIP_MODULES.find((candidate) => candidate.id === instance.moduleId)
      if (!mod || !state.shipyard.unlockedModules.includes(mod.id)) return []
      if (!canFitModuleOnFrame(without, mod.id, slots)) return []
      return [{ mod, coreInstanceId: instance.id }]
    })

  return (
    <BottomSheet
      open
      title={replaceId ? 'Replace Core' : 'Fit Core'}
      onClose={onClose}
      overlayId="core-picker"
      size="full"
    >
        {locked ? <p className="muted">Loadout changes are locked until Dock.</p> : null}
          {options.map(({ mod, coreInstanceId }) => {
            const nextModules = trimModulesToFrame([...without, mod.id], slots)
            const fits = canFitModuleOnFrame(without, mod.id, slots)
            const compare = previewLoadoutStats(state, state.shipyard.frameId, nextModules)
            const mastery = moduleMasteryRank(state, mod.id)
            const dps = coreDps(state, mod.id)
            const copies = coreCopyBreakdown(state, mod.id)
            return (
              <article key={coreInstanceId} className={fits ? 'upgrade-card is-affordable' : 'upgrade-card'}>
                <header className="upgrade-card-head">
                  <strong>{mod.name}</strong>
                  <span className="muted">
                    Copy {coreInstanceCopyNumber(state, coreInstanceId)} · {ROLE_LABEL[mod.role]} · Lv
                    {coreStartingLevel(state, coreInstanceId)} · Mastery {mastery}
                    {copies ? ` · ×${copies.owned} · Eq ${copies.equipped}` : ''}
                  </span>
                </header>
                <p>{mod.identity}</p>
                <p className="muted">{mod.description}</p>
                {dps > 0 ? <p>DPS {formatCompact(dps)}</p> : null}
                {fits ? (
                  <dl className="upgrade-card-stats">
                    <div>
                      <dt>DPS</dt>
                      <dd>{formatStatShift(compare.current.damage, compare.next.damage)}</dd>
                    </div>
                    <div>
                      <dt>Hull</dt>
                      <dd>{formatStatShift(compare.current.hullMax, compare.next.hullMax)}</dd>
                    </div>
                    <div>
                      <dt>Shield</dt>
                      <dd>{formatStatShift(compare.current.shieldMax, compare.next.shieldMax)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="muted">No free universal Core slot on this Frame.</p>
                )}
                <button
                  type="button"
                  className="primary"
                  disabled={locked || !fits}
                  onClick={() => onEquip(mod.id, coreInstanceId)}
                >
                  Equip
                </button>
              </article>
            )
          })}
          {options.length === 0 ? <p className="muted">No other unlocked Cores for this slot.</p> : null}
    </BottomSheet>
  )
}
