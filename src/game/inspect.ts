/** Player-facing inspect cards — live numbers plus copy, no designer jargon. */

import type {
  FoundryRecipeId,
  FurnaceChannelId,
  FurnaceTrackId,
  FurnaceUpgradeId,
  GameState,
  HiveResearchBranch,
  NetworkBarId,
  NetworkLinkId,
  ReliquaryColor,
} from './types'
import {
  droneCap,
  dronePower,
  getModule,
  moduleMasteryRank,
  moduleStatPreviews,
} from './catalog'
import {
  coreRunCategory,
  coreRunLevelForModule,
  masteryXpToNext,
  moduleMasteryXp,
  nextMasteryMilestone,
} from './coreProgression'
import { formatCompact } from './format'
import { coreContributionPct } from './uiReadout'
import {
  NETWORK_BARS,
  NETWORK_LINKS,
  canBuyNetworkLink,
  getNetworkBar,
  getNetworkLink,
  isNetworkBarUnlocked,
  networkAssigned,
  networkCycleMult,
  networkEffectLabel,
  networkFillCap,
  networkFillCost,
  networkFillRate,
  networkLevels,
  networkLinkCost,
  networkLinkEffectLabel,
  networkLinkPower,
  networkLinkRank,
  networkProgress,
  networkRelayBonusLabel,
  networkRelayId,
  networkSecondsToLevel,
} from './network'
import {
  PROTOCOL_MAX_RANK,
  PROTOCOLS,
  getProtocol,
  protocolBestWave,
  protocolCumulativeLine,
  protocolDisabledLine,
  protocolGoalWave,
  protocolNextRewards,
  protocolRank,
  protocolRewardLine,
} from './protocols'
import {
  ASH_PER_HEAT,
  FURNACE_CHANNELS,
  canBuyFurnaceUpgrade,
  furnaceActiveLevel,
  furnaceChannelHeatCost,
  furnaceLevelDef,
  furnaceUpgradeCost,
  furnaceUpgradeRank,
  getFurnaceChannel,
  getFurnaceUpgrade,
  LEGACY_TRACK_TO_CHANNEL,
} from './furnace'
import {
  FOUNDRY_RECIPES,
  FOUNDRY_UPGRADES,
  craftsForNextLevel,
  formatFoundryCost,
  foundryCraftOutput,
  foundryCraftTime,
  foundryFitSlots,
  foundryHasMaterialChain,
  foundryMaterialCount,
  foundryNextMastery,
  foundryRecipeChainLine,
  foundryRecipeGateLine,
  foundryRecipeLevel,
  foundryUpgradeCost,
  getFoundryModule,
  getFoundryRecipe,
  getFoundryUpgrade,
  isFoundryInfinite,
  isFoundryModuleUnlocked,
  isFoundryRecipeUnlocked,
  scaledFoundryCost,
} from './foundry'
import { milestonesFor } from './milestones'
import {
  formatResearchDuration,
  HIVE_RESEARCH_BRANCHES,
  HIVE_RESEARCH_NODES,
  hiveResearchActive,
  hiveResearchCompleted,
  hiveResearchNodeCost,
  hiveResearchNodeEffectLine,
  hiveResearchSpeed,
  hiveResearchUpcoming,
  hiveResearchXp,
  isResearchBreakthrough,
} from './hiveResearch'
import {
  RELIQUARY_SLOTS,
  fittedRelicIds,
  fittedShardId,
  getShard,
  isReliquarySlotUnlocked,
  RELIC_SOCKET_LABELS,
  relicSocketClass,
  relicTier,
  shardEffectBlurb,
  shardOwned,
} from './reliquary'
import { ACT1_CADENCE } from './cadence'
import { cycleBestWave, prestigeGainFor } from './rebuild'

export interface InspectStat {
  label: string
  value: string
}

export interface InspectCard {
  title: string
  kicker?: string
  stats: InspectStat[]
  body: string[]
}

const TAG_LABEL: Record<string, string> = {
  kinetic: 'Kinetic',
  energy: 'Energy',
  pierce: 'Pierce',
  splash: 'Splash',
  dot: 'Burn',
  antiShield: 'Anti-shield',
}

