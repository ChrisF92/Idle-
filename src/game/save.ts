import type {
  CapitalId,
  CapitalState,
  CoreAttrId,
  CoreState,
  EchoState,
  FurnaceState,
  GameState,
  HiveResearchState,
  NetworkState,
  ProcessState,
  ProtocolState,
  ReliquaryColor,
  ReliquaryState,
  SignalCoreInstance,
  SignalCoresState,
  SortieSummary,
  SpecialistId,
  SpecialistState,
  YardArmId,
  YardBuildingId,
  YardGoodId,
  YardState,
} from './types'
import { NETWORK_BAR_IDS } from './types'
import { createInitialState, SAVE_KEY, SAVE_VERSION } from './state'
import { AI_NODES, isAiNodePermanent, resolveFrameId, getFrame, STARTER_FRAME_ID } from './catalog'
import { CORE_ATTR_IDS, createEmptyCoreState } from './core'
import {
  SIGNAL_CORE_MAX_RANK,
  createEmptySignalCoresState,
  getSignalCoreDef,
} from './signalCores'
import { createEmptyNetworkState } from './network'
import { createEmptyFoundryState } from './foundry'
import { createEmptyReliquaryState, hydrateCoreFits } from './reliquary'
import { finalizeFurnaceMigration, hydrateFurnaceState } from './furnace'
import { createEmptyHiveResearchState, HIVE_RESEARCH_BRANCHES } from './hiveResearch'
import { createEmptyYardState } from './yard'
import { createEmptyProtocolState } from './protocols'
import { createEmptyEchoState } from './echo'
import { createEmptyProcessState, finalizeProcessMigration, hydrateProcessState } from './process'
import { createEmptySpecialistState } from './specialists'
import { createEmptyCapitalState } from './capital'
import { emptyLastSortie } from './sortieSummary'
import { createEmptyWorkshop } from './workshop'
import { normalizePushMode, normalizeRoute } from './sectors'
import { migrateOnboardingState } from './playerGuidance'
import { migrateLegacyCoreProgression } from './coreProgression'
import { hydratePlaytest, noteSessionStart } from './playtest'
import { emptySortieRunStats, hydrateSortieRunStats } from './sortieTelemetry'
import { hydrateFrontierCombat } from './frontier'
import { normalizeCoreInstances, resolveCoreInstance } from './coreInstances'

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  } catch {
    // Quota / private mode — ignore for skeleton
  }
}

function withLastSortieDefaults(
  raw: SortieSummary | undefined,
  sector: number,
  wave: number,
): SortieSummary {
  const empty = emptyLastSortie(sector, wave)
  if (!raw || typeof raw !== 'object') return empty
  const outcome = raw.outcome === 'extract' || raw.outcome === 'defeat' ? raw.outcome : null
  return {
    outcome,
    sector: Math.max(1, Math.floor(Number(raw.sector ?? sector) || sector)),
    wave: Math.max(1, Math.floor(Number(raw.wave ?? wave) || wave)),
    note: typeof raw.note === 'string' ? raw.note : '',
    sectorsCleared: Math.max(0, Math.floor(Number(raw.sectorsCleared ?? 0) || 0)),
    salvageGained: Math.max(0, Math.floor(Number(raw.salvageGained ?? 0) || 0)),
    salvageSpent: Math.max(0, Math.floor(Number(raw.salvageSpent ?? 0) || 0)),
    scrapEarned: Math.max(0, Math.floor(Number(raw.scrapEarned ?? 0) || 0)),
    newBest: Boolean(raw.newBest),
    previousBest: Math.max(0, Math.floor(Number(raw.previousBest ?? 0) || 0)),
    milestones: Math.max(0, Math.floor(Number(raw.milestones ?? 0) || 0)),
    researchXp: Math.max(0, Math.floor(Number(raw.researchXp ?? 0) || 0)),
    networkLevels: Math.max(0, Math.floor(Number(raw.networkLevels ?? 0) || 0)),
    stats: hydrateSortieRunStats(raw.stats),
    spendByCategory: {
      attack: Math.max(0, Number(raw.spendByCategory?.attack ?? 0) || 0),
      defense: Math.max(0, Number(raw.spendByCategory?.defense ?? 0) || 0),
      economy: Math.max(0, Number(raw.spendByCategory?.economy ?? 0) || 0),
    },
    ashEarned: Math.max(0, Math.floor(Number(raw.ashEarned ?? 0) || 0)),
    dataEarned: Math.max(0, Math.floor(Number(raw.dataEarned ?? 0) || 0)),
    fragmentsEarned: Math.max(0, Math.floor(Number(raw.fragmentsEarned ?? 0) || 0)),
    cores: Array.isArray(raw.cores) ? raw.cores : [],
  }
}

