/** Branching Act 1 Research trees. One completed node may unlock two or more alternatives. */

import type { HiveResearchBranch, NetworkBarId, ReliquaryColor } from './types'

export const RESEARCH_INCREMENTAL_S = 8 * 60
export const RESEARCH_BREAKTHROUGH_S = 20 * 60

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
  salvage?: number
  foundrySpeed?: number
  damage?: number
  shield?: number
  heatFromAsh?: number
  networkFill?: number
  data?: number
  shardDrop?: number
  researchXp?: number
  furnaceSlots?: number
  foundrySlots?: number
  foundryFitSlots?: number
  foundryMasteryReduce?: number
  foundryInfiniteReduce?: number
  droneEfficiency?: number
  extraUtilitySlots?: number
  offFocusAdd?: number
  researchQueueSlots?: number
  protocolXp?: number
  unlockRelay?: NetworkBarId
  unlockReliquary?: ReliquaryColor
  unlockFrame?: string
  focusFire?: boolean
  combatSpeed?: number
  coreStartLevel?: number
  workshopStartRanks?: number
  salvageOpsMult?: number
  droneCapBonus?: number
  workerManufacture?: number
  foundryOutput?: number
  processCostMult?: number
  inspectDetail?: boolean
  /** Systems hub prints remaining time and the exact effect. */
  hubIntel?: boolean
}

const BT = RESEARCH_BREAKTHROUGH_S
const INC = RESEARCH_INCREMENTAL_S

