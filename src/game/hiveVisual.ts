/** Frame / Core presentation helpers for battlefield and Dock hive preview. */

import { getModule } from './catalog'
import { coreRoleColor } from './combatVisual'
import type { GameState } from './types'

export { coreRoleColor }

export type CoreVisualKind = 'flak' | 'beam' | 'heavy' | 'pulse' | 'shield' | 'utility'

export function coreVisualKind(moduleId: string): CoreVisualKind {
  const def = getModule(moduleId)
  if (!def) return 'utility'
  if (def.role === 'defense') return 'shield'
  if (def.role === 'utility') return 'utility'
  const tags = def.weapon?.tags ?? []
  if (tags.includes('splash') || moduleId.includes('flak') || moduleId.includes('ion')) return 'flak'
  if (def.weapon?.delivery === 'beam' || moduleId.includes('beam') || moduleId.includes('phase')) {
    return 'beam'
  }
  if (tags.includes('pierce') || moduleId.includes('lance') || moduleId.includes('rail')) return 'heavy'
  return 'pulse'
}

/** Sim / lane orbit. Do not change these without a combat pass. */
export function coreOrbitRadius(kind: CoreVisualKind): number {
  switch (kind) {
    case 'flak':
    case 'shield':
      return 22
    case 'pulse':
      return 30
    case 'utility':
      return 34
    case 'beam':
      return 40
    case 'heavy':
      return 44
  }
}

/** Extra pixels so Cores sit outside the larger Hive sprite. Presentation only. */
export const CORE_SCREEN_ORBIT_PAD = 14

export function coreScreenOrbit(kind: CoreVisualKind): number {
  return coreOrbitRadius(kind) + CORE_SCREEN_ORBIT_PAD
}

/** Canvas radius of the Hive hull. Presentation only. */
export const HIVE_VISUAL_RADIUS = 22

export function hiveDrawRadius(bodyR = HIVE_VISUAL_RADIUS): number {
  return bodyR * 1.22
}

/**
 * How fast a weapon Core slews around the ring toward a target.
 * Higher = snaps sooner. Presentation only today; a good hook if we later
 * let Mastery / shop / Frame change slew.
 */
export function coreSlewStiffness(kind: CoreVisualKind, beaming: boolean): number {
  if (beaming) return 18
  if (kind === 'heavy') return 12
  return 14
}

export function coreOrbitSpeed(kind: CoreVisualKind): number {
  switch (kind) {
    case 'flak':
      return 2.4
    case 'shield':
      return 1.6
    case 'pulse':
      return 1.35
    case 'utility':
      return 1.1
    case 'beam':
      return 0.85
    case 'heavy':
      return 0.55
  }
}

export type HiveFrameStyle = 'starter' | 'bastion' | 'swarm' | 'reactor' | 'harvester'

export function hiveFrameStyle(frameId: string): HiveFrameStyle {
  if (frameId.includes('bastion')) return 'bastion'
  if (frameId.includes('swarm')) return 'swarm'
  if (frameId.includes('reactor')) return 'reactor'
  if (frameId.includes('harvest')) return 'harvester'
  return 'starter'
}

export interface HiveFramePalette {
  hull: string
  hullDeep: string
  stroke: string
  heart: string
  trim: string
}

export function hiveFramePalette(style: HiveFrameStyle): HiveFramePalette {
  switch (style) {
    case 'bastion':
      return { hull: '#6a5840', hullDeep: '#3a2e22', stroke: '#e0c07a', heart: '#f0d090', trim: '#c4a050' }
    case 'swarm':
      return { hull: '#5a4a38', hullDeep: '#2c241c', stroke: '#d8c4a0', heart: '#e08a3a', trim: '#8b97a8' }
    case 'reactor':
      return { hull: '#5a4030', hullDeep: '#2a1c14', stroke: '#ff9a4a', heart: '#ff7a2a', trim: '#e08a3a' }
    case 'harvester':
      return { hull: '#5c4a32', hullDeep: '#2e2418', stroke: '#c47a3a', heart: '#e0a050', trim: '#3d8f88' }
    default:
      return { hull: '#6a5238', hullDeep: '#32281e', stroke: '#ffe8c7', heart: '#e08a3a', trim: '#e0b06a' }
  }
}

export function equippedCoreVisuals(state: GameState) {
  return state.shipyard.modules.map((id, index) => {
    const def = getModule(id)
    const role = def?.role ?? 'utility'
    const kind = coreVisualKind(id)
    return {
      id,
      name: def?.name ?? id,
      role,
      kind,
      color: coreRoleColor(role),
      orbit: coreOrbitRadius(kind),
      speed: coreOrbitSpeed(kind),
      index,
    }
  })
}
