/** Process 3.0 — account-wide QoL, automation, rules, and profiles. */

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
  ProcessWhenKind,
  TabId,
} from './types'
import { createDefaultProcessProfiles, withDefaultProfiles } from './processProfiles'
import { NETWORK_BAR_IDS } from './types'
import { careerBestWave, isSystemUnlocked } from './progression'
import { isWorkerJob, WORKER_JOB_IDS } from './workers'
import { practicedCoreWork } from './corePractice'
import { getHiveResearchNode, researchProcessCostMult, resolvedResearchIds } from './hiveResearchTree'
import { processPointsEarned } from './processPoints'

export type ProcessKind = 'automation' | 'qol'

export type ProcessLane = 'qol' | 'sortie' | 'workers' | 'foundry' | 'research' | 'furnace' | 'logic'

export type ProcessCategory =
  | ProcessLane
  | 'cores'
  | 'network'
  | 'reliquary'
  | 'yard'

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
  requiresIds?: string[]
  requiresBestWave?: number
  requiresSystem?: TabId
  requiresMastery?: ProcessMastery
}

export const PROCESS_CATEGORIES: { id: ProcessCategory; name: string }[] = [
  { id: 'qol', name: 'Quality of life' },
  { id: 'sortie', name: 'Sortie' },
  { id: 'workers', name: 'Workers' },
  { id: 'foundry', name: 'Foundry' },
  { id: 'research', name: 'Research' },
  { id: 'furnace', name: 'Furnace' },
  { id: 'logic', name: 'Logic' },
]

