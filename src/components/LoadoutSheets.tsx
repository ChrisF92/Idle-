import { useMemo } from 'react'
import type { GameState } from '../game/types'
import {
  type ModuleRole,
  SHIP_FRAMES,
  SHIP_MODULES,
  canFitModuleOnFrame,
  frameTotalSlots,
  frameUnlockLine,
  getFrame,
  getModule,
  moduleMasteryRank,
  trimModulesToFrame,
} from '../game/catalog'
import {
  moduleMasteryXp,
  masteryXpToNext,
  masteryMilestonesFor,
  masteryMilestoneEffect,
  nextMasteryMilestone,
} from '../game/coreProgression'
import { hiveResearchExtraUtilitySlots } from '../game/hiveResearch'
import { formatCompact } from '../game/format'
import {
  coreContributionPct,
  coreDps,
  coreShieldOutput,
  formatStatShift,
  previewLoadoutStats,
} from '../game/uiReadout'
import { isRelicsUnlocked } from '../game/reliquary'
import { coreCopyBreakdown } from '../game/inventory'
import { inspectCore } from '../game/inspect'
import { InspectName } from './InspectName'
import { RelicSockets } from './CoreSheet'
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
  const extra = { utility: hiveResearchExtraUtilitySlots(state) }
  const current = getFrame(state.shipyard.frameId)

  return (
    <BottomSheet open title="Hive Frame" onClose={onClose} overlayId="frame-sheet" size="full">
        {locked ? <p className="muted">Frame changes are locked until Dock.</p> : null}
          {SHIP_FRAMES.map((frame) => {
            const owned = state.shipyard.unlockedFrames.includes(frame.id)
            const nextModules = trimModulesToFrame(state.shipyard.modules, frame, extra)
            const compare = previewLoadoutStats(state, frame.id, nextModules)
            const selected = frame.id === state.shipyard.frameId
            const slotsNow = current ? frameTotalSlots(current) + extra.utility : 0
            const slotsNext = frameTotalSlots(frame) + extra.utility
            return (
              <article key={frame.id} className={selected ? 'upgrade-card is-affordable' : 'upgrade-card'}>
                <header className="upgrade-card-head">
                  <strong>{frame.name}</strong>
                  {selected ? <span className="muted">Equipped</span> : owned ? null : <span className="muted">Locked</span>}
                </header>
                <p className="muted">{frame.description}</p>
                <dl className="upgrade-card-stats">
                  <div>
                    <dt>Hull</dt>
                    <dd>{formatCompact(frame.baseHull)}</dd>
                  </div>
                  <div>
                    <dt>Weapon</dt>
                    <dd>{frame.weaponSlots}</dd>
                  </div>
                  <div>
                    <dt>Defense</dt>
                    <dd>{frame.defenseSlots}</dd>
                  </div>
                  <div>
                    <dt>Utility</dt>
                    <dd>{frame.utilitySlots + extra.utility}</dd>
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
                      <dd>{formatStatShift(slotsNow, slotsNext)}</dd>
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
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
  onUpgradeRelic?: (relicId: string) => void
}

export function CoreDetailSheet({
  state,
  moduleId,
  coreInstanceId = moduleId,
  locked,
  onChange,
  onClose,
  onEquipRelic,
  onRemoveRelic,
  onUpgradeRelic,
}: CoreDetailSheetProps) {
  const def = getModule(moduleId)
  if (!def) return null
  const mastery = moduleMasteryRank(state, moduleId)
  const dps = coreDps(state, moduleId)
  const share = coreContributionPct(state, moduleId)
  const shield = coreShieldOutput(state, moduleId)
  const xp = moduleMasteryXp(state, moduleId)
  const need = masteryXpToNext(mastery)
  const next = nextMasteryMilestone(moduleId, mastery)
  const milestones = masteryMilestonesFor(moduleId)
  const copyCount = state.shipyard.coreInstances.filter(
    (instance) => instance.moduleId === moduleId,
  ).length
  const copyLabel =
    copyCount > 1 ? ` · Copy ${coreInstanceCopyNumber(state, coreInstanceId)}` : ''

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
      <div className="ui-context-bar">
        {dps > 0 ? <StatPair label="Primary output" value={`${formatCompact(dps)} DPS`} /> : null}
        {shield > 0 ? <StatPair label="Shield" value={`+${formatCompact(shield)}`} /> : null}
        {share != null && dps > 0 ? <StatPair label="Hive share" value={`${share}%`} /> : null}
      </div>
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
      {isRelicsUnlocked(state) ? (
        <RelicSockets
          state={state}
          moduleId={moduleId}
        coreInstanceId={coreInstanceId}
          onEquipRelic={locked ? undefined : onEquipRelic}
          onRemoveRelic={locked ? undefined : onRemoveRelic}
          onUpgradeRelic={locked ? undefined : onUpgradeRelic}
        />
      ) : null}
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
  role,
  locked,
  onEquip,
  onClose,
}: CorePickerProps) {
  const extra = { utility: hiveResearchExtraUtilitySlots(state) }
  const frame = getFrame(state.shipyard.frameId)
  const current = replaceId ? getModule(replaceId) : null
  const wantRole = role ?? current?.role
  const replaceSlot = replaceCoreInstanceId
    ? state.shipyard.equippedCoreIds.indexOf(replaceCoreInstanceId)
    : replaceId
      ? state.shipyard.modules.lastIndexOf(replaceId)
      : -1
  const without =
    replaceSlot >= 0
      ? state.shipyard.modules.filter((_, index) => index !== replaceSlot)
      : state.shipyard.modules
  const options = useMemo(
    () =>
      availableCoreInstances(state, undefined, replaceCoreInstanceId)
        .filter((instance) => instance.id !== replaceCoreInstanceId)
        .flatMap((instance) => {
          const mod = SHIP_MODULES.find((candidate) => candidate.id === instance.moduleId)
          if (!mod || !state.shipyard.unlockedModules.includes(mod.id)) return []
          if (wantRole && mod.role !== wantRole) return []
          if (frame && !canFitModuleOnFrame(frame, without, mod.id, extra)) return []
          return [{ mod, coreInstanceId: instance.id }]
        }),
    [state, wantRole, replaceCoreInstanceId, frame, without, extra],
  )

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
            const nextModules = frame ? trimModulesToFrame([...without, mod.id], frame, extra) : [...without, mod.id]
            const fits = frame
              ? canFitModuleOnFrame(frame, without, mod.id, extra)
              : true
            const compare = previewLoadoutStats(state, state.shipyard.frameId, nextModules)
            const mastery = moduleMasteryRank(state, mod.id)
            const dps = coreDps(state, mod.id)
            const copies = coreCopyBreakdown(state, mod.id)
            return (
              <article key={coreInstanceId} className={fits ? 'upgrade-card is-affordable' : 'upgrade-card'}>
                <header className="upgrade-card-head">
                  <strong>{mod.name}</strong>
                  <span className="muted">
                    Copy {coreInstanceCopyNumber(state, coreInstanceId)} · {ROLE_LABEL[mod.role]} · Mastery {mastery}
                    {copies ? ` · ×${copies.owned} · Eq ${copies.equipped}` : ''}
                  </span>
                </header>
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
                  <p className="muted">No free {ROLE_LABEL[mod.role]} slot on this Frame.</p>
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
