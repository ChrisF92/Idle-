/** Process 2.0 — account-wide automation, QoL, and lifetime accumulation. */

import type {
  FoundryRecipeId,
  FurnaceChannelId,
  GameState,
  HiveResearchBranch,
  ProcessAction,
  ProcessCondition,
  ProcessConfig,
  ProcessCorePriority,
  ProcessFoundryUpgradePriority,
  ProcessNetworkPreset,
  ProcessProfile,
  ProcessRule,
  ProcessSpendMix,
  ProcessState,
  ProcessThenKind,
  ProcessThreatId,
  ProcessWhenKind,
  TabId,
  YardArmId,
} from './types'
import { createDefaultProcessProfiles, withDefaultProfiles } from './processProfiles'
import { NETWORK_BAR_IDS } from './types'
import { careerBestWave, isSystemUnlocked } from './progression'
import { AI_NODES } from './catalog'
import { isWorkerJob, WORKER_JOB_IDS } from './workers'
import { practicedCoreWork } from './corePractice'
import { researchProcessCostMult, resolvedResearchIds } from './hiveResearchTree'

export type ProcessKind = 'automation' | 'qol'

export type ProcessCategory =
  | 'cores'
  | 'network'
  | 'foundry'
  | 'reliquary'
  | 'research'
  | 'furnace'
  | 'sortie'
  | 'yard'
  | 'qol'

export type ProcessMastery =
  | 'cores'
  | 'network'
  | 'foundry'
  | 'reliquary'
  | 'research'
  | 'furnace'
  | 'yard'
  | 'protocols'
  | 'echo'

export interface ProcessNodeDef {
  id: string
  name: string
  blurb: string
  cost: number
  category: ProcessCategory
  kind: ProcessKind
  requiresId?: string
  requiresBestWave?: number
  requiresSystem?: TabId
  requiresMastery?: ProcessMastery
}

export const PROCESS_CATEGORIES: { id: ProcessCategory; name: string }[] = [
  { id: 'qol', name: 'Quality of life' },
  { id: 'cores', name: 'Cores' },
  { id: 'foundry', name: 'Foundry' },
  { id: 'network', name: 'Worker Drones' },
  { id: 'furnace', name: 'Furnace' },
  { id: 'research', name: 'Research' },
  { id: 'sortie', name: 'Sortie' },
  { id: 'reliquary', name: 'Relics' },
  { id: 'yard', name: 'Construction' },
]

export { NETWORK_BAR_IDS }

export const NETWORK_PRESETS: Record<
  Exclude<ProcessNetworkPreset, 'custom'>,
  Partial<Record<string, number>>
> = {
  push: {
    'scrap-field': 4,
    'fab-bay': 3,
    'alloy-foundry': 2,
    'sensor-net': 1,
  },
  defence: {
    'scrap-field': 3,
    'alloy-foundry': 3,
    'fab-bay': 2,
    'sensor-net': 2,
  },
  farm: {
    'scrap-field': 5,
    'sensor-net': 3,
    'alloy-foundry': 2,
    'drone-fab': 1,
  },
  industry: {
    'drone-fab': 4,
    'fab-bay': 3,
    construction: 3,
    'alloy-foundry': 2,
    'scrap-field': 2,
  },
  research: {
    'sensor-net': 5,
    'scrap-field': 2,
    'alloy-foundry': 2,
    'fab-bay': 1,
  },
  balanced: {
    'scrap-field': 2,
    'sensor-net': 2,
    'alloy-foundry': 2,
    'drone-fab': 2,
    'fab-bay': 1,
    construction: 1,
  },
}

export const NETWORK_PRESET_LABELS: Record<ProcessNetworkPreset, string> = {
  push: 'Push',
  defence: 'Defence',
  farm: 'Farm',
  industry: 'Industry',
  research: 'Research',
  balanced: 'Balanced',
  custom: 'Custom',
}

export const CORE_PRIORITY_LABELS: Record<ProcessCorePriority, string> = {
  cheapest: 'Cheapest',
  weapon: 'Weapon',
  shield: 'Shield',
  utility: 'Utility',
  balanced: 'Balanced',
  custom: 'Custom ratios',
  value: 'Best value',
}

/**
 * Act 1 Process tree. Helper → configuration → full automation.
 * Costs are reachable from mastery achievements, not mutually exclusive.
 */
