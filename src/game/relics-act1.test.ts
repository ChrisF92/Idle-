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
  isRelicFamilyFabricatable,
} from './relicCatalogue'
import {
  activeCoreSockets,
  addRelicInstance,
  canFitRelic,
  coreSocketLayout,
  coreSocketViews,
  isRelicsUnlocked,
  m20SocketExpandType,
  relicFitsSocket,
  setRelicSocketActivationProvider,
  socketAcceptsRelic,
} from './relics'
import { canUpgradeRelicToTier2, canUpgradeRelicToTier3, setRelicTemperCapabilityProvider } from './relicSources'
import {
  FIXTURE_BALLISTIC_STANDARD,
  FIXTURE_POWER_STANDARD,
  FIXTURE_SHIELD_STANDARD,
  FIXTURE_UNIVERSAL_STANDARD,
  installAuthoredRelicFixtures,
  resetRelicTestFixtures,
} from './relicTestFixtures'
import { createInitialState } from './state'
import { atCareerWave, equipPostTutorialLoadout } from './testHelpers'
import { hiveResearchUnlocksReliquary, HIVE_RESEARCH_NODES } from './hiveResearch'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

afterEach(() => {
  setRelicTemperCapabilityProvider(null)
  setRelicSocketActivationProvider(null)
  resetRelicTestFixtures()
})

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

  it('uses exactly six socket classes without assigning unauthored family mappings', () => {
    expect([...RELIC_SOCKET_CLASSES]).toEqual([
      'power',
      'optical',
      'ballistic',
      'shield',
      'industrial',
      'universal',
    ])
    for (const row of RELIC_FAMILIES) {
      expect(row.kind === 'standard' || row.kind === 'behavioural').toBe(true)
      expect(row.effectStatus).toBe('pending')
      expect(row.socket).toBeNull()
      expect(row.socketStatus).toBe('pending')
      expect(row.fabricationStatus).toBe('pending-design')
      expect(isRelicFamilyFabricatable(row)).toBe(false)
    }
    expect(getRelicFamily('power-coupler')?.kind).toBe('standard')
    expect(getRelicFamily('overcharge-capacitor')?.kind).toBe('behavioural')
    expect(getRelicFamily('universal-resonator')?.socket).toBeNull()
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

describe('PR6 generic socket compatibility engine', () => {
  it('accepts matching typed sockets, Universal sockets accept all, Universal-class Relics do not auto-fit typed sockets', () => {
    expect(relicFitsSocket('power', { type: 'power' })).toBe(true)
    expect(relicFitsSocket('shield', { type: 'shield' })).toBe(true)
    expect(relicFitsSocket('power', { type: 'universal' })).toBe(true)
    expect(relicFitsSocket('optical', { type: 'universal' })).toBe(true)
    expect(relicFitsSocket('ballistic', { type: 'universal' })).toBe(true)
    expect(relicFitsSocket('universal', { type: 'power' })).toBe(false)
    expect(relicFitsSocket('universal', { type: 'shield' })).toBe(false)
    expect(relicFitsSocket('universal', { type: 'universal' })).toBe(true)
    expect(relicFitsSocket(null, { type: 'power' })).toBe(false)
  })

  it('does not treat production families as having invented socket classes', () => {
    expect(socketAcceptsRelic({ type: 'power' }, 'power-coupler')).toBe(false)
    expect(socketAcceptsRelic({ type: 'universal' }, 'universal-resonator')).toBe(false)
  })

  it('uses fixture descriptors for authored compatibility without contaminating the catalogue', () => {
    installAuthoredRelicFixtures()
    expect(RELIC_FAMILY_IDS).not.toContain(FIXTURE_POWER_STANDARD.id)
    expect(socketAcceptsRelic({ type: 'power' }, FIXTURE_POWER_STANDARD.id)).toBe(true)
    expect(socketAcceptsRelic({ type: 'shield' }, FIXTURE_SHIELD_STANDARD.id)).toBe(true)
    expect(socketAcceptsRelic({ type: 'universal' }, FIXTURE_BALLISTIC_STANDARD.id)).toBe(true)
    expect(socketAcceptsRelic({ type: 'power' }, FIXTURE_UNIVERSAL_STANDARD.id)).toBe(false)
    expect(getRelicFamily(FIXTURE_POWER_STANDARD.id)).toBeUndefined()
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

  it('does not activate sockets from Relic unlock, M20, or later mastery', () => {
    const locked = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary - 1)
    expect(isRelicsUnlocked(locked)).toBe(false)
    expect(coreSocketLayout(locked, 'pulse-cannon:1')).toEqual([])

    let open = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    open = equipPostTutorialLoadout(open)
    expect(isRelicsUnlocked(open)).toBe(true)
    expect(activeCoreSockets(open, 'pulse-cannon:1')).toEqual([])
    expect(coreSocketViews(open, 'pulse-cannon:1').every((row) => row.activationStatus === 'pending')).toBe(true)
    expect(coreSocketViews(open, 'pulse-cannon:1')[0]?.unlockLabel).toBe('Activation milestone pending design')
    expect(coreSocketViews(open, 'pulse-cannon:1')[2]?.unlock).toBe('pending')

    open.meta.moduleMastery = { ...open.meta.moduleMastery, 'pulse-cannon': 20 }
    expect(activeCoreSockets(open, 'pulse-cannon:1')).toEqual([])
    expect(m20SocketExpandType('pulse-cannon')).toBe('optical')
    expect(masteryMilestonesFor('pulse-cannon').find((ms) => ms.level === 20)?.effect).toBe('socket-expand')

    open.meta.moduleMastery = { ...open.meta.moduleMastery, 'pulse-cannon': 50 }
    expect(activeCoreSockets(open, 'pulse-cannon:1')).toEqual([])
    open.meta.moduleMastery = { ...open.meta.moduleMastery, 'pulse-cannon': 75 }
    expect(activeCoreSockets(open, 'pulse-cannon:1')).toEqual([])
    open.meta.moduleMastery = { ...open.meta.moduleMastery, 'pulse-cannon': 100 }
    expect(activeCoreSockets(open, 'pulse-cannon:1')).toEqual([])
    expect(coreSocketViews(open, 'pulse-cannon:1')[2]?.active).toBe(false)
  })

  it('does not auto-evolve slash /Universal sockets from earlier activation', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    s = equipPostTutorialLoadout(s)
    setRelicSocketActivationProvider(() => [0])
    const plate = coreSocketViews(s, 'plate-layer:1')
    expect(plate[0]?.active).toBe(true)
    expect(plate[1]?.active).toBe(false)
    expect(plate[1]?.spec).toEqual({ type: 'shield', alt: 'universal' })
    s.meta.moduleMastery = { ...s.meta.moduleMastery, 'plate-layer': 100 }
    expect(coreSocketViews(s, 'plate-layer:1')[1]?.active).toBe(false)
  })

  it('lets injected authored activation drive the generic fitting engine', () => {
    installAuthoredRelicFixtures()
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    s = equipPostTutorialLoadout(s)
    s.combat.docked = true
    setRelicSocketActivationProvider(() => [0, 1])
    const power = addRelicInstance(s, FIXTURE_POWER_STANDARD.id)!
    expect(canFitRelic(s, 'pulse-cannon:1', power.id, 0).ok).toBe(true)
    expect(coreSocketViews(s, 'pulse-cannon:1')[0]?.activationStatus).toBe('authored-active')
    expect(coreSocketViews(s, 'pulse-cannon:1')[1]?.spec.type).toBe('optical')
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

describe('PR6 / PR9 Process boundary', () => {
  it('has no autoSeatShards execution hook', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/game/automation.ts'), 'utf8')
    expect(src).not.toMatch(/autoSeatShards/)
  })
})