export const PROCESS_LANES: { id: ProcessLane; name: string }[] = [
  { id: 'qol', name: 'QoL' },
  { id: 'sortie', name: 'Sortie' },
  { id: 'workers', name: 'Workers' },
  { id: 'foundry', name: 'Foundry' },
  { id: 'research', name: 'Research' },
  { id: 'furnace', name: 'Furnace' },
  { id: 'logic', name: 'Logic' },
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
/** Canonical 151 PP Act 1 capability tree. Process adds no direct combat power. */
export const PROCESS_NODES: ProcessNodeDef[] = [
  { id: 'bulk-purchase', name: 'Bulk Purchase', category: 'qol', kind: 'qol', blurb: 'Adds explicit bulk purchase controls.', cost: 2 },
  { id: 'buy-max', name: 'Buy Max', category: 'qol', kind: 'qol', blurb: 'Adds MAX to eligible temporary purchases.', cost: 2, requiresId: 'bulk-purchase' },
  { id: 'live-readouts', name: 'Live Readouts', category: 'qol', kind: 'qol', blurb: 'Shows time-to-afford and useful live diagnostics.', cost: 2 },
  { id: 'worker-presets', name: 'Worker Presets', category: 'workers', kind: 'qol', blurb: 'Save explicit Worker assignment presets.', cost: 3 },
  { id: 'processing-repeat', name: 'Processing Repeat', category: 'foundry', kind: 'qol', blurb: 'Repeat one Processing recipe the player selected.', cost: 3, requiresSystem: 'foundry' },

  { id: 'sortie-auto-buy', name: 'Sortie Auto-Buy', category: 'sortie', kind: 'automation', blurb: 'Spends Salvage only on already-unlocked temporary upgrades.', cost: 6, requiresId: 'bulk-purchase' },
  { id: 'spend-profiles', name: 'Spend Profiles', category: 'sortie', kind: 'automation', blurb: 'Attack, Defense, and Economy weights plus a Salvage reserve.', cost: 4, requiresId: 'sortie-auto-buy' },
  { id: 'worker-auto-fill', name: 'Worker Auto-Fill', category: 'workers', kind: 'automation', blurb: 'Assigns idle Workers from the selected preset.', cost: 5, requiresId: 'worker-presets' },
  { id: 'material-stock-targets', name: 'Material Stock Targets', category: 'foundry', kind: 'automation', blurb: 'Maintains explicit material floors through Processing.', cost: 5, requiresId: 'processing-repeat', requiresSystem: 'foundry' },
  { id: 'research-queue-assist', name: 'Research Queue Assist', category: 'research', kind: 'automation', blurb: 'Runs only projects explicitly placed in the Research queue.', cost: 4, requiresSystem: 'research' },
  { id: 'furnace-presets', name: 'Furnace Presets', category: 'furnace', kind: 'automation', blurb: 'Saves a Furnace configuration without Igniting it.', cost: 3, requiresSystem: 'furnace' },

  { id: 'upgrade-priorities', name: 'Upgrade Priorities', category: 'sortie', kind: 'automation', blurb: 'Orders eligible temporary upgrade spending.', cost: 5, requiresId: 'spend-profiles' },
  { id: 'worker-weights', name: 'Worker Weights', category: 'workers', kind: 'automation', blurb: 'Customises Worker preset job weights.', cost: 4, requiresId: 'worker-presets' },
  { id: 'dependency-processing', name: 'Dependency Processing', category: 'foundry', kind: 'automation', blurb: 'Processes prerequisites toward an explicit stock target.', cost: 6, requiresId: 'material-stock-targets', requiresSystem: 'foundry' },
  { id: 'research-preference', name: 'Research Preference', category: 'research', kind: 'automation', blurb: 'Continues a selected visible discipline after the explicit queue empties.', cost: 6, requiresId: 'research-queue-assist', requiresSystem: 'research' },
  { id: 'ash-budgeting', name: 'Ash Budgeting', category: 'furnace', kind: 'automation', blurb: 'Caps Ash committed to a saved Furnace preset.', cost: 4, requiresId: 'furnace-presets', requiresSystem: 'furnace' },

  { id: 'rule-builder', name: 'Rule Builder', category: 'logic', kind: 'automation', blurb: 'Builds mobile chip rules from bounded conditions and actions.', cost: 8 },
  { id: 'logic-and', name: 'AND', category: 'logic', kind: 'automation', blurb: 'Requires all conditions on a rule.', cost: 4, requiresId: 'rule-builder' },
  { id: 'logic-or', name: 'OR', category: 'logic', kind: 'automation', blurb: 'Allows any condition on a rule to fire.', cost: 4, requiresId: 'rule-builder' },
  { id: 'extra-rule-slots', name: 'Extra Rule Slots', category: 'logic', kind: 'automation', blurb: 'Expands the bounded rule list.', cost: 5, requiresId: 'rule-builder' },
  { id: 'condition-complexity', name: 'Condition Complexity', category: 'logic', kind: 'automation', blurb: 'Allows additional chips on a rule.', cost: 6, requiresId: 'rule-builder' },
  { id: 'process-profiles', name: 'Process Profiles', category: 'logic', kind: 'automation', blurb: 'Saves automation state as PUSH, FARM, BLUEPRINT, CHALLENGE, or CUSTOM.', cost: 6, requiresId: 'rule-builder' },

  { id: 'furnace-auto-ignite', name: 'Furnace Auto-Ignite', category: 'furnace', kind: 'automation', blurb: 'Ignites a saved preset once when its explicit trigger and Ash budget allow.', cost: 10, requiresIds: ['furnace-presets', 'ash-budgeting', 'rule-builder'], requiresSystem: 'furnace' },
  { id: 'directive-preference', name: 'Directive Preference', category: 'sortie', kind: 'automation', blurb: 'Chooses the highest offered item from an ordered preference; never rerolls.', cost: 8, requiresBestWave: 125 },
  { id: 'auto-extract', name: 'Auto Extract', category: 'sortie', kind: 'automation', blurb: 'Extracts only under an explicit late rule.', cost: 8, requiresId: 'rule-builder', requiresBestWave: 210 },
  { id: 'profile-triggers', name: 'Profile Triggers', category: 'logic', kind: 'automation', blurb: 'Switches automation profiles from bounded rule triggers.', cost: 10, requiresId: 'process-profiles' },
  { id: 'repeat-sortie', name: 'Repeat Sortie', category: 'sortie', kind: 'automation', blurb: 'Foreground-only repeat launch, disabled by default.', cost: 10, requiresId: 'process-profiles' },
  { id: 'challenge-profile', name: 'Challenge Profile', category: 'sortie', kind: 'automation', blurb: 'Applies a saved restricted-run profile while respecting every Challenge rule.', cost: 8, requiresId: 'process-profiles', requiresSystem: 'protocols' },
]

export const PROCESS_HIDDEN_IDS = new Set<string>()

export type ProcessRevealTier = 'qol' | 'actions' | 'priorities' | 'later'

export const PROCESS_REVEAL_TIERS: { id: ProcessRevealTier; name: string }[] = [
  { id: 'qol', name: 'Quality of life' },
  { id: 'actions', name: 'Simple actions' },
  { id: 'priorities', name: 'Priorities' },
  { id: 'later', name: 'Deeper automation' },
]

const PROCESS_NODE_TIER: Record<string, ProcessRevealTier> = {
  'bulk-purchase': 'qol',
  'live-readouts': 'qol',
  'buy-max': 'qol',
  'worker-presets': 'qol',
  'processing-repeat': 'qol',
  'sortie-auto-buy': 'actions',
  'research-queue-assist': 'actions',
  'auto-extract': 'actions',
  'repeat-sortie': 'actions',
  'worker-auto-fill': 'actions',
  'challenge-profile': 'actions',
  'spend-profiles': 'priorities',
  'dependency-processing': 'priorities',
  'research-preference': 'priorities',
  'worker-weights': 'priorities',
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

export function processNodeLane(node: ProcessNodeDef): ProcessLane | null {
  if (PROCESS_HIDDEN_IDS.has(node.id)) return null
  if (node.category === 'qol' || node.category === 'sortie' || node.category === 'workers' || node.category === 'foundry' || node.category === 'research' || node.category === 'furnace' || node.category === 'logic') {
    return node.category
  }
  if (node.category === 'network') return 'workers'
  return null
}

export function processVisibleNodes(state: GameState): ProcessNodeDef[] {
  void state
  return PROCESS_NODES.filter((node) => processNodeLane(node) != null)
}

export function processLaneNodes(state: GameState, lane: ProcessLane): ProcessNodeDef[] {
  return processVisibleNodes(state).filter((node) => processNodeLane(node) === lane)
}

/** Manual loops the player has already practised — GDD §139. */
export function processLessonCount(state: GameState): number {
  const cores = practicedCoreWork(state)
  const workshop = Object.values(state.workshop?.levels ?? {}).reduce((sum, n) => sum + Math.max(0, n), 0)
  const recipes = Object.values(state.foundry?.masteryXp ?? {}).reduce((sum, n) => sum + Math.max(0, Number(n) || 0), 0)
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
/** PP unlock automation capability only; it never grants passive combat/economy power. */
export const PROCESS_ACCUMULATION: ProcessAccumulationDef[] = []

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
      minStock: {},
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
      priority: ['overdrive', 'bulwark', 'guidance', 'harvest'],
    },
    research: {
      autoResearch: false,
      queue: [],
      branchPriority: ['material', 'energy', 'observation'],
    },
    sortie: {
      autoExtract: false,
      extractHullPct: 0.35,
      autoRelaunch: false,
      protocolRepeat: false,
      echoRepeat: false,
      lastProtocolId: null,
      lastEchoId: null,
      protocolId: null,
      directivePreference: [],
    },
    shop: {
      autoBuy: false,
      ratios: { attack: 50, defense: 30, economy: 20 },
      salvageReserve: 0,
    },
    activeProfileId: null,
    profiles: createDefaultProcessProfiles(),
    lastActions: {},
  }
}

