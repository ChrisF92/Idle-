import type { GameState } from './types'
import { createInitialState, SAVE_KEY, SAVE_VERSION } from './state'

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  } catch {
    // Quota / private mode — ignore for skeleton
  }
}

function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<GameState> & { version?: number }
  if (parsed.version === SAVE_VERSION) {
    return parsed as GameState
  }

  // v1 → v2: add shipyard unlock lists + highestSector
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
        unlockedFrames: ['scout-frame', ...(v1.shipyard?.frameId === 'line-frame' ? ['line-frame'] : [])],
        unlockedModules: Array.from(
          new Set([
            'pulse-cannon',
            ...(v1.shipyard?.modules ?? []),
          ]),
        ),
      },
      combat: {
        ...base.combat,
        ...v1.combat,
        highestSector: Math.max(1, v1.combat?.sector ?? 1),
      },
      resources: {
        ...base.resources,
        ...v1.resources,
      },
      prestige: {
        ...base.prestige,
        ...v1.prestige,
      },
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
