/** Player-facing inspect cards — live numbers plus copy, no designer jargon. */

import type {
  FoundryRecipeId,
  FurnaceTrackId,
  GameState,
  NetworkBarId,
  NetworkLinkId,
  ReliquaryColor,
} from './types'
import {
  MAX_MODULE_LEVEL,
  droneCap,
  dronePower,
  getModule,
  moduleLevel,
  moduleMasteryRank,
  moduleStatPreviews,
  moduleUpgradeCost,
} from './catalog'
import { formatCompact } from './format'
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
  networkFillRate,
  networkLevels,
  networkLinkCost,
  networkLinkEffectLabel,
  networkLinkPower,
  networkLinkRank,
  networkProgress,
  networkSecondsToLevel,
} from './network'
import {
  ASH_PER_HEAT,
  FURNACE_MAX_RANK,
  FURNACE_TRACKS,
  canBuyFurnaceRank,
  furnaceRank,
  furnaceRankCost,
  getFurnaceTrack,
} from './furnace'
import {
  FOUNDRY_MODULE_SLOTS,
  craftsForNextLevel,
  formatFoundryCost,
  foundryCraftTime,
  foundryMaterialCount,
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
import { milestonesFor, pendingMilestone } from './milestones'
import {
  RELIQUARY_RESONANCE_NEED,
  RELIQUARY_SLOTS,
  fittedShardId,
  getShard,
  isReliquarySlotUnlocked,
  shardEffectBlurb,
  shardEffectScale,
  shardOwned,
  shardResonance,
} from './reliquary'

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
    kicker: 'Corps',
    stats: [
      { label: 'Corps', value: `${state.base.workerDrones}/${cap}` },
      { label: 'Idle', value: String(idle) },
      { label: 'Link power', value: formatCompact(networkLinkPower(state), 2) },
      { label: 'Efficiency', value: `×${dronePower(state).toFixed(2)}` },
      { label: 'Cycle speed', value: `×${networkCycleMult(state).toFixed(2)}` },
    ],
    body: [
      'Drones fill bars. Bars buff the ship. Drones never fly on Sortie and they never shoot.',
      'Link power is assigned drones times efficiency. More Link power fills every assigned bar faster.',
      'Corps racks raise how many hulls you may hang. Drone acuity makes each hull count for more. Cycle speed turns the clock up.',
      'Bar levels reset on Rebuild. The corps and Link ranks stay.',
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
    { label: 'Status', value: open ? `Level ${levels}` : `Opens after sector ${def.requiresSectorEver}` },
  ]
  if (open) {
    stats.push(
      { label: 'Assigned', value: String(assigned) },
      { label: 'Cycle', value: `${Math.round(fill * 100)}%` },
      { label: 'Fill rate', value: rate > 0 ? `${rate.toFixed(2)}/s` : 'Idle' },
      { label: 'Next level', value: formatEta(eta) },
      { label: 'Now', value: networkEffectLabel(state, id) },
      { label: 'Link power', value: formatCompact(networkLinkPower(state), 2) },
    )
  }
  return {
    title: def.name,
    kicker: 'Network bar',
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
    stats.push({ label: 'Corps cap', value: String(droneCap(state)) })
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
  const level = moduleLevel(state.shipyard.moduleLevels, moduleId)
  const mastery = moduleMasteryRank(state, moduleId)
  const maxed = level >= MAX_MODULE_LEVEL
  const cost = moduleUpgradeCost(level, moduleId)
  const previews = moduleStatPreviews(moduleId, level, !maxed, mastery)
  const picks = state.shipyard.corePicks?.[moduleId]
  const pending = pendingMilestone(moduleId, level, picks)
  const milestones = milestonesFor(moduleId)
  const stats: InspectStat[] = [
    { label: 'Role', value: ROLE_LABEL[def.role] ?? def.role },
    { label: 'Level', value: maxed ? `${level} · max` : `${level}/${MAX_MODULE_LEVEL}` },
    { label: 'Salvage', value: formatCompact(state.resources.salvage) },
  ]
  if (!maxed) stats.push({ label: 'Next level', value: `${formatCompact(cost)} salvage` })
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
      return choice ? `Lv ${ms.level}: ${choice.name}` : null
    })
    .filter((line): line is string => Boolean(line))
  if (taken.length > 0) stats.push({ label: 'Milestones', value: taken.join(' · ') })
  if (pending) {
    stats.push({
      label: 'Choose',
      value: pending.choices.map((c) => c.name).join(' or '),
    })
  } else {
    const nextMs = milestones.find((ms) => level < ms.level && !picks?.[ms.id])
    if (nextMs) stats.push({ label: 'Next node', value: `Level ${nextMs.level}` })
  }

  const body = [def.description]
  if (def.weapon) body.push(deliveryLine(def.weapon.delivery))
  body.push(
    'Spend Salvage during a sortie to level this Core. Levels persist until Rebuild, including across hull loss. Rebuild wipes them so you can swap the loadout.',
  )
  if (milestones.length > 0) {
    body.push('Every ten levels you pick one of two nodes. Those picks wipe with the Core on Rebuild.')
  }
  return {
    title: def.name,
    kicker: ROLE_LABEL[def.role] ?? 'Core',
    stats,
    body,
  }
}

