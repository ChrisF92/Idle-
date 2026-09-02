import { useEffect, useReducer, useRef, useState } from 'react'
import type { GameState, LaborProfile } from '../game/types'
import { loadOrCreateGame, saveGame, clearSave, importSave } from '../game/save'
import {
  tickGame,
  startCombat,
  setDocked,
  extractSortie,
  markExtractionExplained,
  chooseDirective,
  setSortiePaused,
  handleAppHidden,
} from '../game/tick'
import { applyOfflineCatchUp, applyWallClock, handleAppVisible, type OfflineReport } from '../game/offline'
import {
  abandonChallenge,
  assignWorker,
  autoBalanceWorkers,
  buyAiNode,
  buyEssenceUpgrade,
  buyMatterShop,
  buyNetworkLink,
  buyResearch,
  clearWorkerAssignments,
  enterChallenge,
  fillStationWorkers,
  fitModule,
  performPrestige,
  performRebuild,
  selectFrame,
  setFoundrySlot,
  assembleBlueprint,
  startFabrication,
  setTrackedPrint,
  setLaborProfile,
  setDamageNumbers,
  setNumberNotation,
  unfitModule,
  unequipAllModules,
  unlockFrame,
  unlockModule,
  buyCoreStartingLevel,
  buyRunUpgrade,
  buyWorkshopUpgrade,
  buyGenericUnlock,
  cycleSortieSpeed,
  setCoreTargetingDoctrine,
  equipSignalCore,
  unequipSignalCore,
  mergeSignalCores,
  equipRelicOnCore,
  removeRelicFromCore,
  upgradeRelic,
  convertAshToHeat,
  igniteFurnace,
  setResearchFocus,
  startResearch,
  buyProcessNode,
  setProcessConfig,
  optimiseNetwork,
  applyNetworkPreset,
} from '../game/actions'
import { acknowledgeOnboarding, skipOnboarding, syncCompletedGuides, dismissAct1Finale } from '../game/progression'
import { acknowledgeEvent } from '../game/presentation'
import { markHubSeen } from '../game/hubAttention'
import { applyDevAction, type DevAction } from '../game/dev'
import { createFreshCareerState } from '../game/freshStart'
import { noteSessionEnd } from '../game/playtest'

