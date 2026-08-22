import { useMemo } from 'react'
import type { GameState, ModuleRole } from '../game/types'
import {
  SHIP_FRAMES,
  SHIP_MODULES,
  canFitModuleOnFrame,
  getFrame,
  getModule,
  moduleLevel,
  moduleMasteryRank,
  trimModulesToFrame,
} from '../game/catalog'
import { hiveResearchExtraUtilitySlots } from '../game/hiveResearch'
import { formatCompact } from '../game/format'
import {
  coreContributionPct,
  coreDps,
  coreShieldOutput,
  formatStatShift,
  previewLoadoutStats,
} from '../game/uiReadout'
import { coreSocketLayout, coreSocketRelics, getShard, isRelicsUnlocked } from '../game/reliquary'
import { inspectCore } from '../game/inspect'
import { InspectName } from './InspectName'

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
  const available = SHIP_FRAMES.filter((f) => state.shipyard.unlockedFrames.includes(f.id))
  const current = getFrame(state.shipyard.frameId)

  return (
    <div className="sheet-overlay" role="dialog" aria-labelledby="frame-sheet-title">
      <div className="sheet-card">
        <header className="modal-header">
          <h3 id="frame-sheet-title">Hive Frame</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        {locked ? <p className="muted">Frame changes are locked until Dock.</p> : null}
        <div className="sheet-scroll">
          {available.map((frame) => {
            const nextModules = trimModulesToFrame(state.shipyard.modules, frame, extra)
            const compare = previewLoadoutStats(state, frame.id, nextModules)
            const selected = frame.id === state.shipyard.frameId
            return (
              <article key={frame.id} className={selected ? 'upgrade-card is-affordable' : 'upgrade-card'}>
                <header className="upgrade-card-head">
                  <strong>{frame.name}</strong>
                  {selected ? <span className="muted">Equipped</span> : null}
                </header>
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
                {!selected ? (
                  <dl className="upgrade-card-stats">
                    <div>
                      <dt>Hull</dt>
                      <dd>{formatStatShift(compare.current.hullMax, compare.next.hullMax)}</dd>
                    </div>
                    <div>
                      <dt>DPS</dt>
                      <dd>{formatStatShift(compare.current.damage, compare.next.damage)}</dd>
                    </div>
                    <div>
                      <dt>Shield</dt>
                      <dd>{formatStatShift(compare.current.shieldMax, compare.next.shieldMax)}</dd>
                    </div>
                  </dl>
                ) : null}
                <button
                  type="button"
                  className="primary"
                  disabled={locked || selected || !onEquip}
                  onClick={() => onEquip?.(frame.id)}
                >
                  {selected ? 'Equipped' : 'Equip'}
                </button>
              </article>
            )
          })}
        </div>
        {current ? <p className="muted">{current.name} is the current hull.</p> : null}
      </div>
    </div>
  )
}

interface CoreDetailSheetProps {
  state: GameState
  moduleId: string
  locked?: boolean
  onChange?: () => void
  onClose: () => void
}

