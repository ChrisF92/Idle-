/** Player-facing inspect cards — live numbers plus copy, no designer jargon. */

import type {
  FoundryRecipeId,
  FurnaceChannelId,
  GameState,
  HiveResearchBranch,
  NetworkBarId,
  NetworkLinkId,
} from './types'
import {
  droneCap,
  getModule,
  moduleMasteryRank,
  moduleStatPreviews,
} from './catalog'
import {
  coreStartingLevel,
  masteryXpToNext,
  moduleMasteryXp,
  masteryMilestoneEffect,
  nextMasteryMilestone,
} from './coreProgression'
import { resolveCoreInstance } from './coreInstances'
import { formatCompact } from './format'
import { coreContributionPct } from './uiReadout'
import { workerAllocationSummary } from './workers'
import {
  PROTOCOL_MAX_RANK,
  PROTOCOLS,
  getProtocol,
  protocolBestWave,
  protocolCumulativeLine,
  protocolDisabledLine,
  protocolGoalWave,
  protocolNextRewardText,
  protocolRank,
} from './protocols'
import {
  ASH_PER_HEAT,
  FURNACE_CHANNEL_IDS,
  furnaceChannel,
  furnaceChannelCost,
  furnaceLevelDef,
} from './furnace'
import {
  FOUNDRY_RECIPES,
  formatFoundryCost,
  foundryCraftTime,
  foundryHasMaterialChain,
  foundryMaterialCount,
  foundryRecipeChainLine,
  getFoundryRecipe,
  isFoundryRecipeUnlocked,
  materialMasteryRank,
} from './foundry'
import {
  formatResearchDuration,
  HIVE_RESEARCH_BRANCHES,
  HIVE_RESEARCH_NODES,
  hiveResearchActive,
  hiveResearchCompleted,
  hiveResearchInspectDetail,
  hiveResearchNodeDuration,
  hiveResearchNodeEffectLine,
  hiveResearchSpeed,
  hiveResearchUpcoming,
  hiveResearchXp,
  isResearchBreakthrough,
} from './hiveResearch'
import {
  getRelicInstance,
  inspectRelicEffectText,
  relicFitLocation,
  relicSocketUiLabel,
  relicState,
  relicTierLabel,
  resolveRelicDescriptor,
} from './relics'
import { cycleBestWave, matterGainFor } from './rebuild'

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

function deliveryLine(delivery: string | undefined): string {
  if (delivery === 'beam') return 'Holds a beam on the target while it stays in range.'
  if (delivery === 'charge') return 'Winds up, then fires a fast bolt.'
  return 'Fires bolts that travel the lane.'
}

export function inspectNetworkOverview(state: GameState): InspectCard {
  const workers = workerAllocationSummary(state)
  const cap = droneCap(state)
  return {
    title: 'Worker Drones',
    kicker: 'Workforce',
    stats: [
      { label: 'Total', value: String(workers.total) },
      { label: 'Assigned', value: String(workers.assigned) },
      { label: 'Idle', value: String(workers.idle) },
      { label: 'Capacity', value: String(cap) },
    ],
    body: [
      'Assign Worker Drones to active Processing, Fabrication, Research, Worker Drone production, Infrastructure, or passive Salvage Operations.',
      'Every job shows its efficient range and the exact consequence of adding one Worker. Workers beyond the efficient range have diminishing returns.',
      'Worker Drones persist through Rebuild. Assignments reset so the next cycle can be planned around its active work.',
    ],
  }
}

export function inspectNetworkBar(_state: GameState, _id: NetworkBarId): InspectCard | null {
  return null
}

export function inspectNetworkLink(_state: GameState, _id: NetworkLinkId): InspectCard | null {
  return null
}

