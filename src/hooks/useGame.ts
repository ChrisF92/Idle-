import { useEffect, useReducer, useRef, useState } from 'react'
import type { GameState, LaborProfile, PartType, CombatPushMode } from '../game/types'
import { loadOrCreateGame, saveGame, clearSave, importSave } from '../game/save'
import {
  tickGame,
  startCombat,
  setCampaign,
  setPushMode,
  setDocked,
  warpToSector,
  retryFrontier,
  chooseDirective,
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
  buyNetworkLink,
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
  setFoundrySlot,
  assembleBlueprint,
  startFabrication,
  stopFabrication,
  setTrackedPrint,
  setLaborProfile,
  setDamageNumbers,
  setNumberNotation,
  startFabProject,
  unfitModule,
  unequipAllModules,
  unequipFoundryModule,
  unlockFrame,
  unlockModule,
  buyCoreStartingLevel,
  buyRunUpgrade,
  buyWorkshopUpgrade,
  cycleSortieSpeed,
  withdrawFabPart,
  equipSignalCore,
  unequipSignalCore,
  mergeSignalCores,
  buyFoundryUpgrade,
  equipFoundryModule,
  equipRelicOnCore,
  removeRelicFromCore,
  upgradeRelic,
  convertAshToHeat,
  buyFurnaceUpgrade,
  setFurnaceChannel,
  setFurnacePriority,
  applyFurnacePreset,
  setResearchFocus,
  setLaunchSector,
  setSectorRoute,
  placeYardBuilding,
  clearYardBuilding,
  buyYardArm,
  enterProtocol,
  abandonProtocol,
  enterEcho,
  abandonEcho,
  buyEchoNode,
  buyProcessNode,
  setProcessConfig,
  optimiseNetwork,
  applyNetworkPreset,
  buyMaxFoundryUpgrades,
  buyMaxYardArms,
  saveYardLayout,
  loadYardLayout,
  rankSpecialist,
  rankCapital,
  performReinforce,
} from '../game/actions'
import { acknowledgeOnboarding, skipOnboarding, syncCompletedGuides } from '../game/progression'
import { acknowledgeEvent } from '../game/presentation'
import { markHubSeen } from '../game/hubAttention'
import { applyDevAction, type DevAction } from '../game/dev'
import { createFreshCareerState } from '../game/freshStart'
import { noteSessionEnd } from '../game/playtest'
import { dismissFrontierNotice } from '../game/frontier'

