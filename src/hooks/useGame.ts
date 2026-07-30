import { useEffect, useReducer, useRef, useState } from 'react'
import type { GameState } from '../game/types'
import { loadOrCreateGame, saveGame, clearSave, importSave } from '../game/save'
import {
  tickGame,
  startCombat,
  resetGame,
  setCampaign,
  resumeCampaign,
} from '../game/tick'
import { applyOfflineCatchUp, type OfflineReport } from '../game/offline'
import {
  abandonChallenge,
  buyAiNode,
  buyChallengeShop,
  buyEssenceUpgrade,
  buyMatterShop,
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
  | { type: 'set-campaign'; on: boolean }
  | { type: 'resume-campaign' }
  | { type: 'upgrade-building'; buildingId: string }
  | { type: 'buy-research'; researchId: string }
  | { type: 'buy-essence'; upgradeId: string }
  | { type: 'buy-challenge-shop'; itemId: string }
  | { type: 'buy-matter-shop'; itemId: string }
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
    case 'set-campaign':
      return setCampaign(state, action.on)
    case 'resume-campaign':
      return resumeCampaign(state)
    case 'upgrade-building':
      return upgradeBuilding(state, action.buildingId)
    case 'buy-research':
      return buyResearch(state, action.researchId)
    case 'buy-essence':
      return buyEssenceUpgrade(state, action.upgradeId)
    case 'buy-challenge-shop':
      return buyChallengeShop(state, action.itemId)
    case 'buy-matter-shop':
      return buyMatterShop(state, action.itemId)
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

function loadWithOffline(): { state: GameState; report: OfflineReport | null } {
  const loaded = loadOrCreateGame()
  return applyOfflineCatchUp(loaded, Date.now())
}

export function useGame() {
  const initial = useRef<{ state: GameState; report: OfflineReport | null } | null>(null)
  if (!initial.current) {
    initial.current = loadWithOffline()
  }

  const [state, dispatch] = useReducer(reducer, initial.current.state)
  const [offlineReport, setOfflineReport] = useState<OfflineReport | null>(
    initial.current.report,
  )

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
    offlineReport,
    dismissOfflineReport: () => setOfflineReport(null),
    engage: () => dispatch({ type: 'engage' }),
    setCampaign: (on: boolean) => dispatch({ type: 'set-campaign', on }),
    resumeCampaign: () => dispatch({ type: 'resume-campaign' }),
    upgradeBuilding: (buildingId: string) =>
      dispatch({ type: 'upgrade-building', buildingId }),
    buyResearch: (researchId: string) => dispatch({ type: 'buy-research', researchId }),
    buyEssenceUpgrade: (upgradeId: string) =>
      dispatch({ type: 'buy-essence', upgradeId }),
    buyChallengeShop: (itemId: string) =>
      dispatch({ type: 'buy-challenge-shop', itemId }),
    buyMatterShop: (itemId: string) => dispatch({ type: 'buy-matter-shop', itemId }),
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
      if (!imported) return false
      const { state: caughtUp, report } = applyOfflineCatchUp(imported, Date.now())
      dispatch({ type: 'replace', state: caughtUp })
      setOfflineReport(report)
      return true
    },
    newGame: () => dispatch({ type: 'replace', state: createInitialState() }),
  }
}
