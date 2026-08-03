import type {
  CoreAttrId,
  CoreState,
  GameState,
  SignalCoreInstance,
  SignalCoresState,
} from './types'
import { createInitialState, SAVE_KEY, SAVE_VERSION } from './state'
import { AI_NODES } from './catalog'
import { CORE_ATTR_IDS, createEmptyCoreState } from './core'
import {
  SIGNAL_CORE_MAX_RANK,
  createEmptySignalCoresState,
  getSignalCoreDef,
} from './signalCores'

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  } catch {
    // Quota / private mode — ignore for skeleton
  }
}

function withCombatDefaults(combat: GameState['combat']): GameState['combat'] {
  const withUnitDefaults = <T extends GameState['combat']['playerUnits'][number]>(
    units: T[] | undefined,
  ): T[] =>
    (units ?? []).map((u) => ({
      ...u,
      x: u.x ?? 0,
      y: u.y ?? 0,
      speed: u.speed ?? 0,
      engageRange: u.engageRange ?? 0,
      kite: u.kite ?? false,
      phaseWarnLeft: u.phaseWarnLeft ?? 0,
      weapons: (u.weapons ?? []).map((w) => ({
        ...w,
        range: w.range ?? 90,
        telegraphDuration: w.telegraphDuration ?? 0,
        telegraphLeft: w.telegraphLeft ?? 0,
      })),
    }))

  const mode = combat.mode === 'paused' || combat.mode === 'push' ? combat.mode : combat.docked ? 'paused' : 'push'

  return {
    ...combat,
    sector: Math.max(1, combat.sector ?? 1),
    enemyFamily: combat.enemyFamily ?? '',
    enemyTags: combat.enemyTags ?? [],
    isBoss: combat.isBoss ?? false,
    highestSector: Math.max(0, combat.highestSector ?? 0),
    wave: Math.max(1, combat.wave ?? 1),
    bestWaveThisRun: Math.max(0, combat.bestWaveThisRun ?? 0),
    checkpointWave: Math.max(1, combat.checkpointWave ?? 1),
    mode,
    campaign: combat.campaign ?? mode === 'push',
    docked: combat.docked ?? mode === 'paused',
    consecutiveLosses: combat.consecutiveLosses ?? 0,
    bossPhase: combat.bossPhase ?? 0,
    fightElapsed: Math.max(0, Number(combat.fightElapsed ?? 0) || 0),
    expeditionStartedAt: Math.max(0, Number(combat.expeditionStartedAt ?? 0) || 0),
    runSalvageEarned: Math.max(0, Number(combat.runSalvageEarned ?? 0) || 0),
    runScrapEarned: Math.max(0, Number(combat.runScrapEarned ?? 0) || 0),
    estimatedPrestigeMatter: Math.max(0, Number(combat.estimatedPrestigeMatter ?? 0) || 0),
    upgrades:
      combat.upgrades && typeof combat.upgrades === 'object' && !Array.isArray(combat.upgrades)
        ? Object.fromEntries(
            Object.entries(combat.upgrades)
              .map(([id, n]) => [id, Math.max(0, Math.floor(Number(n) || 0))] as const)
              .filter(([, n]) => n > 0),
          )
        : {},
    lastRunSummary: combat.lastRunSummary ?? null,
    playerShield: combat.playerShield ?? 0,
    playerShieldMax: combat.playerShieldMax ?? 0,
    playerUnits: withUnitDefaults(combat.playerUnits),
    enemyUnits: withUnitDefaults(combat.enemyUnits),
    projectiles: combat.projectiles ?? [],
    fx: combat.fx ?? [],
  }
}

function withEssenceDefaults(state: Partial<GameState>): GameState['essence'] {
  return {
    purchased: state.essence?.purchased ?? [],
  }
}

