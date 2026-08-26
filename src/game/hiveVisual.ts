/** Frame / Core presentation helpers for battlefield and Dock hive preview. */

import { getModule } from './catalog'
import { coreRoleColor } from './combatVisual'
import type { GameState } from './types'
import { coreInstanceAtSlot } from './coreInstances'

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

function pathRegularPoly(
  ctx: CanvasRenderingContext2D,
  sides: number,
  r: number,
  rot = 0,
): void {
  ctx.beginPath()
  for (let i = 0; i < sides; i += 1) {
    const a = (Math.PI * 2 * i) / sides + rot
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/** Face-on station hull. Never apply the old side-scroll ship rotate to this. */
export function paintHiveStation(
  ctx: CanvasRenderingContext2D,
  style: HiveFrameStyle,
  r: number,
  time: number,
  reducedMotion: boolean,
  alpha = 1,
): void {
  const pal = hiveFramePalette(style)
  const spin = reducedMotion ? 0 : time * 0.18
  const heartPulse = reducedMotion ? 0.72 : 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(time * 2.4))
  ctx.save()
  ctx.globalAlpha = alpha

  const glow = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.55)
  glow.addColorStop(0, `${pal.heart}55`)
  glow.addColorStop(0.45, `${pal.hull}22`)
  glow.addColorStop(1, 'rgba(18,14,12,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.rotate(spin)
  ctx.strokeStyle = pal.trim
  ctx.globalAlpha = alpha * 0.55
  ctx.lineWidth = style === 'bastion' ? 2.4 : style === 'swarm' ? 1.15 : 1.6
  ctx.beginPath()
  ctx.arc(0, 0, r * (style === 'bastion' ? 1.16 : style === 'reactor' ? 1.2 : 1.1), 0, Math.PI * 2)
  ctx.stroke()
  const lights = style === 'swarm' ? 8 : 6
  for (let i = 0; i < lights; i += 1) {
    const a = (Math.PI * 2 * i) / lights
    const on = reducedMotion ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 3 + i))
    ctx.globalAlpha = alpha * on
    ctx.fillStyle = i % 2 === 0 ? pal.heart : pal.stroke
    ctx.beginPath()
    ctx.arc(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1, style === 'swarm' ? 1.15 : 1.45, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  ctx.globalAlpha = alpha
  ctx.fillStyle = pal.hullDeep
  ctx.strokeStyle = pal.stroke
  ctx.lineWidth = 1.7
  if (style === 'bastion') {
    pathRegularPoly(ctx, 6, r, -Math.PI / 6)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = pal.hull
    pathRegularPoly(ctx, 6, r * 0.72, -Math.PI / 6)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = pal.trim
    ctx.globalAlpha = alpha * 0.7
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI * 2 * i) / 6 - Math.PI / 6
      ctx.save()
      ctx.rotate(a)
      ctx.fillRect(r * 0.78, -r * 0.12, r * 0.28, r * 0.24)
      ctx.restore()
    }
  } else if (style === 'swarm') {
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = pal.hull
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI * 2 * i) / 6 + spin * 0.35
      ctx.beginPath()
      ctx.arc(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, r * 0.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  } else if (style === 'reactor') {
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = pal.trim
    ctx.globalAlpha = alpha * 0.55
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5)
      ctx.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82)
      ctx.stroke()
    }
    ctx.globalAlpha = alpha
    ctx.strokeStyle = pal.stroke
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2)
    ctx.stroke()
  } else if (style === 'harvester') {
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = pal.hull
    ctx.strokeStyle = pal.trim
    for (let i = 0; i < 3; i += 1) {
      const a = (Math.PI * 2 * i) / 3 + spin * 0.2
      ctx.save()
      ctx.rotate(a)
      ctx.beginPath()
      ctx.moveTo(r * 0.45, -r * 0.18)
      ctx.lineTo(r * 1.05, -r * 0.42)
      ctx.lineTo(r * 1.12, 0)
      ctx.lineTo(r * 1.05, r * 0.42)
      ctx.lineTo(r * 0.45, r * 0.18)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
  } else {
    pathRegularPoly(ctx, 6, r * 0.92, -Math.PI / 6)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = pal.hull
    pathRegularPoly(ctx, 6, r * 0.62, Math.PI / 6)
    ctx.fill()
    ctx.stroke()
    ctx.globalAlpha = alpha * 0.55
    ctx.strokeStyle = pal.trim
    ctx.beginPath()
    ctx.moveTo(-r * 0.22, -r * 0.55)
    ctx.lineTo(r * 0.22, -r * 0.55)
    ctx.moveTo(-r * 0.22, r * 0.55)
    ctx.lineTo(r * 0.22, r * 0.55)
    ctx.stroke()
  }

  ctx.globalAlpha = alpha * heartPulse
  const heart = ctx.createRadialGradient(0, 0, 0, 0, 0, r * (style === 'reactor' ? 0.42 : 0.32))
  heart.addColorStop(0, pal.heart)
  heart.addColorStop(1, 'rgba(18,14,12,0)')
  ctx.fillStyle = heart
  ctx.beginPath()
  ctx.arc(0, 0, r * (style === 'reactor' ? 0.42 : 0.3), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function equippedCoreVisuals(state: GameState) {
  return state.shipyard.modules.map((id, index) => {
    const def = getModule(id)
    const role = def?.role ?? 'utility'
    const kind = coreVisualKind(id)
    return {
      id,
      coreInstanceId: coreInstanceAtSlot(state, index)?.id,
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
