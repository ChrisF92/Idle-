import { describe, expect, it } from 'vitest'
import {
  CORE_SCREEN_ORBIT_PAD,
  HIVE_VISUAL_RADIUS,
  coreOrbitRadius,
  coreScreenOrbit,
  coreVisualKind,
  hiveDrawRadius,
  hiveFramePalette,
  hiveFrameStyle,
  paintHiveStation,
} from './hiveVisual'

const KINDS = ['flak', 'shield', 'pulse', 'utility', 'beam', 'heavy'] as const

describe('Hive Sortie presentation', () => {
  it('maps each Frame to a distinct architecture style and palette', () => {
    expect(hiveFrameStyle('starter-frame')).toBe('starter')
    expect(hiveFrameStyle('bastion-frame')).toBe('bastion')
    expect(hiveFrameStyle('swarm-frame')).toBe('swarm')
    expect(hiveFrameStyle('reactor-frame')).toBe('reactor')
    expect(hiveFrameStyle('harvester-frame')).toBe('harvester')
    const styles = ['starter', 'bastion', 'swarm', 'reactor', 'harvester'] as const
    const strokes = new Set(styles.map((style) => hiveFramePalette(style).stroke))
    expect(strokes.size).toBe(styles.length)
  })

  it('keeps sim orbits unchanged and parks screen Cores outside the hull', () => {
    expect(coreOrbitRadius('pulse')).toBe(30)
    expect(coreOrbitRadius(coreVisualKind('pulse-cannon'))).toBe(30)
    const hull = hiveDrawRadius(HIVE_VISUAL_RADIUS)
    for (const kind of KINDS) {
      expect(coreScreenOrbit(kind)).toBe(coreOrbitRadius(kind) + CORE_SCREEN_ORBIT_PAD)
      expect(coreScreenOrbit(kind)).toBeGreaterThan(hull)
    }
  })

  it('exposes a face-on station painter for Dock and Sortie', () => {
    expect(typeof paintHiveStation).toBe('function')
  })
})
