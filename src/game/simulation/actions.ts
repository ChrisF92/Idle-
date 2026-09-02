/** Apply legal gameplay actions. Strategies choose; this module never cheats. */

import type {
  FabJobKind,
  FurnaceChannelId,
  FurnaceChannelLevel,
  GameState,
  FoundryRecipeId,
  HiveResearchBranch,
} from '../types'
import {
  buyMatterShop,
  buyNetworkLink,
  buyProcessNode,
  fitModule,
  performPrestige,
  setFoundrySlot,
  setResearchFocus,
  unlockModule,
  assignWorker,
  enterChallenge,
  buyWorkshopUpgrade,
  buyRunUpgrade,
  buyCoreStartingLevel,
  selectFrame,
  setCoreTargetingDoctrine,
  unequipAllModules,
  convertAshToHeat,
  igniteFurnace,
  equipRelicOnCore,
} from '../actions'
import { canRebuild, cycleBestWave, matterGainFor } from '../rebuild'
import { setDocked, chooseDirective } from '../tick'
import {
  canBuyMatterShop,
  getFrame,
  getMatterShopItem,
  getModule,
  idleWorkers,
  isStationUnlocked,
  MATTER_SHOP,
  SHIP_MODULES,
  visibleWorkerJobIds,
  droneCap,
} from '../catalog'
import {
  coreStartingLevel,
  equippedCoreSlots,
} from '../coreProgression'
import {
  NETWORK_BARS,
  NETWORK_LINKS,
  canBuyNetworkLink,
  networkLevels,
} from '../network'
import {
  FOUNDRY_FACILITIES,
  canStartFabrication,
  foundryFacilityCommitted,
  foundrySlotCount,
  isFoundryRecipeUnlocked,
  materialMasteryRank,
  startFabrication,
} from '../foundry'
import { PROCESS_NODES, canBuyProcessNode, hasProcess } from '../process'
import { GUIDE_STEPS, isSystemUnlocked } from '../progression'
import { ACT1_CADENCE } from '../cadence'
import { careerBestWave } from '../waves'
import { workerJobCap } from '../workers'
import { CHALLENGES, CHALLENGE_MAX_MEDAL, canEnterChallenge, challengeMedalRank } from '../challenges'
import type { SimulationSpendProfile, StrategyContext } from './types'
import { getAct1BuildProfile } from './buildProfiles'
import { isRelicFitted, relicInstancesOfFamily } from '../relics'
import {
  RUN_UPGRADES,
  nextRunUpgradeCost,
  visibleRunUpgrades,
  workshopLevel,
  type RunUpgradeId,
} from '../workshop'

export function resolveSpendProfile(mode: string): SimulationSpendProfile {
  if (mode === 'casual') return 'casual'
  if (mode === 'offensive') return 'offensive'
  if (mode === 'defensive') return 'defensive'
  if (mode === 'economy-first') return 'economy-first'
  if (mode === 'optimiser') return 'optimiser'
  return 'balanced'
}

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

export function maybeChooseDirective(state: GameState, ctx: StrategyContext): GameState {
  const offer = state.combat.directiveOffer
  if (!offer || offer.length === 0) return state
  const prefer = ['overcharge', 'reactive', 'pack-hunter', 'burn-hot', 'scavenger']
  const id = prefer.find((p) => offer.includes(p)) ?? offer[0]!
  const next = chooseDirective(state, id)
  if (next !== state) ctx.recordMeaningful(`Directive ${id}`)
  return next
}

export function resolveMilestones(state: GameState, _ctx: StrategyContext): GameState {
  return state
}

const WORKER_WEIGHTS: Record<string, number> = {
  'scrap-field': 4,
  'sensor-net': 2,
  'alloy-foundry': 3,
  'drone-fab': 3,
  'fab-bay': 2,
  construction: 1,
}

