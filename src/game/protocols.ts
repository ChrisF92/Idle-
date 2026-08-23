/** Challenges — restricted Sorties that test a modified version of the normal rules. */

import type { GameState, ProtocolMute, ProtocolState } from './types'
import { isSystemUnlocked } from './progression'
import { closeSortie } from './sortieSummary'
import { noteAttempt } from './playtest'
import { ACT1_CADENCE } from './cadence'
import { bandsClearedForWave } from './waves'
import { isWorkerJob } from './workers'
import { getFrame, grantUnlockedFrame } from './catalog'

export const PROTOCOL_UNLOCK_SECTOR = ACT1_CADENCE.protocols
export const CHALLENGE_UNLOCK_WAVE = ACT1_CADENCE.protocols
export const PROTOCOL_MAX_RANK = 8
export const CHALLENGE_GOAL_STEP = 20

export type ProtocolHookKind =
  | 'networkExponent'
  | 'networkFillGrowth'
  | 'networkRelay'
  | 'networkDroneEff'
  | 'networkWardExponent'
  | 'furnaceDrain'
  | 'furnaceEfficiency'
  | 'foundryXpNeed'
  | 'foundryCostGrowth'
  | 'researchCost'
  | 'coreCostScaling'
  | 'shieldCostScaling'
  | 'rebuildMatter'
  | 'reliquaryResonanceExp'
  | 'salvageSectorExp'
  | 'yieldScrapExp'

export interface ProtocolHook {
  kind: ProtocolHookKind
  /** Added to a running total (exponents, efficiency). */
  add?: number
  /** Multiplied into a running product (growth / drain / costs). */
  mult?: number
}

export interface ProtocolRewardStep {
  at: number
  hook: ProtocolHook
  blurb: string
}

export type ProtocolGrantKind = 'process' | 'relic' | 'recipe'

/** First-clear grant that expands the tested system (GDD §98). */
export interface ProtocolGrant {
  kind: ProtocolGrantKind
  id: string
  blurb: string
}

export interface ProtocolDef {
  id: string
  name: string
  blurb: string
  restriction: string
  disabledSystems: string[]
  mute: ProtocolMute
  /** First-clear goal Wave. Later clears add CHALLENGE_GOAL_STEP. */
  goalWave: number
  hullMult?: number
  enemyDensityMult?: number
  rewards: ProtocolRewardStep[]
  /** First completion unlocks this Hive Frame. */
  unlocksFrame?: string
  /** First completion expands Relic / Process / Foundry — not global damage. */
  firstGrant?: ProtocolGrant
}