function migrateChallengeClears(
  prestige: Partial<GameState['prestige']> & {
    completedChallenges?: string[]
  },
): Record<string, number> {
  if (
    prestige.challengeClears &&
    typeof prestige.challengeClears === 'object' &&
    !Array.isArray(prestige.challengeClears)
  ) {
    return { ...prestige.challengeClears }
  }
  const clears: Record<string, number> = {}
  for (const id of prestige.completedChallenges ?? []) {
    clears[id] = 1
  }
  return clears
}

/** Legacy string[] shop ownership → each id at rank 1. */
function migrateShopRanks(raw: unknown): Record<string, number> {
  if (!raw) return {}
  if (Array.isArray(raw)) {
    const ranks: Record<string, number> = {}
    for (const id of raw) {
      if (typeof id === 'string') ranks[id] = 1
    }
    return ranks
  }
  if (typeof raw === 'object') {
    const ranks: Record<string, number> = {}
    for (const [id, n] of Object.entries(raw as Record<string, unknown>)) {
      const rank = Math.floor(Number(n))
      if (rank > 0) ranks[id] = rank
    }
    return ranks
  }
  return {}
}

function withPrestigeDefaults(
  prestige: (GameState['prestige'] & { completedChallenges?: string[] }) | undefined,
): GameState['prestige'] {
  return {
    prestigeCount: prestige?.prestigeCount ?? 0,
    activeChallengeId: prestige?.activeChallengeId ?? null,
    challengeClears: migrateChallengeClears(prestige ?? {}),
    shop: migrateShopRanks(prestige?.shop),
    matterShop: migrateShopRanks(prestige?.matterShop),
  }
}

function withShipyardDefaults(
  shipyard: GameState['shipyard'] | undefined,
  base: GameState['shipyard'],
): GameState['shipyard'] {
  return {
    ...base,
    ...shipyard,
    unlockedFrames: shipyard?.unlockedFrames ?? base.unlockedFrames,
    unlockedModules: shipyard?.unlockedModules ?? base.unlockedModules,
    modules: shipyard?.modules ?? base.modules,
    frameId: shipyard?.frameId ?? base.frameId,
    moduleLevels: shipyard?.moduleLevels ?? {},
    frameLocked: shipyard?.frameLocked ?? false,
  }
}

function withResourcesDefaults(
  resources: Partial<GameState['resources']> | undefined,
  base: GameState['resources'],
): GameState['resources'] {
  return {
    ...base,
    ...resources,
    salvage: resources?.salvage ?? 0,
  }
}

function withCodexDefaults(
  codex: GameState['codex'] | undefined,
): GameState['codex'] {
  const allowed = new Set(['swarm', 'armored', 'ethereal', 'divine', 'titan'])
  const seen = (codex?.seenFamilies ?? []).filter((f) => allowed.has(f))
  return { seenFamilies: seen }
}

function migrateBase(
  base: GameState['base'] | undefined,
  fallback: GameState['base'],
): GameState['base'] {
  if (!base) {
    return {
      ...fallback,
      assignments: { ...fallback.assignments },
      fabProject: null,
    }
  }

  // Legacy building levels → approximate worker drones + scrap/power assignments.
  const buildings = base.buildings
  let workers = base.workerDrones ?? 0
  const assignments: Record<string, number> = { ...(base.assignments ?? {}) }

  if (buildings && workers <= 0) {
    const scrap = buildings.scrapYard ?? 0
    const power = buildings.powerCell ?? 0
    const sensor = buildings.sensorArray ?? 0
    const foundry = buildings.foundry ?? 0
    const hangar = buildings.workDroneHangar ?? 0
    workers = Math.max(2, scrap + power + sensor + foundry + hangar)
    if (scrap > 0) assignments['scrap-field'] = (assignments['scrap-field'] ?? 0) + scrap
    if (power > 0) assignments['power-grid'] = (assignments['power-grid'] ?? 0) + power
    if (sensor > 0) assignments['sensor-net'] = (assignments['sensor-net'] ?? 0) + sensor
    if (foundry > 0) assignments['alloy-foundry'] = (assignments['alloy-foundry'] ?? 0) + foundry
    if (hangar > 0) assignments['drone-fab'] = (assignments['drone-fab'] ?? 0) + hangar
  }

  const fab = base.fabProject
  const fabProject =
    fab &&
    typeof fab.moduleId === 'string' &&
    fab.moduleId.length > 0
      ? {
          moduleId: fab.moduleId,
          contributed: { ...(fab.contributed ?? {}) },
          progress: Math.max(0, Math.min(1, fab.progress ?? 0)),
        }
      : null

  return {
    workerDrones: workers,
    assignments,
    manufactureProgress: base.manufactureProgress ?? 0,
    fabProject,
  }
}

