import { useMemo, useState } from 'react'
import type { GameState, Resources } from '../../game/types'
import {
  MAX_MODULE_LEVEL,
  SHIP_FRAMES,
  SHIP_MODULES,
  canFitModuleOnFrame,
  fittedRoleSlotCounts,
  frameTotalSlots,
  getFrame,
  moduleLevel,
  moduleStatPreviews,
  moduleUpgradeCost,
  type ModuleRole,
  type ShipModuleDef,
} from '../../game/catalog'
import { careerHighestSector } from '../../game/progression'
import { RESOURCE_LABELS, computeShipStats } from '../../game/state'

type RoleFilter = 'all' | ModuleRole

const ROLE_ORDER: ModuleRole[] = ['weapon', 'defense', 'utility']
const ROLE_LABEL: Record<ModuleRole, string> = {
  weapon: 'Weapons',
  defense: 'Defense',
  utility: 'Utility',
}
const ROLE_TAG: Record<ModuleRole, string> = {
  weapon: 'W',
  defense: 'D',
  utility: 'U',
}

interface ShipyardTabProps {
  state: GameState
  onUnlockFrame: (frameId: string) => void
  onSelectFrame: (frameId: string) => void
  onUnlockModule: (moduleId: string) => void
  onFitModule: (moduleId: string) => void
  onUnfitModule: (moduleId: string) => void
  onUpgradeModule: (moduleId: string) => void
  onUnequipAll: () => void
  onUpgradeCheapest: () => void
}

