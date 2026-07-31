/** Signal Cores — equippable passives with typed slots, merges, and prestige carryover. */

import type {
  GameState,
  SignalCoreBonuses,
  SignalCoreDef,
  SignalCoreInstance,
  SignalCoresState,
  SignalCoreSlotType,
  SignalCorePassive,
} from './types'

export const SIGNAL_SLOT_TYPES: SignalCoreSlotType[] = ['assault', 'ward', 'signal']

export const SIGNAL_SLOT_LABELS: Record<SignalCoreSlotType, string> = {
  assault: 'Assault',
  ward: 'Ward',
  signal: 'Signal',
}

export const SIGNAL_CORE_MAX_RANK = 5
export const SIGNAL_CORE_MERGE_COUNT = 3

/** Rank scales passive magnitudes: rank 1 = 1×, rank 5 = 2×. */
export function signalCoreRankMult(rank: number): number {
  const r = Math.max(1, Math.min(SIGNAL_CORE_MAX_RANK, Math.floor(rank)))
  return 1 + 0.25 * (r - 1)
}

export function createEmptySignalCoresState(): SignalCoresState {
  return { inventory: [], equipped: {} }
}

export const SIGNAL_CORE_DEFS: SignalCoreDef[] = [
  {
    id: 'kinetic-shard',
    name: 'Kinetic Shard',
    description: 'Hardened resonance for kinetic batteries.',
    rarity: 'common',
    allowedSlots: ['assault'],
    basePassive: { damage: 0.05 },
    slotBonus: { assault: { damage: 0.04 } },
  },
  {
    id: 'ablative-echo',
    name: 'Ablative Echo',
    description: 'Ghost plating that sheds the first impact.',
    rarity: 'common',
    allowedSlots: ['ward'],
    basePassive: { hull: 0.06 },
    slotBonus: { ward: { armor: 4 } },
  },
  {
    id: 'salvage-ping',
    name: 'Salvage Ping',
    description: 'Marks debris fields for faster recovery.',
    rarity: 'common',
    allowedSlots: ['signal'],
    basePassive: { scrap: 0.08 },
    slotBonus: { signal: { production: 0.04 } },
  },
  {
    id: 'loom-thread',
    name: 'Loom Thread',
    description: 'Fab bay synchronizer drawn from wreck-looms.',
    rarity: 'common',
    allowedSlots: ['signal', 'ward'],
    basePassive: { fab: 0.06 },
    slotBonus: {
      signal: { fab: 0.04 },
      ward: { hull: 0.03 },
    },
  },
  {
    id: 'piercing-tone',
    name: 'Piercing Tone',
    description: 'Tunes batteries to punch through armor bands.',
    rarity: 'rare',
    allowedSlots: ['assault'],
    basePassive: { damage: 0.04, matchup: 0.08 },
    slotBonus: { assault: { matchup: 0.06 } },
  },
  {
    id: 'mirror-lattice',
    name: 'Mirror Lattice',
    description: 'Refracts shield bleed into a stable lattice.',
    rarity: 'rare',
    allowedSlots: ['ward'],
    basePassive: { shield: 18 },
    slotBonus: { ward: { shield: 12, armor: 3 } },
  },
  {
    id: 'freight-beacon',
    name: 'Freight Beacon',
    description: 'Coordinates drone hauls across the scrap field.',
    rarity: 'rare',
    allowedSlots: ['signal'],
    basePassive: { production: 0.07, scrap: 0.04 },
    slotBonus: { signal: { drop: 0.08 } },
  },
  {
    id: 'phase-whisker',
    name: 'Phase Whisker',
    description: 'A thin sensor whisker that tastes phase shear.',
    rarity: 'rare',
    allowedSlots: ['assault', 'signal'],
    basePassive: { evasion: 0.03 },
    slotBonus: {
      assault: { damage: 0.03 },
      signal: { matchup: 0.05 },
    },
  },
  {
    id: 'null-capacitor',
    name: 'Null Capacitor',
    description: 'Stores unused reactor bleed for hull integrity.',
    rarity: 'epic',
    allowedSlots: ['ward', 'signal'],
    basePassive: { hull: 0.08, shield: 10 },
    slotBonus: {
      ward: { armor: 6 },
      signal: { production: 0.05 },
    },
  },
  {
    id: 'overtone-spike',
    name: 'Overtone Spike',
    description: 'Amplifies every battery cycle with a harsh overtone.',
    rarity: 'epic',
    allowedSlots: ['assault', 'ward', 'signal'],
    basePassive: { damage: 0.06 },
    slotBonus: {
      assault: { damage: 0.05 },
      ward: { hull: 0.04 },
      signal: { scrap: 0.06 },
    },
  },
  {
    id: 'harvest-choir',
    name: 'Harvest Choir',
    description: 'A chorus of recovery pings for parts and scrap.',
    rarity: 'epic',
    allowedSlots: ['signal'],
    basePassive: { drop: 0.1, scrap: 0.06, fab: 0.05 },
    slotBonus: { signal: { production: 0.06, drop: 0.05 } },
  },
  {
    id: 'aegis-hum',
    name: 'Aegis Hum',
    description: 'Low-frequency ward that steadies plating under fire.',
    rarity: 'epic',
    allowedSlots: ['ward', 'assault'],
    basePassive: { armor: 5, evasion: 0.02 },
    slotBonus: {
      ward: { hull: 0.07, armor: 4 },
      assault: { damage: 0.03 },
    },
  },
]

