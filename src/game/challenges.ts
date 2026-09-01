/** Canonical Act 1 Challenges: fresh Wave-1 Sorties with authored restrictions and medals. */

import type { FoundryMaterialId, GameState, ChallengeState } from './types'
import { ACT1_CADENCE } from './cadence'
import { completeBlueprintFromSource } from './blueprints'
import { noteAttempt } from './playtest'
import { getModule } from './catalog'

const FIRE_CONTROL_DOCTRINE_RESEARCH_ID = 'd1-fire-control-doctrine'

export const CHALLENGE_UNLOCK_WAVE = ACT1_CADENCE.challenges
export const CHALLENGE_MAX_MEDAL = 3
export const CHALLENGE_MEDAL_STEP = 75
export const KNIFE_FIGHT_RANGE_CAP = 120
export const PRESSURE_FRONT_INTERVAL_MULT = 0.8
export const HOLLOW_CHOIR_INTERVAL_MULT = 0.85
export const DEAD_RECKONING_ACQUISITION_MULT = 0.75

export type ChallengeMedal = 'bronze' | 'silver' | 'gold'
export type ChallengeRestriction =
  | 'thin-hull'
  | 'short-range'
  | 'no-utility'
  | 'single-pattern'
  | 'no-hull-repair'
  | 'fast-waves'
  | 'default-doctrines'
  | 'no-sensors'
  | 'no-furnace'
  | 'no-directives'

export interface ChallengeUniqueReward {
  kind: 'blueprint' | 'account-unlock' | 'cosmetic'
  id: string
  name: string
}

export interface ChallengeDef {
  id: string
  name: string
  description: string
  restriction: string
  restrictions: ChallengeRestriction[]
  targetWave: number
  uniqueRewards: ChallengeUniqueReward[]
  material: FoundryMaterialId
  requiresFireControl?: boolean
  requiresAct1Clear?: boolean
  finale?: boolean
}

