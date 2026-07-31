import type { GameState } from './types'
import { createInitialState, SAVE_KEY, SAVE_VERSION } from './state'

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
      weapons: (u.weapons ?? []).map((w) => ({
        ...w,
        range: w.range ?? 90,
      })),
    }))

  return {
    ...combat,
    enemyFamily: combat.enemyFamily ?? '',
    enemyTags: combat.enemyTags ?? [],
    isBoss: combat.isBoss ?? false,
    highestSector: Math.max(1, combat.highestSector ?? combat.sector ?? 1),
    campaign: combat.campaign ?? true,
    consecutiveLosses: combat.consecutiveLosses ?? 0,
    bossPhase: combat.bossPhase ?? 0,
    playerShield: combat.playerShield ?? 0,
    playerShieldMax: combat.playerShieldMax ?? 0,
    playerUnits: withUnitDefaults(combat.playerUnits),
    enemyUnits: withUnitDefaults(combat.enemyUnits),
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

function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<GameState> & {
    version?: number
    prestige?: GameState['prestige'] & { completedChallenges?: string[] }
  }

  if (parsed.version === SAVE_VERSION) {
    const state = parsed as GameState
    const base = createInitialState()
    return {
      ...state,
      resources: withResourcesDefaults(state.resources, base.resources),
      combat: withCombatDefaults(state.combat),
      shipyard: withShipyardDefaults(state.shipyard, base.shipyard),
      essence: withEssenceDefaults(state),
      prestige: withPrestigeDefaults(state.prestige),
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
    parsed.version === 8
  ) {
    const base = createInitialState()
    const prev = parsed as GameState & {
      prestige?: GameState['prestige'] & { completedChallenges?: string[] }
    }
    return {
      ...base,
      ...prev,
      version: SAVE_VERSION,
      resources: withResourcesDefaults(prev.resources, base.resources),
      combat: withCombatDefaults({
        ...base.combat,
        ...prev.combat,
        playerUnits: [],
        enemyUnits: [],
        fx: [],
        inFight: false,
      }),
      shipyard: withShipyardDefaults(prev.shipyard, base.shipyard),
      essence: withEssenceDefaults(prev),
      prestige: withPrestigeDefaults(prev.prestige),
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
