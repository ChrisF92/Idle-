/** Process T4–T6 — chip rules and Farm / Push / Challenge profiles. */

import type {
  FoundryRecipeId,
  GameState,
  ProcessAction,
  ProcessCondition,
  ProcessProfile,
  ProcessRule,
  ProcessSpendMix,
  ProcessThreatId,
} from './types'
import { careerBestWave, hasHullLostOnce } from './progression'
import { RUN_UPGRADES, runPurchasedLevel, runUpgradeCost } from './workshop'

function owns(state: GameState, id: string): boolean {
  return (state.process?.purchased ?? []).includes(id)
}

function cfg(state: GameState) {
  return state.process?.config
}

export function normalizeSpend(mix: ProcessSpendMix): ProcessSpendMix {
  const attack = Math.max(0, mix.attack)
  const defense = Math.max(0, mix.defense)
  const economy = Math.max(0, mix.economy)
  const sum = attack + defense + economy
  if (sum <= 0) return { attack: 50, defense: 30, economy: 20 }
  return {
    attack: Math.round((100 * attack) / sum),
    defense: Math.round((100 * defense) / sum),
    economy: Math.round((100 * economy) / sum),
  }
}

export function createDefaultProcessProfiles(): ProcessProfile[] {
  return [
    {
      id: 'farm',
      name: 'Farm',
      spend: { attack: 20, defense: 20, economy: 60 },
      salvageReserve: 8,
      autoExtract: true,
      extractHullPct: 0.5,
      autoShop: true,
      workerPreset: 'farm',
      rules: [
        {
          id: 'farm-economy',
          enabled: true,
          when: [{ kind: 'wave-gte', value: 1 }],
          then: { kind: 'spend-profile', spend: { attack: 20, defense: 20, economy: 60 } },
        },
      ],
    },
    {
      id: 'push',
      name: 'Push',
      spend: { attack: 50, defense: 40, economy: 10 },
      salvageReserve: 0,
      autoExtract: false,
      extractHullPct: 0.2,
      autoShop: true,
      workerPreset: 'push',
      rules: [
        {
          id: 'push-dump-econ',
          enabled: true,
          when: [{ kind: 'wave-of-best', value: 95 }],
          then: { kind: 'economy-target', economyPct: 0 },
        },
        {
          id: 'push-furnace',
          enabled: true,
          when: [
            { kind: 'wave-of-best', value: 95 },
            { kind: 'ash-gte', value: 80 },
          ],
          then: { kind: 'furnace-push' },
        },
      ],
    },
    {
      id: 'challenge',
      name: 'Challenge',
      spend: { attack: 30, defense: 50, economy: 20 },
      salvageReserve: 12,
      autoExtract: true,
      extractHullPct: 0.35,
      autoShop: true,
      workerPreset: 'defence',
      rules: [
        {
          id: 'challenge-defense',
          enabled: true,
          when: [{ kind: 'threat', threat: 'SURVIVABILITY' }],
          then: { kind: 'spend-profile', spend: { attack: 20, defense: 70, economy: 10 } },
        },
      ],
    },
  ]
}

export interface ProcessIntent {
  spend: ProcessSpendMix
  salvageReserve: number
  autoShop: boolean
  autoExtract: boolean
  extractHullPct: number
  extractNow: boolean
  furnacePush: boolean
  researchNext: boolean
  fabTracked: boolean
  repeatRecipe: FoundryRecipeId | null
}

function liveThreat(state: GameState): ProcessThreatId {
  const max = state.combat.playerHullMax ?? 0
  const hull = max > 0 ? (state.combat.playerHull ?? 0) / max : 1
  if (hull <= 0.4) return 'SURVIVABILITY'
  const breaks = state.combat.sortieMark?.stats.shieldBreaks ?? 0
  if (breaks >= 2) return 'SURVIVABILITY'
  return 'HEALTHY'
}

export function conditionMet(state: GameState, cond: ProcessCondition): boolean {
  const wave = Math.max(1, state.combat.wave ?? 1)
  const best = Math.max(1, careerBestWave(state), state.combat.bestWave ?? 0)
  switch (cond.kind) {
    case 'wave-gte':
      return wave >= Math.max(1, cond.value ?? 1)
    case 'wave-of-best':
      return wave * 100 >= best * Math.max(0, cond.value ?? 0)
    case 'threat':
      return liveThreat(state) === (cond.threat ?? 'SURVIVABILITY')
    case 'queue-empty':
      return !(state.foundry?.slots ?? []).some((slot) => slot.recipeId)
    case 'ash-gte':
      return (state.resources.choirAsh ?? 0) + (state.resources.heat ?? 0) * 10 >= Math.max(0, cond.value ?? 0)
    case 'hull-lte': {
      const max = state.combat.playerHullMax ?? 0
      if (max <= 0) return false
      return (state.combat.playerHull ?? 0) / max * 100 <= Math.max(0, cond.value ?? 35)
    }
    case 'research-idle':
      return !state.hiveResearch?.active
  }
}

