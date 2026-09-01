/** Passive-loop helpers for expensive AI / Process automation nodes (mutate in place). */

import type { GameState } from './types'
import {
  STATIONS,
  aiDoctrinesActive,
  idleWorkers,
  isStationUnlocked,
} from './catalog'
import {
  buyRunUpgrade,
  optimiseNetwork,
} from './actions'
import {
  SIGNAL_CORE_DEFS,
  SIGNAL_CORE_MAX_RANK,
  SIGNAL_CORE_MERGE_COUNT,
  countMergeable,
  mergeSignalCores,
} from './signalCores'
import { hasProcess, noteProcessLastAction, processConfig } from './process'
import { activeProcessProfile, evaluateProcessIntent, pickShopCategory } from './processProfiles'
import { getFoundryRecipe, idleProcessingSlot, startProcessing } from './foundry'
import { CONTINUE_UNCHANGED, chooseDirective } from './directives'
import {
  ASH_PER_HEAT,
  canIgniteFurnace,
  furnaceConfigurationCost,
  furnaceConversionPreview,
  igniteFurnace,
} from './furnace'
import type { FoundryMaterialId, FurnaceChannelId, FurnaceChannelLevel } from './types'
import { nextRunUpgradeCost, visibleRunUpgrades, type RunUpgradeId } from './workshop'
import {
  HIVE_RESEARCH_BRANCHES,
  HIVE_RESEARCH_NODES,
  hiveResearchBranchUnlocked,
  hiveResearchActive,
  hiveResearchAvailableNodes,
  hiveResearchCompleted,
  hiveResearchQueueCap,
  startResearch,
  setResearchFocus,
} from './hiveResearch'
function adopt(state: GameState, next: GameState): void {
  if (next === state) return
  state.resources = next.resources
  state.shipyard = next.shipyard
  state.base = next.base
  state.signalCores = next.signalCores
  state.meta = next.meta
  state.combat = next.combat
  state.core = next.core
  state.ai = next.ai
  state.research = next.research
  state.essence = next.essence
  state.prestige = next.prestige
  state.codex = next.codex
  state.foundry = next.foundry
  state.relics = next.relics
  state.hiveResearch = next.hiveResearch
  state.furnace = next.furnace
  state.process = next.process
  state.network = next.network
  state.challenges = next.challenges
  state.echo = next.echo
}

/** Auto-merge unequipped Signal Cores while triples remain. */
export function autoMergeSignalCores(state: GameState): void {
  const processMerge = hasProcess(state, 'reliquary-merge') && processConfig(state).reliquary.autoMerge
  if (!aiDoctrinesActive(state, 'auto-merge-signal') && !processMerge) return
  let guard = 0
  while (guard++ < 40) {
    let merged = false
    for (const def of SIGNAL_CORE_DEFS) {
      for (let rank = 1; rank < SIGNAL_CORE_MAX_RANK; rank++) {
        if (countMergeable(state, def.id, rank) < SIGNAL_CORE_MERGE_COUNT) continue
        const next = mergeSignalCores(state, def.id, rank)
        if (next === state) continue
        adopt(state, next)
        merged = true
        break
      }
      if (merged) break
    }
    if (!merged) break
  }
}

/** Park idle workers on the lowest Core training stations. */
export function autoCoreTrain(state: GameState): void {
  if (!aiDoctrinesActive(state, 'neural-router')) return
  let idle = idleWorkers(state)
  if (idle <= 0) return

  const stations = STATIONS.filter(
    (s) => s.kind === 'training' && s.trainsAttr && isStationUnlocked(state, s.id),
  )
  if (stations.length === 0) return

  const assignments = { ...state.base.assignments }
  while (idle > 0) {
    let best = stations[0]!
    let bestRank = Infinity
    for (const s of stations) {
      const attr = s.trainsAttr!
      const rank = state.core?.ranks[attr] ?? 0
      const assigned = assignments[s.id] ?? 0
      const score = rank * 1000 + assigned
      if (score < bestRank) {
        bestRank = score
        best = s
      }
    }
    assignments[best.id] = (assignments[best.id] ?? 0) + 1
    idle -= 1
  }
  state.base.assignments = assignments
}

