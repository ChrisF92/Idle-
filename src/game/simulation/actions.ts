/** Apply legal gameplay actions. Strategies choose; this module never cheats. */

import type { GameState, NetworkBarId, FoundryRecipeId } from '../types'
import {
  buyFoundryUpgrade,
  buyFurnaceRank,
  buyMatterShop,
  buyNetworkLink,
  buyProcessNode,
  canPrestige,
  convertAshToHeat,
  equipFoundryModule,
  fitModule,
  insertShard,
  performPrestige,
  pickCoreMilestone,
  prestigeGainFor,
  setFoundrySlot,
  setResearchFocus,
  unlockModule,
  upgradeModule,
  assignWorker,
} from '../actions'
import { setCampaign, setDocked } from '../tick'
import {
  MAX_MODULE_LEVEL,
  canBuyMatterShop,
  getMatterShopItem,
  getModule,
  idleWorkers,
  MATTER_SHOP,
  moduleLevel,
  moduleUpgradeCost,
  SHIP_MODULES,
} from '../catalog'
import { pendingMilestone } from '../milestones'
import { computeShipStats } from '../state'
import {
  NETWORK_BARS,
  NETWORK_LINKS,
  canBuyNetworkLink,
  isNetworkBarUnlocked,
  networkLevels,
} from '../network'
import {
  FOUNDRY_MODULES,
  FOUNDRY_RECIPES,
  FOUNDRY_UPGRADES,
  canBuyFoundryUpgrade,
  foundryRecipeLevel,
  foundrySlotCount,
  isFoundryRecipeUnlocked,
} from '../foundry'
import {
  FURNACE_TRACKS,
  canBuyFurnaceRank,
  furnaceRank,
} from '../furnace'
import { PROCESS_NODES, canBuyProcessNode, hasProcess } from '../process'
import { SHARDS, shardOwned, fittedShardId, isReliquarySlotUnlocked } from '../reliquary'
import { careerHighestSector, GUIDE_STEPS, isSystemUnlocked } from '../progression'
import { HIVE_RESEARCH_UNLOCK_SECTOR } from '../hiveResearch'
import type { StrategyContext } from './types'

export function skipGuides(state: GameState): GameState {
  const seen = state.meta.seenOnboarding ?? []
  const needed = GUIDE_STEPS.every((step) => seen.includes(step.id))
  if (needed && (state.meta.starterCombatLesson ?? 0) >= 2) return state
  const next = structuredClone(state)
  next.meta.seenOnboarding = [...new Set([...seen, ...GUIDE_STEPS.map((s) => s.id)])]
  next.meta.starterCombatLesson = 2
  return next
}

export function ensureLaunched(state: GameState, ctx: StrategyContext): GameState {
  if (!state.combat.docked) return state
  const next = setDocked(state, false)
  if (next !== state) {
    ctx.recordMeaningful('Launch')
    ctx.record('launch')
  }
  return next
}

export function ensureAdvance(state: GameState): GameState {
  if (state.combat.campaign) return state
  return setCampaign(state, true)
}

export function maybeHold(state: GameState, hold: boolean): GameState {
  if (state.combat.campaign === !hold) return state
  return setCampaign(state, !hold)
}

function pickMilestoneChoice(moduleId: string, milestoneId: string): string {
  if (moduleId === 'pulse-cannon') {
    if (milestoneId === 'pulse-10') return 'focused'
    if (milestoneId === 'pulse-20') return 'hard-light'
    if (milestoneId === 'pulse-30') return 'overcharge'
    if (milestoneId === 'pulse-40') return 'pierce-pulse'
    return 'foundry-arc'
  }
  if (moduleId === 'plate-layer') {
    if (milestoneId === 'plate-10') return 'bulk'
    return 'capacitor'
  }
  const ms = pendingMilestone(moduleId, 999, {})
  return ms?.choices[0]?.id ?? ''
}

export function resolveMilestones(state: GameState, ctx: StrategyContext): GameState {
  let next = state
  for (const moduleId of next.shipyard.unlockedModules) {
    const level = moduleLevel(next.shipyard.moduleLevels, moduleId)
    const pending = pendingMilestone(moduleId, level, next.shipyard.corePicks?.[moduleId])
    if (!pending) continue
    const choice =
      pending.choices.find((c) => c.id === pickMilestoneChoice(moduleId, pending.id)) ??
      pending.choices[0]
    if (!choice) continue
    const after = pickCoreMilestone(next, moduleId, pending.id, choice.id)
    if (after !== next) {
      ctx.recordMeaningful(`${getModule(moduleId)?.name ?? moduleId} milestone ${choice.name}`)
      next = after
    }
  }
  return next
}