export const PROCESS_NODES: ProcessNodeDef[] = [
  {
    id: 'buy-ten',
    name: 'Buy ×10',
    category: 'qol',
    kind: 'qol',
    blurb: 'Adds ×10 on Salvage and Workshop purchases.',
    cost: 2,
  },
  {
    id: 'shop-buy-max',
    name: 'Buy Max',
    category: 'qol',
    kind: 'qol',
    blurb: 'Adds MAX to temporary Salvage upgrades and Workshop purchases.',
    cost: 4,
    requiresId: 'buy-ten',
  },
  {
    id: 'shop-readout',
    name: 'Shop Readout',
    category: 'qol',
    kind: 'qol',
    blurb: 'Shows time-to-afford and Economy ROI on Salvage and Workshop tiles.',
    cost: 2,
  },
  {
    id: 'auto-shop',
    name: 'Shop Auto Buy',
    category: 'sortie',
    kind: 'automation',
    blurb: 'While a Sortie is live, spend Salvage on Attack, Defense, and Economy globals.',
    cost: 8,
    requiresId: 'buy-ten',
  },
  {
    id: 'spend-ratios',
    name: 'Spend Ratios',
    category: 'sortie',
    kind: 'automation',
    blurb: 'Set Attack / Defense / Economy targets and a Salvage reserve. Example 50 / 30 / 20.',
    cost: 8,
    requiresId: 'auto-shop',
  },
  {
    id: 'rule-builder',
    name: 'Rule Builder',
    category: 'sortie',
    kind: 'automation',
    blurb: 'WHEN Wave, threat, or an empty queue AND … THEN spend, extract, or light Furnace. Chips only.',
    cost: 12,
    requiresId: 'spend-ratios',
  },
  {
    id: 'run-profiles',
    name: 'Run Profiles',
    category: 'sortie',
    kind: 'automation',
    blurb: 'Farm, Push, and Challenge profiles. Farm banks Economy and Extracts; Push dumps Economy near Best and lights Furnace.',
    cost: 10,
    requiresId: 'rule-builder',
  },
  {
    id: 'network-optimise',
    name: 'Worker Optimise',
    category: 'network',
    kind: 'automation',
    blurb: 'One tap assigns idle Worker Drones to industrial jobs using the current allocation.',
    cost: 4,
    requiresMastery: 'network',
  },
  {
    id: 'network-presets',
    name: 'Worker Presets',
    category: 'network',
    kind: 'automation',
    blurb: 'Push, Defence, Farm, Industry, Research, or Balanced job mixes. Weights stay visible.',
    cost: 8,
    requiresId: 'network-optimise',
  },
  {
    id: 'network-ratios',
    name: 'Worker Job Weights',
    category: 'network',
    kind: 'automation',
    blurb: 'Write your own job weights. Optimise and Auto Optimise both honour them.',
    cost: 12,
    requiresId: 'network-presets',
  },
  {
    id: 'network-balance',
    name: 'Worker Auto Optimise',
    category: 'network',
    kind: 'automation',
    blurb: 'Idle Worker Drones fill industrial jobs using your preset. Config lives on this Process node.',
    cost: 10,
    requiresId: 'network-presets',
  },
  {
    id: 'network-tune',
    name: 'Worker Sortie Bias',
    category: 'network',
    kind: 'automation',
    blurb: 'Optional overlay: while flying, lean Push toward salvage/fab jobs and Farm toward Scrap Field.',
    cost: 8,
    requiresId: 'network-balance',
    requiresBestWave: 70,
  },
  {
    id: 'foundry-buy-max',
    name: 'Foundry Buy Max',
    category: 'foundry',
    kind: 'automation',
    blurb: 'Compatibility placeholder; hidden from the Process shop.',
    cost: 4,
    requiresSystem: 'foundry',
    requiresMastery: 'foundry',
  },
  {
    id: 'foundry-repeat',
    name: 'Repeat Recipe',
    category: 'foundry',
    kind: 'automation',
    blurb: 'Empty Processors refill the recipe you pin. You pick the recipe.',
    cost: 6,
    requiresSystem: 'foundry',
  },
  {
    id: 'smart-smelt',
    name: 'Smart Processing',
    category: 'foundry',
    kind: 'automation',
    blurb: 'Empty Processors select unfinished recipes without consuming Fabricator capacity.',
    cost: 10,
    requiresSystem: 'foundry',
    requiresBestWave: 30,
  },
  {
    id: 'foundry-queue',
    name: 'Production Queue',
    category: 'foundry',
    kind: 'automation',
    blurb: 'Line up Processing recipes. Processors pull from this queue before Smart Processing.',
    cost: 12,
    requiresId: 'smart-smelt',
    requiresSystem: 'foundry',
  },
  {
    id: 'foundry-prereqs',
    name: 'Foundry Prerequisites',
    category: 'foundry',
    kind: 'automation',
    blurb: 'Toward a pinned target, craft missing materials first. You still choose the target.',
    cost: 15,
    requiresId: 'foundry-queue',
    requiresSystem: 'foundry',
  },
  {
    id: 'foundry-priority',
    name: 'Foundry Upgrade Priority',
    category: 'foundry',
    kind: 'automation',
    blurb: 'Compatibility placeholder; hidden from the Process shop.',
    cost: 10,
    requiresId: 'foundry-buy-max',
    requiresSystem: 'foundry',
  },
  {
    id: 'foundry-auto',
    name: 'Foundry Auto Buy',
    category: 'foundry',
    kind: 'automation',
    blurb: 'Compatibility placeholder; hidden from the Process shop.',
    cost: 16,
    requiresId: 'foundry-priority',
    requiresSystem: 'foundry',
    requiresBestWave: 60,
  },
  {
    id: 'print-assemble',
    name: 'Blueprint Fabrication',
    category: 'foundry',
    kind: 'automation',
    blurb: 'Start the tracked Core Blueprint project when its fragments and materials are ready.',
    cost: 8,
    requiresId: 'smart-smelt',
    requiresSystem: 'foundry',
    requiresBestWave: 40,
  },
  {
    id: 'auto-relic',
    name: 'Relic Auto Equip',
    category: 'reliquary',
    kind: 'automation',
    blurb: 'Empty Relic sockets seat a matching Relic. Never scraps. Swaps only if you allow it.',
    cost: 8,
    requiresSystem: 'reliquary',
    requiresMastery: 'reliquary',
  },
  {
    id: 'reliquary-keep',
    name: 'Relic Keep Rules',
    category: 'reliquary',
    kind: 'automation',
    blurb: 'Keep all, keep best, or upgrade-only. Auto Equip will not dump a fitted Relic by default.',
    cost: 10,
    requiresId: 'auto-relic',
    requiresSystem: 'reliquary',
  },
  {
    id: 'reliquary-quality',
    name: 'Relic Quality Gate',
    category: 'reliquary',
    kind: 'automation',
    blurb: 'Minimum score before Auto Equip will seat or swap a shard.',
    cost: 8,
    requiresId: 'reliquary-keep',
    requiresSystem: 'reliquary',
  },
  {
    id: 'reliquary-merge',
    name: 'Relic Auto Merge',
    category: 'reliquary',
    kind: 'automation',
    blurb: 'Fold spare Signal Cores only after you enable it. Off by default so nothing valuable disappears.',
    cost: 12,
    requiresId: 'reliquary-keep',
    requiresSystem: 'reliquary',
  },
  {
    id: 'auto-bank',
    name: 'Furnace Auto Feed',
    category: 'furnace',
    kind: 'automation',
    blurb: 'Choir-ash banks into Heat on its own whenever the tank has room.',
    cost: 6,
    requiresSystem: 'furnace',
  },
  {
    id: 'furnace-presets',
    name: 'Furnace Presets',
    category: 'furnace',
    kind: 'automation',
    blurb: 'Push (Weapons + Ward) or Farm (Weapons + Yield). One tap sets which channels you want lit.',
    cost: 10,
    requiresId: 'auto-bank',
    requiresSystem: 'furnace',
  },
  {
    id: 'furnace-reserve',
    name: 'Furnace Reserve',
    category: 'furnace',
    kind: 'automation',
    blurb: 'Hold a Heat reserve Process must not spend on channels.',
    cost: 8,
    requiresId: 'furnace-presets',
    requiresSystem: 'furnace',
  },
  {
    id: 'furnace-channels',
    name: 'Furnace Channels',
    category: 'furnace',
    kind: 'automation',
    blurb: 'Let Process raise and lower channel levels to keep Heat sustainable. You still set priority.',
    cost: 12,
    requiresId: 'furnace-presets',
    requiresSystem: 'furnace',
  },
  {
    id: 'furnace-auto',
    name: 'Furnace Manager',
    category: 'furnace',
    kind: 'automation',
    blurb: 'Keep configured channels lit while Heat lasts. Respects reserve, priority, and Auto Channel.',
    cost: 16,
    requiresId: 'auto-bank',
    requiresSystem: 'furnace',
    requiresBestWave: 80,
  },
  {
    id: 'research-queue',
    name: 'Research Queue',
    category: 'research',
    kind: 'automation',
    blurb: 'Line up which discipline to research next. Completions wait for your queue unless Auto is on.',
    cost: 5,
    requiresSystem: 'research',
    requiresMastery: 'research',
  },
  {
    id: 'research-priorities',
    name: 'Research Branch Priority',
    category: 'research',
    kind: 'automation',
    blurb: 'Order Hive Engineering, Drone Systems, and Industrial Science. Auto Research follows this list.',
    cost: 10,
    requiresId: 'research-queue',
    requiresSystem: 'research',
  },
  {
    id: 'research-focus',
    name: 'Auto Research',
    category: 'research',
    kind: 'automation',
    blurb: 'Start the next available project along your queue. Never picks a hidden “best” node.',
    cost: 12,
    requiresId: 'research-priorities',
    requiresSystem: 'research',
    requiresBestWave: 70,
  },
  {
    id: 'auto-extract',
    name: 'Auto Extract',
    category: 'sortie',
    kind: 'automation',
    blurb: 'Pull out of a live Sortie if hull drops under your threshold (default 35%).',
    cost: 6,
    requiresBestWave: 20,
  },
  {
    id: 'sortie-relaunch',
    name: 'Sortie Relaunch',
    category: 'sortie',
    kind: 'automation',
    blurb: 'When docked with full hull, launch again. Toggleable. Does not choose Advance vs Hold.',
    cost: 10,
    requiresId: 'auto-extract',
  },
  {
    id: 'offline-sortie',
    name: 'Ghost Sortie',
    category: 'sortie',
    kind: 'automation',
    blurb: 'Later progression. Act 1 Sorties freeze while you are away; Hive industry still runs.',
    cost: 14,
    requiresId: 'auto-extract',
    requiresBestWave: 40,
  },
  {
    id: 'protocol-repeat',
    name: 'Challenge Repeat',
    category: 'sortie',
    kind: 'automation',
    blurb: 'After you clear a Challenge by hand, re-enter the selected Challenge if Repeat is on. It will not skip the first clear.',
    cost: 8,
    requiresSystem: 'protocols',
    requiresMastery: 'protocols',
  },
  {
    id: 'protocol-presets',
    name: 'Challenge Presets',
    category: 'sortie',
    kind: 'automation',
    blurb: 'Pick which Challenge Repeat restarts. First clear is still by hand.',
    cost: 6,
    requiresId: 'protocol-repeat',
    requiresSystem: 'protocols',
  },
  {
    id: 'echo-repeat',
    name: 'Echo Repeat',
    category: 'sortie',
    kind: 'automation',
    blurb: 'Retired. Echo is not in Act 1; Challenges cover alternate combat tests.',
    cost: 10,
    requiresSystem: 'echo',
    requiresMastery: 'echo',
  },
  {
    id: 'yard-buy-max',
    name: 'Construction Buy Max',
    category: 'yard',
    kind: 'automation',
    blurb: 'Spend Ingots on selected construction arms in one tap.',
    cost: 4,
    requiresSystem: 'yard',
    requiresMastery: 'yard',
  },
  {
    id: 'yard-layouts',
    name: 'Construction Layouts',
    category: 'yard',
    kind: 'automation',
    blurb: 'Save and restore construction grids. Extra slots come from Accumulation.',
    cost: 10,
    requiresId: 'yard-buy-max',
    requiresSystem: 'yard',
  },
  {
    id: 'yard-auto',
    name: 'Construction Auto Arms',
    category: 'yard',
    kind: 'automation',
    blurb: 'Automatically buy the construction arms you selected. Buildings stay under your hand.',
    cost: 14,
    requiresId: 'yard-layouts',
    requiresSystem: 'yard',
  },
  {
    id: 'deep-cache',
    name: 'Deep Cache',
    category: 'qol',
    kind: 'qol',
    blurb: '+4 hours on the offline cap, on top of Accumulation bonuses.',
    cost: 12,
    requiresBestWave: 80,
  },
  {
    id: 'combat-tempo',
    name: 'Combat Tempo',
    category: 'qol',
    kind: 'qol',
    blurb: 'Combat sim runs at ×1.5. Industry still uses real time.',
    cost: 15,
    requiresId: 'auto-salvage',
    requiresBestWave: 100,
  },
  {
    id: 'combat-overclock',
    name: 'Combat Overclock',
    category: 'qol',
    kind: 'qol',
    blurb: 'Combat sim may run at ×3. Industry still uses real time.',
    cost: 18,
    requiresId: 'combat-tempo',
    requiresBestWave: 210,
  },
]