export function CoreDetailSheet({ state, moduleId, locked, onChange, onClose }: CoreDetailSheetProps) {
  const def = getModule(moduleId)
  if (!def) return null
  const mastery = moduleMasteryRank(state, moduleId)
  const dps = coreDps(state, moduleId)
  const share = coreContributionPct(state, moduleId)
  const shield = coreShieldOutput(state, moduleId)
  const sockets = isRelicsUnlocked(state) ? coreSocketLayout(state, moduleId) : []
  const fitted = coreSocketRelics(state, moduleId)
  const nextSocket = mastery < 5 && mastery + 3 >= 5 ? 5 : mastery < 20 && mastery + 5 >= 20 ? 20 : null

  return (
    <div className="sheet-overlay" role="dialog" aria-labelledby="core-detail-title">
      <div className="sheet-card">
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">{ROLE_LABEL[def.role]}</p>
            <h3 id="core-detail-title">
              <InspectName name={def.name} card={inspectCore(state, moduleId)} />
            </h3>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="sheet-scroll">
          <p className="muted">Mastery {mastery}</p>
          <dl className="upgrade-card-stats">
            {dps > 0 ? (
              <div>
                <dt>DPS</dt>
                <dd>{formatCompact(dps)}</dd>
              </div>
            ) : null}
            {share != null && dps > 0 ? (
              <div>
                <dt>Hive share</dt>
                <dd>{share}%</dd>
              </div>
            ) : null}
            {shield > 0 ? (
              <div>
                <dt>Shield</dt>
                <dd>+{formatCompact(shield)}</dd>
              </div>
            ) : null}
            {def.weapon ? (
              <>
                <div>
                  <dt>Range</dt>
                  <dd>{def.weapon.range}</dd>
                </div>
                <div>
                  <dt>Cycle</dt>
                  <dd>{def.weapon.cooldown.toFixed(2)}s</dd>
                </div>
              </>
            ) : null}
          </dl>
          <p>{def.description}</p>
          {sockets.length > 0 ? (
            <div>
              <p className="combat-hud-kicker">Relics</p>
              {sockets.map((socket, index) => {
                const relic = fitted[index] ? getShard(fitted[index]!) : null
                return (
                  <p key={`${socket}-${index}`} className="muted">
                    {relic ? relic.name : `Empty: ${socket}`}
                  </p>
                )
              })}
            </div>
          ) : null}
          {nextSocket ? (
            <p className="muted">Next Mastery milestone: M{nextSocket} · additional socket</p>
          ) : null}
        </div>
        <div className="modal-actions">
          <button type="button" className="primary" disabled={locked || !onChange} onClick={onChange}>
            {locked ? 'Locked until Dock' : 'Change Core'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface CorePickerProps {
  state: GameState
  replaceId?: string
  role?: ModuleRole
  locked?: boolean
  onEquip: (moduleId: string) => void
  onClose: () => void
}

export function CorePicker({ state, replaceId, role, locked, onEquip, onClose }: CorePickerProps) {
  const extra = { utility: hiveResearchExtraUtilitySlots(state) }
  const frame = getFrame(state.shipyard.frameId)
  const current = replaceId ? getModule(replaceId) : null
  const wantRole = role ?? current?.role
  const options = useMemo(
    () =>
      SHIP_MODULES.filter((mod) => {
        if (!state.shipyard.unlockedModules.includes(mod.id)) return false
        if (wantRole && mod.role !== wantRole) return false
        if (state.shipyard.modules.includes(mod.id) && mod.id !== replaceId) return false
        return true
      }),
    [state.shipyard.unlockedModules, state.shipyard.modules, wantRole, replaceId],
  )

  return (
    <div className="sheet-overlay" role="dialog" aria-labelledby="core-picker-title">
      <div className="sheet-card">
        <header className="modal-header">
          <h3 id="core-picker-title">{replaceId ? 'Replace Core' : 'Fit Core'}</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        {locked ? <p className="muted">Loadout changes are locked until Dock.</p> : null}
        <div className="sheet-scroll">
          {options.map((mod) => {
            const without = replaceId
              ? state.shipyard.modules.filter((id) => id !== replaceId)
              : state.shipyard.modules
            const nextModules = frame ? trimModulesToFrame([...without, mod.id], frame, extra) : [...without, mod.id]
            const fits = frame
              ? canFitModuleOnFrame(frame, without, mod.id, extra) || nextModules.includes(mod.id)
              : true
            const compare = previewLoadoutStats(state, state.shipyard.frameId, nextModules)
            const mastery = moduleMasteryRank(state, mod.id)
            const level = moduleLevel(state.shipyard.moduleLevels, mod.id)
            const dps = coreDps(state, mod.id)
            return (
              <article key={mod.id} className={fits ? 'upgrade-card is-affordable' : 'upgrade-card'}>
                <header className="upgrade-card-head">
                  <strong>{mod.name}</strong>
                  <span className="muted">
                    {ROLE_LABEL[mod.role]} · M{mastery} · Lv{level}
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
                  onClick={() => onEquip(mod.id)}
                >
                  Equip
                </button>
              </article>
            )
          })}
          {options.length === 0 ? <p className="muted">No other unlocked Cores for this slot.</p> : null}
        </div>
      </div>
    </div>
  )
}
