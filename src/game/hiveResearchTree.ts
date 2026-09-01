/** Canonical Act 1 Research catalogue. Four ordered disciplines, ten projects each. */

import type { HiveResearchBranch } from './types'

export type HiveResearchNodeKind = 'incremental' | 'breakthrough'
export type ResearchNodeViewState = 'completed' | 'active' | 'available' | 'locked' | 'hidden'

export interface HiveResearchNodeDef {
  id: string
  name: string
  shortName: string
  blurb: string
  branch: HiveResearchBranch
  prerequisites: string[]
  col: number
  row: number
  duration: number
  kind: HiveResearchNodeKind
  foundrySpeed?: number
  heatFromAsh?: number
  furnaceHeatCostMult?: number
  foundrySlots?: number
  foundryFitSlots?: number
  droneEfficiency?: number
  researchQueueSlots?: number
  researchProjectSlots?: number
  coreStartLevel?: number
  workshopStartRanks?: number
  salvageOpsMult?: number
  droneCapBonus?: number
  workerManufacture?: number
  foundryOutput?: number
  inspectDetail?: boolean
  hubIntel?: boolean
  reclaimRouting?: number
  relicTier?: 2 | 3
  processKernel?: boolean
  doctrineProfiles?: boolean
  targetingSlew?: number
  targetingAcquisition?: number
  /** Neutral compatibility fields consumed by generic bonus readers. Canonical nodes leave these unset. */
  salvage?: number
  damage?: number
  shield?: number
  networkFill?: number
  data?: number
  shardDrop?: number
  researchXp?: number
  furnaceSlots?: number
  foundryMasteryReduce?: number
  foundryInfiniteReduce?: number
  extraUtilitySlots?: number
  offFocusAdd?: number
  processCostMult?: number
  unlockRelay?: import('./types').NetworkBarId
  unlockReliquary?: import('./types').ReliquaryColor
  unlockFrame?: string
  focusFire?: boolean
}

const MIN = 60
export const RESEARCH_INCREMENTAL_S = 15 * MIN
export const RESEARCH_BREAKTHROUGH_S = 45 * MIN
const durations = [15, 25, 35, 45, 55, 65, 75, 85, 95, 105].map((minutes) => minutes * MIN)

interface Seed extends Omit<HiveResearchNodeDef, 'branch' | 'prerequisites' | 'col' | 'row' | 'duration' | 'kind'> {
  effect?: Partial<HiveResearchNodeDef>
}

function discipline(branch: HiveResearchBranch, seeds: Seed[]): HiveResearchNodeDef[] {
  return seeds.map(({ effect, ...seed }, index) => ({
    ...seed,
    ...effect,
    branch,
    prerequisites: index === 0 ? [] : [seeds[index - 1]!.id],
    col: index,
    row: 1,
    duration: durations[index]!,
    kind: index === 0 || index === 3 || index === 7 ? 'breakthrough' : 'incremental',
  }))
}

const ENGINEERING = discipline('energy', [
  { id: 'e1-cycle-engineering', name: 'Cycle Engineering', shortName: 'Cycle', blurb: 'Improves the repeatable Rebuild-cycle foundation.' },
  { id: 'e2-workshop-tooling', name: 'Workshop Tooling', shortName: 'Tooling', blurb: 'Improves Workshop preparation between Sorties.', effect: { workshopStartRanks: 1 } },
  { id: 'e3-thermal-conduits', name: 'Thermal Conduits', shortName: 'Conduits', blurb: 'Improves Ash-to-Heat conversion efficiency.', effect: { heatFromAsh: 0.2 } },
  { id: 'e4-core-priming', name: 'Core Priming', shortName: 'Priming', blurb: 'Physical Cores begin each Rebuild cycle one Core Level higher.', effect: { coreStartLevel: 1 } },
  { id: 'e5-frame-calibration', name: 'Frame Calibration', shortName: 'Frames', blurb: 'Calibrates late Frame and Core-bus interfaces.' },
  { id: 'e6-workshop-template', name: 'Workshop Template', shortName: 'Template', blurb: 'Preserves a stronger Workshop starting template.', effect: { workshopStartRanks: 1 } },
  { id: 'e7-reclaim-routing', name: 'Reclaim Routing', shortName: 'Reclaim', blurb: 'Reduces empty reinforcement waiting on deeply solved Waves.', effect: { reclaimRouting: 1 } },
  { id: 'e8-thermal-recovery', name: 'Thermal Recovery', shortName: 'Recovery', blurb: 'Modestly reduces Heat required by selected Furnace channels and opens the late third channel.', effect: { furnaceHeatCostMult: 0.9, furnaceSlots: 1 } },
  { id: 'e9-cycle-memory', name: 'Cycle Memory', shortName: 'Memory', blurb: 'Carries more learned setup into the next Rebuild cycle.', effect: { coreStartLevel: 1 } },
  { id: 'e10-reconstruction-accelerator', name: 'Reconstruction Accelerator', shortName: 'Accelerator', blurb: 'Further compresses proven, pressure-free Wave downtime.', effect: { reclaimRouting: 1 } },
])

