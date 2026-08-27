/** Core game types — keep UI-free so simulation can be tested alone. */

export type ResourceId =
  | 'scrap'
  | 'alloys'
  | 'energy'
  | 'data'
  | 'essence'
  | 'aiPoints'
  | 'prestigeMatter'
  | 'challengePoints'
  | 'salvage'
  | 'choirAsh'
  | 'heat'

export const NETWORK_BAR_IDS = [
  'strike',
  'ward',
  'yield',
  'loom',
  'archive',
  'strike-relay',
  'ward-relay',
  'yield-relay',
  'loom-relay',
  'archive-relay',
  'strike-lattice',
  'ward-lattice',
] as const

export type NetworkBarId = (typeof NETWORK_BAR_IDS)[number]

export interface NetworkBarState {
  /** 0..1 fill toward the next level. */
  progress: number
  levels: number
}

/** USI Compute analogue — bar levels wipe on Rebuild; drones and Link ranks persist. */
export interface NetworkState {
  bars: Record<NetworkBarId, NetworkBarState>
  /**
   * Permanent Link ranks (USI compute upgrades).
   * racks = corps cap, acuity = drone efficiency, cycle = fill speed.
   */
  links: Record<NetworkLinkId, number>
}

export type NetworkLinkId = 'racks' | 'acuity' | 'cycle'

export type FoundryMaterialId =
  | 'recovered-stock'
  | 'conductive-filament'
  | 'tempered-alloy'
  | 'ballistic-composite'
  | 'optical-glass'
  | 'shield-lattice'
  | 'control-mesh'
  | 'phase-crystal'
  | 'nanite-compound'
  | 'resonant-ceramic'
  | 'thermal-conductor'
  | 'crown-matrix'

/** Processing recipes are keyed by output material. */
export type FoundryRecipeId = FoundryMaterialId

export type FabJobKind = 'core' | 'frame' | 'relic' | 'worker' | 'facility'

export type FacilityId =
  | 'processing-line'
  | 'fabrication-bay'
  | 'worker-fabricator'
  | 'research-annex'
  | 'recovery-storage'

export interface FoundrySlot {
  recipeId: FoundryMaterialId | null
  /** 0..1 toward the current cycle. */
  progress: number
  /** True once this cycle's costs have been paid. */
  paid: boolean
}

export interface FabricationSlot {
  kind: FabJobKind | null
  jobId: string | null
  /** 0..1 toward the current job. */
  progress: number
  paid: boolean
  /** PR6: exact physical Relic instance being upgraded. */
  targetRelicId?: string | null
}

export interface FoundryState {
  materials: Record<string, number>
  /** Cumulative Material Mastery XP per material. Rank is derived. Caps at M5. */
  masteryXp: Record<string, number>
  /** Processing slots. Each holds at most one paid cycle. */
  slots: FoundrySlot[]
  /** Discrete timed jobs: Cores, Frames, Relics, Workers, facilities. */
  fabrication: FabricationSlot[]
  facilities: FacilityId[]
  /** Blueprint-specific schematic fragments (blueprintId → count). */
  fragments: Record<string, number>
  /** Blueprint IDs whose design is known. Does not imply physical ownership. */
  discovered: string[]
  /** Explicit Foundry capabilities (advanced processing, etc.). */
  capabilities: string[]
  trackedPrintId: string | null
}

/** Leftover Research-tree colour ids. Not a Relic gameplay identity. */
export type ReliquaryColor = 'red' | 'orange' | 'pink' | 'blue' | 'green'

/** Canonical Act 1 Relic socket classes. Universal is a socket type, not a Relic family. */
export type RelicSocketClass =
  | 'power'
  | 'optical'
  | 'ballistic'
  | 'shield'
  | 'industrial'
  | 'universal'

export type RelicInstanceId = string
export type RelicTier = 1 | 2 | 3

export interface RelicInstance {
  id: RelicInstanceId
  familyId: string
  tier: RelicTier
}

/** Physical Relic inventory and per-Core fits. Counts are derived from instances. */
export interface RelicState {
  instances: RelicInstance[]
  nextSerial: Partial<Record<string, number>>
  coreFits: Record<string, Array<RelicInstanceId | null>>
}

/** Legacy rank tracks — kept so old saves can migrate into Furnace 2.0. */
export type FurnaceTrackId = 'attack' | 'defense' | 'lab' | 'workshop' | 'hold'

export type FurnaceChannelId =
  | 'weapons'
  | 'shielding'
  | 'network'
  | 'foundry'
  | 'research'
  | 'recovery'

export type FurnaceUpgradeId =
  | 'hearth'
  | 'cistern'
  | 'flue'
  | 'bellows'
  | 'taps'
  | 'kindling'
  | 'ember'

export type FurnacePresetId = 'push' | 'farm' | 'industry' | 'research'

/** Furnace — Ash converts to Sortie Heat. Channel lights last until Dock. */
export interface FurnaceState {
  /** True after Furnace 2.0 hydrate. Old saves omit this and still carry `ranks`. */
  v2?: boolean
  ranks: Record<FurnaceTrackId, number>
  wanted: Record<FurnaceChannelId, number>
  active: Record<FurnaceChannelId, number>
  priority: FurnaceChannelId[]
  upgrades: Record<FurnaceUpgradeId, number>
  /** Player-facing starve line, or empty. */
  starveNote: string
}

export type HiveResearchBranch = 'material' | 'energy' | 'observation' | 'computation'

