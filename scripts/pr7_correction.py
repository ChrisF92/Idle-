from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def path(name: str) -> Path:
    return ROOT / name


def read(name: str) -> str:
    return path(name).read_text()


def write(name: str, text: str) -> None:
    path(name).write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise RuntimeError(f"{label}: expected one exact match, found {text.count(old)}")
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, repl: str, label: str) -> str:
    out, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected one regex match, found {count}")
    return out


# A/G — encounter generation is budget-led and has only a neutral future modifier hook.
write("src/game/encounterGenerator.ts", r'''/** Catalogue-based ordinary and Commander encounter generation. */

import type { CombatUnit, GameState } from './types'
import {
  buildHostileUnit,
  firstContactHostile,
  getHostileDef,
  introducedHostiles,
  type HostileDef,
} from './hostileCatalogue'
import {
  DENSITY_COUNT_MAX,
  DISRUPTOR_CAP_PER_PACKAGE,
  FORMATION_DISPERSION_WEIGHT,
  FORMATION_DISPERSION_WEIGHT_MAX,
  SUPPORT_CAP_PER_PACKAGE,
} from './hostileSeeds'
import { FORMATION_IDS, formationRngFor, formationSlots, pickFormation, type FormationId } from './formations'
import { createSimRng, hashSeed, rngInt, type SimRngState } from './simRng'
import { isBossWave } from './waves'
import {
  fitPackToThreat,
  measureThreatRoll,
  packThreat,
  threatBudgetForWave,
  threatSpecForWave,
} from './threatBudget'
import {
  buildCommanderPackage,
  isCommanderWave,
  recordCommanderHistory,
} from './commanders'

export interface WaveEncounter {
  id: string
  name: string
  family: string
  tags: string[]
  isBoss: boolean
  scrapReward: number
  dataReward: number
  aiReward: number
  essenceReward: number
  salvageReward: number
  blurb: string
  units: CombatUnit[]
  mechanicId?: string
  threat?: { seed: number; budget: number; spent: number }
  formation?: FormationId
  commanderReserved?: CombatUnit
}

/** Neutral extension point for later authored systems. PR7 installs no provider. */
export interface EncounterGenerationModifier {
  threatMultiplier?: number
  countDelta?: number
}

export type EncounterModifierProvider = (
  state: GameState,
  wave: number,
  kind: 'ordinary' | 'commander',
) => EncounterGenerationModifier

let encounterModifierProvider: EncounterModifierProvider | null = null

export function setEncounterModifierProvider(provider: EncounterModifierProvider | null): void {
  encounterModifierProvider = provider
}

export function resetEncounterModifierProvider(): void {
  encounterModifierProvider = null
}

function modifierFor(
  state: GameState | undefined,
  wave: number,
  kind: 'ordinary' | 'commander',
): Required<EncounterGenerationModifier> {
  const raw = state && encounterModifierProvider ? encounterModifierProvider(state, wave, kind) : {}
  return {
    threatMultiplier: Math.max(0.1, Number(raw.threatMultiplier ?? 1) || 1),
    countDelta: Math.trunc(Number(raw.countDelta ?? 0) || 0),
  }
}

const ENCOUNTER_CHANNEL = 0xe11c07

function encounterRng(seed: number, wave: number, ordinal: number): SimRngState {
  return createSimRng(hashSeed(seed >>> 0, wave, ordinal, ENCOUNTER_CHANNEL))
}

function respectCaps(picks: HostileDef[]): HostileDef[] {
  let support = 0
  let disruptor = 0
  const out: HostileDef[] = []
  for (const def of picks) {
    if (def.category === 'support' && support >= SUPPORT_CAP_PER_PACKAGE) continue
    if (def.category === 'disruptor' && disruptor >= DISRUPTOR_CAP_PER_PACKAGE) continue
    if (def.category === 'support') support += 1
    if (def.category === 'disruptor') disruptor += 1
    out.push(def)
  }
  return out
}

export function supportDisruptorCounts(units: CombatUnit[]): { support: number; disruptor: number } {
  let support = 0
  let disruptor = 0
  for (const unit of units) {
    const def = getHostileDef(unit.hostileId)
    if (def?.category === 'support') support += 1
    if (def?.category === 'disruptor') disruptor += 1
  }
  return { support, disruptor }
}

export function formationDispersionWeight(id: FormationId): number {
  return Math.min(FORMATION_DISPERSION_WEIGHT_MAX, FORMATION_DISPERSION_WEIGHT[id] ?? 0)
}

function pickMix(wave: number, rng: SimRngState, count: number): HostileDef[] {
  const intro = firstContactHostile(wave)
  const pool = introducedHostiles(wave).sort((a, b) => a.id.localeCompare(b.id))
  const picks: HostileDef[] = []
  if (intro) picks.push(intro)
  while (picks.length < count && pool.length > 0) {
    picks.push(pool[rngInt(rng, 0, pool.length - 1)]!)
  }
  const capped = respectCaps(picks)
  if (intro && !capped.some((d) => d.id === intro.id)) capped.unshift(intro)
  return capped.slice(0, Math.max(count, intro ? 1 : 0))
}

function applyFormation(units: CombatUnit[], wave: number, seed: number, ordinal: number): FormationId {
  const rng = formationRngFor(seed, wave, ordinal)
  const ctx = { rng, wave, packageId: `w${wave}-p${ordinal}` }
  const formation = pickFormation(ctx)
  const slots = formationSlots(formation, units.length, ctx)
  units.forEach((unit, i) => {
    const slot = slots[i] ?? slots[0]!
    unit.x = slot.x
    unit.y = slot.y
    unit.heading = slot.bearing
  })
  return formation
}

function ordinaryEncounter(
  wave: number,
  seed: number,
  ordinal: number,
  extraDanger: number,
  modifier: Required<EncounterGenerationModifier>,
): WaveEncounter {
  const rng = encounterRng(seed, wave, ordinal)
  const spec = threatSpecForWave(wave)
  const baseCount = spec.countMin + rngInt(rng, 0, Math.max(0, spec.countMax - spec.countMin))
  const want = Math.min(DENSITY_COUNT_MAX, Math.max(1, baseCount + modifier.countDelta))
  const defs = pickMix(wave, rng, want)
  const units = defs.map((def, i) => {
    const unit = buildHostileUnit({ def, wave })
    unit.id = `draft-${def.id}-${i}`
    return unit
  })
  const formation = applyFormation(units, wave, seed, ordinal)
  const pressure = 1 + formationDispersionWeight(formation)
  const budget = threatBudgetForWave(wave) * Math.max(0.1, extraDanger) * modifier.threatMultiplier
  fitPackToThreat(units, budget / pressure)
  const spent = packThreat(units) * pressure
  const lead = units[0]
  return {
    id: `w${wave}-${lead?.hostileId ?? 'pack'}`,
    name: lead ? `${lead.name} pack (W${wave})` : `Wave ${wave}`,
    family: lead?.family ?? '',
    tags: [formation, ...(lead?.hostileId ? [lead.hostileId] : [])],
    isBoss: false,
    scrapReward: 5 + Math.floor(wave / 5),
    dataReward: 1 + Math.floor(wave / 30),
    aiReward: 0,
    essenceReward: 0,
    salvageReward: 0,
    blurb: firstContactHostile(wave)
      ? `First contact: ${firstContactHostile(wave)!.name}.`
      : 'Ordinary reinforcement from introduced hostiles.',
    units,
    formation,
    threat: { ...measureThreatRoll(units, seed, budget, false), spent },
  }
}

function commanderEncounter(
  wave: number,
  seed: number,
  state: GameState | undefined,
  modifier: Required<EncounterGenerationModifier>,
): WaveEncounter {
  const built = buildCommanderPackage(
    wave,
    seed,
    state,
    modifier.threatMultiplier,
    modifier.countDelta,
  )
  if (state) recordCommanderHistory(state, built.plan, wave)
  const units = [built.commander, ...built.escorts]
  const spent = packThreat(units) * (1 + formationDispersionWeight(built.plan.formation))
  return {
    id: `w${wave}-commander`,
    name: `COMMANDER · ${built.commander.name}`,
    family: built.commander.family ?? '',
    tags: ['commander', built.plan.traitId, built.plan.formation],
    isBoss: false,
    scrapReward: 5 + Math.floor(wave / 5),
    dataReward: 1 + Math.floor(wave / 30),
    aiReward: 0,
    essenceReward: 0,
    salvageReward: 0,
    blurb: wave === 10
      ? 'COMMANDER CONTACT. Promoted hostiles carry one enhanced trait and improved rewards.'
      : `Commander · ${built.plan.traitId}`,
    units,
    formation: built.plan.formation,
    threat: { seed, budget: built.targetThreat, spent },
  }
}

/** Ordinary / Commander encounters. Proper Bosses use the Boss provider. */
export function encounterForWave(wave: number, extraDanger = 1, state?: GameState): WaveEncounter {
  const w = Math.max(1, Math.floor(wave))
  if (isBossWave(w)) {
    return {
      id: `w${w}-boss-placeholder`,
      name: `Boss Wave ${w}`,
      family: '',
      tags: ['boss'],
      isBoss: false,
      scrapReward: 0,
      dataReward: 0,
      aiReward: 0,
      essenceReward: 0,
      salvageReward: 0,
      blurb: 'Proper Boss encounters resolve through the Boss provider.',
      units: [],
    }
  }
  const seed = state?.combat.sortieSeed ?? 0
  const ordinal = (state?.combat.packages.length ?? 0) + 1
  if (isCommanderWave(w)) return commanderEncounter(w, seed, state, modifierFor(state, w, 'commander'))
  return ordinaryEncounter(w, seed, ordinal, extraDanger, modifierFor(state, w, 'ordinary'))
}

export function firstContactCanAppear(wave: number): boolean {
  return Boolean(firstContactHostile(wave))
}

export function firstContactForbiddenBefore(id: string, wave: number): boolean {
  const def = getHostileDef(id)
  if (!def) return true
  return wave < def.firstContactWave
}

/** Isolated from combat/loot RNG. */
export function formationPositionsFor(
  seed: number,
  wave: number,
  ordinal: number,
  count: number,
  formation?: FormationId,
): { formation: FormationId; xs: number[]; ys: number[] } {
  const rng = formationRngFor(seed, wave, ordinal)
  const id = formation ?? pickFormation({ rng, wave, packageId: `w${wave}-p${ordinal}` })
  const slots = formationSlots(id, count, { rng, wave, packageId: `w${wave}-p${ordinal}` })
  return { formation: id, xs: slots.map((s) => s.x), ys: slots.map((s) => s.y) }
}

export { FORMATION_IDS }
''')

