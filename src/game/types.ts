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

export interface CombatState {
  sector: number
  highestSector: number
  inFight: boolean
  /** Always-on sector push (USI-like). */
  campaign: boolean
  /** True after repeated losses — campaign waits for Resume. */
  walled: boolean
  /** Seconds before next auto-engage while campaign is on. */
  repairTimer: number
  consecutiveLosses: number
  /** Boss phase index 0–2. */
  bossPhase: number
  playerHull: number
  playerHullMax: number
  enemyName: string
  enemyFamily: string
  enemyTags: string[]
  enemyDamage: number
  isBoss: boolean
  enemyHull: number
  enemyHullMax: number
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
  completedChallenges: string[]
  /** Permanent Challenge Point shop purchases. */
  shop: string[]
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

export interface ShipCombatStats {
  damage: number
  hullMax: number
  damageTakenMult: number
}
