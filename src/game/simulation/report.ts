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
    `Highest Wave: ${run.highestWave}`,
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
      `Wave ${major.sector * 10} progression wall`,
      `Clear time: ${formatSimDuration(major.clearSeconds)}`,
      `Recent wave-band median: ${formatSimDuration(major.recentMedian)}`,
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
    milestoneLine(run, 'wave-1', 'Wave 1'),
    milestoneLine(run, 'first-defeat', 'First defeat'),
    milestoneLine(run, 'first-pulse-upgrade', 'First Pulse upgrade'),
    milestoneLine(run, 'first-plate-upgrade', 'First Plate upgrade'),
    milestoneLine(run, 'foundry-unlock', 'Foundry'),
    milestoneLine(run, 'workers-unlock', 'Workers'),
    milestoneLine(run, 'first-rebuild', 'First Rebuild'),
    milestoneLine(run, 'reliquary-unlock', 'Relics'),
    milestoneLine(run, 'furnace-unlock', 'Furnace'),
    milestoneLine(run, 'hive-research-unlock', 'Research'),
    milestoneLine(run, 'first-research-bt', 'First Research BT'),
    milestoneLine(run, 'process-unlock', 'Process'),
    milestoneLine(run, 'unlock-protocols', 'Challenges'),
    milestoneLine(run, 'wave-300', 'Wave 300'),
    '',
  )
  if (run.sorties.length > 0) {
    const first = run.sorties[0]!
    const early = run.sorties.filter((s) => s.previousBest < 70)
    const mid = run.sorties.filter((s) => s.previousBest >= 70 && s.previousBest < 170)
    const late = run.sorties.filter((s) => s.previousBest >= 170)
    const avg = (rows: typeof run.sorties) =>
      rows.length ? rows.reduce((s, r) => s + r.duration, 0) / rows.length : 0
    const medianDelta = (rows: typeof run.sorties) => {
      const deltas = rows.filter((r) => r.newBest).map((r) => r.endWave - r.previousBest)
      if (!deltas.length) return 0
      const sorted = [...deltas].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)] ?? 0
    }
    lines.push(
      '----------------------------------------',
      'SORTIES',
      '----------------------------------------',
      '',
      `Count: ${run.sorties.length}`,
      `First Sortie: ${formatSimDuration(first.duration)} → W${first.endWave} (${first.outcome ?? '—'})`,
      early.length ? `Early duration avg: ${formatSimDuration(avg(early))}  Best Δ ${medianDelta(early)}` : '',
      mid.length ? `Mid duration avg: ${formatSimDuration(avg(mid))}  Best Δ ${medianDelta(mid)}` : '',
      late.length ? `Late duration avg: ${formatSimDuration(avg(late))}  Best Δ ${medianDelta(late)}` : '',
      `Salvage spent on run upgrades: ${run.sorties.reduce((s, r) => s + r.salvageSpent, 0).toFixed(0)}`,
      '',
    )
  }
  if (run.rebuildLog.length > 0) {
    lines.push('----------------------------------------', 'REBUILDS', '----------------------------------------', '')
    const recs = run.rebuildLog
    const shown = recs.length <= 3 ? recs : [recs[0]!, recs[1]!, recs[recs.length - 1]!]
    if (recs.length > shown.length) {
      lines.push(`Showing first two and last of ${recs.length} Rebuilds`, '')
    }
    for (const rec of shown) {
      lines.push(
        `Rebuild #${rec.index}`,
        `Run duration: ${formatSimDuration(rec.previousPushSeconds)}`,
        `Highest Wave: ${rec.highestSector * 10}`,
        `Matter earned: ${rec.matterEarned}`,
        `Why: ${rec.reasons.join('; ') || 'heuristic'}`,
        rec.permanentPurchases.length
          ? `Permanent purchases: ${rec.permanentPurchases.join(', ')}`
          : 'Permanent purchases: none this Rebuild',
        rec.workshopLost && Object.keys(rec.workshopLost).length
          ? `Workshop at Rebuild: ${Object.entries(rec.workshopLost)
              .filter(([, n]) => (n ?? 0) > 0)
              .map(([id, n]) => `${id} L${n}`)
              .join(', ')}`
          : 'Workshop at Rebuild: none',
        rec.coresLost && Object.keys(rec.coresLost).length
          ? `Core Starts at Rebuild: ${Object.entries(rec.coresLost)
              .map(([id, n]) => `${id} L${n}`)
              .join(', ')}`
          : 'Core Starts at Rebuild: none',
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
        `Share of Core Scrap: ${(core.share * 100).toFixed(0)}%`,
        '',
      )
    }
  }
  lines.push(
    '----------------------------------------',
    'WORKERS',
    '----------------------------------------',
    '',
    `Drones: ${run.network.drones}/${run.network.cap} (idle ${run.network.idle}, assigned ${run.network.assigned})`,
    `Jobs: ${Object.entries(run.network.assignments)
      .filter(([, n]) => (n ?? 0) > 0)
      .map(([id, n]) => `${id} ${n}`)
      .join(', ') || 'none'}`,
    '',
    '----------------------------------------',
    'RESEARCH / PROCESS / FOUNDRY / FURNACE',
    '----------------------------------------',
    '',
    `Research: M${run.research.material} E${run.research.energy} O${run.research.observation}  focus ${run.research.focus}  BT ${run.research.breakthroughs}`,
    `Process: earned ${run.process.earned}  unspent ${run.process.available}  bought ${run.process.purchased.length}`,
    `Foundry: recipes ${Object.keys(run.foundry.recipeLevels).length}  processors ${run.foundry.slotRecipes.filter(Boolean).length}`,
    `Furnace: heat +${run.furnace.heatEarned.toFixed(1)} / −${run.furnace.heatSpent.toFixed(1)}  channels ${JSON.stringify(run.furnace.active)}`,
    `Challenges: ${JSON.stringify(run.protocols.ranks)}`,
    '',
  )
  const snap = run.snapshots[run.snapshots.length - 1]
  if (snap) {
    const c = snap.contribution
    lines.push(
      '----------------------------------------',
      'ACT 1 SNAPSHOT',
      '----------------------------------------',
      '',
      `At ${snap.at}  active ${formatSimDuration(snap.activeSeconds)}  calendar ${formatSimDuration(snap.calendarSeconds)}`,
      `Wave ${snap.bestWave} (band ${snap.highestEver})  Pulse ${snap.pulse}  Plate ${snap.plate}`,
      `Workers ${snap.drones}/${snap.droneCap}`,
      `Foundry recipes ${snap.foundryRecipes} furnace lit ${snap.furnaceLit}/${snap.furnaceSlots}`,
      `Research M${snap.research.material} E${snap.research.energy} O${snap.research.observation} BT ${snap.researchBreakthroughs}`,
      `Process earned ${snap.processEarned} bought ${snap.processPurchased} Rebuilds ${snap.rebuilds}`,
      `Damage extras: Furnace +${(c.furnaceDamage * 100).toFixed(0)}%  Relics +${(c.reliquaryDamage * 100).toFixed(0)}%  Research +${(c.researchDamage * 100).toFixed(0)}%  Rebuild momentum +${(c.rebuildMomentum * 100).toFixed(0)}%`,
      '',
    )
  }
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
        `Wave ${wall.sector * 10}`,
        `Clear time: ${formatSimDuration(wall.clearSeconds)}`,
        `Recent wave-band median: ${formatSimDuration(wall.recentMedian)}`,
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
    'WAVE BANDS',
  ]
  for (const s of run.sectors) {
    extra.push(
      `W${s.sector * 10}  clear ${s.clearDuration != null ? formatSimDuration(s.clearDuration) : '—'}  deaths ${s.deaths}  salvage +${s.salvageEarned.toFixed(1)}  pulse ${s.pulseLevelOnClear ?? '—'} plate ${s.plateLevelOnClear ?? '—'}`,
    )
  }
  extra.push('', 'CORE PURCHASES')
  for (const p of run.corePurchases.slice(0, 80)) {
    extra.push(
      `${formatSimDuration(p.activeSeconds)}  ${p.name} L${p.levelAfter}  cost ${p.cost}  ${p.statBefore.toFixed(1)} → ${p.statAfter.toFixed(1)}`,
    )
  }
  extra.push('', 'FOUNDRY', `Recipes ${JSON.stringify(run.foundry.recipeLevels)}`)
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
  if (!run) return 'wave,clearSeconds,deaths,salvage\n'
  const rows = ['wave,clearSeconds,deaths,relaunches,salvage,pulse,plate,holdSeconds']
  for (const s of run.sectors) {
    rows.push(
      [
        s.sector * 10,
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
