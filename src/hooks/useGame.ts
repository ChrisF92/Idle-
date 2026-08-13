import { useEffect, useReducer, useRef, useState } from 'react'
import type { GameState, LaborProfile, PartType } from '../game/types'
import { loadOrCreateGame, saveGame, clearSave, importSave } from '../game/save'
import {
  tickGame,
  startCombat,
  resetGame,
  setCampaign,
  setDocked,
  warpToSector,
} from '../game/tick'
import { applyOfflineCatchUp, type OfflineReport } from '../game/offline'
import {
  abandonChallenge,
  assignWorker,
  autoBalanceWorkers,
  buyAiNode,
  buyChallengeShop,
  buyEssenceUpgrade,
  buyMatterShop,
  buyResearch,
  clearFabProject,
  clearWorkerAssignments,
  depositFabPart,
  enterChallenge,
  fillStationWorkers,
  fitModule,
  investPartMastery,
  launchFabProject,
  performAscension,
  performPrestige,
  performRebuild,
  pickCoreMilestone,
  selectFrame,
  sellPart,
  setLaborProfile,
  startFabProject,
  unfitModule,
  unequipAllModules,
  unlockFrame,
  unlockModule,
  upgradeCheapestModule,
  upgradeModule,
  withdrawFabPart,
  equipSignalCore,
  unequipSignalCore,
  mergeSignalCores,
} from '../game/actions'
import { acknowledgeOnboarding, syncCompletedGuides } from '../game/progression'
import { applyDevAction, type DevAction } from '../game/dev'
import { createInitialState } from '../game/state'