export function inspectCore(state: GameState, moduleId: string): InspectCard | null {
  const def = getModule(moduleId)
  if (!def) return null
  const mastery = moduleMasteryRank(state, moduleId)
  const xp = moduleMasteryXp(state, moduleId)
  const need = masteryXpToNext(mastery)
  const instance = resolveCoreInstance(state, moduleId)
  const level = instance ? coreStartingLevel(state, instance.id) : 0
  const previews = moduleStatPreviews(moduleId, level, level < 200, mastery)
  const contribution = coreContributionPct(state, moduleId)
  const nextMs = nextMasteryMilestone(moduleId, mastery)
  const stats: InspectStat[] = [
    { label: 'Role', value: ROLE_LABEL[def.role] ?? def.role },
    { label: 'Core Level', value: String(level) },
    { label: 'Mastery', value: `${mastery} · ${xp} / ${need} XP` },
    { label: 'Upgrade', value: 'Dock · Scrap' },
  ]
  if (contribution != null) stats.push({ label: 'Build', value: `${contribution}% of DPS` })
  if (nextMs) {
    stats.push({
      label: 'Next Mastery',
      value: `M${nextMs.level} · ${nextMs.name} — ${masteryMilestoneEffect(nextMs)}`,
    })
  }
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

  const body = [def.description]
  if (def.weapon) body.push(deliveryLine(def.weapon.delivery))
  body.push(
    'Core Levels use Scrap at Dock and reset on Rebuild. Mastery is shared by identical Cores and survives Rebuild. Relics stay with each physical copy.',
  )
  return {
    title: def.name,
    kicker: ROLE_LABEL[def.role] ?? 'Core',
    stats,
    body,
  }
}

export function inspectFurnaceChannel(state: GameState, id: FurnaceChannelId): InspectCard | null {
  const def = furnaceChannel(id)
  if (!def) return null
  const level = state.furnace.ignited ? state.furnace.channels[id] : 0
  const live = furnaceLevelDef(id, level)
  const stats: InspectStat[] = [
    { label: 'Level', value: level > 0 ? (level === 1 ? 'I' : level === 2 ? 'II' : 'III') : 'Off' },
    { label: 'Seed', value: live ? `+${Math.round(live.effect * 100)}%` : 'Dark' },
    { label: 'Ignite cost', value: `${furnaceChannelCost(level > 0 ? level : 1)} Heat` },
  ]
  return {
    title: def.name,
    kicker: 'Furnace channel',
    stats,
    body: [def.blurb, 'Configure before Ignite. Once Ignited, the Furnace is locked for the rest of the Sortie.'],
  }
}

export function inspectFurnaceOverview(state: GameState): InspectCard {
  const ash = state.resources.choirAsh ?? 0
  const heat = state.resources.heat ?? 0
  return {
    title: 'Furnace',
    kicker: state.furnace.ignited ? 'Locked for this Sortie' : 'Configure → Prime → Ignite',
    stats: [
      { label: 'Ash', value: formatCompact(ash, 1) },
      { label: 'Heat', value: formatCompact(heat, 1) },
      { label: 'Convert', value: `${ASH_PER_HEAT} Ash → 1 Heat` },
      ...FURNACE_CHANNEL_IDS.map((id) => {
        const lv = state.furnace.ignited ? state.furnace.channels[id] : 0
        return { label: furnaceChannel(id).name, value: lv > 0 ? (lv === 1 ? 'I' : lv === 2 ? 'II' : 'III') : 'Off' }
      }),
    ],
    body: [
      'Furnace unlocks at Wave 450. Ash lasts for the Rebuild cycle; Heat lasts only for the current Sortie.',
      'Convert Ash to Heat, configure up to two channels, then Ignite once. There is no passive Heat generation or drain.',
      'Ignite locks the configuration until the Sortie ends. Sortie end clears Heat and the Furnace; Rebuild also clears Ash.',
    ],
  }
}

export function inspectRebuildOverview(state: GameState): InspectCard {
  const best = cycleBestWave(state)
  const rebuilds = state.prestige.prestigeCount
  const estimate = matterGainFor(state)
  return {
    title: 'Rebuild',
    kicker: 'Hangar swap',
    stats: [
      { label: 'Cycle best Wave', value: String(best) },
      { label: 'Rebuilds done', value: String(rebuilds) },
      { label: 'Matter if you swap now', value: String(estimate) },
    ],
    body: [
      'Rebuild swaps the hull and wipes Salvage, Workshop upgrades, and Scrap-funded Core Levels. Foundry recipes, Relics, Research, and Mastery stay.',
      'Matter this swap is about one-tenth of your cycle Best Wave, plus Workshop ranks and Scrap earned this cycle. Unspent Scrap does not count.',
      'Swap when the push stalls and another system cannot break the wall — not every Wave.',
    ],
  }
}