# A — precise pack fitting helper.
threat = read("src/game/threatBudget.ts")
needle = "export function rescalePack(units: CombatUnit[], targetEhp: number, targetDps: number): void {"
if needle not in threat:
    raise RuntimeError("threatBudget: rescalePack missing")
insert_at = threat.index("\n/**\n * Narrow count jitter only.", threat.index(needle))
helper = r'''

/** Scale live EHP/DPS together so measured pack threat lands on a target budget. */
export function fitPackToThreat(units: CombatUnit[], targetThreat: number): void {
  if (units.length === 0) return
  const target = Math.max(0.01, targetThreat)
  const armorThreat = units.reduce((sum, unit) => sum + unit.armor * 0.5, 0)
  const current = packThreat(units)
  const scalable = Math.max(0, current - armorThreat)
  const mult = scalable > 1e-9 ? Math.max(0.01, (target - armorThreat) / scalable) : 1
  for (const unit of units) {
    const hullRatio = unit.hullMax > 0 ? unit.hull / unit.hullMax : 1
    const shieldRatio = unit.shieldMax > 0 ? unit.shield / unit.shieldMax : 0
    unit.hullMax = Math.max(1, unit.hullMax * mult)
    unit.hull = Math.max(0, unit.hullMax * hullRatio)
    unit.shieldMax *= mult
    unit.shield = unit.shieldMax * shieldRatio
    if (unit.authoredHullMax != null) unit.authoredHullMax *= mult
    if (unit.authoredShieldMax != null) unit.authoredShieldMax *= mult
    for (const weapon of unit.weapons) weapon.damage *= mult
  }
}
'''
threat = threat[:insert_at] + helper + threat[insert_at:]
write("src/game/threatBudget.ts", threat)

# Seeds — neutral Boss/shell profiles and bounded jam retry.
seeds = read("src/game/hostileSeeds.ts")
elite_block = r'''export const ELITE_ROLE_BASELINE = {
  hull: 22,
  shield: 10,
  armor: 3,
  damage: 3.4,
  cooldown: 1.15,
  range: 56,
  speed: 26,
  engageRange: 92,
  kite: false,
} as const
'''
seed_add = elite_block + r'''

/** Dedicated pending-Boss body. Never derived from an ordinary HostileDef. */
export const NEUTRAL_BOSS_BASELINE = {
  hull: 34,
  shieldFrac: 0.35,
  armor: 2,
  damage: 5.5,
  cooldown: 1.4,
  range: 110,
  speed: 14,
  engageRange: 120,
  kite: true,
} as const

/** Dedicated Choir Crown Reconstruction shell-node simulator profile. */
export const CHOIR_CROWN_SHELL_NODE_BASELINE = {
  hull: 18,
  shield: 10,
  armor: 3,
  speed: 0,
  engageRange: 140,
} as const
'''
seeds = replace_once(seeds, elite_block, seed_add, "hostileSeeds neutral profiles")
seeds = replace_once(
    seeds,
    "  jamCooldown: 7,\n  loopbreakExtra: 2,",
    "  jamCooldown: 7,\n  jamRetryDelay: 0.6,\n  loopbreakExtra: 2,",
    "hostileSeeds jam retry",
)
seeds = seeds.replace(
    " * Absolute ceiling after Challenge/Directive density hooks.\n * Density itself is owned by later PRs; PR7 only consumes the existing multiplier.",
    " * Absolute safety ceiling for the neutral encounter modifier extension point.\n * PR7 itself always uses identity modifiers.",
)
write("src/game/hostileSeeds.ts", seeds)