/** Lightweight run counters — accumulated, never a per-frame history. */
export interface SortieRunStats {
  damageDealt: number
  damageTaken: number
  shieldAbsorbed: number
  shieldBreaks: number
  enemyCountMax: number
  enemyCountSum: number
  enemyCountSamples: number
  /** Seconds on the last (or current) encounter. */
  finalFightTime: number
  finalEnemyHp: number
  finalEnemyHpMax: number
  playerHp: number
  playerHpMax: number
  /** Incoming damage attributed to a living attacker role. */
  takenByRole: Partial<Record<EnemyRole, number>>
  lastEnemyName: string
  lastEnemyFamily: string
  lastEnemyRole: string
  lastIsBoss: boolean
  kills: number
  /** Sortie RNG seed so unusual packs can be reproduced (GDD §10). */
  sortieSeed?: number
}

export interface SortieSpendByCategory {
  attack: number
  defense: number
  economy: number
}

/** Per equipped Core instance at Sortie close. */
export interface CoreSortieRecord {
  moduleId: string
  slot: number
  runLevel: number
  masteryStart: number
  masteryEnd: number
  masteryXp: number
  salvageSpent: number
  contribution: number
  bossClears: number
  newBestBonus: boolean
  milestones: number[]
}

/** Snapshot taken at Launch; closed into lastSortie on Extract / Defeat. */
export interface SortieMark {
  salvage: number
  salvageSpent: number
  scrap: number
  /** Qualifying combat Scrap generated this Sortie. Extraction uses this, not bank delta. */
  grossScrapGenerated: number
  /** Sortie Provisioning applied once for this launch. */
  provisioningGranted: boolean
  /** Set at launch if this Sortie is a Challenge. Survives mid-Sortie challenge completion. */
  challengeSortie?: boolean
  sectorsCleared: number
  corePicks: number
  researchXp: number
  networkLevels: number
  stats: SortieRunStats
  spendByCategory: SortieSpendByCategory
  ash: number
  data: number
  fragments: number
  cores?: CoreSortieRecord[]
  sortieSeed?: number
}

export interface SortieSummary {
  outcome: 'extract' | 'defeat' | null
  sector: number
  wave: number
  note: string
  sectorsCleared: number
  salvageGained: number
  salvageSpent: number
  scrapEarned: number
  extractionBonusScrap: number
  grossScrapGenerated: number
  newBest: boolean
  previousBest: number
  milestones: number
  researchXp: number
  networkLevels: number
  stats: SortieRunStats
  spendByCategory: SortieSpendByCategory
  ashEarned: number
  dataEarned: number
  fragmentsEarned: number
  cores?: CoreSortieRecord[]
}

export type PressureClass = 'SURVIVABILITY' | 'DAMAGE' | 'MIXED' | 'HEALTHY'

/** Per-sector frontier attempt record for pacing analysis. */
export interface SectorAttemptRecord {
  sector: number
  route: string
  attempts: number
  failures: number
  clears: number
  frontierCombatMs: number
  retreatFarmMs: number
  lastPressure: PressureClass | ''
  lastEnemyHpPct: number
  lastFightMs: number
  successFightMs: number
  interventions: string[]
}

export interface SteamrollStreak {
  from: number
  to: number
  n: number
  route: string
}

export interface FrontierIntervention {
  k: string
  n?: string
  v?: number
}

/** Compact local playtest event. `t` is career playtime in milliseconds. */
export type PlaytestEventKind =
  | 'session_start'
  | 'session_end'
  | 'first_launch'
  | 'first_kill'
  | 'first_defeat'
  | 'highest_sector'
  | 'hold'
  | 'route'
  | 'rebuild'
  | 'reinforce'
  | 'protocol_start'
  | 'protocol_end'
  | 'protocol_clear'
  | 'echo_start'
  | 'echo_end'
  | 'echo_clear'
  | 'core_buy'
  | 'core_assembled'
  | 'core_fitted'
  | 'print_changed'
  | 'foundry_craft'
  | 'foundry_fitted'
  | 'research_break'
  | 'process_buy'
  | 'specialist'
  | 'capital'
  | 'system_open'
  | 'system_action'
  | 'repelled'
  | 'retry_frontier'
  | 'frontier_clear'
  | 'one_shot_streak'

export interface PlaytestEvent {
  t: number
  k: PlaytestEventKind
  /** Display name or id. */
  n?: string
  /** Compact extra (rank, sector, on/off, route). */
  v?: string | number | boolean
}

/** Local-only playtest log. Persists with the save; never sent off-device. */
export interface PlaytestState {
  v: 1
  /** Wall clock when this career started logging. */
  startedAt: number
  /** Accumulated live playtime (ms). */
  playtimeMs: number
  /** Wall clock of the current session. */
  sessionAt: number
  /** Playtime at the current session start. */
  sessionPlaytimeMs: number
  /** First-event keys → playtimeMs. */
  firsts: Record<string, number>
  /** Highest sector recorded in this log. */
  sectorAt: number
  sectorAtPlaytime: number
  events: PlaytestEvent[]
  /** Unique non-starter Core names assembled. */
  cores: string[]
  /** Protocol id → attempts / clears. */
  protocols: Record<string, { a: number; c: number }>
  /** Echo id → attempts / clears. */
  echos: Record<string, { a: number; c: number }>
  /** Network bar id → drone-seconds. */
  drones: Record<string, number>
  /** Live combat simulation time (ms). Excludes pause, dock, and offline. */
  activeCombatMs: number
  /** Career time spent fighting an uncleared frontier sector. */
  frontierCombatMs: number
  /** Career time spent farming a fallback sector after being repelled. */
  retreatFarmMs: number
  /** Offline catch-up while a Sortie was frozen (combat did not run). */
  offlineCombatMs: number
  /** Offline catch-up while Frontier Hold was active. */
  offlineRetreatFarmMs: number
  /** Current consecutive first-attempt highest-sector clears. */
  consecutiveFrontierOneShots: number
  bestConsecutiveFrontierOneShots: number
  steamrollFrom: number
  lastSteamroll: SteamrollStreak | null
  /** Route:sector → attempt record. */
  sectorAttempts: Record<string, SectorAttemptRecord>
  /** Power changes made while Frontier Hold is active, awaiting the next attempt. */
  pendingInterventions: FrontierIntervention[]
}