function withMetaDefaults(
  meta: GameState['meta'] | undefined,
  highestSector: number,
): GameState['meta'] {
  const completed = meta?.completedAchievements ?? []
  const completions: Record<string, number> = {}
  if (meta?.achievementCompletions && typeof meta.achievementCompletions === 'object') {
    for (const [id, n] of Object.entries(meta.achievementCompletions)) {
      const v = Math.floor(Number(n))
      if (v > 0) completions[id] = v
    }
  }
  // Backfill one-off completions for older saves.
  for (const id of completed) {
    if (completions[id] == null) completions[id] = 1
  }
  const laborRaw = meta?.laborProfile
  const laborProfile =
    laborRaw === 'scrap' ||
    laborRaw === 'data' ||
    laborRaw === 'foundry-safe' ||
    laborRaw === 'balanced'
      ? laborRaw
      : 'balanced'

  return {
    highestSectorEver: Math.max(meta?.highestSectorEver ?? 0, highestSector),
    highestWaveEver: Math.max(0, Math.floor(Number(meta?.highestWaveEver ?? 0))),
    act1Cleared: meta?.act1Cleared ?? false,
    ascensionCount: Math.max(0, Math.floor(Number(meta?.ascensionCount ?? 0))),
    seenOnboarding: meta?.seenOnboarding ?? [],
    aiUnlocked: meta?.aiUnlocked ?? completed.length > 0,
    codexUnlocked: meta?.codexUnlocked === true,
    laborProfile,
    completedAchievements: completed,
    achievementCompletions: completions,
    lifetimeSectorClears: Math.max(0, Math.floor(Number(meta?.lifetimeSectorClears ?? 0))),
    lifetimeFabCrafts: Math.max(0, Math.floor(Number(meta?.lifetimeFabCrafts ?? 0))),
    lifetimeCoreMerges: Math.max(0, Math.floor(Number(meta?.lifetimeCoreMerges ?? 0))),
    lifetimeWaveClears: Math.max(0, Math.floor(Number(meta?.lifetimeWaveClears ?? 0))),
    lifetimeDronesBuilt: Math.max(0, Math.floor(Number(meta?.lifetimeDronesBuilt ?? 0))),
    discoveredModules: [...(meta?.discoveredModules ?? [])],
    moduleMastery: { ...(meta?.moduleMastery ?? {}) },
    signalCoresCarryOver: meta?.signalCoresCarryOver ?? false,
    // Progressed careers skip the starter death → Plate → salvage lesson.
    starterCombatLesson: (() => {
      const raw = Math.floor(Number(meta?.starterCombatLesson))
      if (Number.isFinite(raw) && raw >= 0) return Math.min(2, raw)
      return (meta?.highestSectorEver ?? 0) > 0 || highestSector > 0 ? 2 : 0
    })(),
  }
}