function withCombatDefaults(combat: GameState['combat']): GameState['combat'] {
  const withUnitDefaults = <T extends GameState['combat']['playerUnits'][number]>(
    units: T[] | undefined,
  ): T[] =>
    (units ?? []).map((u) => ({
      ...u,
      x: u.x ?? 0,
      y: u.y ?? 0,
      speed: u.speed ?? 0,
      engageRange: u.engageRange ?? 0,
      kite: u.kite ?? false,
      phaseWarnLeft: u.phaseWarnLeft ?? 0,
      regenDelay: u.regenDelay ?? 0,
      weapons: (u.weapons ?? []).map((w) => ({
        ...w,
        range: w.range ?? 90,
        telegraphDuration: w.telegraphDuration ?? 0,
        telegraphLeft: w.telegraphLeft ?? 0,
        delivery: w.delivery,
      })),
    }))

  return {
    ...combat,
    enemyFamily: combat.enemyFamily ?? '',
    enemyTags: combat.enemyTags ?? [],
    isBoss: combat.isBoss ?? false,
    highestSector: Math.max(0, combat.highestSector ?? 0),
    bestWave: Math.max(0, Math.floor(Number(combat.bestWave ?? 0) || 0)),
    runUpgrades: { ...(combat.runUpgrades ?? {}) },
    coreRunLevels: { ...(combat.coreRunLevels ?? {}) },
    coreSalvageSpent: { ...(combat.coreSalvageSpent ?? {}) },
    coreMasteryStart: { ...(combat.coreMasteryStart ?? {}) },
    coreMasteryXp: { ...(combat.coreMasteryXp ?? {}) },
    coreBossClears: { ...(combat.coreBossClears ?? {}) },
    coreNewBest: { ...(combat.coreNewBest ?? {}) },
    coreMilestones: { ...(combat.coreMilestones ?? {}) },
    wave: Math.max(1, combat.wave ?? 1),
    campaign: normalizePushMode(combat.pushMode, combat.campaign ?? true) === 'advance',
    pushMode: normalizePushMode(combat.pushMode, combat.campaign ?? true),
    route: normalizeRoute(combat.route),
    docked: combat.docked ?? false,
    consecutiveLosses: combat.consecutiveLosses ?? 0,
    bossPhase: combat.bossPhase ?? 0,
    sortieSeed: Math.max(0, Math.floor(Number(combat.sortieSeed ?? 0) || 0)),
    bossMechanic: typeof combat.bossMechanic === 'string' ? combat.bossMechanic : undefined,
    waveThreat:
      combat.waveThreat && typeof combat.waveThreat === 'object'
        ? {
            seed: Math.max(0, Math.floor(Number(combat.waveThreat.seed ?? 0) || 0)),
            budget: Math.max(0, Number(combat.waveThreat.budget ?? 0) || 0),
            spent: Math.max(0, Number(combat.waveThreat.spent ?? 0) || 0),
          }
        : undefined,
    fightElapsed: Math.max(0, Number(combat.fightElapsed ?? 0) || 0),
    playerShield: combat.playerShield ?? 0,
    playerShieldMax: combat.playerShieldMax ?? 0,
    playerUnits: withUnitDefaults(combat.playerUnits),
    enemyUnits: withUnitDefaults(combat.enemyUnits),
    projectiles: (combat.projectiles ?? []).map((p) => ({
      ...p,
      originX: p.originX ?? p.x,
      originY: p.originY ?? p.y,
      heading: Number.isFinite(p.heading) ? p.heading : undefined,
      weaponId: typeof p.weaponId === 'string' ? p.weaponId : undefined,
    })),
    beams: (combat.beams ?? []).map((b) => ({
      ...b,
      heading: Number.isFinite(b.heading) ? b.heading : undefined,
      weaponId: typeof b.weaponId === 'string' ? b.weaponId : undefined,
    })),
    fx: combat.fx ?? [],
    fragmentNotice: null,
    lastSortie: withLastSortieDefaults(combat.lastSortie, combat.sector ?? 1, combat.wave ?? 1),
    sortieMark: combat.sortieMark
      ? {
          salvage: Math.max(0, Number(combat.sortieMark.salvage ?? 0) || 0),
          salvageSpent: Math.max(0, Number(combat.sortieMark.salvageSpent ?? 0) || 0),
          scrap: Math.max(0, Number(combat.sortieMark.scrap ?? 0) || 0),
          sectorsCleared: Math.max(0, Math.floor(Number(combat.sortieMark.sectorsCleared ?? 0) || 0)),
          corePicks: Math.max(0, Math.floor(Number(combat.sortieMark.corePicks ?? 0) || 0)),
          researchXp: Math.max(0, Number(combat.sortieMark.researchXp ?? 0) || 0),
          networkLevels: Math.max(0, Math.floor(Number(combat.sortieMark.networkLevels ?? 0) || 0)),
          stats: hydrateSortieRunStats(combat.sortieMark.stats) ?? emptySortieRunStats(),
          spendByCategory: {
            attack: Math.max(0, Number(combat.sortieMark.spendByCategory?.attack ?? 0) || 0),
            defense: Math.max(0, Number(combat.sortieMark.spendByCategory?.defense ?? 0) || 0),
            economy: Math.max(0, Number(combat.sortieMark.spendByCategory?.economy ?? 0) || 0),
          },
          ash: Math.max(0, Number(combat.sortieMark.ash ?? 0) || 0),
          data: Math.max(0, Number(combat.sortieMark.data ?? 0) || 0),
          fragments: Math.max(0, Math.floor(Number(combat.sortieMark.fragments ?? 0) || 0)),
        }
      : null,
    defeatLeft: Math.max(0, Number(combat.defeatLeft ?? 0) || 0),
    defeatTactical: Boolean(combat.defeatTactical),
    directives: Array.isArray(combat.directives)
      ? combat.directives.filter((id): id is string => typeof id === 'string')
      : [],
    directiveOffer: Array.isArray(combat.directiveOffer)
      ? combat.directiveOffer.filter((id): id is string => typeof id === 'string')
      : null,
    ...hydrateFrontierCombat(combat),
  }
}