export function rebalanceNetwork(
  state: GameState,
  ctx: StrategyContext,
  mode: SimulationSpendProfile | 'active' | 'casual' | 'optimiser' = 'balanced',
): GameState {
  const profile = resolveSpendProfile(mode)
  const drones = state.base.workerDrones
  if (drones <= 0) return state
  const unlocked = visibleWorkerJobIds(state)
  if (unlocked.length === 0) {
    if (isStationUnlocked(state, 'scrap-field')) {
      if (idleWorkers(state) > 0) {
        const next = assignUpToJobCap(state, 'scrap-field', idleWorkers(state))
        if (next !== state) ctx.record('network-assign')
        return next
      }
    }
    return state
  }

  const bias = { ...WORKER_WEIGHTS }
  if (profile === 'economy-first') bias['scrap-field'] = 7
  if (profile === 'defensive') bias['alloy-foundry'] = 4
  if (profile === 'offensive') bias['drone-fab'] = 5
  if (unlocked.includes('drone-fab')) bias['drone-fab'] = Math.max(bias['drone-fab'] ?? 3, 4)

  const target: Record<string, number> = {}
  let remaining = drones
  const weights = unlocked.map((id) => ({
    id,
    w: bias[id] ?? 1,
  }))
  const totalW = weights.reduce((s, r) => s + r.w, 0) || 1
  for (const row of weights) {
    const cap = workerJobCap(row.id).hard
    const n = Math.max(0, Math.min(cap, Math.floor((drones * row.w) / totalW)))
    target[row.id] = n
    remaining -= n
  }
  if (unlocked.includes('drone-fab')) {
    const minFab = Math.min(workerJobCap('drone-fab').min, remaining + (target['drone-fab'] ?? 0), drones)
    if ((target['drone-fab'] ?? 0) < minFab) {
      const add = minFab - (target['drone-fab'] ?? 0)
      const cap = workerJobCap('drone-fab').hard
      const room = Math.max(0, cap - (target['drone-fab'] ?? 0))
      const n = Math.min(add, room)
      target['drone-fab'] = (target['drone-fab'] ?? 0) + n
      remaining -= n
    }
  }
  for (const row of [...weights].sort((a, b) => b.w - a.w)) {
    if (remaining <= 0) break
    const cap = workerJobCap(row.id).hard
    const room = Math.max(0, cap - (target[row.id] ?? 0))
    const add = Math.min(room, remaining)
    if (add <= 0) continue
    target[row.id] = (target[row.id] ?? 0) + add
    remaining -= add
  }

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
  for (const [id, have] of Object.entries(next.base.assignments)) {
    const want = target[id] ?? 0
    if (have > want) {
      next = assignWorker(next, id, want - have)
    }
  }
  for (const [id, want] of Object.entries(target)) {
    const have = next.base.assignments[id] ?? 0
    if (want > have && idleWorkers(next) > 0) {
      next = assignUpToJobCap(next, id, want - have)
    }
  }
  for (const id of unlocked) {
    if (idleWorkers(next) <= 0) break
    next = assignUpToJobCap(next, id, idleWorkers(next))
  }
  if (next !== state) ctx.record('network-assign')
  return next
}

function assignUpToJobCap(state: GameState, jobId: string, delta: number): GameState {
  const cap = workerJobCap(jobId).hard
  const have = state.base.assignments[jobId] ?? 0
  const n = Math.min(Math.max(0, delta), idleWorkers(state), Math.max(0, cap - have))
  if (n <= 0) return state
  return assignWorker(state, jobId, n)
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
  if (!isSystemUnlocked(state, 'foundry')) return state
  let next = state
  const slots = foundrySlotCount(next)
  for (let i = 0; i < slots; i++) {
    const current = next.foundry.slots[i]?.recipeId ?? null
    const progress = next.foundry.slots[i]?.progress ?? 0
    const recipe = pickProcessingRecipe(next)
    if (!recipe) continue
    if (current === recipe) continue
    const currentStock = current ? foundryStock(next, current) : 0
    const canSwitch = !current || progress < 0.05 || currentStock >= 8
    if (!canSwitch) continue
    const after = setFoundrySlot(next, i, recipe)
    if (after !== next) {
      ctx.record(`foundry-slot ${recipe}`)
      next = after
    }
  }

  return next
}

function foundryStock(state: GameState, id: FoundryRecipeId): number {
  return Math.max(0, Math.floor(state.foundry.materials?.[id] ?? 0))
}

