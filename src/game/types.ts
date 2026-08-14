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

export type NetworkBarId = 'strike' | 'ward' | 'yield' | 'loom' | 'archive'

export interface NetworkBarState {
  /** 0..1 fill toward the next level. */
  progress: number
  levels: number
}

/** USI Compute analogue — bar levels wipe on Rebuild; drones persist. */
export interface NetworkState {
  bars: Record<NetworkBarId, NetworkBarState>
}

export type FoundryRecipeId =
  | 'slag-ingot'
  | 'filament'
  | 'hardened-plate'
  | 'relay'
  | 'choir-flux'
  | 'keel-strip'

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
}

export type ReliquaryColor = 'red' | 'orange' | 'pink' | 'blue' | 'green'

/** USI V-Device analogue — colour slots, shards persist across Rebuild. */
export interface ReliquaryState {
  owned: Record<string, number>
  slots: Partial<Record<ReliquaryColor, string | null>>
}

export type FurnaceTrackId = 'attack' | 'defense' | 'lab' | 'workshop'

/** USI Reactor analogue — ranks persist; ash/heat live on resources. */
export interface FurnaceState {
  ranks: Record<FurnaceTrackId, number>
}

export type HiveResearchBranch = 'material' | 'energy' | 'observation'

/** Snapshot taken at Launch; closed into lastSortie on Extract / Defeat. */
export interface SortieMark {
  salvage: number
  salvageSpent: number
  sectorsCleared: number
  corePicks: number
  researchXp: number
  networkLevels: number
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
}

/** USI Research analogue — kill-fed branches; persist across Rebuild. */
export interface HiveResearchState {
  focus: HiveResearchBranch
  xp: Record<HiveResearchBranch, number>
  /** Completed nodes per branch (0..node count). */
  completed: Record<HiveResearchBranch, number>
}

export type SectorRoute = 'A' | 'B'

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

export type ProtocolMute = 'network' | 'foundry' | 'reliquary' | 'furnace'

/** USI Challenges analogue — restricted sorties that rank a muted system. */
export interface ProtocolState {
  activeId: string | null
  ranks: Record<string, number>
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

/** Achievements → Process points → automation / QoL. */
export interface ProcessState {
  purchased: string[]
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
  /** Set on Extract / Defeat for the Dock summary. */
  lastSortie: SortieSummary
  /** Live sortie snapshot. Null while docked. */
  sortieMark: SortieMark | null
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
  /** Permanent Prestige Matter shop ranks (id → rank). */
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
  /** Furnace ranks. Persist across Rebuild. */
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