function coreScore(
  state: GameState,
  moduleId: string,
  mode: 'active' | 'optimiser',
  hullPressure: number,
): number {
  const level = moduleLevel(state.shipyard.moduleLevels, moduleId)
  if (level >= MAX_MODULE_LEVEL) return -1
  if (pendingMilestone(moduleId, level, state.shipyard.corePicks?.[moduleId])) return -1
  const cost = moduleUpgradeCost(level, moduleId)
  if (cost > state.resources.salvage || cost <= 0) return -1
  const before = computeShipStats(state)
  const probe = structuredClone(state)
  probe.resources.salvage += cost
  const upgraded = upgradeModule(probe, moduleId)
  const after = computeShipStats(upgraded)
  const mod = getModule(moduleId)
  const dpsGain = Math.max(0, after.damage - before.damage)
  const hullGain = Math.max(0, after.hullMax - before.hullMax)
  const shieldGain = Math.max(0, after.shieldMax - before.shieldMax)
  if (mode === 'optimiser') {
    const survivability = (hullGain + shieldGain * 1.2) * (0.4 + hullPressure)
    return (dpsGain * 1.4 + survivability) / cost
  }
  if (mod?.role === 'defense') {
    return (0.7 + hullPressure * 2) * (1 + shieldGain / Math.max(1, cost))
  }
  return (1.15 - hullPressure * 0.5) * (1 + dpsGain / Math.max(1, cost))
}

export function spendSalvageOnCores(
  state: GameState,
  ctx: StrategyContext,
  mode: 'active' | 'casual' | 'optimiser',
): GameState {
  let next = resolveMilestones(state, ctx)
  let guard = 0
  while (guard++ < (mode === 'casual' ? 4 : 12)) {
    next = resolveMilestones(next, ctx)
    const hullMax = Math.max(1, next.combat.playerHullMax)
    const hullPressure =
      next.combat.consecutiveLosses >= 2
        ? 1
        : 1 - Math.max(0, Math.min(1, next.combat.playerHull / hullMax))
    let bestId: string | null = null
    let bestScore = 0
    for (const id of next.shipyard.unlockedModules) {
      if (!next.shipyard.modules.includes(id) && getModule(id)?.role !== 'weapon') {
        // Only upgrade fitted Cores, plus Pulse even if somehow unfit.
        if (id !== 'pulse-cannon' && id !== 'plate-layer') continue
      }
      const score =
        mode === 'casual'
          ? 1 / Math.max(1, moduleUpgradeCost(moduleLevel(next.shipyard.moduleLevels, id), id))
          : coreScore(next, id, mode === 'optimiser' ? 'optimiser' : 'active', hullPressure)
      if (score > bestScore) {
        bestScore = score
        bestId = id
      }
    }
    if (!bestId || bestScore <= 0) break
    const level = moduleLevel(next.shipyard.moduleLevels, bestId)
    const cost = moduleUpgradeCost(level, bestId)
    const statsBefore = computeShipStats(next)
    const after = upgradeModule(next, bestId)
    if (after === next) break
    const statsAfter = computeShipStats(after)
    const statBefore =
      getModule(bestId)?.role === 'defense' ? statsBefore.shieldMax : statsBefore.damage
    const statAfter =
      getModule(bestId)?.role === 'defense' ? statsAfter.shieldMax : statsAfter.damage
    ctx.recordCorePurchase({
      moduleId: bestId,
      name: getModule(bestId)?.name ?? bestId,
      levelAfter: level + 1,
      cost,
      activeSeconds: ctx.activeSeconds,
      statBefore,
      statAfter,
      marginalPerCost: cost > 0 ? (statAfter - statBefore) / cost : 0,
    })
    if (bestId === 'pulse-cannon' && level === 0) ctx.recordMeaningful('First Pulse upgrade')
    if (bestId === 'plate-layer' && level === 0) ctx.recordMeaningful('First Plate upgrade')
    else ctx.recordMeaningful(`${getModule(bestId)?.name ?? bestId} → L${level + 1}`)
    next = after
  }
  return next
}

