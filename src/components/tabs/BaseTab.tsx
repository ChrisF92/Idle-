import { useEffect, useId, useMemo, useState } from 'react'
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
  stationUpkeepScrapPerDrone,
  workerManufactureSpeed,
} from '../../game/catalog'
import { logisticsFabMult } from '../../game/core'
import { computeSignalCoreBonuses } from '../../game/signalCores'
import { RESOURCE_LABELS } from '../../game/state'
import { computeResourceRates } from '../../game/tick'

interface BaseTabProps {
  state: GameState
  fabLaunchModuleId: string | null
  onFabLaunchConsumed: () => void
  onAssign: (stationId: string, delta: number) => void
  onAutoBalance: () => void
  onStartFab: (moduleId: string) => void
  onLaunchFab: (moduleId: string) => void
  onClearFab: () => void
  onDepositFab: (partType: PartType, qty?: number) => void
  onWithdrawFab: (partType: PartType, qty?: number) => void
  onSellPart: (partId: string, qty?: number) => void
  onInvestMastery: (moduleId: string) => void
}

function rateLabel(rates: Partial<Record<keyof Resources, number>>): string {
  const parts = Object.entries(rates)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => {
      const label = RESOURCE_LABELS[k as keyof Resources].toLowerCase()
      return `${v} ${label}/s each`
    })
  return parts.join(', ')
}

