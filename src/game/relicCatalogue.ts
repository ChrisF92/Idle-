/**
 * Act 1 Relic catalogue — PR6.
 *
 * Canonical locks family identity, Standard vs Behavioural, and the six
 * socket *classes*. It does not assign a socket class to each family.
 * Exact combat effects and deterministic acquisition sources are pending
 * unless separately authored.
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

export const RELIC_SOCKET_PENDING_LABEL = 'Socket class pending design'
export const RELIC_DESIGN_PENDING_LABEL = 'Design details pending'

export type RelicKind = 'standard' | 'behavioural'
export type RelicTier = 1 | 2 | 3
export type RelicAcquisitionStage = 'early' | 'mid' | 'advanced' | 'late' | 'challenge'
export type RelicSourceKind =
  | 'pending'
  | 'challenge'
  | 'boss-route'
  | 'research'
  | 'furnace'
export type RelicSocketStatus = 'authored' | 'pending'
export type RelicFabricationStatus = 'ready' | 'pending-design'

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

/**
 * Descriptor used by the generic Relic engine. Production families live in
 * `RELIC_FAMILIES`. Test fixtures may register extra descriptors without
 * entering the production catalogue.
 */
export interface RelicDescriptor {
  id: string
  name: string
  kind: RelicKind
  /**
   * Socket compatibility. `null` + `socketStatus: 'pending'` means the
   * canonical source has not assigned this family a class.
   */
  socket: RelicSocketClass | null
  socketStatus: RelicSocketStatus
  /**
   * Production Fabrication is available only when identity, class, socket,
   * and Tier-I effect semantics are all authored.
   */
  fabricationStatus: RelicFabricationStatus
  /**
   * Combat/economy effect. Canonical does not author magnitudes.
   * `pending` means UI must not invent a numeric claim.
   */
  effectStatus: 'pending' | 'authored'
  effectBlurb: string
  source?: RelicSourceMeta
}