export function inspectFurnaceTrack(state: GameState, id: FurnaceTrackId): InspectCard | null {
  const def = getFurnaceTrack(id)
  if (!def) return null
  const rank = furnaceRank(state, id)
  const cost = furnaceRankCost(rank)
  const can = canBuyFurnaceRank(state, id)
  const per =
    def.damage ?? def.shield ?? def.researchXp ?? def.foundrySpeed ?? def.salvage ?? 0
  const now = per * rank
  const next = per * Math.min(FURNACE_MAX_RANK, rank + 1)
  const unit = def.damage
    ? 'damage'
    : def.shield
      ? 'shield'
      : def.researchXp
        ? 'Research XP'
        : def.salvage
          ? 'salvage'
          : 'craft speed'
  const stats: InspectStat[] = [
    { label: 'Rank', value: `${rank}/${FURNACE_MAX_RANK}` },
    { label: 'Now', value: `+${pct(now)} ${unit}` },
  ]
  if (rank < FURNACE_MAX_RANK) {
    stats.push({ label: 'Next rank', value: `+${pct(next)} ${unit}` })
    stats.push({
      label: 'Cost',
      value: can.ok ? `${cost} Heat` : (can.reason ?? `${cost} Heat`),
    })
  }
  stats.push(
    { label: 'Choir-ash', value: formatCompact(state.resources.choirAsh ?? 0, 1) },
    { label: 'Heat', value: formatCompact(state.resources.heat ?? 0, 1) },
    { label: 'Bank', value: `${ASH_PER_HEAT} ash → 1 Heat` },
  )
  return {
    title: def.name,
    kicker: 'Furnace rank',
    stats,
    body: [...def.detail],
  }
}

