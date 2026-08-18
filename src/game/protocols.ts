/** Protocols — restricted sorties that teach a system, then change how it scales. */

import type { GameState, ProtocolMute, ProtocolState } from './types'
import { careerHighestSector } from './progression'
import { closeSortie } from './sortieSummary'
import { noteAttempt } from './playtest'

export const PROTOCOL_UNLOCK_SECTOR = 18
export const PROTOCOL_MAX_RANK = 8

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

export interface ProtocolDef {
  id: string
  name: string
  blurb: string
  restriction: string
  mute: ProtocolMute
  /** First-clear goal. Later clears add +1 sector per owned rank. */
  goalSector: number
  rewards: ProtocolRewardStep[]
}

export const PROTOCOLS: ProtocolDef[] = [
  {
    id: 'mute-network',
    name: 'Mute Network',
    blurb: 'Fly without drone bars. Completions improve how Network scales.',
    restriction: 'Strike, Ward, Yield, Loom, Archive, and Relays grant nothing.',
    mute: 'network',
    goalSector: 6,
    rewards: [
      { at: 1, hook: { kind: 'networkExponent', add: 0.02 }, blurb: 'Network levels scale harder at every rank.' },
      { at: 2, hook: { kind: 'networkExponent', add: 0.015 }, blurb: 'A little more Network scaling.' },
      { at: 3, hook: { kind: 'networkFillGrowth', mult: 0.94 }, blurb: 'Later Network fills grow slower.' },
      { at: 4, hook: { kind: 'networkExponent', add: 0.015 }, blurb: 'Network scaling again.' },
      { at: 5, hook: { kind: 'networkRelay', add: 0.08 }, blurb: 'Relays pull harder on the bars behind them.' },
      { at: 6, hook: { kind: 'networkFillGrowth', mult: 0.94 }, blurb: 'Fill growth eases again.' },
      { at: 7, hook: { kind: 'networkDroneEff', add: 0.05 }, blurb: 'Each assigned drone counts for more.' },
      { at: 8, hook: { kind: 'networkFillGrowth', mult: 0.92 }, blurb: 'Capstone: Network fills stay relevant late.' },
    ],
  },
  {
    id: 'cold-foundry',
    name: 'Cold Foundry',
    blurb: 'Crafted bits and Foundry ranks sleep. Completions ease recipe growth.',
    restriction: 'Foundry combat bonuses, craft speed ranks, and fitted bits do nothing.',
    mute: 'foundry',
    goalSector: 8,
    rewards: [
      { at: 1, hook: { kind: 'foundryXpNeed', mult: 0.94 }, blurb: 'Recipes need fewer crafts to level.' },
      { at: 2, hook: { kind: 'foundryXpNeed', mult: 0.94 }, blurb: 'Recipe levelling eases again.' },
      { at: 3, hook: { kind: 'foundryCostGrowth', mult: 0.96 }, blurb: 'Recipe costs shrink a little faster with level.' },
      { at: 4, hook: { kind: 'foundryXpNeed', mult: 0.94 }, blurb: 'Fewer crafts per recipe level.' },
      { at: 5, hook: { kind: 'foundryXpNeed', mult: 0.92 }, blurb: 'Milestone: recipe XP curve bends harder.' },
      { at: 6, hook: { kind: 'foundryCostGrowth', mult: 0.96 }, blurb: 'Recipe cost curve again.' },
      { at: 7, hook: { kind: 'researchCost', mult: 0.94 }, blurb: 'Research nodes need less XP.' },
      { at: 8, hook: { kind: 'foundryXpNeed', mult: 0.9 }, blurb: 'Capstone: the shop floor levels for longer.' },
    ],
  },
  {
    id: 'empty-reliquary',
    name: 'Empty Reliquary',
    blurb: 'Shards sit dark. Completions improve how extra copies scale.',
    restriction: 'Fitted shards and resonance grant nothing.',
    mute: 'reliquary',
    goalSector: 10,
    rewards: [
      { at: 1, hook: { kind: 'reliquaryResonanceExp', add: -0.06 }, blurb: 'Early extra copies of a shard count for more.' },
      { at: 2, hook: { kind: 'reliquaryResonanceExp', add: -0.04 }, blurb: 'Resonance curve eases again.' },
      { at: 3, hook: { kind: 'reliquaryResonanceExp', add: -0.04 }, blurb: 'Resonance scaling again.' },
      { at: 4, hook: { kind: 'reliquaryResonanceExp', add: -0.03 }, blurb: 'A little more from spare copies.' },
      { at: 5, hook: { kind: 'reliquaryResonanceExp', add: -0.05 }, blurb: 'Milestone: spare copies fill resonance faster.' },
      { at: 6, hook: { kind: 'reliquaryResonanceExp', add: -0.03 }, blurb: 'Resonance curve again.' },
      { at: 7, hook: { kind: 'reliquaryResonanceExp', add: -0.03 }, blurb: 'Spare copies still matter.' },
      { at: 8, hook: { kind: 'reliquaryResonanceExp', add: -0.05 }, blurb: 'Capstone: resonance comes online sooner.' },
    ],
  },
  {
    id: 'dead-furnace',
    name: 'Dead Furnace',
    blurb: 'Heat channels sit dark. Completions ease Heat drain and channel pay.',
    restriction: 'Furnace channels and Heat combat bonuses grant nothing.',
    mute: 'furnace',
    goalSector: 12,
    rewards: [
      { at: 1, hook: { kind: 'furnaceDrain', mult: 0.94 }, blurb: 'Lit channels spend less Heat.' },
      { at: 2, hook: { kind: 'furnaceDrain', mult: 0.94 }, blurb: 'Heat drain eases again.' },
      { at: 3, hook: { kind: 'furnaceEfficiency', add: 0.06 }, blurb: 'Each channel level pays more of its bonus.' },
      { at: 4, hook: { kind: 'furnaceDrain', mult: 0.94 }, blurb: 'Heat drain again.' },
      { at: 5, hook: { kind: 'furnaceEfficiency', add: 0.08 }, blurb: 'Milestone: channels convert Heat more cleanly.' },
      { at: 6, hook: { kind: 'furnaceDrain', mult: 0.92 }, blurb: 'Heat drain eases further.' },
      { at: 7, hook: { kind: 'furnaceEfficiency', add: 0.06 }, blurb: 'Channel pay again.' },
      { at: 8, hook: { kind: 'furnaceDrain', mult: 0.9 }, blurb: 'Capstone: the tank lasts through more fire.' },
    ],
  },
  {
    id: 'quiet-guns',
    name: 'Quiet Guns',
    blurb: 'Weapon Cores sit silent. Completions ease Salvage cost growth on Cores.',
    restriction: 'Weapon Cores deal no damage. The frame battery and other systems still fire.',
    mute: 'weapons',
    goalSector: 7,
    rewards: [
      { at: 1, hook: { kind: 'coreCostScaling', add: -0.01 }, blurb: 'Weapon Core Salvage costs grow a little slower.' },
      { at: 2, hook: { kind: 'coreCostScaling', add: -0.008 }, blurb: 'Weapon cost growth eases again.' },
      { at: 3, hook: { kind: 'coreCostScaling', add: -0.008 }, blurb: 'Weapon cost growth again.' },
      { at: 4, hook: { kind: 'researchCost', mult: 0.96 }, blurb: 'Research nodes need a little less XP.' },
      { at: 5, hook: { kind: 'coreCostScaling', add: -0.012 }, blurb: 'Milestone: Pulse and kin stay cheaper longer.' },
      { at: 6, hook: { kind: 'coreCostScaling', add: -0.008 }, blurb: 'Weapon cost growth again.' },
      { at: 7, hook: { kind: 'coreCostScaling', add: -0.008 }, blurb: 'Weapon Salvage curve still bends.' },
      { at: 8, hook: { kind: 'coreCostScaling', add: -0.012 }, blurb: 'Capstone: high Core ranks stay in reach.' },
    ],
  },
  {
    id: 'glass-ward',
    name: 'Glass Ward',
    blurb: 'Shields sit empty. Completions improve Ward scaling and Plate cost growth.',
    restriction: 'Plate, Ward, and other shield bonuses grant nothing.',
    mute: 'shields',
    goalSector: 9,
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
    id: 'dry-hold',
    name: 'Dry Hold',
    blurb: 'Wrecks drop no Salvage. Completions improve salvage growth and Yield scrap.',
    restriction: 'Kills grant no Salvage. Scrap, Foundry, and Yield still run.',
    mute: 'salvage',
    goalSector: 11,
    rewards: [
      { at: 1, hook: { kind: 'salvageSectorExp', add: 0.03 }, blurb: 'Salvage from wrecks grows a little faster with sector.' },
      { at: 2, hook: { kind: 'yieldScrapExp', add: 0.04 }, blurb: 'Yield scrap trickle scales harder.' },
      { at: 3, hook: { kind: 'salvageSectorExp', add: 0.02 }, blurb: 'Salvage sector growth again.' },
      { at: 4, hook: { kind: 'foundryXpNeed', mult: 0.96 }, blurb: 'Recipes need fewer crafts to level.' },
      { at: 5, hook: { kind: 'yieldScrapExp', add: 0.05 }, blurb: 'Milestone: Yield scrap curve bends harder.' },
      { at: 6, hook: { kind: 'salvageSectorExp', add: 0.02 }, blurb: 'Salvage sector growth again.' },
      { at: 7, hook: { kind: 'rebuildMatter', mult: 1.03 }, blurb: 'Rebuilds pay a little more Matter.' },
      { at: 8, hook: { kind: 'salvageSectorExp', add: 0.03 }, blurb: 'Capstone: late sectors drop more Salvage.' },
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
  return { activeId: null, ranks: {}, bestSector: {} }
}

export function getProtocol(id: string): ProtocolDef | undefined {
  return PROTOCOLS.find((p) => p.id === id)
}

export function protocolsUnlocked(state: GameState): boolean {
  return careerHighestSector(state) >= PROTOCOL_UNLOCK_SECTOR
}

export function protocolRank(state: GameState, id: string): number {
  return Math.max(0, Math.floor(state.protocols?.ranks[id] ?? 0))
}

export function protocolBestSector(state: GameState, id: string): number {
  return Math.max(0, Math.floor(state.protocols?.bestSector?.[id] ?? 0))
}

export function activeProtocol(state: GameState): ProtocolDef | undefined {
  const id = state.protocols?.activeId
  return id ? getProtocol(id) : undefined
}

export function protocolMutes(state: GameState, system: ProtocolMute): boolean {
  return activeProtocol(state)?.mute === system
}

/** Legacy flat shop hook. Protocol ranks now change formulas instead. */
export function protocolBonusMult(_state: GameState, _system: ProtocolMute): number {
  return 1
}

export function protocolGoalSector(state: GameState, id: string): number {
  const def = getProtocol(id)
  if (!def) return 0
  return def.goalSector + protocolRank(state, id)
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
  if (state.protocols?.activeId) return { ok: false, reason: 'Already in a Protocol' }
  if (!protocolsUnlocked(state)) {
    return { ok: false, reason: `Clear sector ${PROTOCOL_UNLOCK_SECTOR}` }
  }
  const def = getProtocol(id)
  if (!def) return { ok: false, reason: 'Unknown Protocol' }
  if (protocolRank(state, id) >= PROTOCOL_MAX_RANK) return { ok: false, reason: 'Maxed' }
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
  const reached = Math.max(state.combat.highestSector ?? 0, state.combat.sector ?? 0)
  state.protocols.bestSector[id] = Math.max(state.protocols.bestSector[id] ?? 0, reached)
}

/** Rank up if the goal sector is cleared this Protocol. Mutates. */
export function tryCompleteProtocol(state: GameState): void {
  const def = activeProtocol(state)
  if (!def) return
  noteProtocolProgress(state)
  const goal = protocolGoalSector(state, def.id)
  if (state.combat.highestSector < goal) return
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
  const prize = protocolRewardLine(protocolRewardsAt(def, nextRank))
  closeSortie(state, 'extract', `${def.name} complete (${nextRank}/${PROTOCOL_MAX_RANK}). ${prize}`)
  noteAttempt(state, 'protocol', def.id, 'clear', def.name)
  state.combat.log = [state.combat.lastSortie.note, ...state.combat.log].slice(0, 40)
}