const DRONES = discipline('observation', [
  { id: 'd1-fire-control-doctrine', name: 'Fire-Control Doctrine', shortName: 'Doctrine', blurb: 'Unlocks per-physical-Core targeting Doctrine configuration.' },
  { id: 'd2-gyroscopic-calibration', name: 'Gyroscopic Calibration', shortName: 'Gyros', blurb: 'Improves Core slew without erasing authored handling.', effect: { targetingSlew: 0.1 } },
  { id: 'd3-predictive-acquisition', name: 'Predictive Acquisition', shortName: 'Predict', blurb: 'Improves pre-acquisition and firing preparation.', effect: { targetingAcquisition: 0.08 } },
  { id: 'd4-worker-calibration', name: 'Worker Calibration', shortName: 'Workers', blurb: 'Worker Drones contribute more to Research and industry.', effect: { droneEfficiency: 0.12 } },
  { id: 'd5-drone-racks', name: 'Drone Racks', shortName: 'Racks', blurb: 'Raises permanent Worker Drone capacity.', effect: { droneCapBonus: 2 } },
  { id: 'd6-fabrication-assistants', name: 'Fabrication Assistants', shortName: 'Assist', blurb: 'Assigned Workers accelerate fabrication more effectively.', effect: { workerManufacture: 0.2 } },
  { id: 'd7-salvage-coordination', name: 'Salvage Coordination', shortName: 'Salvage', blurb: 'Improves staffed Salvage Operations.', effect: { salvageOpsMult: 0.25 } },
  { id: 'd8-auxiliary-interfaces', name: 'Auxiliary Interfaces', shortName: 'Aux', blurb: 'Opens advanced Drone and Frame interfaces.' },
  { id: 'd9-doctrine-memory', name: 'Doctrine Memory', shortName: 'Memory', blurb: 'Preserves deliberate Doctrine choices across loadout use.' },
  { id: 'd10-fire-control-profiles', name: 'Fire-Control Profiles', shortName: 'Profiles', blurb: 'Unlocks saved targeting profiles loaded manually or once at launch.', effect: { doctrineProfiles: true } },
])

const INDUSTRY = discipline('material', [
  { id: 'i1-second-processor', name: 'Second Processor', shortName: 'Processor', blurb: 'Adds a second simultaneous Foundry Processor.', effect: { foundrySlots: 1 } },
  { id: 'i2-fabrication-machinery', name: 'Fabrication Machinery', shortName: 'Machinery', blurb: 'Adds Fabrication capacity.', effect: { foundryFitSlots: 1 } },
  { id: 'i3-relic-tempering', name: 'Relic Tempering', shortName: 'Temper II', blurb: 'Allows physical Tier I Relics to be transformed into Tier II.', effect: { relicTier: 2 } },
  { id: 'i4-pattern-recovery', name: 'Pattern Recovery', shortName: 'Recovery', blurb: 'Improves deterministic pattern and Processing recovery.', effect: { foundrySpeed: 0.08 } },
  { id: 'i5-material-yield', name: 'Material Yield', shortName: 'Yield', blurb: 'Processing cycles yield one additional material.', effect: { foundryOutput: 1 } },
  { id: 'i6-worker-jigs', name: 'Worker Jigs', shortName: 'Jigs', blurb: 'Improves Worker-assisted Foundry throughput.', effect: { droneEfficiency: 0.08 } },
  { id: 'i7-duplicate-tooling', name: 'Duplicate Tooling', shortName: 'Duplicate', blurb: 'Reduces friction when fabricating known duplicate designs.', effect: { foundrySpeed: 0.08 } },
  { id: 'i8-masterwork-tempering', name: 'Masterwork Tempering', shortName: 'Temper III', blurb: 'Allows physical Tier II Relics to be transformed into Tier III.', effect: { relicTier: 3 } },
  { id: 'i9-parallel-fabrication', name: 'Parallel Fabrication', shortName: 'Parallel', blurb: 'Adds another Fabrication slot.', effect: { foundryFitSlots: 1 } },
  { id: 'i10-pattern-archive', name: 'Pattern Archive', shortName: 'Archive', blurb: 'Completes the Act 1 industrial pattern archive.', effect: { foundrySpeed: 0.1 } },
])

