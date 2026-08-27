import { describe, expect, it } from 'vitest'
import {
  COMMANDER_TRAIT_IDS,
  ENEMY_FAMILY_IDS,
  HOSTILE_DEFS,
  HOSTILE_IDS,
  authoredMechanicIds,
  getHostileDef,
  isLegacyFillerName,
  pendingFamilyIds,
  pendingRoleIds,
} from './hostileCatalogue'
import { encounterForWave, firstContactCanAppear, firstContactForbiddenBefore } from './encounterGenerator'
import { FORMATION_IDS, formationRngFor } from './formations'
import { formationPositionsFor, formationDispersionWeight } from './encounterGenerator'
import { createSimRng, rngNext } from './simRng'
import { SUPPORT_CAP_PER_PACKAGE, DISRUPTOR_CAP_PER_PACKAGE, FORMATION_DISPERSION_WEIGHT_MAX } from './hostileSeeds'
import { createInitialState } from './state'
import { admitUnitToPackage, createWavePackage } from './waveRuntime'
import { startCombat } from './tick'

const EXPECTED = [
  ['void-mite', 'Void Mite', 1],
  ['needle-skitter', 'Needle Skitter', 30],
  ['brood-splitter', 'Brood Splitter', 85],
  ['carapace-walker', 'Carapace Walker', 115],
  ['cinder-diver', 'Cinder Diver', 140],
  ['phase-wisp', 'Phase Wisp', 175],
  ['bulwark', 'Bulwark', 190],
  ['iron-ram', 'Iron Ram', 260],
  ['veil-sniper', 'Veil Sniper', 290],
  ['mortar-cyst', 'Mortar Cyst', 325],
  ['bastion-husk', 'Bastion Husk', 365],
  ['mirror-shade', 'Mirror Shade', 395],
  ['ashen-chorister', 'Ashen Chorister', 440],
  ['suppressor-node', 'Suppressor Node', 470],
  ['prism-warder', 'Prism Warder', 515],
  ['cantor', 'Cantor', 565],
  ['resonance-vessel', 'Resonance Vessel', 665],
  ['reclaimer', 'Reclaimer', 690],
  ['breach-engine', 'Breach Engine', 740],
  ['choir-sentinel', 'Choir Sentinel', 815],
  ['null-shepherd', 'Null Shepherd', 865],
  ['crowned-husk', 'Crowned Husk', 935],
] as const

describe('PR7 hostile catalogue', () => {
  it('locks exactly six final family vocabulary values', () => {
    expect([...ENEMY_FAMILY_IDS]).toEqual(['swarm', 'armored', 'veil', 'siege', 'choir', 'apex'])
    expect(ENEMY_FAMILY_IDS).not.toContain('ethereal')
    expect(ENEMY_FAMILY_IDS).not.toContain('divine')
    expect(ENEMY_FAMILY_IDS).not.toContain('titan')
  })

  it('contains exactly the 22 named hostiles with stable IDs and first-contact Waves', () => {
    expect(HOSTILE_DEFS).toHaveLength(22)
    expect(HOSTILE_IDS).toHaveLength(22)
    expect(new Set(HOSTILE_IDS).size).toBe(22)
    EXPECTED.forEach(([id, name, wave], i) => {
      expect(HOSTILE_DEFS[i]?.id).toBe(id)
      expect(HOSTILE_DEFS[i]?.name).toBe(name)
      expect(HOSTILE_DEFS[i]?.firstContactWave).toBe(wave)
    })
  })

  it('does not retain legacy filler names or procedural Elite rarity', () => {
    for (const def of HOSTILE_DEFS) {
      expect(isLegacyFillerName(def.name)).toBe(false)
      expect(def.name.startsWith('Elite ')).toBe(false)
    }
    expect(HOSTILE_DEFS.some((d) => d.name === 'Ashen Drifter')).toBe(false)
  })

  it('marks family pending for every hostile (canonical has no mapping table)', () => {
    expect(pendingFamilyIds()).toEqual([...HOSTILE_IDS])
    for (const def of HOSTILE_DEFS) {
      expect(def.family).toBeNull()
      expect(def.familyStatus).toBe('pending')
    }
  })

  it('authors elite role only for Choir Sentinel and Crowned Husk', () => {
    expect(getHostileDef('choir-sentinel')?.role).toBe('elite')
    expect(getHostileDef('choir-sentinel')?.roleStatus).toBe('authored')
    expect(getHostileDef('crowned-husk')?.role).toBe('elite')
    expect(getHostileDef('crowned-husk')?.roleStatus).toBe('authored')
    expect(pendingRoleIds()).toEqual(
      HOSTILE_IDS.filter((id) => id !== 'choir-sentinel' && id !== 'crowned-husk'),
    )
  })

  it('authors only Resonance Vessel and Breach Engine unique mechanics', () => {
    expect(authoredMechanicIds()).toEqual(['resonance-vessel', 'breach-engine'])
    expect(getHostileDef('resonance-vessel')?.mechanicId).toBe('death-position-hazard')
    expect(getHostileDef('breach-engine')?.mechanicId).toBe('partial-shield-bypass-spike')
  })

  it('keeps trait IDs at the exact eight', () => {
    expect([...COMMANDER_TRAIT_IDS]).toEqual([
      'vanguard',
      'ironclad',
      'wardbearer',
      'rallying',
      'displacer',
      'suppressor',
      'volatile',
      'breacher',
    ])
  })
})

