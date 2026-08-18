import type { CasualSessionProfile, SimulationConfig, SimulationStop, SimulationStrategyId } from './types'

export const DEFAULT_CASUAL_SESSION: CasualSessionProfile = {
  activeSeconds: 10 * 60,
  offlineSeconds: 4 * 60 * 60,
}

export const DEFAULT_REBUILD = {
  stallSeconds: 8 * 60,
  consecutiveLosses: 3,
  ttkSpikeMult: 3,
}

export function defaultSimulationConfig(
  partial: Partial<SimulationConfig> & Pick<SimulationConfig, 'stop' | 'strategy'>,
): SimulationConfig {
  return {
    start: partial.start ?? { type: 'fresh' },
    stop: partial.stop,
    strategy: partial.strategy,
    seed: partial.seed ?? 1,
    runs: partial.runs ?? 1,
    accuracy: partial.accuracy ?? 'accurate',
    logging: partial.logging ?? 'milestones',
    session: partial.session ?? DEFAULT_CASUAL_SESSION,
    decisionIntervalSeconds: partial.decisionIntervalSeconds ?? (partial.strategy === 'casual' ? 5 : 2),
    maxCalendarSeconds: partial.maxCalendarSeconds ?? 14 * 24 * 3600,
    maxIterations: partial.maxIterations ?? 2_000_000,
    deadlockSeconds: partial.deadlockSeconds ?? 45 * 60,
    postRebuildSeconds: partial.postRebuildSeconds ?? 3 * 60,
    rebuild: partial.rebuild ?? { ...DEFAULT_REBUILD },
  }
}

export interface SimulationPreset {
  id: string
  label: string
  blurb: string
  config: SimulationConfig
}

function preset(
  id: string,
  label: string,
  blurb: string,
  strategy: SimulationStrategyId,
  stop: SimulationStop,
  extra: Partial<SimulationConfig> = {},
): SimulationPreset {
  return {
    id,
    label,
    blurb,
    config: defaultSimulationConfig({ strategy, stop, ...extra }),
  }
}

export const SIMULATION_PRESETS: SimulationPreset[] = [
  preset(
    'fresh-first-rebuild',
    'Fresh → First Rebuild',
    'Active player from a fresh save until the first Rebuild, then a short repush.',
    'active',
    { type: 'first-rebuild' },
  ),
  preset(
    'optimiser-first-rebuild',
    'Optimiser → First Rebuild',
    'Value-spend Cores and chase Research breakthroughs until the first Rebuild.',
    'optimiser',
    { type: 'first-rebuild' },
  ),
  preset(
    'fresh-hour-1',
    'Fresh → First hour',
    'Engaged hour-1 sitting from a fresh save.',
    'active',
    { type: 'active-duration', seconds: 60 * 60 },
    { deadlockSeconds: 25 * 60, maxIterations: 400_000, maxCalendarSeconds: 2 * 3600 },
  ),
  preset(
    'fresh-sector-30',
    'Fresh → Sector 30',
    'Active career through Act 1 (sector 30) across genuine Rebuilds.',
    'active',
    { type: 'sector', sector: 30 },
    { maxCalendarSeconds: 21 * 24 * 3600, deadlockSeconds: 90 * 60 },
  ),
  preset(
    'casual-1-day',
    'Casual — 1 Day',
    'One calendar day of open / close sessions with real offline catch-up.',
    'casual',
    { type: 'duration', calendarSeconds: 24 * 3600 },
  ),
  preset(
    'casual-7-days',
    'Casual — 7 Days',
    'One calendar week of casual idle-game sessions.',
    'casual',
    { type: 'duration', calendarSeconds: 7 * 24 * 3600 },
    { maxCalendarSeconds: 8 * 24 * 3600 },
  ),
  preset(
    'rebuild-x10',
    'Rebuild ×10',
    'Active player through ten Rebuild cycles.',
    'active',
    { type: 'rebuilds', count: 10 },
    { maxCalendarSeconds: 21 * 24 * 3600, deadlockSeconds: 90 * 60 },
  ),
  preset(
    'long-safety',
    'Long Safety Run',
    'Push well past early career looking for NaN, deadlock, and runaway scaling.',
    'active',
    { type: 'safety' },
    {
      maxCalendarSeconds: 3 * 24 * 3600,
      deadlockSeconds: 120 * 60,
      maxIterations: 4_000_000,
    },
  ),
]

export function presetById(id: string): SimulationPreset | undefined {
  return SIMULATION_PRESETS.find((p) => p.id === id)
}

export function stopLabel(stop: SimulationStop): string {
  switch (stop.type) {
    case 'first-rebuild':
      return 'First Rebuild'
    case 'rebuilds':
      return `Rebuild ×${stop.count}`
    case 'sector':
      return `Sector ${stop.sector}`
    case 'duration':
      return `${Math.round(stop.calendarSeconds / 3600)}h calendar`
    case 'active-duration':
      return `${Math.round(stop.seconds / 60)}m active`
    case 'unlock':
      return `Unlock ${stop.system}`
    case 'reinforce':
      return 'First Reinforce'
    case 'safety':
      return 'Long safety run'
  }
}