const blueprint = (id: string, name: string): ChallengeUniqueReward => ({ kind: 'blueprint', id, name })

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'glass-frame',
    name: 'Glass Frame',
    description: 'Survive with a Hive built around half its normal Hull.',
    restriction: 'Maximum Hull reduced by 50%',
    restrictions: ['thin-hull'],
    targetWave: 450,
    uniqueRewards: [blueprint('ablative-mesh', 'Ablative Mesh Blueprint')],
    material: 'tempered-alloy',
  },
  {
    id: 'knife-fight',
    name: 'Knife Fight',
    description: 'Fight inside a compressed close-range envelope.',
    restriction: `Weapon fire range capped at ${KNIFE_FIGHT_RANGE_CAP}`,
    restrictions: ['short-range'],
    targetWave: 500,
    uniqueRewards: [blueprint('tracking-gimbal', 'Tracking Gimbal Blueprint')],
    material: 'optical-glass',
  },
  {
    id: 'bare-hive',
    name: 'Bare Hive',
    description: 'Solve the Sortie without Utility Cores.',
    restriction: 'Utility Cores cannot be fitted',
    restrictions: ['no-utility'],
    targetWave: 550,
    uniqueRewards: [blueprint('gravity-lens', 'Gravity Lens Blueprint')],
    material: 'control-mesh',
  },
  {
    id: 'single-pattern',
    name: 'Single Pattern',
    description: 'Commit every fitted weapon slot to one Core type.',
    restriction: 'All fitted weapon Cores must be the same type',
    restrictions: ['single-pattern'],
    targetWave: 600,
    uniqueRewards: [blueprint('swarm-frame', 'Swarm Frame Blueprint')],
    material: 'ballistic-composite',
  },
  {
    id: 'attrition',
    name: 'Attrition',
    description: 'Hold the line without restoring Hull during the attempt.',
    restriction: 'Active Hull repair is disabled',
    restrictions: ['no-hull-repair'],
    targetWave: 650,
    uniqueRewards: [blueprint('nanite-reservoir', 'Nanite Reservoir Blueprint')],
    material: 'nanite-compound',
  },
  {
    id: 'pressure-front',
    name: 'Pressure Front',
    description: 'Contain a faster continuous-Wave schedule.',
    restriction: 'Normal reinforcement interval reduced by 20%',
    restrictions: ['fast-waves'],
    targetWave: 700,
    uniqueRewards: [blueprint('shatter-mesh', 'Shatter Mesh Blueprint')],
    material: 'shield-lattice',
  },
  {
    id: 'silent-bridge',
    name: 'Silent Bridge',
    description: 'Trust each Core’s authored targeting defaults.',
    restriction: 'Manual Targeting Doctrines disabled; authored defaults remain',
    restrictions: ['default-doctrines'],
    targetWave: 725,
    uniqueRewards: [blueprint('predictive-bus', 'Predictive Bus Blueprint')],
    material: 'control-mesh',
    requiresFireControl: true,
  },
  {
    id: 'dead-reckoning',
    name: 'Dead Reckoning',
    description: 'Fight without Sensor support and with weaker acquisition.',
    restriction: 'Sensor effects disabled; Acquisition Range reduced by 25%',
    restrictions: ['no-sensors'],
    targetWave: 800,
    uniqueRewards: [blueprint('focusing-array', 'Focusing Array Blueprint')],
    material: 'phase-crystal',
  },
  {
    id: 'cold-furnace',
    name: 'Cold Furnace',
    description: 'Push without Igniting the Furnace.',
    restriction: 'Furnace cannot Ignite',
    restrictions: ['no-furnace'],
    targetWave: 850,
    uniqueRewards: [blueprint('harvester-frame', 'Harvester Frame Blueprint')],
    material: 'thermal-conductor',
  },
  {
    id: 'hollow-choir',
    name: 'Hollow Choir',
    description: 'Break the loop with Furnace and Directives silent.',
    restriction: 'Furnace off; Directives off; Hull reduced by 25%; Waves arrive faster',
    restrictions: ['no-furnace', 'no-directives', 'fast-waves'],
    targetWave: 1000,
    uniqueRewards: [
      { kind: 'account-unlock', id: 'loopbreaker', name: 'Loopbreaker' },
      { kind: 'cosmetic', id: 'hollow-choir-prestige', name: 'Hollow Choir prestige cosmetic' },
    ],
    material: 'crown-matrix',
    requiresAct1Clear: true,
    finale: true,
  },
]

export function createEmptyChallengeState(): ChallengeState {
  return { activeId: null, medals: {}, bestWave: {}, uniqueRewards: [] }
}

export function getChallenge(id: string): ChallengeDef | undefined {
  return CHALLENGES.find((row) => row.id === id)
}

export function activeChallenge(state: GameState): ChallengeDef | undefined {
  const id = state.challenges?.activeId
  return id ? getChallenge(id) : undefined
}

export function challengeMedalRank(state: GameState, id: string): number {
  return Math.max(0, Math.min(CHALLENGE_MAX_MEDAL, Math.floor(state.challenges?.medals[id] ?? 0)))
}

export function challengeMedalName(rank: number): ChallengeMedal | null {
  return rank === 1 ? 'bronze' : rank === 2 ? 'silver' : rank === 3 ? 'gold' : null
}

export function challengeGoalWave(state: GameState, id: string): number {
  const def = getChallenge(id)
  if (!def) return 0
  if (def.finale) return def.targetWave
  return Math.min(1000, def.targetWave + challengeMedalRank(state, id) * CHALLENGE_MEDAL_STEP)
}

export function challengeBestWave(state: GameState, id: string): number {
  return Math.max(0, Math.floor(state.challenges?.bestWave[id] ?? 0))
}

export function challengeHasRestriction(state: GameState, restriction: ChallengeRestriction): boolean {
  return activeChallenge(state)?.restrictions.includes(restriction) === true
}

export function challengeHullMult(state: GameState): number {
  const id = state.challenges?.activeId
  if (id === 'glass-frame') return 0.5
  if (id === 'hollow-choir') return 0.75
  return 1
}

export function challengeReinforcementIntervalMult(state: GameState): number {
  const id = state.challenges?.activeId
  if (id === 'pressure-front') return PRESSURE_FRONT_INTERVAL_MULT
  if (id === 'hollow-choir') return HOLLOW_CHOIR_INTERVAL_MULT
  return 1
}