function withEssenceDefaults(state: Partial<GameState>): GameState['essence'] {
  return {
    purchased: state.essence?.purchased ?? [],
  }
}

function migrateChallengeClears(
  prestige: Partial<GameState['prestige']> & {
    completedChallenges?: string[]
  },
): Record<string, number> {
  if (
    prestige.challengeClears &&
    typeof prestige.challengeClears === 'object' &&
    !Array.isArray(prestige.challengeClears)
  ) {
    return { ...prestige.challengeClears }
  }
  const clears: Record<string, number> = {}
  for (const id of prestige.completedChallenges ?? []) {
    clears[id] = 1
  }
  return clears
}

/** Legacy string[] shop ownership → each id at rank 1. */
function migrateShopRanks(raw: unknown): Record<string, number> {
  if (!raw) return {}
  if (Array.isArray(raw)) {
    const ranks: Record<string, number> = {}
    for (const id of raw) {
      if (typeof id === 'string') ranks[id] = 1
    }
    return ranks
  }
  if (typeof raw === 'object') {
    const ranks: Record<string, number> = {}
    for (const [id, n] of Object.entries(raw as Record<string, unknown>)) {
      const rank = Math.floor(Number(n))
      if (rank > 0) ranks[id] = rank
    }
    return ranks
  }
  return {}
}

function withPrestigeDefaults(
  prestige: (GameState['prestige'] & { completedChallenges?: string[] }) | undefined,
): GameState['prestige'] {
  return {
    prestigeCount: prestige?.prestigeCount ?? 0,
    activeChallengeId: prestige?.activeChallengeId ?? null,
    challengeClears: migrateChallengeClears(prestige ?? {}),
    shop: migrateShopRanks(prestige?.shop),
    matterShop: migrateShopRanks(prestige?.matterShop),
    cycle: {
      bestWave: Math.max(0, Math.floor(Number(prestige?.cycle?.bestWave ?? 0) || 0)),
      sorties: Math.max(0, Math.floor(Number(prestige?.cycle?.sorties ?? 0) || 0)),
      scrapEarned: Math.max(0, Math.floor(Number(prestige?.cycle?.scrapEarned ?? 0) || 0)),
    },
  }
}

function withShipyardDefaults(
  shipyard: GameState['shipyard'] | undefined,
  base: GameState['shipyard'],
): GameState['shipyard'] {
  const hydrated: GameState['shipyard'] = {
    ...base,
    ...shipyard,
    unlockedFrames: (shipyard?.unlockedFrames ?? base.unlockedFrames)
      .map((id) => (id === 'scout-frame' ? STARTER_FRAME_ID : id))
      .filter((id) => Boolean(getFrame(id))),
    unlockedModules: shipyard?.unlockedModules ?? base.unlockedModules,
    modules: shipyard?.modules ?? base.modules,
    frameId: resolveFrameId(shipyard?.frameId ?? base.frameId),
    moduleLevels: shipyard?.moduleLevels ?? {},
    moduleCopies: { ...(shipyard?.moduleCopies ?? base.moduleCopies ?? {}) },
    corePicks: shipyard?.corePicks ?? {},
    frameLocked: shipyard?.frameLocked ?? false,
  }
  return normalizeCoreInstances(hydrated)
}

function withResourcesDefaults(
  resources: Partial<GameState['resources']> | undefined,
  base: GameState['resources'],
): GameState['resources'] {
  return {
    ...base,
    ...resources,
    salvage: resources?.salvage ?? 0,
    choirAsh: resources?.choirAsh ?? 0,
    heat: resources?.heat ?? 0,
  }
}

function withCodexDefaults(
  codex: GameState['codex'] | undefined,
): GameState['codex'] {
  const allowed = new Set(['swarm', 'armored', 'ethereal', 'divine', 'titan'])
  const seen = (codex?.seenFamilies ?? []).filter((f) => allowed.has(f))
  return { seenFamilies: seen }
}

