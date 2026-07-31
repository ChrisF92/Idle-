import { useMemo, useState } from 'react'
import type { GameState, PartType, Resources } from '../../game/types'
import {
  BLUEPRINTS,
  FAB_SECONDS,
  MASTERY_PARTS_COST,
  MAX_MODULE_MASTERY,
  PART_TYPES,
  STATIONS,
  WORKER_MANUFACTURE_SECONDS,
  countModuleParts,
  getBlueprint,
  getModule,
  idleWorkers,
  isStationUnlocked,
  moduleMasteryRank,
  parsePartId,
  partId,
  partSellScrap,
  workerManufactureSpeed,
} from '../../game/catalog'
import { logisticsFabMult } from '../../game/core'
import { computeSignalCoreBonuses } from '../../game/signalCores'
import { RESOURCE_LABELS } from '../../game/state'

interface BaseTabProps {
  state: GameState
  onAssign: (stationId: string, delta: number) => void
  onAutoBalance: () => void
  onStartFab: (moduleId: string) => void
  onClearFab: () => void
  onDepositFab: (partType: PartType, qty?: number) => void
  onWithdrawFab: (partType: PartType, qty?: number) => void
  onSellPart: (partId: string, qty?: number) => void
  onInvestMastery: (moduleId: string) => void
}