describe('PR7 first-contact integrity', () => {
  it('forbids each hostile before its Wave and allows it at/after', () => {
    for (const def of HOSTILE_DEFS) {
      expect(firstContactForbiddenBefore(def.id, def.firstContactWave - 1)).toBe(true)
      expect(firstContactCanAppear(def.firstContactWave)).toBe(true)
      const before = encounterForWave(Math.max(1, def.firstContactWave - 1))
      expect(before.units.some((u) => u.hostileId === def.id)).toBe(false)
      if (def.firstContactWave % 50 === 0) continue
      const at = encounterForWave(def.firstContactWave)
      expect(at.units.some((u) => u.hostileId === def.id)).toBe(true)
    }
  })

  it('records Codex discovery on actual spawn, not Best Wave', () => {
    const spawned = createInitialState(0)
    const pkg = createWavePackage(spawned, 1, 'normal', 1)
    spawned.combat.packages.push(pkg)
    const unit = {
      ...encounterForWave(1).units[0]!,
    }
    admitUnitToPackage(spawned, pkg, unit)
    expect(spawned.codex.discoveredHostileIds).toContain('void-mite')

    const bestOnly = createInitialState(0)
    bestOnly.meta.bestWave = 935
    bestOnly.combat.bestWave = 935
    expect(bestOnly.codex.discoveredHostileIds).toEqual([])
  })

  it('discovers Void Mite when W1 actually launches', () => {
    const state = startCombat(createInitialState(1))
    expect(state.codex.discoveredHostileIds).toContain('void-mite')
    expect(state.codex.discoveredHostileIds).not.toContain('needle-skitter')
  })
})

describe('PR7 formations', () => {
  it('keeps exactly seven formation IDs', () => {
    expect([...FORMATION_IDS]).toEqual([
      'spear',
      'pincer',
      'encirclement',
      'screen',
      'siege',
      'swarm-burst',
      'mixed-pressure',
    ])
  })

  it('is deterministic per seed/wave/package and isolated from combat RNG', () => {
    const a = formationPositionsFor(11, 40, 2, 4)
    const b = formationPositionsFor(11, 40, 2, 4)
    expect(a).toEqual(b)
    const c = formationPositionsFor(11, 40, 3, 4)
    expect(c.xs.join(',')).not.toEqual(a.xs.join(','))
    const combat = createSimRng(11)
    rngNext(combat)
    rngNext(combat)
    const d = formationPositionsFor(11, 40, 2, 4)
    expect(d).toEqual(a)
    const formRng = formationRngFor(11, 40, 2)
    expect(formRng.s).not.toBe(combat.s)
  })

  it('bounds angular-dispersion contribution and support/disruptor caps', () => {
    expect(FORMATION_DISPERSION_WEIGHT_MAX).toBeLessThanOrEqual(0.12)
    for (const id of FORMATION_IDS) {
      expect(formationDispersionWeight(id)).toBeLessThanOrEqual(FORMATION_DISPERSION_WEIGHT_MAX)
    }
    expect(SUPPORT_CAP_PER_PACKAGE).toBe(2)
    expect(DISRUPTOR_CAP_PER_PACKAGE).toBe(2)
  })
})
