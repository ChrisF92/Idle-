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

export type FoundryRecipeId =
  | 'slag-ingot'
  | 'filament'
  | 'hardened-plate'
  | 'relay'
  | 'choir-flux'
  | 'keel-strip'
  | 'focus-lens'
  | 'void-slag'
  | 'control-mesh'
  | 'warp-thread'
  | 'brace-pin'
  | 'slag-glass'
  | 'temper-bar'
  | 'coil-stack'
  | 'flux-weave'
  | 'hearth-core'
  | 'sight-lattice'
  | 'keel-lattice'

export interface FoundrySlot {
  recipeId: FoundryRecipeId | null
  /** 0..1 toward the current craft. */
  progress: number
  /** True once this cycle's costs have been paid. */
  paid: boolean
}

export interface FoundryState {
  recipeLevels: Record<string, number>
  /** Crafts toward the next recipe level. */
  recipeXp: Record<string, number>
  materials: Record<string, number>
  infinite: string[]
  points: number
  upgrades: Record<string, number>
  slots: FoundrySlot[]
  equipped: string[]
  /** Single Core print the player is currently farming. Persists across Rebuild. */
  trackedPrintId: string | null
}

export type ReliquaryColor = 'red' | 'orange' | 'pink' | 'blue' | 'green'

/** USI V-Device analogue — colour slots, shards persist across Rebuild. */
export interface ReliquaryState {
  owned: Record<string, number>
  slots: Partial<Record<ReliquaryColor, string | null>>
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

/** Furnace 2.0 — live Heat tank + active channels. Upgrades persist; Heat resets on Rebuild unless Ember. */
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

export type HiveResearchBranch = 'material' | 'energy' | 'observation'

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
}

/** Snapshot taken at Launch; closed into lastSortie on Extract / Defeat. */
export interface SortieMark {
  salvage: number
  salvageSpent: number
  sectorsCleared: number
  corePicks: number
  researchXp: number
  networkLevels: number
  stats: SortieRunStats
}

export interface SortieSummary {
  outcome: 'extract' | 'defeat' | null
  sector: number
  wave: number
  note: string
  sectorsCleared: number
  salvageGained: number
  salvageSpent: number
  milestones: number
  researchXp: number
  networkLevels: number
  stats: SortieRunStats
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
}

/** USI Research analogue — kill-fed branches; persist across Rebuild. */
export interface HiveResearchState {
  focus: HiveResearchBranch
  xp: Record<HiveResearchBranch, number>
  /** Completed nodes per branch (0..node count). */
  completed: Record<HiveResearchBranch, number>
}

export type SectorRoute = 'A' | 'B'

/** Sortie push: Advance sectors, Hold the whole sector, or Hold this wave. */
export type CombatPushMode = 'advance' | 'hold-sector' | 'hold-wave'

export type YardGoodId = 'ore' | 'flux' | 'ingot'
export type YardBuildingId = 'slag-heap' | 'flux-still' | 'ingot-press' | 'choir-sieve'
export type YardArmId = 'damage' | 'shield' | 'salvage' | 'network'

export interface YardCell {
  buildingId: YardBuildingId | null
}

/** USI Bases analogue — grid persists; pending arms on the next Rebuild. */
export interface YardState {
  cells: YardCell[]
  goods: Record<YardGoodId, number>
  pending: Record<YardArmId, number>
  armed: Record<YardArmId, number>
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
  /** Best sector reached inside each Protocol, including abandoned runs. */
  bestSector: Record<string, number>
}

