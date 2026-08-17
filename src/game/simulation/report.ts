import type { SimulationAggregate, SimulationConfig, SimulationReport, SimulationRunReport } from './types'
import { formatSimDuration, median, percentile } from './format'
import { stopLabel } from './presets'

export function formatConfigText(config: SimulationConfig, seed: number): string {
  const session =
    config.strategy === 'casual' && config.session
      ? `\nSession: ${formatSimDuration(config.session.activeSeconds)} active / ${formatSimDuration(config.session.offlineSeconds)} offline`
      : ''
  return [
    'Hiveworks Simulation Config',
    `Start: ${config.start.type === 'fresh' ? 'Fresh' : 'Supplied state'}`,
    `Strategy: ${config.strategy}`,
    `Until: ${stopLabel(config.stop)}`,
    `Seed: ${seed}`,
    `Runs: ${config.runs}`,
    `Accuracy: ${config.accuracy}`,
    `Logging: ${config.logging}${session}`,
  ].join('\n')
}

function milestoneLine(run: SimulationRunReport, id: string, fallback: string): string {
  const m = run.milestones.find((row) => row.id === id)
  return m ? `${fallback.padEnd(24)} ${formatSimDuration(m.activeSeconds)}` : `${fallback.padEnd(24)} —`
}

export function formatSummary(report: SimulationReport): string {
  const run = report.runs[0]
  if (!run) return 'No simulation runs.'
  const pass = run.targets.filter((t) => t.severity === 'PASS').length
  const warn = run.targets.filter((t) => t.severity === 'WARNING').length
  const fail = run.targets.filter((t) => t.severity === 'FAIL').length
  const major = run.walls[0]
  const lines: string[] = [
    '========================================',
    'HIVEWORKS CAREER SIMULATION',
    '========================================',
    '',
    `Build: ${run.build.appBuild}${run.build.href ? ` · ${run.build.href}` : ''}`,
    '',
    `Strategy: ${run.config.strategy}`,
    `Start: ${run.config.startType}`,
    `Target: ${stopLabel(run.config.stop)}`,
    `Seed: ${run.seed}`,
    '',
    `Calendar Time: ${formatSimDuration(run.calendarSeconds)}`,
    `Active Time: ${formatSimDuration(run.activeSeconds)}`,
    `Offline Time: ${formatSimDuration(run.offlineSeconds)}`,
    `Highest Sector: ${run.highestSectorEver}`,
    `Rebuilds: ${run.rebuilds}`,
    `Stop: ${run.stopReason}`,
    run.cancelled ? 'Cancelled: yes (partial report)' : '',
    '',
    '----------------------------------------',
    'BALANCE STATUS',
    '----------------------------------------',
    '',
    `PASS: ${pass}`,
    `WARNING: ${warn}`,
    `FAIL: ${fail}`,
    '',
  ]
  if (major) {
    lines.push(
      `Major issue:`,
      `Sector ${major.sector} progression wall`,
      `Clear time: ${formatSimDuration(major.clearSeconds)}`,
      `Recent sector median: ${formatSimDuration(major.recentMedian)}`,
      `Difference: ${major.ratio.toFixed(1)}×`,
      `Likely constraint: ${major.likelyConstraint}`,
      '',
    )
  }
  lines.push(
    '----------------------------------------',
    'MILESTONES',
    '----------------------------------------',
    '',
    milestoneLine(run, 'first-launch', 'First Launch'),
    milestoneLine(run, 'sector-1', 'Sector 1'),
    milestoneLine(run, 'first-pulse-upgrade', 'First Pulse upgrade'),
    milestoneLine(run, 'first-plate-upgrade', 'First Plate upgrade'),
    milestoneLine(run, 'foundry-unlock', 'Foundry unlock'),
    milestoneLine(run, 'furnace-unlock', 'Furnace unlock'),
    milestoneLine(run, 'first-rebuild', 'First Rebuild'),
    milestoneLine(run, 'sector-10', 'Sector 10'),
    milestoneLine(run, 'sector-20', 'Sector 20'),
    milestoneLine(run, 'sector-30', 'Sector 30'),
    '',
  )
  if (run.rebuildLog.length > 0) {
    lines.push('----------------------------------------', 'REBUILDS', '----------------------------------------', '')
    for (const rec of run.rebuildLog) {
      lines.push(
        `Rebuild #${rec.index}`,
        `Run duration: ${formatSimDuration(rec.previousPushSeconds)}`,
        `Highest sector: ${rec.highestSector}`,
        `Matter earned: ${rec.matterEarned}`,
        `Why: ${rec.reasons.join('; ') || 'heuristic'}`,
        rec.permanentPurchases.length
          ? `Permanent purchases: ${rec.permanentPurchases.join(', ')}`
          : 'Permanent purchases: (see Slag Bank later in the run)',
        rec.repushSeconds != null
          ? `Repush to previous best: ${formatSimDuration(rec.repushSeconds)} (ratio ${rec.repushRatio?.toFixed(2) ?? '—'})`
          : 'Repush to previous best: not reached before stop',
        '',
      )
    }
  }
  if (run.coreSpending.length > 0) {
    lines.push('----------------------------------------', 'CORE SPENDING', '----------------------------------------', '')
    for (const core of run.coreSpending) {
      lines.push(
        `${core.name}:`,
        `Levels purchased: ${core.levelsPurchased}`,
        `Share of Core spending: ${(core.share * 100).toFixed(0)}%`,
        '',
      )
    }
  }
  lines.push(
    '----------------------------------------',
    'NETWORK',
    '----------------------------------------',
    '',
    `Drones: ${run.network.drones}/${run.network.cap} (idle ${run.network.idle})`,
    `Strike: ${run.network.levels.strike}`,
    `Ward: ${run.network.levels.ward}`,
    `Yield: ${run.network.levels.yield}`,
    `Loom: ${run.network.levels.loom}`,
    `Archive: ${run.network.levels.archive}`,
    `Links: racks ${run.network.links.racks ?? 0}, acuity ${run.network.links.acuity ?? 0}, cycle ${run.network.links.cycle ?? 0}`,
    '',
  )
  if (run.economy.length > 0) {
    lines.push('----------------------------------------', 'ECONOMY', '----------------------------------------', '')
    for (const row of run.economy) {
      lines.push(`${row.label}  earned ${row.earned.toFixed(1)}  spent ${row.spent.toFixed(1)}  end ${row.ending.toFixed(1)}`)
    }
    lines.push('')
  }
  if (run.walls.length > 0) {
    lines.push('----------------------------------------', 'PROGRESSION WALLS', '----------------------------------------', '')
    for (const wall of run.walls) {
      lines.push(
        `Sector ${wall.sector}`,
        `Clear time: ${formatSimDuration(wall.clearSeconds)}`,
        `Recent sector median: ${formatSimDuration(wall.recentMedian)}`,
        `Difference: ${wall.ratio.toFixed(1)}×`,
        `Likely constraint: ${wall.likelyConstraint}`,
        '',
      )
    }
  }
  lines.push(
    '----------------------------------------',
    'PACING',
    '----------------------------------------',
    '',
    `Average meaningful-action gap: ${run.pacing.averageGap != null ? formatSimDuration(run.pacing.averageGap) : '—'}`,
    `Median: ${run.pacing.medianGap != null ? formatSimDuration(run.pacing.medianGap) : '—'}`,
    `Longest: ${run.pacing.longestGap != null ? formatSimDuration(run.pacing.longestGap) : '—'}`,
    `Location: ${run.pacing.longestAt ?? '—'}`,
    '',
    '----------------------------------------',
    'WARNINGS',
    '----------------------------------------',
    '',
  )
  if (run.warnings.length === 0 && run.safety.length === 0) {
    lines.push('None.')
  } else {
    run.warnings.forEach((w, i) => lines.push(`${i + 1}. ${w.message}`))
    for (const s of run.safety) lines.push(`Safety: ${s.message}`)
  }
  if (run.limitations.length > 0) {
    lines.push('', 'Limitations:')
    for (const lim of run.limitations) lines.push(`- ${lim.system}: ${lim.note}`)
  }
  if (report.aggregate.length > 0 && report.runs.length > 1) {
    lines.push('', '----------------------------------------', 'MULTI-RUN', '----------------------------------------', '')
    for (const agg of report.aggregate) {
      if (agg.samples.length === 0) continue
      lines.push(
        `${agg.label}`,
        `Median: ${formatSimDuration(agg.median ?? 0)}  P10: ${formatSimDuration(agg.p10 ?? 0)}  P90: ${formatSimDuration(agg.p90 ?? 0)}`,
      )
    }
  }
  lines.push('', '========================================')
  return lines.filter((line, i, arr) => line !== '' || arr[i - 1] !== '').join('\n')
}