/** Permanent Research — one timed project at a time; persists across Rebuild. */
export interface HiveResearchState {
  /** Discipline of the active (or last) project. */
  focus: HiveResearchBranch
  /** True while a specific node is running. */
  active?: boolean
  /** Node currently being researched. */
  activeNodeId?: string | null
  /** Seconds of progress toward `activeNodeId`. */
  progress?: number
  /** Completed node ids. Authoritative. */
  completedIds: string[]
  /** Seconds of progress toward that branch's next node. Migrated into `progress`. */
  xp: Record<HiveResearchBranch, number>
  /** Completed node counts per branch. Derived from completedIds. */
  completed: Record<HiveResearchBranch, number>
}

export type WavePackageKind = 'normal' | 'commander' | 'boss'

export interface WavePackageState {
  id: string
  wave: number
  kind: WavePackageKind
  reached: boolean
  secured: boolean
  rewardPaid: boolean
  spawnedUnitIds: string[]
  pendingCount: number
  totalUnits: number
}

export interface PendingReinforcement {
  id: string
  packageId: string
  wave: number
  kind: WavePackageKind
  units: CombatUnit[]
}

export type BossBoundaryPhase = 'idle' | 'holding' | 'warning' | 'active' | 'cleared'

export interface BossBoundaryState {
  phase: BossBoundaryPhase
  wave: number
  warningLeft: number
  /** Authored warning length, captured when the Boss boundary becomes due. */
  warningDuration?: number
}

export interface CombatIdSeq {
  unit: number
  proj: number
  beam: number
  fx: number
  package: number
}

export type ProtocolMute =
  | 'network'
  | 'foundry'
  | 'reliquary'
  | 'furnace'
  | 'weapons'
  | 'shields'
  | 'salvage'

/** Restricted sorties that rank a muted system. Ranks persist; the run loadout does not. */
export interface ProtocolState {
  activeId: string | null
  ranks: Record<string, number>
  /** Best sector reached inside each Challenge, including abandoned runs. */
  bestSector: Record<string, number>
  /** Best Wave reached inside each Challenge. Canonical; bestSector is leftover. */
  bestWave?: Record<string, number>
}

/** USI Warp Drive analogue — short gauntlets into a skill tree. */
export interface EchoState {
  activeId: string | null
  resumeSector: number
  resumeWave: number
  resumeRoute: string
  points: number
  tree: string[]
  clears: Record<string, number>
}

export type ProcessCorePriority =
  | 'cheapest'
  | 'weapon'
  | 'shield'
  | 'utility'
  | 'balanced'
  | 'custom'
  | 'value'

export type ProcessNetworkPreset =
  | 'push'
  | 'defence'
  | 'farm'
  | 'industry'
  | 'research'
  | 'balanced'
  | 'custom'

export type ProcessFoundryUpgradePriority = 'cheapest' | 'speed' | 'slots' | 'output'

export type ProcessReliquaryKeepMode = 'keep-all' | 'keep-best' | 'upgrade-only'

export interface ProcessCorePreset {
  name: string
  priority: ProcessCorePriority
  ratios: { weapon: number; shield: number; utility: number }
}

export type ProcessWhenKind =
  | 'wave-gte'
  | 'wave-of-best'
  | 'hull-lte'
  | 'shield-lte'
  | 'boss-active'
  | 'enemies-gte'
  | 'wave-time-gte'
  | 'salvage-gte'
  | 'scrap-run-gte'
  | 'ash-gte'
  | 'heat-gte'
  | 'processor-idle'
  | 'fabricator-idle'
  | 'stock-lte'
  | 'stock-gte'
  | 'research-idle'
  | 'workers-idle-gte'
  /** @deprecated Migrated to hull-lte on load. */
  | 'threat'
  /** @deprecated Migrated to processor-idle on load. */
  | 'queue-empty'

export type ProcessThenKind =
  | 'spend-profile'
  | 'spend-ratios'
  | 'economy-target'
  | 'extract'
  | 'furnace-preset'
  | 'furnace-push'
  | 'worker-preset'
  | 'foundry-target'
  | 'foundry-stock'
  | 'research-next'
  | 'launch-sortie'
  | 'repeat-recipe'
  | 'fab-tracked'

export type ProcessThreatId = 'SURVIVABILITY' | 'DAMAGE' | 'MIXED' | 'HEALTHY'

export type ProcessRuleJoin = 'and' | 'or'

export interface ProcessCondition {
  kind: ProcessWhenKind
  value?: number
  recipeId?: FoundryRecipeId
  /** @deprecated Migrated away on load. */
  threat?: ProcessThreatId
}

export interface ProcessSpendMix {
  attack: number
  defense: number
  economy: number
}

export interface ProcessAction {
  kind: ProcessThenKind
  spend?: ProcessSpendMix
  economyPct?: number
  recipeId?: FoundryRecipeId | null
  stockMin?: number
  workerPreset?: ProcessNetworkPreset
  furnacePreset?: FurnacePresetId
  furnaceLevel?: number
}

export interface ProcessRule {
  id: string
  label?: string
  enabled: boolean
  join?: ProcessRuleJoin
  when: ProcessCondition[]
  then: ProcessAction
}

export type ProcessProfileId = 'farm' | 'push' | 'challenge' | 'custom'

export interface ProcessProfile {
  id: string
  name: string
  spend: ProcessSpendMix
  salvageReserve: number
  autoExtract: boolean
  extractHullPct: number
  autoShop: boolean
  workerPreset?: ProcessNetworkPreset
  furnacePreset?: FurnacePresetId | null
  foundryRepeat?: FoundryRecipeId | null
  researchAutoNext?: boolean
  rules: ProcessRule[]
}

