import { useMemo, useState } from 'react'
import type {
  SimulationConfig,
  SimulationLogLevel,
  SimulationProgress,
  SimulationReport,
  SimulationStop,
  SimulationStrategyId,
} from '../game/simulation/types'
import {
  SIMULATION_PRESETS,
  defaultSimulationConfig,
  deleteRecentSimulation,
  formatConfigText,
  formatFullReport,
  formatSimDuration,
  formatSummary,
  loadRecentSimulations,
  reportToCsv,
  reportToJson,
  saveRecentSimulation,
  stopLabel,
  type RecentSimSummary,
} from '../game/simulation'
import { startSimulationHost, type SimulationHandle } from '../game/simulation/host'
import { simulationBuildMeta } from '../buildMeta'
import { DEFAULT_CASUAL_SESSION } from '../game/simulation/presets'

interface BalanceSimulatorProps {
  onClose: () => void
}

function downloadBlob(filename: string, mime: string, body: string): void {
  const blob = new Blob([body], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function BalanceSimulator({ onClose }: BalanceSimulatorProps) {
  const [strategy, setStrategy] = useState<SimulationStrategyId>('balanced')
  const [stopKind, setStopKind] = useState<SimulationStop['type']>('first-rebuild')
  const [wave, setWave] = useState(300)
  const [rebuilds, setRebuilds] = useState(10)
  const [days, setDays] = useState(7)
  const [runs, setRuns] = useState(1)
  const [seed, setSeed] = useState(1)
  const [logging, setLogging] = useState<SimulationLogLevel>('milestones')
  const [activeMin, setActiveMin] = useState(10)
  const [offlineHours, setOfflineHours] = useState(4)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<SimulationProgress | null>(null)
  const [report, setReport] = useState<SimulationReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [recent, setRecent] = useState<RecentSimSummary[]>(() => loadRecentSimulations())
  const [handle, setHandle] = useState<SimulationHandle | null>(null)
  const [openSection, setOpenSection] = useState<string>('summary')

  const config: SimulationConfig = useMemo(() => {
    let stop: SimulationStop
    if (stopKind === 'first-rebuild') stop = { type: 'first-rebuild' }
    else if (stopKind === 'rebuilds') stop = { type: 'rebuilds', count: rebuilds }
    else if (stopKind === 'wave' || stopKind === 'sector') stop = { type: 'wave', wave }
    else if (stopKind === 'duration') stop = { type: 'duration', calendarSeconds: days * 86400 }
    else if (stopKind === 'safety') stop = { type: 'safety' }
    else if (stopKind === 'reinforce') stop = { type: 'reinforce' }
    else stop = { type: 'first-rebuild' }
    return defaultSimulationConfig({
      start: { type: 'fresh' },
      strategy,
      stop,
      seed,
      runs: Math.max(1, Math.min(20, runs)),
      logging,
      session: {
        activeSeconds: Math.max(60, activeMin * 60),
        offlineSeconds: Math.max(60, offlineHours * 3600),
      },
    })
  }, [strategy, stopKind, wave, rebuilds, days, runs, seed, logging, activeMin, offlineHours])

  const applyPreset = (id: string) => {
    const preset = SIMULATION_PRESETS.find((p) => p.id === id)
    if (!preset) return
    setStrategy(preset.config.strategy)
    setStopKind(preset.config.stop.type)
    if (preset.config.stop.type === 'wave') setWave(preset.config.stop.wave)
    if (preset.config.stop.type === 'sector') setWave(preset.config.stop.sector * 10)
    if (preset.config.stop.type === 'rebuilds') setRebuilds(preset.config.stop.count)
    if (preset.config.stop.type === 'duration') {
      setDays(Math.max(1, Math.round(preset.config.stop.calendarSeconds / 86400)))
    }
    setLogging(preset.config.logging)
    if (preset.config.session) {
      setActiveMin(Math.round(preset.config.session.activeSeconds / 60))
      setOfflineHours(Math.round(preset.config.session.offlineSeconds / 3600))
    }
  }

  const run = () => {
    setError(null)
    setReport(null)
    setProgress(null)
    setRunning(true)
    const job = startSimulationHost(config, {
      onProgress: (p) => setProgress(p),
      onDone: (r) => {
        setReport(r)
        setRunning(false)
        setHandle(null)
        const run0 = r.runs[0]
        const label = `${run0?.config.strategy ?? strategy} · ${stopLabel(config.stop)}`
        setRecent(
          saveRecentSimulation({
            id: `${Date.now()}`,
            label,
            build: simulationBuildMeta().appBuild,
            at: Date.now(),
            summary: formatSummary(r),
            configText: formatConfigText(config, config.seed),
          }),
        )
      },
      onError: (message) => {
        setError(message)
        setRunning(false)
        setHandle(null)
      },
    })
    setHandle(job)
  }

  const cancel = () => {
    handle?.cancel()
    setRunning(false)
    setHandle(null)
    setToast('Cancelled. Partial results appear if a run finished.')
  }

  const ping = (ok: boolean, good: string) => setToast(ok ? good : 'Copy failed')

  const run0 = report?.runs[0]
  const pass = run0?.targets.filter((t) => t.severity === 'PASS').length ?? 0
  const warn = run0?.targets.filter((t) => t.severity === 'WARNING').length ?? 0
  const fail = run0?.targets.filter((t) => t.severity === 'FAIL').length ?? 0

  return (
    <div className="sim-overlay">
      <section className="panel screen-panel sim-panel">
        <header className="panel-header">
          <p className="assign-row">
            <button type="button" onClick={onClose}>
              Close
            </button>
          </p>
          <h2>Balance Simulator</h2>
          <p>Career runs on an isolated save. Your live dock is not touched.</p>
        </header>
        <div className="panel-scroll">
          <h3 className="foundry-heading">Presets</h3>
          <div className="sim-presets">
            {SIMULATION_PRESETS.map((p) => (
              <button key={p.id} type="button" className="primary" onClick={() => applyPreset(p.id)}>
                {p.label}
              </button>
            ))}
          </div>

          <label className="sim-field">
            Starting State
            <select value="fresh" disabled>
              <option value="fresh">Fresh Save</option>
            </select>
          </label>
          <label className="sim-field">
            Strategy
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as SimulationStrategyId)}
            >
              <option value="casual">Casual</option>
              <option value="balanced">Balanced</option>
              <option value="offensive">Offensive</option>
              <option value="defensive">Defensive</option>
              <option value="economy-first">Economy First</option>
              <option value="optimiser">Optimiser</option>
              <option value="idle">Idle</option>
            </select>
          </label>
          <label className="sim-field">
            Run Until
            <select
              value={stopKind}
              onChange={(e) => setStopKind(e.target.value as SimulationStop['type'])}
            >
              <option value="first-rebuild">First Rebuild</option>
              <option value="wave">Wave</option>
              <option value="rebuilds">Rebuild count</option>
              <option value="duration">Calendar days</option>
              <option value="safety">Long safety run</option>
              <option value="reinforce">First Reinforce</option>
            </select>
          </label>
          {stopKind === 'wave' || stopKind === 'sector' ? (
            <label className="sim-field">
              Wave
              <input
                type="number"
                min={1}
                value={wave}
                onChange={(e) => setWave(Number(e.target.value) || 1)}
              />
            </label>
          ) : null}
          {stopKind === 'rebuilds' ? (
            <label className="sim-field">
              Rebuilds
              <input
                type="number"
                min={1}
                value={rebuilds}
                onChange={(e) => setRebuilds(Number(e.target.value) || 1)}
              />
            </label>
          ) : null}
          {stopKind === 'duration' ? (
            <label className="sim-field">
              Days
              <input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 1)}
              />
            </label>
          ) : null}
          {strategy === 'casual' ? (
            <>
              <label className="sim-field">
                Session minutes
                <input
                  type="number"
                  min={1}
                  value={activeMin}
                  onChange={(e) => setActiveMin(Number(e.target.value) || DEFAULT_CASUAL_SESSION.activeSeconds / 60)}
                />
              </label>
              <label className="sim-field">
                Offline hours
                <input
                  type="number"
                  min={1}
                  value={offlineHours}
                  onChange={(e) => setOfflineHours(Number(e.target.value) || 4)}
                />
              </label>
            </>
          ) : null}
          <label className="sim-field">
            Runs
            <input
              type="number"
              min={1}
              max={20}
              value={runs}
              onChange={(e) => setRuns(Number(e.target.value) || 1)}
            />
          </label>
          <label className="sim-field">
            Seed
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 1)}
            />
          </label>
          <label className="sim-field">
            Accuracy
            <select value="accurate" disabled>
              <option value="accurate">Accurate</option>
            </select>
          </label>
          <label className="sim-field">
            Logging
            <select
              value={logging}
              onChange={(e) => setLogging(e.target.value as SimulationLogLevel)}
            >
              <option value="summary">Summary</option>
              <option value="milestones">Milestones</option>
              <option value="detailed">Detailed</option>
            </select>
          </label>

          <p className="assign-row">
            {running ? (
              <button type="button" className="danger" onClick={cancel}>
                Cancel
              </button>
            ) : (
              <button type="button" className="primary" onClick={run}>
                Run Simulation
              </button>
            )}
          </p>

          {running || progress ? (
            <div className="sim-progress">
              <h3 className="foundry-heading">{running ? 'Simulating…' : 'Last progress'}</h3>
              <p>Calendar {formatSimDuration(progress?.calendarSeconds ?? 0)}</p>
              <p>Active {formatSimDuration(progress?.activeSeconds ?? 0)}</p>
              <p>
                Wave {progress?.highestWave ?? '—'} · Rebuilds {progress?.rebuilds ?? 0}
              </p>
              <p>Rebuilds {progress?.rebuilds ?? 0}</p>
              <p className="muted">{progress?.note ?? stopLabel(config.stop)}</p>
            </div>
          ) : null}

          {error ? <p className="notice">{error}</p> : null}
          {toast ? <p className="notice">{toast}</p> : null}

          {run0 ? (
            <div className="sim-results">
              <h3 className="foundry-heading">Hiveworks Balance Simulation</h3>
              <p>
                Strategy: {run0.config.strategy} · Start: {run0.config.startType} · Target:{' '}
                {stopLabel(run0.config.stop)}
              </p>
              <p>Simulated Active Time: {formatSimDuration(run0.activeSeconds)}</p>
              <p>Calendar Time: {formatSimDuration(run0.calendarSeconds)}</p>
              <p>Highest Wave: {run0.highestWave}</p>
              <p>Rebuilds: {run0.rebuilds}</p>
              <p>
                🟢 {pass} targets · 🟡 {warn} issues · 🔴 {fail} fails
              </p>
              {run0.walls[0] ? (
                <p>
                  🔴 Wave {run0.walls[0].sector * 10} wall · {run0.walls[0].likelyConstraint} ·{' '}
                  {run0.walls[0].ratio.toFixed(1)}× recent median
                </p>
              ) : null}

              <div className="sim-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => void copyText(formatSummary(report!)).then((ok) => ping(ok, 'Summary copied'))}
                >
                  Copy Summary
                </button>
                <button
                  type="button"
                  onClick={() => void copyText(formatFullReport(report!)).then((ok) => ping(ok, 'Full report copied'))}
                >
                  Copy Full Report
                </button>
                <button
                  type="button"
                  onClick={() => void copyText(formatConfigText(config, config.seed)).then((ok) => ping(ok, 'Config copied'))}
                >
                  Copy Config
                </button>
                <button
                  type="button"
                  onClick={() => downloadBlob('hiveworks-sim.json', 'application/json', reportToJson(report!))}
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => downloadBlob('hiveworks-sim.csv', 'text/csv', reportToCsv(report!))}
                >
                  Export CSV
                </button>
              </div>

              {[
                ['summary', 'Summary', formatSummary(report!)],
                [
                  'status',
                  'Balance Status',
                  run0.targets
                    .map((t) => `${t.severity}  ${t.label}: ${t.simulatedLabel} (target ${t.targetLabel})\n${t.note}`)
                    .join('\n\n') || 'No evaluated targets.',
                ],
                [
                  'milestones',
                  'Milestones',
                  run0.milestones.map((m) => `${m.label.padEnd(24)} ${formatSimDuration(m.activeSeconds)}`).join('\n') ||
                    'None',
                ],
                [
                  'waves',
                  'Wave bands',
                  run0.sectors
                    .map(
                      (s) =>
                        `W${s.sector * 10}  ${s.clearDuration != null ? formatSimDuration(s.clearDuration) : 'open'}  deaths ${s.deaths}`,
                    )
                    .join('\n') || 'None',
                ],
                [
                  'rebuilds',
                  'Rebuilds',
                  run0.rebuildLog
                    .map(
                      (r) =>
                        `#${r.index} W${r.highestSector * 10} +${r.matterEarned} Matter\n${r.reasons.join('; ')}`,
                    )
                    .join('\n\n') || 'None',
                ],
                [
                  'cores',
                  'Core Spending',
                  run0.coreSpending
                    .map((c) => `${c.name}: ${c.levelsPurchased} levels, ${(c.share * 100).toFixed(0)}% salvage`)
                    .join('\n') || 'None',
                ],
                [
                  'workers',
                  'Workers',
                  `Drones ${run0.network.drones}/${run0.network.cap}\n${Object.entries(run0.network.assignments)
                    .filter(([, n]) => (n ?? 0) > 0)
                    .map(([id, n]) => `${id} ${n}`)
                    .join(', ') || 'none assigned'}`,
                ],
                [
                  'foundry',
                  'Foundry',
                  `FP ${run0.foundry.points}\n${JSON.stringify(run0.foundry.recipeLevels)}`,
                ],
                [
                  'furnace',
                  'Furnace',
                  `Heat +${run0.furnace.heatEarned.toFixed(1)} / -${run0.furnace.heatSpent.toFixed(1)}\n${JSON.stringify(run0.furnace.active)}`,
                ],
                [
                  'economy',
                  'Economy',
                  run0.economy.map((e) => `${e.label}: +${e.earned.toFixed(1)} / -${e.spent.toFixed(1)}`).join('\n'),
                ],
                [
                  'walls',
                  'Progression Walls',
                  run0.walls.map((w) => `W${w.sector * 10} ${w.ratio.toFixed(1)}×  ${w.likelyConstraint}\n${w.detail}`).join('\n\n') ||
                    'None flagged',
                ],
                [
                  'warnings',
                  'Warnings',
                  run0.warnings.map((w) => w.message).join('\n') || 'None',
                ],
                [
                  'safety',
                  'Technical / Safety',
                  [
                    run0.stopReason,
                    ...run0.safety.map((s) => s.message),
                    ...run0.limitations.map((l) => `${l.system}: ${l.note}`),
                  ].join('\n'),
                ],
              ].map(([id, title, body]) => (
                <details
                  key={id}
                  className="more-fold"
                  open={openSection === id}
                  onToggle={(e) => {
                    if ((e.target as HTMLDetailsElement).open) setOpenSection(id)
                  }}
                >
                  <summary>{title}</summary>
                  <pre className="sim-pre">{body}</pre>
                </details>
              ))}
            </div>
          ) : null}

          {recent.length > 0 ? (
            <div>
              <h3 className="foundry-heading">Recent Simulations</h3>
              {recent.map((entry) => (
                <article key={entry.id} className="network-row">
                  <div className="network-row-main">
                    <strong>{entry.label}</strong>
                    <span className="muted">Build: {entry.build}</span>
                  </div>
                  <div className="sim-actions">
                    <button
                      type="button"
                      onClick={() => void copyText(entry.summary).then((ok) => ping(ok, 'Copied'))}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => setRecent(deleteRecentSimulation(entry.id))}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