function autoShopUpgrades(state: GameState): void {
  if (state.combat.docked) return
  const intent = evaluateProcessIntent(state)
  if (!intent.autoShop) return
  const salvage = state.resources.salvage ?? 0
  if (salvage <= intent.salvageReserve) return
  let guard = 0
  while (guard++ < 8) {
    const bank = state.resources.salvage ?? 0
    if (bank <= intent.salvageReserve) break
    const cat = pickShopCategory(state, intent.spend)
    if (!cat) break
    let pick: RunUpgradeId | null = null
    let pickCost = Number.POSITIVE_INFINITY
    for (const def of visibleRunUpgrades(state, cat)) {
      const cost = nextRunUpgradeCost(state, def.id)
      if (cost <= 0) continue
      if (bank - cost < intent.salvageReserve) continue
      if (cost < pickCost) {
        pick = def.id
        pickCost = cost
      }
    }
    if (!pick) break
    const next = buyRunUpgrade(state, pick, 1)
    if (next === state) break
    if ((next.resources.salvage ?? 0) >= bank) break
    adopt(state, next)
  }
  if (guard > 1) noteProcessLastAction(state, 'sortie-auto-buy', `Bought ${guard - 1} shop ranks`)
}


function autoNetworkBalance(state: GameState): void {
  if (!hasProcess(state, 'worker-auto-fill')) return
  if (!processConfig(state).network.enabled) return
  if (idleWorkers(state) <= 0) return
  const profile = activeProcessProfile(state)
  if (intentWorkerOrProfile(state, profile)) {
    const preset = evaluateProcessIntent(state).workerPreset ?? profile?.workerPreset
    if (preset && hasProcess(state, 'worker-presets')) {
      state.process.config.network.preset = preset
    }
  }
  const next = optimiseNetwork(state)
  if (next !== state) {
    adopt(state, next)
    noteProcessLastAction(state, 'worker-auto-fill', 'Filled idle Workers')
  }
}

function intentWorkerOrProfile(
  state: GameState,
  profile: ReturnType<typeof activeProcessProfile>,
): boolean {
  const intent = evaluateProcessIntent(state)
  if (intent.workerPreset && (hasProcess(state, 'rule-builder') || hasProcess(state, 'process-profiles'))) {
    state.process.config.network.preset = intent.workerPreset
    return true
  }
  return Boolean(profile?.workerPreset && hasProcess(state, 'worker-presets'))
}

function autoProcessing(state: GameState): void {
  const cfg = processConfig(state)
  const intent = evaluateProcessIntent(state)
  const slot = idleProcessingSlot(state)
  if (slot < 0) return
  let target = hasProcess(state, 'processing-repeat')
    ? intent.repeatRecipe ?? intent.foundryTarget ?? cfg.foundry.repeatRecipe
    : null
  if (hasProcess(state, 'material-stock-targets') && intent.foundryStock) {
    const current = state.foundry.materials[intent.foundryStock.recipeId] ?? 0
    if (current < intent.foundryStock.min) target = intent.foundryStock.recipeId
  }
  if (hasProcess(state, 'material-stock-targets')) {
    const below = Object.entries(cfg.foundry.minStock ?? {}).find(
      ([id, floor]) => (state.foundry.materials[id] ?? 0) < Math.max(0, Number(floor) || 0),
    )
    if (below) target = below[0] as FoundryMaterialId
  }
  if (!target) return
  let next = startProcessing(state, slot, target as FoundryMaterialId)
  if (next === state && hasProcess(state, 'dependency-processing')) {
    const recipe = getFoundryRecipe(target as FoundryMaterialId)
    const missing = Object.entries(recipe?.costs.materials ?? {}).find(
      ([id, need]) => (state.foundry.materials[id] ?? 0) < Math.max(0, Number(need) || 0),
    )
    if (missing) next = startProcessing(state, slot, missing[0] as FoundryMaterialId)
  }
  if (next !== state) {
    adopt(state, next)
    noteProcessLastAction(state, 'processing-repeat', `Started ${state.foundry.slots[slot]?.recipeId ?? target}`)
  }
}

const FURNACE_PRESETS: Record<string, Record<FurnaceChannelId, FurnaceChannelLevel>> = {
  push: { overdrive: 2, bulwark: 1, guidance: 0, harvest: 0 },
  farm: { overdrive: 1, bulwark: 0, guidance: 0, harvest: 2 },
  industry: { overdrive: 0, bulwark: 0, guidance: 1, harvest: 2 },
  research: { overdrive: 1, bulwark: 1, guidance: 0, harvest: 0 },
}