export const PROTOCOLS: ProtocolDef[] = [
  {
    id: 'glass-ward',
    name: 'Glass Hive',
    blurb: 'Reduced Hull. Completions ease Plate Salvage growth and Ward pay.',
    restriction: 'Hull is halved. Plate, Ward, and other shield bonuses grant nothing.',
    disabledSystems: ['Hull integrity', 'Shields', 'Ward'],
    mute: 'shields',
    goalWave: 80,
    hullMult: 0.5,
    firstGrant: { kind: 'relic', id: 'plate-chip', blurb: 'First clear seats a Plate Chip Relic.' },
    rewards: [
      { at: 1, hook: { kind: 'networkWardExponent', add: 0.02 }, blurb: 'Ward levels scale harder at every rank.' },
      { at: 2, hook: { kind: 'shieldCostScaling', add: -0.01 }, blurb: 'Plate Salvage costs grow a little slower.' },
      { at: 3, hook: { kind: 'networkWardExponent', add: 0.015 }, blurb: 'Ward scaling again.' },
      { at: 4, hook: { kind: 'rebuildMatter', mult: 1.04 }, blurb: 'Rebuilds pay a little more Matter.' },
      { at: 5, hook: { kind: 'shieldCostScaling', add: -0.012 }, blurb: 'Milestone: Plate stays cheaper longer.' },
      { at: 6, hook: { kind: 'networkWardExponent', add: 0.015 }, blurb: 'Ward scaling again.' },
      { at: 7, hook: { kind: 'rebuildMatter', mult: 1.04 }, blurb: 'Rebuild Matter again.' },
      { at: 8, hook: { kind: 'shieldCostScaling', add: -0.012 }, blurb: 'Capstone: high Plate ranks stay in reach.' },
    ],
  },
  {
    id: 'quiet-guns',
    name: 'Mono Core',
    blurb: 'Weapon Cores sit silent. Completions ease Salvage cost growth on weapon Cores.',
    restriction: 'Fitted weapon Cores deal no damage. The Frame Battery still fires.',
    disabledSystems: ['Weapon Cores'],
    mute: 'weapons',
    goalWave: 100,
    firstGrant: { kind: 'process', id: 'shop-readout', blurb: 'First clear unlocks Shop Readout in Process.' },
    rewards: [
      { at: 1, hook: { kind: 'coreCostScaling', add: -0.01 }, blurb: 'Weapon Core Salvage costs grow a little slower.' },
      { at: 2, hook: { kind: 'coreCostScaling', add: -0.008 }, blurb: 'Weapon cost growth eases again.' },
      { at: 3, hook: { kind: 'coreCostScaling', add: -0.008 }, blurb: 'Weapon cost growth again.' },
      { at: 4, hook: { kind: 'researchCost', mult: 0.96 }, blurb: 'Research projects need a little less time.' },
      { at: 5, hook: { kind: 'coreCostScaling', add: -0.012 }, blurb: 'Milestone: Pulse and kin stay cheaper longer.' },
      { at: 6, hook: { kind: 'coreCostScaling', add: -0.008 }, blurb: 'Weapon cost growth again.' },
      { at: 7, hook: { kind: 'coreCostScaling', add: -0.008 }, blurb: 'Weapon Salvage curve still bends.' },
      { at: 8, hook: { kind: 'coreCostScaling', add: -0.012 }, blurb: 'Capstone: high Core ranks stay in reach.' },
    ],
  },
  {
    id: 'mute-network',
    name: 'Swarm Pressure',
    blurb: 'Greatly increased enemy density. First clear unlocks the Harvester Frame. Completions improve Worker labour scaling.',
    restriction: 'Encounters spawn far more hulls. Leftover Strike/Ward combat bars grant nothing.',
    disabledSystems: ['Strike / Ward combat bars'],
    mute: 'network',
    goalWave: 100,
    enemyDensityMult: 2.2,
    unlocksFrame: 'harvester-frame',
    rewards: [
      { at: 1, hook: { kind: 'networkExponent', add: 0.02 }, blurb: 'Worker bonuses scale harder at every rank.' },
      { at: 2, hook: { kind: 'networkExponent', add: 0.015 }, blurb: 'A little more Worker scaling.' },
      { at: 3, hook: { kind: 'networkFillGrowth', mult: 0.94 }, blurb: 'Later Worker fills grow slower.' },
      { at: 4, hook: { kind: 'networkExponent', add: 0.015 }, blurb: 'Worker scaling again.' },
      { at: 5, hook: { kind: 'networkRelay', add: 0.08 }, blurb: 'Assigned drones pull harder on the jobs behind them.' },
      { at: 6, hook: { kind: 'networkFillGrowth', mult: 0.94 }, blurb: 'Fill growth eases again.' },
      { at: 7, hook: { kind: 'networkDroneEff', add: 0.05 }, blurb: 'Each assigned drone counts for more.' },
      { at: 8, hook: { kind: 'networkFillGrowth', mult: 0.92 }, blurb: 'Capstone: Worker fills stay relevant late.' },
    ],
  },
  {
    id: 'dead-furnace',
    name: 'Cold Furnace',
    blurb: 'Furnace unavailable. Completions make Heat cheaper to spend and channels pay more.',
    restriction: 'Furnace channels and Heat combat bonuses grant nothing.',
    disabledSystems: ['Furnace', 'Heat spend'],
    mute: 'furnace',
    goalWave: 150,
    firstGrant: { kind: 'recipe', id: 'choir-flux', blurb: 'First clear unlocks the Choir Flux recipe.' },
    rewards: [
      { at: 1, hook: { kind: 'furnaceDrain', mult: 0.88 }, blurb: 'Lighting a channel spends less Heat.' },
      { at: 2, hook: { kind: 'furnaceDrain', mult: 0.88 }, blurb: 'Heat costs ease again.' },
      { at: 3, hook: { kind: 'furnaceEfficiency', add: 0.08 }, blurb: 'Each channel level pays more of its bonus.' },
      { at: 4, hook: { kind: 'furnaceDrain', mult: 0.88 }, blurb: 'Heat costs again.' },
      { at: 5, hook: { kind: 'furnaceEfficiency', add: 0.1 }, blurb: 'Milestone: channels convert Heat more cleanly.' },
      { at: 6, hook: { kind: 'furnaceDrain', mult: 0.86 }, blurb: 'Heat costs ease further.' },
      { at: 7, hook: { kind: 'furnaceEfficiency', add: 0.08 }, blurb: 'Channel pay again.' },
      { at: 8, hook: { kind: 'furnaceDrain', mult: 0.84 }, blurb: 'Capstone: a push costs less Heat to light.' },
    ],
  },
  {
    id: 'dry-hold',
    name: 'Limited Economy',
    blurb: 'Salvage is cut. Completions improve salvage growth and scrap trickle.',
    restriction: 'Kills grant no Salvage. Scrap, Foundry, and Yield still run.',
    disabledSystems: ['Salvage from wrecks'],
    mute: 'salvage',
    goalWave: 120,
    firstGrant: { kind: 'recipe', id: 'filament', blurb: 'First clear unlocks the Filament recipe.' },
    rewards: [
      { at: 1, hook: { kind: 'salvageSectorExp', add: 0.03 }, blurb: 'Salvage from wrecks grows a little faster with Wave.' },
      { at: 2, hook: { kind: 'yieldScrapExp', add: 0.04 }, blurb: 'Yield scrap trickle scales harder.' },
      { at: 3, hook: { kind: 'salvageSectorExp', add: 0.02 }, blurb: 'Salvage Wave growth again.' },
      { at: 4, hook: { kind: 'foundryXpNeed', mult: 0.96 }, blurb: 'Recipes need fewer crafts to level.' },
      { at: 5, hook: { kind: 'yieldScrapExp', add: 0.05 }, blurb: 'Milestone: Yield scrap curve bends harder.' },
      { at: 6, hook: { kind: 'salvageSectorExp', add: 0.02 }, blurb: 'Salvage Wave growth again.' },
      { at: 7, hook: { kind: 'rebuildMatter', mult: 1.03 }, blurb: 'Rebuilds pay a little more Matter.' },
      { at: 8, hook: { kind: 'salvageSectorExp', add: 0.03 }, blurb: 'Capstone: late Waves drop more Salvage.' },
    ],
  },
  {
    id: 'cold-foundry',
    name: 'Industrial Silence',
    blurb: 'Fitted Foundry bits sleep. Completions ease recipe growth.',
    restriction: 'Foundry combat bonuses, craft speed ranks, and fitted bits do nothing.',
    disabledSystems: ['Foundry bits', 'Foundry combat ranks'],
    mute: 'foundry',
    goalWave: 150,
    firstGrant: { kind: 'recipe', id: 'temper-bar', blurb: 'First clear unlocks the Temper Bar recipe.' },
    rewards: [
      { at: 1, hook: { kind: 'foundryXpNeed', mult: 0.94 }, blurb: 'Recipes need fewer crafts to level.' },
      { at: 2, hook: { kind: 'foundryXpNeed', mult: 0.94 }, blurb: 'Recipe levelling eases again.' },
      { at: 3, hook: { kind: 'foundryCostGrowth', mult: 0.96 }, blurb: 'Recipe costs shrink a little faster with level.' },
      { at: 4, hook: { kind: 'foundryXpNeed', mult: 0.94 }, blurb: 'Fewer crafts per recipe level.' },
      { at: 5, hook: { kind: 'foundryXpNeed', mult: 0.92 }, blurb: 'Milestone: recipe XP curve bends harder.' },
      { at: 6, hook: { kind: 'foundryCostGrowth', mult: 0.96 }, blurb: 'Recipe cost curve again.' },
      { at: 7, hook: { kind: 'researchCost', mult: 0.94 }, blurb: 'Research projects need less time.' },
      { at: 8, hook: { kind: 'foundryXpNeed', mult: 0.9 }, blurb: 'Capstone: the shop floor levels for longer.' },
    ],
  },
  {
    id: 'empty-reliquary',
    name: 'Empty Relics',
    blurb: 'Relics sit dark. Completions improve how extra copies scale.',
    restriction: 'Fitted Relics and resonance grant nothing.',
    disabledSystems: ['Relics', 'Resonance'],
    mute: 'reliquary',
    goalWave: 110,
    firstGrant: { kind: 'relic', id: 'focus-lens', blurb: 'First clear seats a Focus Lens Relic.' },
    rewards: [
      { at: 1, hook: { kind: 'reliquaryResonanceExp', add: -0.06 }, blurb: 'Early extra Relic copies count for more.' },
      { at: 2, hook: { kind: 'reliquaryResonanceExp', add: -0.04 }, blurb: 'Resonance curve eases again.' },
      { at: 3, hook: { kind: 'reliquaryResonanceExp', add: -0.04 }, blurb: 'Resonance scaling again.' },
      { at: 4, hook: { kind: 'reliquaryResonanceExp', add: -0.03 }, blurb: 'A little more from spare copies.' },
      { at: 5, hook: { kind: 'reliquaryResonanceExp', add: -0.05 }, blurb: 'Milestone: spare copies fill resonance faster.' },
      { at: 6, hook: { kind: 'reliquaryResonanceExp', add: -0.03 }, blurb: 'Resonance curve again.' },
      { at: 7, hook: { kind: 'reliquaryResonanceExp', add: -0.03 }, blurb: 'Spare copies still matter.' },
      { at: 8, hook: { kind: 'reliquaryResonanceExp', add: -0.05 }, blurb: 'Capstone: resonance comes online sooner.' },
    ],
  },
]

