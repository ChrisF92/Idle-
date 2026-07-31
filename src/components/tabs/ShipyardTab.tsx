import { useMemo, useState } from 'react'
import type { GameState, Resources } from '../../game/types'
import {
  MAX_MODULE_LEVEL,
  MAX_MODULE_MASTERY,
  PART_TYPES,
  SHIP_FRAMES,
  SHORT_RANGE_MAX,
  blueprintProgress,
  canFitModuleOnFrame,
  fittedRoleSlotCounts,
  frameTotalSlots,
  getBlueprint,
  getFrame,
  getVisibleModules,
  isFarmableModule,
  isModuleBlockedByChallenge,
  isStarterUnlockModule,
  moduleLevel,
  moduleMasteryRank,
  moduleStatPreviews,
  moduleUpgradeCost,
  shopRank,
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
  /** Switch to Base and launch fab for this blueprint module. */
  onBuildModule: (moduleId: string) => void
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
  onBuildModule,
}: ShipyardTabProps) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const frame = getFrame(state.shipyard.frameId)
  const stats = computeShipStats(state)
  const used = fittedRoleSlotCounts(state.shipyard.modules)
  const slotsUsed = state.shipyard.modules.length
  const slotsMax = frame ? frameTotalSlots(frame) : 0
  const frameLocked = state.shipyard.frameLocked
  const ever = careerHighestSector(state)
  const canRefitModules = state.combat.docked
  const canBatch = state.ai.purchased.includes('batch-refit')
  const canSalvageOpt = state.ai.purchased.includes('salvage-optimizer')
  const challengeId = state.prestige.activeChallengeId

  const grouped = useMemo(() => {
    const visible = getVisibleModules(state).filter((m) => {
      const unlocked = state.shipyard.unlockedModules.includes(m.id)
      if (unlocked) return true
      if (state.meta.discoveredModules.includes(m.id)) return true
      if (isStarterUnlockModule(m.id)) return true
      if (m.requiresChallengeShop && shopRank(state.prestige.shop, m.requiresChallengeShop) >= 1) {
        return true
      }
      // Hide locked / undiscovered sector-gated modules.
      return false
    })
    const list =
      roleFilter === 'all'
        ? [...visible].sort(
            (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
          )
        : visible.filter((m) => m.role === roleFilter)
    const map = new Map<ModuleRole, ShipModuleDef[]>()
    for (const role of ROLE_ORDER) map.set(role, [])
    for (const m of list) map.get(m.role)?.push(m)
    return ROLE_ORDER.map((role) => ({ role, modules: map.get(role) ?? [] })).filter(
      (g) => g.modules.length > 0,
    )
  }, [roleFilter, state])

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Shipyard</h2>
        <p>Frames and modules. Pause combat to refit.</p>
      </header>

      {challengeId === 'no-utility' ? (
        <p className="notice-warn">Bare Rig: utilities blocked.</p>
      ) : null}
      {challengeId === 'short-range' ? (
        <p className="notice-warn">Knife Fight: range capped at {SHORT_RANGE_MAX}.</p>
      ) : null}

      {state.combat.docked ? (
        <p className="notice">
          Paused — {frameLocked ? 'frame locked · ' : ''}refit while repairing.
        </p>
      ) : (
        <p className="notice-warn">In combat — Pause to refit (resets to W1).</p>
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
          <span className="muted">Armor</span>
          <strong>{stats.armor.toFixed(1)}</strong>
        </div>
        <div>
          <span className="muted">Evasion</span>
          <strong>{(stats.evasion * 100).toFixed(0)}%</strong>
        </div>
        <div data-guide="salvage-stat">
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
                challengeId={challengeId}
                onUnlockModule={onUnlockModule}
                onFitModule={onFitModule}
                onUnfitModule={onUnfitModule}
                onUpgradeModule={onUpgradeModule}
                onBuildModule={onBuildModule}
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
  challengeId,
  onUnlockModule,
  onFitModule,
  onUnfitModule,
  onUpgradeModule,
  onBuildModule,
}: {
  module: ShipModuleDef
  state: GameState
  frame: ReturnType<typeof getFrame>
  ever: number
  canRefitModules: boolean
  challengeId: string | null
  onUnlockModule: (id: string) => void
  onFitModule: (id: string) => void
  onUnfitModule: (id: string) => void
  onUpgradeModule: (id: string) => void
  onBuildModule: (id: string) => void
}) {
  const unlocked = state.shipyard.unlockedModules.includes(m.id)
  const fitted = state.shipyard.modules.includes(m.id)
  const level = moduleLevel(state.shipyard.moduleLevels, m.id)
  const mastery = moduleMasteryRank(state, m.id)
  const upCost = moduleUpgradeCost(level)
  const farmable = isFarmableModule(m.id)
  const blueprint = getBlueprint(m.id)
  const progress = farmable && !unlocked ? blueprintProgress(state, m.id) : null
  const schematicLocked =
    !!m.requiresChallengeShop &&
    shopRank(state.prestige.shop, m.requiresChallengeShop) < 1
  const gated =
    !schematicLocked &&
    !farmable &&
    (m.requiresSectorEver ?? 0) > ever
  const canScrapUnlock =
    !unlocked &&
    !farmable &&
    !gated &&
    !schematicLocked &&
    (isStarterUnlockModule(m.id) || Object.keys(m.unlockCost).length > 0) &&
    Object.entries(m.unlockCost).every(
      ([k, v]) => state.resources[k as keyof Resources] >= (v ?? 0),
    )
  const challengeBlocked = isModuleBlockedByChallenge(challengeId, m.id)
  const roleOpen = !!frame && canFitModuleOnFrame(frame, state.shipyard.modules, m.id)
  const canFit = unlocked && !fitted && roleOpen && canRefitModules && !challengeBlocked
  const canUpgrade =
    unlocked && level < MAX_MODULE_LEVEL && state.resources.salvage >= upCost
  const showNext = unlocked && level < MAX_MODULE_LEVEL
  const stats = unlocked ? moduleStatPreviews(m.id, level, showNext, mastery) : []
  const partsReady = !!progress?.complete
  const status = fitted
    ? `Fitted · Lv ${level}`
    : unlocked
      ? `Owned · Lv ${level}`
      : farmable
        ? 'Blueprint'
        : 'Locked'
  const rangeNote =
    m.weapon && challengeId === 'short-range' && m.weapon.range > SHORT_RANGE_MAX
      ? ` Range ≤${SHORT_RANGE_MAX}.`
      : ''

  return (
    <li className="module-card">
      <div className="module-card-top">
        <div className="module-card-title">
          <strong>{m.name}</strong>
          <span className="role-pill">{ROLE_TAG[m.role]}</span>
        </div>
        <span className="badge">{status}</span>
      </div>

      <p className="module-card-desc">
        {m.description}
        {rangeNote}
      </p>

      {!unlocked ? (
        farmable && blueprint && progress ? (
          <p className="muted">
            Parts {PART_TYPES.map((pt) => `${progress.owned[pt]}/${progress.need[pt]} ${pt}`).join(' · ')}
          </p>
        ) : schematicLocked ? (
          <p className="notice-warn">Needs Challenge schematic.</p>
        ) : gated ? (
          <p className="notice-warn">Clear sector {m.requiresSectorEver}.</p>
        ) : (
          <p className="muted">
            Unlock: {Object.keys(m.unlockCost).length ? costLabel(m.unlockCost) : 'Free'}
          </p>
        )
      ) : (
        <div className="module-card-meta">
          <p>
            <strong>Run level (Salvage)</strong> {level}/{MAX_MODULE_LEVEL}
            {level < MAX_MODULE_LEVEL ? ` · next ${upCost}` : ' · maxed'}
          </p>
          <p>
            <strong>Mastery (permanent parts)</strong> {mastery}/{MAX_MODULE_MASTERY}
            {mastery > 0 ? ` · +${(mastery * 2.5).toFixed(1)}%` : ''}
            {' · '}invest in Base → Fabrication
          </p>
        </div>
      )}

      {stats.length > 0 ? (
        <div className="module-stat-grid">
          {stats.map((s) => {
            const displayCurrent =
              s.label === 'Range' && challengeId === 'short-range'
                ? String(Math.min(Number(s.current) || SHORT_RANGE_MAX, SHORT_RANGE_MAX))
                : s.current
            return (
              <div key={s.label} className="module-stat">
                <span className="muted">{s.label}</span>
                <strong>{displayCurrent}</strong>
                {s.next ? <span className="module-stat-next">→ {s.next}</span> : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {challengeBlocked ? (
        <p className="notice-warn">Blocked by challenge.</p>
      ) : null}
      {unlocked && !fitted && frame && !roleOpen && !challengeBlocked ? (
        <p className="notice-warn">No free {m.role} slot.</p>
      ) : null}

      <div className="module-card-actions">
        {!unlocked ? (
          farmable ? (
            partsReady ? (
              <button
                type="button"
                className="primary"
                onClick={() => onBuildModule(m.id)}
              >
                Build
              </button>
            ) : null
          ) : (
            <button
              type="button"
              disabled={!canScrapUnlock}
              onClick={() => onUnlockModule(m.id)}
            >
              Unlock
            </button>
          )
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
              title="Run level — spends Salvage (resets on prestige)"
            >
              {level >= MAX_MODULE_LEVEL
                ? 'Salvage maxed'
                : `Salvage upgrade (${upCost})`}
            </button>
          </>
        )}
      </div>
    </li>
  )
}