# B/A — Commander selection, provisional compatibility, one Vanguard speed application,
# and mechanically enforced Commander/escort threat shares.
cmd = read("src/game/commanders.ts")
cmd = cmd.replace("  firstContactHostile,\n", "")
cmd = replace_once(
    cmd,
    "import { packThreat } from './threatBudget'",
    "import { fitPackToThreat, packThreat, threatBudgetForWave } from './threatBudget'",
    "commanders threat imports",
)
cmd = sub_once(
    cmd,
    r"function selectHostile\(\n  rng: SimRngState,\n  wave: number,\n  state: GameState \| undefined,\n\): HostileDef \{.*?\n\}",
    r'''function selectHostile(
  rng: SimRngState,
  wave: number,
  state: GameState | undefined,
): HostileDef {
  const pool = introducedHostiles(wave).filter(
    (def) => def.commanderEligible && def.firstContactWave < wave,
  )
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id))
  if (sorted.length === 0) throw new Error(`No already-known Commander base is available at Wave ${wave}`)
  const recent = recentBases(state, 2)
  const avoided = sorted.filter((d) => !recent.includes(d.id))
  const use = avoided.length > 0 ? avoided : sorted
  return pickSorted(rng, use)
}''',
    "commanders already-known selection",
)
cmd = replace_once(
    cmd,
    "  pairingStatus: 'pending-pairing' | 'generated'\n  formation: FormationId",
    "  pairingStatus: 'pending-pairing' | 'generated'\n  compatibilityStatus: 'provisional' | 'authored'\n  formation: FormationId",
    "commanders plan compatibility field",
)
cmd = replace_once(
    cmd,
    "      pairingStatus: W10_COMMANDER_SEED.status,\n      formation: 'spear',",
    "      pairingStatus: W10_COMMANDER_SEED.status,\n      compatibilityStatus: 'provisional',\n      formation: 'spear',",
    "commanders W10 provisional",
)
cmd = replace_once(
    cmd,
    "    pairingStatus: 'generated',\n    formation,",
    "    pairingStatus: 'generated',\n    compatibilityStatus: def.traitCompatibilityStatus === 'authored' ? 'authored' : 'provisional',\n    formation,",
    "commanders generated provisional",
)
cmd = sub_once(
    cmd,
    r"  if \(trait === 'vanguard'\) \{\n    unit\.speed \*= VANGUARD_SEEDS\.selfSpeedMult\n    unit\.authoredSpeed = unit\.speed\n  \}\n",
    "",
    "commanders Vanguard base speed",
)
# Keep the import for VANGUARD seeds only if still referenced after removal.
cmd = cmd.replace("  VANGUARD_SEEDS,\n", "")
cmd = sub_once(
    cmd,
    r"function escortDefs\(wave: number, commanderId: HostileId, rng: SimRngState, want: number\): HostileDef\[\] \{.*?\n\}\n\nexport function commanderEscortBase",
    r'''function escortDefs(wave: number, commanderId: HostileId, rng: SimRngState, want: number): HostileDef[] {
  const pool = introducedHostiles(wave)
    .filter((d) => d.id !== commanderId)
    .sort((a, b) => a.id.localeCompare(b.id))
  const fallback = introducedHostiles(wave).sort((a, b) => a.id.localeCompare(b.id))
  const use = pool.length > 0 ? pool : fallback
  const out: HostileDef[] = []
  let support = 0
  let disruptor = 0
  const firstContact = introducedHostiles(wave).find((d) => d.firstContactWave === wave)
  if (firstContact && firstContact.id !== commanderId) {
    out.push(firstContact)
    if (firstContact.category === 'support') support += 1
    if (firstContact.category === 'disruptor') disruptor += 1
  }
  while (out.length < want && use.length > 0) {
    const pick = use[rngInt(rng, 0, use.length - 1)]!
    if (pick.category === 'support' && support >= SUPPORT_CAP_PER_PACKAGE) continue
    if (pick.category === 'disruptor' && disruptor >= DISRUPTOR_CAP_PER_PACKAGE) continue
    if (pick.category === 'support') support += 1
    if (pick.category === 'disruptor') disruptor += 1
    out.push(pick)
  }
  while (out.length < Math.max(1, want) && use.length > 0) {
    const pick = use[out.length % use.length]!
    if (!out.includes(pick) || use.length === 1) out.push(pick)
    else out.push(use[(out.length + 1) % use.length]!)
    if (out.length > 8) break
  }
  return out
}

export function commanderEscortBase''',
    "commanders escort collision",
)
cmd = sub_once(
    cmd,
    r"export function buildCommanderPackage\(\n  wave: number,\n  seed: number,\n  state\?: GameState,\n  density = 1,\n\): \{ commander: CombatUnit; escorts: CombatUnit\[\]; plan: CommanderPlan; ordinaryThreat: number \} \{.*?\n\}\n\nexport function livingCommanderCount",
    r'''export function buildCommanderPackage(
  wave: number,
  seed: number,
  state?: GameState,
  threatMultiplier = 1,
  escortDelta = 0,
): {
  commander: CombatUnit
  escorts: CombatUnit[]
  plan: CommanderPlan
  targetThreat: number
  commanderThreatTarget: number
  escortThreatTarget: number
} {
  const plan = planCommanderEvent(wave, seed, state)
  const def = getHostileDef(plan.hostileId)!
  const commander = promoteToCommander(buildHostileUnit({ def, wave }), plan.traitId, def)
  const rng = commanderRng(seed, wave)
  rngNext(rng)
  const escortCount = Math.min(
    DENSITY_COUNT_MAX - 1,
    Math.max(1, commanderEscortBase(wave) + Math.trunc(escortDelta)),
  )
  const escorts = escortDefs(wave, plan.hostileId, rng, escortCount).map((esc, i) => {
    const unit = buildHostileUnit({ def: esc, wave })
    unit.rewardWeight = 1
    unit.id = `draft-escort-${i}`
    return unit
  })
  const ctx = {
    rng: formationRngFor(seed, wave, commanderEventOrdinal(wave) + 3),
    wave,
    packageId: `cmdr-w${wave}`,
  }
  const formation = plan.formation
  const slots = formationSlots(formation, 1 + escorts.length, ctx)
  commander.x = slots[0]?.x ?? commander.x
  commander.y = slots[0]?.y ?? commander.y
  commander.heading = slots[0]?.bearing ?? 0
  escorts.forEach((unit, i) => {
    const slot = slots[i + 1] ?? slots[0]!
    unit.x = slot.x
    unit.y = slot.y
    unit.heading = slot.bearing
  })

  const dispersion = Math.min(
    FORMATION_DISPERSION_WEIGHT_MAX,
    FORMATION_DISPERSION_WEIGHT[formation] ?? 0,
  )
  const targetThreat =
    threatBudgetForWave(wave) * COMMANDER_WAVE_THREAT_MULT * Math.max(0.1, threatMultiplier)
  const rawTarget = targetThreat / (1 + dispersion)
  const commanderThreatTarget = rawTarget * COMMANDER_SELF_THREAT_SHARE
  const escortThreatTarget = Math.max(0.01, rawTarget - commanderThreatTarget)
  fitPackToThreat([commander], commanderThreatTarget)
  fitPackToThreat(escorts, escortThreatTarget)
  return {
    commander,
    escorts,
    plan,
    targetThreat,
    commanderThreatTarget,
    escortThreatTarget,
  }
}

export function livingCommanderCount''',
    "commanders budget package",
)
# Ensure formation threat seeds are imported.
cmd = replace_once(
    cmd,
    "  COMMANDER_WAVE_THREAT_MULT,\n  DENSITY_COUNT_MAX,",
    "  COMMANDER_WAVE_THREAT_MULT,\n  DENSITY_COUNT_MAX,\n  FORMATION_DISPERSION_WEIGHT,\n  FORMATION_DISPERSION_WEIGHT_MAX,",
    "commanders formation threat imports",
)
cmd = sub_once(
    cmd,
    r"\nexport function commanderThreatShare\(_wave: number\): number \{\n  return COMMANDER_SELF_THREAT_SHARE\n\}\n",
    "\n",
    "commanders no-op threat share",
)
write("src/game/commanders.ts", cmd)