/** Nodes that fight the GDD loop or belong to retired systems. Kept on the save, hidden from the shop. */
export const PROCESS_HIDDEN_IDS = new Set([
  'echo-repeat',
  'auto-bank',
  'furnace-presets',
  'furnace-reserve',
  'furnace-channels',
  'furnace-auto',
  'network-tune',
  'offline-sortie',
  'foundry-buy-max',
  'foundry-priority',
  'foundry-auto',
  'yard-buy-max',
  'yard-layouts',
  'yard-auto',
])

const RETIRED_CORE_RUN_PROCESS_IDS = new Set([
  'core-buy-max',
  'core-priority',
  'core-ratios',
  'core-presets',
  'auto-salvage',
  'smart-core',
])

export type ProcessRevealTier = 'qol' | 'actions' | 'priorities' | 'later'

export const PROCESS_REVEAL_TIERS: { id: ProcessRevealTier; name: string }[] = [
  { id: 'qol', name: 'Quality of life' },
  { id: 'actions', name: 'Simple actions' },
  { id: 'priorities', name: 'Priorities' },
  { id: 'later', name: 'Deeper automation' },
]

const PROCESS_NODE_TIER: Record<string, ProcessRevealTier> = {
  'buy-ten': 'qol',
  'shop-readout': 'qol',
  'core-buy-max': 'qol',
  'foundry-buy-max': 'qol',
  'yard-buy-max': 'qol',
  'deep-cache': 'qol',
  'combat-tempo': 'qol',
  'auto-shop': 'actions',
  'auto-salvage': 'actions',
  'foundry-repeat': 'actions',
  'smart-smelt': 'actions',
  'print-assemble': 'actions',
  'research-queue': 'actions',
  'auto-extract': 'actions',
  'sortie-relaunch': 'actions',
  'network-optimise': 'actions',
  'auto-relic': 'actions',
  'protocol-repeat': 'actions',
  'spend-ratios': 'priorities',
  'core-priority': 'priorities',
  'core-ratios': 'priorities',
  'core-presets': 'priorities',
  'foundry-priority': 'priorities',
  'foundry-queue': 'priorities',
  'research-priorities': 'priorities',
  'network-presets': 'priorities',
  'network-ratios': 'priorities',
  'reliquary-keep': 'priorities',
  'yard-layouts': 'priorities',
}