/** Player-like: stock the Fabricator chain after W90, otherwise keep Recovered Stock running. */
function pickProcessingRecipe(state: GameState): FoundryRecipeId | null {
  const stockOn = isFoundryRecipeUnlocked(state, 'recovered-stock')
  const filOn = isFoundryRecipeUnlocked(state, 'conductive-filament')
  const temperOn = isFoundryRecipeUnlocked(state, 'tempered-alloy')
  if (!stockOn && !filOn && !temperOn) return null
  const stock = foundryStock(state, 'recovered-stock')
  const filament = foundryStock(state, 'conductive-filament')
  const temper = foundryStock(state, 'tempered-alloy')
  const fabDone = foundryFacilityCommitted(state, 'worker-fabricator') > 0
  const wantFab = !fabDone && careerBestWave(state) >= ACT1_CADENCE.foundry
  if (wantFab) {
    if (temperOn && temper < 8 && stock >= 2) return 'tempered-alloy'
    if (filOn && filament < 6) return 'conductive-filament'
    if (stockOn && stock < 12 + Math.max(0, 8 - temper) * 2) return 'recovered-stock'
  }
  const processing: FoundryRecipeId[] = [
    'recovered-stock',
    'conductive-filament',
    'tempered-alloy',
    'ballistic-composite',
    'optical-glass',
  ]
  const unlocked = processing.filter((id) => isFoundryRecipeUnlocked(state, id))
  if (!unlocked.length) {
    if (stockOn) return 'recovered-stock'
    if (filOn) return 'conductive-filament'
    return temperOn ? 'tempered-alloy' : null
  }
  const belowSoft = unlocked.filter((id) => materialMasteryRank(state, id) < 3)
  const belowHard = unlocked.filter((id) => materialMasteryRank(state, id) < 5)
  const pool = belowSoft.length ? belowSoft : belowHard
  if (!pool.length) {
    unlocked.sort((a, b) => foundryStock(state, a) - foundryStock(state, b))
    return unlocked[0] ?? null
  }
  pool.sort((a, b) => materialMasteryRank(state, a) - materialMasteryRank(state, b))
  return pool[0]!
}

export function tendFurnace(state: GameState, ctx: StrategyContext): GameState {
  if (!isSystemUnlocked(state, 'furnace') || state.combat.docked || !state.combat.inFight) return state
  if (state.furnace.ignited) return state
  const profile = getAct1BuildProfile(ctx.config.buildProfile)
  const configured: Partial<Record<FurnaceChannelId, FurnaceChannelLevel>> =
    profile.id === 'defensive-sustain'
      ? { bulwark: 1, guidance: 1 }
      : profile.id === 'economy-farm'
        ? { harvest: 1, overdrive: 1 }
        : profile.id === 'boss-killer' || profile.id === 'shield-breaker'
          ? { overdrive: 1, guidance: 1 }
          : { overdrive: 1, bulwark: 1 }
  let next = convertAshToHeat(state)
  const ignited = igniteFurnace(next, configured)
  if (ignited !== next) {
    ctx.recordMeaningful(`Furnace ${Object.keys(configured).join(' + ')}`)
    next = ignited
  }
  return next
}

export function tendHiveResearch(
  state: GameState,
  ctx: StrategyContext,
  mode: SimulationSpendProfile | 'active' | 'casual' | 'optimiser' = 'balanced',
): GameState {
  if (!isSystemUnlocked(state, 'research')) return state
  const profile = resolveSpendProfile(mode)
  const salvage = state.resources.salvage
  const pulseCost = 12
  if (state.hiveResearch?.active) return state
  const completed = state.hiveResearch?.completed
  const priorities: Record<SimulationSpendProfile, HiveResearchBranch[]> = {
    casual: ['energy', 'material', 'observation', 'computation'],
    balanced: ['material', 'energy', 'observation', 'computation'],
    offensive: ['energy', 'observation', 'computation', 'material'],
    defensive: ['energy', 'material', 'observation', 'computation'],
    'economy-first': ['material', 'computation', 'observation', 'energy'],
    optimiser: ['computation', 'material', 'energy', 'observation'],
  }
  const order = salvage < pulseCost * 2
    ? (['material', ...priorities[profile].filter((id) => id !== 'material')] as HiveResearchBranch[])
    : priorities[profile]
  const want = [...order].sort((a, b) =>
    (completed?.[a] ?? 0) - (completed?.[b] ?? 0) || order.indexOf(a) - order.indexOf(b),
  )[0]!
  if (state.hiveResearch?.focus === want && state.hiveResearch.active) return state
  const next = setResearchFocus(state, want)
  if (next !== state) ctx.record(`research-focus ${want}`)
  return next
}

