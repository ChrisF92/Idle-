import { afterEach, describe, expect, it } from 'vitest'
import { ACT1_CADENCE } from './cadence'
import { SHIP_MODULES } from './catalog'
import { matureSocketLayout, masteryMilestonesFor } from './coreMastery'
import {
  BEHAVIOURAL_RELIC_IDS,
  CHALLENGE_RELIC_SOURCES,
  RELIC_FAMILIES,
  RELIC_FAMILY_IDS,
  RELIC_SOCKET_CLASSES,
  STANDARD_RELIC_IDS,
  getRelicFamily,
} from './relicCatalogue'
import {
  activeCoreSockets,
  addRelicInstance,
  coreSocketLayout,
  coreSocketViews,
  isRelicsUnlocked,
  relicFitsSocket,
} from './relics'
import { canUpgradeRelicToTier2, canUpgradeRelicToTier3, setRelicTemperCapabilityProvider } from './relicSources'
import { createInitialState } from './state'
import { atCareerWave, equipPostTutorialLoadout } from './testHelpers'
import { hiveResearchUnlocksReliquary, HIVE_RESEARCH_NODES } from './hiveResearch'

const LEGACY_SHARD_IDS = [
  'battle-chip',
  'salvage-chip',
  'plate-chip',
  'focus-lens',
  'burst-mesh',
  'compute-chip',
  'spark-chip',
  'ward-chip',
  'flux-chip',
  'choir-chip',
  'loom-chip',
  'hold-chip',
  'overdraw-chip',
  'assay-chip',
  'yield-chip',
  'archive-chip',
  'warp-chip',
  'reactor-chip',
  'catalyst',
]

const MATURE: Record<string, Array<{ type: string; alt?: string }>> = {
  'pulse-cannon': [{ type: 'power' }, { type: 'optical' }, { type: 'universal' }],
  'heavy-lance': [{ type: 'ballistic' }, { type: 'power' }, { type: 'universal' }],
  'flak-array': [{ type: 'ballistic' }, { type: 'power' }, { type: 'universal' }],
  'phase-beam': [{ type: 'optical' }, { type: 'power' }, { type: 'universal' }],
  'slag-spitter': [{ type: 'ballistic' }, { type: 'power' }, { type: 'universal' }],
  'plate-layer': [{ type: 'shield' }, { type: 'shield', alt: 'universal' }],
  'rapid-aegis': [{ type: 'shield' }, { type: 'universal' }],
  'ablative-mesh': [{ type: 'shield' }, { type: 'industrial', alt: 'universal' }],
  'barrier-projector': [{ type: 'shield' }, { type: 'optical', alt: 'universal' }],
  'salvage-beacon': [{ type: 'industrial' }, { type: 'optical', alt: 'universal' }],
  'grav-tether': [{ type: 'optical' }, { type: 'industrial', alt: 'universal' }],
  'nano-lathe': [{ type: 'industrial' }, { type: 'shield', alt: 'universal' }],
  'sensor-array': [{ type: 'optical' }, { type: 'industrial', alt: 'universal' }],
  'choir-tap': [{ type: 'industrial' }, { type: 'power', alt: 'universal' }],
}

afterEach(() => setRelicTemperCapabilityProvider(null))

