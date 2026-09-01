/** Challenges — restricted Sorties that test a modified version of the normal rules. */

import type { GameState, ProtocolMute, ProtocolState } from './types'
import { isSystemUnlocked } from './progression'
import { closeSortie } from './sortieSummary'
import { noteAttempt } from './playtest'
import { ACT1_CADENCE } from './cadence'
import { isWorkerJob } from './workers'
import { getFrame, grantUnlockedFrame } from './catalog'
import { isFoundryMaterialId } from './foundryCatalogue'
import { getHiveResearchNode } from './hiveResearchTree'

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

export type ProtocolGrantKind = 'process-points' | 'relic' | 'recipe' | 'research'

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
    blurb: 'Reduced Hull. Completions ease Plate Core Level cost growth.',
    restriction: 'Hull is halved. Plate and other shield bonuses grant nothing.',
    disabledSystems: ['Hull integrity', 'Shields'],
    mute: 'shields',
    goalWave: 80,
    hullMult: 0.5,
    firstGrant: { kind: 'relic', id: 'plate-chip', blurb: 'First clear seats a Plate Chip Relic.' },
    rewards: [
      { at: 1, hook: { kind: 'shieldCostScaling', add: -0.005 }, blurb: 'Plate Core Level costs grow a little slower.' },
      { at: 2, hook: { kind: 'shieldCostScaling', add: -0.01 }, blurb: 'Plate Core Level costs grow a little slower.' },
      { at: 3, hook: { kind: 'shieldCostScaling', add: -0.008 }, blurb: 'Plate costs ease again.' },
      { at: 4, hook: { kind: 'rebuildMatter', mult: 1.04 }, blurb: 'Rebuilds pay a little more Matter.' },
      { at: 5, hook: { kind: 'shieldCostScaling', add: -0.012 }, blurb: 'Milestone: Plate stays cheaper longer.' },
      { at: 6, hook: { kind: 'shieldCostScaling', add: -0.01 }, blurb: 'Plate costs ease further.' },
      { at: 7, hook: { kind: 'rebuildMatter', mult: 1.04 }, blurb: 'Rebuild Matter again.' },
      { at: 8, hook: { kind: 'shieldCostScaling', add: -0.012 }, blurb: 'Capstone: high Plate Core Levels stay in reach.' },
    ],
  },
  {
    id: 'quiet-guns',
    name: 'Mono Core',
    blurb: 'Weapon Cores sit silent. Completions ease cost growth on weapon Core Levels.',
    restriction: 'Fitted weapon Cores deal no damage. The Frame Battery still fires.',
    disabledSystems: ['Weapon Cores'],
    mute: 'weapons',
    goalWave: 100,
    firstGrant: { kind: 'process-points', id: 'bronze-pp', blurb: 'Bronze first clear awards 2 Process Points.' },
    rewards: [
      { at: 1, hook: { kind: 'coreCostScaling', add: -0.01 }, blurb: 'Weapon Core Level costs grow a little slower.' },
      { at: 2, hook: { kind: 'coreCostScaling', add: -0.008 }, blurb: 'Weapon cost growth eases again.' },
      { at: 3, hook: { kind: 'coreCostScaling', add: -0.008 }, blurb: 'Weapon cost growth again.' },
      { at: 4, hook: { kind: 'researchCost', mult: 0.96 }, blurb: 'Research projects need a little less time.' },
      { at: 5, hook: { kind: 'coreCostScaling', add: -0.012 }, blurb: 'Milestone: Pulse and kin stay cheaper longer.' },
      { at: 6, hook: { kind: 'coreCostScaling', add: -0.008 }, blurb: 'Weapon cost growth again.' },
      { at: 7, hook: { kind: 'coreCostScaling', add: -0.008 }, blurb: 'Weapon Core Level cost curve still bends.' },
      { at: 8, hook: { kind: 'coreCostScaling', add: -0.012 }, blurb: 'Capstone: high Core Levels stay in reach.' },
    ],
  },
  {
    id: 'mute-network',
    name: 'Swarm Pressure',
    blurb: 'Greatly increased enemy density. Completions improve permanent industry.',
    restriction: 'Encounters spawn far more hulls.',
    disabledSystems: [],
    mute: 'network',
    goalWave: 100,
    enemyDensityMult: 2.2,
    firstGrant: {
      kind: 'process-points',
      id: 'bronze-pp',
      blurb: 'Bronze first clear awards 2 Process Points.',
    },
    rewards: [
      { at: 1, hook: { kind: 'foundryXpNeed', mult: 0.98 }, blurb: 'Material Mastery needs slightly fewer crafts.' },
      { at: 2, hook: { kind: 'researchCost', mult: 0.98 }, blurb: 'Research projects take slightly less time.' },
      { at: 3, hook: { kind: 'foundryCostGrowth', mult: 0.98 }, blurb: 'Processing costs grow a little slower.' },
      { at: 4, hook: { kind: 'rebuildMatter', mult: 1.02 }, blurb: 'Rebuilds pay a little more Matter.' },
      { at: 5, hook: { kind: 'foundryXpNeed', mult: 0.96 }, blurb: 'Material Mastery advances faster.' },
      { at: 6, hook: { kind: 'researchCost', mult: 0.96 }, blurb: 'Research time eases again.' },
      { at: 7, hook: { kind: 'foundryCostGrowth', mult: 0.96 }, blurb: 'Processing costs ease again.' },
      { at: 8, hook: { kind: 'rebuildMatter', mult: 1.04 }, blurb: 'Capstone: permanent industry improves Rebuild value.' },
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
    restriction: 'Kills grant no Salvage. Scrap, Foundry, and Worker Drone industry continue.',
    disabledSystems: ['Salvage from wrecks'],
    mute: 'salvage',
    goalWave: 120,
    firstGrant: { kind: 'recipe', id: 'filament', blurb: 'First clear unlocks the Filament recipe.' },
    rewards: [
      { at: 1, hook: { kind: 'salvageSectorExp', add: 0.03 }, blurb: 'Salvage from wrecks grows a little faster with Wave.' },
      { at: 2, hook: { kind: 'foundryXpNeed', mult: 0.98 }, blurb: 'Material Mastery needs slightly fewer crafts.' },
      { at: 3, hook: { kind: 'salvageSectorExp', add: 0.02 }, blurb: 'Salvage Wave growth again.' },
      { at: 4, hook: { kind: 'foundryXpNeed', mult: 0.96 }, blurb: 'Recipes need fewer crafts to level.' },
      { at: 5, hook: { kind: 'foundryXpNeed', mult: 0.96 }, blurb: 'Milestone: Material Mastery advances faster.' },
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
  return def.disabledSystems.length > 0 ? def.disabledSystems.join(', ') : 'None'
}

/** One-line restriction printed on Challenge landing cards. */
export function challengeRestrictionLine(def: ProtocolDef): string {
  return def.restriction
}

export function challengeRankLabel(state: GameState, id: string): string {
  const rank = protocolRank(state, id)
  if (rank >= PROTOCOL_MAX_RANK) return `Maxed · Rank ${PROTOCOL_MAX_RANK}`
  if (rank > 0) return `Cleared · Rank ${rank}/${PROTOCOL_MAX_RANK}`
  return `Open · Rank 0/${PROTOCOL_MAX_RANK}`
}

export function protocolRewardSummary(state: GameState, id: string): string {
  const def = getProtocol(id)
  if (!def) return 'Maxed'
  const next = protocolRank(state, id) + 1
  if (next > PROTOCOL_MAX_RANK) return 'Maxed'
  if (next === 1) {
    const bits: string[] = []
    if (def.firstGrant) bits.push(grantSummary(def.firstGrant))
    if (def.unlocksFrame) {
      const frame = getFrame(def.unlocksFrame)
      bits.push(frame?.name ?? 'Hive Frame')
    }
    if (bits.length > 0) return bits.join(' · ')
  }
  return protocolRewardLine(protocolRewardsAt(def, next))
}

function grantSummary(grant: ProtocolGrant): string {
  switch (grant.kind) {
    case 'relic':
      return grant.blurb.replace(/^First clear seats a /i, '').replace(/\.$/, '')
    case 'process-points':
      return '2 Process Points'
    case 'recipe':
      return grant.blurb.replace(/^First clear unlocks the /i, '').replace(/\.$/, '')
    case 'research':
      return grant.blurb.replace(/^First clear unlocks /i, '').replace(/ in Research\.$/i, '')
  }
}

/** Enemy / scenario modifiers shown on the Challenge sheet. */
export function challengeScenarioLines(def: ProtocolDef): string[] {
  const lines = ['Uses the normal Sortie engine.', 'Every Challenge starts at Wave 1.']
  if (def.hullMult && def.hullMult !== 1) lines.push(`Hive Hull ×${def.hullMult}.`)
  if (def.enemyDensityMult && def.enemyDensityMult !== 1) {
    lines.push(`Enemy density ×${def.enemyDensityMult}.`)
  }
  switch (def.mute) {
    case 'weapons':
      lines.push('Weapon Cores deal no damage. The Frame Battery still fires.')
      break
    case 'shields':
      lines.push('Plate and other shield bonuses grant nothing.')
      break
    case 'network':
      lines.push('Encounters spawn far more hulls than a normal Sortie.')
      break
    case 'furnace':
      lines.push('Furnace channels and Heat combat bonuses grant nothing.')
      break
    case 'salvage':
      lines.push('Kills grant no Salvage. Scrap, Foundry, and Worker industry continue.')
      break
    case 'foundry':
      lines.push('Foundry combat bonuses, craft speed ranks, and fitted bits do nothing.')
      break
    case 'reliquary':
      lines.push('Fitted Relics and resonance grant nothing.')
      break
    default:
      break
  }
  return lines
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

export function challengeFamiliarity(
  state: GameState,
  def: ProtocolDef,
): { ok: boolean; reason?: string } {
  switch (def.mute) {
    case 'weapons':
      if (Object.values(state.workshop?.coreStarts ?? {}).some((n) => n > 0)) return { ok: true }
      return { ok: false, reason: 'Raise a Core Level first' }
    case 'shields': {
      const plate = (state.shipyard.coreInstances ?? []).find((row) => row.moduleId === 'plate-layer')
      if (plate && (state.workshop?.coreStarts?.[plate.id] ?? 0) > 0) return { ok: true }
      return { ok: false, reason: 'Raise Plate Core Level first' }
    }
    case 'network':
      if (
        Object.entries(state.base.assignments ?? {}).some(([id, n]) => (n ?? 0) > 0 && isWorkerJob(id))
      ) {
        return { ok: true }
      }
      return { ok: false, reason: 'Assign Worker Drones first' }
    case 'foundry':
      if (Object.values(state.foundry?.masteryXp ?? {}).some((n) => (Number(n) || 0) > 0)) return { ok: true }
      return { ok: false, reason: 'Finish a craft first' }
    case 'reliquary':
      if (Object.values(state.relics?.coreFits ?? {}).some((fits) => (fits ?? []).some(Boolean))) {
        return { ok: true }
      }
      return { ok: false, reason: 'Fit a Relic first' }
    case 'furnace':
      if (
        (state.furnace.ignited && Object.values(state.furnace.channels).some((n) => n > 0)) ||
        (state.resources.choirAsh ?? 0) > 0 ||
        (state.resources.heat ?? 0) > 0
      ) {
        return { ok: true }
      }
      return { ok: false, reason: 'Convert Ash or Ignite the Furnace first' }
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

export function protocolHookEffect(hook: ProtocolHook): string {
  const add = hook.add
  const mult = hook.mult
  const addPct = add == null ? '' : `${add >= 0 ? '+' : ''}${Number((add * 100).toFixed(1))}%`
  const addRaw = add == null ? '' : `${add >= 0 ? '+' : ''}${add}`
  const multTxt = mult == null ? '' : `×${mult.toFixed(2)}`
  switch (hook.kind) {
    case 'networkExponent':
      return `Network exponent ${addRaw}`
    case 'networkFillGrowth':
      return `Network fill growth ${multTxt}`
    case 'networkRelay':
      return `Relay pull ${addPct}`
    case 'networkDroneEff':
      return `Drone efficiency ${addPct}`
    case 'networkWardExponent':
      return `Ward exponent ${addRaw}`
    case 'furnaceDrain':
      return `Channel Heat cost ${multTxt}`
    case 'furnaceEfficiency':
      return `Channel bonus ${addPct}`
    case 'foundryXpNeed':
      return `Recipe XP need ${multTxt}`
    case 'foundryCostGrowth':
      return `Recipe cost growth ${multTxt}`
    case 'researchCost':
      return `Research time ${multTxt}`
    case 'coreCostScaling':
      return `Weapon Core cost growth ${addRaw}`
    case 'shieldCostScaling':
      return `Plate cost growth ${addRaw}`
    case 'rebuildMatter':
      return `Rebuild Matter ${multTxt}`
    case 'reliquaryResonanceExp':
      return `Relic resonance exponent ${addRaw}`
    case 'salvageSectorExp':
      return `Salvage Wave growth ${addRaw}`
    case 'yieldScrapExp':
      return `Yield scrap growth ${addRaw}`
  }
}

export function protocolRewardLine(steps: ProtocolRewardStep[]): string {
  if (steps.length === 0) return 'Maxed'
  return steps.map((step) => protocolHookEffect(step.hook)).join(' · ')
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
  if (grant.kind === 'process-points') {
    // PP is reconstructed from permanent medal ranks; no mutable grant is needed.
    return
  }
  if (grant.kind === 'relic') {
    return
  }
  if (grant.kind === 'research') {
    if (!state.hiveResearch) return
    if (!getHiveResearchNode(grant.id)) return
    if (!state.hiveResearch.completedIds.includes(grant.id)) {
      state.hiveResearch.completedIds = [...state.hiveResearch.completedIds, grant.id]
    }
    return
  }
  if (!isFoundryMaterialId(grant.id)) return
  state.foundry.materials[grant.id] = Math.max(1, state.foundry.materials[grant.id] ?? 0)
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
    reached,
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