export function BaseTab({
  state,
  fabLaunchModuleId,
  onFabLaunchConsumed,
  onAssign,
  onAutoBalance,
  onStartFab,
  onLaunchFab,
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
  const [fabOpen, setFabOpen] = useState(false)
  const [fabSelect, setFabSelect] = useState('')

  useEffect(() => {
    if (!fabLaunchModuleId) return
    setFabOpen(true)
    onLaunchFab(fabLaunchModuleId)
    onFabLaunchConsumed()
    // Only react to a new launch id from Shipyard → Base.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [fabLaunchModuleId])

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

  const industryRates = useMemo(() => computeResourceRates(state), [state])
  const scrapNet = industryRates.scrap ?? 0
  const alloyUpkeepDrones = state.base.assignments['alloy-foundry'] ?? 0
  const scrapDrainHint =
    scrapNet < -0.005 && alloyUpkeepDrones > 0
      ? `Scrap is net −${Math.abs(scrapNet).toFixed(2)}/s — Alloy Foundry upkeep is outrunning Scrap Field. Add scrap workers or pull foundry drones.`
      : null

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Base</h2>
        <p>Manufacture drones and assign them to stations.</p>
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

      {scrapDrainHint ? <p className="notice-warn">{scrapDrainHint}</p> : null}

      <div className="manufacture-bar" aria-label="Manufacture progress">
        <div
          className="manufacture-bar-fill"
          style={{ width: `${Math.min(100, state.base.manufactureProgress * 100)}%` }}
        />
      </div>

      <div className="assign-row">
        {canAuto ? (
          <button type="button" className="primary" onClick={onAutoBalance}>
            Auto-Balance
          </button>
        ) : null}
        {fabUnlocked ? (
          <button
            type="button"
            className="primary"
            data-guide="fab-bay-btn"
            onClick={() => setFabOpen(true)}
          >
            Fabrication
            {project ? ' · Active' : ''}
          </button>
        ) : null}
      </div>

      <h3>Stations</h3>
      <ul className="def-list">
        {STATIONS.filter(
          (s) => s.kind !== 'training' && isStationUnlocked(state, s.id),
        ).map((station) => {
          const assigned = state.base.assignments[station.id] ?? 0
          const extras: string[] = []
          if (station.repairPerDrone) {
            extras.push(`+${station.repairPerDrone} hull/s each`)
          }
          if (station.manufactureBonusPerDrone) {
            extras.push(`+${(station.manufactureBonusPerDrone * 100).toFixed(0)}% drone speed each`)
          }
          const upkeep = stationUpkeepScrapPerDrone(state, station)
          if (upkeep > 0) {
            extras.push(`−${upkeep.toFixed(2)} scrap/s each`)
            if (assigned > 0) {
              extras.push(`−${(upkeep * assigned).toFixed(2)} scrap/s total`)
            }
          }
          return (
            <li key={station.id}>
              <div>
                <strong>{station.name}</strong>
                <p className="muted">
                  {rateLabel(station.rates) || 'Special'}
                  {extras.length ? ` · ${extras.join(' · ')}` : ''}
                </p>
              </div>
              <div className="action-col">
                <span className="badge">{assigned}</span>
                <div className="assign-row">
                  <button
                    type="button"
                    className="assign-btn"
                    disabled={assigned <= 0}
                    onClick={() => onAssign(station.id, -1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="assign-btn"
                    data-guide={`station-${station.id}-plus`}
                    disabled={idle <= 0}
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

      {fabOpen && fabUnlocked ? (
        <FabModal
          state={state}
          fabSelect={fabSelect}
          setFabSelect={setFabSelect}
          incompleteBlueprints={incompleteBlueprints}
          project={project}
          recipe={recipe}
          recipeFilled={recipeFilled}
          fabEta={fabEta}
          partRows={partRows}
          onClose={() => setFabOpen(false)}
          onStartFab={onStartFab}
          onClearFab={onClearFab}
          onDepositFab={onDepositFab}
          onWithdrawFab={onWithdrawFab}
          onSellPart={onSellPart}
          onInvestMastery={onInvestMastery}
        />
      ) : null}
    </section>
  )
}

function FabModal({
  state,
  fabSelect,
  setFabSelect,
  incompleteBlueprints,
  project,
  recipe,
  recipeFilled,
  fabEta,
  partRows,
  onClose,
  onStartFab,
  onClearFab,
  onDepositFab,
  onWithdrawFab,
  onSellPart,
  onInvestMastery,
}: {
  state: GameState
  fabSelect: string
  setFabSelect: (v: string) => void
  incompleteBlueprints: { moduleId: string }[]
  project: GameState['base']['fabProject']
  recipe: ReturnType<typeof getBlueprint>
  recipeFilled: boolean
  fabEta: number | null
  partRows: {
    partId: string
    moduleId: string
    partType: PartType
    qty: number
    moduleName: string
    unlocked: boolean
  }[]
  onClose: () => void
  onStartFab: (moduleId: string) => void
  onClearFab: () => void
  onDepositFab: (partType: PartType, qty?: number) => void
  onWithdrawFab: (partType: PartType, qty?: number) => void
  onSellPart: (partId: string, qty?: number) => void
  onInvestMastery: (moduleId: string) => void
}) {
  const titleId = useId()
  const [fabPane, setFabPane] = useState<'project' | 'parts'>('project')

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet fab-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h3 id={titleId}>Fabrication</h3>
            <p className="muted">Assemble blueprint parts · {FAB_SECONDS}s at 1 worker</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        <div className="sub-tabs" role="tablist" aria-label="Fabrication sections">
          <button
            type="button"
            role="tab"
            className={fabPane === 'project' ? 'sub-tab active' : 'sub-tab'}
            aria-selected={fabPane === 'project'}
            onClick={() => setFabPane('project')}
          >
            Project
          </button>
          <button
            type="button"
            role="tab"
            className={fabPane === 'parts' ? 'sub-tab active' : 'sub-tab'}
            aria-selected={fabPane === 'parts'}
            onClick={() => setFabPane('parts')}
          >
            Parts
          </button>
        </div>

        {fabPane === 'project' ? (
          <>
            {!project ? (
              <div className="assign-row">
                <select
                  value={fabSelect}
                  onChange={(e) => setFabSelect(e.target.value)}
                  aria-label="Select blueprint to fabricate"
                >
                  <option value="">Select blueprint…</option>
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
                  Start
                </button>
              </div>
            ) : (
              <div className="fab-project">
                <p>
                  <strong>{getModule(project.moduleId)?.name ?? project.moduleId}</strong>
                  {recipeFilled ? (
                    <span className="muted">
                      {' '}
                      · {((project.progress ?? 0) * 100).toFixed(0)}%
                      {fabEta != null ? ` · ~${fabEta.toFixed(0)}s` : ' · assign Fab Bay'}
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
                          <strong>{pt.charAt(0).toUpperCase() + pt.slice(1)}</strong>
                          <p className="muted">
                            {contributed}/{need} · inv {inv}
                          </p>
                        </div>
                        <div className="assign-row">
                          <button
                            type="button"
                            className="assign-btn"
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
                <button type="button" onClick={onClearFab}>
                  Cancel Project
                </button>
              </div>
            )}
            {incompleteBlueprints.length === 0 && !project ? (
              <p className="muted">No incomplete blueprints.</p>
            ) : null}
          </>
        ) : partRows.length === 0 ? (
          <p className="muted">No parts yet — rare drops from combat.</p>
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
                      ×{row.qty} · sell {partSellScrap(row.partId)} scrap
                      {row.unlocked
                        ? ` · Mastery ${mastery}/${MAX_MODULE_MASTERY}`
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

        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
