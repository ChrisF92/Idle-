import type { GameState, Resources } from '../types'
import type { SafetyFlag } from './types'

const RESOURCE_KEYS: (keyof Resources)[] = [
  'scrap',
  'alloys',
  'energy',
  'data',
  'essence',
  'aiPoints',
  'prestigeMatter',
  'challengePoints',
  'salvage',
  'choirAsh',
  'heat',
]

function flag(
  kind: SafetyFlag['kind'],
  message: string,
  activeSeconds: number,
): SafetyFlag {
  return { kind, message, activeSeconds }
}

export function inspectNumericSafety(state: GameState, activeSeconds: number): SafetyFlag[] {
  const flags: SafetyFlag[] = []
  const check = (label: string, value: number, allowNegative = false) => {
    if (Number.isNaN(value)) flags.push(flag('nan', `${label} is NaN`, activeSeconds))
    else if (!Number.isFinite(value)) flags.push(flag('infinity', `${label} is ${value}`, activeSeconds))
    else if (!allowNegative && value < -1e-6) {
      flags.push(flag('negative', `${label} is ${value}`, activeSeconds))
    }
    else if (Math.abs(value) > 1e18) {
      flags.push(flag('overflow', `${label} is ${value}`, activeSeconds))
    }
  }

  for (const key of RESOURCE_KEYS) {
    check(`resources.${key}`, state.resources[key] ?? 0)
  }
  check('hull', state.combat.playerHull)
  check('hullMax', state.combat.playerHullMax)
  check('shield', state.combat.playerShield)
  check('shieldMax', state.combat.playerShieldMax)
  check('sector', state.combat.wave)
  check('wave', state.combat.wave)
  check('drones', state.base.workerDrones)
  check('prestigeCount', state.prestige.prestigeCount)

  if (state.combat.playerHullMax < 0) {
    flags.push(flag('invalid', 'hullMax is negative', activeSeconds))
  }
  if (state.combat.playerShieldMax < -1e-6) {
    flags.push(flag('invalid', 'shieldMax is negative', activeSeconds))
  }

  for (const [id, level] of Object.entries(state.workshop?.coreStarts ?? {})) {
    check(`core.${id}`, level)
  }
  for (const [id, rank] of Object.entries(state.network?.links ?? {})) {
    check(`network.links.${id}`, rank)
  }

  return flags
}

export function isFiniteNumber(n: number): boolean {
  return Number.isFinite(n) && !Number.isNaN(n)
}
