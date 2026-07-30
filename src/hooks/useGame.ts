import { useEffect, useReducer, useRef } from 'react'
import type { GameState } from '../game/types'
import { loadOrCreateGame, saveGame, clearSave, importSave } from '../game/save'
import { tickGame, startCombat, resetGame } from '../game/tick'
import {
  abandonChallenge,
  buyAiNode,
  buyResearch,
  enterChallenge,
  fitModule,
  performPrestige,
  selectFrame,
  unfitModule,
  unlockFrame,
  unlockModule,
  upgradeBuilding,
} from '../game/actions'
import { createInitialState } from '../game/state'

type Action =
  | { type: 'replace'; state: GameState }
  | { type: 'tick'; now: number }
  | { type: 'engage' }
  | { type: 'upgrade-building'; buildingId: string }
  | { type: 'buy-research'; researchId: string }
  | { type: 'buy-ai'; nodeId: string }
  | { type: 'unlock-frame'; frameId: string }
  | { type: 'select-frame'; frameId: string }
  | { type: 'unlock-module'; moduleId: string }
  | { type: 'fit-module'; moduleId: string }
  | { type: 'unfit-module'; moduleId: string }
  | { type: 'prestige' }
  | { type: 'enter-challenge'; challengeId: string }
  | { type: 'abandon-challenge' }
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
    case 'unlock-frame':
      return unlockFrame(state, action.frameId)
    case 'select-frame':
      return selectFrame(state, action.frameId)
    case 'unlock-module':
      return unlockModule(state, action.moduleId)
    case 'fit-module':
      return fitModule(state, action.moduleId)
    case 'unfit-module':
      return unfitModule(state, action.moduleId)
    case 'prestige':
      return performPrestige(state)
    case 'enter-challenge':
      return enterChallenge(state, action.challengeId)
    case 'abandon-challenge':
      return abandonChallenge(state)
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
    unlockFrame: (frameId: string) => dispatch({ type: 'unlock-frame', frameId }),
    selectFrame: (frameId: string) => dispatch({ type: 'select-frame', frameId }),
    unlockModule: (moduleId: string) => dispatch({ type: 'unlock-module', moduleId }),
    fitModule: (moduleId: string) => dispatch({ type: 'fit-module', moduleId }),
    unfitModule: (moduleId: string) => dispatch({ type: 'unfit-module', moduleId }),
    prestige: () => dispatch({ type: 'prestige' }),
    enterChallenge: (challengeId: string) =>
      dispatch({ type: 'enter-challenge', challengeId }),
    abandonChallenge: () => dispatch({ type: 'abandon-challenge' }),
    hardReset: () => dispatch({ type: 'hard-reset' }),
    applyImportedSave: (code: string) => {
      const imported = importSave(code)
      if (imported) dispatch({ type: 'replace', state: imported })
      return imported !== null
    },
    newGame: () => dispatch({ type: 'replace', state: createInitialState() }),
  }
}
