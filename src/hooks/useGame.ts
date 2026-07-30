import { useEffect, useReducer, useRef } from 'react'
import type { GameState } from '../game/types'
import { loadOrCreateGame, saveGame, clearSave, importSave } from '../game/save'
import { tickGame, startCombat, resetGame } from '../game/tick'
import { createInitialState } from '../game/state'

type Action =
  | { type: 'replace'; state: GameState }
  | { type: 'tick'; now: number }
  | { type: 'engage' }
  | { type: 'hard-reset' }

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'replace':
      return action.state
    case 'tick':
      return tickGame(state, action.now)
    case 'engage':
      return startCombat(state)
    case 'hard-reset':
      clearSave()
      return resetGame()
    default:
      return state
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadOrCreateGame())
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const id = window.setInterval(() => {
      dispatch({ type: 'tick', now: Date.now() })
    }, 250)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    saveGame(state)
  }, [state])

  return {
    state,
    engage: () => dispatch({ type: 'engage' }),
    hardReset: () => dispatch({ type: 'hard-reset' }),
    applyImportedSave: (code: string) => {
      const imported = importSave(code)
      if (imported) dispatch({ type: 'replace', state: imported })
      return imported !== null
    },
    newGame: () => dispatch({ type: 'replace', state: createInitialState() }),
  }
}