const NETWORK_WEIGHTS: Record<NetworkBarId, number> = {
  strike: 4,
  ward: 3,
  yield: 2,
  loom: 2,
  archive: 1,
}

export function rebalanceNetwork(state: GameState, ctx: StrategyContext): GameState {
  const drones = state.base.workerDrones
  if (drones <= 0) return state
  const unlocked = NETWORK_BARS.filter((b) => isNetworkBarUnlocked(state, b.id))
  if (unlocked.length === 0) return state

  const target: Record<string, number> = {}
  let remaining = drones
  const weights = unlocked.map((b) => ({
    id: b.id,
    w: NETWORK_WEIGHTS[b.id] ?? 1,
  }))
  const totalW = weights.reduce((s, r) => s + r.w, 0)
  for (const row of weights) {
    const n = Math.max(0, Math.floor((drones * row.w) / totalW))
    target[row.id] = n
    remaining -= n
  }
  // Prefer Strike leftovers while pushing.
  const dump = unlocked.some((b) => b.id === 'strike') ? 'strike' : unlocked[0]!.id
  target[dump] = (target[dump] ?? 0) + Math.max(0, remaining)

  let already = idleWorkers(state) === 0
  if (already) {
    for (const [id, want] of Object.entries(target)) {
      if ((state.base.assignments[id] ?? 0) !== want) {
        already = false
        break
      }
    }
    for (const [id, have] of Object.entries(state.base.assignments)) {
      if ((target[id] ?? 0) !== have) {
        already = false
        break
      }
    }
  }
  if (already) return state

  let next = state
  // Pull drones off stations / bars that should not keep them.
  for (const [id, have] of Object.entries(next.base.assignments)) {
    const want = target[id] ?? 0
    if (have > want) {
      next = assignWorker(next, id, want - have)
    }
  }
  for (const [id, want] of Object.entries(target)) {
    const have = next.base.assignments[id] ?? 0
    if (want > have && idleWorkers(next) > 0) {
      next = assignWorker(next, id, Math.min(want - have, idleWorkers(next)))
    }
  }
  if (idleWorkers(next) > 0 && isNetworkBarUnlocked(next, 'strike')) {
    next = assignWorker(next, 'strike', idleWorkers(next))
  }
  if (next !== state) ctx.record('network-assign')
  return next
}

export function buyUsefulNetworkLinks(state: GameState, ctx: StrategyContext): GameState {
  let next = state
  for (const def of NETWORK_LINKS) {
    const check = canBuyNetworkLink(next, def.id)
    if (!check.ok) continue
    // Racks first (more drones), then cycle, then acuity.
    const after = buyNetworkLink(next, def.id)
    if (after !== next) {
      ctx.recordMeaningful(`Network Link ${def.name}`)
      next = after
      if (ctx.logging !== 'detailed') break
    }
  }
  return next
}

export function tendFoundry(state: GameState, ctx: StrategyContext): GameState {
  if (careerHighestSector(state) < 2) return state
  let next = state
  const slots = foundrySlotCount(next)
  for (let i = 0; i < slots; i++) {
    const current = next.foundry.slots[i]?.recipeId ?? null
    if (current) continue
    const salvage = next.resources.salvage
    const pulseCost = moduleUpgradeCost(
      moduleLevel(next.shipyard.moduleLevels, 'pulse-cannon'),
      'pulse-cannon',
    )
    // Do not starve Core upgrades — only smelt when salvage is ahead of the next Pulse rank.
    let recipe: FoundryRecipeId | null = isFoundryRecipeUnlocked(next, 'filament') ? 'filament' : null
    if (salvage > pulseCost * 3 && isFoundryRecipeUnlocked(next, 'slag-ingot')) {
      recipe = 'slag-ingot'
    }
    for (const def of FOUNDRY_RECIPES) {
      if (!isFoundryRecipeUnlocked(next, def.id)) continue
      if (foundryRecipeLevel(next, def.id) < 4 && def.costs.materials) continue
      if (def.id === 'slag-ingot' || def.id === 'filament') continue
      if (salvage > pulseCost * 4) recipe = def.id
    }
    if (!recipe) continue
    const after = setFoundrySlot(next, i, recipe)
    if (after !== next) {
      ctx.record(`foundry-slot ${recipe}`)
      next = after
    }
  }

  for (const up of FOUNDRY_UPGRADES) {
    if (!canBuyFoundryUpgrade(next, up.id).ok) continue
    const after = buyFoundryUpgrade(next, up.id)
    if (after !== next) {
      ctx.recordMeaningful(`Foundry ${up.name}`)
      next = after
    }
  }

  if (next.combat.docked) {
    for (const bit of FOUNDRY_MODULES) {
      if (next.foundry.equipped.includes(bit.id)) continue
      const after = equipFoundryModule(next, bit.id)
      if (after !== next) {
        ctx.recordMeaningful(`Fitted ${bit.name}`)
        next = after
        break
      }
    }
  }
  return next
}