/** USI Warp Drive analogue — short gauntlets into a skill tree. */
export interface EchoState {
  activeId: string | null
  resumeSector: number
  resumeWave: number
  resumeRoute: SectorRoute
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

export interface ProcessYardLayout {
  name: string
  cells: YardCell[]
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
    ratios: Partial<Record<NetworkBarId, number>>
  }
  foundry: {
    autoBuy: boolean
    repeatRecipe: FoundryRecipeId | null
    queue: FoundryRecipeId[]
    targetRecipe: FoundryRecipeId | null
    upgradePriority: ProcessFoundryUpgradePriority
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
  yard: {
    autoUpgrade: boolean
    selectedArms: YardArmId[]
    layouts: ProcessYardLayout[]
    activeLayout: number
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
  | 'yard'
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

/** Blueprint part kinds. PartId = `${moduleId}:${PartType}`. */
export type PartType = 'casing' | 'core' | 'lens'

export interface FragmentNotice {
  moduleId: string
  partType: PartType
  name: string
  partHave: number
  partNeed: number
  totalHave: number
  totalNeed: number
  seq: number
}

export type WeaponTag =
  | 'kinetic'
  | 'energy'
  | 'pierce'
  | 'splash'
  | 'dot'
  | 'antiShield'

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
  modules: string[]
  unlockedFrames: string[]
  unlockedModules: string[]
  /** Per-module run upgrade levels (reset on prestige). */
  moduleLevels: Record<string, number>
  /**
   * USI Core milestone picks: moduleId → milestoneId → choiceId.
   * Wipes on Rebuild with Core levels.
   */
  corePicks: Record<string, Record<string, string>>
  /**
   * After the first Launch of a run, the frame cannot be changed until
   * prestige / challenge reset. Modules can still be refit between fights
   * or while Paused.
   */
  frameLocked: boolean
}

export interface WeaponInstance {
  id: string
  name: string
  damage: number
  cooldown: number
  cooldownLeft: number
  /** Max lane distance this weapon can fire. */
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
  isFlagship: boolean
  dots: DotInstance[]
  /** USI-style class. Optional on player units and old saves. */
  role?: EnemyRole
  /**
   * Lane distance from the player flagship (0 = at player).
   * Enemies spawn far and close in; player flagship stays at 0.
   */
  x: number
  /** Vertical offset from centerline (player flagship at 0). */
  y: number
  /** Units of lane distance moved per second. */
  speed: number
  /** Preferred firing distance (enemies close to this, some kite). */
  engageRange: number
  /** If true, back off when closer than engageRange. */
  kite: boolean
  /** Brief phase-shift flash timer (boss telegraphs). */
  phaseWarnLeft: number
  /** Seconds until in-combat shield regen resumes after a hit. */
  regenDelay?: number
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
}

/** In-flight shot — damage applies on impact, not on fire. */
export interface CombatProjectile {
  id: string
  fromId: string
  toId: string
  side: 'player' | 'enemy'
  tag: string
  /** Lane-space position. */
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
}

export interface CombatState {
  sector: number
  /** Highest sector cleared at least once this prestige (warp destinations: 1..highestSector). */
  highestSector: number
  /** Current wave within the sector (1..WAVES_PER_SECTOR). */
  wave: number
  inFight: boolean
  /**
   * Player pause for Shipyard refit / repair. Auto-engage stops until Resume.
   * Pausing resets the current sector to wave 1. AI never toggles this.
   */
  docked: boolean
  /**
   * Advance / Hold-sector / Hold-wave. Combat stays live until hull loss.
   * `campaign` stays in sync: true iff pushMode === 'advance'.
   */
  pushMode: CombatPushMode
  /**
   * Advance mode: after a clear, push to the next sector.
   * Hold mode: farm the current sector repeatedly (same rewards, no sector++).
   * Both modes auto-engage while not Paused.
   */
  campaign: boolean
  /** A/B sector route from 9. Sticky for the sortie; change while docked. */
  route: SectorRoute
  consecutiveLosses: number
  bossPhase: number
  /** Seconds elapsed in the current fight (reset on beginFight). */
  fightElapsed: number
  /** Persisted flagship hull between fights (not fully restored on clear). */
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
  /** Seconds left in the hull-loss beat before Dock. 0 = none. */
  defeatLeft: number
  /** True when the pending beat is a tactical extract, not a hull kill. */
  defeatTactical: boolean
}

/**
 * Worker-drone industry: permanent drone counts, run assignments to stations.
 * Legacy `buildings` may appear in old saves and is migrated away.
 */
export interface FabProject {
  moduleId: string
  contributed: Partial<Record<PartType, number>>
  /** 0..1 craft progress after recipe is filled. */
  progress: number
}

export interface BaseState {
  /** Permanent manufactured worker drones (kept across prestige). */
  workerDrones: number
  /** stationId → assigned workers (resets on prestige). */
  assignments: Record<string, number>
  /** 0..1 progress toward the next manufactured worker drone. */
  manufactureProgress: number
  /** Active Fabrication Bay project (cleared on prestige). */
  fabProject: FabProject | null
  /** @deprecated migrated to worker drones + stations */
  buildings?: Record<string, number>
}

/** Preferred industry auto-assign profile (Labor Router / Labor Loop). */
export type LaborProfile = 'balanced' | 'scrap' | 'data' | 'foundry-safe'

/** Career / meta progress that survives prestige. */
export interface MetaState {
  /** Max sector ever cleared across the career. */
  highestSectorEver: number
  /** Soft Act 1 climax reached (sector 30). */
  act1Cleared: boolean
  /** Light second layer after Act 1 — boosts future Prestige Matter gains. */
  ascensionCount: number
  /** Onboarding tip ids already shown. */
  seenOnboarding: string[]
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
  /** Permanent mastery ranks from investing excess parts (cap 10). */
  moduleMastery: Record<string, number>
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
   * First hull-loss dock. Salvage HUD, Cores spend, Network, and More stay
   * hidden until this is true so the opening fight can finish the Sortie tour.
   */
  hullLostOnce: boolean
  /** HUD numbers ≥ 1000: engineering (12.3e3) or scientific (1.23e4). */
  numberNotation: 'engineering' | 'scientific'
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

export interface PrestigeState {
  prestigeCount: number
  activeChallengeId: string | null
  /** ITRTG-style repeatable clears per challenge id. */
  challengeClears: Record<string, number>
  /** Permanent Challenge Point shop ranks (id → rank). */
  shop: Record<string, number>
  /** Permanent Rebuild Matter shop ranks (id → rank). */
  matterShop: Record<string, number>
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
  base: BaseState
  /** Drone Network bars (Strike / Ward / …). Wiped on Rebuild. */
  network: NetworkState
  /** Foundry recipes / smelters. Recipe XP and points persist; equipped modules wipe on Rebuild. */
  foundry: FoundryState
  /** Shard slots (Reliquary). Inventory + fitted shards persist across Rebuild. */
  reliquary: ReliquaryState
  /** Furnace 2.0 — upgrades and wanted channels persist; Heat resets unless Ember Lock. */
  furnace: FurnaceState
  /** Kill-fed Material / Energy / Observation. Persist across Rebuild. */
  hiveResearch: HiveResearchState
  /** Yard Grid (USI Bases). Buildings persist; pending arms on next Rebuild. */
  yard: YardState
  /** Protocols (USI Challenges). Ranks persist; active run is Rebuild-cleared. */
  protocols: ProtocolState
  /** Echo Runs (USI Warp Drive). Tree + points persist. */
  echo: EchoState
  /** Process automation nodes. Persist across Rebuild. */
  process: ProcessState
  /** Specialists (USI Crew). Ranks persist across Rebuild. */
  specialists: SpecialistState
  /** Capital ranks (USI Capital). Persist across Rebuild. */
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
  /**
   * Account-permanent blueprint parts inventory (PartId → qty).
   * Persists across prestige / challenge resets.
   */
  parts: Record<string, number>
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