export function processNodeTier(node: ProcessNodeDef): ProcessRevealTier {
  if (node.kind === 'qol') return 'qol'
  return PROCESS_NODE_TIER[node.id] ?? 'later'
}

export function processRevealAllows(state: GameState, tier: ProcessRevealTier): boolean {
  const bought = state.process?.purchased?.length ?? 0
  if (tier === 'qol' || tier === 'actions') return true
  if (tier === 'priorities') return bought >= 1
  return bought >= 2
}

export function processVisibleNodes(state: GameState): ProcessNodeDef[] {
  return PROCESS_NODES.filter((node) => {
    if (PROCESS_HIDDEN_IDS.has(node.id)) return false
    return processRevealAllows(state, processNodeTier(node))
  })
}

/** Manual loops the player has already practised — GDD §139. */
export function processLessonCount(state: GameState): number {
  const cores = practicedCoreWork(state)
  const workshop = Object.values(state.workshop?.levels ?? {}).reduce((sum, n) => sum + Math.max(0, n), 0)
  const recipes = Object.values(state.foundry?.recipeLevels ?? {}).reduce((sum, n) => sum + Math.max(0, n), 0)
  return cores + workshop + recipes + (state.meta.lifetimeFabCrafts ?? 0)
}

export function processOnlineBlurb(state: GameState): string {
  const n = processLessonCount(state)
  if (n >= 8) {
    return `You've already done this work ${n} times. Process can automate behaviours you've learned.`
  }
  return 'Automate behaviours you have already learned. Buy after you understand the loop.'
}

export type ProcessAccumEffect =
  | { type: 'salvage'; mult: number }
  | { type: 'networkSpeed'; mult: number }
  | { type: 'damage'; mult: number }
  | { type: 'shield'; mult: number }
  | { type: 'foundrySpeed'; mult: number }
  | { type: 'researchSpeed'; mult: number }
  | { type: 'offlineHours'; hours: number }
  | { type: 'furnaceOutput'; mult: number }
  | { type: 'presetSlot'; extra: number }
  | { type: 'industrySpeed'; mult: number }

export interface ProcessAccumulationDef {
  id: string
  atEarned: number
  name: string
  blurb: string
  effect: ProcessAccumEffect
}

/** Lifetime Process Earned milestones. Data-driven — append to extend. */
export const PROCESS_ACCUMULATION: ProcessAccumulationDef[] = [
  {
    id: 'acc-salvage-10',
    atEarned: 10,
    name: 'Scrap Memory',
    blurb: '×1.10 Salvage from wrecks.',
    effect: { type: 'salvage', mult: 1.1 },
  },
  {
    id: 'acc-network-20',
    atEarned: 20,
    name: 'Workforce Cadence',
    blurb: '×1.10 Worker Drone fabrication speed.',
    effect: { type: 'industrySpeed', mult: 1.1 },
  },
  {
    id: 'acc-combat-35',
    atEarned: 35,
    name: 'Hardened Pattern',
    blurb: '×1.10 Damage and Shield.',
    effect: { type: 'damage', mult: 1.1 },
  },
  {
    id: 'acc-foundry-50',
    atEarned: 50,
    name: 'Kiln Memory',
    blurb: '×1.10 Foundry craft speed.',
    effect: { type: 'foundrySpeed', mult: 1.1 },
  },
  {
    id: 'acc-research-75',
    atEarned: 75,
    name: 'Archive Habit',
    blurb: '×1.15 Research speed.',
    effect: { type: 'researchSpeed', mult: 1.15 },
  },
  {
    id: 'acc-offline-100',
    atEarned: 100,
    name: 'Long Watch',
    blurb: '+2 hours offline capacity.',
    effect: { type: 'offlineHours', hours: 2 },
  },
  {
    id: 'acc-furnace-150',
    atEarned: 150,
    name: 'Heat Ledger',
    blurb: '×1.15 Furnace Heat generation.',
    effect: { type: 'furnaceOutput', mult: 1.15 },
  },
  {
    id: 'acc-salvage-200',
    atEarned: 200,
    name: 'Wreck Census',
    blurb: '×1.15 Salvage from wrecks.',
    effect: { type: 'salvage', mult: 1.15 },
  },
  {
    id: 'acc-combat-300',
    atEarned: 300,
    name: 'Battle Ledger',
    blurb: '×1.15 Damage and Shield.',
    effect: { type: 'damage', mult: 1.15 },
  },
  {
    id: 'acc-preset-400',
    atEarned: 400,
    name: 'Extra Rack',
    blurb: '+1 saved preset / layout slot.',
    effect: { type: 'presetSlot', extra: 1 },
  },
  {
    id: 'acc-industry-500',
    atEarned: 500,
    name: 'Shop Floor',
    blurb: '×1.10 Worker Drone fabrication speed.',
    effect: { type: 'industrySpeed', mult: 1.1 },
  },
]