/** Player-facing automation settings. Persist across Rebuild. */
export interface ProcessConfig {
  core: {
    enabled: boolean
    priority: ProcessCorePriority
    ratios: { weapon: number; shield: number; utility: number }
    presets: ProcessCorePreset[]
    activePreset: number
  }
  network: {
    enabled: boolean
    preset: ProcessNetworkPreset
    ratios: Partial<Record<string, number>>
  }
  foundry: {
    autoBuy: boolean
    repeatRecipe: FoundryRecipeId | null
    queue: FoundryRecipeId[]
    targetRecipe: FoundryRecipeId | null
    upgradePriority: ProcessFoundryUpgradePriority
    minStock: Partial<Record<FoundryRecipeId, number>>
  }
  reliquary: {
    autoMerge: boolean
    autoEquip: boolean
    keepMode: ProcessReliquaryKeepMode
    minScore: number
  }
  furnace: {
    autoFeed: boolean
    preset: string | null
    manager: boolean
    autoChannel: boolean
    reserveHeat: number
    priority: FurnaceChannelId[]
  }
  research: {
    autoResearch: boolean
    queue: HiveResearchBranch[]
    branchPriority: HiveResearchBranch[]
  }
  sortie: {
    autoExtract: boolean
    extractHullPct: number
    autoRelaunch: boolean
    protocolRepeat: boolean
    echoRepeat: boolean
    lastProtocolId: string | null
    lastEchoId: string | null
    protocolId: string | null
  }
  shop: {
    autoBuy: boolean
    ratios: ProcessSpendMix
    salvageReserve: number
  }
  activeProfileId: string | null
  profiles: ProcessProfile[]
  lastActions: Record<string, string>
}

/** Achievements → Process points → automation / QoL / accumulation. */
export interface ProcessState {
  purchased: string[]
  /** Lifetime Process Points earned. Never decreases when spent. */
  earned: number
  config: ProcessConfig
}

export type SpecialistId = 'gunner' | 'warden' | 'scavenger'

/** USI Crew analogue — print / rank; persist across Rebuild. */
export interface SpecialistState {
  ranks: Record<SpecialistId, number>
}

export type CapitalId = 'broadside' | 'bulkhead' | 'hold'

/** USI Capital analogue — second combat scale on the ship. Persist across Rebuild. */
export interface CapitalState {
  ranks: Record<CapitalId, number>
}

export type TabId =
  | 'dock'
  | 'combat'
  | 'cores'
  | 'network'
  | 'foundry'
  | 'reliquary'
  | 'furnace'
  | 'slag'
  | 'protocols'
  | 'echo'
  | 'process'
  | 'specialists'
  | 'tasks'
  | 'capital'
  | 'reinforce'
  | 'logs'
  | 'shipyard'
  | 'base'
  | 'research'
  | 'codex'
  | 'ai'
  | 'prestige'
  | 'core'
  | 'stats'

/** Worker-trained Core attributes (run-scoped; wiped on prestige). */
export type CoreAttrId =
  | 'reactors'
  | 'ballistics'
  | 'plating'
  | 'sensors'
  | 'logistics'

export interface CoreState {
  ranks: Record<CoreAttrId, number>
  /** 0..1 progress toward the next rank for each attribute. */
  progress: Record<CoreAttrId, number>
}

/** Typed equipment slots for Signal Cores (USI-inspired). */
export type SignalCoreSlotType = 'assault' | 'ward' | 'signal'

export type SignalCoreRarity = 'common' | 'rare' | 'epic'

/** Additive passives — percents as fractions (0.05 = +5%), flat for armor/shield. */
export interface SignalCorePassive {
  damage?: number
  hull?: number
  armor?: number
  shield?: number
  scrap?: number
  production?: number
  fab?: number
  drop?: number
  matchup?: number
  evasion?: number
}

export interface SignalCoreDef {
  id: string
  name: string
  description: string
  rarity: SignalCoreRarity
  allowedSlots: SignalCoreSlotType[]
  basePassive: SignalCorePassive
  slotBonus: Partial<Record<SignalCoreSlotType, SignalCorePassive>>
}

export interface SignalCoreInstance {
  uid: string
  defId: string
  /** 1..5 */
  rank: number
}

export interface SignalCoresState {
  inventory: SignalCoreInstance[]
  /** slotKey → uid; slotKey like `assault-0`, `ward-1` */
  equipped: Record<string, string>
}

/** Aggregated equipped Signal Core bonuses. */
export interface SignalCoreBonuses {
  damage: number
  hull: number
  armor: number
  shield: number
  scrap: number
  production: number
  fab: number
  drop: number
  matchup: number
  evasion: number
}

export type EnemyFamilyId =
  | 'swarm'
  | 'armored'
  | 'ethereal'
  | 'divine'
  | 'titan'

export type UnitShape = 'triangle' | 'square' | 'circle' | 'hex' | 'diamond'

/** USI hull classes — stand-off, speed, and silhouette. */
export type EnemyRole = 'fighter' | 'skirmisher' | 'sniper' | 'juggernaut' | 'shield' | 'boss'

export interface FragmentNotice {
  moduleId: string
  name: string
  have: number
  need: number
  seq: number
}

export type WeaponTag =
  | 'kinetic'
  | 'energy'
  | 'pierce'
  | 'splash'
  | 'dot'
  | 'antiShield'
  | 'bypass'

/** How a Core or enemy gun delivers its hit. Bolts travel; beams connect; charge winds up then bolts. */
export type WeaponDelivery = 'bolt' | 'beam' | 'charge'

export interface Resources {
  scrap: number
  alloys: number
  energy: number
  data: number
  essence: number
  aiPoints: number
  prestigeMatter: number
  challengePoints: number
  /** Run-only combat drop for module upgrades; resets on prestige. */
  salvage: number
  /** Furnace feed — persists across Rebuild. Auto-collected from kills. */
  choirAsh: number
  /** Spent on Furnace ranks — persists across Rebuild. */
  heat: number
}