function migrateBase(
  base: GameState['base'] | undefined,
  fallback: GameState['base'],
): GameState['base'] {
  if (!base) {
    return {
      ...fallback,
      assignments: { ...fallback.assignments },
      fabProject: null,
    }
  }

  // Legacy building levels → approximate worker drones + scrap/power assignments.
  const buildings = base.buildings
  let workers = base.workerDrones ?? 0
  const assignments: Record<string, number> = { ...(base.assignments ?? {}) }

  if (buildings && workers <= 0) {
    const scrap = buildings.scrapYard ?? 0
    const power = buildings.powerCell ?? 0
    const sensor = buildings.sensorArray ?? 0
    const foundry = buildings.foundry ?? 0
    const hangar = buildings.workDroneHangar ?? 0
    workers = Math.max(2, scrap + power + sensor + foundry + hangar)
    if (scrap > 0) assignments['scrap-field'] = (assignments['scrap-field'] ?? 0) + scrap
    if (power > 0) assignments['power-grid'] = (assignments['power-grid'] ?? 0) + power
    if (sensor > 0) assignments['sensor-net'] = (assignments['sensor-net'] ?? 0) + sensor
    if (foundry > 0) assignments['alloy-foundry'] = (assignments['alloy-foundry'] ?? 0) + foundry
    if (hangar > 0) assignments['drone-fab'] = (assignments['drone-fab'] ?? 0) + hangar
  }

  // Retired Strike/Ward/Yield bars no longer consume Worker Drones.
  for (const id of NETWORK_BAR_IDS) delete assignments[id]

  const fab = base.fabProject
  const fabProject =
    fab &&
    typeof fab.moduleId === 'string' &&
    fab.moduleId.length > 0
      ? {
          moduleId: fab.moduleId,
          contributed: { ...(fab.contributed ?? {}) },
          progress: Math.max(0, Math.min(1, fab.progress ?? 0)),
        }
      : null

  return {
    workerDrones: workers,
    assignments,
    manufactureProgress: base.manufactureProgress ?? 0,
    fabProject,
  }
}

function withNetworkDefaults(network: NetworkState | undefined): NetworkState {
  const empty = createEmptyNetworkState()
  if (!network) return empty
  if (network.bars) {
    for (const id of NETWORK_BAR_IDS) {
      const rec = network.bars[id]
      empty.bars[id] = {
        progress: Math.max(0, rec?.progress ?? 0),
        levels: Math.max(0, Math.floor(rec?.levels ?? 0)),
      }
    }
  }
  empty.links = {
    racks: Math.max(0, Math.floor(network.links?.racks ?? 0)),
    acuity: Math.max(0, Math.floor(network.links?.acuity ?? 0)),
    cycle: Math.max(0, Math.floor(network.links?.cycle ?? 0)),
  }
  return empty
}

function withFoundryDefaults(raw: GameState['foundry'] | undefined): GameState['foundry'] {
  const empty = createEmptyFoundryState()
  if (!raw || typeof raw !== 'object') return empty
  const slots = Array.isArray(raw.slots)
    ? raw.slots.map((s) => ({
        recipeId: s?.recipeId ?? null,
        progress: Math.max(0, Math.min(1, Number(s?.progress ?? 0) || 0)),
        paid: s?.paid === true,
      }))
    : empty.slots
  const fabrication = Array.isArray(raw.fabrication)
    ? raw.fabrication.map((s) => ({
        kind: s?.kind ?? null,
        jobId: s?.jobId ?? null,
        progress: Math.max(0, Math.min(1, Number(s?.progress ?? 0) || 0)),
        paid: s?.paid === true,
        complete: s?.complete === true,
      }))
    : empty.fabrication
  return {
    recipeLevels: { ...(raw.recipeLevels ?? {}) },
    recipeXp: { ...(raw.recipeXp ?? {}) },
    materials: { ...(raw.materials ?? {}) },
    slots: slots.length > 0 ? slots : empty.slots,
    fabrication: fabrication.length > 0 ? fabrication : empty.fabrication,
    trackedPrintId:
      typeof raw.trackedPrintId === 'string' && raw.trackedPrintId.length > 0
        ? raw.trackedPrintId
        : null,
    facilities: [...(raw.facilities ?? []), ...(raw.pendingFacilities ?? [])],
    pendingFacilities: [],
    pendingCores: [...(raw.pendingCores ?? [])],
    pendingRelics: [...(raw.pendingRelics ?? [])],
  }
}

const RELIQUARY_COLORS: ReliquaryColor[] = ['red', 'orange', 'pink', 'blue', 'green']

function withReliquaryDefaults(raw: ReliquaryState | undefined): ReliquaryState {
  const empty = createEmptyReliquaryState()
  if (!raw || typeof raw !== 'object') return empty
  const owned: Record<string, number> = {}
  if (raw.owned && typeof raw.owned === 'object') {
    for (const [id, n] of Object.entries(raw.owned)) {
      const v = Math.floor(Number(n))
      if (v > 0) owned[id] = v
    }
  }
  const slots: ReliquaryState['slots'] = {}
  for (const color of RELIQUARY_COLORS) {
    const id = raw.slots?.[color]
    slots[color] = typeof id === 'string' && id.length > 0 ? id : null
  }
  const coreFits = hydrateCoreFits(raw.coreFits)
  return { owned, slots, coreFits }
}