export function formatFullReport(report: SimulationReport): string {
  const summary = formatSummary(report)
  const run = report.runs[0]
  if (!run) return summary
  const extra: string[] = [
    '',
    '========================================',
    'FULL REPORT',
    '========================================',
    '',
    formatConfigText(
      {
        ...run.config,
        start: { type: run.config.startType === 'Fresh' ? 'fresh' : 'fresh' },
      } as SimulationConfig,
      run.seed,
    ),
    '',
    'SECTORS',
  ]
  for (const s of run.sectors) {
    extra.push(
      `S${s.sector}  clear ${s.clearDuration != null ? formatSimDuration(s.clearDuration) : '—'}  deaths ${s.deaths}  salvage +${s.salvageEarned.toFixed(1)}  pulse ${s.pulseLevelOnClear ?? '—'} plate ${s.plateLevelOnClear ?? '—'}`,
    )
  }
  extra.push('', 'CORE PURCHASES')
  for (const p of run.corePurchases.slice(0, 80)) {
    extra.push(
      `${formatSimDuration(p.activeSeconds)}  ${p.name} L${p.levelAfter}  cost ${p.cost}  ${p.statBefore.toFixed(1)} → ${p.statAfter.toFixed(1)}`,
    )
  }
  extra.push('', 'FOUNDRY', `Points ${run.foundry.points}`, `Recipes ${JSON.stringify(run.foundry.recipeLevels)}`, `Equipped ${run.foundry.equipped.join(', ') || 'none'}`)
  extra.push('', 'FURNACE', `Heat earned ${run.furnace.heatEarned.toFixed(1)} spent ${run.furnace.heatSpent.toFixed(1)}`, `Upgrades ${JSON.stringify(run.furnace.upgrades)}`, `Channels ${JSON.stringify(run.furnace.active)}`)
  if (run.detailedLog.length > 0) {
    extra.push('', 'DETAILED LOG')
    extra.push(...run.detailedLog.slice(-200))
  }
  extra.push('', 'SAFETY')
  extra.push(run.safety.length ? run.safety.map((s) => s.message).join('\n') : 'No numeric faults.')
  extra.push('')
  return `${summary}\n${extra.join('\n')}`
}