# B — per-recipient same-Trait auras and fresh support Shield derivation.
traits = read("src/game/commanderTraits.ts")
traits = sub_once(
    traits,
    r"function strongest\(state: GameState, trait: CommanderTraitId\): CombatUnit \| null \{.*?\n\}\n\nfunction inRadius",
    r'''function traitSources(state: GameState, trait: CommanderTraitId): CombatUnit[] {
  return livingCommanders(state)
    .filter((unit) => unit.commanderTraitId === trait)
    .sort((a, b) => b.hullMax - a.hullMax || a.id.localeCompare(b.id))
}

function inRadius''',
    "commanderTraits trait sources",
)
traits = sub_once(
    traits,
    r"export function applyCommanderDerivedStats\(state: GameState\): void \{.*?\n\}\n\nexport function suppressorModifier",
    r'''export function applyCommanderDerivedStats(state: GameState): void {
  const priorSupport = new Map(
    state.combat.enemyUnits.map((unit) => [unit.id, unit.supportShield ?? 0] as const),
  )
  for (const unit of state.combat.enemyUnits) {
    unit.commanderSpeedMult = 1
    unit.commanderCycleMult = 1
    unit.supportShield = 0
    unit.supportShieldMax = 0
  }

  const vanguards = traitSources(state, 'vanguard')
  for (const source of vanguards) {
    source.commanderSpeedMult = Math.max(source.commanderSpeedMult ?? 1, VANGUARD_SEEDS.selfSpeedMult)
    source.commanderCycleMult = Math.max(source.commanderCycleMult ?? 1, VANGUARD_SEEDS.selfCycleMult)
  }
  for (const ally of state.combat.enemyUnits) {
    if (ally.hull <= 0) continue
    for (const source of vanguards) {
      if (ally.id === source.id || !inRadius(source, ally, VANGUARD_SEEDS.auraRadius)) continue
      ally.commanderSpeedMult = Math.max(ally.commanderSpeedMult ?? 1, VANGUARD_SEEDS.auraSpeedMult)
    }
  }

  const rallying = traitSources(state, 'rallying')
  for (const ally of state.combat.enemyUnits) {
    if (ally.hull <= 0) continue
    for (const source of rallying) {
      if (ally.id === source.id || !inRadius(source, ally, RALLYING_SEEDS.auraRadius)) continue
      ally.commanderCycleMult = Math.max(ally.commanderCycleMult ?? 1, RALLYING_SEEDS.allyCycleMult)
      ally.commanderSpeedMult = Math.max(ally.commanderSpeedMult ?? 1, RALLYING_SEEDS.allySpeedMult)
    }
  }

  const wards = traitSources(state, 'wardbearer')
  for (const ally of state.combat.enemyUnits) {
    if (ally.hull <= 0) continue
    const applicable = wards.filter(
      (source) => source.id !== ally.id && inRadius(source, ally, WARDBEARER_SEEDS.auraRadius),
    )
    if (applicable.length === 0) continue
    const maxShield = Math.max(...applicable.map(() => WARDBEARER_SEEDS.allySupportShield))
    ally.supportShieldMax = maxShield
    ally.supportShield = Math.min(
      maxShield,
      Math.max(priorSupport.get(ally.id) ?? 0, maxShield * 0.35),
    )
  }
}

export function suppressorModifier''',
    "commanderTraits per-recipient auras",
)
traits = sub_once(
    traits,
    r"export function suppressorModifier\(state: GameState\): TargetingStatModifier \{.*?\n\}",
    r'''export function suppressorModifier(state: GameState): TargetingStatModifier {
  if (traitSources(state, 'suppressor').length === 0) return {}
  return {
    slewRateMult: SUPPRESSOR_SEEDS.slewMult,
    acquisitionRangeMult: SUPPRESSOR_SEEDS.acquireMult,
  }
}''',
    "commanderTraits suppressor",
)
traits = sub_once(
    traits,
    r"export function tickCommanderTraits\(state: GameState, dt: number\): void \{.*?\n\}\n\nexport function ensureDeathHazards",
    r'''export function tickCommanderTraits(state: GameState, dt: number): void {
  applyCommanderDerivedStats(state)
  for (const unit of state.combat.enemyUnits) {
    if (unit.hull <= 0) continue
    tickDisplacer(unit, dt)
    tickBreacher(unit, dt)
  }
  if (traitSources(state, 'vanguard').length > 0) noteAuraUptime(state, 'vanguard', dt)
  if (traitSources(state, 'wardbearer').length > 0) noteAuraUptime(state, 'wardbearer', dt)
  if (traitSources(state, 'rallying').length > 0) noteAuraUptime(state, 'rallying', dt)
  if (traitSources(state, 'suppressor').length > 0) noteAuraUptime(state, 'suppressor', dt)
}

export function ensureDeathHazards''',
    "commanderTraits runtime source checks",
)
if "strongest(state" in traits:
    raise RuntimeError("commanderTraits still has global strongest source use")
write("src/game/commanderTraits.ts", traits)

# C — dedicated mechanically neutral pending Boss body.
boss = read("src/game/bossRegistry.ts")
boss = replace_once(
    boss,
    "  CHOIR_CROWN_SEEDS,\n  enemyDamageScale,",
    "  CHOIR_CROWN_SEEDS,\n  NEUTRAL_BOSS_BASELINE,\n  enemyDamageScale,",
    "bossRegistry neutral seed import",
)
boss = sub_once(
    boss,
    r"function scaleBossBody\(unit: CombatUnit, wave: number\): CombatUnit \{.*?\n\}\n\nfunction genericEscorts",
    r'''function buildNeutralBossBody(ctx: BossBuildContext, def: BossDef): CombatUnit {
  const hullScale = enemyWaveScale(ctx.wave)
  const damageScale = enemyDamageScale(ctx.wave)
  const hull = NEUTRAL_BOSS_BASELINE.hull * hullScale * ehpMultForWave(ctx.wave)
  const shield = hull * NEUTRAL_BOSS_BASELINE.shieldFrac
  const pos = pointFromBearing(0, TYPICAL_SPAWN_RADIUS)
  return {
    id: `draft-boss-${def.id}`,
    side: 'enemy',
    name: def.name,
    shape: 'hex',
    family: '',
    familyStatus: 'pending',
    hostileId: undefined,
    bossId: def.id,
    hull,
    hullMax: hull,
    shield,
    shieldMax: shield,
    armor: NEUTRAL_BOSS_BASELINE.armor + BOSS_SCALING.armorAdd,
    evasion: 0,
    damageTakenMult: 1,
    weapons: [
      {
        id: `${def.id}-neutral-wpn`,
        name: `${def.name} strike`,
        damage: NEUTRAL_BOSS_BASELINE.damage * damageScale * BOSS_SCALING.damageMult,
        cooldown: NEUTRAL_BOSS_BASELINE.cooldown,
        cooldownLeft: 0.4,
        range: NEUTRAL_BOSS_BASELINE.range,
        tags: ['kinetic'],
        splash: 0,
        dotDuration: 0,
        dotDamage: 0,
        telegraphDuration: 0,
        telegraphLeft: 0,
      },
    ],
    isBoss: true,
    isFlagship: true,
    role: 'boss',
    dots: [],
    x: pos.x,
    y: pos.y,
    heading: 0,
    speed: NEUTRAL_BOSS_BASELINE.speed,
    authoredSpeed: NEUTRAL_BOSS_BASELINE.speed,
    authoredHullMax: hull,
    authoredShieldMax: shield,
    authoredArmor: NEUTRAL_BOSS_BASELINE.armor + BOSS_SCALING.armorAdd,
    engageRange: NEUTRAL_BOSS_BASELINE.engageRange,
    kite: NEUTRAL_BOSS_BASELINE.kite,
    phaseWarnLeft: 0,
    regenDelay: 0,
    rewardWeight: 1,
    resonanceArmed: false,
    deathHazardImmune: true,
    usesDevBaseline: false,
  }
}

function genericEscorts''',
    "bossRegistry neutral body builder",
)
boss = sub_once(
    boss,
    r"function buildStandardBoss\(ctx: BossBuildContext, def: BossDef\): CombatUnit\[\] \{\n  const leadId = .*?\n  const body = scaleBossBody\(buildHostileUnit\(\{ def: getHostileDef\(leadId\)!, wave: ctx\.wave \}\), ctx\.wave\)\n  body\.name = def\.name\n  body\.bossId = def\.id\n  body\.hostileId = undefined\n  body\.family = ''\n  body\.familyStatus = 'pending'",
    r'''function buildStandardBoss(ctx: BossBuildContext, def: BossDef): CombatUnit[] {
  const body = buildNeutralBossBody(ctx, def)''',
    "bossRegistry standard neutral body",
)
boss = replace_once(
    boss,
    "    blurb: def.mechanicSummary ?? `${def.name}. Unique mechanic pending design.`,",
    "    blurb: def.mechanicSummary ?? `${def.name}.`,",
    "bossRegistry production copy",
)
write("src/game/bossRegistry.ts", boss)