/** Move legacy module-definition relic keys onto stable physical Core instance IDs. */
export function migrateCoreFitInstances(state: GameState): void {
  normalizeCoreInstances(state.shipyard)
  const migrated: ReliquaryState['coreFits'] = {}
  for (const [key, slots] of Object.entries(state.reliquary.coreFits ?? {})) {
    const instance = resolveCoreInstance(state, key)
    const target = instance?.id ?? key
    if (!migrated[target]) migrated[target] = [...slots]
  }
  state.reliquary.coreFits = migrated
}

function withFurnaceDefaults(raw: FurnaceState | undefined): FurnaceState {
  return hydrateFurnaceState(raw)
}

function withHiveResearchDefaults(raw: HiveResearchState | undefined): HiveResearchState {
  const empty = createEmptyHiveResearchState()
  if (!raw || typeof raw !== 'object') return empty
  const focus = raw.focus
  empty.focus = HIVE_RESEARCH_BRANCHES.some((b) => b.id === focus) ? focus : 'energy'
  empty.active = raw.active === true
  for (const { id } of HIVE_RESEARCH_BRANCHES) {
    empty.xp[id] = Math.max(0, Number(raw.xp?.[id] ?? 0) || 0)
    empty.completed[id] = Math.max(0, Math.floor(Number(raw.completed?.[id] ?? 0) || 0))
  }
  return empty
}

const YARD_GOODS: YardGoodId[] = ['ore', 'flux', 'ingot']
const YARD_ARMS: YardArmId[] = ['damage', 'shield', 'salvage', 'network']
const YARD_BUILDINGS: YardBuildingId[] = ['slag-heap', 'flux-still', 'ingot-press', 'choir-sieve']

function withYardDefaults(raw: YardState | undefined): YardState {
  const empty = createEmptyYardState()
  if (!raw || typeof raw !== 'object') return empty
  const cells = Array.isArray(raw.cells)
    ? raw.cells.map((c) => {
        const id = c?.buildingId
        return {
          buildingId: id && YARD_BUILDINGS.includes(id) ? id : null,
        }
      })
    : empty.cells
  const goods = { ...empty.goods }
  for (const id of YARD_GOODS) {
    goods[id] = Math.max(0, Number(raw.goods?.[id] ?? empty.goods[id]) || 0)
  }
  const pending = { ...empty.pending }
  const armed = { ...empty.armed }
  for (const id of YARD_ARMS) {
    pending[id] = Math.max(0, Math.floor(Number(raw.pending?.[id] ?? 0) || 0))
    armed[id] = Math.max(0, Math.floor(Number(raw.armed?.[id] ?? 0) || 0))
  }
  return {
    cells: cells.length > 0 ? cells : empty.cells,
    goods,
    pending,
    armed,
  }
}

function withProtocolDefaults(raw: ProtocolState | undefined): ProtocolState {
  const empty = createEmptyProtocolState()
  if (!raw || typeof raw !== 'object') return empty
  const ranks: Record<string, number> = {}
  if (raw.ranks && typeof raw.ranks === 'object') {
    for (const [id, n] of Object.entries(raw.ranks)) {
      const v = Math.max(0, Math.floor(Number(n) || 0))
      if (v > 0) ranks[id] = v
    }
  }
  const bestSector: Record<string, number> = {}
  const rawBest = (raw as ProtocolState).bestSector
  if (rawBest && typeof rawBest === 'object') {
    for (const [id, n] of Object.entries(rawBest)) {
      const v = Math.max(0, Math.floor(Number(n) || 0))
      if (v > 0) bestSector[id] = v
    }
  }
  const bestWave: Record<string, number> = {}
  const rawBestWave = (raw as ProtocolState).bestWave
  if (rawBestWave && typeof rawBestWave === 'object') {
    for (const [id, n] of Object.entries(rawBestWave)) {
      const v = Math.max(0, Math.floor(Number(n) || 0))
      if (v > 0) bestWave[id] = v
    }
  }
  for (const [id, sector] of Object.entries(bestSector)) {
    if (!bestWave[id] && sector > 0) bestWave[id] = sector * 10
  }
  const active = typeof raw.activeId === 'string' ? raw.activeId : null
  return { activeId: active, ranks, bestSector, bestWave }
}

function withEchoDefaults(raw: EchoState | undefined): EchoState {
  const empty = createEmptyEchoState()
  if (!raw || typeof raw !== 'object') return empty
  const tree = Array.isArray(raw.tree) ? raw.tree.filter((id) => typeof id === 'string') : []
  const clears: Record<string, number> = {}
  if (raw.clears && typeof raw.clears === 'object') {
    for (const [id, n] of Object.entries(raw.clears)) {
      const v = Math.max(0, Math.floor(Number(n) || 0))
      if (v > 0) clears[id] = v
    }
  }
  return {
    activeId: null,
    resumeSector: Math.max(1, Math.floor(Number(raw.resumeSector) || 1)),
    resumeWave: Math.max(1, Math.floor(Number(raw.resumeWave) || 1)),
    resumeRoute: raw.resumeRoute === 'B' ? 'B' : 'A',
    points: Math.max(0, Math.floor(Number(raw.points) || 0)),
    tree,
    clears,
  }
}