export const challengeBlocksDoctrineConfig = (state: GameState) => challengeHasRestriction(state, 'default-doctrines')
export const challengeBlocksHullRepair = (state: GameState) => challengeHasRestriction(state, 'no-hull-repair')
export const challengeBlocksFurnace = (state: GameState) => challengeHasRestriction(state, 'no-furnace')
export const challengeBlocksDirectives = (state: GameState) => challengeHasRestriction(state, 'no-directives')
export const challengeDisablesSensorEffects = (state: GameState) => challengeHasRestriction(state, 'no-sensors')

export function challengeAcquisitionMult(state: GameState): number {
  return challengeDisablesSensorEffects(state) ? DEAD_RECKONING_ACQUISITION_MULT : 1
}

export function challengeFireRangeCap(state: GameState): number | undefined {
  return challengeHasRestriction(state, 'short-range') ? KNIFE_FIGHT_RANGE_CAP : undefined
}

export function isCoreBlockedByChallenge(state: GameState, moduleId: string): boolean {
  const def = getModule(moduleId)
  if (!def) return false
  return challengeHasRestriction(state, 'no-utility') && def.role === 'utility'
}

export function challengeLoadoutIssue(state: GameState): string | null {
  if (challengeHasRestriction(state, 'no-utility')) {
    if (state.shipyard.modules.some((id) => getModule(id)?.role === 'utility')) return 'Remove Utility Cores'
  }
  if (challengeHasRestriction(state, 'single-pattern')) {
    const weapons = state.shipyard.modules.filter((id) => getModule(id)?.role === 'weapon')
    if (new Set(weapons).size > 1) return 'Fit only one weapon Core type'
  }
  return null
}

export function challengeUnlocked(state: GameState, id: string): boolean {
  const def = getChallenge(id)
  const best = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0)
  if (!def || best < CHALLENGE_UNLOCK_WAVE) return false
  if (def.requiresAct1Clear && !state.meta.act1Cleared) return false
  if (def.requiresFireControl && !(state.hiveResearch?.completedIds ?? []).includes(FIRE_CONTROL_DOCTRINE_RESEARCH_ID)) return false
  return true
}

export function canEnterChallenge(state: GameState, id: string, opts?: { automated?: boolean }): { ok: boolean; reason?: string } {
  if (!state.combat.docked || state.combat.inFight) return { ok: false, reason: 'Dock first' }
  if (state.challenges.activeId) return { ok: false, reason: 'Already in a Challenge' }
  const def = getChallenge(id)
  if (!def) return { ok: false, reason: 'Unknown Challenge' }
  if (!challengeUnlocked(state, id)) {
    if (def.requiresAct1Clear) return { ok: false, reason: 'Defeat the Wave 1000 Choir Crown first' }
    if (def.requiresFireControl) return { ok: false, reason: 'Complete Fire-Control Doctrine Research first' }
    return { ok: false, reason: `Reach Wave ${CHALLENGE_UNLOCK_WAVE}` }
  }
  if (def.finale && challengeMedalRank(state, id) >= 1) return { ok: false, reason: 'Cleared' }
  if (!def.finale && challengeMedalRank(state, id) >= CHALLENGE_MAX_MEDAL) return { ok: false, reason: 'Gold earned' }
  if (opts?.automated && challengeMedalRank(state, id) < 1) return { ok: false, reason: 'Earn Bronze manually first' }
  return { ok: true }
}

export function noteChallengeProgress(state: GameState): void {
  const id = state.challenges.activeId
  if (!id) return
  const reached = Math.max(0, Math.floor(state.combat.waveReached ?? state.combat.wave ?? 0))
  state.challenges.bestWave[id] = Math.max(state.challenges.bestWave[id] ?? 0, reached)
}

function materialReward(rank: number): number {
  return rank === 1 ? 2 : rank === 2 ? 4 : 7
}