export function reportToJson(report: SimulationReport): string {
  return JSON.stringify(report, null, 2)
}

export function reportToCsv(report: SimulationReport): string {
  const run = report.runs[0]
  if (!run) return 'sector,clearSeconds,deaths,salvage\n'
  const rows = ['sector,clearSeconds,deaths,relaunches,salvage,pulse,plate,holdSeconds']
  for (const s of run.sectors) {
    rows.push(
      [
        s.sector,
        s.clearDuration ?? '',
        s.deaths,
        s.relaunches,
        s.salvageEarned.toFixed(2),
        s.pulseLevelOnClear ?? '',
        s.plateLevelOnClear ?? '',
        s.holdSeconds.toFixed(1),
      ].join(','),
    )
  }
  return rows.join('\n')
}

export function aggregateMilestones(report: SimulationReport): SimulationAggregate[] {
  const ids = new Map<string, string>()
  for (const run of report.runs) {
    for (const m of run.milestones) ids.set(m.id, m.label)
  }
  const out: SimulationAggregate[] = []
  for (const [id, label] of ids) {
    const samples = report.runs
      .map((run) => run.milestones.find((m) => m.id === id)?.activeSeconds)
      .filter((n): n is number => n != null)
      .sort((a, b) => a - b)
    out.push({
      milestoneId: id,
      label,
      samples,
      median: median(samples),
      p10: percentile(samples, 10),
      p90: percentile(samples, 90),
      min: samples[0] ?? null,
      max: samples[samples.length - 1] ?? null,
    })
  }
  return out
}

export interface RecentSimSummary {
  id: string
  label: string
  build: string
  at: number
  summary: string
  configText: string
}

const MAX_RECENT = 8

export function loadRecentSimulations(): RecentSimSummary[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem('hiveworks-sim-history')
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentSimSummary[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

export function saveRecentSimulation(entry: RecentSimSummary): RecentSimSummary[] {
  const next = [entry, ...loadRecentSimulations().filter((e) => e.id !== entry.id)].slice(0, MAX_RECENT)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('hiveworks-sim-history', JSON.stringify(next))
    } catch {
      // ignore quota
    }
  }
  return next
}

export function deleteRecentSimulation(id: string): RecentSimSummary[] {
  const next = loadRecentSimulations().filter((e) => e.id !== id)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('hiveworks-sim-history', JSON.stringify(next))
    } catch {
      // ignore
    }
  }
  return next
}