# D — dedicated Reconstruction shell nodes and bounded jam retry.
crown = read("src/game/choirCrown.ts")
crown = replace_once(
    crown,
    "import { CHOIR_CROWN_SEEDS } from './hostileSeeds'",
    "import {\n  CHOIR_CROWN_SEEDS,\n  CHOIR_CROWN_SHELL_NODE_BASELINE,\n  enemyWaveScale,\n} from './hostileSeeds'",
    "choirCrown shell seeds",
)
crown = sub_once(
    crown,
    r"function spawnSupport\(state: GameState, ids: string\[\], tag: string\): void \{.*?\n\}\n\nfunction reconstructionIds\(seed: number\): string\[\] \{.*?\n\}\n\nfunction loopbreakIds",
    r'''function spawnHostileSupport(state: GameState, ids: string[], tag: string): void {
  const pkg = bossPackage(state)
  if (!pkg) return
  const wave = 1000
  ids.forEach((id, i) => {
    const def = getHostileDef(id)
    if (!def) return
    const unit = buildHostileUnit({ def, wave })
    unit.isBossSupport = true
    unit.rewardWeight = 0.35
    const pos = pointFromBearing((i / Math.max(1, ids.length)) * Math.PI * 2, TYPICAL_SPAWN_RADIUS * 0.72)
    unit.x = pos.x
    unit.y = pos.y
    unit.heading = (i / Math.max(1, ids.length)) * Math.PI * 2
    unit.id = `draft-${tag}-${i}`
    admitUnitToPackage(state, pkg, unit)
  })
}

function buildShellNode(index: number): CombatUnit {
  const scale = enemyWaveScale(1000)
  const hull = CHOIR_CROWN_SHELL_NODE_BASELINE.hull * scale
  const shield = CHOIR_CROWN_SHELL_NODE_BASELINE.shield * scale
  const angle = (index / Math.max(1, CHOIR_CROWN_SEEDS.reconstructionNodes)) * Math.PI * 2
  const pos = pointFromBearing(angle, TYPICAL_SPAWN_RADIUS * 0.72)
  return {
    id: `draft-crown-shell-${index}`,
    side: 'enemy',
    name: 'Crown shell node',
    shape: 'hex',
    family: '',
    familyStatus: 'pending',
    hostileId: undefined,
    hull,
    hullMax: hull,
    shield,
    shieldMax: shield,
    armor: CHOIR_CROWN_SHELL_NODE_BASELINE.armor,
    evasion: 0,
    damageTakenMult: 1,
    weapons: [],
    isBoss: false,
    isBossSupport: true,
    isFlagship: false,
    dots: [],
    x: pos.x,
    y: pos.y,
    heading: angle,
    speed: CHOIR_CROWN_SHELL_NODE_BASELINE.speed,
    authoredSpeed: CHOIR_CROWN_SHELL_NODE_BASELINE.speed,
    authoredHullMax: hull,
    authoredShieldMax: shield,
    authoredArmor: CHOIR_CROWN_SHELL_NODE_BASELINE.armor,
    engageRange: CHOIR_CROWN_SHELL_NODE_BASELINE.engageRange,
    kite: true,
    phaseWarnLeft: 0,
    regenDelay: 0,
    rewardWeight: 0.25,
    deathHazardImmune: true,
    resonanceArmed: false,
    usesDevBaseline: false,
  }
}

function spawnShellNodes(state: GameState): void {
  const pkg = bossPackage(state)
  if (!pkg) return
  for (let i = 0; i < CHOIR_CROWN_SEEDS.reconstructionNodes; i++) {
    admitUnitToPackage(state, pkg, buildShellNode(i))
  }
}

function loopbreakIds''',
    "choirCrown shell nodes",
)
crown = replace_once(
    crown,
    "      spawnSupport(state, reconstructionIds(state.combat.sortieSeed ?? 1), 'crown-node')",
    "      spawnShellNodes(state)",
    "choirCrown reconstruction spawn",
)
crown = replace_once(
    crown,
    "      spawnSupport(state, loopbreakIds(state.combat.sortieSeed ?? 1), 'crown-front')",
    "      spawnHostileSupport(state, loopbreakIds(state.combat.sortieSeed ?? 1), 'crown-front')",
    "choirCrown loopbreak spawn",
)
crown = replace_once(
    crown,
    "  const cores = state.combat.playerUnits.filter((u) => u.isCore && u.coreModuleId)\n  if (cores.length === 0) return\n  const pick = cores[hashSeed(state.combat.sortieSeed ?? 1, Math.floor(state.combat.simTime ?? 0), 0x1a11) % cores.length]!\n  const id = pick.coreInstanceId ?? pick.id\n  if (state.combat.coreJams.some((j) => j.coreId === id)) return",
    "  const cores = state.combat.playerUnits.filter((u) => u.isCore && u.coreModuleId)\n  if (cores.length === 0) {\n    crown.jamCooldownLeft = CHOIR_CROWN_SEEDS.jamRetryDelay\n    return\n  }\n  const eligible = cores.filter((core) => {\n    const id = core.coreInstanceId ?? core.id\n    return !state.combat.coreJams.some((jam) => jam.coreId === id)\n  })\n  if (eligible.length === 0) {\n    crown.jamCooldownLeft = CHOIR_CROWN_SEEDS.jamRetryDelay\n    return\n  }\n  const pick = eligible[hashSeed(state.combat.sortieSeed ?? 1, Math.floor((state.combat.simTime ?? 0) * 10), 0x1a11) % eligible.length]!\n  const id = pick.coreInstanceId ?? pick.id",
    "choirCrown bounded jam selection",
)
write("src/game/choirCrown.ts", crown)

# E — neutral pending hostile silhouette instead of name-inferred shape identities.
hostiles = read("src/game/hostileCatalogue.ts")
start = hostiles.index("export const HOSTILE_DEFS")
end = hostiles.index("\n\nexport const HOSTILE_IDS", start)
block = hostiles[start:end]
block = re.sub(r", shape: '(?:triangle|square|diamond|hex|circle)'", "", block)
block = re.sub(r"^\s+shape: '(?:triangle|square|diamond|hex|circle)',\n", "", block, flags=re.M)
hostiles = hostiles[:start] + block + hostiles[end:]
write("src/game/hostileCatalogue.ts", hostiles)