export function tendFurnace(state: GameState, ctx: StrategyContext): GameState {
  if (!isSystemUnlocked(state, 'furnace') && careerHighestSector(state) < 5) return state
  let next = convertAshToHeat(state)
  if (next !== state) ctx.record('ash-to-heat')
  const order = ['attack', 'defense', 'workshop', 'lab'] as const
  for (const id of order) {
    if (!canBuyFurnaceRank(next, id).ok) continue
    const after = buyFurnaceRank(next, id)
    if (after !== next) {
      const def = FURNACE_TRACKS.find((t) => t.id === id)
      ctx.recordMeaningful(`Furnace ${def?.name ?? id} ${furnaceRank(after, id)}`)
      next = after
      break
    }
  }
  return next
}

export function tendHiveResearch(state: GameState, ctx: StrategyContext): GameState {
  if (careerHighestSector(state) < HIVE_RESEARCH_UNLOCK_SECTOR) return state
  const salvage = state.resources.salvage
  const pulseCost = moduleUpgradeCost(
    moduleLevel(state.shipyard.moduleLevels, 'pulse-cannon'),
    'pulse-cannon',
  )
  const want = salvage < pulseCost * 2 ? 'material' : 'energy'
  if (state.hiveResearch?.focus === want) return state
  const next = setResearchFocus(state, want)
  if (next !== state) ctx.record(`research-focus ${want}`)
  return next
}

export function tendProcess(state: GameState, ctx: StrategyContext): GameState {
  let next = state
  for (const node of PROCESS_NODES) {
    if (hasProcess(next, node.id)) continue
    if (!canBuyProcessNode(next, node.id).ok) continue
    const after = buyProcessNode(next, node.id)
    if (after !== next) {
      ctx.recordMeaningful(`Process ${node.name}`)
      next = after
    }
  }
  return next
}

export function spendRebuildMatter(state: GameState, ctx: StrategyContext): GameState {
  let next = state
  let guard = 0
  while (guard++ < 8 && next.resources.prestigeMatter > 0) {
    let bestId: string | null = null
    let bestScore = 0
    for (const item of MATTER_SHOP) {
      const check = canBuyMatterShop(next, item.id)
      if (!check.ok || check.cost <= 0) continue
      const def = getMatterShopItem(item.id)
      const dmg = def?.damageBonus ?? 0
      const hull = (def?.hullBonus ?? 0) / 80
      const shield = (def?.shieldBonus ?? 0) / 80
      const prod = (def?.productionBonus ?? 0) * 0.4
      const score = (dmg * 1.6 + hull + shield + prod) / check.cost
      if (score > bestScore) {
        bestScore = score
        bestId = item.id
      }
    }
    if (!bestId) break
    const after = buyMatterShop(next, bestId)
    if (after === next) break
    ctx.recordMeaningful(`Slag Bank ${getMatterShopItem(bestId)?.name ?? bestId}`)
    ctx.attachRebuildPurchase(getMatterShopItem(bestId)?.name ?? bestId)
    next = after
  }
  return next
}

export function tendReliquary(state: GameState, ctx: StrategyContext): GameState {
  if (careerHighestSector(state) < 3) return state
  let next = state
  for (const shard of SHARDS) {
    if (!isReliquarySlotUnlocked(next, shard.color)) continue
    if (fittedShardId(next, shard.color)) continue
    if (shardOwned(next, shard.id) < 1) continue
    const after = insertShard(next, shard.id)
    if (after !== next) {
      ctx.recordMeaningful(`Reliquary ${shard.name}`)
      next = after
    }
  }
  return next
}