export interface ProtocolModifiers {
  networkExponentAdd: number
  networkFillGrowthMult: number
  networkRelayAdd: number
  networkDroneEffAdd: number
  networkWardExponentAdd: number
  furnaceDrainMult: number
  furnaceEfficiencyAdd: number
  foundryXpNeedMult: number
  foundryCostGrowthMult: number
  researchCostMult: number
  coreCostScalingAdd: number
  shieldCostScalingAdd: number
  rebuildMatterMult: number
  reliquaryResonanceExpAdd: number
  salvageSectorExpAdd: number
  yieldScrapExpAdd: number
}

export function emptyProtocolModifiers(): ProtocolModifiers {
  return {
    networkExponentAdd: 0,
    networkFillGrowthMult: 1,
    networkRelayAdd: 0,
    networkDroneEffAdd: 0,
    networkWardExponentAdd: 0,
    furnaceDrainMult: 1,
    furnaceEfficiencyAdd: 0,
    foundryXpNeedMult: 1,
    foundryCostGrowthMult: 1,
    researchCostMult: 1,
    coreCostScalingAdd: 0,
    shieldCostScalingAdd: 0,
    rebuildMatterMult: 1,
    reliquaryResonanceExpAdd: 0,
    salvageSectorExpAdd: 0,
    yieldScrapExpAdd: 0,
  }
}