export function tendProcess(state: GameState, ctx: StrategyContext): GameState {
  if (!isSystemUnlocked(state, 'process')) return state
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

const MATTER_BUY_PRIORITY: Record<string, number> = {
  'time-compression-1': 20,
  'time-compression-2': 18,
  'time-compression-3': 16,
  'weapon-calibration': 14,
  'traverse-actuators': 11,
  'structural-memory': 10,
  'field-memory': 10,
  'recovery-charter': 8,
  'foundry-throughput': 7,
  'reconstitution-cache': 6,
  'sortie-provisioning': 6,
  'worker-racks': 5,
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
      const score = (MATTER_BUY_PRIORITY[item.id] ?? 1) / check.cost
      if (score > bestScore) {
        bestScore = score
        bestId = item.id
      }
    }
    if (!bestId) break
    const after = buyMatterShop(next, bestId)
    if (after === next) break
    ctx.recordMeaningful(`Matter ${getMatterShopItem(bestId)?.name ?? bestId}`)
    ctx.attachRebuildPurchase(getMatterShopItem(bestId)?.name ?? bestId)
    next = after
  }
  return next
}

export function tendReliquary(state: GameState, _ctx: StrategyContext): GameState {
  return state
}

export function maybeUnlockAndFit(state: GameState, ctx: StrategyContext): GameState {
  let next = state
  for (const mod of SHIP_MODULES) {
    if (next.shipyard.unlockedModules.includes(mod.id)) continue
    const after = unlockModule(next, mod.id)
    if (after !== next) {
      ctx.recordMeaningful(`Unlocked ${mod.name}`)
      next = after
    }
  }
  if (!next.combat.docked) return next

  const profile = getAct1BuildProfile(ctx.config.buildProfile)
  if (next.shipyard.unlockedFrames.includes(profile.frameId) && next.shipyard.frameId !== profile.frameId) {
    const framed = selectFrame(next, profile.frameId)
    if (framed !== next) {
      ctx.recordMeaningful(`Frame ${getFrame(profile.frameId)?.name ?? profile.frameId}`)
      next = framed
    }
  }

  const desired = profile.coreIds.filter((id) => next.shipyard.unlockedModules.includes(id))
  const alreadyProfiled = next.shipyard.modules.length === desired.length &&
    next.shipyard.modules.every((id, index) => id === desired[index])
  if (!alreadyProfiled && desired.length > 0) {
    next = unequipAllModules(next)
    for (const id of desired) {
      const fitted = fitModule(next, id)
      if (fitted === next) continue
      next = fitted
      ctx.recordMeaningful(`Fitted ${getModule(id)?.name ?? id} · ${profile.label}`)
    }
  }
  for (const coreInstanceId of next.shipyard.equippedCoreIds ?? []) {
    for (const doctrine of profile.doctrines) {
      const configured = setCoreTargetingDoctrine(next, coreInstanceId, doctrine)
      if (configured === next) continue
      next = configured
      ctx.recordMeaningful(`Doctrine ${doctrine} · ${coreInstanceId}`)
      break
    }
  }
  for (const familyId of profile.relicFamilyIds) {
    const relic = relicInstancesOfFamily(next, familyId).find((row) => !isRelicFitted(next, row.id))
    if (!relic) continue
    for (const coreInstanceId of next.shipyard.equippedCoreIds ?? []) {
      const fitted = equipRelicOnCore(next, coreInstanceId, relic.id)
      if (fitted === next) continue
      next = fitted
      ctx.recordMeaningful(`Relic ${familyId} · ${coreInstanceId}`)
      break
    }
  }
  return next
}

function queuedFabrication(state: GameState, kind: FabJobKind, jobId: string): number {
  return (state.foundry.fabrication ?? []).filter(
    (slot) => slot.kind === kind && slot.jobId === jobId,
  ).length
}