type Action =
  | { type: 'replace'; state: GameState }
  | { type: 'tick'; now: number; paused?: boolean }
  | { type: 'engage' }
  | { type: 'set-campaign'; on: boolean }
  | { type: 'set-push-mode'; mode: CombatPushMode }
  | { type: 'retry-frontier' }
  | { type: 'dismiss-frontier-notice' }
  | { type: 'set-docked'; docked: boolean }
  | { type: 'warp'; sector: number }
  | { type: 'assign-worker'; stationId: string; delta: number }
  | { type: 'buy-network-link'; linkId: import('../game/types').NetworkLinkId }
  | { type: 'auto-balance-workers'; profile?: LaborProfile }
  | { type: 'set-labor-profile'; profile: LaborProfile }
  | { type: 'clear-worker-assignments' }
  | { type: 'fill-station'; stationId: string }
  | { type: 'sync-guides'; tab: import('../game/types').TabId }
  | { type: 'mark-hub-seen'; scope: import('../game/types').TabId }
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
  | { type: 'fit-module'; moduleId: string; coreInstanceId?: string }
  | { type: 'unfit-module'; moduleId: string; coreInstanceId?: string }
  | { type: 'buy-core-start'; coreInstanceId: string; count?: number }
  | { type: 'buy-run-upgrade'; id: import('../game/types').RunUpgradeId; count?: number }
  | { type: 'buy-workshop-upgrade'; id: import('../game/types').RunUpgradeId; count?: number }
  | { type: 'cycle-sortie-speed' }
  | {
      type: 'pick-milestone'
      moduleId: string
      milestoneId: string
      choiceId: string
    }
  | { type: 'rebuild'; hangar: { frameId: string; modules: string[] } }
  | { type: 'unequip-all' }
  | { type: 'ack-onboarding'; tipId: string }
  | { type: 'skip-onboarding'; tipId: string }
  | { type: 'ack-event'; key: string }
  | { type: 'prestige' }
  | { type: 'ascend' }
  | { type: 'enter-challenge'; challengeId: string }
  | { type: 'abandon-challenge' }
  | { type: 'equip-core'; uid: string; slotKey: string }
  | { type: 'unequip-core'; slotKey: string }
  | { type: 'merge-cores'; defId: string; rank: number }
  | { type: 'hard-reset' }
  | { type: 'dev'; action: DevAction }
  | { type: 'foundry-slot'; slotIndex: number; recipeId: string | null }
  | { type: 'foundry-stop-fab'; slotIndex: number }
  | { type: 'foundry-start-facility'; facilityId: import('../game/types').FacilityId }
  | { type: 'foundry-upgrade'; upgradeId: string }
  | { type: 'foundry-equip'; moduleId: string }
  | { type: 'foundry-unequip'; moduleId: string }
  | { type: 'assemble-blueprint'; moduleId: string }
  | { type: 'track-print'; moduleId: string | null }
  | { type: 'number-notation'; mode: 'engineering' | 'scientific' }
  | { type: 'damage-numbers'; mode: 'minimal' | 'standard' | 'detailed' }
  | { type: 'choose-directive'; id: string }
  | { type: 'relic-equip'; moduleId: string; relicId: string; socketIndex?: number }
  | { type: 'relic-remove'; moduleId: string; socketIndex?: number }
  | { type: 'relic-upgrade'; relicId: string }
  | { type: 'furnace-convert' }
  | { type: 'furnace-upgrade'; upgradeId: import('../game/types').FurnaceUpgradeId }
  | { type: 'furnace-channel'; channelId: import('../game/types').FurnaceChannelId; level: number }
  | { type: 'furnace-priority'; priority: import('../game/types').FurnaceChannelId[] }
  | { type: 'furnace-preset'; preset: import('../game/types').FurnacePresetId }
  | { type: 'research-focus'; branch: import('../game/types').HiveResearchBranch }
  | { type: 'launch-sector'; sector: number }
  | { type: 'sector-route'; route: import('../game/types').SectorRoute }
  | { type: 'yard-place'; index: number; buildingId: import('../game/types').YardBuildingId }
  | { type: 'yard-clear'; index: number }
  | { type: 'yard-arm'; armId: import('../game/types').YardArmId }
  | { type: 'enter-protocol'; protocolId: string }
  | { type: 'abandon-protocol' }
  | { type: 'enter-echo'; echoId: string }
  | { type: 'abandon-echo' }
  | { type: 'buy-echo'; nodeId: string }
  | { type: 'buy-process'; nodeId: string }
  | { type: 'process-config'; config: import('../game/types').ProcessConfig }
  | { type: 'process-network-optimise' }
  | { type: 'process-network-preset'; preset: import('../game/types').ProcessNetworkPreset }
  | { type: 'process-foundry-buy-max' }
  | { type: 'process-yard-buy-max' }
  | { type: 'process-save-yard-layout'; name?: string }
  | { type: 'process-load-yard-layout'; index: number }
  | { type: 'rank-specialist'; specialistId: import('../game/types').SpecialistId }
  | { type: 'rank-capital'; capitalId: import('../game/types').CapitalId }
  | { type: 'reinforce' }
  | { type: 'session-end' }

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'replace':
      return action.state
    case 'tick':
      return tickGame(state, action.now, action.paused)
    case 'engage':
      return startCombat(state)
    case 'set-campaign':
      return setCampaign(state, action.on)
    case 'set-push-mode':
      return setPushMode(state, action.mode)
    case 'retry-frontier':
      return retryFrontier(state)
    case 'dismiss-frontier-notice':
      return dismissFrontierNotice(state)
    case 'set-docked':
      return setDocked(state, action.docked)
    case 'warp':
      return warpToSector(state, action.sector)
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
      return fitModule(state, action.moduleId, action.coreInstanceId)
    case 'unfit-module':
      return unfitModule(state, action.moduleId, action.coreInstanceId)
    case 'buy-core-start':
      return buyCoreStartingLevel(state, action.coreInstanceId, action.count)
    case 'buy-run-upgrade':
      return buyRunUpgrade(state, action.id, action.count)
    case 'buy-workshop-upgrade':
      return buyWorkshopUpgrade(state, action.id, action.count)
    case 'cycle-sortie-speed':
      return cycleSortieSpeed(state)
    case 'pick-milestone':
      return pickCoreMilestone(state, action.moduleId, action.milestoneId, action.choiceId)
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
      return createFreshCareerState()
    case 'dev':
      return applyDevAction(state, action.action)
    case 'foundry-slot':
      return setFoundrySlot(state, action.slotIndex, action.recipeId as import('../game/types').FoundryRecipeId | null)
    case 'foundry-stop-fab':
      return stopFabrication(state, action.slotIndex)
    case 'foundry-start-facility':
      return startFabrication(state, 'facility', action.facilityId)
    case 'foundry-upgrade':
      return buyFoundryUpgrade(state, action.upgradeId)
    case 'foundry-equip':
      return equipFoundryModule(state, action.moduleId)
    case 'foundry-unequip':
      return unequipFoundryModule(state, action.moduleId)
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
    case 'furnace-upgrade':
      return buyFurnaceUpgrade(state, action.upgradeId)
    case 'furnace-channel':
      return setFurnaceChannel(state, action.channelId, action.level)
    case 'furnace-priority':
      return setFurnacePriority(state, action.priority)
    case 'furnace-preset':
      return applyFurnacePreset(state, action.preset)
    case 'research-focus':
      return setResearchFocus(state, action.branch)
    case 'launch-sector':
      return setLaunchSector(state, action.sector)
    case 'sector-route':
      return setSectorRoute(state, action.route)
    case 'yard-place':
      return placeYardBuilding(state, action.index, action.buildingId)
    case 'yard-clear':
      return clearYardBuilding(state, action.index)
    case 'yard-arm':
      return buyYardArm(state, action.armId)
    case 'enter-protocol':
      return enterProtocol(state, action.protocolId)
    case 'abandon-protocol':
      return abandonProtocol(state)
    case 'enter-echo':
      return enterEcho(state, action.echoId)
    case 'abandon-echo':
      return abandonEcho(state)
    case 'buy-echo':
      return buyEchoNode(state, action.nodeId)
    case 'buy-process':
      return buyProcessNode(state, action.nodeId)
    case 'process-config':
      return setProcessConfig(state, action.config)
    case 'process-network-optimise':
      return optimiseNetwork(state)
    case 'process-network-preset':
      return applyNetworkPreset(state, action.preset)
    case 'process-foundry-buy-max':
      return buyMaxFoundryUpgrades(state)
    case 'process-yard-buy-max':
      return buyMaxYardArms(state)
    case 'process-save-yard-layout':
      return saveYardLayout(state, action.name)
    case 'process-load-yard-layout':
      return loadYardLayout(state, action.index)
    case 'rank-specialist':
      return rankSpecialist(state, action.specialistId)
    case 'rank-capital':
      return rankCapital(state, action.capitalId)
    case 'reinforce':
      return performReinforce(state)
    case 'session-end': {
      const next = structuredClone(state)
      noteSessionEnd(next)
      return next
    }
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

  useEffect(() => {
    const id = window.setInterval(() => {
      dispatch({ type: 'tick', now: Date.now(), paused: simPausedRef.current })
    }, 50)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    saveGame(state)
  }, [state])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') dispatch({ type: 'session-end' })
    }
    const onUnload = () => dispatch({ type: 'session-end' })
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onUnload)
    }
  }, [])

  return {
    state,
    simPausedRef,
    offlineReport,
    dismissOfflineReport: () => setOfflineReport(null),
    engage: () => dispatch({ type: 'engage' }),
    setCampaign: (on: boolean) => dispatch({ type: 'set-campaign', on }),
    setPushMode: (mode: CombatPushMode) => dispatch({ type: 'set-push-mode', mode }),
    retryFrontier: () => dispatch({ type: 'retry-frontier' }),
    dismissFrontierNotice: () => dispatch({ type: 'dismiss-frontier-notice' }),
    setDocked: (docked: boolean) => dispatch({ type: 'set-docked', docked }),
    warpToSector: (sector: number) => dispatch({ type: 'warp', sector }),
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
    fitModule: (moduleId: string, coreInstanceId?: string) =>
      dispatch({ type: 'fit-module', moduleId, coreInstanceId }),
    unfitModule: (moduleId: string, coreInstanceId?: string) =>
      dispatch({ type: 'unfit-module', moduleId, coreInstanceId }),
    buyCoreStartingLevel: (coreInstanceId: string, count?: number) =>
      dispatch({ type: 'buy-core-start', coreInstanceId, count }),
    buyRunUpgrade: (id: import('../game/types').RunUpgradeId, count?: number) =>
      dispatch({ type: 'buy-run-upgrade', id, count }),
    buyWorkshopUpgrade: (id: import('../game/types').RunUpgradeId, count?: number) =>
      dispatch({ type: 'buy-workshop-upgrade', id, count }),
    cycleSortieSpeed: () => dispatch({ type: 'cycle-sortie-speed' }),
    pickCoreMilestone: (moduleId: string, milestoneId: string, choiceId: string) =>
      dispatch({ type: 'pick-milestone', moduleId, milestoneId, choiceId }),
    performRebuild: (hangar: { frameId: string; modules: string[] }) =>
      dispatch({ type: 'rebuild', hangar }),
    unequipAll: () => dispatch({ type: 'unequip-all' }),
    acknowledgeOnboarding: (tipId: string) =>
      dispatch({ type: 'ack-onboarding', tipId }),
    skipOnboarding: (tipId: string) => dispatch({ type: 'skip-onboarding', tipId }),
    acknowledgeEvent: (key: string) => dispatch({ type: 'ack-event', key }),
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
    setFoundrySlot: (slotIndex: number, recipeId: string | null) =>
      dispatch({ type: 'foundry-slot', slotIndex, recipeId }),
    stopFabrication: (slotIndex: number) => dispatch({ type: 'foundry-stop-fab', slotIndex }),
    startFacility: (facilityId: import('../game/types').FacilityId) =>
      dispatch({ type: 'foundry-start-facility', facilityId }),
    buyFoundryUpgrade: (upgradeId: string) =>
      dispatch({ type: 'foundry-upgrade', upgradeId }),
    equipFoundryModule: (moduleId: string) =>
      dispatch({ type: 'foundry-equip', moduleId }),
    unequipFoundryModule: (moduleId: string) =>
      dispatch({ type: 'foundry-unequip', moduleId }),
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
    buyFurnaceUpgrade: (upgradeId: import('../game/types').FurnaceUpgradeId) =>
      dispatch({ type: 'furnace-upgrade', upgradeId }),
    setFurnaceChannel: (channelId: import('../game/types').FurnaceChannelId, level: number) =>
      dispatch({ type: 'furnace-channel', channelId, level }),
    setFurnacePriority: (priority: import('../game/types').FurnaceChannelId[]) =>
      dispatch({ type: 'furnace-priority', priority }),
    applyFurnacePreset: (preset: import('../game/types').FurnacePresetId) =>
      dispatch({ type: 'furnace-preset', preset }),
    setResearchFocus: (branch: import('../game/types').HiveResearchBranch) =>
      dispatch({ type: 'research-focus', branch }),
    setLaunchSector: (sector: number) => dispatch({ type: 'launch-sector', sector }),
    setSectorRoute: (route: import('../game/types').SectorRoute) =>
      dispatch({ type: 'sector-route', route }),
    placeYardBuilding: (
      index: number,
      buildingId: import('../game/types').YardBuildingId,
    ) => dispatch({ type: 'yard-place', index, buildingId }),
    clearYardBuilding: (index: number) => dispatch({ type: 'yard-clear', index }),
    buyYardArm: (armId: import('../game/types').YardArmId) =>
      dispatch({ type: 'yard-arm', armId }),
    enterProtocol: (protocolId: string) =>
      dispatch({ type: 'enter-protocol', protocolId }),
    abandonProtocol: () => dispatch({ type: 'abandon-protocol' }),
    enterEcho: (echoId: string) => dispatch({ type: 'enter-echo', echoId }),
    abandonEcho: () => dispatch({ type: 'abandon-echo' }),
    buyEchoNode: (nodeId: string) => dispatch({ type: 'buy-echo', nodeId }),
    buyProcessNode: (nodeId: string) => dispatch({ type: 'buy-process', nodeId }),
    setProcessConfig: (config: import('../game/types').ProcessConfig) =>
      dispatch({ type: 'process-config', config }),
    optimiseNetwork: () => dispatch({ type: 'process-network-optimise' }),
    applyNetworkPreset: (preset: import('../game/types').ProcessNetworkPreset) =>
      dispatch({ type: 'process-network-preset', preset }),
    buyMaxFoundryUpgrades: () => dispatch({ type: 'process-foundry-buy-max' }),
    buyMaxYardArms: () => dispatch({ type: 'process-yard-buy-max' }),
    saveYardLayout: (name?: string) => dispatch({ type: 'process-save-yard-layout', name }),
    loadYardLayout: (index: number) => dispatch({ type: 'process-load-yard-layout', index }),
    rankSpecialist: (specialistId: import('../game/types').SpecialistId) =>
      dispatch({ type: 'rank-specialist', specialistId }),
    rankCapital: (capitalId: import('../game/types').CapitalId) =>
      dispatch({ type: 'rank-capital', capitalId }),
    performReinforce: () => dispatch({ type: 'reinforce' }),
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