function withProcessDefaults(raw: ProcessState | undefined): ProcessState {
  return hydrateProcessState(raw) ?? createEmptyProcessState()
}

const SPECIALIST_IDS: SpecialistId[] = ['gunner', 'warden', 'scavenger']

function withSpecialistDefaults(raw: SpecialistState | undefined): SpecialistState {
  const empty = createEmptySpecialistState()
  if (!raw || typeof raw !== 'object') return empty
  for (const id of SPECIALIST_IDS) {
    empty.ranks[id] = Math.max(0, Math.floor(Number(raw.ranks?.[id] ?? 0) || 0))
  }
  return empty
}

const CAPITAL_IDS: CapitalId[] = ['broadside', 'bulkhead', 'hold']

function withCapitalDefaults(raw: CapitalState | undefined): CapitalState {
  const empty = createEmptyCapitalState()
  if (!raw || typeof raw !== 'object') return empty
  for (const id of CAPITAL_IDS) {
    empty.ranks[id] = Math.max(0, Math.floor(Number(raw.ranks?.[id] ?? 0) || 0))
  }
  return empty
}

function withMetaDefaults(
  meta: GameState['meta'] | undefined,
  highestSector: number,
): GameState['meta'] {
  const completed = meta?.completedAchievements ?? []
  const completions: Record<string, number> = {}
  if (meta?.achievementCompletions && typeof meta.achievementCompletions === 'object') {
    for (const [id, n] of Object.entries(meta.achievementCompletions)) {
      const v = Math.floor(Number(n))
      if (v > 0) completions[id] = v
    }
  }
  // Backfill one-off completions for older saves.
  for (const id of completed) {
    if (completions[id] == null) completions[id] = 1
  }
  const laborRaw = meta?.laborProfile
  const laborProfile =
    laborRaw === 'scrap' ||
    laborRaw === 'data' ||
    laborRaw === 'foundry-safe' ||
    laborRaw === 'balanced'
      ? laborRaw
      : 'balanced'

  return {
    highestSectorEver: Math.max(meta?.highestSectorEver ?? 0, highestSector),
    bestWave: Math.max(0, Math.floor(Number(meta?.bestWave ?? 0) || 0)),
    act1Cleared: meta?.act1Cleared ?? false,
    ascensionCount: Math.max(0, Math.floor(Number(meta?.ascensionCount ?? 0))),
    seenOnboarding: meta?.seenOnboarding ?? [],
    seenContent: Array.isArray(meta?.seenContent) ? [...meta.seenContent] : ['legacy'],
    aiUnlocked: meta?.aiUnlocked ?? completed.length > 0,
    codexUnlocked: meta?.codexUnlocked === true,
    laborProfile,
    completedAchievements: completed,
    achievementCompletions: completions,
    lifetimeSectorClears: Math.max(0, Math.floor(Number(meta?.lifetimeSectorClears ?? 0))),
    lifetimeFabCrafts: Math.max(0, Math.floor(Number(meta?.lifetimeFabCrafts ?? 0))),
    lifetimeCoreMerges: Math.max(0, Math.floor(Number(meta?.lifetimeCoreMerges ?? 0))),
    lifetimeWaveClears: Math.max(0, Math.floor(Number(meta?.lifetimeWaveClears ?? 0))),
    lifetimeDronesBuilt: Math.max(0, Math.floor(Number(meta?.lifetimeDronesBuilt ?? 0))),
    discoveredModules: [...(meta?.discoveredModules ?? [])],
    moduleMastery: { ...(meta?.moduleMastery ?? {}) },
    moduleMasteryXp: { ...(meta?.moduleMasteryXp ?? {}) },
    coreProgressionMigrated: meta?.coreProgressionMigrated === true,
    lifetimeCoreRunBuys: Math.max(0, Math.floor(Number(meta?.lifetimeCoreRunBuys ?? 0) || 0)),
    signalCoresCarryOver: meta?.signalCoresCarryOver ?? false,
    // Progressed careers skip the starter death → Plate → salvage lesson.
    starterCombatLesson: (() => {
      const raw = Math.floor(Number(meta?.starterCombatLesson))
      if (Number.isFinite(raw) && raw >= 0) return Math.min(2, raw)
      return (meta?.highestSectorEver ?? 0) > 0 || highestSector > 0 ? 2 : 0
    })(),
    // Progressed careers already left the first-fight lock.
    hullLostOnce:
      meta?.hullLostOnce === true ||
      (meta?.highestSectorEver ?? 0) > 0 ||
      highestSector > 0 ||
      (meta?.ascensionCount ?? 0) > 0 ||
      (meta?.seenOnboarding ?? []).some(
        (id) =>
          id === 'guide-salvage-lesson' ||
          id === 'guide-drone-cap' ||
          id === 'guide-cores-sheet',
      ),
    numberNotation:
      meta?.numberNotation === 'scientific' ? 'scientific' : 'engineering',
    damageNumbers:
      meta?.damageNumbers === 'minimal' || meta?.damageNumbers === 'detailed'
        ? meta.damageNumbers
        : 'standard',
    sortieSpeed: Number(meta?.sortieSpeed) > 0 ? Number(meta?.sortieSpeed) : undefined,
    extractedOnce: meta?.extractedOnce === true,
  }
}