/** Queue legal physical pieces needed by the selected acceptance profile. */
export function tendProfileFabrication(state: GameState, ctx: StrategyContext): GameState {
  if (!isSystemUnlocked(state, 'foundry')) return state
  if (foundryFacilityCommitted(state, 'worker-fabricator') === 0) return state
  const profile = getAct1BuildProfile(ctx.config.buildProfile)
  const tryStart = (kind: FabJobKind, id: string, label: string) => {
    if (!canStartFabrication(state, kind, id).ok) return state
    const after = startFabrication(state, kind, id)
    if (after !== state) ctx.recordMeaningful(label)
    return after
  }

  if (state.base.workerDrones < Math.min(6, droneCap(state))) {
    const worker = tryStart('worker', 'worker', 'Foundry Worker Drone')
    if (worker !== state) return worker
  }
  if (!state.shipyard.unlockedFrames.includes(profile.frameId) && queuedFabrication(state, 'frame', profile.frameId) === 0) {
    const frame = tryStart('frame', profile.frameId, `Fabricate Frame ${profile.frameId}`)
    if (frame !== state) return frame
  }
  const desiredCoreCounts = new Map<string, number>()
  for (const id of profile.coreIds) desiredCoreCounts.set(id, (desiredCoreCounts.get(id) ?? 0) + 1)
  for (const [id, wanted] of desiredCoreCounts) {
    const owned = (state.shipyard.coreInstances ?? []).filter((row) => row.moduleId === id).length
    if (owned + queuedFabrication(state, 'core', id) >= wanted) continue
    const core = tryStart('core', id, `Fabricate Core ${id}`)
    if (core !== state) return core
  }
  for (const id of profile.relicFamilyIds) {
    if (relicInstancesOfFamily(state, id).length + queuedFabrication(state, 'relic', id) > 0) continue
    const relic = tryStart('relic', id, `Fabricate Relic ${id}`)
    if (relic !== state) return relic
  }
  if (state.base.workerDrones < droneCap(state)) {
    return tryStart('worker', 'worker', 'Foundry Worker Drone')
  }
  return state
}

export function shouldRebuild(state: GameState, ctx: StrategyContext): { yes: boolean; reasons: string[] } {
  if (!canRebuild(state)) return { yes: false, reasons: [] }
  if (ctx.previousHighestAtRebuild > 0 && cycleBestWave(state) < ctx.previousHighestAtRebuild) {
    return { yes: false, reasons: [] }
  }
  const cfg = ctx.config.rebuild
  const stallNeed =
    (state.prestige.prestigeCount ?? 0) < 1
      ? cfg.stallSeconds
      : Math.max(cfg.stallSeconds * 3, 18 * 60)
  if (
    ctx.lastRebuildActive != null &&
    ctx.activeSeconds - ctx.lastRebuildActive < stallNeed &&
    state.combat.consecutiveLosses < ctx.config.rebuild.consecutiveLosses
  ) {
    return { yes: false, reasons: [] }
  }
  const reasons: string[] = []
  const gain = matterGainFor(state)
  if (state.prestige.prestigeCount > 0) {
    const projected = structuredClone(state)
    projected.resources.prestigeMatter += gain
    const usefulPurchase = MATTER_SHOP.some((item) => canBuyMatterShop(projected, item.id).ok)
    if (!usefulPurchase) return { yes: false, reasons: [] }
  }
  if (ctx.secondsSinceHighestSectorGain >= stallNeed) {
    reasons.push(
      `${Math.round(ctx.secondsSinceHighestSectorGain / 60)} minutes without Wave progress`,
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
  if (gain >= 4 && careerBestWave(state) >= ACT1_CADENCE.foundry && ctx.secondsSinceHighestSectorGain >= 180) {
    reasons.push(`Rebuild Matter gain: ${gain}`)
  }
  const yes =
    reasons.length >= 1 &&
    gain >= 1 &&
    (ctx.secondsSinceHighestSectorGain >= stallNeed ||
      state.combat.consecutiveLosses >= cfg.consecutiveLosses)
  return { yes, reasons }
}

export function doRebuild(state: GameState, ctx: StrategyContext, reasons: string[]): GameState {
  const coresLost: Record<string, number> = {}
  for (const slot of equippedCoreSlots(state)) {
    const level = coreStartingLevel(state, slot.coreInstanceId)
    coresLost[slot.moduleId] = Math.max(coresLost[slot.moduleId] ?? 0, level)
  }
  const workshopLost = { ...(state.workshop?.levels ?? {}) }
  const networkLevelsLost: Record<string, number> = {}
  for (const bar of NETWORK_BARS) {
    networkLevelsLost[bar.id] = networkLevels(state, bar.id)
  }
  const linksKept = { ...(state.network?.links ?? {}) }
  const gain = matterGainFor(state)
  const highest = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0)
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
    workshopLost,
    networkLevelsLost,
    linksKept,
    previousPushSeconds: prevPush,
  })
  ctx.recordMeaningful(`Rebuild #${after.prestige.prestigeCount}`)
  return after
}