function costLabel(cost: Partial<Record<keyof Resources, number>>): string {
  const parts = Object.entries(cost)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${v} ${RESOURCE_LABELS[k as keyof Resources]}`)
  return parts.length ? parts.join(', ') : 'Free'
}

function slotLine(weapon: number, defense: number, utility: number): string {
  return `${weapon}W / ${defense}D / ${utility}U`
}

export function ShipyardTab({
  state,
  onUnlockFrame,
  onSelectFrame,
  onUnlockModule,
  onFitModule,
  onUnfitModule,
  onUpgradeModule,
  onUnequipAll,
  onUpgradeCheapest,
}: ShipyardTabProps) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const frame = getFrame(state.shipyard.frameId)
  const stats = computeShipStats(state)
  const used = fittedRoleSlotCounts(state.shipyard.modules)
  const slotsUsed = state.shipyard.modules.length
  const slotsMax = frame ? frameTotalSlots(frame) : 0
  const frameLocked = state.shipyard.frameLocked
  const canRefitModules = !state.combat.inFight
  const ever = careerHighestSector(state)
  const canBatch = state.ai.purchased.includes('batch-refit')
  const canSalvageOpt = state.ai.purchased.includes('salvage-optimizer')

  const grouped = useMemo(() => {
    const list =
      roleFilter === 'all'
        ? [...SHIP_MODULES].sort(
            (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
          )
        : SHIP_MODULES.filter((m) => m.role === roleFilter)
    const map = new Map<ModuleRole, ShipModuleDef[]>()
    for (const role of ROLE_ORDER) map.set(role, [])
    for (const m of list) map.get(m.role)?.push(m)
    return ROLE_ORDER.map((role) => ({ role, modules: map.get(role) ?? [] })).filter(
      (g) => g.modules.length > 0,
    )
  }, [roleFilter])

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Shipyard</h2>
        <p>
          Choose a frame before your first Launch (locked until prestige / challenge). Dock anytime
          to refit modules within that frame&apos;s W/D/U slots.
        </p>
      </header>

      {state.combat.inFight ? (
        <p className="notice-warn">In fight — Dock from the Combat tab to refit modules.</p>
      ) : state.combat.docked ? (
        <p className="notice">
          Docked — {frameLocked ? 'frame locked · ' : 'pick a frame, then '}
          fit modules while the hangar repairs hull.
        </p>
      ) : null}

      {frameLocked ? (
        <p className="notice-warn">
          Frame locked for this run. Prestige or enter a challenge to choose a different frame.
        </p>
      ) : (
        <p className="muted">
          Frame unlocked until Launch — changing frames may unequip modules that no longer fit.
        </p>
      )}

      <div className="stat-row">
        <div>
          <span className="muted">Fleet DPS</span>
          <strong>{stats.damage.toFixed(1)}</strong>
        </div>
        <div>
          <span className="muted">Hull</span>
          <strong>{Math.round(stats.hullMax)}</strong>
        </div>
        <div>
          <span className="muted">Shield</span>
          <strong>{Math.round(stats.shieldMax)}</strong>
        </div>
        <div>
          <span className="muted">Salvage</span>
          <strong>{state.resources.salvage.toFixed(0)}</strong>
        </div>
        <div>
          <span className="muted">Slots</span>
          <strong>
            {slotsUsed}/{slotsMax}
          </strong>
        </div>
      </div>

      {frame ? (
        <p className="muted">
          Fitted roles: {slotLine(used.weapon, used.defense, used.utility)} of{' '}
          {slotLine(frame.weaponSlots, frame.defenseSlots, frame.utilitySlots)}
        </p>
      ) : null}

      {(canBatch || canSalvageOpt) && canRefitModules ? (
        <p className="assign-row">
          {canBatch ? (
            <button type="button" onClick={onUnequipAll}>
              Unequip All
            </button>
          ) : null}
          {canSalvageOpt ? (
            <button type="button" className="primary" onClick={onUpgradeCheapest}>
              Upgrade Cheapest
            </button>
          ) : null}
        </p>
      ) : null}

      <h3>Frames</h3>
      <ul className="def-list">
        {SHIP_FRAMES.map((f) => {
          const unlocked = state.shipyard.unlockedFrames.includes(f.id)
          const active = state.shipyard.frameId === f.id
          const gated = (f.requiresSectorEver ?? 0) > ever
          const canUnlock =
            !unlocked &&
            !gated &&
            Object.entries(f.unlockCost).every(
              ([k, v]) => state.resources[k as keyof Resources] >= (v ?? 0),
            )
          const canSelect = unlocked && !active && !frameLocked
          return (
            <li key={f.id} data-guide={`frame-${f.id.replace('-frame', '')}`}>
              <div>
                <strong>{f.name}</strong>
                <p className="muted">
                  {slotLine(f.weaponSlots, f.defenseSlots, f.utilitySlots)} · {f.baseDamage} dmg ·{' '}
                  {f.baseHull} hull
                </p>
                {!unlocked ? (
                  gated ? (
                    <p className="notice-warn">Clear sector {f.requiresSectorEver} to unlock.</p>
                  ) : (
                    <p className="muted">Unlock: {costLabel(f.unlockCost)}</p>
                  )
                ) : null}
              </div>
              <div className="action-col">
                <span className="badge">
                  {active
                    ? frameLocked
                      ? 'Active · Locked'
                      : 'Active'
                    : unlocked
                      ? 'Owned'
                      : 'Locked'}
                </span>
                {!unlocked ? (
                  <button type="button" disabled={!canUnlock} onClick={() => onUnlockFrame(f.id)}>
                    Unlock
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canSelect}
                    title={
                      frameLocked
                        ? 'Frame locked until prestige / challenge'
                        : active
                          ? 'Already selected'
                          : 'Select this frame'
                    }
                    onClick={() => onSelectFrame(f.id)}
                  >
                    {active ? 'Selected' : frameLocked ? 'Locked' : 'Select'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="module-section-header">
        <h3>Modules</h3>
        <div className="role-filters" role="group" aria-label="Filter modules by role">
          {(
            [
              ['all', 'All'],
              ['weapon', 'W'],
              ['defense', 'D'],
              ['utility', 'U'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={roleFilter === id ? 'role-filter active' : 'role-filter'}
              aria-pressed={roleFilter === id}
              onClick={() => setRoleFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {grouped.map(({ role, modules }) => (
        <div key={role} className="module-group">
          {roleFilter === 'all' ? <h4 className="module-group-title">{ROLE_LABEL[role]}</h4> : null}
          <ul className="module-list">
            {modules.map((m) => (
              <ModuleCard
                key={m.id}
                module={m}
                state={state}
                frame={frame}
                ever={ever}
                canRefitModules={canRefitModules}
                onUnlockModule={onUnlockModule}
                onFitModule={onFitModule}
                onUnfitModule={onUnfitModule}
                onUpgradeModule={onUpgradeModule}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function ModuleCard({
  module: m,
  state,
  frame,
  ever,
  canRefitModules,
  onUnlockModule,
  onFitModule,
  onUnfitModule,
  onUpgradeModule,
}: {
  module: ShipModuleDef
  state: GameState
  frame: ReturnType<typeof getFrame>
  ever: number
  canRefitModules: boolean
  onUnlockModule: (id: string) => void
  onFitModule: (id: string) => void
  onUnfitModule: (id: string) => void
  onUpgradeModule: (id: string) => void
}) {
  const unlocked = state.shipyard.unlockedModules.includes(m.id)
  const fitted = state.shipyard.modules.includes(m.id)
  const level = moduleLevel(state.shipyard.moduleLevels, m.id)
  const upCost = moduleUpgradeCost(level)
  const gated = (m.requiresSectorEver ?? 0) > ever
  const canUnlock =
    !unlocked &&
    !gated &&
    Object.entries(m.unlockCost).every(
      ([k, v]) => state.resources[k as keyof Resources] >= (v ?? 0),
    )
  const roleOpen = !!frame && canFitModuleOnFrame(frame, state.shipyard.modules, m.id)
  const canFit = unlocked && !fitted && roleOpen && canRefitModules
  const canUpgrade =
    unlocked && level < MAX_MODULE_LEVEL && state.resources.salvage >= upCost
  const showNext = unlocked && level < MAX_MODULE_LEVEL
  const stats = unlocked ? moduleStatPreviews(m.id, level, showNext) : []
  const status = fitted ? `Fitted · Lv ${level}` : unlocked ? `Owned · Lv ${level}` : 'Locked'

  return (
    <li className="module-card">
      <div className="module-card-top">
        <div className="module-card-title">
          <strong>{m.name}</strong>
          <span className="role-pill">{ROLE_TAG[m.role]}</span>
        </div>
        <span className="badge">{status}</span>
      </div>

      <p className="module-card-desc">{m.description}</p>

      {!unlocked ? (
        gated ? (
          <p className="notice-warn">Clear sector {m.requiresSectorEver} to unlock.</p>
        ) : (
          <p className="muted">Unlock: {costLabel(m.unlockCost)}</p>
        )
      ) : (
        <p className="module-card-meta">
          Run upgrade {level}/{MAX_MODULE_LEVEL}
          {level < MAX_MODULE_LEVEL ? ` · next ${upCost} Salvage` : ' · maxed'}
          {' · '}+12% module stats / level
        </p>
      )}

      {stats.length > 0 ? (
        <div className="module-stat-grid">
          {stats.map((s) => (
            <div key={s.label} className="module-stat">
              <span className="muted">{s.label}</span>
              <strong>{s.current}</strong>
              {s.next ? <span className="module-stat-next">→ {s.next}</span> : null}
            </div>
          ))}
        </div>
      ) : null}

      {unlocked && !fitted && frame && !roleOpen ? (
        <p className="notice-warn">No free {m.role} slot on this frame.</p>
      ) : null}

      <div className="module-card-actions">
        {!unlocked ? (
          <button type="button" disabled={!canUnlock} onClick={() => onUnlockModule(m.id)}>
            Unlock
          </button>
        ) : (
          <>
            {fitted ? (
              <button
                type="button"
                disabled={!canRefitModules}
                onClick={() => onUnfitModule(m.id)}
              >
                Unfit
              </button>
            ) : (
              <button type="button" disabled={!canFit} onClick={() => onFitModule(m.id)}>
                Fit
              </button>
            )}
            <button
              type="button"
              className="primary"
              disabled={!canUpgrade}
              onClick={() => onUpgradeModule(m.id)}
            >
              {level >= MAX_MODULE_LEVEL ? 'Maxed' : `Upgrade (${upCost})`}
            </button>
          </>
        )}
      </div>
    </li>
  )
}
