/**
 * Act 1 Relic catalogue — PR6.
 *
 * Canonical locks family identity, Standard vs Behavioural, and socket classes
 * as explicit data. Exact combat effects and deterministic acquisition sources
 * are pending unless separately authored.
 */

import type { RelicSocketClass } from './types'

export const RELIC_SOCKET_CLASSES = [
  'power',
  'optical',
  'ballistic',
  'shield',
  'industrial',
  'universal',
] as const satisfies readonly RelicSocketClass[]

export const RELIC_SOCKET_LABELS: Record<RelicSocketClass, string> = {
  power: 'Power',
  optical: 'Optical',
  ballistic: 'Ballistic',
  shield: 'Shield',
  industrial: 'Industrial',
  universal: 'Universal',
}

export type RelicKind = 'standard' | 'behavioural'
export type RelicTier = 1 | 2 | 3
export type RelicAcquisitionStage = 'early' | 'mid' | 'advanced' | 'late' | 'challenge'
export type RelicSourceKind =
  | 'pending'
  | 'challenge'
  | 'boss-route'
  | 'research'
  | 'furnace'

export type RelicFamilyId =
  | 'overcharge-capacitor'
  | 'prismatic-lens'
  | 'focusing-array'
  | 'phase-needle'
  | 'fixed-mount'
  | 'shatter-mesh'
  | 'penetrator-guide'
  | 'aegis-relay'
  | 'salvage-matrix'
  | 'gravity-lens'
  | 'nanite-reservoir'
  | 'shield-crossfeed'
  | 'predictive-bus'
  | 'resonance-tap'
  | 'power-coupler'
  | 'tracking-gimbal'
  | 'ballistic-jacket'
  | 'reinforcement-plate'
  | 'industrial-optimiser'
  | 'universal-resonator'

export interface RelicSourceMeta {
  kind: RelicSourceKind
  stage: RelicAcquisitionStage
  /** PR10 Challenge id. Dormant until PR10 fires the source provider. */
  challengeId?: string
  /** Progression seed / Boss-route label. Not a grant. PR7 owns drop tables. */
  routeLabel?: string
  /** Timeline seed Wave. Not a Best-Wave grant. */
  timelineSeedWave?: number
  pendingReason: string
}

export interface RelicFamilyDef {
  id: RelicFamilyId
  name: string
  kind: RelicKind
  socket: RelicSocketClass
  source: RelicSourceMeta
  /**
   * Combat/economy effect. Canonical does not author magnitudes.
   * `pending` means UI must not invent a numeric claim.
   */
  effectStatus: 'pending' | 'authored'
  effectBlurb: string
}

const pending = (
  stage: RelicAcquisitionStage,
  reason: string,
  extra: Partial<RelicSourceMeta> = {},
): RelicSourceMeta => ({
  kind: extra.kind ?? 'pending',
  stage,
  pendingReason: reason,
  ...extra,
})

const challenge = (stage: RelicAcquisitionStage, challengeId: string, name: string): RelicSourceMeta =>
  pending(stage, `${name} Challenge reward is owned by PR10. Dormant in PR6.`, {
    kind: 'challenge',
    challengeId,
  })

const bossRoute = (
  stage: RelicAcquisitionStage,
  wave: number,
  label: string,
): RelicSourceMeta =>
  pending(stage, `Boss-route metadata only. PR7 owns Commander/Boss Relic drop tables.`, {
    kind: 'boss-route',
    timelineSeedWave: wave,
    routeLabel: label,
  })