export interface ShipLoadout {
  frameId: string
  /** Core definitions fitted into Frame slots. Kept parallel with equippedCoreIds. */
  modules: string[]
  /** Physical Core copies owned by the player. Mastery remains shared by moduleId. */
  coreInstances: CoreInstance[]
  /** Physical Core instance IDs fitted into the matching modules array positions. */
  equippedCoreIds: string[]
  unlockedFrames: string[]
  unlockedModules: string[]
  /**
   * After the first Launch of a run, the frame cannot be changed until
   * prestige / challenge reset. Modules can still be refit between fights
   * or while Paused.
   */
  frameLocked: boolean
}

/** Canonical Targeting Doctrine IDs. Authored defaults apply until Fire-Control Doctrine unlocks. */
export const TARGETING_DOCTRINE_IDS = [
  'threat',
  'focus',
  'execution',
  'heavy',
  'shield',
  'cluster',
] as const

export type TargetingDoctrineId = (typeof TARGETING_DOCTRINE_IDS)[number]

export type CombatOverlayMode = 'off' | 'selected' | 'all'

/** Per physical target-capable Core. Reset with each Sortie; persisted while live. */
export interface CoreTargetingTelemetry {
  /**
   * No-target → a Current Target. Reacquisition after a loss also increments
   * this counter (a later lock of a new or the same enemy is a new acquisition,
   * not a switch).
   */
  initialAcquisitions: number
  /** Current Target A → Current Target B without an intervening loss. */
  targetSwitches: number
  timeNoTargetWhileEnemies: number
  timeAcquiredOutsideFire: number
  timeSlewLimited: number
  timeActivelyFiring: number
  shotsHeldIllegalSolution: number
  acquisitionDelayAccum: number
  /** Discrete fire events (projectile volley or beam connect), not per-tick. */
  shotsFired: number
}

export interface CoreInstance {
  id: string
  moduleId: string
  /**
   * Player-selected Doctrine for this physical copy.
   * Ignored until Fire-Control Doctrine is unlocked; invalid values fall back
   * to the authored default. Survives Sortie and Rebuild; not reset with Core Level.
   */
  targetingDoctrine?: TargetingDoctrineId | null
}

export interface WeaponInstance {
  id: string
  name: string
  damage: number
  cooldown: number
  cooldownLeft: number
  /** Max Euclidean distance this weapon can fire. */
  range: number
  tags: WeaponTag[]
  /** Extra targets beyond the primary. */
  splash: number
  dotDuration: number
  dotDamage: number
  /** Wind-up before the shot (boss telegraphs / sniper charge lasers). 0 = fire instantly. */
  telegraphDuration: number
  /** Remaining wind-up; fires when this hits 0 after charging. */
  telegraphLeft: number
  /** Unit id the current telegraph is locking. */
  telegraphToId?: string
  /** Heavy Lance: charge completed and is holding for a legal release. */
  chargeReady?: boolean
  /** Bolt (default), connected beam, or charge-then-bolt. */
  delivery?: WeaponDelivery
  /** USI damage vs hull / shield / armour HP types. */
  hullDamage?: number
  shieldDamage?: number
  armorDamage?: number
}

export interface DotInstance {
  dps: number
  remaining: number
}

export interface CombatUnit {
  id: string
  side: 'player' | 'enemy'
  name: string
  shape: UnitShape
  family: string
  hull: number
  hullMax: number
  shield: number
  shieldMax: number
  armor: number
  evasion: number
  damageTakenMult: number
  weapons: WeaponInstance[]
  isBoss: boolean
  /** Player Hive hull/shield pool. Cores are not this unit. */
  isFlagship: boolean
  /** Fitted weapon Core satellite. No HP; fires from orbit. */
  isCore?: boolean
  coreModuleId?: string
  coreSlot?: number
  /** Stable physical Core instance ID from the loadout. Distinct for duplicates. */
  coreInstanceId?: string
  /**
   * PR7 Veil flicker etc. may set this false. Default/omitted = targetable.
   * Untargetable is not death.
   */
  targetable?: boolean
  /** Enemies never select this unit. Player Core satellites are untargetable. */
  untargetable?: boolean
  /**
   * True once kill rewards have been granted for this unit this Sortie.
   * Prevents duplicate Salvage/Scrap/kill counts from secondary hits or cleanup.
   */
  killRewarded?: boolean
  dots: DotInstance[]
  /** USI-style class. Optional on player units and old saves. */
  role?: EnemyRole
  /**
   * True world X. Hive origin is (0, 0). +X is right.
   */
  x: number
  /**
   * True world Y. Hive origin is (0, 0). +Y is up.
   */
  y: number
  /**
   * For fitted player Cores this is the outward radial facing and always
   * equals `orbitAngle`. Independent turret-style aiming heading is not used.
   * Enemies and projectiles still use heading as movement/aim direction.
   */
  heading?: number
  /** Position on the Hive orbit ring in radians. Player-Core slew advances this. */
  orbitAngle?: number
  /** Core orbit radius in simulation units. */
  orbitRadius?: number
  /** Persistent current target enemy ID for this physical Core. */
  currentTargetId?: string
  /**
   * Simulated seconds the SAME valid Current Target has been retained.
   * 0 on fresh acquisition / loss / switch. Does not reset on cooldown,
   * pre-slew, pause, or Doctrine change. PR4 owns Beam Ramp / Lock Memory
   * consumption; PR2 only accumulates the clock.
   */
  targetLockTime?: number
  /** Simulation time of the next discretionary target evaluation. */
  nextTargetEvalAt?: number
  targetingTelemetry?: CoreTargetingTelemetry
  /**
   * Latches a single blocked-fire opportunity while the weapon is ready
   * with an illegal solution. Cleared when the Core fires or leaves ready.
   */
  heldShotNoted?: boolean
  /** Wave package this unit belongs to. */
  packageId?: string
  /** Wave that spawned this unit. */
  sourceWave?: number
  /** Units of world distance moved per second. */
  speed: number
  /**
   * Temporary movement multiplier from Grav / control. Reset each tick.
   * Never mutate authored `speed` to apply Slow.
   */
  controlSlowMult?: number
  /** Preferred firing distance (enemies close to this, some kite). */
  engageRange: number
  /** If true, back off when closer than engageRange. */
  kite: boolean
  /** Brief phase-shift flash timer (boss telegraphs). */
  phaseWarnLeft: number
  /** Seconds until in-combat shield regen resumes after a hit. */
  regenDelay?: number
  /** Kill-reward share. Authored enemies default to 1; density wing units are fractional. */
  rewardWeight?: number
}

