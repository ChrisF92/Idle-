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
  | 'stats'

export type EnemyFamilyId =
  | 'swarm'
  | 'armored'
  | 'ethereal'
  | 'divine'
  | 'titan'

export type UnitShape = 'triangle' | 'square' | 'circle' | 'hex' | 'diamond'

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
  /** Wind-up before the shot (boss telegraphs). 0 = fire instantly. */
  telegraphDuration: number
  /** Remaining wind-up; fires when this hits 0 after charging. */
  telegraphLeft: number
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
  consecutiveLosses: number
  bossPhase: number
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
export interface BaseState {
  /** Permanent manufactured worker drones (kept across prestige). */
  workerDrones: number
  /** stationId → assigned workers (resets on prestige). */
  assignments: Record<string, number>
  /** 0..1 progress toward the next manufactured worker drone. */
  manufactureProgress: number
  /** @deprecated migrated to worker drones + stations */
  buildings?: Record<string, number>
}

/** Career / meta progress that survives prestige. */
export interface MetaState {
  /** Max sector ever cleared across the career. */
  highestSectorEver: number
  /** Soft Act 1 climax reached (sector 30). */
  act1Cleared: boolean
  /** Onboarding tip ids already shown. */
  seenOnboarding: string[]
  /** AI Network unlocked (first achievement). */
  aiUnlocked: boolean
  /** Completed achievement ids (permanent). */
  completedAchievements: string[]
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
  /** Permanent Challenge Point shop purchases. */
  shop: string[]
  /** Permanent Prestige Matter shop purchases. */
  matterShop: string[]
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