export function createEmptyProcessState(): ProcessState {
  return { purchased: [], earned: 0, config: createEmptyProcessConfig() }
}

export function processAvailable(state: GameState): number {
  const spent = (state.process?.purchased ?? []).reduce((sum, id) => sum + (getProcessNode(id)?.cost ?? 0), 0)
  return Math.max(0, processEarned(state) - spent)
}

export function syncProcessPointLedger(state: GameState): void {
  if (!state.process) state.process = createEmptyProcessState()
  state.process.earned = processPointsEarned(state)
  state.resources.aiPoints = processAvailable(state)
}

export function processEarned(state: GameState): number {
  return Math.max(0, state.process?.earned ?? 0, processPointsEarned(state))
}

export function processConfig(state: GameState): ProcessConfig {
  return state.process?.config ?? createEmptyProcessConfig()
}

export function getProcessNode(id: string): ProcessNodeDef | undefined {
  return PROCESS_NODES.find((n) => n.id === id)
}

export function hasProcess(state: GameState, id: string): boolean {
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
      return Object.values(state.foundry?.masteryXp ?? {}).some((n) => (Number(n) || 0) > 0)
    case 'reliquary':
      // PR9 owns Relic automation. Physical Relic ownership does not satisfy
      // leftover Process Reliquary mastery from the shard system.
      return false
    case 'research':
      return (state.hiveResearch?.completedIds?.length ?? 0) > 0
        || Object.values(state.hiveResearch?.completed ?? {}).some((n) => n > 0)
    case 'furnace':
      return (
        (state.furnace.ignited && Object.values(state.furnace.channels).some((n) => n > 0)) ||
        (state.resources.choirAsh ?? 0) > 0 ||
        (state.resources.heat ?? 0) > 0
      )
    case 'yard':
      return false
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
      return 'Relic automation is owned by PR9'
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
  const missing = (def.requiresIds ?? []).find((required) => !hasProcess(state, required))
  if (missing) return { ok: false, reason: `Need ${getProcessNode(missing)?.name ?? missing}` }
  if (!isSystemUnlocked(state, 'process')) return { ok: false, reason: 'Complete Process Kernel' }
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
  if (processAvailable(state) < cost) {
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
  void amount
  if (!state.process) state.process = createEmptyProcessState()
  state.process.earned = processPointsEarned(state)
  state.resources.aiPoints = processAvailable(state)
}

export function reconstructProcessEarned(state: GameState): number {
  return processPointsEarned(state)
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
      minStock: hydrateMinStock(foundry.minStock),
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
      autoResearch: research.autoResearch === true,
      queue: Array.isArray(research.queue)
        ? research.queue.filter((id): id is string => typeof id === 'string' && Boolean(getHiveResearchNode(id)))
        : [],
      branchPriority: Array.isArray(research.branchPriority)
        ? research.branchPriority.filter((id): id is HiveResearchBranch =>
            id === 'material' || id === 'energy' || id === 'observation' || id === 'computation',
          )
        : [...empty.research.branchPriority],
    },
    sortie: {
      autoExtract: sortie.autoExtract === true,
      extractHullPct: Math.min(0.9, Math.max(0.05, num(sortie.extractHullPct, 0.35))),
      autoRelaunch: sortie.autoRelaunch === true,
      protocolRepeat: sortie.protocolRepeat === true,
      echoRepeat: sortie.echoRepeat === true,
      lastProtocolId: typeof sortie.lastProtocolId === 'string' ? sortie.lastProtocolId : null,
      lastEchoId: typeof sortie.lastEchoId === 'string' ? sortie.lastEchoId : null,
      protocolId: typeof sortie.protocolId === 'string' ? sortie.protocolId : null,
      directivePreference: Array.isArray(sortie.directivePreference)
        ? sortie.directivePreference.filter((id): id is string => typeof id === 'string')
        : [],
    },
    shop: {
      autoBuy: shop.autoBuy === true,
      ratios: {
        attack: Math.max(0, num(shopRatios.attack, empty.shop.ratios.attack)),
        defense: Math.max(0, num(shopRatios.defense, empty.shop.ratios.defense)),
        economy: Math.max(0, num(shopRatios.economy, empty.shop.ratios.economy)),
      },
      salvageReserve: Math.max(0, num(shop.salvageReserve, 0)),
    },
    activeProfileId: typeof raw.activeProfileId === 'string' ? raw.activeProfileId : null,
    profiles: withDefaultProfiles(hydrateProfiles(raw.profiles)),
    lastActions: hydrateLastActions(raw.lastActions),
  }
}