# E — player Codex omits unauthored implementation facts.
codex = read("src/game/codex.ts")
codex = sub_once(
    codex,
    r"export function hostileCodexLines\(def: ReturnType<typeof getHostileDef>\): \{.*?\n\}\n\nexport function bossCodexLines",
    r'''export function hostileCodexLines(def: ReturnType<typeof getHostileDef>) {
  if (!def) {
    return {
      family: null,
      role: null,
      mechanic: null,
      profile: null,
      softCounter: null,
      telemetry: 'Insufficient encounter telemetry.',
    }
  }
  const family =
    def.familyStatus === 'authored' && def.family
      ? def.family.charAt(0).toUpperCase() + def.family.slice(1)
      : null
  const role = def.roleStatus === 'authored' && def.role ? 'Elite' : null
  const mechanic =
    def.mechanicStatus === 'authored' && def.mechanicSummary ? def.mechanicSummary : null
  const profile = def.role === 'elite' ? 'Durable elite contact.' : null
  const softCounter =
    def.mechanicId === 'death-position-hazard'
      ? 'Soft answers: kill at range; Barrier/Bulwark if the hazard reaches the Hive.'
      : def.mechanicId === 'partial-shield-bypass-spike'
        ? 'Soft answers: interrupt during charge; Barrier, Ablative, Damage Control.'
        : def.role === 'elite'
          ? 'Soft answers: Heavy, Armor Penetration, Focus. Multiple legitimate paths.'
          : null
  const telemetry = family || role || mechanic || profile || softCounter
    ? null
    : 'Insufficient encounter telemetry.'
  return { family, role, mechanic, profile, softCounter, telemetry }
}

export function bossCodexLines''',
    "codex hostile player copy",
)
codex = sub_once(
    codex,
    r"export function bossCodexLines\(bossId: string\): \{.*?\n\}\n$",
    r'''export function bossCodexLines(bossId: string) {
  const def = getBossDef(bossId)
  if (!def) {
    return {
      name: 'Unknown',
      wave: 0,
      mechanic: null,
      profile: null,
      softAnswer: null,
      telemetry: 'Insufficient encounter telemetry.',
    }
  }
  const authored = def.mechanicStatus === 'authored' && Boolean(def.mechanicSummary)
  return {
    name: def.name,
    wave: def.wave,
    mechanic: authored ? def.mechanicSummary : null,
    profile: authored ? 'Proper Boss encounter with observed phase changes.' : 'Proper Boss encounter.',
    softAnswer:
      def.id === 'choir-crown'
        ? 'Soft answers: Shield breakers in Convergence; Armor/Heavy in Reconstruction; responsive fire-control in Loopbreak.'
        : null,
    telemetry: authored ? null : 'Insufficient encounter telemetry.',
  }
}
''',
    "codex boss player copy",
)
write("src/game/codex.ts", codex)

# E — render only fields that are actually authored/observed.
ui = read("src/components/tabs/CodexTab.tsx")
ui = replace_once(
    ui,
    "                    const lines = hostileCodexLines(row.def)\n                    return (",
    "                    const lines = hostileCodexLines(row.def)\n                    const taxonomy = [lines.family, lines.role].filter((value): value is string => Boolean(value)).join(' · ')\n                    return (",
    "CodexTab hostile taxonomy",
)
ui = replace_once(
    ui,
    "                          <p className=\"muted\">{lines.family} · {lines.role}</p>\n                          <p>{lines.mechanic}</p>\n                          <p className=\"muted\">{lines.profile}</p>\n                          <p>{lines.softCounter}</p>",
    "                          {taxonomy ? <p className=\"muted\">{taxonomy}</p> : null}\n                          {lines.mechanic ? <p>{lines.mechanic}</p> : null}\n                          {lines.profile ? <p className=\"muted\">{lines.profile}</p> : null}\n                          {lines.softCounter ? <p>{lines.softCounter}</p> : null}\n                          {lines.telemetry ? <p className=\"muted\">{lines.telemetry}</p> : null}",
    "CodexTab hostile optional lines",
)
ui = replace_once(
    ui,
    "                          <p>{lines.mechanic}</p>\n                          <p className=\"muted\">{lines.profile}</p>\n                          <p>{lines.softAnswer}</p>",
    "                          {lines.mechanic ? <p>{lines.mechanic}</p> : null}\n                          {lines.profile ? <p className=\"muted\">{lines.profile}</p> : null}\n                          {lines.softAnswer ? <p>{lines.softAnswer}</p> : null}\n                          {lines.telemetry ? <p className=\"muted\">{lines.telemetry}</p> : null}",
    "CodexTab boss optional lines",
)
write("src/components/tabs/CodexTab.tsx", ui)

# F — breaking-redesign teardown in combat.ts.
combat = read("src/game/combat.ts")
combat = combat.replace("  EnemyRole,\n", "")
combat = sub_once(
    combat,
    r"\n/\*\* Leftover alias used by retired sector-pacing tests\. \*/\nexport function enemySectorScale.*?export const SALVAGE_MID_EXPONENT = 0\.5\n",
    "\n",
    "combat old sector constants",
)
combat = sub_once(
    combat,
    r"\nexport const CODEX_ROLES:.*?export function familyShape\(_family: EnemyFamily\): UnitShape \{\n  return 'circle'\n\}\n",
    "\n",
    "combat old Codex exports",
)
combat = replace_once(
    combat,
    "        summary: u.isBoss\n          ? 'Proper Boss encounter.'\n          : familyIntel((u.family as EnemyFamily) || 'swarm'),",
    "        summary: u.isBoss ? 'Proper Boss encounter.' : 'Recorded hostile contact.',",
    "combat wave roster neutral summary",
)
write("src/game/combat.ts", combat)

# A/F — reservation records actual Commander threat; no metadata/no-op call.
scheduler = read("src/game/waveScheduler.ts")
scheduler = replace_once(
    scheduler,
    "import { commanderThreatShare, shouldReserveCommander, reserveCommander } from './commanders'",
    "import { shouldReserveCommander, reserveCommander } from './commanders'",
    "waveScheduler Commander import",
)
scheduler = scheduler.replace("      void commanderThreatShare(wave)\n", "")
write("src/game/waveScheduler.ts", scheduler)

# H — PR7 records the durable W1000 milestone but does not launch PR11 finale UI.
clear = read("src/game/bossClear.ts")
clear = replace_once(
    clear,
    "    if (!state.meta.act1Cleared) {\n      state.meta.act1Cleared = true\n      state.meta.act1FinalePending = true\n    }",
    "    if (!state.meta.act1Cleared) state.meta.act1Cleared = true",
    "bossClear PR11 boundary",
)
write("src/game/bossClear.ts", clear)

# G — retire the PR7 test that activated legacy Challenge density.
hostile_test = read("src/game/hostiles-act1.test.ts")
hostile_test = sub_once(
    hostile_test,
    r"\ndescribe\('PR7 density hooks'.*?\n\}\)\n$",
    r'''

describe('PR7 encounter modifier boundary', () => {
  it('does not consume legacy Challenge density from PR7 generation', () => {
    const baseline = createInitialState(0)
    baseline.combat.sortieSeed = 17
    const legacy = createInitialState(0)
    legacy.combat.sortieSeed = 17
    legacy.protocols.activeId = 'mute-network'
    const normal = encounterForWave(20, 1, baseline)
    const stillBaseline = encounterForWave(20, 1, legacy)
    expect(stillBaseline.units.length).toBe(normal.units.length)
    expect(stillBaseline.threat?.spent).toBeCloseTo(normal.threat?.spent ?? 0, 6)
  })
})
''',
    "hostiles retired density test",
)
write("src/game/hostiles-act1.test.ts", hostile_test)

