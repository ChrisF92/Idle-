/** GDD Directives — run-defining Sortie choices. Reset when the Sortie ends. */

import type { GameState } from './types'
import { ACT1_CADENCE } from './cadence'

export const DIRECTIVE_INTERVAL = 50
export const DIRECTIVE_MAX_PER_SORTIE = 5

export type DirectiveId =
  | 'overcharge'
  | 'scavenger'
  | 'reactive'
  | 'pack-hunter'
  | 'burn-hot'

export interface DirectiveDef {
  id: DirectiveId
  name: string
  blurb: string
  weapon?: number
  incoming?: number
  scrap?: number
  shield?: number
  shieldRegen?: number
  splash?: number
  density?: number
  heat?: number
  heatDrain?: number
}

export const DIRECTIVES: DirectiveDef[] = [
  {
    id: 'overcharge',
    name: 'Overcharge',
    blurb: 'Weapon output ×1.30. Incoming damage ×1.15.',
    weapon: 1.3,
    incoming: 1.15,
  },
  {
    id: 'scavenger',
    name: 'Scavenger Sweep',
    blurb: 'Scrap ×1.35. Weapon output ×0.90.',
    scrap: 1.35,
    weapon: 0.9,
  },
  {
    id: 'reactive',
    name: 'Reactive Array',
    blurb: 'Shield capacity ×1.40. Shield regeneration ×0.75.',
    shield: 1.4,
    shieldRegen: 0.75,
  },
  {
    id: 'pack-hunter',
    name: 'Pack Hunter',
    blurb: 'Splash effectiveness improves. Enemy density increases.',
    splash: 1.35,
    density: 1.25,
  },
  {
    id: 'burn-hot',
    name: 'Burn Hot',
    blurb: 'Heat effectiveness ×1.25. Heat consumption ×1.20.',
    heat: 1.25,
    heatDrain: 1.2,
  },
]

export function getDirective(id: string): DirectiveDef | undefined {
  return DIRECTIVES.find((d) => d.id === id)
}

export function isDirectiveWave(wave: number): boolean {
  const w = Math.max(0, Math.floor(wave))
  if (w < ACT1_CADENCE.directives) return false
  if (w % DIRECTIVE_INTERVAL !== 0) return false
  return w / DIRECTIVE_INTERVAL <= DIRECTIVE_MAX_PER_SORTIE
}

export function emptyDirectives(): { picked: DirectiveId[]; offer: DirectiveId[] | null } {
  return { picked: [], offer: null }
}

function product(
  state: GameState,
  key: keyof Pick<
    DirectiveDef,
    'weapon' | 'incoming' | 'scrap' | 'shield' | 'shieldRegen' | 'splash' | 'density' | 'heat' | 'heatDrain'
  >,
): number {
  let mult = 1
  for (const id of state.combat.directives ?? []) {
    const def = getDirective(id)
    const value = def?.[key]
    if (typeof value === 'number') mult *= value
  }
  return mult
}

export function directiveWeaponMult(state: GameState): number {
  return product(state, 'weapon')
}

export function directiveIncomingMult(state: GameState): number {
  return product(state, 'incoming')
}

export function directiveScrapMult(state: GameState): number {
  return product(state, 'scrap')
}

export function directiveShieldMult(state: GameState): number {
  return product(state, 'shield')
}

export function directiveShieldRegenMult(state: GameState): number {
  return product(state, 'shieldRegen')
}

export function directiveSplashMult(state: GameState): number {
  return product(state, 'splash')
}

export function directiveDensityMult(state: GameState): number {
  return product(state, 'density')
}

export function directiveHeatMult(state: GameState): number {
  return product(state, 'heat')
}

export function directiveHeatDrainMult(state: GameState): number {
  return product(state, 'heatDrain')
}

export function hasDirectiveOffer(state: GameState): boolean {
  return (state.combat.directiveOffer?.length ?? 0) > 0
}

export function directivesUnlocked(state: GameState): boolean {
  const best = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0, state.combat.wave ?? 1)
  return (
    best >= ACT1_CADENCE.directives ||
    (state.combat.directives?.length ?? 0) > 0 ||
    hasDirectiveOffer(state)
  )
}

/** Three unused Directives for this milestone, rotated by Wave. */
export function makeDirectiveOffer(state: GameState, wave: number): DirectiveId[] {
  const taken = new Set(state.combat.directives ?? [])
  const pool = DIRECTIVES.filter((d) => !taken.has(d.id))
  if (pool.length === 0) return []
  const offset = Math.max(0, Math.floor(wave / DIRECTIVE_INTERVAL) - 1)
  const out: DirectiveId[] = []
  for (let i = 0; i < Math.min(3, pool.length); i++) {
    out.push(pool[(offset + i) % pool.length]!.id)
  }
  return out
}

/** After a Wave clear: pause the Sortie if a Directive milestone just landed. */
export function queueDirectiveOffer(state: GameState, clearedWave: number): boolean {
  if (!isDirectiveWave(clearedWave)) return false
  if ((state.combat.directives?.length ?? 0) >= DIRECTIVE_MAX_PER_SORTIE) return false
  if (hasDirectiveOffer(state)) return false
  const offer = makeDirectiveOffer(state, clearedWave)
  if (offer.length === 0) return false
  state.combat.directiveOffer = offer
  return true
}

export function chooseDirective(state: GameState, id: string): GameState {
  const offer = state.combat.directiveOffer ?? []
  const def = getDirective(id)
  if (!def || !offer.includes(def.id)) return state
  const next = structuredClone(state)
  next.combat.directives = [...(next.combat.directives ?? []), def.id]
  next.combat.directiveOffer = null
  next.combat.log = [`Directive: ${def.name}. ${def.blurb}`, ...next.combat.log]
  return next
}

export function clearDirectives(state: GameState): void {
  state.combat.directives = []
  state.combat.directiveOffer = null
}
