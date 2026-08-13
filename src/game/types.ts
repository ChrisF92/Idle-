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

export type TabId =
  | 'combat'
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

/** Blueprint part kinds. PartId = `${moduleId}:${PartType}`. */
export type PartType = 'casing' | 'core' | 'lens'

export type WeaponTag =
  | 'kinetic'
  | 'energy'
  | 'pierce'
  | 'splash'
  | 'dot'
  | 'antiShield'

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
}

export interface ShipLoadout {
  frameId: string
  modules: string[]
  unlockedFrames: string[]
  unlockedModules: string[]
  /** Per-module run upgrade levels (reset on prestige). */
  moduleLevels: Record<string, number>
  /**
   * After the first Launch of a run, the frame and fitted modules are locked
   * until Extraction, Defeat, Prestige, or Ascension.
   */
  frameLocked: boolean
}

export interface WeaponInstance {
  id: string
  name: string
  damage: number
  cooldown: number
  cooldownLeft: number
  /** Max arena distance this weapon can fire. */
  range: number
  tags: WeaponTag[]
  /** Extra targets beyond the primary. */
  splash: number
  dotDuration: number
  dotDamage: number
  /** Wind-up before the shot (boss telegraphs). 0 = fire instantly. */
  telegraphDuration: number
  /** Remaining wind-up; fires when this hits 0 after charging. */
  telegraphLeft: number
}

/** Expedition combat mode (Patrol arrives in a later phase). */
export type ExpeditionMode = 'push' | 'paused'

/** Summary shown after Extract or Defeat. */
export interface ExpeditionRunSummary {
  bestWave: number
  waveReached: number
  basePm: number
  awardedPm: number
  extracted: boolean
  salvageEarned: number
  scrapEarned: number
  durationSec: number
  defeated: boolean
}

/** Temporary Forward Base building during an Expedition. */
export interface ForwardBuildingState {
  level: number
  assignedDrones: number
  timerRemaining?: number
  timerKind?: 'construct' | 'upgrade'
}

export type ForwardBuildingId =
  | 'gunnery-matrix'
  | 'salvage-relay'
  | 'shield-foundry'
  | 'repair-dock'

export interface ForwardBaseState {
  buildings: Record<ForwardBuildingId, ForwardBuildingState>
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
  /**
   * Arena cartesian X (flagship at origin). Enemies spawn on the perimeter
   * and close inward; escorts orbit near the core.
   */
  x: number
  /** Arena cartesian Y (flagship at origin). */
  y: number
  /** Arena units moved per second (radial approach / orbit). */
  speed: number
  /** Preferred firing radius from the flagship. */
  engageRange: number
  /** If true, back off when closer than engageRange. */
  kite: boolean
  /** Brief phase-shift flash timer (boss telegraphs). */
  phaseWarnLeft: number
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
  /** Arena-space position. */
  x: number
  y: number
  damage: number
  tags: WeaponTag[]
  dotDuration: number
  dotDamage: number
  /** Arena units per second. */
  speed: number
  attackerFamily: string
}

export interface CombatState {
  /** Active Sector id number (Sector 1 for the first campaign). */
  sector: number
  /**
   * Legacy bridge: highest sector-equivalent cleared this prestige.
   * Derived from wave progress during Phase 1.
   */
  highestSector: number
  /** Current Expedition wave (1–100 authored; 101+ Endless). */
  wave: number
  /** Highest wave fully cleared this Expedition. */
  bestWaveThisRun: number
  /** Checkpoint start wave (1 = from beginning). */
  checkpointWave: number
  /** Push vs paused (Patrol arrives later). */
  mode: ExpeditionMode
  inFight: boolean
  /**
   * Pre-launch / paused hangar. While true, combat simulation stops.
   * Pause does not repair, reset the wave, or unlock refit.
   */
  docked: boolean
  /**
   * @deprecated Use mode === 'push'. Kept true while pushing for older UI paths.
   */
  campaign: boolean
  consecutiveLosses: number
  bossPhase: number
  /** Seconds elapsed in the current fight (reset on beginFight). */
  fightElapsed: number
  /** Wall-clock start of the current Expedition (0 if not launched). */
  expeditionStartedAt: number
  /** Salvage earned this Expedition (for run summary). */
  runSalvageEarned: number
  /** Scrap earned this Expedition (for run summary). */
  runScrapEarned: number
  /** Estimated PM if Extracting now (includes +5% bonus). */
  estimatedPrestigeMatter: number
  /** Temporary ship-system upgrade ranks (Salvage store; reset on Extract/Defeat). */
  upgrades: Record<string, number>
  /** Temporary Forward Base buildings + drone assignments. */
  forwardBase: ForwardBaseState
  /** Last completed run summary (Extract or Defeat). */
  lastRunSummary: ExpeditionRunSummary | null
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
  fx: CombatFx[]
  log: string[]
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
  /** Max sector-equivalent ever cleared (legacy unlock bridge). */
  highestSectorEver: number
  /** Max Expedition wave ever reached (career). */
  highestWaveEver: number
  /** Soft Act 1 climax — first wave-100 clear. */
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