export function createEmptyProtocolState(): ProtocolState {
  return { activeId: null, ranks: {}, bestSector: {}, bestWave: {} }
}

export function getProtocol(id: string): ProtocolDef | undefined {
  return PROTOCOLS.find((p) => p.id === id)
}

export function protocolsUnlocked(state: GameState): boolean {
  return isSystemUnlocked(state, 'protocols')
}

export function protocolRank(state: GameState, id: string): number {
  return Math.max(0, Math.floor(state.protocols?.ranks[id] ?? 0))
}

export function protocolBestSector(state: GameState, id: string): number {
  return Math.max(0, Math.floor(state.protocols?.bestSector?.[id] ?? 0))
}

export function protocolBestWave(state: GameState, id: string): number {
  const stored = Math.max(0, Math.floor(state.protocols?.bestWave?.[id] ?? 0))
  if (stored > 0) return stored
  return protocolBestSector(state, id) * 10
}

export function activeProtocol(state: GameState): ProtocolDef | undefined {
  const id = state.protocols?.activeId
  return id ? getProtocol(id) : undefined
}

export function protocolMutes(state: GameState, system: ProtocolMute): boolean {
  return activeProtocol(state)?.mute === system
}

export function protocolHullMult(state: GameState): number {
  return activeProtocol(state)?.hullMult ?? 1
}

