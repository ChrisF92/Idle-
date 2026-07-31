import type { GameState } from './types'
import { createInitialState, SAVE_KEY, SAVE_VERSION } from './state'
import { AI_NODES, isAiNodePermanent } from './catalog'

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

  return {
    ...combat,
    enemyFamily: combat.enemyFamily ?? '',
    enemyTags: combat.enemyTags ?? [],
    isBoss: combat.isBoss ?? false,
    highestSector: Math.max(0, combat.highestSector ?? 0),
    wave: Math.max(1, combat.wave ?? 1),
    campaign: combat.campaign ?? true,
    docked: combat.docked ?? false,
    intermissionLeft: Math.max(0, combat.intermissionLeft ?? 0),
    consecutiveLosses: combat.consecutiveLosses ?? 0,
    bossPhase: combat.bossPhase ?? 0,
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
  if (prestige.challengeClears && typeof prestige.challengeClears === 'object') {
    return { ...prestige.challengeClears }
  }
  const clears: Record<string, number> = {}
  for (const id of prestige.completedChallenges ?? []) {
    clears[id] = 1
  }
  return clears
}

function withPrestigeDefaults(
  prestige: (GameState['prestige'] & { completedChallenges?: string[] }) | undefined,
): GameState['prestige'] {
  return {
    prestigeCount: prestige?.prestigeCount ?? 0,
    activeChallengeId: prestige?.activeChallengeId ?? null,
    challengeClears: migrateChallengeClears(prestige ?? {}),
    shop: prestige?.shop ?? [],
    matterShop: prestige?.matterShop ?? [],
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
  if (!base) return { ...fallback, assignments: { ...fallback.assignments } }

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

  return {
    workerDrones: workers,
    combatDrones: base.combatDrones ?? 0,
    assignments,
    manufactureProgress: base.manufactureProgress ?? 0,
  }
}

function withMetaDefaults(
  meta: GameState['meta'] | undefined,
  highestSector: number,
): GameState['meta'] {
  const completed = meta?.completedAchievements ?? []
  return {
    highestSectorEver: Math.max(meta?.highestSectorEver ?? 0, highestSector),
    act1Cleared: meta?.act1Cleared ?? false,
    seenOnboarding: meta?.seenOnboarding ?? [],
    combatDronesUnlocked: meta?.combatDronesUnlocked ?? false,
    aiUnlocked: meta?.aiUnlocked ?? completed.length > 0,
    completedAchievements: completed,
  }
}

function withAiDefaults(ai: GameState['ai'] | undefined): GameState['ai'] {
  const purchased = ai?.purchased ?? []
  // Drop unknown ids; keep both permanent and doctrines as stored.
  const known = new Set(AI_NODES.map((n) => n.id))
  return { purchased: purchased.filter((id) => known.has(id)) }
}

function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<GameState> & {
    version?: number
    prestige?: GameState['prestige'] & { completedChallenges?: string[] }
  }

  if (parsed.version === SAVE_VERSION) {
    const state = parsed as GameState
    const base = createInitialState()
    const combat = withCombatDefaults(state.combat)
    return {
      ...state,
      resources: withResourcesDefaults(state.resources, base.resources),
      combat,
      shipyard: withShipyardDefaults(state.shipyard, base.shipyard),
      base: migrateBase(state.base, base.base),
      essence: withEssenceDefaults(state),
      prestige: withPrestigeDefaults(state.prestige),
      codex: withCodexDefaults(state.codex),
      ai: withAiDefaults(state.ai),
      meta: withMetaDefaults(state.meta, combat.highestSector),
    }
  }

  if (
    parsed.version === 1 ||
    parsed.version === 2 ||
    parsed.version === 3 ||
    parsed.version === 4 ||
    parsed.version === 5 ||
    parsed.version === 6 ||
    parsed.version === 7 ||
    parsed.version === 8 ||
    parsed.version === 9 ||
    parsed.version === 10 ||
    parsed.version === 11 ||
    parsed.version === 12
  ) {
    const base = createInitialState()
    const prev = parsed as GameState & {
      prestige?: GameState['prestige'] & { completedChallenges?: string[] }
    }
    const oldHighest = prev.combat?.highestSector ?? prev.combat?.sector ?? 1
    const clearedApprox =
      parsed.version === 10 || parsed.version === 11
        ? Math.max(0, prev.combat?.highestSector ?? 0)
        : Math.max(0, oldHighest - 1)
    const combat = withCombatDefaults({
      ...base.combat,
      ...prev.combat,
      highestSector: clearedApprox,
      wave: 1,
      playerUnits: [],
      enemyUnits: [],
      fx: [],
      inFight: false,
    })
    const ai = withAiDefaults(prev.ai)
    // Older saves treated all AI as run-scoped; keep permanents after migrate.
    ai.purchased = ai.purchased.filter((id) => {
      const def = AI_NODES.find((n) => n.id === id)
      return def ? isAiNodePermanent(def) || def.kind === 'doctrine' : false
    })
    return {
      ...base,
      ...prev,
      version: SAVE_VERSION,
      resources: withResourcesDefaults(prev.resources, base.resources),
      combat,
      shipyard: withShipyardDefaults(prev.shipyard, base.shipyard),
      base: migrateBase(prev.base, base.base),
      essence: withEssenceDefaults(prev),
      prestige: withPrestigeDefaults(prev.prestige),
      codex: withCodexDefaults(prev.codex),
      ai,
      meta: withMetaDefaults(prev.meta, clearedApprox),
    }
  }

  return null
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
