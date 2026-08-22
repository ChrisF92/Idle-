/** GDD §9.2 — every 10th Wave has a named mechanic, not just extra HP. */

import { isAct1ClimaxWave, isBossWave } from './waves'

export type BossMechanicId =
  | 'telegraph-slam'
  | 'add-spawn'
  | 'shield-phase'
  | 'support-aura'
  | 'climax-choir'

const CYCLE: BossMechanicId[] = ['telegraph-slam', 'add-spawn', 'shield-phase', 'support-aura']

export function bossMechanicForWave(wave: number): BossMechanicId | null {
  const w = Math.max(1, Math.floor(wave))
  if (isAct1ClimaxWave(w)) return 'climax-choir'
  if (!isBossWave(w)) return null
  const decade = Math.floor(w / 10)
  return CYCLE[(decade - 1) % CYCLE.length] ?? 'telegraph-slam'
}

export function bossMechanicName(id: BossMechanicId): string {
  switch (id) {
    case 'telegraph-slam':
      return 'Telegraphed Slam'
    case 'add-spawn':
      return 'Add Spawn'
    case 'shield-phase':
      return 'Shield Phase'
    case 'support-aura':
      return 'Support Aura'
    case 'climax-choir':
      return 'Choir Crown'
  }
}

export function bossMechanicBlurb(id: BossMechanicId): string {
  switch (id) {
    case 'telegraph-slam':
      return 'Boss winds a long slam before each shot. Read the ring, then the orb.'
    case 'add-spawn':
      return 'Boss calls thralls as its hull breaks. Clear the adds or they stack.'
    case 'shield-phase':
      return 'At two-thirds hull the Boss raises a shield wall. Burn the bank first.'
    case 'support-aura':
      return 'Nearby thralls mend while the Boss lives. Split fire or the pack stalls.'
    case 'climax-choir':
      return 'Act 1 climax. Slam, shield wall, and attending mites in one authored fight.'
  }
}

export function bossMechanicHasAdds(id: BossMechanicId): boolean {
  return id === 'add-spawn' || id === 'climax-choir'
}

export function bossMechanicHasShieldPhase(id: BossMechanicId): boolean {
  return id === 'shield-phase' || id === 'climax-choir'
}

export function bossMechanicHasAura(id: BossMechanicId): boolean {
  return id === 'support-aura' || id === 'climax-choir'
}

export function bossMechanicTelegraph(id: BossMechanicId): number {
  switch (id) {
    case 'telegraph-slam':
      return 0.75
    case 'climax-choir':
      return 0.55
    default:
      return 0.35
  }
}