export const RESEARCH_TREE: HiveResearchNodeDef[] = [
  // Hive Engineering — hull / Workshop / Frames / reclaim. Three-way fork, later reconnect.
  {
    id: 'plate-bank',
    name: 'Plate Bank',
    shortName: 'Plate',
    blurb: 'Each physical Core begins a cycle one Core Level higher. Hull strength is planned at the dock.',
    branch: 'energy',
    prerequisites: [],
    col: 0,
    row: 1,
    duration: 12 * 60,
    kind: 'breakthrough',
    coreStartLevel: 1,
  },
  {
    id: 'extra-tap',
    name: 'Extra Tap',
    shortName: 'Tap',
    blurb: 'Lights one more Furnace channel and unlocks the Reactor Frame.',
    branch: 'energy',
    prerequisites: ['plate-bank'],
    col: 1,
    row: 0,
    duration: BT * 1.2,
    kind: 'breakthrough',
    furnaceSlots: 1,
    unlockFrame: 'reactor-frame',
  },
  {
    id: 'workshop-primer',
    name: 'Workshop Primer',
    shortName: 'Primer',
    blurb: 'Rebuilds start with one Attack and one Defense Workshop rank already bought.',
    branch: 'energy',
    prerequisites: ['plate-bank'],
    col: 1,
    row: 1,
    duration: INC * 1.5,
    kind: 'incremental',
    workshopStartRanks: 1,
  },
  {
    id: 'keel-bay',
    name: 'Keel Bay',
    shortName: 'Keel',
    blurb: 'One extra utility Core slot on the hull, and Foundry mastery gates open sooner.',
    branch: 'energy',
    prerequisites: ['plate-bank'],
    col: 1,
    row: 2,
    duration: BT * 1.2,
    kind: 'breakthrough',
    extraUtilitySlots: 1,
    foundryInfiniteReduce: 2,
  },
  {
    id: 'heat-routing',
    name: 'Heat Routing',
    shortName: 'Heat',
    blurb: 'Lights one more Furnace channel.',
    branch: 'energy',
    prerequisites: ['extra-tap'],
    col: 2,
    row: 0,
    duration: BT * 1.4,
    kind: 'breakthrough',
    furnaceSlots: 1,
  },
  {
    id: 'reclaim-loop',
    name: 'Reclaim Loop',
    shortName: 'Reclaim',
    blurb: 'Salvage Operations haul Scrap at double the base job rate.',
    branch: 'energy',
    prerequisites: ['extra-tap'],
    col: 2,
    row: 1,
    duration: INC * 2,
    kind: 'incremental',
    salvageOpsMult: 1,
  },
  {
    id: 'hangar-swap',
    name: 'Hangar Calibration',
    shortName: 'Hangar',
    blurb: 'Adds a Fabrication slot. Frames and Cores can be built side by side.',
    branch: 'energy',
    prerequisites: ['extra-tap', 'keel-bay'],
    col: 3,
    row: 1,
    duration: BT * 1.6,
    kind: 'breakthrough',
    foundryFitSlots: 1,
  },

  // Drone Systems — targeting, Core behaviour, Worker manufacturing. Split then reconnect.
  {
    id: 'priority-lock',
    name: 'Priority Lock',
    shortName: 'Lock',
    blurb: 'Cores lock wounded hulls and bosses first. A permanent targeting rule.',
    branch: 'observation',
    prerequisites: [],
    col: 0,
    row: 1,
    duration: 12 * 60,
    kind: 'breakthrough',
    focusFire: true,
  },
  {
    id: 'worker-calibration',
    name: 'Worker Calibration',
    shortName: 'Calibrate',
    blurb: 'Worker Drones contribute more to Processing, Fabrication, and Research.',
    branch: 'observation',
    prerequisites: ['priority-lock'],
    col: 1,
    row: 0,
    duration: BT * 1.2,
    kind: 'breakthrough',
    droneEfficiency: 0.12,
  },
  {
    id: 'combat-sim',
    name: 'Combat Sim',
    shortName: 'Sim',
    blurb: 'Unlocks combat simulation at ×2.',
    branch: 'observation',
    prerequisites: ['priority-lock'],
    col: 1,
    row: 2,
    duration: INC * 1.5,
    kind: 'incremental',
    combatSpeed: 2,
  },
  {
    id: 'drone-racks',
    name: 'Drone Racks',
    shortName: 'Racks',
    blurb: 'Raises Worker Drone capacity by four.',
    branch: 'observation',
    prerequisites: ['worker-calibration'],
    col: 2,
    row: 0,
    duration: INC * 2,
    kind: 'incremental',
    droneCapBonus: 4,
  },
  {
    id: 'drone-line',
    name: 'Drone Line',
    shortName: 'Line',
    blurb: 'Staffed Worker Drone fabrication runs faster.',
    branch: 'observation',
    prerequisites: ['worker-calibration'],
    col: 2,
    row: 1,
    duration: INC * 2,
    kind: 'incremental',
    workerManufacture: 0.35,
  },
  {
    id: 'blue-bay',
    name: 'Blue Bay',
    shortName: 'Blue',
    blurb: 'Opens the blue Relic socket. A new colour of chip can be fitted.',
    branch: 'observation',
    prerequisites: ['combat-sim'],
    col: 2,
    row: 2,
    duration: BT * 1.4,
    kind: 'breakthrough',
    unlockReliquary: 'blue',
  },
  {
    id: 'workforce-sync',
    name: 'Workforce Sync',
    shortName: 'Sync',
    blurb: 'Targeting data feeds the floor. Assigned Worker Drones fill jobs a little harder.',
    branch: 'observation',
    prerequisites: ['drone-racks', 'combat-sim'],
    col: 3,
    row: 1,
    duration: INC * 2.5,
    kind: 'incremental',
    droneEfficiency: 0.04,
  },

  // Industrial Science — Processing, Fabrication, Mastery, infrastructure.
  {
    id: 'second-processor',
    name: 'Second Processor',
    shortName: 'Processor',
    blurb: 'Adds a Foundry Processor. The floor can run another material recipe at once.',
    branch: 'material',
    prerequisites: [],
    col: 0,
    row: 1,
    duration: 12 * 60,
    kind: 'breakthrough',
    foundrySlots: 1,
  },
  {
    id: 'pattern-floor',
    name: 'Pattern Floor',
    shortName: 'Pattern',
    blurb: 'Recipe mastery gates open one rank sooner. Advanced stock comes online earlier.',
    branch: 'material',
    prerequisites: ['second-processor'],
    col: 1,
    row: 0,
    duration: BT * 1.2,
    kind: 'breakthrough',
    foundryMasteryReduce: 1,
  },
  {
    id: 'fab-machinery',
    name: 'Fabrication Machinery',
    shortName: 'Fab',
    blurb: 'Adds a Fabrication slot for Cores, Relics, and Infrastructure.',
    branch: 'material',
    prerequisites: ['second-processor'],
    col: 1,
    row: 2,
    duration: INC * 1.5,
    kind: 'incremental',
    foundryFitSlots: 1,
  },
  {
    id: 'mastery-loop',
    name: 'Mastery Loop',
    shortName: 'Mastery',
    blurb: 'Late mastery gates open two ranks sooner.',
    branch: 'material',
    prerequisites: ['pattern-floor'],
    col: 2,
    row: 0,
    duration: INC * 2,
    kind: 'incremental',
    foundryInfiniteReduce: 1,
  },
  {
    id: 'temper-line',
    name: 'Temper Line',
    shortName: 'Temper',
    blurb: 'Every Processing cycle yields one extra piece.',
    branch: 'material',
    prerequisites: ['fab-machinery'],
    col: 2,
    row: 2,
    duration: INC * 2,
    kind: 'incremental',
    foundryOutput: 1,
  },
  {
    id: 'hearth-line',
    name: 'Hearth Line',
    shortName: 'Hearth',
    blurb: 'Adds a third Processor once Mastery and Fabrication both stand.',
    branch: 'material',
    prerequisites: ['pattern-floor', 'fab-machinery'],
    col: 3,
    row: 1,
    duration: BT * 1.6,
    kind: 'breakthrough',
    foundrySlots: 1,
  },

  // Computational Systems — analytics, UI intelligence, Process rule complexity.
  {
    id: 'queue-desk',
    name: 'Queue Desk',
    shortName: 'Queue',
    blurb: 'The Research Queue holds one more project. Process still decides whether it runs itself.',
    branch: 'computation',
    prerequisites: [],
    col: 0,
    row: 1,
    duration: BT,
    kind: 'breakthrough',
    researchQueueSlots: 1,
  },
  {
    id: 'inspect-layer',
    name: 'Inspect Layer',
    shortName: 'Inspect',
    blurb: 'Inspect sheets show current and resulting values for the next Research project.',
    branch: 'computation',
    prerequisites: ['queue-desk'],
    col: 1,
    row: 0,
    duration: INC * 1.5,
    kind: 'incremental',
    inspectDetail: true,
  },
  {
    id: 'process-primer',
    name: 'Rule Primer',
    shortName: 'Rules',
    blurb: 'Process nodes cost 15% fewer Process points.',
    branch: 'computation',
    prerequisites: ['queue-desk'],
    col: 1,
    row: 2,
    duration: INC * 1.5,
    kind: 'incremental',
    processCostMult: 0.85,
  },
  {
    id: 'background-notes',
    name: 'Watch Desk',
    shortName: 'Watch',
    blurb: 'The Systems hub prints the active project’s remaining time and exact effect. Research is readable from the dock.',
    branch: 'computation',
    prerequisites: ['inspect-layer'],
    col: 2,
    row: 0,
    duration: BT * 1.2,
    kind: 'breakthrough',
    hubIntel: true,
  },
  {
    id: 'challenge-log',
    name: 'Challenge Log',
    shortName: 'Log',
    blurb: 'Active Challenges grant extra Research speed. The desk learns from restricted sorties.',
    branch: 'computation',
    prerequisites: ['process-primer'],
    col: 2,
    row: 2,
    duration: INC * 2,
    kind: 'incremental',
    protocolXp: 0.15,
  },
  {
    id: 'auto-desk',
    name: 'Auto Desk',
    shortName: 'Auto',
    blurb: 'Deepens the Research Queue. Process can keep more projects in motion.',
    branch: 'computation',
    prerequisites: ['inspect-layer', 'process-primer'],
    col: 3,
    row: 1,
    duration: BT * 1.6,
    kind: 'breakthrough',
    researchQueueSlots: 2,
  },
]