function grantUniqueRewards(state: GameState, def: ChallengeDef): string[] {
  const granted: string[] = []
  for (const reward of def.uniqueRewards) {
    const key = `${reward.kind}:${reward.id}`
    if (state.challenges.uniqueRewards.includes(key)) continue
    if (reward.kind === 'blueprint') completeBlueprintFromSource(state, reward.id)
    state.challenges.uniqueRewards.push(key)
    granted.push(reward.name)
  }
  return granted
}

/** Awards exactly one new medal when its secured-Wave target is met. Mutates. */
export function tryCompleteChallenge(state: GameState, securedWave: number): string | null {
  const def = activeChallenge(state)
  if (!def) return null
  noteChallengeProgress(state)
  const goal = challengeGoalWave(state, def.id)
  if (Math.max(0, Math.floor(securedWave)) < goal) return null
  const previous = challengeMedalRank(state, def.id)
  const next = Math.min(def.finale ? 1 : CHALLENGE_MAX_MEDAL, previous + 1)
  if (next <= previous) return null
  state.challenges.medals = { ...state.challenges.medals, [def.id]: next }
  const points = def.finale ? 6 : next
  state.resources.challengePoints += points
  const materials = def.finale ? 10 : materialReward(next)
  state.foundry.materials[def.material] = (state.foundry.materials[def.material] ?? 0) + materials
  const unique = previous === 0 ? grantUniqueRewards(state, def) : []
  state.challenges.activeId = null
  const medal = def.finale ? 'CLEAR' : challengeMedalName(next)!.toUpperCase()
  const rewardText = [
    `+${points} Challenge Point${points === 1 ? '' : 's'}`,
    `+${materials} ${def.material}`,
    ...unique,
  ].join(' · ')
  noteAttempt(state, 'challenge', def.id, 'clear', def.name)
  const note = `${def.name} ${medal} complete. ${rewardText}`
  state.combat.log = [note, ...state.combat.log].slice(0, 40)
  return note
}

/** Death/Extraction ends an unfinished Challenge attempt without erasing earned persistent rewards. */
export function endChallengeAttempt(state: GameState, outcome: 'defeat' | 'extract'): void {
  const def = activeChallenge(state)
  if (!def) return
  noteChallengeProgress(state)
  state.challenges.activeId = null
  noteAttempt(state, 'challenge', def.id, 'end', `${def.name}:${outcome}`)
}

export function challengeMedalLabel(state: GameState, id: string): string {
  const def = getChallenge(id)
  const rank = challengeMedalRank(state, id)
  if (def?.finale) return rank > 0 ? 'Cleared' : 'Open'
  return rank === 0 ? 'No medal' : `${challengeMedalName(rank)![0]!.toUpperCase()}${challengeMedalName(rank)!.slice(1)}`
}

export function challengeRewardSummary(state: GameState, id: string): string {
  const def = getChallenge(id)
  if (!def) return 'Unknown'
  const rank = challengeMedalRank(state, id)
  if ((def.finale && rank >= 1) || (!def.finale && rank >= CHALLENGE_MAX_MEDAL)) return 'Complete'
  if (rank === 0) return def.uniqueRewards.map((row) => row.name).join(' · ')
  const next = rank + 1
  return `${next} Challenge Points · ${materialReward(next)} ${def.material}`
}

export function challengeDisabledSystems(def: ChallengeDef): string {
  const labels: string[] = []
  if (def.restrictions.includes('no-utility')) labels.push('Utility Cores')
  if (def.restrictions.includes('no-hull-repair')) labels.push('Hull repair')
  if (def.restrictions.includes('default-doctrines')) labels.push('Manual Doctrines')
  if (def.restrictions.includes('no-sensors')) labels.push('Sensor effects')
  if (def.restrictions.includes('no-furnace')) labels.push('Furnace Ignite')
  if (def.restrictions.includes('no-directives')) labels.push('Directives')
  return labels.length > 0 ? labels.join(', ') : 'None'
}

export function challengeScenarioLines(def: ChallengeDef): string[] {
  return [
    'Uses the normal account and starts a fresh Sortie at Wave 1.',
    'No entry currency and no Rebuild is consumed.',
    'Death ends the attempt; persistent rewards already earned remain.',
    def.restriction,
  ]
}