export function protocolEnemyDensityMult(state: GameState): number {
  return activeProtocol(state)?.enemyDensityMult ?? 1
}

export function protocolDisabledLine(def: ProtocolDef): string {
  return def.disabledSystems.join(', ')
}

/** Legacy flat shop hook. Challenge ranks now change formulas instead. */
export function protocolBonusMult(_state: GameState, _system: ProtocolMute): number {
  return 1
}

export function protocolGoalWave(state: GameState, id: string): number {
  const def = getProtocol(id)
  if (!def) return 0
  return def.goalWave + protocolRank(state, id) * CHALLENGE_GOAL_STEP
}

/** @deprecated Wave goals are canonical. Kept for leftover sector readers. */
export function protocolGoalSector(state: GameState, id: string): number {
  return bandsClearedForWave(protocolGoalWave(state, id))
}

export function challengeFamiliarity(
  state: GameState,
  def: ProtocolDef,
): { ok: boolean; reason?: string } {
  switch (def.mute) {
    case 'weapons':
      if (Object.values(state.shipyard.moduleLevels ?? {}).some((n) => n > 0)) return { ok: true }
      return { ok: false, reason: 'Rank a Core first' }
    case 'shields':
      if ((state.shipyard.moduleLevels?.['plate-layer'] ?? 0) > 0) return { ok: true }
      return { ok: false, reason: 'Rank Plate first' }
    case 'network':
      if (
        Object.entries(state.base.assignments ?? {}).some(([id, n]) => (n ?? 0) > 0 && isWorkerJob(id))
      ) {
        return { ok: true }
      }
      return { ok: false, reason: 'Assign Worker Drones first' }
    case 'foundry':
      if (Object.values(state.foundry?.recipeLevels ?? {}).some((n) => n > 0)) return { ok: true }
      return { ok: false, reason: 'Finish a craft first' }
    case 'reliquary':
      if (Object.values(state.reliquary?.coreFits ?? {}).some((fits) => (fits ?? []).some(Boolean))) {
        return { ok: true }
      }
      return { ok: false, reason: 'Fit a Relic first' }
    case 'furnace':
      if (
        Object.values(state.furnace?.active ?? {}).some((n) => n > 0) ||
        (state.resources.choirAsh ?? 0) > 0 ||
        (state.resources.heat ?? 0) > 0
      ) {
        return { ok: true }
      }
      return { ok: false, reason: 'Convert Ash or light a channel first' }
    case 'salvage':
      return { ok: true }
    default:
      return { ok: true }
  }
}

