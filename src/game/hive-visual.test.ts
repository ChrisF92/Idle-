import { describe, expect, it } from 'vitest'
import {
  CORE_SCREEN_ORBIT_PAD,
  HIVE_VISUAL_RADIUS,
  coreOrbitRadius,
  coreScreenOrbit,
  hiveDrawRadius,
  hiveFramePalette,
  hiveFrameStyle,
  paintHiveStation,
} from './hiveVisual'
import { SHIP_MODULES } from './catalog'

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

  it('uses authored Core orbit radii and parks screen Cores outside the hull', () => {
    expect(coreOrbitRadius('pulse-cannon')).toBe(44)
    expect(coreOrbitRadius('heavy-lance')).toBe(56)
    const hull = hiveDrawRadius(HIVE_VISUAL_RADIUS)
    for (const mod of SHIP_MODULES) {
      expect(coreOrbitRadius(mod.id)).toBeGreaterThanOrEqual(38)
      expect(coreOrbitRadius(mod.id)).toBeLessThanOrEqual(58)
      expect(coreScreenOrbit(mod.id)).toBe(coreOrbitRadius(mod.id) + CORE_SCREEN_ORBIT_PAD)
      expect(coreScreenOrbit(mod.id)).toBeGreaterThan(hull)
    }
  })

  it('exposes a face-on station painter for Dock and Sortie', () => {
    expect(typeof paintHiveStation).toBe('function')
  })
})