/** Old sequential index → new node id, so existing saves keep breakthroughs. */
export const LEGACY_RESEARCH_SEQUENCE: Record<HiveResearchBranch, string[]> = {
  energy: [
    'priority-lock',
    'plate-bank',
    'extra-tap',
    'combat-sim',
    'workshop-primer',
    'worker-calibration',
    'keel-bay',
    'heat-routing',
    'hangar-swap',
  ],
  observation: [
    'priority-lock',
    'combat-sim',
    'worker-calibration',
    'drone-racks',
    'drone-line',
    'blue-bay',
    'workforce-sync',
  ],
  material: [
    'second-processor',
    'pattern-floor',
    'fab-machinery',
    'mastery-loop',
    'temper-line',
    'hearth-line',
  ],
  computation: [
    'queue-desk',
    'inspect-layer',
    'process-primer',
    'background-notes',
    'challenge-log',
    'auto-desk',
  ],
}

function byLayout(a: HiveResearchNodeDef, b: HiveResearchNodeDef): number {
  return a.col - b.col || a.row - b.row || a.id.localeCompare(b.id)
}

export const RESEARCH_NODE_BY_ID: Record<string, HiveResearchNodeDef> = Object.fromEntries(
  RESEARCH_TREE.map((node) => [node.id, node]),
)

