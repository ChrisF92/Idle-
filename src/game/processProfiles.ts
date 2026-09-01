/** Process 3.0 — WHEN/THEN engine, Farm / Push / Challenge / Custom profiles. */

import type {
  FoundryRecipeId,
  GameState,
  ProcessAction,
  ProcessCondition,
  ProcessNetworkPreset,
  ProcessProfile,
  ProcessRule,
  ProcessSpendMix,
  ProcessThenKind,
  ProcessWhenKind,
} from './types'
import { careerBestWave, hasHullLostOnce } from './progression'
import { RUN_UPGRADES, runPurchasedLevel, runUpgradeCost } from './workshop'
import { idleWorkers } from './catalog'

function scrapThisRun(state: GameState): number {
  if (state.combat.docked || !state.combat.sortieMark) {
    return Math.max(0, state.combat.lastSortie?.scrapEarned ?? 0)
  }
  return Math.max(0, (state.resources.scrap ?? 0) - (state.combat.sortieMark.scrap ?? 0))
}

function stockCount(state: GameState, id: string): number {
  return Math.max(0, state.foundry?.materials?.[id] ?? 0)
}

const WORKER_PRESET_LABELS: Record<ProcessNetworkPreset, string> = {
  push: 'Push',
  defence: 'Defence',
  farm: 'Farm',
  industry: 'Industry',
  research: 'Research',
  balanced: 'Balanced',
  custom: 'Custom',
}

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