function rateLabel(rates: Partial<Record<keyof Resources, number>>): string {
  const parts = Object.entries(rates)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${v}/${RESOURCE_LABELS[k as keyof Resources].toLowerCase()}s`)
  return parts.join(', ')
}

export function BaseTab({
  state,
  onAssign,
  onAutoBalance,
  onStartFab,
  onClearFab,
  onDepositFab,
  onWithdrawFab,
  onSellPart,
  onInvestMastery,
}: BaseTabProps) {
  const idle = idleWorkers(state)
  const speed = workerManufactureSpeed(state)
  const secondsLeft =
    ((1 - state.base.manufactureProgress) * WORKER_MANUFACTURE_SECONDS) / speed
  const canAuto = state.ai.purchased.includes('auto-assign-workers')
  const fabUnlocked = isStationUnlocked(state, 'fab-bay')
  const project = state.base.fabProject
  const [fabSelect, setFabSelect] = useState('')

  const incompleteBlueprints = useMemo(
    () =>
      BLUEPRINTS.filter(
        (b) =>
          state.meta.discoveredModules.includes(b.moduleId) &&
          !state.shipyard.unlockedModules.includes(b.moduleId),
      ),
    [state.meta.discoveredModules, state.shipyard.unlockedModules],
  )

  const partRows = useMemo(() => {
    const rows: {
      partId: string
      moduleId: string
      partType: PartType
      qty: number
      moduleName: string
      unlocked: boolean
    }[] = []
    for (const [id, qty] of Object.entries(state.parts)) {
      if ((qty ?? 0) <= 0) continue
      const parsed = parsePartId(id)
      if (!parsed) continue
      rows.push({
        partId: id,
        moduleId: parsed.moduleId,
        partType: parsed.partType,
        qty: qty ?? 0,
        moduleName: getModule(parsed.moduleId)?.name ?? parsed.moduleId,
        unlocked: state.shipyard.unlockedModules.includes(parsed.moduleId),
      })
    }
    rows.sort((a, b) => a.moduleName.localeCompare(b.moduleName) || a.partType.localeCompare(b.partType))
    return rows
  }, [state.parts, state.shipyard.unlockedModules])

  const recipe = project ? getBlueprint(project.moduleId) : undefined
  const fabWorkers = state.base.assignments['fab-bay'] ?? 0
  const recipeFilled =
    !!recipe &&
    PART_TYPES.every((pt) => (project?.contributed[pt] ?? 0) >= (recipe?.[pt] ?? 0))
  const fabSpeed = logisticsFabMult(state) * (1 + computeSignalCoreBonuses(state).fab)
  const fabEta =
    recipeFilled && fabWorkers > 0
      ? ((1 - (project?.progress ?? 0)) * FAB_SECONDS) / (fabWorkers * fabSpeed)
      : null

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Base</h2>
        <p>
          Manufacture worker drones, then assign them to named stations. Assignments reset on
          prestige; drone count is permanent. Blueprint parts and fabricated modules persist.
        </p>
      </header>

      <div className="stat-row">
        <div>
          <span className="muted">Workers</span>
          <strong>{state.base.workerDrones}</strong>
        </div>
        <div>
          <span className="muted">Idle</span>
          <strong>{idle}</strong>
        </div>
        <div>
          <span className="muted">Next drone</span>
          <strong>{secondsLeft.toFixed(0)}s</strong>
        </div>
        <div>
          <span className="muted">Fab speed</span>
          <strong>×{speed.toFixed(2)}</strong>
        </div>
      </div>

      <div className="manufacture-bar" aria-label="Manufacture progress">
        <div
          className="manufacture-bar-fill"
          style={{ width: `${Math.min(100, state.base.manufactureProgress * 100)}%` }}
        />
      </div>

      {canAuto ? (
        <p>
          <button type="button" className="primary" onClick={onAutoBalance}>
            Auto-Balance Workers
          </button>
        </p>
      ) : (
        <p className="muted">Buy Labor Router (AI) to auto-balance assignments.</p>
      )}

      <h3>Stations</h3>
      <ul className="def-list">
        {STATIONS.filter((s) => s.kind !== 'training').map((station) => {
          const unlocked = isStationUnlocked(state, station.id)
          const assigned = state.base.assignments[station.id] ?? 0
          const extras: string[] = []
          if (station.repairPerDrone) {
            extras.push(`+${station.repairPerDrone} hull/s repair each`)
          }
          if (station.manufactureBonusPerDrone) {
            extras.push(`+${(station.manufactureBonusPerDrone * 100).toFixed(0)}% fab speed each`)
          }
          if (station.upkeepScrapPerDrone) {
            extras.push(`${station.upkeepScrapPerDrone} scrap/s upkeep each`)
          }
          return (
            <li key={station.id}>
              <div>
                <strong>{station.name}</strong>
                <p className="muted">{station.description}</p>
                {!unlocked ? (
                  <p className="muted">
                    {station.requiresSystem && !station.requiresResearch
                      ? `Requires ${station.requiresSystem} system`
                      : station.requiresResearch
                        ? `Requires research: ${station.requiresResearch}`
                        : 'Locked'}
                  </p>
                ) : (
                  <p className="muted">
                    {rateLabel(station.rates) || 'Special duty'}
                    {extras.length ? ` · ${extras.join(' · ')}` : ''}
                  </p>
                )}
              </div>
              <div className="action-col">
                <span className="badge">{assigned} assigned</span>
                <div className="assign-row">
                  <button
                    type="button"
                    disabled={!unlocked || assigned <= 0}
                    onClick={() => onAssign(station.id, -1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    data-guide={`station-${station.id}-plus`}
                    disabled={!unlocked || idle <= 0}
                    onClick={() => onAssign(station.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {fabUnlocked ? (
        <>
          <h3>Fabrication</h3>
          <p className="muted">
            Deposit casing / core / lens into an active project, then assign workers to the
            Fabrication Bay ({FAB_SECONDS}s at 1 worker when the recipe is filled).
          </p>

          {!project ? (
            <p className="assign-row">
              <select
                value={fabSelect}
                onChange={(e) => setFabSelect(e.target.value)}
                aria-label="Select blueprint to fabricate"
              >
                <option value="">Select discovered blueprint…</option>
                {incompleteBlueprints.map((b) => (
                  <option key={b.moduleId} value={b.moduleId}>
                    {getModule(b.moduleId)?.name ?? b.moduleId}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="primary"
                disabled={!fabSelect}
                onClick={() => {
                  if (!fabSelect) return
                  onStartFab(fabSelect)
                  setFabSelect('')
                }}
              >
                Start Project
              </button>
            </p>
          ) : (
            <div className="fab-project">
              <p>
                <strong>{getModule(project.moduleId)?.name ?? project.moduleId}</strong>
                {recipeFilled ? (
                  <span className="muted">
                    {' '}
                    · crafting {((project.progress ?? 0) * 100).toFixed(0)}%
                    {fabEta != null ? ` · ~${fabEta.toFixed(0)}s` : ' · assign workers'}
                  </span>
                ) : (
                  <span className="muted"> · waiting for parts</span>
                )}
              </p>
              <div className="manufacture-bar" aria-label="Fabrication progress">
                <div
                  className="manufacture-bar-fill"
                  style={{
                    width: `${Math.min(100, (project.progress ?? 0) * 100)}%`,
                  }}
                />
              </div>
              <ul className="def-list">
                {PART_TYPES.map((pt) => {
                  const need = recipe?.[pt] ?? 0
                  const contributed = project.contributed[pt] ?? 0
                  const inv = state.parts[partId(project.moduleId, pt)] ?? 0
                  const room = Math.max(0, need - contributed)
                  return (
                    <li key={pt}>
                      <div>
                        <strong>
                          {pt.charAt(0).toUpperCase() + pt.slice(1)}
                        </strong>
                        <p className="muted">
                          Project {contributed}/{need} · Inventory {inv}
                        </p>
                      </div>
                      <div className="assign-row">
                        <button
                          type="button"
                          disabled={contributed <= 0}
                          onClick={() => onWithdrawFab(pt, 1)}
                        >
                          −
                        </button>
                        <button
                          type="button"
                          disabled={room <= 0 || inv <= 0}
                          onClick={() => onDepositFab(pt, 1)}
                        >
                          Deposit
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p>
                <button type="button" onClick={onClearFab}>
                  Cancel Project
                </button>
              </p>
            </div>
          )}

          {incompleteBlueprints.length === 0 && !project ? (
            <p className="muted">
              No incomplete blueprints. Recover fragments from combat kills, then fabricate here.
            </p>
          ) : null}
        </>
      ) : (
        <p className="muted">
          Research Module Fabrication to unlock the Fabrication Bay for blueprint assembly.
        </p>
      )}

      <h3>Parts</h3>
      {partRows.length === 0 ? (
        <p className="muted">No blueprint parts yet — kill enemies to recover fragments.</p>
      ) : (
        <ul className="def-list">
          {partRows.map((row) => {
            const mastery = moduleMasteryRank(state, row.moduleId)
            const partsOwned = countModuleParts(state, row.moduleId)
            const canInvest =
              row.unlocked &&
              mastery < MAX_MODULE_MASTERY &&
              partsOwned >= MASTERY_PARTS_COST
            return (
              <li key={row.partId}>
                <div>
                  <strong>
                    {row.moduleName} {row.partType}
                  </strong>
                  <p className="muted">
                    ×{row.qty} · sell {partSellScrap(row.partId)} scrap each
                    {row.unlocked
                      ? ` · mastery ${mastery}/${MAX_MODULE_MASTERY} (${MASTERY_PARTS_COST} parts/rank)`
                      : ''}
                  </p>
                </div>
                <div className="assign-row">
                  <button type="button" onClick={() => onSellPart(row.partId, 1)}>
                    Sell
                  </button>
                  {row.unlocked ? (
                    <button
                      type="button"
                      className="primary"
                      disabled={!canInvest}
                      onClick={() => onInvestMastery(row.moduleId)}
                    >
                      Invest Mastery
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