# Adjacent implementation note only; canonical doc is intentionally untouched.
doc = read("docs/hostiles-commanders-bosses-codex.md")
doc = doc.replace(
    "Existing Challenge (`protocolEnemyDensityMult`) and Directive (`directiveDensityMult`) multipliers scale ordinary pack count and Commander escort count only. PR8/PR10 own those systems; PR7 does not invent Challenge rules. Cap seed: `DENSITY_COUNT_MAX = 14`.",
    "PR7 generation runs at canonical baseline pressure. A neutral typed encounter-modifier provider defaults to identity and is available for later PR8/PR10 wiring; PR7 does not consume legacy Directive/Protocol density implementations. Count safety seed: `DENSITY_COUNT_MAX = 14`.",
)
doc = doc.replace(
    "Traits: vanguard, ironclad, wardbearer, rallying, displacer, suppressor, volatile, breacher.",
    "Traits: vanguard, ironclad, wardbearer, rallying, displacer, suppressor, volatile, breacher. While family compatibility remains pending, generated pairings are explicitly provisional runtime selections, not authored compatibility claims.",
)
doc = doc.replace(
    "HOSTILES | BOSSES. Discovery on actual spawn. Unlock ~W30 with retroactive W1+ records. Save version **48**. No `seenFamilies` migration.",
    "HOSTILES | BOSSES. Discovery on actual spawn. Unlock ~W30 with retroactive W1+ records. Pending hostile silhouettes use one neutral circle rather than name-inferred identities. Player copy omits implementation-status language. Save version **48**. No `seenFamilies` migration.",
)
write("docs/hostiles-commanders-bosses-codex.md", doc)