const DEF_BY_ID = new Map(SIGNAL_CORE_DEFS.map((d) => [d.id, d]))

export function getSignalCoreDef(id: string): SignalCoreDef | undefined {
  return DEF_BY_ID.get(id)
}

export function emptySignalCoreBonuses(): SignalCoreBonuses {
  return {
    damage: 0,
    hull: 0,
    armor: 0,
    shield: 0,
    scrap: 0,
    production: 0,
    fab: 0,
    drop: 0,
    matchup: 0,
    evasion: 0,
  }
}

function scalePassive(p: SignalCorePassive, mult: number): SignalCorePassive {
  const out: SignalCorePassive = {}
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === 'number') out[k as keyof SignalCorePassive] = v * mult
  }
  return out
}

function addPassive(into: SignalCoreBonuses, p: SignalCorePassive): void {
  into.damage += p.damage ?? 0
  into.hull += p.hull ?? 0
  into.armor += p.armor ?? 0
  into.shield += p.shield ?? 0
  into.scrap += p.scrap ?? 0
  into.production += p.production ?? 0
  into.fab += p.fab ?? 0
  into.drop += p.drop ?? 0
  into.matchup += p.matchup ?? 0
  into.evasion += p.evasion ?? 0
}

export function parseSlotKey(slotKey: string): { type: SignalCoreSlotType; index: number } | null {
  const m = /^(assault|ward|signal)-(\d+)$/.exec(slotKey)
  if (!m) return null
  return { type: m[1] as SignalCoreSlotType, index: Number(m[2]) }
}

export function slotKeyFor(type: SignalCoreSlotType, index: number): string {
  return `${type}-${index}`
}

/** Career sector used for slot unlocks. */
function careerSector(state: GameState): number {
  return Math.max(state.meta?.highestSectorEver ?? 0, state.combat?.highestSector ?? 0)
}

/** Counts available slots per type (1 base, +1 at sector gates; max 2). */
export function signalSlotCounts(state: GameState): Record<SignalCoreSlotType, number> {
  const ever = careerSector(state)
  const act1 = state.meta?.act1Cleared ?? ever >= 30
  return {
    assault: ever >= 20 || act1 ? 2 : 1,
    ward: ever >= 25 || act1 ? 2 : 1,
    signal: ever >= 30 || act1 ? 2 : 1,
  }
}

export interface SignalSlotInfo {
  key: string
  type: SignalCoreSlotType
  index: number
}

