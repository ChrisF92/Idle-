import type { GameState, Resources } from '../../game/types'
import {
  MAX_MODULE_LEVEL,
  SHIP_FRAMES,
  SHIP_MODULES,
  moduleLevel,
  moduleUpgradeCost,
} from '../../game/catalog'
import { RESOURCE_LABELS, computeShipStats } from '../../game/state'

interface ShipyardTabProps {
  state: GameState
  onUnlockFrame: (frameId: string) => void
  onSelectFrame: (frameId: string) => void
  onUnlockModule: (moduleId: string) => void
  onFitModule: (moduleId: string) => void
  onUnfitModule: (moduleId: string) => void
  onUpgradeModule: (moduleId: string) => void
}

function costLabel(cost: Partial<Record<keyof Resources, number>>): string {
  const parts = Object.entries(cost)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${v} ${RESOURCE_LABELS[k as keyof Resources]}`)
  return parts.length ? parts.join(', ') : 'Free'
}

export function ShipyardTab({
  state,
  onUnlockFrame,
  onSelectFrame,
  onUnlockModule,
  onFitModule,
  onUnfitModule,
  onUpgradeModule,
}: ShipyardTabProps) {
  const frame = SHIP_FRAMES.find((f) => f.id === state.shipyard.frameId)
  const stats = computeShipStats(state)
  const slotsUsed = state.shipyard.modules.length
  const slotsMax = frame?.slots ?? 0

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Shipyard</h2>
        <p>
          Dock from Combat to fit modules, then spend Salvage to upgrade them. Salvage upgrades reset
          on prestige; unlocks and loadout persist.
        </p>
      </header>

      {state.combat.inFight ? (
        <p className="notice-warn">In fight — Dock from the Combat tab to refit the loadout.</p>
      ) : state.combat.docked ? (
        <p className="notice">Docked — fit freely, then Launch from Combat.</p>
      ) : null}

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

      <h3>Frames</h3>
      <ul className="def-list">
        {SHIP_FRAMES.map((f) => {
          const unlocked = state.shipyard.unlockedFrames.includes(f.id)
          const active = state.shipyard.frameId === f.id
          const canUnlock =
            !unlocked &&
            Object.entries(f.unlockCost).every(
              ([k, v]) => state.resources[k as keyof Resources] >= (v ?? 0),
            )
          return (
            <li key={f.id}>
              <div>
                <strong>{f.name}</strong>
                <p className="muted">
                  {f.slots} slots · {f.baseDamage} dmg · {f.baseHull} hull
                </p>
                {!unlocked ? (
                  <p className="muted">Unlock: {costLabel(f.unlockCost)}</p>
                ) : null}
              </div>
              <div className="action-col">
                <span className="badge">{active ? 'Active' : unlocked ? 'Owned' : 'Locked'}</span>
                {!unlocked ? (
                  <button type="button" disabled={!canUnlock} onClick={() => onUnlockFrame(f.id)}>
                    Unlock
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={active || state.combat.inFight}
                    onClick={() => onSelectFrame(f.id)}
                  >
                    {active ? 'Selected' : 'Select'}
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
          const canUnlock =
            !unlocked &&
            Object.entries(m.unlockCost).every(
              ([k, v]) => state.resources[k as keyof Resources] >= (v ?? 0),
            )
          const canFit = unlocked && !fitted && slotsUsed < slotsMax && !state.combat.inFight
          const canUpgrade =
            unlocked && level < MAX_MODULE_LEVEL && state.resources.salvage >= upCost
          const rangeNote = m.weapon ? ` · range ${m.weapon.range}` : ''
          return (
            <li key={m.id}>
              <div>
                <strong>{m.name}</strong>
                <p className="muted">
                  {m.role} — {m.description}
                  {rangeNote}
                </p>
                {unlocked ? (
                  <p className="muted">
                    Run upgrade Lv {level}/{MAX_MODULE_LEVEL}
                    {level < MAX_MODULE_LEVEL ? ` · next ${upCost} Salvage` : ' · maxed'}
                  </p>
                ) : (
                  <p className="muted">Unlock: {costLabel(m.unlockCost)}</p>
                )}
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
                        disabled={state.combat.inFight}
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