export function tendChallenges(state: GameState, ctx: StrategyContext, completeCatalogue = false): GameState {
  if (!state.combat.docked) return state
  if (state.challenges?.activeId) return state
  const profile = getAct1BuildProfile(ctx.config.buildProfile)
  const wantedRewards = new Set([
    profile.frameId,
    ...profile.coreIds,
    ...profile.relicFamilyIds,
  ])
  const pick = CHALLENGES.find((challenge) =>
    canEnterChallenge(state, challenge.id).ok &&
    careerBestWave(state) >= challenge.targetWave &&
    challengeMedalRank(state, challenge.id) < (completeCatalogue ? CHALLENGE_MAX_MEDAL : 1) &&
    (completeCatalogue || challenge.uniqueRewards.some((reward) => wantedRewards.has(reward.id)))
  )
  if (!pick) return state
  const after = enterChallenge(state, pick.id)
  if (after !== state) ctx.recordMeaningful(`Challenge ${pick.name}`)
  return after
}

function shopOrderFor(profile: SimulationSpendProfile, preferDefense: boolean): RunUpgradeId[] {
  if (profile === 'casual') {
    return preferDefense ? ['hull', 'weapon-power'] : ['weapon-power', 'hull']
  }
  if (profile === 'offensive') {
    return ['weapon-power', 'cycle-rate', 'crit-chance', 'armor-pen', 'hull', 'shield']
  }
  if (profile === 'defensive') {
    return ['hull', 'shield', 'shield-regen', 'armor', 'weapon-power']
  }
  if (profile === 'economy-first') {
    return ['salvage-kill', 'scrap-kill', 'ash-recovery', 'salvage-wave', 'fragment-find', 'weapon-power', 'hull']
  }
  if (profile === 'optimiser') {
    return preferDefense
      ? ['hull', 'weapon-power', 'cycle-rate', 'salvage-kill', 'shield']
      : ['weapon-power', 'cycle-rate', 'hull', 'salvage-kill', 'shield']
  }
  return preferDefense
    ? ['hull', 'shield', 'weapon-power', 'cycle-rate', 'salvage-kill']
    : ['weapon-power', 'hull', 'cycle-rate', 'shield', 'salvage-kill']
}

export function spendSalvageOnRunUpgrades(
  state: GameState,
  ctx: StrategyContext,
  mode: SimulationSpendProfile | 'active' | 'casual' | 'optimiser',
): GameState {
  if (state.combat.docked) return state
  if ((state.combat.defeatLeft ?? 0) > 0) return state
  const profile = resolveSpendProfile(mode)
  const preferDefense =
    state.combat.consecutiveLosses >= 1 ||
    (state.combat.playerHullMax > 0 && state.combat.playerHull / state.combat.playerHullMax <= 0.55)
  const order = shopOrderFor(profile, preferDefense)
  let next = state
  const budget = profile === 'casual' ? 3 : profile === 'optimiser' ? 12 : 8
  for (let n = 0; n < budget; n += 1) {
    let bought = false
    for (const id of order) {
      const def = visibleRunUpgrades(next).find((row) => row.id === id)
      if (!def) continue
      const cost = nextRunUpgradeCost(next, id)
      if (cost <= 0 || (next.resources.salvage ?? 0) < cost) continue
      const after = buyRunUpgrade(next, id)
      if (after === next) continue
      ctx.recordMeaningful(`Salvage ${def.name} → L${(after.combat.runUpgrades?.[id] ?? 0)}`)
      next = after
      bought = true
      break
    }
    if (!bought) break
  }
  return next
}

