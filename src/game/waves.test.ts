/**
 * Procedural wave pack determinism tests.
 */
import { describe, expect, it } from 'vitest'
import { encounterForWave } from './waves'
import { arenaDistance } from './arena'

describe('encounterForWave', () => {
  it('is deterministic for the same sector and wave', () => {
    const a = encounterForWave('sector-1', 12)
    const b = encounterForWave('sector-1', 12)
    expect(a.units.length).toBe(b.units.length)
    expect(a.units.map((u) => u.name)).toEqual(b.units.map((u) => u.name))
    expect(a.units.map((u) => [u.x, u.y])).toEqual(b.units.map((u) => [u.x, u.y]))
  })

  it('spawns enemies near the perimeter', () => {
    const enc = encounterForWave('sector-1', 5)
    for (const u of enc.units) {
      const r = arenaDistance(u, { x: 0, y: 0 })
      expect(r).toBeGreaterThan(150)
    }
  })

  it('uses swarm-only packs in waves 1–19', () => {
    for (const wave of [1, 10, 19]) {
      const enc = encounterForWave('sector-1', wave)
      expect(enc.units.every((u) => u.family === 'swarm')).toBe(true)
    }
  })

  it('spawns a titan boss at wave 100', () => {
    const enc = encounterForWave('sector-1', 100)
    expect(enc.isBoss).toBe(true)
    expect(enc.units.some((u) => u.family === 'titan' && u.isBoss)).toBe(true)
  })
})