function withSignalCoresDefaults(
  raw: GameState['signalCores'] | undefined,
): SignalCoresState {
  const empty = createEmptySignalCoresState()
  if (!raw || typeof raw !== 'object') return empty
  const inventory: SignalCoreInstance[] = []
  const seen = new Set<string>()
  for (const item of raw.inventory ?? []) {
    if (!item || typeof item !== 'object') continue
    const uid = typeof item.uid === 'string' ? item.uid : ''
    const defId = typeof item.defId === 'string' ? item.defId : ''
    if (!uid || !defId || seen.has(uid) || !getSignalCoreDef(defId)) continue
    const rank = Math.floor(Number(item.rank ?? 1))
    seen.add(uid)
    inventory.push({
      uid,
      defId,
      rank: Number.isFinite(rank)
        ? Math.max(1, Math.min(SIGNAL_CORE_MAX_RANK, rank))
        : 1,
    })
  }
  const uidSet = new Set(inventory.map((c) => c.uid))
  const equipped: Record<string, string> = {}
  if (raw.equipped && typeof raw.equipped === 'object') {
    for (const [slot, uid] of Object.entries(raw.equipped)) {
      if (typeof uid === 'string' && uidSet.has(uid) && /^(assault|ward|signal)-\d+$/.test(slot)) {
        equipped[slot] = uid
      }
    }
  }
  return { inventory, equipped }
}

function withPartsDefaults(
  parts: GameState['parts'] | undefined,
): GameState['parts'] {
  if (!parts || typeof parts !== 'object' || Array.isArray(parts)) return {}
  const out: Record<string, number> = {}
  for (const [id, n] of Object.entries(parts)) {
    const qty = Math.floor(Number(n))
    if (qty > 0) out[id] = qty
  }
  return out
}

function withCoreDefaults(core: GameState['core'] | undefined): CoreState {
  const empty = createEmptyCoreState()
  if (!core || typeof core !== 'object') return empty
  const ranks = { ...empty.ranks }
  const progress = { ...empty.progress }
  for (const id of CORE_ATTR_IDS) {
    const r = Math.floor(Number(core.ranks?.[id as CoreAttrId] ?? 0))
    const p = Number(core.progress?.[id as CoreAttrId] ?? 0)
    ranks[id] = Number.isFinite(r) && r > 0 ? r : 0
    progress[id] = Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 0
  }
  return { ranks, progress }
}

function withAiDefaults(ai: GameState['ai'] | undefined): GameState['ai'] {
  const purchased = ai?.purchased ?? []
  // Drop unknown ids; keep both permanent and doctrines as stored.
  const known = new Set(AI_NODES.map((n) => n.id))
  return { purchased: purchased.filter((id) => known.has(id)) }
}

function backfillCodexUnlocked(
  meta: GameState['meta'],
  research: GameState['research'] | undefined,
  codex: GameState['codex'] | undefined,
): GameState['meta'] {
  if (meta.codexUnlocked) return meta
  const researched = research?.unlocked?.includes('tactical-codex') ?? false
  const hadIntel = (codex?.seenFamilies?.length ?? 0) > 0 && researched
  if (!researched && !hadIntel) return meta
  return { ...meta, codexUnlocked: true }
}

/**
 * Phase 1 Expedition save format (v21).
 * Older saves are intentionally rejected — clean career reset.
 */
function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<GameState> & { version?: number }

  if (parsed.version !== SAVE_VERSION) return null

  const state = parsed as GameState
  const base = createInitialState()
  const combat = withCombatDefaults(state.combat)
  const codex = withCodexDefaults(state.codex)
  const meta = backfillCodexUnlocked(
    withMetaDefaults(state.meta, combat.highestSector),
    state.research,
    codex,
  )
  return {
    ...state,
    version: SAVE_VERSION,
    resources: withResourcesDefaults(state.resources, base.resources),
    combat,
    shipyard: withShipyardDefaults(state.shipyard, base.shipyard),
    base: migrateBase(state.base, base.base),
    essence: withEssenceDefaults(state),
    prestige: withPrestigeDefaults(state.prestige),
    codex,
    ai: withAiDefaults(state.ai),
    meta,
    core: withCoreDefaults(state.core),
    signalCores: withSignalCoresDefaults(state.signalCores),
    parts: withPartsDefaults(state.parts),
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return migrate(JSON.parse(raw))
  } catch {
    return null
  }
}

export function loadOrCreateGame(now = Date.now()): GameState {
  return loadGame() ?? createInitialState(now)
}

export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))))
}

export function importSave(code: string): GameState | null {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())))
    return migrate(JSON.parse(json))
  } catch {
    return null
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY)
}