export function listSignalSlots(state: GameState): SignalSlotInfo[] {
  const counts = signalSlotCounts(state)
  const slots: SignalSlotInfo[] = []
  for (const type of SIGNAL_SLOT_TYPES) {
    const n = counts[type]
    for (let i = 0; i < n; i++) {
      slots.push({ key: slotKeyFor(type, i), type, index: i })
    }
  }
  return slots
}

export function ensureSignalCores(state: GameState): SignalCoresState {
  if (!state.signalCores) state.signalCores = createEmptySignalCoresState()
  if (!Array.isArray(state.signalCores.inventory)) state.signalCores.inventory = []
  if (!state.signalCores.equipped || typeof state.signalCores.equipped !== 'object') {
    state.signalCores.equipped = {}
  }
  return state.signalCores
}

export function findSignalCore(
  state: GameState,
  uid: string,
): SignalCoreInstance | undefined {
  return ensureSignalCores(state).inventory.find((c) => c.uid === uid)
}

export function isSignalCoreEquipBlocked(state: GameState): boolean {
  return state.prestige.activeChallengeId === 'null-signal'
}

export function canEquipSignalCore(
  state: GameState,
  uid: string,
  slotKey: string,
): boolean {
  if (isSignalCoreEquipBlocked(state)) return false
  const core = findSignalCore(state, uid)
  if (!core) return false
  const def = getSignalCoreDef(core.defId)
  if (!def) return false
  const parsed = parseSlotKey(slotKey)
  if (!parsed) return false
  const slots = listSignalSlots(state)
  if (!slots.some((s) => s.key === slotKey)) return false
  if (!def.allowedSlots.includes(parsed.type)) return false
  return true
}

let uidSeq = 0
export function newSignalCoreUid(now = Date.now()): string {
  uidSeq += 1
  return `sc-${now.toString(36)}-${uidSeq.toString(36)}`
}

export function makeSignalCoreInstance(
  defId: string,
  rank = 1,
  now = Date.now(),
): SignalCoreInstance {
  return {
    uid: newSignalCoreUid(now),
    defId,
    rank: Math.max(1, Math.min(SIGNAL_CORE_MAX_RANK, Math.floor(rank))),
  }
}

/** Unequip every slot (inventory kept). Mutates state. */
export function unequipAllSignalCores(state: GameState): void {
  const sc = ensureSignalCores(state)
  sc.equipped = {}
}

export function unequipSignalCore(state: GameState, slotKey: string): GameState {
  const next = structuredClone(state)
  const sc = ensureSignalCores(next)
  if (!(slotKey in sc.equipped)) return state
  const equipped = { ...sc.equipped }
  delete equipped[slotKey]
  sc.equipped = equipped
  return next
}

export function equipSignalCore(
  state: GameState,
  uid: string,
  slotKey: string,
): GameState {
  if (!canEquipSignalCore(state, uid, slotKey)) return state
  const next = structuredClone(state)
  const sc = ensureSignalCores(next)
  const equipped = { ...sc.equipped }
  // Clear this core from any other slot.
  for (const [key, equippedUid] of Object.entries(equipped)) {
    if (equippedUid === uid) delete equipped[key]
  }
  equipped[slotKey] = uid
  sc.equipped = equipped
  return next
}

/** Merge three unequipped identical cores (same def + rank) → one at rank+1. */
export function mergeSignalCores(
  state: GameState,
  defId: string,
  rank: number,
): GameState {
  if (rank < 1 || rank >= SIGNAL_CORE_MAX_RANK) return state
  if (!getSignalCoreDef(defId)) return state
  const next = structuredClone(state)
  const sc = ensureSignalCores(next)
  const equippedUids = new Set(Object.values(sc.equipped))
  const matches = sc.inventory.filter(
    (c) => c.defId === defId && c.rank === rank && !equippedUids.has(c.uid),
  )
  if (matches.length < SIGNAL_CORE_MERGE_COUNT) return state
  const consume = new Set(matches.slice(0, SIGNAL_CORE_MERGE_COUNT).map((c) => c.uid))
  sc.inventory = sc.inventory.filter((c) => !consume.has(c.uid))
  sc.inventory.push(makeSignalCoreInstance(defId, rank + 1))
  return next
}