const COMPUTE = discipline('computation', [
  { id: 'c1-queue-buffer', name: 'Queue Buffer', shortName: 'Buffer', blurb: 'Adds one explicit Research queue slot.', effect: { researchQueueSlots: 1 } },
  { id: 'c2-combat-telemetry', name: 'Combat Telemetry', shortName: 'Telemetry', blurb: 'Exposes useful live combat readouts.', effect: { inspectDetail: true } },
  { id: 'c3-deep-queue', name: 'Deep Queue', shortName: 'Deep Queue', blurb: 'Adds two explicit Research queue slots.', effect: { researchQueueSlots: 2 } },
  { id: 'c4-process-kernel', name: 'Process Kernel', shortName: 'Kernel', blurb: 'Unlocks Process and exposes all banked Process Points.', effect: { processKernel: true } },
  { id: 'c5-pressure-analysis', name: 'Pressure Analysis', shortName: 'Pressure', blurb: 'Adds backlog and defensive-pressure conditions to Process.' },
  { id: 'c6-comparative-inspect', name: 'Comparative Inspect', shortName: 'Compare', blurb: 'Shows current and resulting values in advanced inspection.', effect: { inspectDetail: true } },
  { id: 'c7-profile-memory', name: 'Profile Memory', shortName: 'Memory', blurb: 'Preserves named automation profiles.' },
  { id: 'c8-parallel-analysis', name: 'Parallel Analysis', shortName: 'Parallel', blurb: 'Allows a second simultaneous Research project.', effect: { researchProjectSlots: 1 } },
  { id: 'c9-systems-overview', name: 'Systems Overview', shortName: 'Overview', blurb: 'Shows active system state and remaining time from Systems.', effect: { hubIntel: true } },
  { id: 'c10-failure-analysis', name: 'Failure Analysis', shortName: 'Failure', blurb: 'Adds late diagnostic context without changing combat outcomes.', effect: { inspectDetail: true } },
])

export const RESEARCH_TREE: HiveResearchNodeDef[] = [...ENGINEERING, ...DRONES, ...INDUSTRY, ...COMPUTE]
export const RESEARCH_NODE_BY_ID: Record<string, HiveResearchNodeDef> = Object.fromEntries(RESEARCH_TREE.map((node) => [node.id, node]))

export function getHiveResearchNode(id: string): HiveResearchNodeDef | undefined { return RESEARCH_NODE_BY_ID[id] }

export function resolvedResearchIds(research?: { completedIds?: string[]; completed?: Partial<Record<HiveResearchBranch, number>> } | null): string[] {
  if (!research) return []
  return [...new Set((research.completedIds ?? []).filter((id) => Boolean(RESEARCH_NODE_BY_ID[id])))]
}

export function sumResearchNumber(ids: string[] | undefined, field: 'coreStartLevel' | 'workshopStartRanks' | 'salvageOpsMult' | 'droneCapBonus' | 'workerManufacture' | 'foundryOutput'): number {
  return (ids ?? []).reduce((sum, id) => sum + Number(getHiveResearchNode(id)?.[field] ?? 0), 0)
}

/** Process costs are fixed seed costs; Research never discounts them. */
export function researchProcessCostMult(_ids: string[] | undefined): number { return 1 }

export const HIVE_RESEARCH_NODES: Record<HiveResearchBranch, HiveResearchNodeDef[]> = {
  energy: ENGINEERING,
  observation: DRONES,
  material: INDUSTRY,
  computation: COMPUTE,
}