export interface CombatFx {
  id: string
  fromId: string
  toId: string
  tag: string
  ttl: number
  /** Damage shown as a floating number. Omitted on misses / old saves. */
  amount?: number
  hit?: 'hull' | 'shield' | 'miss'
  /**
   * World position for death/hit FX after the target CombatUnit is retired.
   * FX IDs are serialised (`combat.idSeq.fx`) so save/reload continuation stays
   * deterministic; FX never feeds combat RNG, targeting, or rewards.
   */
  x?: number
  y?: number
}

/** In-flight shot — damage applies on impact, not on fire. */
export interface CombatProjectile {
  id: string
  fromId: string
  toId: string
  side: 'player' | 'enemy'
  tag: string
  /** World-space position. */
  x: number
  y: number
  damage: number
  tags: WeaponTag[]
  dotDuration: number
  dotDamage: number
  /** Lane units per second. */
  speed: number
  attackerFamily: string
  hullDamage?: number
  shieldDamage?: number
  armorDamage?: number
  delivery?: WeaponDelivery
  /** Lane spawn point — visual traces draw from here. Optional on old saves. */
  originX?: number
  originY?: number
  /** Attacker class at fire time. Optional on old saves. */
  attackerRole?: EnemyRole
  /** Radial heading used by the battlefield (0 = screen-up). */
  heading?: number
  /** Flagship weapon id (`${moduleId}-wpn`) so shots can leave that Core. */
  weaponId?: string
  /** Player Core type that fired this shot. Used for source-owned Mastery. */
  sourceModuleId?: string
  /** Optional Shield Bypass fraction for this shot. */
  shieldBypassFrac?: number
}

/** Connected beam — damage ticks while the line is up (USI Beam Laser). */
export interface CombatBeam {
  id: string
  fromId: string
  toId: string
  side: 'player' | 'enemy'
  tag: string
  tags: WeaponTag[]
  remaining: number
  duration: number
  /** Total damage budget for the full connect. */
  damage: number
  attackerFamily: string
  hullDamage?: number
  shieldDamage?: number
  armorDamage?: number
  /** Visual-only: accumulated beam damage waiting for a popup. */
  popupAcc?: number
  /** Visual-only: time since the last beam popup. */
  popupT?: number
  /** Attacker class at fire time. Optional on old saves. */
  attackerRole?: EnemyRole
  heading?: number
  weaponId?: string
  sourceModuleId?: string
  shieldBypassFrac?: number
}

export type RunUpgradeCategory = 'attack' | 'defense' | 'economy'

export type RunUpgradeId =
  | 'weapon-power'
  | 'cycle-rate'
  | 'crit-chance'
  | 'crit-factor'
  | 'armor-pen'
  | 'targeting-servos'
  | 'hull'
  | 'shield'
  | 'shield-regen'
  | 'armor'
  | 'repair-rate'
  | 'damage-control'
  | 'salvage-kill'
  | 'salvage-wave'
  | 'scrap-kill'
  | 'scrap-wave'
  | 'fragment-find'
  | 'ash-recovery'

/** Known permanent generic upgrades per category. Starter-six begins at 2. */
export interface GenericUpgradeUnlocks {
  attack: number
  defense: number
  economy: number
}

/** Rebuild-cycle starting power. Survives Sorties; resets on Rebuild. */
export interface WorkshopState {
  levels: Record<string, number>
  /** Scrap-funded cycle starting levels keyed by physical Core instance ID. */
  coreStarts: Record<string, number>
}

export type RelicSocketSpec = {
  type: RelicSocketClass
  /** Alternate class this socket also accepts (e.g. Shield/Universal). */
  alt?: RelicSocketClass
}

export type CoreSlotGrantSource =
  | 'starter'
  | 'early-bus'
  | 'mid-bus'
  | 'engineering'
  | 'foundry'
  | 'research'
  | 'test'

export interface CoreSlotGrant {
  id: string
  source: CoreSlotGrantSource
  slots: number
}

/** Sortie-local Core combat/support runtime. Resets with the Sortie. */
export interface SortieCoreRuntime {
  salvageMarks: Record<string, { until: number; elite?: boolean }>
  moltenPools: Array<{
    id: string
    x: number
    y: number
    radius: number
    until: number
    dps: number
    corrosion: number
  }>
  barrierInterceptCooldown: number
  barrierEmergencyUntil: number
  barrierRearmWeak: boolean
  ablativeLayerHp: number
  ablativeRegenAt: number
  tempArmor: number
  tempArmorUntil: number
  deferredDamage: number
  deferredUntil: number
  choirTapHeatGranted: number
  choirTapFurnaceFeed: boolean
  pulseChainAt: Record<string, number>
  phaseRamp: Record<string, number>
  phaseLockMemory: Record<string, { targetId: string; ramp: number; until: number }>
  phaseExposureUntil: Record<string, number>
  heavyFractureUntil: number
  gravWellUntil: number
  aegisOverflow: number
  aegisBreakUntil: number
  plateBreakArmorUntil: number
  nanoLatheBurstAt: number
}