# Focused A–H tests.
write("src/game/pr7-corrections.test.ts", r'''import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createInitialState } from './state'
import {
  encounterForWave,
  formationDispersionWeight,
  resetEncounterModifierProvider,
} from './encounterGenerator'
import { packDps, packEhp, packThreat, threatBudgetForWave } from './threatBudget'
import {
  buildCommanderPackage,
  planCommanderEvent,
  promoteToCommander,
} from './commanders'
import {
  applyCommanderDerivedStats,
  movementSpeed,
} from './commanderTraits'
import {
  buildHostileUnit,
  getHostileDef,
  HOSTILE_DEFS,
} from './hostileCatalogue'
import {
  COMMANDER_PROMOTION,
  COMMANDER_SELF_THREAT_SHARE,
  COMMANDER_WAVE_THREAT_MULT,
  CHOIR_CROWN_SEEDS,
  VANGUARD_SEEDS,
} from './hostileSeeds'
import { productionBossProvider, BOSS_DEFS } from './bossRegistry'
import { tickChoirCrown } from './choirCrown'
import {
  admitUnitToPackage,
  createWavePackage,
  packageHasLivingOrPending,
} from './waveRuntime'
import { bossCodexLines, hostileCodexLines } from './codex'
import { bossClearMilestoneId, recordBossClearSources } from './bossClear'
import * as combatExports from './combat'
import type { CombatUnit, GameState } from './types'

function stateForSeed(seed: number): GameState {
  const state = createInitialState(0)
  state.combat.sortieSeed = seed
  state.combat.packages = []
  return state
}

function commanderFrom(
  trait: 'vanguard' | 'wardbearer' | 'rallying',
  wave = 200,
): CombatUnit {
  const def = getHostileDef('void-mite')!
  return promoteToCommander(buildHostileUnit({ def, wave }), trait, def)
}

afterEach(() => resetEncounterModifierProvider())

describe('PR7 correction A — controlled threat budgets', () => {
  it('keeps ordinary same-Wave seeds tightly budgeted and broadly comparable', () => {
    for (const wave of [41, 201, 401, 601]) {
      const rows = Array.from({ length: 24 }, (_, seed) => encounterForWave(wave, 1, stateForSeed(seed + 1)))
      const spent = rows.map((row) => row.threat!.spent)
      const ehp = rows.map((row) => packEhp(row.units))
      const dps = rows.map((row) => packDps(row.units))
      for (const value of spent) {
        expect(value / threatBudgetForWave(wave)).toBeGreaterThanOrEqual(0.98)
        expect(value / threatBudgetForWave(wave)).toBeLessThanOrEqual(1.02)
      }
      expect(Math.max(...ehp) / Math.min(...ehp)).toBeLessThan(1.35)
      expect(Math.max(...dps) / Math.min(...dps)).toBeLessThan(1.35)
    }
  })

  it('targets Commander Waves at 1.30–1.50x and enforces Commander self share', () => {
    for (const wave of [40, 290, 740, 890]) {
      for (const seed of [1, 7, 19, 43]) {
        const row = encounterForWave(wave, 1, stateForSeed(seed))
        const ratio = row.threat!.spent / threatBudgetForWave(wave)
        expect(ratio).toBeGreaterThanOrEqual(1.3)
        expect(ratio).toBeLessThanOrEqual(1.5)
        expect(row.threat!.budget / threatBudgetForWave(wave)).toBeCloseTo(COMMANDER_WAVE_THREAT_MULT, 6)
        const commander = row.units.find((unit) => unit.isCommander)!
        const selfShare = packThreat([commander]) / packThreat(row.units)
        expect(selfShare).toBeCloseTo(COMMANDER_SELF_THREAT_SHARE, 2)
      }
    }
  })
})

describe('PR7 correction B — Commander eligibility and runtime', () => {
  it('keeps first-contact collisions ordinary and promotes only already-known hostiles', () => {
    for (const wave of [30, 140, 290, 740]) {
      const row = encounterForWave(wave, 1, stateForSeed(wave + 3))
      const commander = row.units.find((unit) => unit.isCommander)!
      const commanderDef = getHostileDef(commander.hostileId)!
      expect(commanderDef.firstContactWave).toBeLessThan(wave)
      const contact = HOSTILE_DEFS.find((def) => def.firstContactWave === wave)!
      expect(row.units.some((unit) => !unit.isCommander && unit.hostileId === contact.id)).toBe(true)
    }
  })

  it('marks pending compatibility as provisional rather than authored', () => {
    const plan = planCommanderEvent(290, 17)
    const def = getHostileDef(plan.hostileId)!
    expect(def.traitCompatibilityStatus).toBe('pending')
    expect(def.traitCompatibility).toBeNull()
    expect(plan.compatibilityStatus).toBe('provisional')
    expect(JSON.stringify(hostileCodexLines(def))).not.toMatch(/compatib/i)
  })

  it('applies Vanguard effective self-speed exactly once', () => {
    const def = getHostileDef('void-mite')!
    const base = buildHostileUnit({ def, wave: 20 })
    const baseSpeed = base.speed
    const commander = promoteToCommander(base, 'vanguard', def)
    const state = createInitialState(0)
    state.combat.enemyUnits = [commander]
    applyCommanderDerivedStats(state)
    expect(movementSpeed(commander)).toBeCloseTo(
      baseSpeed * COMMANDER_PROMOTION.pending.speed * VANGUARD_SEEDS.selfSpeedMult,
      8,
    )
  })

  it('resolves same-Trait auras per recipient and clears stale Wardbearer Shield', () => {
    const state = createInitialState(0)
    const vStrong = commanderFrom('vanguard')
    const vWeak = commanderFrom('vanguard')
    vStrong.id = 'v-strong'
    vWeak.id = 'v-weak'
    vStrong.x = 0; vStrong.y = 0; vStrong.hullMax *= 2
    vWeak.x = 300; vWeak.y = 0
    const nearStrong = buildHostileUnit({ def: getHostileDef('void-mite')!, wave: 200 })
    const nearWeak = buildHostileUnit({ def: getHostileDef('void-mite')!, wave: 200 })
    nearStrong.id = 'ally-a'; nearStrong.x = 20; nearStrong.y = 0
    nearWeak.id = 'ally-b'; nearWeak.x = 280; nearWeak.y = 0
    state.combat.enemyUnits = [vStrong, vWeak, nearStrong, nearWeak]
    applyCommanderDerivedStats(state)
    expect(nearStrong.commanderSpeedMult).toBeCloseTo(VANGUARD_SEEDS.auraSpeedMult, 8)
    expect(nearWeak.commanderSpeedMult).toBeCloseTo(VANGUARD_SEEDS.auraSpeedMult, 8)

    const ward = commanderFrom('wardbearer')
    ward.id = 'ward'; ward.x = 0; ward.y = 0
    nearStrong.x = 20; nearStrong.y = 0
    state.combat.enemyUnits = [ward, nearStrong]
    applyCommanderDerivedStats(state)
    expect(nearStrong.supportShieldMax ?? 0).toBeGreaterThan(0)
    expect(nearStrong.supportShield ?? 0).toBeGreaterThan(0)
    nearStrong.x = 500
    applyCommanderDerivedStats(state)
    expect(nearStrong.supportShieldMax).toBe(0)
    expect(nearStrong.supportShield).toBe(0)
  })
})

describe('PR7 correction C/D — neutral Bosses and Choir Crown support', () => {
  it('keeps every pending non-Crown Boss body neutral across seeds', () => {
    for (const wave of [700, 750, 800, 950]) {
      let signature: unknown = null
      for (const seed of [1, 2, 7, 19, 41]) {
        const spec = productionBossProvider({ wave, seed })!
        const body = spec.units.find((unit) => unit.isBoss)!
        expect(body.hostileId).toBeUndefined()
        expect(body.resonanceArmed).toBeFalsy()
        expect(body.volatileArmed).toBeFalsy()
        expect(body.role).toBe('boss')
        expect(body.weapons.some((weapon) => (weapon.shieldBypassFrac ?? 0) > 0)).toBe(false)
        const current = {
          hull: body.hullMax,
          shield: body.shieldMax,
          armor: body.armor,
          damage: body.weapons[0]?.damage,
          cooldown: body.weapons[0]?.cooldown,
          tags: body.weapons[0]?.tags,
        }
        if (signature == null) signature = current
        else expect(current).toEqual(signature)
      }
    }
    expect(BOSS_DEFS.filter((def) => def.id !== 'choir-crown').every((def) => def.mechanicStatus === 'pending')).toBe(true)
  })

  it('uses dedicated shell nodes that block W1000 package security', () => {
    const state = createInitialState(0)
    state.combat.docked = false
    state.combat.inFight = true
    state.combat.sortieSeed = 7
    state.combat.enemyUnits = []
    const pkg = createWavePackage(state, 1000, 'boss', 0)
    state.combat.packages = [pkg]
    const spec = productionBossProvider({ wave: 1000, seed: 7 })!
    for (const [index, source] of spec.units.entries()) {
      const unit = structuredClone(source)
      unit.id = `crown-base-${index}`
      admitUnitToPackage(state, pkg, unit)
    }
    const boss = state.combat.enemyUnits.find((unit) => unit.bossId === 'choir-crown')!
    boss.hull = boss.hullMax * CHOIR_CROWN_SEEDS.reconstructionHullFrac
    tickChoirCrown(state, 0.05)
    const shells = state.combat.enemyUnits.filter((unit) => unit.name === 'Crown shell node')
    expect(shells).toHaveLength(CHOIR_CROWN_SEEDS.reconstructionNodes)
    for (const shell of shells) {
      expect(shell.isBossSupport).toBe(true)
      expect(shell.hostileId).toBeUndefined()
      expect(shell.resonanceArmed).toBeFalsy()
      expect(shell.weapons).toHaveLength(0)
    }
    for (const unit of state.combat.enemyUnits) {
      if (!shells.includes(unit)) unit.hull = 0
    }
    expect(packageHasLivingOrPending(state, pkg)).toBe(true)
    shells.forEach((shell) => { shell.hull = 0 })
    expect(packageHasLivingOrPending(state, pkg)).toBe(false)
  })

  it('backs off jam selection when every eligible Core is already jammed', () => {
    const state = createInitialState(0)
    const cores = state.combat.playerUnits.filter((unit) => unit.isCore && unit.coreModuleId)
    state.combat.coreJams = cores.map((core) => ({
      coreId: core.coreInstanceId ?? core.id,
      telegraphLeft: 0,
      jamLeft: 1,
    }))
    state.combat.choirCrown = {
      phase: 'loopbreak',
      phaseStartedAt: 0,
      reconstructionSpawned: true,
      loopbreakSpawned: true,
      jamCooldownLeft: 0,
    }
    const spec = productionBossProvider({ wave: 1000, seed: 11 })!
    state.combat.enemyUnits = spec.units.map((unit, index) => ({ ...unit, id: `jam-${index}` }))
    tickChoirCrown(state, 0.01)
    const count = state.combat.coreJams.length
    expect(state.combat.choirCrown.jamCooldownLeft).toBeGreaterThan(0)
    tickChoirCrown(state, 0.01)
    expect(state.combat.coreJams).toHaveLength(count)
    expect(state.combat.choirCrown.jamCooldownLeft).toBeGreaterThan(0)
  })
})

describe('PR7 correction E/F/G/H — presentation and boundaries', () => {
  it('keeps implementation-status language out of production Codex and uses neutral pending silhouettes', () => {
    for (const def of HOSTILE_DEFS) {
      const text = JSON.stringify(hostileCodexLines(def))
      expect(text).not.toMatch(/pending design|pending authored|mechanic pending/i)
      expect(def.shape).toBe('circle')
    }
    for (const def of BOSS_DEFS) {
      expect(JSON.stringify(bossCodexLines(def.id))).not.toMatch(/pending design|pending authored|role-aware durability seed/i)
    }
  })

  it('removes retired combat compatibility exports and legacy density imports', () => {
    for (const key of [
      'enemySectorScale',
      'ENEMY_EARLY_SECTOR',
      'ENEMY_MID_SECTOR',
      'ENEMY_OPENING_SECTOR',
      'ENEMY_HULL_BASE',
      'ENEMY_HULL_OPENING',
      'ENEMY_HULL_EARLY',
      'ENEMY_HULL_MID',
      'ENEMY_HULL_LATE',
      'ENEMY_DMG_BASE',
      'ENEMY_DMG_OPENING',
      'ENEMY_DMG_EARLY',
      'ENEMY_DMG_MID',
      'ENEMY_DMG_LATE',
      'ENEMY_WAVE_HULL_RAMP',
      'SALVAGE_MID_EXPONENT',
      'CODEX_ROLES',
      'roleIntel',
      'familyIntel',
      'softCounterForFamily',
      'familyShape',
    ]) {
      expect(key in combatExports).toBe(false)
    }
    const source = readFileSync(new URL('./encounterGenerator.ts', import.meta.url), 'utf8')
    expect(source).not.toContain('directiveDensityMult')
    expect(source).not.toContain('protocolEnemyDensityMult')
    expect(source).not.toContain("from './directives'")
    expect(source).not.toContain("from './protocols'")
  })

  it('records W1000 exactly once without opening PR11 finale/Reinforce flow', () => {
    const state = createInitialState(0)
    const ascension = state.meta.ascensionCount
    const rebuilds = state.prestige.prestigeCount
    recordBossClearSources(state, 1000)
    recordBossClearSources(state, 1000)
    expect(state.meta.act1Cleared).toBe(true)
    expect(Boolean(state.meta.act1FinalePending)).toBe(false)
    expect(state.codex.milestones.filter((id) => id === bossClearMilestoneId(1000))).toHaveLength(1)
    expect(state.codex.milestones.filter((id) => id === 'act1-boss-clear')).toHaveLength(1)
    expect(state.meta.ascensionCount).toBe(ascension)
    expect(state.prestige.prestigeCount).toBe(rebuilds)
  })
})
''')

print('PR7 correction transformations applied successfully')