export function inspectFoundryRecipe(state: GameState, id: FoundryRecipeId): InspectCard | null {
  const def = getFoundryRecipe(id)
  if (!def) return null
  const unlocked = isFoundryRecipeUnlocked(state, id)
  const rank = materialMasteryRank(state, id)
  const stock = foundryMaterialCount(state, id)
  const cost = def.costs
  const time = foundryCraftTime(state, id)
  const stats: InspectStat[] = [
    { label: 'Status', value: unlocked ? `M${rank}/M5` : 'Locked' },
    { label: 'Stock', value: formatCompact(Number.isFinite(stock) ? stock : 0) },
  ]
  if (unlocked) {
    stats.push(
      { label: 'Craft', value: formatFoundryCost(cost) },
      { label: 'Time', value: `${formatCompact(time, 1)}s` },
      { label: 'Output', value: '1' },
    )
  } else {
    stats.push({ label: 'Gate', value: foundryRecipeChainLine(def) })
  }
  return {
    title: def.name,
    kicker: 'Foundry recipe',
    stats,
    body: [
      def.blurb,
      foundryHasMaterialChain(def) ? foundryRecipeChainLine(def) : 'Scrap or recovered inputs go in. Stock comes out.',
      'Completed Processing cycles grant Material Mastery XP for this output. Mastery caps at M5.',
      'Materials, Mastery, and infrastructure persist when you Rebuild.',
    ],
  }
}

export function inspectFoundryUpgrade(_state: GameState, _id: string): InspectCard | null {
  return null
}

export function inspectFoundryModule(_state: GameState, _id: string): InspectCard | null {
  return null
}

export function inspectShard(state: GameState, relicId: string): InspectCard | null {
  const instance = getRelicInstance(state, relicId)
  const def = instance ? resolveRelicDescriptor(instance.familyId) : resolveRelicDescriptor(relicId)
  if (!def) return null
  const loc = instance ? relicFitLocation(state, instance.id) : null
  const stats: InspectStat[] = [
    { label: 'Class', value: def.kind === 'behavioural' ? 'Behavioural' : 'Standard' },
    { label: 'Socket', value: relicSocketUiLabel(def) },
    { label: 'Tier', value: instance ? relicTierLabel(instance.tier) : 'I' },
    { label: 'Fitted', value: loc ? loc.coreInstanceId : 'Inventory' },
  ]
  const body = [
    inspectRelicEffectText(def.id),
    'Relics are physical. Fitting is free while Docked and never destroys the item.',
    'A physical Core may fit at most one Behavioural Relic.',
    'Tier upgrades transform this exact item. Relic Tempering / Masterwork Tempering are PR9 Research.',
  ]
  return {
    title: instance ? `${def.name} ${relicTierLabel(instance.tier)}` : def.name,
    kicker: 'Relic',
    stats,
    body,
  }
}

export function inspectReliquarySlot(_state: GameState, _color: string): InspectCard | null {
  return null
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
      { label: 'Next', value: protocolNextRewardText(state, id) },
    ],
    body: [
      def.restriction,
      'Starting this Challenge resets Salvage, run upgrades, and the current Sortie. Core Levels persist until Rebuild.',
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
  const need = next ? hiveResearchNodeDuration(next.node, state) : 0
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
    if (hiveResearchInspectDetail(state)) {
      stats.push({ label: 'Result', value: hiveResearchNodeEffectLine(next.node) })
    }
  }
  return {
    title: def.name,
    kicker: 'Research discipline',
    stats,
    body: [
      def.blurb,
      'One Research project at a time. Branches inside a discipline may reconnect.',
      'The project runs during Sorties, at Dock, and offline. Worker Drones speed it up.',
      'Breakthroughs change a rule — targeting, a processor slot, a Frame, a Relic colour.',
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
  for (const id of state.shipyard.modules) push(inspectCore(state, id))
  push(inspectFurnaceOverview(state))
  for (const id of FURNACE_CHANNEL_IDS) push(inspectFurnaceChannel(state, id))
  for (const p of PROTOCOLS) push(inspectProtocol(state, p.id))
  for (const row of relicState(state).instances) push(inspectShard(state, row.id))
  for (const r of FOUNDRY_RECIPES) push(inspectFoundryRecipe(state, r.id))
  for (const b of HIVE_RESEARCH_BRANCHES) push(inspectResearchBranch(state, b.id))
  return lines
}