export function maybeUnlockAndFit(state: GameState, ctx: StrategyContext): GameState {
  let next = state
  for (const mod of SHIP_MODULES) {
    if (next.shipyard.unlockedModules.includes(mod.id)) {
      if (!next.shipyard.modules.includes(mod.id) && next.combat.docked) {
        const fitted = fitModule(next, mod.id)
        if (fitted !== next) {
          ctx.recordMeaningful(`Fitted ${mod.name}`)
          next = fitted
        }
      }
      continue
    }
    const after = unlockModule(next, mod.id)
    if (after !== next) {
      ctx.recordMeaningful(`Unlocked ${mod.name}`)
      next = after
    }
  }
  return next
}

export function shouldRebuild(state: GameState, ctx: StrategyContext): { yes: boolean; reasons: string[] } {
  if (!canPrestige(state)) return { yes: false, reasons: [] }
  if (
    ctx.lastRebuildActive != null &&
    ctx.activeSeconds - ctx.lastRebuildActive < ctx.config.rebuild.stallSeconds &&
    state.combat.consecutiveLosses < ctx.config.rebuild.consecutiveLosses
  ) {
    return { yes: false, reasons: [] }
  }
  const reasons: string[] = []
  const cfg = ctx.config.rebuild
  const gain = prestigeGainFor(state)
  if (ctx.secondsSinceHighestSectorGain >= cfg.stallSeconds) {
    reasons.push(
      `${Math.round(ctx.secondsSinceHighestSectorGain / 60)} minutes without sector progress`,
    )
  }
  if (state.combat.consecutiveLosses >= cfg.consecutiveLosses) {
    reasons.push(`${state.combat.consecutiveLosses} consecutive hull losses`)
  }
  const median = ctx.recentSectorClearMedian
  if (
    median &&
    median > 0 &&
    ctx.secondsSinceHighestSectorGain >= Math.max(90, median * cfg.ttkSpikeMult)
  ) {
    reasons.push(
      `push stalled ${ctx.secondsSinceHighestSectorGain.toFixed(0)}s vs recent median ${median.toFixed(0)}s`,
    )
  }
  if (gain >= 4 && state.combat.highestSector >= 6 && ctx.secondsSinceHighestSectorGain >= 180) {
    reasons.push(`Rebuild Matter gain: ${gain}`)
  }
  const yes =
    reasons.length >= 1 &&
    gain >= 1 &&
    (ctx.secondsSinceHighestSectorGain >= cfg.stallSeconds ||
      state.combat.consecutiveLosses >= cfg.consecutiveLosses)
  return { yes, reasons }
}

export function doRebuild(state: GameState, ctx: StrategyContext, reasons: string[]): GameState {
  const coresLost: Record<string, number> = { ...state.shipyard.moduleLevels }
  const networkLevelsLost: Record<string, number> = {}
  for (const bar of NETWORK_BARS) {
    networkLevelsLost[bar.id] = networkLevels(state, bar.id)
  }
  const linksKept = { ...(state.network?.links ?? {}) }
  const gain = prestigeGainFor(state)
  const highest = state.combat.highestSector
  const prevPush =
    ctx.lastRebuildActive == null ? ctx.activeSeconds : ctx.activeSeconds - ctx.lastRebuildActive
  const after = performPrestige(state)
  if (after === state) return state
  ctx.recordRebuild({
    index: after.prestige.prestigeCount,
    activeSeconds: ctx.activeSeconds,
    calendarSeconds: ctx.calendarSeconds,
    highestSector: highest,
    matterEarned: gain,
    matterBalanceAfter: after.resources.prestigeMatter,
    reasons,
    coresLost,
    networkLevelsLost,
    linksKept,
    previousPushSeconds: prevPush,
  })
  ctx.recordMeaningful(`Rebuild #${after.prestige.prestigeCount}`)
  return after
}

export function industryPass(
  state: GameState,
  ctx: StrategyContext,
  mode: 'active' | 'casual' | 'optimiser',
): GameState {
  let next = state
  next = maybeUnlockAndFit(next, ctx)
  next = spendSalvageOnCores(next, ctx, mode)
  next = rebalanceNetwork(next, ctx)
  next = buyUsefulNetworkLinks(next, ctx)
  next = tendFoundry(next, ctx)
  next = tendFurnace(next, ctx)
  next = tendHiveResearch(next, ctx)
  next = tendProcess(next, ctx)
  next = tendReliquary(next, ctx)
  next = spendRebuildMatter(next, ctx)
  return next
}