function applyHook(mods: ProtocolModifiers, hook: ProtocolHook): void {
  const add = hook.add ?? 0
  const mult = hook.mult ?? 1
  switch (hook.kind) {
    case 'networkExponent':
      mods.networkExponentAdd += add
      break
    case 'networkFillGrowth':
      mods.networkFillGrowthMult *= mult
      break
    case 'networkRelay':
      mods.networkRelayAdd += add
      break
    case 'networkDroneEff':
      mods.networkDroneEffAdd += add
      break
    case 'networkWardExponent':
      mods.networkWardExponentAdd += add
      break
    case 'furnaceDrain':
      mods.furnaceDrainMult *= mult
      break
    case 'furnaceEfficiency':
      mods.furnaceEfficiencyAdd += add
      break
    case 'foundryXpNeed':
      mods.foundryXpNeedMult *= mult
      break
    case 'foundryCostGrowth':
      mods.foundryCostGrowthMult *= mult
      break
    case 'researchCost':
      mods.researchCostMult *= mult
      break
    case 'coreCostScaling':
      mods.coreCostScalingAdd += add
      break
    case 'shieldCostScaling':
      mods.shieldCostScalingAdd += add
      break
    case 'rebuildMatter':
      mods.rebuildMatterMult *= mult
      break
    case 'reliquaryResonanceExp':
      mods.reliquaryResonanceExpAdd += add
      break
    case 'salvageSectorExp':
      mods.salvageSectorExpAdd += add
      break
    case 'yieldScrapExp':
      mods.yieldScrapExpAdd += add
      break
  }
}

export function protocolModifiers(state: GameState): ProtocolModifiers {
  const mods = emptyProtocolModifiers()
  for (const def of PROTOCOLS) {
    const rank = protocolRank(state, def.id)
    if (rank <= 0) continue
    for (const step of def.rewards) {
      if (step.at <= rank) applyHook(mods, step.hook)
    }
  }
  return mods
}

export function protocolRewardsAt(def: ProtocolDef, rank: number): ProtocolRewardStep[] {
  return def.rewards.filter((step) => step.at === rank)
}

export function protocolGrantedRewards(state: GameState, id: string): ProtocolRewardStep[] {
  const def = getProtocol(id)
  if (!def) return []
  const rank = protocolRank(state, id)
  return def.rewards.filter((step) => step.at <= rank)
}

export function protocolNextRewards(state: GameState, id: string): ProtocolRewardStep[] {
  const def = getProtocol(id)
  if (!def) return []
  const next = protocolRank(state, id) + 1
  if (next > PROTOCOL_MAX_RANK) return []
  return protocolRewardsAt(def, next)
}

export function protocolRewardLine(steps: ProtocolRewardStep[]): string {
  if (steps.length === 0) return 'Maxed'
  return steps.map((step) => step.blurb).join(' ')
}

export function protocolNextRewardText(state: GameState, id: string): string {
  const def = getProtocol(id)
  if (!def) return 'Maxed'
  const next = protocolRank(state, id) + 1
  if (next > PROTOCOL_MAX_RANK) return 'Maxed'
  const grant = next === 1 && def.firstGrant ? `${def.firstGrant.blurb} ` : ''
  const frame = next === 1 && def.unlocksFrame ? 'Unlocks a Hive Frame. ' : ''
  return `${grant}${frame}${protocolRewardLine(protocolRewardsAt(def, next))}`.trim()
}

export function applyProtocolGrant(state: GameState, grant: ProtocolGrant): void {
  if (grant.kind === 'process') {
    if (!state.process.purchased.includes(grant.id)) {
      state.process.purchased = [...state.process.purchased, grant.id]
    }
    return
  }
  if (grant.kind === 'relic') {
    if (!state.reliquary) return
    state.reliquary.owned[grant.id] = (state.reliquary.owned[grant.id] ?? 0) + 1
    return
  }
  state.foundry.recipeLevels[grant.id] = Math.max(1, state.foundry.recipeLevels[grant.id] ?? 0)
}

export function protocolCumulativeLine(state: GameState, id: string): string {
  const granted = protocolGrantedRewards(state, id)
  if (granted.length === 0) return 'No completions yet.'
  return granted.map((step) => step.blurb).join(' ')
}