export function getHiveResearchNode(id: string): HiveResearchNodeDef | undefined {
  return RESEARCH_NODE_BY_ID[id]
}

/** Prefer completedIds; fall back to legacy per-discipline counts. */
export function resolvedResearchIds(research?: {
  completedIds?: string[]
  completed?: Partial<Record<HiveResearchBranch, number>>
} | null): string[] {
  if (!research) return []
  const fromSave = (research.completedIds ?? []).filter(
    (id): id is string => typeof id === 'string' && Boolean(RESEARCH_NODE_BY_ID[id]),
  )
  if (fromSave.length > 0) return [...new Set(fromSave)]
  const derived: string[] = []
  for (const branch of ['energy', 'observation', 'material', 'computation'] as const) {
    const n = Math.max(0, Math.floor(Number(research.completed?.[branch] ?? 0) || 0))
    const seq = LEGACY_RESEARCH_SEQUENCE[branch]
    for (let i = 0; i < n; i++) {
      const id = seq[i]
      if (id) derived.push(id)
    }
  }
  return [...new Set(derived)]
}

export function sumResearchNumber(
  ids: string[] | undefined,
  field:
    | 'coreStartLevel'
    | 'workshopStartRanks'
    | 'salvageOpsMult'
    | 'droneCapBonus'
    | 'workerManufacture'
    | 'foundryOutput',
): number {
  let total = 0
  for (const id of ids ?? []) {
    const node = getHiveResearchNode(id)
    total += Number(node?.[field] ?? 0)
  }
  return total
}

export function researchProcessCostMult(ids: string[] | undefined): number {
  let mult = 1
  for (const id of ids ?? []) {
    const node = getHiveResearchNode(id)
    if (node?.processCostMult) mult *= node.processCostMult
  }
  return mult
}

export const HIVE_RESEARCH_NODES: Record<HiveResearchBranch, HiveResearchNodeDef[]> = {
  energy: RESEARCH_TREE.filter((node) => node.branch === 'energy').sort(byLayout),
  observation: RESEARCH_TREE.filter((node) => node.branch === 'observation').sort(byLayout),
  material: RESEARCH_TREE.filter((node) => node.branch === 'material').sort(byLayout),
  computation: RESEARCH_TREE.filter((node) => node.branch === 'computation').sort(byLayout),
}