export function inspectFurnaceOverview(state: GameState): InspectCard {
  const ash = state.resources.choirAsh ?? 0
  const heat = state.resources.heat ?? 0
  const batches = Math.floor(ash / ASH_PER_HEAT)
  return {
    title: 'Furnace',
    kicker: 'Heat',
    stats: [
      { label: 'Choir-ash', value: formatCompact(ash, 1) },
      { label: 'Heat', value: formatCompact(heat, 1) },
      { label: 'Ready to bank', value: batches > 0 ? `${batches} Heat` : 'Need more ash' },
      ...FURNACE_TRACKS.map((track) => ({
        label: track.name,
        value: `Lv ${furnaceRank(state, track.id)}`,
      })),
    ],
    body: [
      'Kills drop Choir-ash on their own after sector 5. Bank ash into Heat, then buy always-on ranks.',
      'Attack and Defense buff the ship. Lab writes Research faster. Workshop speeds the Foundry. Hold marks wrecks for Salvage.',
      'Ranks, Heat, and leftover ash persist when you Rebuild. Flares collect themselves — do not tap looking for scraps.',
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
  const need = craftsForNextLevel(level)
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
      { label: 'To next level', value: `${xp}/${need} crafts` },
    )
  }
  if (!unlocked) stats.push({ label: 'Gate', value: foundryRecipeGateLine(def) })
  else if (def.unlocksRecipe) {
    const child = getFoundryRecipe(def.unlocksRecipe.recipeId)?.name ?? def.unlocksRecipe.recipeId
    stats.push({ label: 'Unlocks', value: `${child} at level ${def.unlocksRecipe.atLevel}` })
  }
  const body = [
    def.blurb,
    'Smelters run while you fly or sit docked. Queue a recipe on an idle slot.',
    'Recipe levels, stock, and Foundry Points persist when you Rebuild. Fitted bits come off.',
  ]
  if (def.requiresSectorEver > 2) {
    body.push(`This recipe opens after you clear sector ${def.requiresSectorEver}.`)
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
  if (rank < def.maxRank) stats.push({ label: 'Next', value: `${cost} FP` })
  return {
    title: def.name,
    kicker: 'Foundry rank',
    stats,
    body: [
      def.blurb,
      'Foundry Points come from finishing crafts. These ranks persist when you Rebuild.',
      def.extraSlots
        ? 'Extra smelters let you run more recipes at once. Four slots is the cap.'
        : 'Ranks stack. Strike and Ward here sit on top of Network bars and Cores.',
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
    { label: 'Fit slots', value: `${state.foundry.equipped.length}/${FOUNDRY_MODULE_SLOTS}` },
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
      'Print the bit from stock, then fit it while docked. Two bits at a time.',
      'Fitted bits come off on Rebuild. Recipe levels stay, so you can print them again.',
    ],
  }
}

export function inspectShard(state: GameState, shardId: string): InspectCard | null {
  const def = getShard(shardId)
  if (!def) return null
  const slot = RELIQUARY_SLOTS.find((s) => s.color === def.color)
  const owned = shardOwned(state, shardId)
  const fitted = fittedShardId(state, def.color) === shardId
  const extra = Math.max(0, owned - (fitted ? 1 : 0))
  const res = fitted ? shardResonance(state, shardId) : extra / RELIQUARY_RESONANCE_NEED
  const scale = fitted ? shardEffectScale(state, shardId) : 0
  const stats: InspectStat[] = [
    { label: 'Colour', value: slot?.name ?? def.color },
    { label: 'Owned', value: String(owned) },
    { label: 'Fitted', value: fitted ? 'Yes' : 'No' },
    {
      label: 'Resonance',
      value: fitted
        ? `${Math.round(res * 100)}% · ${extra}/${RELIQUARY_RESONANCE_NEED} extra`
        : `${extra}/${RELIQUARY_RESONANCE_NEED} extra when fitted`,
    },
  ]
  if (fitted) stats.push({ label: 'Effect', value: `×${formatCompact(scale, 2)} · ${shardEffectBlurb(def)}` })
  else stats.push({ label: 'Effect', value: shardEffectBlurb(def) })
  const body = [
    def.blurb,
    'One shard per colour. Extra copies of the fitted shard charge resonance and raise the same bonus.',
    'Shards persist when you Rebuild. They drop from kills after the Reliquary opens at sector 3.',
  ]
  if ((def.requiresSectorEver ?? 0) > 0) {
    body.push(`This chip waits until you have cleared sector ${def.requiresSectorEver}.`)
  }
  return {
    title: def.name,
    kicker: 'Reliquary shard',
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
        value: open ? 'Empty' : `Opens after sector ${slot.requiresSectorEver}`,
      },
    ],
    body: [
      'Fit one shard of this colour. Extra copies of that shard charge resonance.',
      'Shards persist when you Rebuild.',
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
  for (const bar of NETWORK_BARS) push(inspectNetworkBar(state, bar.id))
  for (const link of NETWORK_LINKS) push(inspectNetworkLink(state, link.id))
  for (const id of state.shipyard.modules) push(inspectCore(state, id))
  push(inspectFurnaceOverview(state))
  for (const track of FURNACE_TRACKS) push(inspectFurnaceTrack(state, track.id))
  return lines
}
