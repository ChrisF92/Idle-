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

export type HiveFrameStyle = 'scout' | 'line' | 'cruiser' | 'heavy' | 'capital' | 'razor' | 'pathfinder' | 'bastion'

export function hiveFrameStyle(frameId: string): HiveFrameStyle {
  if (frameId.includes('razor')) return 'razor'
  if (frameId.includes('pathfinder')) return 'pathfinder'
  if (frameId.includes('bastion')) return 'bastion'
  if (frameId.includes('capital')) return 'capital'
  if (frameId.includes('battle') || frameId.includes('heavy')) return 'heavy'
  if (frameId.includes('cruiser')) return 'cruiser'
  if (frameId.includes('line') || frameId.includes('frigate')) return 'line'
  return 'scout'
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
