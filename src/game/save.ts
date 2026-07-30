import type { GameState } from './types'
import { createInitialState, SAVE_KEY, SAVE_VERSION } from './state'

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  } catch {
    // Quota / private mode — ignore for skeleton
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GameState
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.version !== SAVE_VERSION) {
      // Future: run migrations. For now, reject unknown versions.
      return null
    }
    return parsed
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
    const parsed = JSON.parse(json) as GameState
    if (!parsed?.version || parsed.version !== SAVE_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY)
}
