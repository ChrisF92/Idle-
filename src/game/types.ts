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

export type TabId =
  | 'combat'
  | 'shipyard'
  | 'base'
  | 'research'
  | 'ai'
  | 'prestige'
  | 'stats'

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
}

export interface ShipLoadout {
  frameId: string
  modules: string[]
  unlockedFrames: string[]
  unlockedModules: string[]
}

export interface WeaponInstance {
  id: string
  name: string
  damage: number
  cooldown: number
  cooldownLeft: number
  tags: WeaponTag[]
  /** Extra targets beyond the primary. */
  splash: number
  dotDuration: number
  dotDamage: number
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
}

export interface CombatFx {
  id: string
  fromId: string
  toId: string
  tag: string
  ttl: number
}

export interface CombatState {
  sector: number
  highestSector: number
  inFight: boolean
  /**
   * Advance mode (USI-like continuous push).
   * When false, fleet Holds on the current sector (repairs; future farming).
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
  fx: CombatFx[]
  log: string[]
}

export interface BaseState {
  buildings: Record<string, number>
}

export interface ResearchState {
  unlocked: string[]
}

export interface AiState {
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