type Action =
  | { type: 'replace'; state: GameState }
  | { type: 'tick'; now: number; paused?: boolean }
  | { type: 'engage' }
  | { type: 'set-docked'; docked: boolean }
  | { type: 'extract-sortie' }
  | { type: 'mark-extraction-explained' }
  | { type: 'assign-worker'; stationId: string; delta: number }
  | { type: 'buy-network-link'; linkId: import('../game/types').NetworkLinkId }
  | { type: 'auto-balance-workers'; profile?: LaborProfile }
  | { type: 'set-labor-profile'; profile: LaborProfile }
  | { type: 'clear-worker-assignments' }
  | { type: 'fill-station'; stationId: string }
  | { type: 'sync-guides'; tab: import('../game/types').TabId }
  | { type: 'mark-hub-seen'; scope: import('../game/types').TabId }
  | { type: 'buy-research'; researchId: string }
  | { type: 'buy-essence'; upgradeId: string }
  | { type: 'buy-matter-shop'; itemId: string }
  | { type: 'buy-ai'; nodeId: string }
  | { type: 'unlock-frame'; frameId: string }
  | { type: 'select-frame'; frameId: string }
  | { type: 'unlock-module'; moduleId: string }
  | { type: 'fit-module'; moduleId: string; coreInstanceId?: string }
  | { type: 'set-core-doctrine'; coreInstanceId: string; doctrine: import('../game/types').TargetingDoctrineId }
  | { type: 'unfit-module'; moduleId: string; coreInstanceId?: string }
  | { type: 'buy-core-start'; coreInstanceId: string; count?: number }
  | { type: 'buy-run-upgrade'; id: import('../game/types').RunUpgradeId; count?: number }
  | { type: 'buy-workshop-upgrade'; id: import('../game/types').RunUpgradeId; count?: number }
  | { type: 'buy-generic-unlock'; category: import('../game/types').RunUpgradeCategory }
  | { type: 'cycle-sortie-speed' }
  | { type: 'rebuild'; hangar: { frameId: string; modules: string[] } }
  | { type: 'unequip-all' }
  | { type: 'ack-onboarding'; tipId: string }
  | { type: 'skip-onboarding'; tipId: string }
  | { type: 'ack-event'; key: string }
  | { type: 'prestige' }
  | { type: 'enter-challenge'; challengeId: string }
  | { type: 'abandon-challenge' }
  | { type: 'equip-core'; uid: string; slotKey: string }
  | { type: 'unequip-core'; slotKey: string }
  | { type: 'merge-cores'; defId: string; rank: number }
  | { type: 'hard-reset' }
  | { type: 'dev'; action: DevAction }
  | { type: 'foundry-slot'; slotIndex: number; recipeId: string | null }
  | { type: 'foundry-start-job'; kind: import('../game/types').FabJobKind; jobId: string }
  | { type: 'foundry-start-facility'; facilityId: import('../game/types').FacilityId }
  | { type: 'assemble-blueprint'; moduleId: string }
  | { type: 'track-print'; moduleId: string | null }
  | { type: 'number-notation'; mode: 'engineering' | 'scientific' }
  | { type: 'damage-numbers'; mode: 'minimal' | 'standard' | 'detailed' }
  | { type: 'choose-directive'; id: string }
  | { type: 'relic-equip'; moduleId: string; relicId: string; socketIndex?: number }
  | { type: 'relic-remove'; moduleId: string; socketIndex?: number }
  | { type: 'relic-upgrade'; relicId: string }
  | { type: 'furnace-convert' }
  | { type: 'furnace-ignite'; channels: Partial<Record<import('../game/types').FurnaceChannelId, import('../game/types').FurnaceChannelLevel>> }
  | { type: 'research-focus'; branch: import('../game/types').HiveResearchBranch }
  | { type: 'research-start'; nodeId: string }
  | { type: 'dismiss-act1-finale' }
  | { type: 'buy-process'; nodeId: string }
  | { type: 'process-config'; config: import('../game/types').ProcessConfig }
  | { type: 'process-network-optimise' }
  | { type: 'process-network-preset'; preset: import('../game/types').ProcessNetworkPreset }
  | { type: 'session-end' }
  | { type: 'set-sortie-paused'; paused: boolean }
  | { type: 'visibility-hidden' }

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'replace':
      return action.state
    case 'tick':
      return tickGame(state, action.now, action.paused)
    case 'engage':
      return startCombat(state)
    case 'set-docked':
      return setDocked(state, action.docked)
    case 'extract-sortie':
      return extractSortie(state)
    case 'mark-extraction-explained':
      return markExtractionExplained(state)
    case 'assign-worker':
      return assignWorker(state, action.stationId, action.delta)
    case 'buy-network-link':
      return buyNetworkLink(state, action.linkId)
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
    case 'mark-hub-seen':
      return markHubSeen(state, action.scope)
    case 'buy-research':
      return buyResearch(state, action.researchId)
    case 'buy-essence':
      return buyEssenceUpgrade(state, action.upgradeId)
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
      return fitModule(state, action.moduleId, action.coreInstanceId)
    case 'unfit-module':
      return unfitModule(state, action.moduleId, action.coreInstanceId)
    case 'set-core-doctrine':
      return setCoreTargetingDoctrine(state, action.coreInstanceId, action.doctrine)
    case 'buy-core-start':
      return buyCoreStartingLevel(state, action.coreInstanceId, action.count)
    case 'buy-run-upgrade':
      return buyRunUpgrade(state, action.id, action.count)
    case 'buy-workshop-upgrade':
      return buyWorkshopUpgrade(state, action.id, action.count)
    case 'buy-generic-unlock':
      return buyGenericUnlock(state, action.category)
    case 'cycle-sortie-speed':
      return cycleSortieSpeed(state)
    case 'rebuild':
      return performRebuild(state, action.hangar)
    case 'unequip-all':
      return unequipAllModules(state)
    case 'ack-onboarding':
      return acknowledgeOnboarding(state, action.tipId)
    case 'skip-onboarding':
      return skipOnboarding(state, action.tipId)
    case 'ack-event':
      return acknowledgeEvent(state, action.key)
    case 'prestige':
      return performPrestige(state)
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
      return createFreshCareerState()
    case 'dev':
      return applyDevAction(state, action.action)
    case 'foundry-slot':
      return setFoundrySlot(state, action.slotIndex, action.recipeId as import('../game/types').FoundryRecipeId | null)
    case 'foundry-start-facility':
      return startFabrication(state, 'facility', action.facilityId)
    case 'foundry-start-job':
      return startFabrication(state, action.kind, action.jobId)
    case 'assemble-blueprint':
      return assembleBlueprint(state, action.moduleId)
    case 'track-print':
      return setTrackedPrint(state, action.moduleId)
    case 'number-notation':
      return setNumberNotation(state, action.mode)
    case 'damage-numbers':
      return setDamageNumbers(state, action.mode)
    case 'choose-directive':
      return chooseDirective(state, action.id)
    case 'relic-equip':
      return equipRelicOnCore(state, action.moduleId, action.relicId, action.socketIndex)
    case 'relic-remove':
      return removeRelicFromCore(state, action.moduleId, action.socketIndex)
    case 'relic-upgrade':
      return upgradeRelic(state, action.relicId)
    case 'furnace-convert':
      return convertAshToHeat(state)
    case 'furnace-ignite':
      return igniteFurnace(state, action.channels)
    case 'research-focus':
      return setResearchFocus(state, action.branch)
    case 'research-start':
      return startResearch(state, action.nodeId)
    case 'dismiss-act1-finale':
      return dismissAct1Finale(state)
    case 'buy-process':
      return buyProcessNode(state, action.nodeId)
    case 'process-config':
      return setProcessConfig(state, action.config)
    case 'process-network-optimise':
      return optimiseNetwork(state)
    case 'process-network-preset':
      return applyNetworkPreset(state, action.preset)
    case 'session-end': {
      const next = structuredClone(state)
      noteSessionEnd(next)
      return next
    }
    case 'set-sortie-paused':
      return setSortiePaused(state, action.paused)
    case 'visibility-hidden':
      return handleAppHidden(state)
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
  const simPausedRef = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      const now = Date.now()
      const { state: next, report } = applyWallClock(
        stateRef.current,
        now,
        simPausedRef.current,
      )
      stateRef.current = next
      dispatch({ type: 'replace', state: next })
      if (report) setOfflineReport(report)
    }, 50)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => saveGame(stateRef.current), 5000)
    return () => {
      saveGame(stateRef.current)
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    const freezeAndPersist = () => {
      const next = handleAppHidden(stateRef.current)
      stateRef.current = next
      dispatch({ type: 'replace', state: next })
      saveGame(next)
    }
    const catchUpVisible = () => {
      const { state: next, report } = handleAppVisible(stateRef.current, Date.now())
      stateRef.current = next
      dispatch({ type: 'replace', state: next })
      saveGame(next)
      if (report) setOfflineReport(report)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') freezeAndPersist()
      else catchUpVisible()
    }
    const onUnload = () => freezeAndPersist()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onUnload)
    }
  }, [])

  return {
    state,
    simPausedRef,
    offlineReport,
    dismissOfflineReport: () => setOfflineReport(null),
    engage: () => dispatch({ type: 'engage' }),
    setDocked: (docked: boolean) => dispatch({ type: 'set-docked', docked }),
    extractSortie: () => dispatch({ type: 'extract-sortie' }),
    markExtractionExplained: () => dispatch({ type: 'mark-extraction-explained' }),
    setSortiePaused: (paused: boolean) => dispatch({ type: 'set-sortie-paused', paused }),
    assignWorker: (stationId: string, delta: number) =>
      dispatch({ type: 'assign-worker', stationId, delta }),
    buyNetworkLink: (linkId: import('../game/types').NetworkLinkId) =>
      dispatch({ type: 'buy-network-link', linkId }),
    autoBalanceWorkers: (profile?: LaborProfile) =>
      dispatch({ type: 'auto-balance-workers', profile }),
    setLaborProfile: (profile: LaborProfile) =>
      dispatch({ type: 'set-labor-profile', profile }),
    clearWorkerAssignments: () => dispatch({ type: 'clear-worker-assignments' }),
    fillStationWorkers: (stationId: string) =>
      dispatch({ type: 'fill-station', stationId }),
    syncCompletedGuides: (tab: import('../game/types').TabId) =>
      dispatch({ type: 'sync-guides', tab }),
    markHubSeen: (scope: import('../game/types').TabId) =>
      dispatch({ type: 'mark-hub-seen', scope }),
    buyResearch: (researchId: string) => dispatch({ type: 'buy-research', researchId }),
    buyEssenceUpgrade: (upgradeId: string) =>
      dispatch({ type: 'buy-essence', upgradeId }),
    buyMatterShop: (itemId: string) => dispatch({ type: 'buy-matter-shop', itemId }),
    buyAiNode: (nodeId: string) => dispatch({ type: 'buy-ai', nodeId }),
    unlockFrame: (frameId: string) => dispatch({ type: 'unlock-frame', frameId }),
    selectFrame: (frameId: string) => dispatch({ type: 'select-frame', frameId }),
    unlockModule: (moduleId: string) => dispatch({ type: 'unlock-module', moduleId }),
    fitModule: (moduleId: string, coreInstanceId?: string) =>
      dispatch({ type: 'fit-module', moduleId, coreInstanceId }),
    unfitModule: (moduleId: string, coreInstanceId?: string) =>
      dispatch({ type: 'unfit-module', moduleId, coreInstanceId }),
    setCoreTargetingDoctrine: (
      coreInstanceId: string,
      doctrine: import('../game/types').TargetingDoctrineId,
    ) => dispatch({ type: 'set-core-doctrine', coreInstanceId, doctrine }),
    buyCoreStartingLevel: (coreInstanceId: string, count?: number) =>
      dispatch({ type: 'buy-core-start', coreInstanceId, count }),
    buyRunUpgrade: (id: import('../game/types').RunUpgradeId, count?: number) =>
      dispatch({ type: 'buy-run-upgrade', id, count }),
    buyWorkshopUpgrade: (id: import('../game/types').RunUpgradeId, count?: number) =>
      dispatch({ type: 'buy-workshop-upgrade', id, count }),
    buyGenericUnlock: (category: import('../game/types').RunUpgradeCategory) =>
      dispatch({ type: 'buy-generic-unlock', category }),
    cycleSortieSpeed: () => dispatch({ type: 'cycle-sortie-speed' }),
    performRebuild: (hangar: { frameId: string; modules: string[] }) =>
      dispatch({ type: 'rebuild', hangar }),
    unequipAll: () => dispatch({ type: 'unequip-all' }),
    acknowledgeOnboarding: (tipId: string) =>
      dispatch({ type: 'ack-onboarding', tipId }),
    skipOnboarding: (tipId: string) => dispatch({ type: 'skip-onboarding', tipId }),
    acknowledgeEvent: (key: string) => dispatch({ type: 'ack-event', key }),
    prestige: () => dispatch({ type: 'prestige' }),
    enterChallenge: (challengeId: string) =>
      dispatch({ type: 'enter-challenge', challengeId }),
    abandonChallenge: () => dispatch({ type: 'abandon-challenge' }),
    equipSignalCore: (uid: string, slotKey: string) =>
      dispatch({ type: 'equip-core', uid, slotKey }),
    unequipSignalCore: (slotKey: string) =>
      dispatch({ type: 'unequip-core', slotKey }),
    mergeSignalCores: (defId: string, rank: number) =>
      dispatch({ type: 'merge-cores', defId, rank }),
    setFoundrySlot: (slotIndex: number, recipeId: string | null) =>
      dispatch({ type: 'foundry-slot', slotIndex, recipeId }),
    startFacility: (facilityId: import('../game/types').FacilityId) =>
      dispatch({ type: 'foundry-start-facility', facilityId }),
    startFabricationJob: (kind: import('../game/types').FabJobKind, jobId: string) =>
      dispatch({ type: 'foundry-start-job', kind, jobId }),
    assembleBlueprint: (moduleId: string) =>
      dispatch({ type: 'assemble-blueprint', moduleId }),
    setTrackedPrint: (moduleId: string | null) =>
      dispatch({ type: 'track-print', moduleId }),
    setNumberNotation: (mode: 'engineering' | 'scientific') =>
      dispatch({ type: 'number-notation', mode }),
    setDamageNumbers: (mode: 'minimal' | 'standard' | 'detailed') =>
      dispatch({ type: 'damage-numbers', mode }),
    chooseDirective: (id: string) => dispatch({ type: 'choose-directive', id }),
    equipRelic: (moduleId: string, relicId: string, socketIndex?: number) =>
      dispatch({ type: 'relic-equip', moduleId, relicId, socketIndex }),
    removeRelic: (moduleId: string, socketIndex?: number) =>
      dispatch({ type: 'relic-remove', moduleId, socketIndex }),
    upgradeRelic: (relicId: string) => dispatch({ type: 'relic-upgrade', relicId }),
    convertAshToHeat: () => dispatch({ type: 'furnace-convert' }),
    igniteFurnace: (channels: Partial<Record<import('../game/types').FurnaceChannelId, import('../game/types').FurnaceChannelLevel>>) =>
      dispatch({ type: 'furnace-ignite', channels }),
    setResearchFocus: (branch: import('../game/types').HiveResearchBranch) =>
      dispatch({ type: 'research-focus', branch }),
    startResearch: (nodeId: string) => dispatch({ type: 'research-start', nodeId }),
    dismissAct1Finale: () => dispatch({ type: 'dismiss-act1-finale' }),
    buyProcessNode: (nodeId: string) => dispatch({ type: 'buy-process', nodeId }),
    setProcessConfig: (config: import('../game/types').ProcessConfig) =>
      dispatch({ type: 'process-config', config }),
    optimiseNetwork: () => dispatch({ type: 'process-network-optimise' }),
    applyNetworkPreset: (preset: import('../game/types').ProcessNetworkPreset) =>
      dispatch({ type: 'process-network-preset', preset }),
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
    newGame: () => dispatch({ type: 'replace', state: createFreshCareerState() }),
  }
}