export function createEmptyProcessConfig(): ProcessConfig {
  return {
    core: {
      enabled: true,
      priority: 'cheapest',
      ratios: { weapon: 2, shield: 2, utility: 1 },
      presets: [],
      activePreset: 0,
    },
    network: {
      enabled: true,
      preset: 'balanced',
      ratios: { ...NETWORK_PRESETS.balanced },
    },
    foundry: {
      autoBuy: true,
      repeatRecipe: null,
      queue: [],
      targetRecipe: null,
      upgradePriority: 'cheapest',
    },
    reliquary: {
      autoMerge: false,
      autoEquip: true,
      keepMode: 'keep-all',
      minScore: 0,
    },
    furnace: {
      autoFeed: true,
      preset: null,
      manager: true,
      autoChannel: false,
      reserveHeat: 0,
      priority: ['weapons', 'shielding', 'recovery', 'foundry', 'network', 'research'],
    },
    research: {
      autoResearch: true,
      queue: [],
      branchPriority: ['material', 'energy', 'observation'],
    },
    yard: {
      autoUpgrade: true,
      selectedArms: ['damage', 'shield', 'salvage', 'network'],
      layouts: [],
      activeLayout: 0,
    },
    sortie: {
      autoExtract: true,
      extractHullPct: 0.35,
      autoRelaunch: true,
      protocolRepeat: false,
      echoRepeat: false,
      lastProtocolId: null,
      lastEchoId: null,
      protocolId: null,
    },
    shop: {
      autoBuy: true,
      ratios: { attack: 50, defense: 30, economy: 20 },
      salvageReserve: 0,
    },
    activeProfileId: null,
    profiles: createDefaultProcessProfiles(),
  }
}

export function createEmptyProcessState(): ProcessState {
  return { purchased: [], earned: 0, config: createEmptyProcessConfig() }
}

export function processAvailable(state: GameState): number {
  return Math.max(0, state.resources.aiPoints)
}

export function processEarned(state: GameState): number {
  return Math.max(0, state.process?.earned ?? 0)
}

export function processConfig(state: GameState): ProcessConfig {
  return state.process?.config ?? createEmptyProcessConfig()
}

export function getProcessNode(id: string): ProcessNodeDef | undefined {
  return PROCESS_NODES.find((n) => n.id === id)
}

export function hasProcess(state: GameState, id: string): boolean {
  if (RETIRED_CORE_RUN_PROCESS_IDS.has(id)) return false
  return (state.process?.purchased ?? []).includes(id)
}

export function grantProcessPrereqs(purchased: string[]): string[] {
  const owned = new Set(purchased)
  let changed = true
  while (changed) {
    changed = false
    for (const node of PROCESS_NODES) {
      if (!owned.has(node.id) || !node.requiresId || owned.has(node.requiresId)) continue
      owned.add(node.requiresId)
      changed = true
    }
  }
  return PROCESS_NODES.map((n) => n.id).filter((id) => owned.has(id)).concat(
    [...owned].filter((id) => !PROCESS_NODES.some((n) => n.id === id)),
  )
}

export function hasProcessMastery(state: GameState, kind: ProcessMastery): boolean {
  switch (kind) {
    case 'cores':
      return practicedCoreWork(state) > 0
    case 'network':
      return Object.entries(state.base.assignments ?? {}).some(
        ([id, n]) => (n ?? 0) > 0 && isWorkerJob(id),
      )
    case 'foundry':
      return Object.values(state.foundry?.recipeLevels ?? {}).some((n) => n > 0)
    case 'reliquary':
      return (
        Object.values(state.reliquary?.owned ?? {}).some((n) => n > 0) ||
        Object.values(state.reliquary?.coreFits ?? {}).some((fits) => (fits ?? []).some(Boolean))
      )
    case 'research':
      return (state.hiveResearch?.completedIds?.length ?? 0) > 0
        || Object.values(state.hiveResearch?.completed ?? {}).some((n) => n > 0)
    case 'furnace':
      return (
        Object.values(state.furnace?.active ?? {}).some((n) => n > 0) ||
        (state.resources.choirAsh ?? 0) > 0 ||
        (state.resources.heat ?? 0) > 0
      )
    case 'yard':
      return (state.yard?.cells ?? []).some((c) => Boolean(c.buildingId))
    case 'protocols':
      return Object.values(state.protocols?.ranks ?? {}).some((n) => n > 0)
    case 'echo':
      return Object.values(state.echo?.clears ?? {}).some((n) => n > 0)
  }
}

function systemLockReason(system: TabId): string {
  switch (system) {
    case 'foundry':
      return 'Foundry closed'
    case 'reliquary':
      return 'Relics closed'
    case 'furnace':
      return 'Furnace dark'
    case 'research':
      return 'Research closed'
    case 'yard':
      return 'Construction closed'
    case 'protocols':
      return 'Challenges closed'
    case 'echo':
      return 'Retired'
    default:
      return 'Locked'
  }
}

function masteryLockReason(kind: ProcessMastery): string {
  switch (kind) {
    case 'cores':
      return 'Rank a Core first'
    case 'network':
      return 'Assign Worker Drones first'
    case 'foundry':
      return 'Finish a craft first'
    case 'reliquary':
      return 'Fit a Relic first'
    case 'research':
      return 'Complete a Research project first'
    case 'furnace':
      return 'Convert Ash or light a channel first'
    case 'yard':
      return 'Place a building first'
    case 'protocols':
      return 'Clear a Challenge first'
    case 'echo':
      return 'Clear an Echo first'
  }
}

export function processNodeCost(state: GameState, def: ProcessNodeDef): number {
  return Math.max(1, Math.ceil(def.cost * researchProcessCostMult(resolvedResearchIds(state.hiveResearch))))
}

export function canBuyProcessNode(
  state: GameState,
  id: string,
): { ok: boolean; reason?: string } {
  const def = getProcessNode(id)
  if (!def) return { ok: false, reason: 'Unknown node' }
  if (hasProcess(state, id)) return { ok: false, reason: 'Owned' }
  if (PROCESS_HIDDEN_IDS.has(id)) return { ok: false, reason: 'Retired' }
  if (def.requiresId && !hasProcess(state, def.requiresId)) {
    const prior = getProcessNode(def.requiresId)
    return { ok: false, reason: prior ? `Need ${prior.name}` : 'Need prior node' }
  }
  if (def.requiresSystem && !isSystemUnlocked(state, def.requiresSystem)) {
    return { ok: false, reason: systemLockReason(def.requiresSystem) }
  }
  if (def.requiresBestWave && careerBestWave(state) < def.requiresBestWave) {
    return { ok: false, reason: `Reach Wave ${def.requiresBestWave}` }
  }
  if (def.requiresMastery && !hasProcessMastery(state, def.requiresMastery)) {
    return { ok: false, reason: masteryLockReason(def.requiresMastery) }
  }
  const cost = processNodeCost(state, def)
  if (state.resources.aiPoints < cost) {
    return { ok: false, reason: `Need ${cost} Process` }
  }
  return { ok: true }
}

export function firstAffordableProcessNode(state: GameState): ProcessNodeDef | null {
  for (const node of processVisibleNodes(state)) {
    if (canBuyProcessNode(state, node.id).ok) return node
  }
  return null
}