export function countMergeable(
  state: GameState,
  defId: string,
  rank: number,
): number {
  const sc = ensureSignalCores(state)
  const equippedUids = new Set(Object.values(sc.equipped))
  return sc.inventory.filter(
    (c) => c.defId === defId && c.rank === rank && !equippedUids.has(c.uid),
  ).length
}

export function computeSignalCoreBonuses(state: GameState): SignalCoreBonuses {
  const out = emptySignalCoreBonuses()
  const sc = state.signalCores
  if (!sc) return out
  const byUid = new Map(sc.inventory.map((c) => [c.uid, c]))
  const available = new Set(listSignalSlots(state).map((s) => s.key))

  for (const [slotKey, uid] of Object.entries(sc.equipped)) {
    if (!available.has(slotKey)) continue
    const parsed = parseSlotKey(slotKey)
    if (!parsed) continue
    const inst = byUid.get(uid)
    if (!inst) continue
    const def = getSignalCoreDef(inst.defId)
    if (!def) continue
    if (!def.allowedSlots.includes(parsed.type)) continue
    const mult = signalCoreRankMult(inst.rank)
    addPassive(out, scalePassive(def.basePassive, mult))
    const slotExtra = def.slotBonus[parsed.type]
    if (slotExtra) addPassive(out, scalePassive(slotExtra, mult))
  }
  return out
}

/** Human-readable bonus lines for a def at rank (base + optional slot). */
export function describeSignalCoreBonuses(
  def: SignalCoreDef,
  rank: number,
  slotType?: SignalCoreSlotType,
): string {
  const mult = signalCoreRankMult(rank)
  const combined = emptySignalCoreBonuses()
  addPassive(combined, scalePassive(def.basePassive, mult))
  if (slotType && def.slotBonus[slotType]) {
    addPassive(combined, scalePassive(def.slotBonus[slotType]!, mult))
  }
  return formatSignalCoreBonuses(combined)
}

export function formatSignalCoreBonuses(b: SignalCoreBonuses): string {
  const bits: string[] = []
  if (b.damage) bits.push(`+${(b.damage * 100).toFixed(1)}% dmg`)
  if (b.hull) bits.push(`+${(b.hull * 100).toFixed(1)}% hull`)
  if (b.armor) bits.push(`+${b.armor.toFixed(1)} armor`)
  if (b.shield) bits.push(`+${b.shield.toFixed(0)} shield`)
  if (b.scrap) bits.push(`+${(b.scrap * 100).toFixed(1)}% scrap`)
  if (b.production) bits.push(`+${(b.production * 100).toFixed(1)}% prod`)
  if (b.fab) bits.push(`+${(b.fab * 100).toFixed(1)}% fab`)
  if (b.drop) bits.push(`+${(b.drop * 100).toFixed(1)}% drops`)
  if (b.matchup) bits.push(`+${(b.matchup * 100).toFixed(1)}% matchup`)
  if (b.evasion) bits.push(`+${(b.evasion * 100).toFixed(1)}% evasion`)
  return bits.join(' · ') || 'No bonus'
}

const COMMON_IDS = SIGNAL_CORE_DEFS.filter((d) => d.rarity === 'common').map((d) => d.id)
const RARE_IDS = SIGNAL_CORE_DEFS.filter((d) => d.rarity === 'rare').map((d) => d.id)
const EPIC_IDS = SIGNAL_CORE_DEFS.filter((d) => d.rarity === 'epic').map((d) => d.id)