function withSignalCoresDefaults(
  raw: GameState['signalCores'] | undefined,
): SignalCoresState {
  const empty = createEmptySignalCoresState()
  if (!raw || typeof raw !== 'object') return empty
  const inventory: SignalCoreInstance[] = []
  const seen = new Set<string>()
  for (const item of raw.inventory ?? []) {
    if (!item || typeof item !== 'object') continue
    const uid = typeof item.uid === 'string' ? item.uid : ''
    const defId = typeof item.defId === 'string' ? item.defId : ''
    if (!uid || !defId || seen.has(uid) || !getSignalCoreDef(defId)) continue
    const rank = Math.floor(Number(item.rank ?? 1))
    seen.add(uid)
    inventory.push({
      uid,
      defId,
      rank: Number.isFinite(rank)
        ? Math.max(1, Math.min(SIGNAL_CORE_MAX_RANK, rank))
        : 1,
    })
  }
  const uidSet = new Set(inventory.map((c) => c.uid))
  const equipped: Record<string, string> = {}
  if (raw.equipped && typeof raw.equipped === 'object') {
    for (const [slot, uid] of Object.entries(raw.equipped)) {
      if (typeof uid === 'string' && uidSet.has(uid) && /^(assault|ward|signal)-\d+$/.test(slot)) {
        equipped[slot] = uid
      }
    }
  }
  return { inventory, equipped }
}

function withPartsDefaults(
  parts: GameState['parts'] | undefined,
): GameState['parts'] {
  if (!parts || typeof parts !== 'object' || Array.isArray(parts)) return {}
  const out: Record<string, number> = {}
  for (const [id, n] of Object.entries(parts)) {
    const qty = Math.floor(Number(n))
    if (qty > 0) out[id] = qty
  }
  return out
}

function withCoreDefaults(core: GameState['core'] | undefined): CoreState {
  const empty = createEmptyCoreState()
  if (!core || typeof core !== 'object') return empty
  const ranks = { ...empty.ranks }
  const progress = { ...empty.progress }
  for (const id of CORE_ATTR_IDS) {
    const r = Math.floor(Number(core.ranks?.[id as CoreAttrId] ?? 0))
    const p = Number(core.progress?.[id as CoreAttrId] ?? 0)
    ranks[id] = Number.isFinite(r) && r > 0 ? r : 0
    progress[id] = Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 0
  }
  return { ranks, progress }
}

function withAiDefaults(ai: GameState['ai'] | undefined): GameState['ai'] {
  const purchased = ai?.purchased ?? []
  // Drop unknown ids; keep both permanent and doctrines as stored.
  const known = new Set(AI_NODES.map((n) => n.id))
  return { purchased: purchased.filter((id) => known.has(id)) }
}

function backfillCodexUnlocked(
  meta: GameState['meta'],
  research: GameState['research'] | undefined,
  codex: GameState['codex'] | undefined,
): GameState['meta'] {
  if (meta.codexUnlocked) return meta
  const researched = research?.unlocked?.includes('tactical-codex') ?? false
  const hadIntel = (codex?.seenFamilies?.length ?? 0) > 0 && researched
  if (!researched && !hadIntel) return meta
  return { ...meta, codexUnlocked: true }
}

