/** Apply legal gameplay actions. Strategies choose; this module never cheats. */

import type { GameState, FoundryRecipeId } from '../types'
import {
  buyMatterShop,
  buyNetworkLink,
  buyProcessNode,
  canPrestige,
  convertAshToHeat,
  fitModule,
  equipRelicOnCore,
  performPrestige,
  pickCoreMilestone,
  prestigeGainFor,
  setFoundrySlot,
  setResearchFocus,
  unlockModule,
  assignWorker,
  enterProtocol,
  abandonProtocol,
  buyWorkshopUpgrade,
  buyRunUpgrade,
  buyCoreStartingLevel,
} from '../actions'
import { setCampaign, setDocked, retryFrontier, chooseDirective } from '../tick'
import { canRetryFrontier, isFrontierHold } from '../frontier'
import {
  canBuyMatterShop,
  getMatterShopItem,
  getModule,
  idleWorkers,
  isStationUnlocked,
  MATTER_SHOP,
  moduleLevel,
  moduleUpgradeCost,
  SHIP_MODULES,
  visibleWorkerJobIds,
} from '../catalog'
import { pendingMilestone } from '../milestones'
import {
  coreStartingLevel,
  coreRunLevel,
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
  FOUNDRY_RECIPES,
  canStartFabrication,
  foundryFacilityCommitted,
  foundryRecipeLevel,
  foundrySlotCount,
  isFoundryRecipeUnlocked,
  startFabrication,
} from '../foundry'
import {
  FURNACE_UPGRADES,
  ASH_PER_HEAT,
  buyFurnaceUpgrade,
  canBuyFurnaceUpgrade,
  canSetFurnaceChannel,
  furnaceActiveLevel,
  furnaceChannelSlots,
  furnaceLightCost,
  furnaceRoman,
  furnaceUpgradeRank,
  setFurnaceChannel,
} from '../furnace'
import { PROCESS_NODES, canBuyProcessNode, hasProcess } from '../process'
import {
  SHARDS,
  shardOwned,
  getShard,
  coreSocketLayout,
  coreSocketRelics,
  relicFitsSocket,
  relicSocketClass,
  shardAutoScore,
} from '../reliquary'
import { GUIDE_STEPS, isSystemUnlocked } from '../progression'
import { ACT1_CADENCE } from '../cadence'
import { careerBestWave } from '../waves'
import { workerJobCap } from '../workers'
import { PROTOCOLS, PROTOCOL_MAX_RANK, canEnterProtocol, protocolRank } from '../protocols'
import { cycleBestWave } from '../rebuild'
import type { SimulationSpendProfile, StrategyContext } from './types'
import {
  RUN_UPGRADES,
  nextRunUpgradeCost,
  visibleRunUpgrades,
  workshopCost,
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

/** Economy-first extracts a dead wall to spend Scrap on Workshop instead of idling. */
export function maybeExtractToWorkshop(state: GameState, ctx: StrategyContext): GameState {
  if (state.combat.docked) return state
  if (ctx.config.strategy !== 'economy-first') return state
  if (furnaceActiveLevel(state, 'weapons') > 0) return state
  const career = careerBestWave(state)
  const wave = Math.max(1, state.combat.wave ?? 1)
  if (career > 0 && wave < career * 0.9) return state
  if (ctx.secondsSinceBestWaveGain < 12 * 60) return state
  const wpCost = workshopCost(workshopLevel(state, 'weapon-power'))
  if ((state.resources.scrap ?? 0) < wpCost) return state
  const next = setDocked(state, true)
  if (next !== state) ctx.recordMeaningful('Extract to Workshop')
  return next
}

/** Developer sim only — players retry by hand. Prevents a farm deadlock after a wall. */
export function maybeRetryFrontier(state: GameState, ctx: StrategyContext): GameState {
  if (!isFrontierHold(state) || !canRetryFrontier(state)) return state
  const next = retryFrontier(state)
  if (next !== state) ctx.recordMeaningful('Retry push')
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
  const slagOn = isFoundryRecipeUnlocked(state, 'slag-ingot')
  const filOn = isFoundryRecipeUnlocked(state, 'filament')
  const temperOn = isFoundryRecipeUnlocked(state, 'temper-bar')
  if (!slagOn && !filOn && !temperOn) return null
  const slag = foundryStock(state, 'slag-ingot')
  const filament = foundryStock(state, 'filament')
  const temper = foundryStock(state, 'temper-bar')
  const fabDone = foundryFacilityCommitted(state, 'drone-fabricator') > 0
  const wantFab =
    !fabDone && careerBestWave(state) >= ACT1_CADENCE.foundryAdvanced
  if (wantFab) {
    if (temperOn && temper < 6 && slag >= 2 && filament >= 1) return 'temper-bar'
    if (filOn && filament < 8) return 'filament'
    if (slagOn && slag < 24) return 'slag-ingot'
    if (temperOn && temper < 6) {
      if (filOn && filament < 1) return 'filament'
      if (slagOn) return 'slag-ingot'
    }
  }
  const early: FoundryRecipeId[] = ['slag-ingot', 'filament', 'temper-bar', 'hardened-plate', 'relay']
  const processing: FoundryRecipeId[] =
    careerBestWave(state) >= ACT1_CADENCE.foundryAdvanced
      ? FOUNDRY_RECIPES.filter((r) => isFoundryRecipeUnlocked(state, r.id)).map((r) => r.id)
      : early.filter((id) => isFoundryRecipeUnlocked(state, id))
  if (!processing.length) {
    if (slagOn) return 'slag-ingot'
    if (filOn) return 'filament'
    return temperOn ? 'temper-bar' : null
  }
  const lateGame = careerBestWave(state) >= ACT1_CADENCE.foundryAdvanced
  if (lateGame) {
    const needsUnlock = processing.filter((id) => {
      const def = FOUNDRY_RECIPES.find((row) => row.id === id)
      const gate = def?.unlocksRecipe?.atLevel ?? 0
      return gate > 0 && foundryRecipeLevel(state, id) < gate
    })
    if (needsUnlock.length) {
      needsUnlock.sort((a, b) => foundryRecipeLevel(state, a) - foundryRecipeLevel(state, b))
      return needsUnlock[0]!
    }
  }
  const softCap = lateGame ? 55 : 45
  const belowSoft = processing.filter((id) => foundryRecipeLevel(state, id) < softCap)
  const belowHard = processing.filter((id) => foundryRecipeLevel(state, id) < 90)
  const pool = belowSoft.length ? belowSoft : belowHard
  if (!pool.length) return processing[0] ?? null
  pool.sort((a, b) => foundryRecipeLevel(state, a) - foundryRecipeLevel(state, b))
  return pool[0]!
}

function highestAffordableFurnaceLevel(bankedHeat: number, minLevel = 1): number {
  for (let lv = 3; lv >= minLevel; lv -= 1) {
    if (bankedHeat >= furnaceLightCost('weapons', lv)) return lv
  }
  return 0
}

export function tendFurnace(state: GameState, ctx: StrategyContext): GameState {
  if (!isSystemUnlocked(state, 'furnace')) return state
  if (state.combat.docked) return state
  const ash = state.resources.choirAsh ?? 0
  const heat = state.resources.heat ?? 0
  const bankedHeat = heat + Math.floor(ash / ASH_PER_HEAT)
  const career = careerBestWave(state)
  const cycleBest = cycleBestWave(state)
  const wave = Math.max(1, state.combat.wave ?? 1)
  const reclaiming =
    (state.prestige.prestigeCount ?? 0) >= 1 && career > 0 && cycleBest < career * 0.88
  const stallSec = ctx.secondsSinceHighestSectorGain
  const stalled = stallSec >= 20 * 60
  const hardStall = stallSec >= 35 * 60
  const onTheWall = career <= 0 || wave >= Math.max(1, career - 8)
  const nearCareer = career <= 0 || wave >= career * 0.94
  const desperate =
    (state.combat.consecutiveLosses ?? 0) >= 2 && wave >= Math.max(40, career * 0.35)
  // Weapons I is the healthy stored push. Escalate only after the wall has
  // already eaten that spend — a combat-starved bank should not sit on millions
  // of Ash lighting I forever.
  let weaponsLv = highestAffordableFurnaceLevel(bankedHeat, 1)
  if (!stalled && weaponsLv > 1) weaponsLv = 1
  const weaponsCost = weaponsLv > 0 ? furnaceLightCost('weapons', weaponsLv) : 0
  let wardLv = 0
  if (weaponsLv > 0) {
    const leftover = bankedHeat - weaponsCost
    if (stalled) {
      wardLv = highestAffordableFurnaceLevel(leftover, 1)
      if (wardLv > weaponsLv) wardLv = weaponsLv
    } else if (leftover >= furnaceLightCost('shielding', 1)) {
      wardLv = 1
    }
  }
  const escalateEarly =
    stalled &&
    weaponsLv >= 2 &&
    (hardStall || wave >= Math.max(1, career * 0.5))
  // Bank Ash through reclaim. Convert only on the wall, and only the Heat this Sortie can spend.
  // After repeated hull losses or a long stall, light earlier so a banked push is not trapped.
  if (reclaiming && !nearCareer && !desperate && !escalateEarly) return state
  if (!onTheWall && !desperate && !escalateEarly) return state
  if (weaponsLv < 1) return state
  const currentWeapons = furnaceActiveLevel(state, 'weapons')
  const currentWard = furnaceActiveLevel(state, 'shielding')
  if (currentWeapons >= weaponsLv && currentWard >= wardLv) return state

  const heatNeeded =
    furnaceLightCost('weapons', weaponsLv) + (wardLv > 0 ? furnaceLightCost('shielding', wardLv) : 0)
  const alreadyPaid =
    furnaceLightCost('weapons', currentWeapons) +
    (currentWard > 0 ? furnaceLightCost('shielding', currentWard) : 0)
  const batchesNeeded = Math.max(0, heatNeeded - alreadyPaid - Math.floor(heat))
  let next = batchesNeeded > 0 ? convertAshToHeat(state, batchesNeeded) : state
  if (next !== state) ctx.record('ash-to-heat')
  const slots = furnaceChannelSlots(next)
  const order: Array<{ id: Parameters<typeof setFurnaceChannel>[1]; level: number }> = [
    { id: 'weapons', level: weaponsLv },
  ]
  if (wardLv > 0) order.push({ id: 'shielding', level: wardLv })
  let lit = 0
  for (const row of order) {
    if (furnaceActiveLevel(next, row.id) > 0) lit += 1
  }
  for (const row of order) {
    const have = furnaceActiveLevel(next, row.id)
    if (have >= row.level) continue
    if (have <= 0 && lit >= slots) break
    if (!canSetFurnaceChannel(next, row.id, row.level).ok) continue
    const after = setFurnaceChannel(next, row.id, row.level)
    if (after !== next) {
      ctx.recordMeaningful(`Furnace ${row.id} ${furnaceRoman(row.level)}`)
      next = after
      if (have <= 0) lit += 1
    }
  }
  for (const up of FURNACE_UPGRADES) {
    if (!canBuyFurnaceUpgrade(next, up.id).ok) continue
    const after = buyFurnaceUpgrade(next, up.id)
    if (after !== next) {
      ctx.recordMeaningful(`Furnace ${up.name} ${furnaceUpgradeRank(after, up.id)}`)
      next = after
      break
    }
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
  const pulseCost = moduleUpgradeCost(coreRunLevel(state, 0), 'pulse-cannon')
  const material = state.hiveResearch?.completed.material ?? 0
  const energy = state.hiveResearch?.completed.energy ?? 0
  const observation = state.hiveResearch?.completed.observation ?? 0
  let want: 'material' | 'energy' | 'observation' =
    salvage < pulseCost * 2 ? 'material' : 'energy'
  if (profile === 'offensive') want = 'observation'
  if (profile === 'defensive') want = 'energy'
  if (profile === 'economy-first') {
    want = careerBestWave(state) >= ACT1_CADENCE.furnace ? 'energy' : 'material'
  }
  if (profile === 'optimiser') {
    if (energy < 3) want = 'energy'
    else if (material < 3) want = 'material'
    else if (observation < 3) want = 'observation'
    else if (energy < 6) want = 'energy'
    else if (material < 6) want = 'material'
    else want = observation < 9 ? 'observation' : 'energy'
  }
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

export function spendRebuildMatter(state: GameState, ctx: StrategyContext): GameState {
  let next = state
  const econCombat =
    ctx.config.strategy === 'economy-first' && careerBestWave(state) >= ACT1_CADENCE.furnace
  const guardLimit = econCombat ? 16 : 8
  let guard = 0
  while (guard++ < guardLimit && next.resources.prestigeMatter > 0) {
    let bestId: string | null = null
    let bestScore = 0
    for (const item of MATTER_SHOP) {
      const check = canBuyMatterShop(next, item.id)
      if (!check.ok || check.cost <= 0) continue
      const def = getMatterShopItem(item.id)
      const dmg = def?.damageBonus ?? 0
      const hull = (def?.hullBonus ?? 0) / 80
      const shield = (def?.shieldBonus ?? 0) / 80
      const prod = (def?.productionBonus ?? 0) * (econCombat ? 0.05 : 0.4)
      const score = (dmg * (econCombat ? 2.4 : 1.6) + hull + shield + prod) / check.cost
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

export function tendReliquary(state: GameState, ctx: StrategyContext): GameState {
  if (!state.combat.docked) return state
  if (!isSystemUnlocked(state, 'reliquary')) return state
  let next = state
  for (const slot of equippedCoreSlots(next)) {
    const layout = coreSocketLayout(next, slot.coreInstanceId)
    for (let i = 0; i < layout.length; i += 1) {
      const socket = layout[i]
      if (!socket) continue
      const seated = coreSocketRelics(next, slot.coreInstanceId)
      const fitted = seated[i] ?? null
      const fittedDef = fitted ? getShard(fitted) : undefined
      const fittedScore = fittedDef ? shardAutoScore(fittedDef) : 0
      let bestId: string | null = null
      let bestScore = fitted ? fittedScore * 1.05 : 0
      for (const def of SHARDS) {
        if (shardOwned(next, def.id) < 1) continue
        if (!relicFitsSocket(relicSocketClass(def), socket)) continue
        const score = shardAutoScore(def)
        if (score > bestScore) {
          bestScore = score
          bestId = def.id
        }
      }
      if (!bestId || bestId === fitted) continue
      const after = equipRelicOnCore(next, slot.coreInstanceId, bestId, i)
      if (after === next) continue
      ctx.recordMeaningful(`Relic ${getShard(bestId)?.name ?? bestId} → ${slot.moduleId}`)
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
  if (state.protocols?.activeId) return { yes: false, reasons: [] }
  const prestigeCount = state.prestige.prestigeCount ?? 0
  const cfg = ctx.config.rebuild
  const econ = ctx.config.strategy === 'economy-first'
  const stallNeed =
    prestigeCount < 1
      ? cfg.stallSeconds
      : careerBestWave(state) >= ACT1_CADENCE.furnace
        ? Math.max(cfg.stallSeconds * 5, 40 * 60)
        : econ
          ? Math.min(
              75 * 60,
              Math.max(cfg.stallSeconds * 3, 18 * 60) + Math.max(0, prestigeCount - 1) * 5 * 60,
            )
          : Math.max(cfg.stallSeconds * 3, 18 * 60)
  const cycleBest = cycleBestWave(state)
  const career = careerBestWave(state)
  const reclaiming =
    (state.prestige.prestigeCount ?? 0) >= 1 && career > 0 && cycleBest < career * 0.88
  const ash = state.resources.choirAsh ?? 0
  const heat = state.resources.heat ?? 0
  const furnaceBank = ash + heat * ASH_PER_HEAT
  const furnaceOpen = isSystemUnlocked(state, 'furnace')
  const weaponsAsh = furnaceLightCost('weapons', 1) * ASH_PER_HEAT
  const furnaceReady = furnaceOpen && furnaceBank >= weaponsAsh
  if (
    ctx.lastRebuildActive != null &&
    ctx.activeSeconds - ctx.lastRebuildActive < stallNeed &&
    state.combat.consecutiveLosses < cfg.consecutiveLosses
  ) {
    return { yes: false, reasons: [] }
  }
  // Reclaim: do not prestige-reset a bump. Reach the previous best (or spend Furnace) first.
  if (reclaiming && ctx.secondsSinceHighestSectorGain < 40 * 60 && state.combat.consecutiveLosses < 5) {
    return { yes: false, reasons: [] }
  }
  const secondForProcess =
    prestigeCount === 1 &&
    career >= 160 &&
    career < 250 &&
    ctx.lastRebuildActive != null &&
    ctx.activeSeconds - ctx.lastRebuildActive >= 4 * 3600
  if (secondForProcess && !reclaiming) {
    return { yes: true, reasons: ['Second Rebuild to open Process'] }
  }
  // Banked Ash is the W160 lever. Rebuild dumps it. Use Best-Wave stall, not
  // sector stall: a slow 10-wave band still gaining Waves must keep the bank.
  // Consecutive losses reset on every wave win, so they are not the signal.
  const furnaceBankHold = 6 * 3600
  const sinceRebuild =
    ctx.lastRebuildActive == null ? Number.POSITIVE_INFINITY : ctx.activeSeconds - ctx.lastRebuildActive
  if (furnaceReady && reclaiming && state.combat.consecutiveLosses < 5) {
    return { yes: false, reasons: [] }
  }
  if (furnaceReady && ctx.secondsSinceBestWaveGain < furnaceBankHold) {
    return { yes: false, reasons: [] }
  }
  if (furnaceReady && sinceRebuild < furnaceBankHold) {
    return { yes: false, reasons: [] }
  }
  if (
    furnaceReady &&
    ctx.secondsSinceBestWaveGain < 12 * 3600 &&
    (state.resources.scrap ?? 0) >= workshopCost(workshopLevel(state, 'weapon-power'))
  ) {
    return { yes: false, reasons: [] }
  }
  // Once the late shop is stacked, keep the cycle through Choir Crown.
  // Rebuilding dumps Workshop and Salvage ranks; Economy-first was prestiged
  // every 6h at W200 with Weapon Power already at cap.
  if (
    career >= ACT1_CADENCE.research &&
    workshopLevel(state, 'weapon-power') >= 20
  ) {
    return { yes: false, reasons: [] }
  }
  if (furnaceOpen && furnaceBank >= 40 && ctx.secondsSinceHighestSectorGain < 50 * 60) {
    return { yes: false, reasons: [] }
  }
  const reasons: string[] = []
  const gain = prestigeGainFor(state)
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
    workshopLost,
    networkLevelsLost,
    linksKept,
    previousPushSeconds: prevPush,
  })
  ctx.recordMeaningful(`Rebuild #${after.prestige.prestigeCount}`)
  return after
}

export function tendProtocols(state: GameState, ctx: StrategyContext): GameState {
  if (!state.combat.docked) return state
  if (state.protocols?.activeId) {
    const losses = state.combat.consecutiveLosses ?? 0
    if (losses >= 4 || ctx.secondsSinceHighestSectorGain >= 25 * 60) {
      const after = abandonProtocol(state)
      if (after !== state) ctx.recordMeaningful('Abandon Challenge')
      return after
    }
    return state
  }
  if (!isSystemUnlocked(state, 'protocols')) return state
  const cycleBest = cycleBestWave(state)
  const career = careerBestWave(state)
  if (career > 0 && cycleBest < career * 0.75) return state
  const prefer = ['glass-ward', 'dry-hold', 'mute-network', 'empty-reliquary']
  const pick =
    prefer
      .map((id) => PROTOCOLS.find((p) => p.id === id))
      .find((p) => p && canEnterProtocol(state, p.id).ok && protocolRank(state, p.id) < 1) ??
    PROTOCOLS.find((p) => canEnterProtocol(state, p.id).ok && protocolRank(state, p.id) < PROTOCOL_MAX_RANK)
  if (!pick) return state
  const after = enterProtocol(state, pick.id)
  if (after !== state) ctx.recordMeaningful(`Challenge ${pick.name}`)
  return after
}

function economyConvertsToCombat(state: GameState, ctx: StrategyContext): boolean {
  return (
    ctx.secondsSinceHighestSectorGain >= 6 * 60 ||
    ctx.secondsSinceBestWaveGain >= 6 * 60 ||
    (state.prestige.prestigeCount ?? 0) >= 1 ||
    careerBestWave(state) >= ACT1_CADENCE.furnace
  )
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
    if (preferDefense) {
      return ['weapon-power', 'hull', 'salvage-kill', 'scrap-kill', 'ash-yield', 'salvage-wave']
    }
    return ['salvage-kill', 'scrap-kill', 'ash-yield', 'salvage-wave', 'fragment-chance', 'weapon-power', 'hull']
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
    (state.combat.playerHullMax > 0 && state.combat.playerHull / state.combat.playerHullMax <= 0.55) ||
    (profile === 'economy-first' && economyConvertsToCombat(state, ctx))
  const order = shopOrderFor(profile, preferDefense)
  const best = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0, state.combat.wave ?? 1)
  let next = state
  const budget = profile === 'casual' ? 3 : profile === 'optimiser' ? 12 : 8
  for (let n = 0; n < budget; n += 1) {
    let bought = false
    for (const id of order) {
      const def = visibleRunUpgrades(best).find((row) => row.id === id)
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

function coreSlotOrder(profile: SimulationSpendProfile, preferDefense: boolean): string[] {
  if (profile === 'defensive' || preferDefense) return ['plate-layer', 'pulse-cannon']
  if (profile === 'offensive') return ['pulse-cannon', 'plate-layer']
  return ['pulse-cannon', 'plate-layer']
}

export function spendScrapOnCoreStarts(
  state: GameState,
  ctx: StrategyContext,
  mode: SimulationSpendProfile | 'active' | 'casual' | 'optimiser',
): GameState {
  if (!state.combat.docked) return state
  if (!state.meta.hullLostOnce) return state
  const profile = resolveSpendProfile(mode)
  const preferDefense =
    state.combat.consecutiveLosses >= 2 ||
    (profile === 'economy-first' && economyConvertsToCombat(state, ctx))
  const order = coreSlotOrder(profile, preferDefense)
  const slots = equippedCoreSlots(state)
  if (slots.length === 0) return state
  const wp = workshopLevel(state, 'weapon-power')
  let next = state
  const budget = profile === 'casual' ? 2 : profile === 'economy-first' ? (preferDefense ? 6 : 2) : 6
  for (let n = 0; n < budget; n += 1) {
    let bought = false
    const ranked = [...order].sort((a, b) => {
      const la = coreStartingLevel(next, slots.find((row) => row.moduleId === a)?.coreInstanceId ?? a)
      const lb = coreStartingLevel(next, slots.find((row) => row.moduleId === b)?.coreInstanceId ?? b)
      return la - lb
    })
    for (const moduleId of ranked) {
      const slot = slots.find((row) => row.moduleId === moduleId)
      if (!slot) continue
      const level = coreStartingLevel(next, slot.coreInstanceId)
      if (profile === 'economy-first' && wp < 3 && level >= 1 && !preferDefense) continue
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
  const prefer = ['drone-fabricator', 'drone-racks', 'processing-line', 'storage-bay', 'research-annex']
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
  const preferDefense =
    state.combat.consecutiveLosses >= 2 ||
    (profile === 'economy-first' && economyConvertsToCombat(state, ctx))
  const order = shopOrderFor(profile, preferDefense)
  const best = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0)
  let next = state
  const budget = profile === 'casual' ? 2 : profile === 'economy-first' ? 6 : 4
  for (let n = 0; n < budget; n += 1) {
    let bought = false
    for (const id of order) {
      const def = RUN_UPGRADES.find((row) => row.id === id)
      if (!def || best < def.minBestWave) continue
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
  next = tendProtocols(next, ctx)
  return next
}