export function ruleFires(state: GameState, rule: ProcessRule): boolean {
  if (!rule.enabled || rule.when.length === 0) return false
  return rule.when.every((cond) => conditionMet(state, cond))
}

function applyAction(intent: ProcessIntent, action: ProcessAction): void {
  switch (action.kind) {
    case 'spend-profile':
      if (action.spend) intent.spend = normalizeSpend(action.spend)
      break
    case 'economy-target': {
      const economy = Math.max(0, Math.min(100, action.economyPct ?? 0))
      const rest = Math.max(0, 100 - economy)
      const attack = intent.spend.attack
      const defense = intent.spend.defense
      const sum = attack + defense
      intent.spend = normalizeSpend({
        attack: sum > 0 ? (rest * attack) / sum : rest / 2,
        defense: sum > 0 ? (rest * defense) / sum : rest / 2,
        economy,
      })
      break
    }
    case 'extract':
      intent.extractNow = true
      intent.autoExtract = true
      break
    case 'repeat-recipe':
      intent.repeatRecipe = action.recipeId ?? intent.repeatRecipe
      break
    case 'furnace-push':
      intent.furnacePush = true
      break
    case 'research-next':
      intent.researchNext = true
      break
    case 'fab-tracked':
      intent.fabTracked = true
      break
  }
}

export function activeProcessProfile(state: GameState): ProcessProfile | null {
  if (!owns(state, 'run-profiles')) return null
  const id = cfg(state)?.activeProfileId
  if (!id) return null
  return (cfg(state)?.profiles ?? []).find((p) => p.id === id) ?? null
}

export function evaluateProcessIntent(state: GameState): ProcessIntent {
  const config = cfg(state)
  const profile = activeProcessProfile(state)
  const shop = config?.shop ?? { autoBuy: false, ratios: { attack: 50, defense: 30, economy: 20 }, salvageReserve: 0 }
  const intent: ProcessIntent = {
    spend: normalizeSpend(profile?.spend ?? shop.ratios),
    salvageReserve: profile?.salvageReserve ?? shop.salvageReserve ?? 0,
    autoShop: profile ? profile.autoShop : shop.autoBuy && owns(state, 'auto-shop'),
    autoExtract: profile ? profile.autoExtract : config?.sortie.autoExtract ?? false,
    extractHullPct: profile?.extractHullPct ?? config?.sortie.extractHullPct ?? 0.35,
    extractNow: false,
    furnacePush: false,
    researchNext: false,
    fabTracked: false,
    repeatRecipe: config?.foundry.repeatRecipe ?? null,
  }
  if (owns(state, 'spend-ratios') && !profile) {
    intent.spend = normalizeSpend(shop.ratios)
    intent.salvageReserve = shop.salvageReserve
  }
  const rules = profile?.rules ?? []
  if (owns(state, 'rule-builder') || owns(state, 'run-profiles')) {
    for (const rule of rules) {
      if (ruleFires(state, rule)) applyAction(intent, rule.then)
    }
  }
  return intent
}

export function shopCategorySpend(state: GameState, category: 'attack' | 'defense' | 'economy'): number {
  let total = 0
  for (const def of RUN_UPGRADES) {
    if (def.category !== category) continue
    const n = runPurchasedLevel(state, def.id)
    for (let i = 0; i < n; i += 1) total += runUpgradeCost(i)
  }
  return total
}

export function pickShopCategory(
  state: GameState,
  spend: ProcessSpendMix,
): 'attack' | 'defense' | 'economy' | null {
  const target = normalizeSpend(spend)
  const rows: Array<{ id: 'attack' | 'defense' | 'economy'; score: number }> = (
    ['attack', 'defense', 'economy'] as const
  ).map((id) => {
    const want = target[id]
    if (want <= 0) return { id, score: Number.POSITIVE_INFINITY }
    return { id, score: shopCategorySpend(state, id) / want }
  })
  rows.sort((a, b) => a.score - b.score || target[b.id] - target[a.id])
  const best = rows[0]
  if (!best || !Number.isFinite(best.score)) return null
  return best.id
}

/** Used so empty profile lists on old saves still get Farm / Push / Challenge. */
export function withDefaultProfiles(profiles: ProcessProfile[]): ProcessProfile[] {
  if (profiles.length > 0) return profiles
  return createDefaultProcessProfiles()
}

export function processShouldExtract(state: GameState): boolean {
  if (state.combat.docked) return false
  if (!hasHullLostOnce(state) && (state.combat.wave ?? 1) <= 1) return false
  const intent = evaluateProcessIntent(state)
  if (intent.extractNow) return owns(state, 'auto-extract') || owns(state, 'rule-builder')
  if (!intent.autoExtract) return false
  if (!owns(state, 'auto-extract') && !owns(state, 'run-profiles')) return false
  const max = state.combat.playerHullMax ?? 0
  if (max <= 0) return false
  return state.combat.playerHull / max < intent.extractHullPct
}
