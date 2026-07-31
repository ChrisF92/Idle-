import type { GameState, Resources } from '../../game/types'
import {
  MAX_MODULE_LEVEL,
  SHIP_FRAMES,
  SHIP_MODULES,
  SHORT_RANGE_MAX,
  canFitModuleOnFrame,
  fittedRoleSlotCounts,
  frameTotalSlots,
  getFrame,
  isModuleBlockedByChallenge,
  moduleLevel,
  moduleUpgradeCost,
  moduleUpgradeEffectLines,
} from '../../game/catalog'
import { careerHighestSector } from '../../game/progression'
import { RESOURCE_LABELS, computeShipStats } from '../../game/state'

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
  const challengeId = state.prestige.activeChallengeId

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Shipyard</h2>
        <p>
          Choose a frame before your first Launch (locked until prestige / challenge). Dock anytime
          to refit modules within that frame&apos;s W/D/U slots.
        </p>
      </header>

      {challengeId === 'no-utility' ? (
        <p className="notice-warn">Bare Rig: utility modules are unequipped and cannot be fitted.</p>
      ) : null}
      {challengeId === 'short-range' ? (
        <p className="notice-warn">
          Knife Fight: all weapon ranges capped at {SHORT_RANGE_MAX} (flak reach).
        </p>
      ) : null}

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
            <li key={f.id} data-guide={`frame-${f.id.replace("-frame", "")}`}>
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

      <h3>Modules</h3>
      <ul className="def-list">
        {SHIP_MODULES.map((m) => {
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
          const challengeBlocked = isModuleBlockedByChallenge(challengeId, m.id)
          const roleOpen =
            !!frame && canFitModuleOnFrame(frame, state.shipyard.modules, m.id)
          const canFit =
            unlocked && !fitted && roleOpen && canRefitModules && !challengeBlocked
          const canUpgrade =
            unlocked && level < MAX_MODULE_LEVEL && state.resources.salvage >= upCost
          const effectiveRange =
            m.weapon && challengeId === 'short-range'
              ? Math.min(m.weapon.range, SHORT_RANGE_MAX)
              : m.weapon?.range
          const rangeNote = m.weapon
            ? ` · range ${effectiveRange}${
                challengeId === 'short-range' && m.weapon.range > SHORT_RANGE_MAX
                  ? ` (capped from ${m.weapon.range})`
                  : ''
              }`
            : ''
          const roleTag =
            m.role === 'weapon' ? 'W' : m.role === 'defense' ? 'D' : 'U'
          const nextEffects =
            unlocked && level < MAX_MODULE_LEVEL
              ? moduleUpgradeEffectLines(m.id, level, level + 1)
              : []
          return (
            <li key={m.id}>
              <div>
                <strong>
                  {m.name}{' '}
                  <span className="muted">[{roleTag}]</span>
                </strong>
                <p className="muted">
                  {m.role} — {m.description}
                  {rangeNote}
                </p>
                {unlocked ? (
                  <>
                    <p className="muted">
                      Run upgrade Lv {level}/{MAX_MODULE_LEVEL}
                      {level < MAX_MODULE_LEVEL ? ` · next ${upCost} Salvage` : ' · maxed'}
                      {' · '}
                      each level +12% module combat stats
                    </p>
                    {nextEffects.length > 0 ? (
                      <ul className="upgrade-effects">
                        {nextEffects.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : gated ? (
                  <p className="notice-warn">Clear sector {m.requiresSectorEver} to unlock.</p>
                ) : (
                  <p className="muted">Unlock: {costLabel(m.unlockCost)}</p>
                )}
                {challengeBlocked ? (
                  <p className="notice-warn">Blocked by active challenge.</p>
                ) : null}
                {unlocked && !fitted && frame && !roleOpen && !challengeBlocked ? (
                  <p className="notice-warn">No free {m.role} slot on this frame.</p>
                ) : null}
              </div>
              <div className="action-col">
                <span className="badge">
                  {fitted ? `Fitted L${level}` : unlocked ? `Owned L${level}` : 'Locked'}
                </span>
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
                      {level >= MAX_MODULE_LEVEL ? 'Max' : `Upgrade (${upCost})`}
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