export interface RelicFamilyDef extends RelicDescriptor {
  id: RelicFamilyId
  source: RelicSourceMeta
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

function family(
  row: Omit<RelicFamilyDef, 'socket' | 'socketStatus' | 'fabricationStatus'>,
): RelicFamilyDef {
  return {
    ...row,
    socket: null,
    socketStatus: 'pending',
    fabricationStatus: 'pending-design',
  }
}

export const RELIC_FAMILIES: RelicFamilyDef[] = [
  family({
    id: 'overcharge-capacitor',
    name: 'Overcharge Capacitor',
    kind: 'behavioural',
    source: pending('early', 'Early Relic staging is represented; exact deterministic source is unauthored.'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  }),
  family({
    id: 'prismatic-lens',
    name: 'Prismatic Lens',
    kind: 'behavioural',
    source: bossRoute('mid', 550, 'Pack Tyrant II / Prismatic route'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  }),
  family({
    id: 'focusing-array',
    name: 'Focusing Array',
    kind: 'behavioural',
    source: challenge('challenge', 'dead-reckoning', 'Dead Reckoning'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  }),
  family({
    id: 'phase-needle',
    name: 'Phase Needle',
    kind: 'behavioural',
    source: bossRoute('advanced', 600, 'Canticle Engine'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  }),
  family({
    id: 'fixed-mount',
    name: 'Fixed Mount',
    kind: 'behavioural',
    source: bossRoute('advanced', 800, 'Null Battery'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  }),
  family({
    id: 'shatter-mesh',
    name: 'Shatter Mesh',
    kind: 'behavioural',
    source: challenge('challenge', 'pressure-front', 'Pressure Front'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  }),
  family({
    id: 'penetrator-guide',
    name: 'Penetrator Guide',
    kind: 'behavioural',
    source: bossRoute('advanced', 650, 'Iron Behemoth II'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  }),
  family({
    id: 'aegis-relay',
    name: 'Aegis Relay',
    kind: 'behavioural',
    source: bossRoute('early', 400, 'Bastion Engine'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  }),
  family({
    id: 'salvage-matrix',
    name: 'Salvage Matrix',
    kind: 'behavioural',
    source: bossRoute('mid', 700, 'Reclaimer Leviathan'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  }),
  family({
    id: 'gravity-lens',
    name: 'Gravity Lens',
    kind: 'behavioural',
    source: challenge('challenge', 'bare-hive', 'Bare Hive'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  }),
  family({
    id: 'nanite-reservoir',
    name: 'Nanite Reservoir',
    kind: 'behavioural',
    source: challenge('challenge', 'attrition', 'Attrition'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  }),
  family({
    id: 'shield-crossfeed',
    name: 'Shield Crossfeed',
    kind: 'behavioural',
    source: pending('late', 'Late Relic staging is represented; exact deterministic source is unauthored.'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  }),
  family({
    id: 'predictive-bus',
    name: 'Predictive Bus',
    kind: 'behavioural',
    source: challenge('challenge', 'silent-bridge', 'Silent Bridge'),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Exact combat behaviour is not authored.',
  }),
  family({
    id: 'resonance-tap',
    name: 'Resonance Tap',
    kind: 'behavioural',
    source: pending('late', 'Furnace-facing source is PR8. Exact acquisition is unauthored.', {
      kind: 'furnace',
    }),
    effectStatus: 'pending',
    effectBlurb: 'Behavioural Relic. Furnace-facing effect provider is reserved; not wired to legacy Furnace.',
  }),
  family({
    id: 'power-coupler',
    name: 'Power Coupler',
    kind: 'standard',
    source: pending('early', 'Early Relic staging is represented; exact deterministic source is unauthored.'),
    effectStatus: 'pending',
    effectBlurb: 'Standard Relic. Magnitude is not authored.',
  }),
  family({
    id: 'tracking-gimbal',
    name: 'Tracking Gimbal',
    kind: 'standard',
    source: challenge('challenge', 'knife-fight', 'Knife Fight'),
    effectStatus: 'pending',
    effectBlurb: 'Standard Relic. Magnitude is not authored.',
  }),
  family({
    id: 'ballistic-jacket',
    name: 'Ballistic Jacket',
    kind: 'standard',
    source: pending('mid', 'Mid Relic staging is represented; exact deterministic source is unauthored.'),
    effectStatus: 'pending',
    effectBlurb: 'Standard Relic. Magnitude is not authored.',
  }),
  family({
    id: 'reinforcement-plate',
    name: 'Reinforcement Plate',
    kind: 'standard',
    source: pending('early', 'Early Relic staging is represented; exact deterministic source is unauthored.'),
    effectStatus: 'pending',
    effectBlurb: 'Standard Relic. Magnitude is not authored.',
  }),
  family({
    id: 'industrial-optimiser',
    name: 'Industrial Optimiser',
    kind: 'standard',
    source: pending(
      'advanced',
      'Advanced Relic staging is represented; exact scope (combat industry vs Foundry) is unauthored. Does not multiply offline Foundry.',
    ),
    effectStatus: 'pending',
    effectBlurb: 'Standard Relic. Magnitude and industrial scope are not authored. Does not affect offline Foundry.',
  }),
  family({
    id: 'universal-resonator',
    name: 'Universal Resonator',
    kind: 'standard',
    source: bossRoute('late', 850, 'Siege Node II'),
    effectStatus: 'pending',
    effectBlurb: 'Standard Relic. Socket class is unauthored. Not itself a Universal socket.',
  }),
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

/** Non-production descriptors for generic engine tests. Never listed in RELIC_FAMILIES. */
const TEST_RELIC_DESCRIPTORS = new Map<string, RelicDescriptor>()

export function registerTestRelicDescriptor(def: RelicDescriptor): void {
  if (FAMILY_BY_ID.has(def.id as RelicFamilyId)) return
  TEST_RELIC_DESCRIPTORS.set(def.id, def)
}

export function clearTestRelicDescriptors(): void {
  TEST_RELIC_DESCRIPTORS.clear()
}

export function isRelicFamilyId(id: string): id is RelicFamilyId {
  return FAMILY_BY_ID.has(id as RelicFamilyId)
}

export function isKnownRelicDescriptorId(id: string): boolean {
  return isRelicFamilyId(id) || TEST_RELIC_DESCRIPTORS.has(id)
}

export function getRelicFamily(id: string): RelicFamilyDef | undefined {
  return FAMILY_BY_ID.get(id as RelicFamilyId)
}

export function resolveRelicDescriptor(id: string): RelicDescriptor | undefined {
  return TEST_RELIC_DESCRIPTORS.get(id) ?? getRelicFamily(id)
}

export function relicFamilyName(id: string): string {
  return resolveRelicDescriptor(id)?.name ?? 'Unknown Relic'
}

export function authoredRelicSocket(def: RelicDescriptor): RelicSocketClass | null {
  return def.socketStatus === 'authored' ? def.socket : null
}

export function relicSocketUiLabel(def: RelicDescriptor): string {
  const cls = authoredRelicSocket(def)
  return cls ? RELIC_SOCKET_LABELS[cls] : RELIC_SOCKET_PENDING_LABEL
}

/**
 * Production Fabrication requires authored identity, Standard/Behavioural
 * class, socket compatibility, and Tier-I effect semantics.
 */
export function isRelicFamilyFabricatable(def: RelicDescriptor): boolean {
  return (
    def.fabricationStatus === 'ready' &&
    def.socketStatus === 'authored' &&
    def.socket != null &&
    def.effectStatus === 'authored'
  )
}

export function relicTierLabel(tier: RelicTier): string {
  return tier === 1 ? 'I' : tier === 2 ? 'II' : 'III'
}

export function isValidRelicTier(value: unknown): value is RelicTier {
  return value === 1 || value === 2 || value === 3
}