type Action =
  | { type: 'replace'; state: GameState }
  | { type: 'tick'; now: number }
  | { type: 'engage' }
  | { type: 'set-campaign'; on: boolean }
  | { type: 'set-docked'; docked: boolean }
  | { type: 'warp'; sector: number }
  | { type: 'assign-worker'; stationId: string; delta: number }
  | { type: 'auto-balance-workers'; profile?: LaborProfile }
  | { type: 'set-labor-profile'; profile: LaborProfile }
  | { type: 'clear-worker-assignments' }
  | { type: 'fill-station'; stationId: string }
  | { type: 'sync-guides'; tab: import('../game/types').TabId }
  | { type: 'start-fab'; moduleId: string }
  | { type: 'launch-fab'; moduleId: string }
  | { type: 'clear-fab' }
  | { type: 'deposit-fab'; partType: PartType; qty?: number }
  | { type: 'withdraw-fab'; partType: PartType; qty?: number }
  | { type: 'sell-part'; partId: string; qty?: number }
  | { type: 'invest-mastery'; moduleId: string }
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
  | { type: 'upgrade-module'; moduleId: string }
  | {
      type: 'pick-milestone'
      moduleId: string
      milestoneId: string
      choiceId: string
    }
  | { type: 'rebuild'; hangar: { frameId: string; modules: string[] } }
  | { type: 'unequip-all' }
  | { type: 'upgrade-cheapest' }
  | { type: 'ack-onboarding'; tipId: string }
  | { type: 'prestige' }
  | { type: 'ascend' }
  | { type: 'enter-challenge'; challengeId: string }
  | { type: 'abandon-challenge' }
  | { type: 'equip-core'; uid: string; slotKey: string }
  | { type: 'unequip-core'; slotKey: string }
  | { type: 'merge-cores'; defId: string; rank: number }
  | { type: 'hard-reset' }
  | { type: 'dev'; action: DevAction }

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
    case 'set-docked':
      return setDocked(state, action.docked)
    case 'warp':
      return warpToSector(state, action.sector)
    case 'assign-worker':
      return assignWorker(state, action.stationId, action.delta)
    case 'auto-balance-workers':
      return autoBalanceWorkers(state, action.profile)
    case 'set-labor-profile':
      return setLaborProfile(state, action.profile)
    case 'clear-worker-assignments':
      return clearWorkerAssignments(state)
    case 'fill-station':
      return fillStationWorkers(state, action.stationId)
    case 'sync-guides':
      return syncCompletedGuides(state, action.tab)
    case 'start-fab':
      return startFabProject(state, action.moduleId)
    case 'launch-fab':
      return launchFabProject(state, action.moduleId)
    case 'clear-fab':
      return clearFabProject(state)
    case 'deposit-fab':
      return depositFabPart(state, action.partType, action.qty ?? 1)
    case 'withdraw-fab':
      return withdrawFabPart(state, action.partType, action.qty ?? 1)
    case 'sell-part':
      return sellPart(state, action.partId, action.qty ?? 1)
    case 'invest-mastery':
      return investPartMastery(state, action.moduleId)
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
    case 'upgrade-module':
      return upgradeModule(state, action.moduleId)
    case 'pick-milestone':
      return pickCoreMilestone(state, action.moduleId, action.milestoneId, action.choiceId)
    case 'rebuild':
      return performRebuild(state, action.hangar)
    case 'unequip-all':
      return unequipAllModules(state)
    case 'upgrade-cheapest':
      return upgradeCheapestModule(state)
    case 'ack-onboarding':
      return acknowledgeOnboarding(state, action.tipId)
    case 'prestige':
      return performPrestige(state)
    case 'ascend':
      return performAscension(state)
    case 'enter-challenge':
      return enterChallenge(state, action.challengeId)
    case 'abandon-challenge':
      return abandonChallenge(state)
    case 'equip-core':
      return equipSignalCore(state, action.uid, action.slotKey)
    case 'unequip-core':
      return unequipSignalCore(state, action.slotKey)
    case 'merge-cores':
      return mergeSignalCores(state, action.defId, action.rank)
    case 'hard-reset':
      clearSave()
      return resetGame()
    case 'dev':
      return applyDevAction(state, action.action)
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
    }, 50)
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
    setDocked: (docked: boolean) => dispatch({ type: 'set-docked', docked }),
    warpToSector: (sector: number) => dispatch({ type: 'warp', sector }),
    assignWorker: (stationId: string, delta: number) =>
      dispatch({ type: 'assign-worker', stationId, delta }),
    autoBalanceWorkers: (profile?: LaborProfile) =>
      dispatch({ type: 'auto-balance-workers', profile }),
    setLaborProfile: (profile: LaborProfile) =>
      dispatch({ type: 'set-labor-profile', profile }),
    clearWorkerAssignments: () => dispatch({ type: 'clear-worker-assignments' }),
    fillStationWorkers: (stationId: string) =>
      dispatch({ type: 'fill-station', stationId }),
    syncCompletedGuides: (tab: import('../game/types').TabId) =>
      dispatch({ type: 'sync-guides', tab }),
    startFabProject: (moduleId: string) => dispatch({ type: 'start-fab', moduleId }),
    launchFabProject: (moduleId: string) => dispatch({ type: 'launch-fab', moduleId }),
    clearFabProject: () => dispatch({ type: 'clear-fab' }),
    depositFabPart: (partType: PartType, qty?: number) =>
      dispatch({ type: 'deposit-fab', partType, qty }),
    withdrawFabPart: (partType: PartType, qty?: number) =>
      dispatch({ type: 'withdraw-fab', partType, qty }),
    sellPart: (partId: string, qty?: number) =>
      dispatch({ type: 'sell-part', partId, qty }),
    investPartMastery: (moduleId: string) =>
      dispatch({ type: 'invest-mastery', moduleId }),
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
    upgradeModule: (moduleId: string) => dispatch({ type: 'upgrade-module', moduleId }),
    pickCoreMilestone: (moduleId: string, milestoneId: string, choiceId: string) =>
      dispatch({ type: 'pick-milestone', moduleId, milestoneId, choiceId }),
    performRebuild: (hangar: { frameId: string; modules: string[] }) =>
      dispatch({ type: 'rebuild', hangar }),
    unequipAll: () => dispatch({ type: 'unequip-all' }),
    upgradeCheapest: () => dispatch({ type: 'upgrade-cheapest' }),
    acknowledgeOnboarding: (tipId: string) =>
      dispatch({ type: 'ack-onboarding', tipId }),
    prestige: () => dispatch({ type: 'prestige' }),
    ascend: () => dispatch({ type: 'ascend' }),
    enterChallenge: (challengeId: string) =>
      dispatch({ type: 'enter-challenge', challengeId }),
    abandonChallenge: () => dispatch({ type: 'abandon-challenge' }),
    equipSignalCore: (uid: string, slotKey: string) =>
      dispatch({ type: 'equip-core', uid, slotKey }),
    unequipSignalCore: (slotKey: string) =>
      dispatch({ type: 'unequip-core', slotKey }),
    mergeSignalCores: (defId: string, rank: number) =>
      dispatch({ type: 'merge-cores', defId, rank }),
    hardReset: () => dispatch({ type: 'hard-reset' }),
    applyDevAction: (action: DevAction) => dispatch({ type: 'dev', action }),
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
