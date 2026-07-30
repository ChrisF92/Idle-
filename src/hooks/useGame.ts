import { useEffect, useReducer, useRef } from 'react'
import type { GameState } from '../game/types'
import { loadOrCreateGame, saveGame, clearSave, importSave } from '../game/save'
import { tickGame, startCombat, resetGame } from '../game/tick'
import { buyAiNode, buyResearch, upgradeBuilding } from '../game/actions'
import { createInitialState } from '../game/state'

type Action =
  | { type: 'replace'; state: GameState }
  | { type: 'tick'; now: number }
  | { type: 'engage' }
  | { type: 'upgrade-building'; buildingId: string }
  | { type: 'buy-research'; researchId: string }
  | { type: 'buy-ai'; nodeId: string }
  | { type: 'hard-reset' }

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'replace':
      return action.state
    case 'tick':
      return tickGame(state, action.now)
    case 'engage':
      return startCombat(state)
    case 'upgrade-building':
      return upgradeBuilding(state, action.buildingId)
    case 'buy-research':
      return buyResearch(state, action.researchId)
    case 'buy-ai':
      return buyAiNode(state, action.nodeId)
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
    upgradeBuilding: (buildingId: string) =>
      dispatch({ type: 'upgrade-building', buildingId }),
    buyResearch: (researchId: string) => dispatch({ type: 'buy-research', researchId }),
    buyAiNode: (nodeId: string) => dispatch({ type: 'buy-ai', nodeId }),
    hardReset: () => dispatch({ type: 'hard-reset' }),
    applyImportedSave: (code: string) => {
      const imported = importSave(code)
      if (imported) dispatch({ type: 'replace', state: imported })
      return imported !== null
    },
    newGame: () => dispatch({ type: 'replace', state: createInitialState() }),
  }
}