export function grantProcessPoints(state: GameState, amount: number): void {
  const n = Math.max(0, Math.floor(amount))
  if (n <= 0) return
  if (!state.process) state.process = createEmptyProcessState()
  state.resources.aiPoints += n
  state.process.earned = (state.process.earned ?? 0) + n
}

export function reconstructProcessEarned(state: GameState): number {
  const available = Math.max(0, state.resources.aiPoints)
  let spent = 0
  for (const id of state.process?.purchased ?? []) {
    spent += getProcessNode(id)?.cost ?? 0
  }
  for (const id of state.ai?.purchased ?? []) {
    spent += AI_NODES.find((n) => n.id === id)?.costAiPoints ?? 0
  }
  return available + spent
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function num(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function mergeProcessConfig(raw: unknown): ProcessConfig {
  const empty = createEmptyProcessConfig()
  if (!isRecord(raw)) return empty
  const core = isRecord(raw.core) ? raw.core : {}
  const network = isRecord(raw.network) ? raw.network : {}
  const foundry = isRecord(raw.foundry) ? raw.foundry : {}
  const reliquary = isRecord(raw.reliquary) ? raw.reliquary : {}
  const furnace = isRecord(raw.furnace) ? raw.furnace : {}
  const research = isRecord(raw.research) ? raw.research : {}
  const yard = isRecord(raw.yard) ? raw.yard : {}
  const sortie = isRecord(raw.sortie) ? raw.sortie : {}
  const shop = isRecord(raw.shop) ? raw.shop : {}
  const shopRatios = isRecord(shop.ratios) ? shop.ratios : {}
  const ratios = isRecord(core.ratios) ? core.ratios : {}
  const netRatios = isRecord(network.ratios) ? network.ratios : {}
  const corePriority = typeof core.priority === 'string' ? core.priority : empty.core.priority
  const netPreset = typeof network.preset === 'string' ? network.preset : empty.network.preset
  const foundryPriority =
    typeof foundry.upgradePriority === 'string' ? foundry.upgradePriority : empty.foundry.upgradePriority
  const keepMode = typeof reliquary.keepMode === 'string' ? reliquary.keepMode : empty.reliquary.keepMode
  return {
    core: {
      enabled: core.enabled !== false,
      priority: (CORE_PRIORITY_LABELS[corePriority as ProcessCorePriority]
        ? corePriority
        : empty.core.priority) as ProcessCorePriority,
      ratios: {
        weapon: Math.max(0, num(ratios.weapon, empty.core.ratios.weapon)),
        shield: Math.max(0, num(ratios.shield, empty.core.ratios.shield)),
        utility: Math.max(0, num(ratios.utility, empty.core.ratios.utility)),
      },
      presets: Array.isArray(core.presets)
        ? core.presets
            .filter(isRecord)
            .map((p) => ({
              name: typeof p.name === 'string' ? p.name : 'Preset',
              priority: (typeof p.priority === 'string' && CORE_PRIORITY_LABELS[p.priority as ProcessCorePriority]
                ? p.priority
                : 'cheapest') as ProcessCorePriority,
              ratios: {
                weapon: Math.max(0, num(isRecord(p.ratios) ? p.ratios.weapon : 2, 2)),
                shield: Math.max(0, num(isRecord(p.ratios) ? p.ratios.shield : 2, 2)),
                utility: Math.max(0, num(isRecord(p.ratios) ? p.ratios.utility : 1, 1)),
              },
            }))
        : [],
      activePreset: Math.max(0, Math.floor(num(core.activePreset, 0))),
    },
    network: {
      enabled: network.enabled !== false,
      preset: (NETWORK_PRESET_LABELS[netPreset as ProcessNetworkPreset]
        ? netPreset
        : empty.network.preset) as ProcessNetworkPreset,
      ratios: migrateWorkerJobRatios(netRatios, empty.network.ratios),
    },
    foundry: {
      autoBuy: foundry.autoBuy !== false,
      repeatRecipe: typeof foundry.repeatRecipe === 'string' ? (foundry.repeatRecipe as FoundryRecipeId) : null,
      queue: Array.isArray(foundry.queue)
        ? foundry.queue.filter((id): id is FoundryRecipeId => typeof id === 'string')
        : [],
      targetRecipe: typeof foundry.targetRecipe === 'string' ? (foundry.targetRecipe as FoundryRecipeId) : null,
      upgradePriority: (
        ['cheapest', 'speed', 'slots', 'output'].includes(foundryPriority)
          ? foundryPriority
          : empty.foundry.upgradePriority
      ) as ProcessFoundryUpgradePriority,
    },
    reliquary: {
      autoMerge: reliquary.autoMerge === true,
      autoEquip: reliquary.autoEquip !== false,
      keepMode: (
        ['keep-all', 'keep-best', 'upgrade-only'].includes(keepMode) ? keepMode : 'keep-all'
      ) as ProcessConfig['reliquary']['keepMode'],
      minScore: Math.max(0, num(reliquary.minScore, 0)),
    },
    furnace: {
      autoFeed: furnace.autoFeed !== false,
      preset: typeof furnace.preset === 'string' ? furnace.preset : null,
      manager: furnace.manager !== false,
      autoChannel: furnace.autoChannel === true,
      reserveHeat: Math.max(0, num(furnace.reserveHeat, 0)),
      priority: Array.isArray(furnace.priority)
        ? furnace.priority.filter((id): id is FurnaceChannelId =>
            id === 'weapons' ||
            id === 'shielding' ||
            id === 'network' ||
            id === 'foundry' ||
            id === 'research' ||
            id === 'recovery',
          )
        : [...empty.furnace.priority],
    },
    research: {
      autoResearch: research.autoResearch !== false,
      queue: Array.isArray(research.queue)
        ? research.queue.filter((id): id is HiveResearchBranch =>
            id === 'material' || id === 'energy' || id === 'observation' || id === 'computation',
          )
        : [],
      branchPriority: Array.isArray(research.branchPriority)
        ? research.branchPriority.filter((id): id is HiveResearchBranch =>
            id === 'material' || id === 'energy' || id === 'observation' || id === 'computation',
          )
        : [...empty.research.branchPriority],
    },
    yard: {
      autoUpgrade: yard.autoUpgrade !== false,
      selectedArms: Array.isArray(yard.selectedArms)
        ? yard.selectedArms.filter((id): id is YardArmId =>
            id === 'damage' || id === 'shield' || id === 'salvage' || id === 'network',
          )
        : [...empty.yard.selectedArms],
      layouts: Array.isArray(yard.layouts)
        ? yard.layouts
            .filter(isRecord)
            .map((layout) => ({
              name: typeof layout.name === 'string' ? layout.name : 'Layout',
              cells: Array.isArray(layout.cells)
                ? layout.cells.map((cell) => ({
                    buildingId:
                      isRecord(cell) && typeof cell.buildingId === 'string'
                        ? (cell.buildingId as ProcessConfig['yard']['layouts'][number]['cells'][number]['buildingId'])
                        : null,
                  }))
                : [],
            }))
        : [],
      activeLayout: Math.max(0, Math.floor(num(yard.activeLayout, 0))),
    },
    sortie: {
      autoExtract: sortie.autoExtract !== false,
      extractHullPct: Math.min(0.9, Math.max(0.05, num(sortie.extractHullPct, 0.35))),
      autoRelaunch: sortie.autoRelaunch !== false,
      protocolRepeat: sortie.protocolRepeat === true,
      echoRepeat: sortie.echoRepeat === true,
      lastProtocolId: typeof sortie.lastProtocolId === 'string' ? sortie.lastProtocolId : null,
      lastEchoId: typeof sortie.lastEchoId === 'string' ? sortie.lastEchoId : null,
      protocolId: typeof sortie.protocolId === 'string' ? sortie.protocolId : null,
    },
    shop: {
      autoBuy: shop.autoBuy !== false,
      ratios: {
        attack: Math.max(0, num(shopRatios.attack, empty.shop.ratios.attack)),
        defense: Math.max(0, num(shopRatios.defense, empty.shop.ratios.defense)),
        economy: Math.max(0, num(shopRatios.economy, empty.shop.ratios.economy)),
      },
      salvageReserve: Math.max(0, num(shop.salvageReserve, 0)),
    },
    activeProfileId: typeof raw.activeProfileId === 'string' ? raw.activeProfileId : null,
    profiles: withDefaultProfiles(hydrateProfiles(raw.profiles)),
  }
}

const WHEN_KINDS: ProcessWhenKind[] = [
  'wave-gte',
  'wave-of-best',
  'threat',
  'queue-empty',
  'ash-gte',
  'hull-lte',
  'research-idle',
]

const THEN_KINDS: ProcessThenKind[] = [
  'spend-profile',
  'economy-target',
  'extract',
  'repeat-recipe',
  'furnace-push',
  'research-next',
  'fab-tracked',
]

function hydrateSpend(raw: unknown, fallback: ProcessSpendMix): ProcessSpendMix {
  if (!isRecord(raw)) return fallback
  return {
    attack: Math.max(0, num(raw.attack, fallback.attack)),
    defense: Math.max(0, num(raw.defense, fallback.defense)),
    economy: Math.max(0, num(raw.economy, fallback.economy)),
  }
}

function hydrateCondition(raw: unknown): ProcessCondition | null {
  if (!isRecord(raw) || typeof raw.kind !== 'string') return null
  if (!WHEN_KINDS.includes(raw.kind as ProcessWhenKind)) return null
  const threat = raw.threat
  return {
    kind: raw.kind as ProcessWhenKind,
    value: raw.value == null ? undefined : num(raw.value, 0),
    threat:
      threat === 'SURVIVABILITY' || threat === 'DAMAGE' || threat === 'MIXED' || threat === 'HEALTHY'
        ? (threat as ProcessThreatId)
        : undefined,
  }
}

function hydrateAction(raw: unknown): ProcessAction {
  if (!isRecord(raw) || typeof raw.kind !== 'string' || !THEN_KINDS.includes(raw.kind as ProcessThenKind)) {
    return { kind: 'spend-profile' }
  }
  return {
    kind: raw.kind as ProcessThenKind,
    spend: raw.spend ? hydrateSpend(raw.spend, { attack: 50, defense: 30, economy: 20 }) : undefined,
    economyPct: raw.economyPct == null ? undefined : num(raw.economyPct, 0),
    recipeId: typeof raw.recipeId === 'string' ? (raw.recipeId as FoundryRecipeId) : undefined,
  }
}

function hydrateRule(raw: unknown, index: number): ProcessRule | null {
  if (!isRecord(raw)) return null
  const when = Array.isArray(raw.when)
    ? raw.when.map(hydrateCondition).filter((c): c is ProcessCondition => Boolean(c))
    : []
  if (when.length === 0) return null
  return {
    id: typeof raw.id === 'string' ? raw.id : `rule-${index}`,
    enabled: raw.enabled !== false,
    when,
    then: hydrateAction(raw.then),
  }
}

function hydrateProfiles(raw: unknown): ProcessProfile[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isRecord).map((row, index) => ({
    id: typeof row.id === 'string' ? row.id : `profile-${index}`,
    name: typeof row.name === 'string' ? row.name : 'Profile',
    spend: hydrateSpend(row.spend, { attack: 50, defense: 30, economy: 20 }),
    salvageReserve: Math.max(0, num(row.salvageReserve, 0)),
    autoExtract: row.autoExtract === true,
    extractHullPct: Math.min(0.9, Math.max(0.05, num(row.extractHullPct, 0.35))),
    autoShop: row.autoShop !== false,
    workerPreset:
      typeof row.workerPreset === 'string' && NETWORK_PRESET_LABELS[row.workerPreset as ProcessNetworkPreset]
        ? (row.workerPreset as ProcessNetworkPreset)
        : undefined,
    rules: Array.isArray(row.rules)
      ? row.rules.map(hydrateRule).filter((r): r is ProcessRule => Boolean(r))
      : [],
  }))
}

export function hydrateProcessState(raw: ProcessState | undefined): ProcessState {
  const empty = createEmptyProcessState()
  if (!raw || typeof raw !== 'object') return empty
  const purchased = Array.isArray(raw.purchased)
    ? raw.purchased
        .filter((id) => typeof id === 'string')
        .map((id) => (id === 'core-buy-max' ? 'shop-buy-max' : id))
        .filter((id) => !RETIRED_CORE_RUN_PROCESS_IDS.has(id))
    : []
  return {
    purchased: grantProcessPrereqs(purchased),
    earned: Math.max(0, Math.floor(Number(raw.earned) || 0)),
    config: mergeProcessConfig(raw.config),
  }
}

export function finalizeProcessMigration(state: GameState): void {
  const hydrated = hydrateProcessState(state.process)
  const reconstructed = reconstructProcessEarned({ ...state, process: hydrated })
  state.process = {
    ...hydrated,
    earned: Math.max(hydrated.earned, reconstructed),
  }
}

export type ProcessAccumStatus = 'achieved' | 'next' | 'future'

export function processAccumulationStatus(
  earned: number,
  def: ProcessAccumulationDef,
  all = PROCESS_ACCUMULATION,
): ProcessAccumStatus {
  if (earned >= def.atEarned) return 'achieved'
  const next = all.find((row) => earned < row.atEarned)
  return next?.id === def.id ? 'next' : 'future'
}

export function processAccumMult(
  state: GameState,
  type: ProcessAccumEffect['type'],
): number {
  const earned = processEarned(state)
  let mult = 1
  for (const row of PROCESS_ACCUMULATION) {
    if (earned < row.atEarned) continue
    if (row.effect.type === type && 'mult' in row.effect) mult *= row.effect.mult
    if (type === 'damage' && row.effect.type === 'damage') {
      /* damage rows also cover shield via processShieldMult */
    }
  }
  return mult
}

export function processSalvageMult(state: GameState): number {
  return processAccumMult(state, 'salvage')
}

export function processDamageMult(state: GameState): number {
  return processAccumMult(state, 'damage')
}

export function processShieldMult(state: GameState): number {
  return processAccumMult(state, 'damage')
}

export function processNetworkSpeedMult(state: GameState): number {
  void state
  return 1
}

export function processFoundrySpeedMult(state: GameState): number {
  return processAccumMult(state, 'foundrySpeed') * processAccumMult(state, 'industrySpeed')
}

export function processResearchSpeedMult(state: GameState): number {
  return processAccumMult(state, 'researchSpeed')
}

export function processIndustrySpeedMult(state: GameState): number {
  return processAccumMult(state, 'industrySpeed')
}

export function processOfflineBonusMs(state: GameState): number {
  let hours = hasProcess(state, 'deep-cache') ? 4 : 0
  const earned = processEarned(state)
  for (const row of PROCESS_ACCUMULATION) {
    if (earned < row.atEarned) continue
    if (row.effect.type === 'offlineHours') hours += row.effect.hours
  }
  return hours * 60 * 60 * 1000
}

export function processCombatSpeedMult(state: GameState): number {
  if (hasProcess(state, 'combat-overclock')) return 3
  if (hasProcess(state, 'combat-tempo')) return 1.5
  return 1
}

export function processExtraPresetSlots(state: GameState): number {
  const earned = processEarned(state)
  let extra = 0
  for (const row of PROCESS_ACCUMULATION) {
    if (earned < row.atEarned) continue
    if (row.effect.type === 'presetSlot') extra += row.effect.extra
  }
  return extra
}

export function processFurnaceOutputMult(state: GameState): number {
  return processAccumMult(state, 'furnaceOutput')
}

export interface ProcessFurnaceHooks {
  autoFeed: boolean
  presetsUnlocked: boolean
  managerUnlocked: boolean
  autoChannel: boolean
  reserveHeat: number
  preset: ProcessConfig['furnace']['preset']
  conditionalPush: boolean
  outputMult: number
}

/** Live Heat reserve, presets, and Process automation the Furnace consumes. Process UI is separate. */
export function processFurnaceHooks(state: GameState): ProcessFurnaceHooks {
  const cfg = processConfig(state)
  return {
    autoFeed: false,
    presetsUnlocked: hasProcess(state, 'furnace-presets'),
    managerUnlocked: hasProcess(state, 'furnace-auto') && cfg.furnace.manager,
    autoChannel: hasProcess(state, 'furnace-channels') && cfg.furnace.autoChannel,
    reserveHeat: hasProcess(state, 'furnace-reserve') ? cfg.furnace.reserveHeat : 0,
    preset: cfg.furnace.preset ?? null,
    conditionalPush:
      hasProcess(state, 'run-profiles') &&
      (cfg.profiles ?? []).some((profile) =>
        (profile.rules ?? []).some((rule) => rule.then?.kind === 'furnace-push'),
      ),
    outputMult: processFurnaceOutputMult(state),
  }
}

function migrateWorkerJobRatios(
  raw: Record<string, unknown>,
  fallback: Partial<Record<string, number>>,
): Partial<Record<string, number>> {
  const out: Record<string, number> = {}
  let sawJob = false
  for (const id of WORKER_JOB_IDS) {
    if (raw[id] != null) {
      sawJob = true
      out[id] = Math.max(0, num(raw[id], 0))
    }
  }
  if (sawJob) {
    for (const id of WORKER_JOB_IDS) {
      if (out[id] == null) out[id] = 0
    }
    return out
  }
  const yieldW = num(raw.yield, 0)
  const loomW = num(raw.loom, 0)
  const archiveW = num(raw.archive, 0)
  if (yieldW + loomW + archiveW > 0) {
    return {
      'scrap-field': Math.max(1, yieldW),
      'drone-fab': Math.max(1, loomW),
      'sensor-net': Math.max(1, archiveW),
      'alloy-foundry': 1,
      'fab-bay': 1,
    }
  }
  return { ...fallback }
}

export function networkAllocationWeights(state: GameState): Record<string, number> {
  const cfg = processConfig(state)
  const preset = cfg.network.preset
  const source =
    preset === 'custom'
      ? cfg.network.ratios
      : NETWORK_PRESETS[preset] ?? NETWORK_PRESETS.balanced
  const weights: Record<string, number> = {}
  for (const id of WORKER_JOB_IDS) {
    weights[id] = Math.max(0, source[id] ?? 0)
  }
  if (hasProcess(state, 'network-tune') && !state.combat.docked) {
    if (preset === 'defence') {
      weights['alloy-foundry'] *= 1.2
      weights['fab-bay'] *= 1.15
    } else if (preset === 'farm') {
      weights['scrap-field'] *= 1.35
    } else if (preset === 'industry') {
      weights['drone-fab'] *= 1.35
      weights['fab-bay'] *= 1.2
      weights.construction *= 1.15
    } else if (preset === 'research') {
      weights['sensor-net'] *= 1.35
    } else {
      weights['scrap-field'] *= 1.35
      weights['drone-fab'] *= 1.2
    }
  }
  return weights
}

export function corePresetCap(state: GameState): number {
  return 1 + (hasProcess(state, 'core-presets') ? 2 : 0) + processExtraPresetSlots(state)
}

export function yardLayoutCap(state: GameState): number {
  return (hasProcess(state, 'yard-layouts') ? 2 : 0) + processExtraPresetSlots(state)
}