export function spendScrapOnCoreStarts(
  state: GameState,
  ctx: StrategyContext,
  mode: SimulationSpendProfile | 'active' | 'casual' | 'optimiser',
): GameState {
  if (!state.combat.docked) return state
  if (!state.meta.hullLostOnce) return state
  const profile = resolveSpendProfile(mode)
  const preferDefense = state.combat.consecutiveLosses >= 2
  const slots = equippedCoreSlots(state)
  if (slots.length === 0) return state
  const intended = getAct1BuildProfile(ctx.config.buildProfile).coreIds
  const preferredIds = preferDefense || profile === 'defensive'
    ? ['plate-layer', 'rapid-aegis', 'barrier-projector', 'nano-lathe', ...intended]
    : intended
  const wp = workshopLevel(state, 'weapon-power')
  let next = state
  const budget = profile === 'casual' ? 2 : profile === 'economy-first' ? 2 : 6
  for (let n = 0; n < budget; n += 1) {
    let bought = false
    const ranked = [...equippedCoreSlots(next)].sort((a, b) => {
      const levelDelta = coreStartingLevel(next, a.coreInstanceId) - coreStartingLevel(next, b.coreInstanceId)
      if (levelDelta !== 0) return levelDelta
      const ai = preferredIds.indexOf(a.moduleId)
      const bi = preferredIds.indexOf(b.moduleId)
      return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi)
    })
    for (const slot of ranked) {
      const moduleId = slot.moduleId
      const level = coreStartingLevel(next, slot.coreInstanceId)
      if (profile === 'economy-first' && wp < 3 && level >= 1) continue
      if (profile !== 'optimiser' && profile !== 'offensive' && level > wp + 2) continue
      const before = next.resources.scrap
      const after = buyCoreStartingLevel(next, slot.coreInstanceId, 1)
      if (after === next) continue
      const cost = Math.max(0, before - after.resources.scrap)
      const afterLevel = coreStartingLevel(after, slot.coreInstanceId)
      ctx.recordCorePurchase({
        moduleId,
        name: getModule(moduleId)?.name ?? moduleId,
        levelAfter: afterLevel,
        cost,
        activeSeconds: ctx.activeSeconds,
        statBefore: level,
        statAfter: afterLevel,
        marginalPerCost: cost > 0 ? 1 / cost : 0,
      })
      ctx.recordMeaningful(`${getModule(moduleId)?.name ?? moduleId} Core → L${afterLevel}`)
      next = after
      bought = true
      break
    }
    if (!bought) break
  }
  return next
}

export function tendFoundryFacilities(state: GameState, ctx: StrategyContext): GameState {
  if (!isSystemUnlocked(state, 'foundry')) return state
  const prefer = ['worker-fabricator', 'processing-line', 'fabrication-bay', 'research-annex', 'recovery-storage']
  for (const id of prefer) {
    const def = FOUNDRY_FACILITIES.find((row) => row.id === id)
    if (!def) continue
    if (!canStartFabrication(state, 'facility', id).ok) continue
    const after = startFabrication(state, 'facility', id)
    if (after !== state) {
      ctx.recordMeaningful(`Foundry ${def.name}`)
      return after
    }
  }
  return state
}

export function spendScrapOnWorkshop(
  state: GameState,
  ctx: StrategyContext,
  mode: SimulationSpendProfile | 'active' | 'casual' | 'optimiser',
): GameState {
  if (!state.combat.docked) return state
  if (!state.meta.hullLostOnce) return state
  const profile = resolveSpendProfile(mode)
  const preferDefense = state.combat.consecutiveLosses >= 2
  const order = shopOrderFor(profile, preferDefense)
  let next = state
  const budget = profile === 'casual' ? 2 : profile === 'economy-first' ? 6 : 4
  for (let n = 0; n < budget; n += 1) {
    let bought = false
    for (const id of order) {
      const def = RUN_UPGRADES.find((row) => row.id === id)
      if (!def) continue
      const after = buyWorkshopUpgrade(next, id)
      if (after === next) continue
      const level = workshopLevel(after, id)
      ctx.recordMeaningful(`Workshop ${def.name} → L${level}`)
      next = after
      bought = true
      break
    }
    if (!bought) break
  }
  return next
}

export function industryPass(
  state: GameState,
  ctx: StrategyContext,
  mode: SimulationSpendProfile | 'active' | 'casual' | 'optimiser',
): GameState {
  const profile = resolveSpendProfile(mode)
  let next = state
  next = maybeUnlockAndFit(next, ctx)
  next = spendSalvageOnRunUpgrades(next, ctx, profile)
  next = tendFoundry(next, ctx)
  next = tendProfileFabrication(next, ctx)
  next = tendFoundryFacilities(next, ctx)
  next = spendScrapOnWorkshop(next, ctx, profile)
  next = spendScrapOnCoreStarts(next, ctx, profile)
  next = rebalanceNetwork(next, ctx, profile)
  next = buyUsefulNetworkLinks(next, ctx)
  next = tendFurnace(next, ctx)
  next = tendHiveResearch(next, ctx, profile)
  next = tendProcess(next, ctx)
  next = tendReliquary(next, ctx)
  next = spendRebuildMatter(next, ctx)
  next = tendChallenges(next, ctx, profile === 'optimiser')
  return next
}