export function spendDominantLabel(mix: ProcessSpendMix): 'ATTACK' | 'DEFENSE' | 'ECONOMY' {
  const spend = normalizeSpend(mix)
  if (spend.defense >= spend.attack && spend.defense >= spend.economy) return 'DEFENSE'
  if (spend.attack >= spend.economy) return 'ATTACK'
  return 'ECONOMY'
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
      furnacePreset: 'farm',
      foundryRepeat: null,
      researchAutoNext: false,
      rules: [
        {
          id: 'farm-economy',
          label: 'Bank Economy',
          enabled: true,
          join: 'and',
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
      furnacePreset: 'push',
      foundryRepeat: null,
      researchAutoNext: false,
      rules: [
        {
          id: 'push-dump-econ',
          label: 'Dump Economy',
          enabled: true,
          join: 'and',
          when: [{ kind: 'wave-of-best', value: 95 }],
          then: { kind: 'economy-target', economyPct: 0 },
        },
        {
          id: 'push-furnace',
          label: 'Light Furnace',
          enabled: true,
          join: 'and',
          when: [
            { kind: 'wave-of-best', value: 95 },
            { kind: 'ash-gte', value: 80 },
          ],
          then: { kind: 'furnace-push' },
        },
      ],
    },
    {
      id: 'blueprint',
      name: 'Blueprint',
      spend: { attack: 25, defense: 20, economy: 55 },
      salvageReserve: 10,
      autoExtract: false,
      extractHullPct: 0.3,
      autoShop: true,
      workerPreset: 'industry',
      furnacePreset: 'farm',
      foundryRepeat: null,
      researchAutoNext: false,
      rules: [],
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
      furnacePreset: 'push',
      foundryRepeat: null,
      researchAutoNext: false,
      rules: [
        {
          id: 'challenge-defense',
          label: 'Hold Hull',
          enabled: true,
          join: 'and',
          when: [{ kind: 'hull-lte', value: 35 }],
          then: { kind: 'spend-profile', spend: { attack: 20, defense: 70, economy: 10 } },
        },
      ],
    },
    {
      id: 'custom',
      name: 'Custom',
      spend: { attack: 40, defense: 30, economy: 30 },
      salvageReserve: 8,
      autoExtract: false,
      extractHullPct: 0.35,
      autoShop: false,
      workerPreset: 'balanced',
      furnacePreset: null,
      foundryRepeat: null,
      researchAutoNext: false,
      rules: [],
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
  furnacePreset: string | null
  furnaceTriggered: boolean
  researchNext: boolean
  fabTracked: boolean
  repeatRecipe: FoundryRecipeId | null
  workerPreset: ProcessNetworkPreset | null
  foundryTarget: FoundryRecipeId | null
  foundryStock: { recipeId: FoundryRecipeId; min: number } | null
  launchSortie: boolean
  switchProfileId: string | null
}

export function conditionMet(state: GameState, cond: ProcessCondition): boolean {
  const wave = Math.max(1, state.combat.wave ?? 1)
  const best = Math.max(1, careerBestWave(state), state.combat.bestWave ?? 0)
  switch (cond.kind) {
    case 'wave-gte':
      return wave >= Math.max(1, cond.value ?? 1)
    case 'wave-of-best':
      return wave * 100 >= best * Math.max(0, cond.value ?? 0)
    case 'threat': {
      const max = state.combat.playerHullMax ?? 0
      const hull = max > 0 ? (state.combat.playerHull ?? 0) / max : 1
      return hull <= 0.35
    }
    case 'queue-empty':
    case 'processor-idle':
      return !(state.foundry?.slots ?? []).some((slot) => slot.recipeId)
    case 'fabricator-idle':
      return (state.foundry?.fabrication ?? []).some((slot) => !slot.kind)
    case 'ash-gte':
      return (state.resources.choirAsh ?? 0) >= Math.max(0, cond.value ?? 0)
    case 'heat-gte':
      return (state.resources.heat ?? 0) >= Math.max(0, cond.value ?? 0)
    case 'hull-lte': {
      const max = state.combat.playerHullMax ?? 0
      if (max <= 0) return false
      return ((state.combat.playerHull ?? 0) / max) * 100 <= Math.max(0, cond.value ?? 35)
    }
    case 'shield-lte': {
      const max = state.combat.playerShieldMax ?? 0
      if (max <= 0) return false
      return ((state.combat.playerShield ?? 0) / max) * 100 <= Math.max(0, cond.value ?? 35)
    }
    case 'boss-active':
      return Boolean(state.combat.isBoss)
    case 'enemies-gte':
      return (state.combat.enemyUnits ?? []).filter((unit) => unit.hull > 0).length >= Math.max(0, cond.value ?? 1)
    case 'wave-time-gte':
      return (state.combat.fightElapsed ?? 0) >= Math.max(0, cond.value ?? 0)
    case 'salvage-gte':
      return (state.resources.salvage ?? 0) >= Math.max(0, cond.value ?? 0)
    case 'scrap-run-gte':
      return scrapThisRun(state) >= Math.max(0, cond.value ?? 0)
    case 'stock-lte': {
      if (!cond.recipeId) return false
      return stockCount(state, cond.recipeId) <= Math.max(0, cond.value ?? 0)
    }
    case 'stock-gte': {
      if (!cond.recipeId) return false
      return stockCount(state, cond.recipeId) >= Math.max(0, cond.value ?? 0)
    }
    case 'research-idle':
      return !state.hiveResearch?.active
    case 'workers-idle-gte':
      return idleWorkers(state) >= Math.max(0, cond.value ?? 1)
    case 'challenge-active':
      return Boolean(state.prestige.activeChallengeId)
    case 'profile-is':
      return Boolean(cond.profileId) && cfg(state)?.activeProfileId === cond.profileId
  }
}

export function ruleFires(state: GameState, rule: ProcessRule): boolean {
  if (!rule.enabled || rule.when.length === 0) return false
  const join = rule.join === 'or' && owns(state, 'logic-or') ? 'or' : 'and'
  if (join === 'or') return rule.when.some((cond) => conditionMet(state, cond))
  return rule.when.every((cond) => conditionMet(state, cond))
}

function applyAction(intent: ProcessIntent, action: ProcessAction): void {
  switch (action.kind) {
    case 'spend-profile':
    case 'spend-ratios':
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
    case 'foundry-target':
      intent.repeatRecipe = action.recipeId ?? intent.repeatRecipe
      intent.foundryTarget = action.recipeId ?? intent.foundryTarget
      break
    case 'foundry-stock':
      if (action.recipeId) {
        intent.foundryStock = { recipeId: action.recipeId, min: Math.max(0, action.stockMin ?? 0) }
      }
      break
    case 'furnace-push':
      intent.furnacePush = true
      intent.furnaceTriggered = true
      break
    case 'furnace-preset':
      intent.furnacePreset = action.furnacePreset ?? intent.furnacePreset
      intent.furnaceTriggered = true
      break
    case 'worker-preset':
      intent.workerPreset = action.workerPreset ?? intent.workerPreset
      break
    case 'research-next':
      intent.researchNext = true
      break
    case 'fab-tracked':
      intent.fabTracked = true
      break
    case 'launch-sortie':
      intent.launchSortie = true
      break
    case 'switch-profile':
      intent.switchProfileId = action.profileId ?? null
      break
  }
}

export function activeProcessProfile(state: GameState): ProcessProfile | null {
  if (!owns(state, 'process-profiles')) return null
  const id = cfg(state)?.activeProfileId
  if (!id) return null
  return (cfg(state)?.profiles ?? []).find((p) => p.id === id) ?? null
}

function rulesForIntent(state: GameState): ProcessRule[] {
  const profile = activeProcessProfile(state)
  if (profile) return profile.rules ?? []
  if (!owns(state, 'rule-builder')) return []
  return (cfg(state)?.profiles ?? []).find((p) => p.id === 'custom')?.rules ?? []
}

export function evaluateProcessIntent(state: GameState): ProcessIntent {
  const config = cfg(state)
  const profile = activeProcessProfile(state)
  const shop = config?.shop ?? { autoBuy: false, ratios: { attack: 50, defense: 30, economy: 20 }, salvageReserve: 0 }
  const intent: ProcessIntent = {
    spend: normalizeSpend(profile?.spend ?? shop.ratios),
    salvageReserve: profile?.salvageReserve ?? shop.salvageReserve ?? 0,
    autoShop: owns(state, 'sortie-auto-buy') && (profile ? profile.autoShop : shop.autoBuy),
    autoExtract: owns(state, 'auto-extract') && (profile ? profile.autoExtract : config?.sortie.autoExtract ?? false),
    extractHullPct: profile?.extractHullPct ?? config?.sortie.extractHullPct ?? 0.35,
    extractNow: false,
    furnacePush: false,
    furnacePreset: profile?.furnacePreset ?? null,
    furnaceTriggered: false,
    researchNext: Boolean(profile?.researchAutoNext),
    fabTracked: false,
    repeatRecipe: profile?.foundryRepeat ?? config?.foundry.repeatRecipe ?? null,
    workerPreset: profile?.workerPreset ?? null,
    foundryTarget: config?.foundry.targetRecipe ?? null,
    foundryStock: null,
    launchSortie: false,
    switchProfileId: null,
  }
  if (owns(state, 'spend-profiles') && !profile) {
    intent.spend = normalizeSpend(shop.ratios)
    intent.salvageReserve = shop.salvageReserve
  }
  if (owns(state, 'rule-builder') || owns(state, 'process-profiles')) {
    for (const rule of rulesForIntent(state)) {
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

/** Used so empty profile lists on old saves still get Farm / Push / Challenge / Custom. */
export function withDefaultProfiles(profiles: ProcessProfile[]): ProcessProfile[] {
  const defaults = createDefaultProcessProfiles()
  if (profiles.length === 0) return defaults
  const ids = new Set(profiles.map((p) => p.id))
  const extra = defaults.filter((row) => !ids.has(row.id))
  return extra.length ? [...profiles, ...extra] : profiles
}

export function processShouldExtract(state: GameState): boolean {
  if (state.combat.docked) return false
  if (!hasHullLostOnce(state) && (state.combat.wave ?? 1) <= 1) return false
  const intent = evaluateProcessIntent(state)
  if (intent.extractNow) return owns(state, 'auto-extract')
  if (!intent.autoExtract) return false
  if (!owns(state, 'auto-extract')) return false
  const max = state.combat.playerHullMax ?? 0
  if (max <= 0) return false
  return state.combat.playerHull / max < intent.extractHullPct
}

export const PROCESS_WHEN_OPTIONS: { id: ProcessWhenKind; label: string; needsValue?: boolean; needsRecipe?: boolean; suffix?: string }[] = [
  { id: 'wave-gte', label: 'Wave ≥', needsValue: true },
  { id: 'wave-of-best', label: 'Wave ≥ % of Best', needsValue: true, suffix: '%' },
  { id: 'hull-lte', label: 'Hull ≤ %', needsValue: true, suffix: '%' },
  { id: 'shield-lte', label: 'Shield ≤ %', needsValue: true, suffix: '%' },
  { id: 'boss-active', label: 'Boss active' },
  { id: 'enemies-gte', label: 'Enemies alive ≥', needsValue: true },
  { id: 'wave-time-gte', label: 'Time on current Wave ≥', needsValue: true, suffix: 's' },
  { id: 'salvage-gte', label: 'Salvage ≥', needsValue: true },
  { id: 'scrap-run-gte', label: 'Scrap earned this run ≥', needsValue: true },
  { id: 'ash-gte', label: 'Ash ≥', needsValue: true },
  { id: 'heat-gte', label: 'Heat ≥', needsValue: true },
  { id: 'processor-idle', label: 'Processor idle' },
  { id: 'fabricator-idle', label: 'Fabricator idle' },
  { id: 'stock-lte', label: 'Material stock ≤', needsValue: true, needsRecipe: true },
  { id: 'stock-gte', label: 'Material stock ≥', needsValue: true, needsRecipe: true },
  { id: 'research-idle', label: 'Research idle' },
  { id: 'workers-idle-gte', label: 'Worker Drones idle ≥', needsValue: true },
  { id: 'challenge-active', label: 'Challenge active' },
  { id: 'profile-is', label: 'Profile is active' },
]

export const PROCESS_THEN_OPTIONS: { id: ProcessThenKind; label: string }[] = [
  { id: 'spend-profile', label: 'Apply spending profile' },
  { id: 'spend-ratios', label: 'Set Attack / Defense / Economy' },
  { id: 'extract', label: 'Extract' },
  { id: 'furnace-preset', label: 'Set Furnace profile' },
  { id: 'furnace-push', label: 'Light Furnace' },
  { id: 'worker-preset', label: 'Assign Worker preset' },
  { id: 'foundry-target', label: 'Start Foundry target' },
  { id: 'foundry-stock', label: 'Maintain material stock' },
  { id: 'research-next', label: 'Start next Research' },
  { id: 'launch-sortie', label: 'Launch Sortie' },
  { id: 'repeat-recipe', label: 'Repeat recipe' },
  { id: 'fab-tracked', label: 'Fabricate tracked project' },
  { id: 'switch-profile', label: 'Switch automation profile' },
]

const FURNACE_PRESET_LABELS: Record<string, string> = {
  push: 'Push',
  farm: 'Farm',
  industry: 'Industry',
  research: 'Research',
}

function recipeName(id: string | null | undefined): string {
  return id ?? 'material'
}

export function formatProcessCondition(cond: ProcessCondition): string {
  const opt = PROCESS_WHEN_OPTIONS.find((row) => row.id === cond.kind)
  if (cond.kind === 'threat') return `Hull ≤ 35%`
  if (cond.kind === 'queue-empty') return 'Processor idle'
  if (cond.kind === 'stock-lte' || cond.kind === 'stock-gte') {
    const cmp = cond.kind === 'stock-lte' ? '≤' : '≥'
    return `${recipeName(cond.recipeId)} ${cmp} ${Math.max(0, cond.value ?? 0)}`
  }
  if (cond.kind === 'profile-is') return `Profile is ${cond.profileId ?? 'unset'}`
  if (!opt) return cond.kind
  if (!opt.needsValue) return opt.label
  const suffix = opt.suffix ?? ''
  if (opt.id === 'wave-of-best') return `Wave ≥ ${Math.max(0, cond.value ?? 0)}% of Best`
  if (opt.id === 'hull-lte') return `Hull ≤ ${Math.max(0, cond.value ?? 35)}%`
  if (opt.id === 'shield-lte') return `Shield ≤ ${Math.max(0, cond.value ?? 35)}%`
  return `${opt.label} ${Math.max(0, cond.value ?? 0)}${suffix}`
}

export function formatProcessAction(action: ProcessAction): string {
  switch (action.kind) {
    case 'spend-profile':
      return `Spend Profile → ${action.spend ? spendDominantLabel(action.spend) : 'CUSTOM'}`
    case 'spend-ratios': {
      const mix = normalizeSpend(action.spend ?? { attack: 50, defense: 30, economy: 20 })
      return `Ratio → ${mix.attack} / ${mix.defense} / ${mix.economy}`
    }
    case 'economy-target':
      return `Economy → ${Math.max(0, action.economyPct ?? 0)}%`
    case 'extract':
      return 'Extract'
    case 'furnace-preset':
      return `Furnace → ${action.furnacePreset ? FURNACE_PRESET_LABELS[action.furnacePreset] ?? 'Preset' : 'Preset'}`
    case 'furnace-push':
      return 'Light Furnace'
    case 'worker-preset':
      return `Workers → ${action.workerPreset ? WORKER_PRESET_LABELS[action.workerPreset] : 'Preset'}`
    case 'foundry-target':
    case 'repeat-recipe':
      return `Foundry → ${recipeName(action.recipeId)}`
    case 'foundry-stock':
      return `Keep ${recipeName(action.recipeId)} ≥ ${Math.max(0, action.stockMin ?? 0)}`
    case 'research-next':
      return 'Start next Research'
    case 'launch-sortie':
      return 'Launch Sortie'
    case 'fab-tracked':
      return 'Fabricate tracked project'
    case 'switch-profile':
      return `Profile → ${action.profileId ?? 'unset'}`
  }
}

export function formatProcessRule(rule: ProcessRule): { when: string[]; join: 'AND' | 'OR'; then: string } {
  return {
    when: rule.when.map(formatProcessCondition),
    join: rule.join === 'or' ? 'OR' : 'AND',
    then: formatProcessAction(rule.then),
  }
}

export function blankProcessCondition(): ProcessCondition {
  return { kind: 'wave-gte', value: 1 }
}

export function blankProcessAction(): ProcessAction {
  return { kind: 'spend-profile', spend: { attack: 20, defense: 70, economy: 10 } }
}

export function blankProcessRule(index: number): ProcessRule {
  return {
    id: `rule-${Date.now()}-${index}`,
    label: `Rule ${index + 1}`,
    enabled: true,
    join: 'and',
    when: [blankProcessCondition()],
    then: blankProcessAction(),
  }
}