export const RELIC_FAMILIES: RelicFamilyDef[] = [
  {
    id: 'overcharge-capacitor',
    name: 'Overcharge Capacitor',
    kind: 'behavioural',
    socket: 'power',
    source: pending('early', 'Early Relic staging is represented; exact deterministic source is unauthored.'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  },
  {
    id: 'prismatic-lens',
    name: 'Prismatic Lens',
    kind: 'behavioural',
    socket: 'optical',
    source: bossRoute('mid', 550, 'Pack Tyrant II / Prismatic route'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  },
  {
    id: 'focusing-array',
    name: 'Focusing Array',
    kind: 'behavioural',
    socket: 'optical',
    source: challenge('challenge', 'dead-reckoning', 'Dead Reckoning'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  },
  {
    id: 'phase-needle',
    name: 'Phase Needle',
    kind: 'behavioural',
    socket: 'optical',
    source: bossRoute('advanced', 600, 'Canticle Engine'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  },
  {
    id: 'fixed-mount',
    name: 'Fixed Mount',
    kind: 'behavioural',
    socket: 'ballistic',
    source: bossRoute('advanced', 800, 'Null Battery'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  },
  {
    id: 'shatter-mesh',
    name: 'Shatter Mesh',
    kind: 'behavioural',
    socket: 'ballistic',
    source: challenge('challenge', 'pressure-front', 'Pressure Front'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  },
  {
    id: 'penetrator-guide',
    name: 'Penetrator Guide',
    kind: 'behavioural',
    socket: 'ballistic',
    source: bossRoute('advanced', 650, 'Iron Behemoth II'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  },
  {
    id: 'aegis-relay',
    name: 'Aegis Relay',
    kind: 'behavioural',
    socket: 'shield',
    source: bossRoute('early', 400, 'Bastion Engine'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  },
  {
    id: 'salvage-matrix',
    name: 'Salvage Matrix',
    kind: 'behavioural',
    socket: 'industrial',
    source: bossRoute('mid', 700, 'Reclaimer Leviathan'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  },
  {
    id: 'gravity-lens',
    name: 'Gravity Lens',
    kind: 'behavioural',
    socket: 'optical',
    source: challenge('challenge', 'bare-hive', 'Bare Hive'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  },
  {
    id: 'nanite-reservoir',
    name: 'Nanite Reservoir',
    kind: 'behavioural',
    socket: 'industrial',
    source: challenge('challenge', 'attrition', 'Attrition'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  },
  {
    id: 'shield-crossfeed',
    name: 'Shield Crossfeed',
    kind: 'behavioural',
    socket: 'shield',
    source: pending('late', 'Late Relic staging is represented; exact deterministic source is unauthored.'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  },
  {
    id: 'predictive-bus',
    name: 'Predictive Bus',
    kind: 'behavioural',
    socket: 'optical',
    source: challenge('challenge', 'silent-bridge', 'Silent Bridge'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  },
  {
    id: 'resonance-tap',
    name: 'Resonance Tap',
    kind: 'behavioural',
    socket: 'industrial',
    source: pending('late', 'Furnace-facing source is PR8. Exact acquisition is unauthored.', {
      kind: 'furnace',
    }),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Furnace-facing effect provider is reserved; not wired to legacy Furnace.',
  },
  {
    id: 'power-coupler',
    name: 'Power Coupler',
    kind: 'standard',
    socket: 'power',
    source: pending('early', 'Early Relic staging is represented; exact deterministic source is unauthored.'),
    effectStatus: 'pending',
    effectBlurb: 'Standard Relic. Magnitude is not authored.',
  },
  {
    id: 'tracking-gimbal',
    name: 'Tracking Gimbal',
    kind: 'standard',
    socket: 'optical',
    source: challenge('challenge', 'knife-fight', 'Knife Fight'),
    effectStatus: 'pending',
    effectBlurb: 'Standard Relic. Magnitude is not authored.',
  },
  {
    id: 'ballistic-jacket',
    name: 'Ballistic Jacket',
    kind: 'standard',
    socket: 'ballistic',
    source: pending('mid', 'Mid Relic staging is represented; exact deterministic source is unauthored.'),
    effectStatus: 'pending',
    effectBlurb: 'Standard Relic. Magnitude is not authored.',
  },
  {
    id: 'reinforcement-plate',
    name: 'Reinforcement Plate',
    kind: 'standard',
    socket: 'shield',
    source: pending('early', 'Early Relic staging is represented; exact deterministic source is unauthored.'),
    effectStatus: 'pending',
    effectBlurb: 'Standard Relic. Magnitude is not authored.',
  },
  {
    id: 'industrial-optimiser',
    name: 'Industrial Optimiser',
    kind: 'standard',
    socket: 'industrial',
    source: pending(
      'advanced',
      'Advanced Relic staging is represented; exact scope (combat industry vs Foundry) is unauthored. Does not multiply offline Foundry.',
    ),
    effectStatus: 'pending',
    effectBlurb: 'Standard Relic. Magnitude and industrial scope are not authored. Does not affect offline Foundry.',
  },
  {
    id: 'universal-resonator',
    name: 'Universal Resonator',
    kind: 'standard',
    socket: 'universal',
    source: bossRoute('late', 850, 'Siege Node II'),
    effectStatus: 'pending',
    effectBlurb: 'Standard Relic. Fits Universal sockets only. Not itself a Universal socket.',
  },
]

export const RELIC_FAMILY_IDS = RELIC_FAMILIES.map((row) => row.id) as RelicFamilyId[]

export const BEHAVIOURAL_RELIC_IDS = RELIC_FAMILIES.filter((row) => row.kind === 'behavioural').map(
  (row) => row.id,
) as RelicFamilyId[]

export const STANDARD_RELIC_IDS = RELIC_FAMILIES.filter((row) => row.kind === 'standard').map(
  (row) => row.id,
) as RelicFamilyId[]

export const CHALLENGE_RELIC_SOURCES: ReadonlyArray<{ familyId: RelicFamilyId; challengeId: string }> =
  RELIC_FAMILIES.filter((row) => row.source.kind === 'challenge' && row.source.challengeId).map((row) => ({
    familyId: row.id,
    challengeId: row.source.challengeId!,
  }))

const FAMILY_BY_ID = new Map(RELIC_FAMILIES.map((row) => [row.id, row]))

export function isRelicFamilyId(id: string): id is RelicFamilyId {
  return FAMILY_BY_ID.has(id as RelicFamilyId)
}

export function getRelicFamily(id: string): RelicFamilyDef | undefined {
  return FAMILY_BY_ID.get(id as RelicFamilyId)
}

export function relicFamilyName(id: string): string {
  return getRelicFamily(id)?.name ?? 'Unknown Relic'
}

export function relicTierLabel(tier: RelicTier): string {
  return tier === 1 ? 'I' : tier === 2 ? 'II' : 'III'
}

export function isValidRelicTier(value: unknown): value is RelicTier {
  return value === 1 || value === 2 || value === 3
}