function autoIgniteFurnace(state: GameState): void {
  if (!hasProcess(state, 'furnace-auto-ignite') || !hasProcess(state, 'ash-budgeting')) return
  if (state.combat.docked || !state.combat.inFight || state.furnace.ignited) return
  const cfg = processConfig(state)
  if (!cfg.furnace.autoChannel) return
  const intent = evaluateProcessIntent(state)
  if (!intent.furnaceTriggered) return
  const presetId = intent.furnacePreset ?? cfg.furnace.preset ?? 'push'
  const channels = FURNACE_PRESETS[presetId]
  if (!channels) return
  const cost = furnaceConfigurationCost(channels, state)
  const missingHeat = Math.max(0, cost - (state.resources.heat ?? 0))
  const ashBudget = Math.max(0, Math.floor(cfg.furnace.reserveHeat ?? 0))
  if (missingHeat > 0 && ashBudget > 0) {
    const preview = furnaceConversionPreview(state)
    if (preview.ok && preview.ashUsed > 0) {
      const heatPerBatch = preview.heatGain / Math.max(1, preview.ashUsed / ASH_PER_HEAT)
      const batches = Math.min(
        Math.ceil(missingHeat / Math.max(0.0001, heatPerBatch)),
        Math.floor(Math.min(state.resources.choirAsh ?? 0, ashBudget) / ASH_PER_HEAT),
      )
      if (batches > 0) {
        state.resources.choirAsh -= batches * ASH_PER_HEAT
        state.resources.heat = (state.resources.heat ?? 0) + batches * heatPerBatch
      }
    }
  }
  if (!canIgniteFurnace(state, channels).ok) {
    noteProcessLastAction(state, 'furnace-auto-ignite', `Waiting for ${cost} Heat within ${ashBudget} Ash budget`)
    return
  }
  adopt(state, igniteFurnace(state, channels))
  noteProcessLastAction(state, 'furnace-auto-ignite', `Ignited ${presetId} preset once`)
}

function autoDirectivePreference(state: GameState): void {
  if (!hasProcess(state, 'directive-preference')) return
  const offer = state.combat.directiveOffer ?? []
  if (offer.length === 0) return
  const preferred = processConfig(state).sortie.directivePreference.find((id) => offer.includes(id))
  const selected = preferred ?? CONTINUE_UNCHANGED
  adopt(state, chooseDirective(state, selected))
  noteProcessLastAction(
    state,
    'directive-preference',
    preferred ? `Selected ${preferred}` : 'Continued without changing Directive',
  )
}

function autoProfileTrigger(state: GameState): void {
  if (hasProcess(state, 'challenge-profile') && state.challenges.activeId) {
    const challenge = processConfig(state).profiles.find((profile) => profile.id === 'challenge')
    if (challenge && processConfig(state).activeProfileId !== challenge.id) {
      state.process.config.activeProfileId = challenge.id
      noteProcessLastAction(state, 'challenge-profile', 'Loaded Challenge profile')
    }
  }
  if (!hasProcess(state, 'profile-triggers')) return
  const targetId = evaluateProcessIntent(state).switchProfileId
  if (!targetId || targetId === processConfig(state).activeProfileId) return
  if (!processConfig(state).profiles.some((profile) => profile.id === targetId)) return
  state.process.config.activeProfileId = targetId
  noteProcessLastAction(state, 'profile-triggers', `Switched to ${targetId} profile`)
}

function autoResearchFocus(state: GameState): void {
  if (!hasProcess(state, 'research-preference') && !hasProcess(state, 'research-queue-assist')) return
  if (!state.hiveResearch) return
  const cfg = processConfig(state)
  const intent = evaluateProcessIntent(state)
  if (hasProcess(state, 'research-preference') && !cfg.research.autoResearch && !intent.researchNext) return
  const incomplete = (id: (typeof HIVE_RESEARCH_BRANCHES)[number]['id']) =>
    hiveResearchBranchUnlocked(state, id) && hiveResearchCompleted(state, id) < HIVE_RESEARCH_NODES[id].length
  if (hiveResearchActive(state)) return
  if (hasProcess(state, 'research-queue-assist') && cfg.research.queue.length > 0) {
    const queued = cfg.research.queue.slice(0, hiveResearchQueueCap(state)).find((nodeId) =>
      hiveResearchAvailableNodes(state).some((node) => node.id === nodeId),
    )
    if (queued) {
      const next = startResearch(state, queued)
      if (next !== state) {
        next.process.config.research.queue = next.process.config.research.queue.filter((id) => id !== queued)
        adopt(state, next)
        noteProcessLastAction(state, 'research-queue-assist', `Started ${queued}`)
        return
      }
    }
  }
  if (hasProcess(state, 'research-preference') || intent.researchNext) {
    const nextFocus = cfg.research.branchPriority.find(incomplete)
    if (!nextFocus) return
    const next = setResearchFocus(state, nextFocus)
    if (next !== state) {
      adopt(state, next)
      noteProcessLastAction(state, 'research-preference', `Continued ${nextFocus}`)
    }
  }
}


/** Run all owned automation passives once per sim batch. */
export function tickAutomation(state: GameState): void {
  autoShopUpgrades(state)
  autoProfileTrigger(state)
  autoNetworkBalance(state)
  autoProcessing(state)
  autoResearchFocus(state)
  autoIgniteFurnace(state)
  autoDirectivePreference(state)
}

/** @deprecated Automatic reassignment now belongs to Process progression. */
export function autoLaborLoop(state: GameState): void {
  void state
}