describe('PR6 Relic catalogue', () => {
  it('contains exactly 20 families: 14 Behavioural and 6 Standard', () => {
    expect(RELIC_FAMILIES).toHaveLength(20)
    expect(RELIC_FAMILY_IDS).toHaveLength(20)
    expect(BEHAVIOURAL_RELIC_IDS).toHaveLength(14)
    expect(STANDARD_RELIC_IDS).toHaveLength(6)
    expect(RELIC_FAMILIES.map((row) => row.name)).toEqual([
      'Overcharge Capacitor',
      'Prismatic Lens',
      'Focusing Array',
      'Phase Needle',
      'Fixed Mount',
      'Shatter Mesh',
      'Penetrator Guide',
      'Aegis Relay',
      'Salvage Matrix',
      'Gravity Lens',
      'Nanite Reservoir',
      'Shield Crossfeed',
      'Predictive Bus',
      'Resonance Tap',
      'Power Coupler',
      'Tracking Gimbal',
      'Ballistic Jacket',
      'Reinforcement Plate',
      'Industrial Optimiser',
      'Universal Resonator',
    ])
    expect(new Set(RELIC_FAMILY_IDS).size).toBe(20)
  })

  it('does not keep old shard / catalyst production IDs', () => {
    for (const id of LEGACY_SHARD_IDS) {
      expect(getRelicFamily(id), id).toBeUndefined()
      expect(RELIC_FAMILY_IDS).not.toContain(id)
    }
  })

  it('uses exactly six socket classes and explicit Standard/Behavioural data', () => {
    expect([...RELIC_SOCKET_CLASSES]).toEqual([
      'power',
      'optical',
      'ballistic',
      'shield',
      'industrial',
      'universal',
    ])
    for (const row of RELIC_FAMILIES) {
      expect(RELIC_SOCKET_CLASSES).toContain(row.socket)
      expect(row.kind === 'standard' || row.kind === 'behavioural').toBe(true)
      expect(row.effectStatus).toBe('pending')
    }
    expect(getRelicFamily('power-coupler')?.kind).toBe('standard')
    expect(getRelicFamily('overcharge-capacitor')?.kind).toBe('behavioural')
    expect(getRelicFamily('universal-resonator')?.socket).toBe('universal')
  })

  it('keeps Challenge-owned sources dormant and distinct from staging', () => {
    expect(CHALLENGE_RELIC_SOURCES).toEqual(
      expect.arrayContaining([
        { familyId: 'tracking-gimbal', challengeId: 'knife-fight' },
        { familyId: 'gravity-lens', challengeId: 'bare-hive' },
        { familyId: 'nanite-reservoir', challengeId: 'attrition' },
        { familyId: 'shatter-mesh', challengeId: 'pressure-front' },
        { familyId: 'predictive-bus', challengeId: 'silent-bridge' },
        { familyId: 'focusing-array', challengeId: 'dead-reckoning' },
      ]),
    )
    expect(getRelicFamily('tracking-gimbal')?.source.kind).toBe('challenge')
    expect(getRelicFamily('focusing-array')?.source.kind).toBe('challenge')
    expect(getRelicFamily('shatter-mesh')?.source.kind).toBe('challenge')
  })
})

describe('PR6 mature Core socket layouts', () => {
  it('matches canonical mature metadata for all 14 Cores', () => {
    expect(SHIP_MODULES).toHaveLength(14)
    for (const mod of SHIP_MODULES) {
      const expected = MATURE[mod.id]
      expect(expected, mod.id).toBeTruthy()
      expect(matureSocketLayout(mod.id)).toEqual(expected)
    }
  })

  it('activates socket 0 at Relic unlock and M20 expand at Mastery 20, leaving later sockets pending', () => {
    const locked = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary - 1)
    expect(isRelicsUnlocked(locked)).toBe(false)
    expect(coreSocketLayout(locked, 'pulse-cannon:1')).toEqual([])

    let open = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    open = equipPostTutorialLoadout(open)
    expect(isRelicsUnlocked(open)).toBe(true)
    expect(activeCoreSockets(open, 'pulse-cannon:1').map((s) => s.type)).toEqual(['power'])
    expect(coreSocketViews(open, 'pulse-cannon:1')[2]?.unlock).toBe('pending')

    open.meta.moduleMastery = { ...open.meta.moduleMastery, 'pulse-cannon': 20 }
    expect(activeCoreSockets(open, 'pulse-cannon:1').map((s) => s.type)).toEqual(['power', 'optical'])
    expect(coreSocketViews(open, 'pulse-cannon:1')[2]?.active).toBe(false)
    expect(coreSocketViews(open, 'pulse-cannon:1')[2]?.unlock).toBe('pending')

    open.meta.moduleMastery = { ...open.meta.moduleMastery, 'pulse-cannon': 100 }
    expect(activeCoreSockets(open, 'pulse-cannon:1')).toHaveLength(2)
    expect(masteryMilestonesFor('pulse-cannon').find((ms) => ms.level === 20)?.socket).toBe('optical')
  })

  it('does not treat Universal Relic as a Universal socket', () => {
    expect(relicFitsSocket('universal', { type: 'power' })).toBe(false)
    expect(relicFitsSocket('power', { type: 'universal' })).toBe(true)
    expect(relicFitsSocket('optical', { type: 'universal' })).toBe(true)
  })
})

describe('PR6 PR9 capability boundary', () => {
  it('keeps Tier II/III dormant and ignores leftover Research colour unlocks', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    addRelicInstance(s, 'power-coupler', 1)
    expect(canUpgradeRelicToTier2(s)).toBe(false)
    expect(canUpgradeRelicToTier3(s)).toBe(false)

    s.hiveResearch.completedIds = Object.values(HIVE_RESEARCH_NODES).flatMap((nodes) =>
      nodes.map((n) => n.id),
    )
    expect(hiveResearchUnlocksReliquary(s, 'blue')).toBe(true)
    expect(canUpgradeRelicToTier2(s)).toBe(false)
    expect(canUpgradeRelicToTier3(s)).toBe(false)

    setRelicTemperCapabilityProvider({
      canUpgradeRelicToTier2: () => true,
      canUpgradeRelicToTier3: () => false,
    })
    expect(canUpgradeRelicToTier2(s)).toBe(true)
    expect(canUpgradeRelicToTier3(s)).toBe(false)
  })
})
