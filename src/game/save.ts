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
  return {
    ...combat,
    enemyFamily: combat.enemyFamily ?? '',
    enemyTags: combat.enemyTags ?? [],
    enemyDamage: combat.enemyDamage ?? 0,
    isBoss: combat.isBoss ?? false,
    highestSector: Math.max(1, combat.highestSector ?? combat.sector ?? 1),
    campaign: combat.campaign ?? true,
    walled: combat.walled ?? false,
    repairTimer: combat.repairTimer ?? 0,
    consecutiveLosses: combat.consecutiveLosses ?? 0,
    stance: combat.stance ?? 'skirmish',
    bossPhase: combat.bossPhase ?? 0,
  }
}

function withEssenceDefaults(state: Partial<GameState>): GameState['essence'] {
  return {
    purchased: state.essence?.purchased ?? [],
  }
}

function withPrestigeDefaults(prestige: GameState['prestige'] | undefined): GameState['prestige'] {
  return {
    prestigeCount: prestige?.prestigeCount ?? 0,
    activeChallengeId: prestige?.activeChallengeId ?? null,
    completedChallenges: prestige?.completedChallenges ?? [],
    shop: prestige?.shop ?? [],
  }
}

function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<GameState> & { version?: number }
  if (parsed.version === SAVE_VERSION) {
    const state = parsed as GameState
    return {
      ...state,
      combat: withCombatDefaults(state.combat),
      essence: withEssenceDefaults(state),
      prestige: withPrestigeDefaults(state.prestige),
    }
  }

  if (parsed.version === 1) {
    const base = createInitialState()
    const v1 = parsed as GameState
    return {
      ...base,
      ...v1,
      version: SAVE_VERSION,
      shipyard: {
        frameId: v1.shipyard?.frameId ?? 'scout-frame',
        modules: v1.shipyard?.modules ?? ['pulse-cannon'],
        unlockedFrames: [
          'scout-frame',
          ...(v1.shipyard?.frameId === 'line-frame' ? ['line-frame'] : []),
        ],
        unlockedModules: Array.from(
          new Set(['pulse-cannon', ...(v1.shipyard?.modules ?? [])]),
        ),
      },
      combat: withCombatDefaults({
        ...base.combat,
        ...v1.combat,
        highestSector: Math.max(1, v1.combat?.sector ?? 1),
      }),
      resources: {
        ...base.resources,
        ...v1.resources,
      },
      prestige: withPrestigeDefaults(v1.prestige),
      essence: withEssenceDefaults(v1),
    }
  }

  if (parsed.version === 2 || parsed.version === 3 || parsed.version === 4 || parsed.version === 5) {
    const base = createInitialState()
    const prev = parsed as GameState
    return {
      ...base,
      ...prev,
      version: SAVE_VERSION,
      combat: withCombatDefaults({
        ...base.combat,
        ...prev.combat,
      }),
      shipyard: {
        ...base.shipyard,
        ...prev.shipyard,
        unlockedFrames: prev.shipyard?.unlockedFrames ?? base.shipyard.unlockedFrames,
        unlockedModules: prev.shipyard?.unlockedModules ?? base.shipyard.unlockedModules,
      },
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