export interface CombatState {
  /** Latest Wave Reached this Sortie (0 before the first reinforcement). */
  wave: number
  waveReached: number
  /** Career best Wave this prestige/account. */
  bestWave: number
  /** Temporary Attack/Defense/Economy ranks bought with Salvage this Sortie. */
  runUpgrades: Record<string, number>
  /** Mastery rank at Sortie start, keyed by Core type. */
  coreMasteryStart?: Record<string, number>
  /** Mastery XP gained this Sortie, keyed by Core type. */
  coreMasteryXp?: Record<string, number>
  coreBossClears?: Record<string, number>
  coreNewBest?: Record<string, boolean>
  coreMilestones?: Record<string, number[]>
  inFight: boolean
  /**
   * Authoritative Sortie pause. Combat simTime advances only while a live
   * Sortie is RUNNING (`docked === false && sortiePaused === false`).
   */
  sortiePaused: boolean
  /**
   * Player is at Dock with no live Sortie. Extract sets this and ends the run.
   */
  docked: boolean
  consecutiveLosses: number
  /** Stable Sortie RNG seed. 0 is allowed for tests. */
  sortieSeed: number
  rng: { s: number }
  /** Elapsed simulation time this Sortie. */
  simTime: number
  /** Leftover sim seconds waiting for the next fixed step. */
  simAccumulator: number
  /** Simulation timestamp of the next normal reinforcement. */
  nextReinforcementAt: number
  /** Next Wave number the scheduler will attempt to start. */
  nextWave: number
  packages: WavePackageState[]
  pendingReinforcements: PendingReinforcement[]
  bossBoundary: BossBoundaryState
  idSeq: CombatIdSeq
  /** Named mechanic on the current proper Boss, if any. */
  bossMechanic?: string
  /** Threat budget roll for the live wave. */
  waveThreat?: { seed: number; budget: number; spent: number }
  bossPhase: number
  /** Seconds elapsed in the current Sortie (same as simTime while live). */
  fightElapsed: number
  /** Persisted Hive hull between Sorties. */
  playerHull: number
  playerHullMax: number
  playerShield: number
  playerShieldMax: number
  playerUnits: CombatUnit[]
  enemyUnits: CombatUnit[]
  enemyName: string
  enemyFamily: string
  enemyTags: string[]
  isBoss: boolean
  /** Aggregated enemy hull for meters / legacy helpers. */
  enemyHull: number
  enemyHullMax: number
  /** Live projectiles traveling toward targets. */
  projectiles: CombatProjectile[]
  /** Connected beams (Phase Beam / beam fighters). */
  beams: CombatBeam[]
  fx: CombatFx[]
  log: string[]
  /** Latest Core fragment pickup. Session-only; stripped on load. */
  fragmentNotice: FragmentNotice | null
  /** Set on Extract / Defeat for the Dock summary. */
  lastSortie: SortieSummary
  /** Live sortie snapshot. Null while docked. */
  sortieMark: SortieMark | null
  /** Seconds left in the hull-loss beat before retreat or Dock. 0 = none. */
  defeatLeft: number
  /** True when the pending beat is a tactical extract, not a hull kill. */
  defeatTactical: boolean
  /** Directives chosen this Sortie. Wipe on Dock. */
  directives: string[]
  /** Pending Directive choice. Combat does not auto-engage while set. */
  directiveOffer: string[] | null
  /** Sortie-local Core combat/support runtime. */
  coreRuntime?: SortieCoreRuntime
}

/**
 * Worker-drone industry: permanent owned Workers, distinct from capacity.
 */
export interface BaseState {
  /** Permanent manufactured worker drones (kept across prestige). */
  workerDrones: number
  /** stationId → assigned workers. Assignments are operational; ownership persists. */
  assignments: Record<string, number>
}

/** Preferred industry auto-assign profile (Labor Router / Labor Loop). */
export type LaborProfile = 'balanced' | 'scrap' | 'data' | 'foundry-safe'