function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<GameState> & {
    version?: number
    prestige?: GameState['prestige'] & { completedChallenges?: string[] }
  }

  if (parsed.version === SAVE_VERSION) {
    const state = parsed as GameState
    const base = createInitialState()
    const combat = withCombatDefaults(state.combat)
    const codex = withCodexDefaults(state.codex)
    const meta = backfillCodexUnlocked(
      withMetaDefaults(state.meta, combat.highestSector),
      state.research,
      codex,
    )
    const hydrated: GameState = {
      ...state,
      resources: withResourcesDefaults(state.resources, base.resources),
      combat,
      workshop: state.workshop ?? createEmptyWorkshop(),
      shipyard: withShipyardDefaults(state.shipyard, base.shipyard),
      base: migrateBase(state.base, base.base),
      network: withNetworkDefaults(state.network),
      foundry: withFoundryDefaults(state.foundry),
      reliquary: withReliquaryDefaults(state.reliquary),
      furnace: withFurnaceDefaults(state.furnace),
      hiveResearch: withHiveResearchDefaults(state.hiveResearch),
      yard: withYardDefaults(state.yard),
      protocols: withProtocolDefaults(state.protocols),
      echo: withEchoDefaults(state.echo),
      process: withProcessDefaults(state.process),
      specialists: withSpecialistDefaults(state.specialists),
      capital: withCapitalDefaults(state.capital),
      essence: withEssenceDefaults(state),
      prestige: withPrestigeDefaults(state.prestige),
      codex,
      ai: withAiDefaults(state.ai),
      meta,
      core: withCoreDefaults(state.core),
      signalCores: withSignalCoresDefaults(state.signalCores),
      parts: withPartsDefaults(state.parts),
      playtest: hydratePlaytest(state.playtest),
    }
    migrateCoreFitInstances(hydrated)
    finalizeProcessMigration(hydrated)
    finalizeFurnaceMigration(hydrated)
    migrateOnboardingState(hydrated)
    migrateLegacyCoreProgression(hydrated)
    return hydrated
  }

  if (
    parsed.version === 1 ||
    parsed.version === 2 ||
    parsed.version === 3 ||
    parsed.version === 4 ||
    parsed.version === 5 ||
    parsed.version === 6 ||
    parsed.version === 7 ||
    parsed.version === 8 ||
    parsed.version === 9 ||
    parsed.version === 10 ||
    parsed.version === 11 ||
    parsed.version === 12 ||
    parsed.version === 13 ||
    parsed.version === 14 ||
    parsed.version === 15 ||
    parsed.version === 16 ||
    parsed.version === 17 ||
    parsed.version === 18 ||
    parsed.version === 19
  ) {
    const base = createInitialState()
    const prev = parsed as GameState & {
      prestige?: GameState['prestige'] & { completedChallenges?: string[] }
    }
    const oldHighest = prev.combat?.highestSector ?? prev.combat?.sector ?? 1
    const clearedApprox =
      parsed.version === 10 ||
      parsed.version === 11 ||
      parsed.version === 14 ||
      parsed.version === 15 ||
      parsed.version === 16 ||
      parsed.version === 17 ||
      parsed.version === 18 ||
      parsed.version === 19
        ? Math.max(0, prev.combat?.highestSector ?? 0)
        : Math.max(0, oldHighest - 1)
    const combat = withCombatDefaults({
      ...base.combat,
      ...prev.combat,
      highestSector: clearedApprox,
      wave: 1,
      playerUnits: [],
      enemyUnits: [],
      fx: [],
      inFight: false,
    })
    const ai = withAiDefaults(prev.ai)
    // Older saves treated all AI as run-scoped; keep permanents after migrate.
    ai.purchased = ai.purchased.filter((id) => {
      const def = AI_NODES.find((n) => n.id === id)
      return def ? isAiNodePermanent(def) || def.kind === 'doctrine' : false
    })
    const codex = withCodexDefaults(prev.codex)
    const meta = backfillCodexUnlocked(
      withMetaDefaults(prev.meta, clearedApprox),
      prev.research,
      codex,
    )
    const hydrated: GameState = {
      ...base,
      ...prev,
      version: SAVE_VERSION,
      resources: withResourcesDefaults(prev.resources, base.resources),
      combat,
      shipyard: withShipyardDefaults(prev.shipyard, base.shipyard),
      base: migrateBase(prev.base, base.base),
      network: withNetworkDefaults(prev.network),
      foundry: withFoundryDefaults(prev.foundry),
      reliquary: withReliquaryDefaults(prev.reliquary),
      furnace: withFurnaceDefaults(prev.furnace),
      hiveResearch: withHiveResearchDefaults(prev.hiveResearch),
      yard: withYardDefaults(prev.yard),
      protocols: withProtocolDefaults(prev.protocols),
      echo: withEchoDefaults(prev.echo),
      process: withProcessDefaults(prev.process),
      specialists: withSpecialistDefaults(prev.specialists),
      capital: withCapitalDefaults(prev.capital),
      essence: withEssenceDefaults(prev),
      prestige: withPrestigeDefaults(prev.prestige),
      codex,
      ai,
      meta,
      core: withCoreDefaults(prev.core),
      signalCores: withSignalCoresDefaults(prev.signalCores),
      parts: withPartsDefaults(prev.parts),
      playtest: hydratePlaytest(prev.playtest),
    }
    migrateCoreFitInstances(hydrated)
    finalizeProcessMigration(hydrated)
    finalizeFurnaceMigration(hydrated)
    migrateOnboardingState(hydrated)
    migrateLegacyCoreProgression(hydrated)
    return hydrated
  }

  return null
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { version?: number }
    if (parsed.version !== SAVE_VERSION) {
      localStorage.removeItem(SAVE_KEY)
      return null
    }
    return migrate(parsed)
  } catch {
    return null
  }
}

export function loadOrCreateGame(now = Date.now()): GameState {
  const loaded = loadGame()
  if (loaded) {
    noteSessionStart(loaded, now)
    return loaded
  }
  const fresh = createInitialState(now)
  noteSessionStart(fresh, now)
  return fresh
}

export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))))
}

export function importSave(code: string): GameState | null {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())))
    const parsed = JSON.parse(json) as { version?: number }
    if (parsed.version !== SAVE_VERSION) return null
    return migrate(parsed)
  } catch {
    return null
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY)
}