function hydrateMinStock(raw: unknown): Partial<Record<FoundryRecipeId, number>> {
  if (!isRecord(raw)) return {}
  const out: Partial<Record<FoundryRecipeId, number>> = {}
  for (const [id, value] of Object.entries(raw)) {
    const n = Math.max(0, Math.floor(num(value, 0)))
    if (n > 0) out[id as FoundryRecipeId] = n
  }
  return out
}

function hydrateLastActions(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {}
  const out: Record<string, string> = {}
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value) out[id] = value
  }
  return out
}

const FURNACE_PRESET_IDS = new Set(['push', 'farm', 'industry', 'research'])

const WHEN_KINDS: ProcessWhenKind[] = [
  'wave-gte',
  'wave-of-best',
  'hull-lte',
  'shield-lte',
  'boss-active',
  'enemies-gte',
  'wave-time-gte',
  'salvage-gte',
  'scrap-run-gte',
  'ash-gte',
  'heat-gte',
  'processor-idle',
  'fabricator-idle',
  'stock-lte',
  'stock-gte',
  'research-idle',
  'workers-idle-gte',
  'challenge-active',
  'profile-is',
  'threat',
  'queue-empty',
]

const THEN_KINDS: ProcessThenKind[] = [
  'spend-profile',
  'spend-ratios',
  'economy-target',
  'extract',
  'furnace-preset',
  'furnace-push',
  'worker-preset',
  'foundry-target',
  'foundry-stock',
  'research-next',
  'launch-sortie',
  'repeat-recipe',
  'fab-tracked',
  'switch-profile',
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
  let kind = raw.kind as ProcessWhenKind
  if (!WHEN_KINDS.includes(kind)) return null
  if (kind === 'threat') kind = 'hull-lte'
  if (kind === 'queue-empty') kind = 'processor-idle'
  return {
    kind,
    value: raw.value == null ? (kind === 'hull-lte' ? 35 : undefined) : num(raw.value, 0),
    recipeId: typeof raw.recipeId === 'string' ? (raw.recipeId as FoundryRecipeId) : undefined,
    profileId: typeof raw.profileId === 'string' ? raw.profileId : undefined,
  }
}