/** Career / meta progress that survives prestige. */
export interface MetaState {
  /** Highest Wave reached on any Sortie this career. */
  bestWave: number
  /** Persistent Sortie serial used to mint a new stable seed per launch. */
  sortieSerial: number
  /** Act 1 finale reached (Wave 1000). */
  act1Cleared: boolean
  /** First Wave 1000 clear — pending Act 1 completion presentation. */
  act1FinalePending?: boolean
  /** Light second layer after Act 1 — boosts future Prestige Matter gains. */
  ascensionCount: number
  /** Legacy onboarding ids. Kept in sync with `onboarding` for save migration. */
  seenOnboarding: string[]
  /** Terminal lesson state only. Unseen/active are not persisted. */
  onboarding: Partial<Record<string, 'complete' | 'skipped'>>
  /** Persistent presentation dedupe keys (system unlocks, rebuild-ready, …). */
  acknowledgedEvents: string[]
  /**
   * Content keys the player has already opened (systems, Network bars,
   * Foundry recipes). Missing on old saves — hydrated as a legacy sentinel.
   */
  seenContent: string[]
  /** AI Network unlocked (first achievement). */
  aiUnlocked: boolean
  /**
   * Codex permanently unlocked once Tactical Codex is researched.
   * Survives prestige / ascension (research itself still wipes).
   */
  codexUnlocked: boolean
  /** Preferred Labor Router profile for auto-assign buttons / Labor Loop. */
  laborProfile: LaborProfile
  /** Completed achievement ids (permanent; repeatables mark once on first tier). */
  completedAchievements: string[]
  /** Repeatable achievement completion counts (id → tiers claimed). */
  achievementCompletions: Record<string, number>
  /** Lifetime sector clears (for repeatable achievements). */
  lifetimeSectorClears: number
  /** Lifetime Fabrication Bay crafts. */
  lifetimeFabCrafts: number
  /** Lifetime Signal Core merges. */
  lifetimeCoreMerges: number
  /** Lifetime waves cleared (any wave victory). */
  lifetimeWaveClears: number
  /** Lifetime worker drones manufactured (raises corps capacity softly). */
  lifetimeDronesBuilt: number
  /** Modules with at least one blueprint fragment recovered (permanent). */
  discoveredModules: string[]
  /** Permanent Core Mastery level per Core type. Survives Rebuild. */
  moduleMastery: Record<string, number>
  /** XP toward the next Mastery level, per Core type. */
  moduleMasteryXp?: Record<string, number>
  /** Lifetime manual Core Level purchases (legacy field name retained in saves). */
  lifetimeCoreRunBuys?: number
  /**
   * After first Null Signal clear, Signal Cores inventory + equipped
   * persist through prestige / challenge resets.
   */
  signalCoresCarryOver: boolean
  /**
   * Fresh-career combat tutorial:
   * 0 = awaiting first scripted death → dock + Plate lesson
   * 1 = Plate fitted, awaiting second death → salvage upgrades
   * 2 = tutorial complete
   */
  starterCombatLesson: number
  /**
   * First hull-loss dock. Salvage HUD, Dock Core spending, Network, and More stay
   * hidden until this is true so the opening fight can finish the Sortie tour.
   */
  hullLostOnce: boolean
  /** HUD numbers ≥ 1000: engineering (12.3e3) or scientific (1.23e4). */
  numberNotation: 'engineering' | 'scientific'
  /** GDD §113 floating combat numbers. */
  damageNumbers: 'minimal' | 'standard' | 'detailed'
  /**
   * Chosen Sortie combat speed. Clamped to unlocked Time Compression speeds.
   * Missing on old saves — treated as 1×.
   */
  sortieSpeed?: number
  /** Player has Extracted at least once. Hides the first-run Extract row. */
  extractedOnce?: boolean
  /**
   * Permanent generic-upgrade unlock counts per category.
   * Survives Rebuild. Workshop cycle levels do not live here.
   */
  genericUpgradeUnlocks: GenericUpgradeUnlocks
  /** First Extraction sheet has been opened and explained. */
  extractionExplained?: boolean
  /**
   * Extra normal-bus Core positions from later systems (Engineering / Foundry)
   * or explicit test grants. Never a Best-Wave fifth-slot shortcut.
   */
  coreSlotGrants?: CoreSlotGrant[]
}

export interface ResearchState {
  unlocked: string[]
}

export interface AiState {
  /**
   * Purchased AI nodes. Doctrines are stripped on prestige;
   * automation / QoL nodes persist (see catalog persist flags).
   */
  purchased: string[]
}

export interface EssenceState {
  /** Permanent essence upgrades kept across prestige. */
  purchased: string[]
}

/** Progress inside the current Rebuild cycle. Wiped when a Rebuild lands. */
export interface RebuildCycleState {
  bestWave: number
  /** Completed normal (non-Challenge) Sorties this cycle. */
  normalSortiesCompleted: number
  /** Gross Scrap GENERATED this cycle. Spending does not reduce this. */
  scrapGenerated: number
}

export interface PrestigeState {
  prestigeCount: number
  activeChallengeId: string | null
  /** ITRTG-style repeatable clears per challenge id. */
  challengeClears: Record<string, number>
  /** Permanent Challenge Point shop ranks (id → rank). */
  shop: Record<string, number>
  /** Permanent Rebuild Matter shop ranks (id → rank). */
  matterShop: Record<string, number>
  /** Stats for the current Rebuild cycle. Reset when a Rebuild lands. */
  cycle: RebuildCycleState
}

/** Encounter memory for the Codex — persists across prestige. */
export interface CodexState {
  /** Families observed in combat this career (meta). */
  seenFamilies: EnemyFamilyId[]
}

export interface GameState {
  version: number
  lastTickAt: number
  resources: Resources
  shipyard: ShipLoadout
  combat: CombatState
  workshop: WorkshopState
  base: BaseState
  /** Drone Network bars (Strike / Ward / …). Wiped on Rebuild. */
  network: NetworkState
  /** Foundry processing, timed fabrication, infrastructure, Blueprints. Persist through Rebuild. */
  foundry: FoundryState
  /** Physical Relics and per-physical-Core fits. Persist through Rebuild. */
  relics: RelicState
  /** Furnace 2.0 — upgrades and wanted channels persist; Heat resets unless Ember Lock. */
  furnace: FurnaceState
  /** Kill-fed Material / Energy / Observation. Persist across Rebuild. */
  hiveResearch: HiveResearchState
  /** Challenges. Ranks persist; active run is Rebuild-cleared. */
  protocols: ProtocolState
  /** @deprecated Echo Runs leftover. Tree + points persist but never apply. */
  echo: EchoState
  /** Process automation nodes. Persist across Rebuild. */
  process: ProcessState
  /** @deprecated Specialists leftover. Ranks persist but never apply. */
  specialists: SpecialistState
  /** @deprecated Capital leftover. Ranks persist but never apply. */
  capital: CapitalState
  research: ResearchState
  ai: AiState
  essence: EssenceState
  prestige: PrestigeState
  codex: CodexState
  meta: MetaState
  /** Run-scoped Core attribute ranks / training progress (wiped on prestige). */
  core: CoreState
  /**
   * Signal Cores inventory + equipped slots.
   * Wiped on prestige unless meta.signalCoresCarryOver.
   */
  signalCores: SignalCoresState
  /** Local playtest event log. Missing on old saves — hydrated empty. */
  playtest: PlaytestState
}

/** Summary stats for UI / shipyard (derived from loadout + meta). */
export interface ShipCombatStats {
  /** Estimated fleet DPS (weapons / cooldowns). */
  damage: number
  hullMax: number
  shieldMax: number
  armor: number
  evasion: number
  damageTakenMult: number
  escortCount: number
}