export function protocolCoreScalingAdd(state: GameState, role?: string): number {
  const mods = protocolModifiers(state)
  if (role === 'defense') return mods.shieldCostScalingAdd
  if (role === 'weapon') return mods.coreCostScalingAdd
  return 0
}

export function canEnterProtocol(
  state: GameState,
  id: string,
  opts?: { automated?: boolean },
): { ok: boolean; reason?: string } {
  if (!state.combat.docked || state.combat.inFight) {
    return { ok: false, reason: 'Dock first' }
  }
  if (state.echo?.activeId) return { ok: false, reason: 'Finish the Echo first' }
  if (state.protocols?.activeId) return { ok: false, reason: 'Already in a Challenge' }
  if (!protocolsUnlocked(state)) {
    return {
      ok: false,
      reason: `Reach Wave ${CHALLENGE_UNLOCK_WAVE} · Process online`,
    }
  }
  const def = getProtocol(id)
  if (!def) return { ok: false, reason: 'Unknown Challenge' }
  if (protocolRank(state, id) >= PROTOCOL_MAX_RANK) return { ok: false, reason: 'Maxed' }
  const familiar = challengeFamiliarity(state, def)
  if (!familiar.ok) return familiar
  if (opts?.automated && protocolRank(state, id) < 1) {
    return { ok: false, reason: 'Clear it by hand first' }
  }
  return { ok: true }
}

export function wipeProtocolLoadout(state: GameState): void {
  state.resources.salvage = 0
  state.shipyard.moduleLevels = {}
  state.shipyard.corePicks = {}
}

export function noteProtocolProgress(state: GameState): void {
  const id = state.protocols?.activeId
  if (!id) return
  if (!state.protocols.bestSector) state.protocols.bestSector = {}
  if (!state.protocols.bestWave) state.protocols.bestWave = {}
  const reached = Math.max(1, Math.floor(state.combat.wave ?? 1))
  state.protocols.bestWave[id] = Math.max(state.protocols.bestWave[id] ?? 0, reached)
  state.protocols.bestSector[id] = Math.max(
    state.protocols.bestSector[id] ?? 0,
    bandsClearedForWave(reached),
  )
}

/** Rank up if the goal Wave is cleared this Challenge. Mutates. */
export function tryCompleteProtocol(state: GameState): void {
  const def = activeProtocol(state)
  if (!def) return
  noteProtocolProgress(state)
  const goal = protocolGoalWave(state, def.id)
  if ((state.combat.wave ?? 0) < goal) return
  const prev = protocolRank(state, def.id)
  if (prev >= PROTOCOL_MAX_RANK) {
    state.protocols.activeId = null
    state.combat.docked = true
    state.combat.log = [`${def.name} already maxed.`, ...state.combat.log].slice(0, 40)
    return
  }
  if (!state.protocols) state.protocols = createEmptyProtocolState()
  const nextRank = prev + 1
  state.protocols.ranks = { ...state.protocols.ranks, [def.id]: nextRank }
  state.protocols.activeId = null
  state.combat.docked = true
  const prize = [
    nextRank === 1 && def.firstGrant ? def.firstGrant.blurb : '',
    protocolRewardLine(protocolRewardsAt(def, nextRank)),
  ]
    .filter(Boolean)
    .join(' ')
  if (nextRank === 1 && def.firstGrant) applyProtocolGrant(state, def.firstGrant)
  if (nextRank === 1 && def.unlocksFrame) {
    const frame = getFrame(def.unlocksFrame)
    grantUnlockedFrame(
      state,
      def.unlocksFrame,
      frame ? `${def.name} unlocked the ${frame.name}.` : `${def.name} unlocked a new Frame.`,
    )
  }
  closeSortie(state, 'extract', `${def.name} complete (${nextRank}/${PROTOCOL_MAX_RANK}). ${prize}`)
  noteAttempt(state, 'protocol', def.id, 'clear', def.name)
  state.combat.log = [state.combat.lastSortie.note, ...state.combat.log].slice(0, 40)
}