function hydrateAction(raw: unknown): ProcessAction {
  if (!isRecord(raw) || typeof raw.kind !== 'string' || !THEN_KINDS.includes(raw.kind as ProcessThenKind)) {
    return { kind: 'spend-profile' }
  }
  const workerPreset = raw.workerPreset
  const furnacePreset = raw.furnacePreset
  return {
    kind: raw.kind as ProcessThenKind,
    spend: raw.spend ? hydrateSpend(raw.spend, { attack: 50, defense: 30, economy: 20 }) : undefined,
    economyPct: raw.economyPct == null ? undefined : num(raw.economyPct, 0),
    recipeId: typeof raw.recipeId === 'string' ? (raw.recipeId as FoundryRecipeId) : undefined,
    stockMin: raw.stockMin == null ? undefined : Math.max(0, num(raw.stockMin, 0)),
    workerPreset:
      typeof workerPreset === 'string' && NETWORK_PRESET_LABELS[workerPreset as ProcessNetworkPreset]
        ? (workerPreset as ProcessNetworkPreset)
        : undefined,
    furnacePreset:
      typeof furnacePreset === 'string' && FURNACE_PRESET_IDS.has(furnacePreset)
        ? (furnacePreset as ProcessAction['furnacePreset'])
        : undefined,
    furnaceLevel: raw.furnaceLevel == null ? undefined : Math.max(0, num(raw.furnaceLevel, 0)),
    profileId: typeof raw.profileId === 'string' ? raw.profileId : undefined,
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
    label: typeof raw.label === 'string' ? raw.label : undefined,
    enabled: raw.enabled !== false,
    join: raw.join === 'or' ? 'or' : 'and',
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
    furnacePreset:
      typeof row.furnacePreset === 'string' && FURNACE_PRESET_IDS.has(row.furnacePreset)
        ? (row.furnacePreset as ProcessProfile['furnacePreset'])
        : row.furnacePreset === null
          ? null
          : undefined,
    foundryRepeat: typeof row.foundryRepeat === 'string' ? (row.foundryRepeat as FoundryRecipeId) : null,
    researchAutoNext: row.researchAutoNext === true,
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
        .filter((id): id is string => typeof id === 'string' && Boolean(getProcessNode(id)))
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
  void state
  return 0
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
    managerUnlocked: false,
    autoChannel: false,
    reserveHeat: hasProcess(state, 'ash-budgeting') ? cfg.furnace.reserveHeat : 0,
    preset: cfg.furnace.preset ?? null,
    conditionalPush:
      hasProcess(state, 'process-profiles') &&
      (cfg.profiles ?? []).some((profile) =>
        (profile.rules ?? []).some((rule) => rule.then?.kind === 'furnace-push' || rule.then?.kind === 'furnace-preset'),
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
  return weights
}

export function corePresetCap(state: GameState): number {
  void state
  return 1
}

export function processRuleCapacity(state: GameState): number {
  if (!hasProcess(state, 'rule-builder') && !hasProcess(state, 'process-profiles')) return 0
  if (hasProcess(state, 'extra-rule-slots')) return 4
  if (hasProcess(state, 'process-profiles')) return 2
  return 1
}

export function processMaxConditions(state: GameState): number {
  if (!hasProcess(state, 'rule-builder')) return 0
  if (hasProcess(state, 'condition-complexity')) return 4
  if (hasProcess(state, 'logic-and') || hasProcess(state, 'logic-or')) return 2
  return 1
}

export function processAllowsAnd(state: GameState): boolean {
  return hasProcess(state, 'logic-and') || hasProcess(state, 'condition-complexity')
}

export function processAllowsOr(state: GameState): boolean {
  return hasProcess(state, 'logic-or')
}

export function noteProcessLastAction(state: GameState, id: string, note: string): void {
  if (!state.process) state.process = createEmptyProcessState()
  if (!state.process.config.lastActions) state.process.config.lastActions = {}
  state.process.config.lastActions[id] = note
}

export function processRulesUsed(state: GameState): number {
  const id = processConfig(state).activeProfileId
  const profile = (processConfig(state).profiles ?? []).find((row) => row.id === id)
    ?? (processConfig(state).profiles ?? []).find((row) => row.id === 'custom')
  return (profile?.rules ?? []).filter((rule) => rule.enabled).length
}

export interface ProcessAutomationCard {
  id: string
  name: string
  enabled: boolean
  summary: string
  lastAction: string
}

function lastNote(state: GameState, id: string): string {
  return processConfig(state).lastActions?.[id] || 'No action yet'
}

function spendSummary(state: GameState): string {
  const mix = processConfig(state).shop.ratios
  const reserve = processConfig(state).shop.salvageReserve
  const reserveText = reserve > 0 ? ` · Reserve ${reserve >= 1000 ? `${Math.round(reserve / 100) / 10}K` : String(reserve)}` : ''
  return `${mix.attack} / ${mix.defense} / ${mix.economy}${reserveText}`
}

export function processAutomationCards(state: GameState): ProcessAutomationCard[] {
  const cfg = processConfig(state)
  const cards: ProcessAutomationCard[] = []
  if (hasProcess(state, 'sortie-auto-buy')) {
    cards.push({
      id: 'sortie-auto-buy',
      name: 'Sortie Auto-Buy',
      enabled: cfg.shop.autoBuy,
      summary: spendSummary(state),
      lastAction: lastNote(state, 'sortie-auto-buy'),
    })
  }
  if (hasProcess(state, 'auto-extract')) {
    cards.push({
      id: 'auto-extract',
      name: 'Auto Extract',
      enabled: cfg.sortie.autoExtract,
      summary: `Hull ≤ ${Math.round(cfg.sortie.extractHullPct * 100)}%`,
      lastAction: lastNote(state, 'auto-extract'),
    })
  }
  if (hasProcess(state, 'repeat-sortie')) {
    cards.push({
      id: 'repeat-sortie',
      name: 'Auto Launch',
      enabled: cfg.sortie.autoRelaunch,
      summary: 'Launch when hull is full',
      lastAction: lastNote(state, 'repeat-sortie'),
    })
  }
  if (hasProcess(state, 'worker-auto-fill')) {
    cards.push({
      id: 'worker-auto-fill',
      name: 'Worker Auto Fill',
      enabled: cfg.network.enabled,
      summary: NETWORK_PRESET_LABELS[cfg.network.preset],
      lastAction: lastNote(state, 'worker-auto-fill'),
    })
  }
  if (hasProcess(state, 'processing-repeat')) {
    cards.push({
      id: 'processing-repeat',
      name: 'Foundry Target',
      enabled: Boolean(cfg.foundry.repeatRecipe),
      summary: cfg.foundry.repeatRecipe ? `Repeat ${cfg.foundry.repeatRecipe}` : 'No recipe pinned',
      lastAction: lastNote(state, 'processing-repeat'),
    })
  }
  if (hasProcess(state, 'material-stock-targets')) {
    const entries = Object.entries(cfg.foundry.minStock ?? {})
    const first = entries[0]
    cards.push({
      id: 'material-stock-targets',
      name: 'Foundry Stock',
      enabled: entries.length > 0,
      summary: first ? `Keep ${first[0]} ≥${first[1]}` : 'No stock floor',
      lastAction: lastNote(state, 'material-stock-targets'),
    })
  }
  if (hasProcess(state, 'dependency-processing')) {
    cards.push({
      id: 'dependency-processing',
      name: 'Foundry Queue',
      enabled: cfg.foundry.queue.length > 0,
      summary: `${cfg.foundry.queue.length} recipes queued`,
      lastAction: lastNote(state, 'dependency-processing'),
    })
  }
  if (hasProcess(state, 'research-queue-assist')) {
    cards.push({
      id: 'research-queue-assist',
      name: 'Research Queue',
      enabled: cfg.research.queue.length > 0,
      summary: `${cfg.research.queue.length} projects queued`,
      lastAction: lastNote(state, 'research-queue-assist'),
    })
  }
  if (hasProcess(state, 'research-preference')) {
    cards.push({
      id: 'research-preference',
      name: 'Research Auto-Next',
      enabled: cfg.research.autoResearch,
      summary: cfg.research.autoResearch ? 'Start the next queued project' : 'Off',
      lastAction: lastNote(state, 'research-preference'),
    })
  }
  if (hasProcess(state, 'furnace-presets')) {
    cards.push({
      id: 'furnace-presets',
      name: 'Furnace Preset',
      enabled: Boolean(cfg.furnace.preset),
      summary: cfg.furnace.preset ? String(cfg.furnace.preset) : 'No preset',
      lastAction: lastNote(state, 'furnace-presets'),
    })
  }
  if (hasProcess(state, 'furnace-auto-ignite')) {
    cards.push({
      id: 'furnace-auto-ignite',
      name: 'Furnace Auto-Ignite',
      enabled: cfg.furnace.autoChannel,
      summary: hasProcess(state, 'ash-budgeting') ? `Maximum ${cfg.furnace.reserveHeat} Ash` : 'Needs an Ash budget',
      lastAction: lastNote(state, 'furnace-auto-ignite'),
    })
  }
  if (hasProcess(state, 'challenge-profile')) {
    cards.push({
      id: 'challenge-profile',
      name: 'Challenge Profile',
      enabled: Boolean(state.prestige.activeChallengeId),
      summary: state.prestige.activeChallengeId ? 'CHALLENGE profile loaded' : 'Waiting for an active Challenge',
      lastAction: lastNote(state, 'challenge-profile'),
    })
  }
  return cards
}

export function processActiveAutomationCount(state: GameState): number {
  return processAutomationCards(state).filter((card) => card.enabled).length
}