const ROLE_LABEL: Record<string, string> = {
  weapon: 'Weapon Core',
  defense: 'Shield Core',
  utility: 'Utility Core',
}

function formatEta(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return 'Idle'
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.ceil(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`
}

function deliveryLine(delivery: string | undefined): string {
  if (delivery === 'beam') return 'Holds a beam on the target while it stays in range.'
  if (delivery === 'charge') return 'Winds up, then fires a fast bolt.'
  return 'Fires bolts that travel the lane.'
}

export function inspectNetworkOverview(state: GameState): InspectCard {
  const cap = droneCap(state)
  const idle = Math.max(0, state.base.workerDrones - networkAssigned(state))
  return {
    title: 'Drone Network',
    kicker: 'Drones',
    stats: [
      { label: 'Drones', value: `${state.base.workerDrones}/${cap}` },
      { label: 'Idle', value: String(idle) },
      { label: 'Assigned', value: String(networkAssigned(state)) },
      { label: 'Link power', value: formatCompact(networkLinkPower(state), 2) },
      { label: 'Efficiency', value: `×${dronePower(state).toFixed(2)}` },
      { label: 'Cycle speed', value: `×${networkCycleMult(state).toFixed(2)}` },
    ],
    body: [
      'Assign idle drones to bars. Idle drones do nothing.',
      'Each completed cycle takes longer than the last. Extra drones, Relays, and Links shorten that wait. Drones past the fill cap waste work. Bars crawl while docked.',
      'Relays improve fill speed, level strength, and fill cap for the bar behind them.',
      'Bar levels reset on Rebuild. Drones and Link ranks stay. Drones never fly on Sortie.',
    ],
  }
}

export function inspectNetworkBar(state: GameState, id: NetworkBarId): InspectCard | null {
  const def = getNetworkBar(id)
  if (!def) return null
  const open = isNetworkBarUnlocked(state, id)
  const assigned = Math.max(0, state.base.assignments[id] ?? 0)
  const levels = networkLevels(state, id)
  const fill = networkProgress(state, id)
  const rate = networkFillRate(state, id)
  const eta = networkSecondsToLevel(state, id)
  const stats: InspectStat[] = [
    { label: 'Status', value: open ? `Level ${levels}` : `Opens after Wave ${def.requiresBestWave}` },
  ]
  if (open) {
    stats.push(
      { label: 'Assigned', value: String(assigned) },
      { label: 'Cycle', value: `${Math.round(fill * 100)}%` },
      { label: 'Fill rate', value: rate > 0 ? `${rate.toFixed(2)}/s` : 'Idle' },
      { label: 'Fill cap', value: `${networkFillCap(state, id).toFixed(1)}/s` },
      { label: 'Cycle work', value: `${networkFillCost(state, id).toFixed(1)} (first ${def.fillBase})` },
      { label: 'Next level', value: formatEta(eta) },
      { label: 'Now', value: networkEffectLabel(state, id) },
      { label: 'Link power', value: formatCompact(networkLinkPower(state), 2) },
    )
    if (def.layer === 'primary') {
      const relayId = networkRelayId(id)
      if (relayId && isNetworkBarUnlocked(state, relayId)) {
        stats.push({
          label: getNetworkBar(relayId)?.name ?? 'Relay',
          value: `L${networkLevels(state, relayId)} · ${networkRelayBonusLabel(state, id)}`,
        })
      }
    } else if (def.parent) {
      stats.push({
        label: 'Improves',
        value: def.improves ?? getNetworkBar(def.parent)?.name ?? def.parent,
      })
    }
  }
  return {
    title: def.name,
    kicker: def.layer === 'primary' ? 'Network bar' : 'Network infrastructure',
    stats,
    body: [...def.detail],
  }
}

export function inspectNetworkLink(state: GameState, id: NetworkLinkId): InspectCard | null {
  const def = getNetworkLink(id)
  if (!def) return null
  const rank = networkLinkRank(state, id)
  const cost = networkLinkCost(state, id)
  const can = canBuyNetworkLink(state, id)
  const stats: InspectStat[] = [
    { label: 'Rank', value: `${rank}/${def.maxRank}` },
    { label: 'Now', value: networkLinkEffectLabel(state, id) },
  ]
  if (can.ok) {
    stats.push({
      label: 'Next',
      value: `${cost?.amount ?? 0} ${cost?.resource === 'heat' ? 'Heat' : 'scrap'}`,
    })
  } else {
    stats.push({ label: 'Next', value: can.reason })
  }
  if (id === 'racks') {
    stats.push({ label: 'Drone capacity', value: String(droneCap(state)) })
  }
  if (id === 'acuity') {
    stats.push({ label: 'Efficiency', value: `×${dronePower(state).toFixed(2)}` })
  }
  if (id === 'cycle') {
    stats.push({ label: 'Cycle speed', value: `×${networkCycleMult(state).toFixed(2)}` })
  }
  stats.push({ label: 'Link power', value: formatCompact(networkLinkPower(state), 2) })
  return {
    title: def.name,
    kicker: 'Network link',
    stats,
    body: [...def.detail],
  }
}

export function inspectCore(state: GameState, moduleId: string): InspectCard | null {
  const def = getModule(moduleId)
  if (!def) return null
  const mastery = moduleMasteryRank(state, moduleId)
  const xp = moduleMasteryXp(state, moduleId)
  const need = masteryXpToNext(mastery)
  const run = state.combat.docked ? 0 : coreRunLevelForModule(state, moduleId)
  const previews = moduleStatPreviews(moduleId, run, run < 200, mastery)
  const picks = state.shipyard.corePicks?.[moduleId]
  const milestones = milestonesFor(moduleId)
  const contribution = coreContributionPct(state, moduleId)
  const nextMs = nextMasteryMilestone(moduleId, mastery)
  const stats: InspectStat[] = [
    { label: 'Role', value: ROLE_LABEL[def.role] ?? def.role },
    { label: 'Run Level', value: state.combat.docked ? '0 at Dock' : String(run) },
    { label: 'Mastery', value: `${mastery} · ${xp} / ${need} XP` },
    { label: 'Shop', value: coreRunCategory(moduleId) },
  ]
  if (contribution != null) stats.push({ label: 'Build', value: `${contribution}% of DPS` })
  if (nextMs) stats.push({ label: 'Next Mastery', value: `M${nextMs.level} · ${nextMs.name}` })
  for (const row of previews) {
    stats.push({
      label: row.label,
      value: row.next ? `${row.current} → ${row.next}` : row.current,
    })
  }
  if (def.weapon) {
    const tags = def.weapon.tags.map((t) => TAG_LABEL[t] ?? t).join(' · ')
    if (tags) stats.push({ label: 'Kind', value: tags })
    const hull = def.weapon.hullDamage ?? 1
    const shield = def.weapon.shieldDamage ?? 1
    const armor = def.weapon.armorDamage ?? 1
    stats.push({
      label: 'Vs HP',
      value: `Hull ×${hull.toFixed(2)} · Shield ×${shield.toFixed(2)} · Armour ×${armor.toFixed(2)}`,
    })
  }
  const taken = milestones
    .map((ms) => {
      const choiceId = picks?.[ms.id]
      if (!choiceId) return null
      const choice = ms.choices.find((c) => c.id === choiceId)
      return choice ? `Legacy ${choice.name}` : null
    })
    .filter((line): line is string => Boolean(line))
  if (taken.length > 0) stats.push({ label: 'Kept effects', value: taken.join(' · ') })

  const body = [def.description]
  if (def.weapon) body.push(deliveryLine(def.weapon.delivery))
  body.push(
    'Run Levels spend Salvage during a Sortie and reset when it ends. Mastery is earned while the Core is equipped and survives Rebuild. Relics are installed at Dock.',
  )
  return {
    title: def.name,
    kicker: ROLE_LABEL[def.role] ?? 'Core',
    stats,
    body,
  }
}

export function inspectFurnaceChannel(state: GameState, id: FurnaceChannelId): InspectCard | null {
  const def = getFurnaceChannel(id)
  if (!def) return null
  const level = furnaceActiveLevel(state, id)
  const live = furnaceLevelDef(id, level)
  const stats: InspectStat[] = [
    { label: 'Level', value: level > 0 ? String(level) : 'Off' },
    { label: 'Bonus', value: live ? `×${live.mult.toFixed(2)} ${def.stat}` : 'Dark' },
    { label: 'Heat', value: formatCompact(furnaceChannelHeatCost(state, id, Math.max(level, 1)), 0) },
  ]
  return {
    title: def.name,
    kicker: 'Furnace channel',
    stats,
    body: [...def.detail],
  }
}

export function inspectFurnaceUpgrade(state: GameState, id: FurnaceUpgradeId): InspectCard | null {
  const def = getFurnaceUpgrade(id)
  if (!def) return null
  const rank = furnaceUpgradeRank(state, id)
  const can = canBuyFurnaceUpgrade(state, id)
  const cost = furnaceUpgradeCost(state, id)
  const stats: InspectStat[] = [
    { label: 'Rank', value: `${rank}/${def.maxRank}` },
  ]
  if (rank < def.maxRank) {
    stats.push({
      label: 'Cost',
      value: can.ok ? `${cost} Heat` : (can.reason ?? `${cost} Heat`),
    })
  }
  return {
    title: def.name,
    kicker: 'Furnace upgrade',
    stats,
    body: [def.blurb, 'Heat is spent on this Sortie. Permanent Furnace upgrades are retired.'],
  }
}

export function inspectFurnaceTrack(state: GameState, id: FurnaceTrackId): InspectCard | null {
  return inspectFurnaceChannel(state, LEGACY_TRACK_TO_CHANNEL[id])
}

export function inspectFurnaceOverview(state: GameState): InspectCard {
  const ash = state.resources.choirAsh ?? 0
  const heat = state.resources.heat ?? 0
  return {
    title: 'Furnace',
    kicker: 'Push Heat',
    stats: [
      { label: 'Ash', value: formatCompact(ash, 1) },
      { label: 'Heat', value: formatCompact(heat, 1) },
      { label: 'Convert', value: `${ASH_PER_HEAT} Ash → 1 Heat` },
      ...FURNACE_CHANNELS.map((ch) => ({
        label: ch.name,
        value: furnaceActiveLevel(state, ch.id) > 0 ? `Lv ${furnaceActiveLevel(state, ch.id)}` : 'Off',
      })),
    ],
    body: [
      'Kills drop Ash after Wave 140. Ash persists across Sorties this Rebuild cycle.',
      'Convert Ash into Heat, then spend Heat to light Weapons, Ward, or Yield for this Sortie.',
      'Heat and channel lights dump when you Dock. Rebuild also clears Ash.',
    ],
  }
}

export function inspectRebuildOverview(state: GameState): InspectCard {
  const best = cycleBestWave(state)
  const rebuilds = state.prestige.prestigeCount
  const estimate = prestigeGainFor(state)
  return {
    title: 'Rebuild',
    kicker: 'Hangar swap',
    stats: [
      { label: 'Cycle best Wave', value: String(best) },
      { label: 'Rebuilds done', value: String(rebuilds) },
      { label: 'Matter if you swap now', value: String(estimate) },
    ],
    body: [
      'Rebuild swaps the hull and wipes Salvage and Core Run Levels. Foundry recipes, Relics, Research, and Mastery stay.',
      'Matter this swap is about one-tenth of your cycle Best Wave, plus Workshop ranks and Scrap earned this cycle. Unspent Scrap does not count.',
      'Swap when the push stalls and another system cannot break the wall — not every Wave.',
    ],
  }
}

export function inspectFoundryRecipe(state: GameState, id: FoundryRecipeId): InspectCard | null {
  const def = getFoundryRecipe(id)
  if (!def) return null
  const unlocked = isFoundryRecipeUnlocked(state, id)
  const inf = isFoundryInfinite(state, id)
  const level = foundryRecipeLevel(state, id)
  const stock = foundryMaterialCount(state, id)
  const cost = scaledFoundryCost(state, id)
  const time = foundryCraftTime(state, id)
  const xp = state.foundry.recipeXp[id] ?? 0
  const need = craftsForNextLevel(level, state)
  const stats: InspectStat[] = [
    {
      label: 'Status',
      value: inf ? 'Infinite stock' : unlocked ? `Level ${level}/${def.maxLevel}` : 'Locked',
    },
  ]
  if (unlocked && !inf) {
    stats.push(
      { label: 'Stock', value: formatCompact(Number.isFinite(stock) ? stock : 0) },
      { label: 'Craft', value: formatFoundryCost(cost) },
      { label: 'Time', value: `${formatCompact(time, 1)}s` },
      { label: 'Output', value: String(foundryCraftOutput(state, id)) },
      { label: 'To next level', value: `${xp}/${need} crafts` },
    )
    const next = foundryNextMastery(state, id)
    if (next) stats.push({ label: 'Next mastery', value: `Lv ${next.at} — ${next.blurb}` })
  }
  if (!unlocked) stats.push({ label: 'Gate', value: foundryRecipeGateLine(def) })
  else if (def.unlocksRecipe) {
    const child = getFoundryRecipe(def.unlocksRecipe.recipeId)?.name ?? def.unlocksRecipe.recipeId
    stats.push({ label: 'Unlocks', value: `${child} at level ${def.unlocksRecipe.atLevel}` })
  }
  const body = [
    def.blurb,
    foundryHasMaterialChain(def)
      ? foundryRecipeChainLine(def)
      : 'Salvage or scrap goes in. Stock comes out.',
    'Raising this recipe still matters: later crafts get faster, cheaper, and yield more — then the floor supplies it on its own.',
    'Recipe levels, stock, and Foundry Points persist when you Rebuild. Fitted bits come off.',
  ]
  if (inf) {
    body.unshift('This material is solved. You do not need to queue it any more.')
  }
  if (def.requiresBestWave > ACT1_CADENCE.foundry) {
    body.push(`This recipe opens after you reach Wave ${def.requiresBestWave}.`)
  }
  return {
    title: def.name,
    kicker: 'Foundry recipe',
    stats,
    body,
  }
}

export function inspectFoundryUpgrade(state: GameState, id: string): InspectCard | null {
  const def = getFoundryUpgrade(id)
  if (!def) return null
  const rank = state.foundry.upgrades[id] ?? 0
  const cost = foundryUpgradeCost(state, id)
  const stats: InspectStat[] = [
    { label: 'Rank', value: `${rank}/${def.maxRank}` },
    { label: 'Foundry Points', value: formatCompact(state.foundry.points) },
  ]
  if (def.damageBonus) {
    stats.push({ label: 'Damage', value: `+${pct(def.damageBonus * rank)}` })
  }
  if (def.shieldBonus) {
    stats.push({ label: 'Shield', value: `+${pct(def.shieldBonus * rank)}` })
  }
  if (def.speedBonus) {
    stats.push({ label: 'Craft speed', value: `+${pct(def.speedBonus * rank)}` })
  }
  if (def.extraSlots) {
    stats.push({ label: 'Smelters', value: `+${def.extraSlots * rank}` })
  }
  if (def.extraFitSlots) {
    stats.push({ label: 'Fit slots', value: `+${def.extraFitSlots * rank}` })
  }
  if (def.salvageBonus) {
    stats.push({ label: 'Salvage', value: `+${pct(def.salvageBonus * rank)}` })
  }
  if (def.xpBonus) {
    stats.push({ label: 'Mastery XP', value: `+${pct(def.xpBonus * rank)}` })
  }
  if (def.outputAdd) {
    stats.push({ label: 'Output', value: `+${def.outputAdd * rank} per craft` })
  }
  if (def.masteryReduce) {
    stats.push({ label: 'Gates', value: `−${def.masteryReduce * rank} mastery` })
  }
  if (def.networkFillBonus) {
    stats.push({ label: 'Network fill', value: `+${pct(def.networkFillBonus * rank)}` })
  }
  if (def.ashHeatBonus) {
    stats.push({ label: 'Ash Heat', value: `+${pct(def.ashHeatBonus * rank)}` })
  }
  if (def.researchXpBonus) {
    stats.push({ label: 'Research XP', value: `+${pct(def.researchXpBonus * rank)}` })
  }
  if (def.shardDropBonus) {
    stats.push({ label: 'Shards', value: `+${pct(def.shardDropBonus * rank)}` })
  }
  if (def.partDropBonus) {
    stats.push({ label: 'Print drops', value: `+${pct(def.partDropBonus * rank)}` })
  }
  if (def.queueBonus) {
    stats.push({ label: 'Queue', value: `+${def.queueBonus * rank} slots` })
  }
  if (rank < def.maxRank) stats.push({ label: 'Next', value: `${cost} FP` })
  return {
    title: def.name,
    kicker: 'Foundry rank',
    stats,
    body: [
      def.blurb,
      'Foundry Points come from finishing crafts and from mastery ranks. These ranks persist when you Rebuild.',
      def.extraSlots
        ? 'Extra smelters let you run more recipes at once. Four slots is the cap.'
        : 'Ranks change the shop floor — speed, output, gates, and other systems — not only sortie stats.',
    ],
  }
}

export function inspectFoundryModule(state: GameState, id: string): InspectCard | null {
  const def = getFoundryModule(id)
  if (!def) return null
  const unlocked = isFoundryModuleUnlocked(state, id)
  const fitted = state.foundry.equipped.includes(id)
  const costBits = Object.entries(def.cost)
    .map(([rid, n]) => `${n} ${getFoundryRecipe(rid)?.name ?? rid}`)
    .join(' · ')
  const parent = getFoundryRecipe(def.requiresRecipeLevel.recipeId)
  const stats: InspectStat[] = [
    {
      label: 'Status',
      value: fitted ? 'Fitted' : unlocked ? 'Ready' : 'Locked',
    },
    { label: 'Fit slots', value: `${state.foundry.equipped.length}/${foundryFitSlots(state)}` },
  ]
  if (def.damageMult) stats.push({ label: 'Damage', value: `×${def.damageMult.toFixed(2)}` })
  if (def.shieldFlat) stats.push({ label: 'Shield', value: `+${def.shieldFlat}` })
  if (unlocked) stats.push({ label: 'Print cost', value: costBits })
  else {
    stats.push({
      label: 'Needs',
      value: `${parent?.name ?? def.requiresRecipeLevel.recipeId} level ${def.requiresRecipeLevel.level}`,
    })
  }
  return {
    title: def.name,
    kicker: 'Foundry bit',
    stats,
    body: [
      def.blurb,
      'Print the bit from stock, then fit it while docked.',
      'Fitted bits come off on Rebuild. Recipe levels stay, so you can print them again.',
    ],
  }
}

export function inspectShard(state: GameState, shardId: string): InspectCard | null {
  const def = getShard(shardId)
  if (!def) return null
  const owned = shardOwned(state, shardId)
  const fitted = fittedRelicIds(state).includes(shardId) || fittedShardId(state, def.color) === shardId
  const stats: InspectStat[] = [
    { label: 'Owned', value: String(owned) },
    { label: 'Socket', value: RELIC_SOCKET_LABELS[relicSocketClass(def)] },
    { label: 'Tier', value: String(relicTier(def)) },
    { label: 'Installed', value: fitted ? 'Yes' : 'No' },
    { label: 'Effect', value: shardEffectBlurb(def) },
  ]
  const body = [
    def.blurb,
    'Install Relics into matching Core sockets while Docked. Removal is free.',
    'Duplicates go on another Core or upgrade the Relic at Foundry. They do not fill a resonance bank.',
    `Relics drop from wrecks after Wave ${ACT1_CADENCE.reliquary}. They persist on Rebuild.`,
  ]
  if (def.upgradesTo) {
    body.push('Foundry can raise this Relic to the next authored tier.')
  }
  if ((def.requiresBestWave ?? 0) > 0) {
    body.push(`This Relic waits until you have reached Wave ${def.requiresBestWave}.`)
  }
  return {
    title: def.name,
    kicker: 'Relic',
    stats,
    body,
  }
}

export function inspectReliquarySlot(state: GameState, color: ReliquaryColor): InspectCard | null {
  const slot = RELIQUARY_SLOTS.find((s) => s.color === color)
  if (!slot) return null
  const open = isReliquarySlotUnlocked(state, color)
  const fitted = fittedShardId(state, color)
  const card = fitted ? inspectShard(state, fitted) : null
  if (card) return card
  return {
    title: slot.name,
    kicker: 'Reliquary slot',
    stats: [
      {
        label: 'Status',
        value: open ? 'Empty' : `Opens after Wave ${slot.requiresBestWave}`,
      },
    ],
    body: [
      'Fit one shard of this colour. Extra copies of that shard charge resonance.',
      'Shards persist when you Rebuild.',
    ],
  }
}

export function inspectProtocol(state: GameState, id: string): InspectCard | null {
  const def = getProtocol(id)
  if (!def) return null
  const rank = protocolRank(state, id)
  const goal = protocolGoalWave(state, id)
  const best = protocolBestWave(state, id)
  return {
    title: def.name,
    kicker: 'Challenge',
    stats: [
      { label: 'Clears', value: `${rank}/${PROTOCOL_MAX_RANK}` },
      { label: 'Goal', value: `Wave ${goal}` },
      { label: 'Best', value: best > 0 ? `Wave ${best}` : '—' },
      { label: 'Disabled', value: protocolDisabledLine(def) },
      { label: 'Next', value: protocolRewardLine(protocolNextRewards(state, id)) },
    ],
    body: [
      def.restriction,
      'Starting this Challenge resets Salvage, Core levels, and the current Sortie. Ranks persist on Rebuild.',
      rank > 0 ? protocolCumulativeLine(state, id) : def.blurb,
      'Repeat clears still pay at every level. Later ranks raise the goal Wave.',
    ],
  }
}

export function inspectResearchBranch(state: GameState, id: HiveResearchBranch): InspectCard | null {
  const def = HIVE_RESEARCH_BRANCHES.find((b) => b.id === id)
  if (!def) return null
  const nodes = HIVE_RESEARCH_NODES[id]
  const done = hiveResearchCompleted(state, id)
  const xp = hiveResearchXp(state, id)
  const upcoming = hiveResearchUpcoming(state, id)
  const next = upcoming[0]
  const need = next ? hiveResearchNodeCost(next.index, state) : 0
  const researching = hiveResearchActive(state) && (state.hiveResearch?.focus ?? 'energy') === id
  const speed = hiveResearchSpeed(state)
  const left = next && speed > 0 ? Math.max(0, (need - xp) / speed) : 0
  const stats: InspectStat[] = [
    { label: 'Done', value: `${done}/${nodes.length}` },
    { label: 'Slot', value: researching ? 'Active project' : 'Idle' },
  ]
  if (next) {
    stats.push(
      { label: 'Next', value: `${next.node.name}${isResearchBreakthrough(next.node) ? ' (breakthrough)' : ''}` },
      { label: 'Duration', value: researching ? formatResearchDuration(left) : formatResearchDuration(need) },
    )
  }
  return {
    title: def.name,
    kicker: 'Research discipline',
    stats,
    body: [
      def.blurb,
      'One Research project at a time. Choose which discipline to focus.',
      'The project runs during Sorties, at Dock, and offline. Sensor Net drones speed it up.',
      'Breakthroughs change a rule — targeting, a processor slot, a Frame, a Reliquary colour. Small percent nodes stay rare.',
      next ? hiveResearchNodeEffectLine(next.node) : 'This discipline is complete.',
      'Nodes persist when you Rebuild.',
    ],
  }
}

/** Every live inspect string, for jargon tests. */
export function inspectCopyCorpus(state: GameState): string[] {
  const lines: string[] = []
  const push = (card: InspectCard | null) => {
    if (!card) return
    lines.push(card.title, card.kicker ?? '', ...card.stats.map((s) => `${s.label} ${s.value}`), ...card.body)
  }
  push(inspectNetworkOverview(state))
  push(inspectRebuildOverview(state))
  for (const bar of NETWORK_BARS) push(inspectNetworkBar(state, bar.id))
  for (const link of NETWORK_LINKS) push(inspectNetworkLink(state, link.id))
  for (const id of state.shipyard.modules) push(inspectCore(state, id))
  push(inspectFurnaceOverview(state))
  for (const ch of FURNACE_CHANNELS) push(inspectFurnaceChannel(state, ch.id))
  for (const p of PROTOCOLS) push(inspectProtocol(state, p.id))
  for (const r of FOUNDRY_RECIPES) push(inspectFoundryRecipe(state, r.id))
  for (const up of FOUNDRY_UPGRADES) push(inspectFoundryUpgrade(state, up.id))
  for (const b of HIVE_RESEARCH_BRANCHES) push(inspectResearchBranch(state, b.id))
  return lines
}