/** Family-weighted common tables for kill drops. */
const FAMILY_COMMON_WEIGHTS: Record<string, Record<string, number>> = {
  swarm: {
    'kinetic-shard': 3,
    'salvage-ping': 2,
    'loom-thread': 1,
    'ablative-echo': 1,
  },
  armored: {
    'ablative-echo': 3,
    'kinetic-shard': 2,
    'loom-thread': 1,
    'salvage-ping': 1,
  },
  ethereal: {
    'loom-thread': 3,
    'salvage-ping': 2,
    'kinetic-shard': 1,
    'ablative-echo': 1,
  },
  divine: {
    'salvage-ping': 2,
    'loom-thread': 2,
    'ablative-echo': 2,
    'kinetic-shard': 1,
  },
  titan: {
    'kinetic-shard': 2,
    'ablative-echo': 2,
    'loom-thread': 2,
    'salvage-ping': 2,
  },
}

function pickWeighted(weights: Record<string, number>, rng: () => number): string | null {
  const entries = Object.entries(weights).filter(([, w]) => w > 0)
  if (entries.length === 0) return null
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let roll = rng() * total
  for (const [id, w] of entries) {
    roll -= w
    if (roll <= 0) return id
  }
  return entries[entries.length - 1]![0]
}

function pickFromList(ids: string[], rng: () => number): string | null {
  if (ids.length === 0) return null
  return ids[Math.floor(rng() * ids.length)] ?? null
}

export type SignalCoreDropSource = 'kill' | 'sector' | 'boss'

export interface SignalCoreDropResult {
  defId: string
  rarity: SignalCoreDef['rarity']
  uid: string
}

/**
 * Roll a Signal Core drop into inventory.
 * Mutates state. Separate from blueprint part rolls.
 */
export function grantSignalCoreDrop(
  state: GameState,
  source: SignalCoreDropSource,
  opts: { family?: string; rng?: () => number } = {},
): SignalCoreDropResult | null {
  const rng = opts.rng ?? Math.random
  let defId: string | null = null

  if (source === 'kill') {
    // ~4% common on kill
    if (rng() > 0.04) return null
    const family = opts.family ?? 'swarm'
    const table = FAMILY_COMMON_WEIGHTS[family] ?? FAMILY_COMMON_WEIGHTS.swarm!
    defId = pickWeighted(table, rng) ?? pickFromList(COMMON_IDS, rng)
  } else if (source === 'sector') {
    // ~18% common/rare on sector clear
    if (rng() > 0.18) return null
    defId = rng() < 0.75 ? pickFromList(COMMON_IDS, rng) : pickFromList(RARE_IDS, rng)
  } else {
    // Boss clear: ~45% rare/epic (biased rare)
    if (rng() > 0.45) return null
    defId = rng() < 0.7 ? pickFromList(RARE_IDS, rng) : pickFromList(EPIC_IDS, rng)
  }

  if (!defId) return null
  const def = getSignalCoreDef(defId)
  if (!def) return null
  const sc = ensureSignalCores(state)
  const inst = makeSignalCoreInstance(defId, 1)
  sc.inventory = [...sc.inventory, inst]
  state.combat.log = [
    `Signal Core recovered: ${def.name} (${def.rarity}).`,
    ...state.combat.log,
  ].slice(0, 40)
  return { defId, rarity: def.rarity, uid: inst.uid }
}

/** Base passive blurb without slot bonus (for inventory). */
export function signalCoreBaseBlurb(def: SignalCoreDef, rank: number): string {
  return `Base: ${describeSignalCoreBonuses(def, rank)}`
}

export function signalCoreSlotBlurb(def: SignalCoreDef, rank: number): string {
  const bits: string[] = []
  for (const type of def.allowedSlots) {
    const bonus = def.slotBonus[type]
    if (!bonus) continue
    const scaled = emptySignalCoreBonuses()
    addPassive(scaled, scalePassive(bonus, signalCoreRankMult(rank)))
    bits.push(`${SIGNAL_SLOT_LABELS[type]}: ${formatSignalCoreBonuses(scaled)}`)
  }
  return bits.join(' · ')
}
