/** Data-driven Core Mastery milestones. Authored effects only — no invented +10% fillers. */

import { getModule } from './catalog'
import { moduleMasteryRank } from './catalog'
import type { GameState, RelicSocketClass, RelicSocketSpec } from './types'

export const MASTERY_MILESTONE_LEVELS = [5, 10, 20, 30, 50, 75, 100] as const

export type MasteryEffectId =
  | 'pulse-overkill-retarget'
  | 'pulse-periodic-chain'
  | 'pulse-chain-continue'
  | 'pulse-adaptive-lock'
  | 'pulse-convergence'
  | 'heavy-predictive-traverse'
  | 'heavy-pierce'
  | 'heavy-shield-bypass'
  | 'heavy-pen-momentum'
  | 'heavy-armor-fracture'
  | 'flak-pack-prediction'
  | 'flak-fragmentation'
  | 'flak-death-detonation'
  | 'flak-saturation'
  | 'flak-kill-box'
  | 'phase-ramp'
  | 'phase-refraction'
  | 'phase-ramp-bypass'
  | 'phase-lock-memory'
  | 'phase-exposure'
  | 'slag-molten-pool'
  | 'slag-corrosion'
  | 'slag-spread'
  | 'slag-pool-merge'
  | 'plate-citadel-skin'
  | 'aegis-perpetual'
  | 'ablative-deferral'
  | 'barrier-rearm'
  | 'grav-gravity-well'
  | 'sensor-fire-control'
  | 'choir-hot-recovery'
  | 'choir-furnace-feed'
  | 'socket-expand'

export interface MasteryMilestoneDef {
  level: number
  name: string
  blurb: string
  /** Authored gameplay effect. Absent = pending design slot. */
  effect?: MasteryEffectId
  damageMult?: number
  cooldownMult?: number
  rangeAdd?: number
  shieldMult?: number
  regenAdd?: number
  splashAdd?: number
  salvageKillAdd?: number
  runScaleMult?: number
  socket?: RelicSocketClass
  pending?: boolean
}

function pending(level: number, name: string, blurb: string): MasteryMilestoneDef {
  return { level, name, blurb, pending: true }
}

function socketExpand(socket: RelicSocketClass): MasteryMilestoneDef {
  return {
    level: 20,
    name: 'Relic Capability',
    blurb: 'Meaningful Relic socket capability expands.',
    effect: 'socket-expand',
    socket,
  }
}

export const CORE_MASTERY_MILESTONES: Record<string, MasteryMilestoneDef[]> = {
  'pulse-cannon': [
    pending(5, 'Pulse Identity', 'Identity/stat slot. Numeric magnitude is not authored.'),
    {
      level: 10,
      name: 'Overkill Retarget',
      blurb: 'Leftover damage after a kill seeks another legal target.',
      effect: 'pulse-overkill-retarget',
    },
    socketExpand('optical'),
    {
      level: 30,
      name: 'Chain',
      blurb: 'Periodic chain hop to a nearby hull.',
      effect: 'pulse-periodic-chain',
    },
    {
      level: 50,
      name: 'Chain Continuation',
      blurb: 'Bounded extra hop after a chain connect.',
      effect: 'pulse-chain-continue',
    },
    {
      level: 75,
      name: 'Adaptive Lock',
      blurb: 'Retains lock more readily while the target remains legal.',
      effect: 'pulse-adaptive-lock',
    },
    {
      level: 100,
      name: 'Convergence',
      blurb: 'Bounded fork/chain at capstone.',
      effect: 'pulse-convergence',
    },
  ],
  'heavy-lance': [
    pending(5, 'Lance Identity', 'Identity/stat slot. Numeric magnitude is not authored.'),
    {
      level: 10,
      name: 'Predictive Traverse',
      blurb: 'Slew leads the target’s motion.',
      effect: 'heavy-predictive-traverse',
    },
    socketExpand('power'),
    { level: 30, name: 'Pierce', blurb: 'Shots pierce through the primary hull.', effect: 'heavy-pierce' },
    {
      level: 50,
      name: 'Shield Bypass',
      blurb: 'A portion of output ignores Shield.',
      effect: 'heavy-shield-bypass',
    },
    {
      level: 75,
      name: 'Penetration Momentum',
      blurb: 'Pierce carries extra force into the next hull.',
      effect: 'heavy-pen-momentum',
    },
    {
      level: 100,
      name: 'Armor Fracture',
      blurb: 'Fractures Armor for the whole Hive’s output.',
      effect: 'heavy-armor-fracture',
    },
  ],
  'flak-array': [
    pending(5, 'Flak Identity', 'Identity/stat slot. Numeric magnitude is not authored.'),
    {
      level: 10,
      name: 'Pack Prediction',
      blurb: 'Cluster scoring leads pack motion.',
      effect: 'flak-pack-prediction',
    },
    socketExpand('power'),
    {
      level: 30,
      name: 'Fragmentation',
      blurb: 'Bursts throw extra fragments.',
      effect: 'flak-fragmentation',
    },
    {
      level: 50,
      name: 'Death Detonation',
      blurb: 'Bounded explosion when a tagged hull dies.',
      effect: 'flak-death-detonation',
    },
    { level: 75, name: 'Saturation', blurb: 'Denser burst pattern.', effect: 'flak-saturation' },
    {
      level: 100,
      name: 'Kill Box',
      blurb: 'Airburst detonates in the densest legal cluster.',
      effect: 'flak-kill-box',
    },
  ],
  'phase-beam': [
    pending(5, 'Beam Identity', 'Identity/stat slot. Numeric magnitude is not authored.'),
    {
      level: 10,
      name: 'Ramp',
      blurb: 'Output grows while contact is maintained over several seconds.',
      effect: 'phase-ramp',
    },
    socketExpand('power'),
    {
      level: 30,
      name: 'Refraction',
      blurb: 'A fraction of the beam glances to a nearby hull.',
      effect: 'phase-refraction',
    },
    {
      level: 50,
      name: 'Ramping Shield Bypass',
      blurb: 'Ramp also increases Shield Bypass.',
      effect: 'phase-ramp-bypass',
    },
    {
      level: 75,
      name: 'Lock Memory',
      blurb: 'Partial ramp is remembered after a brief break.',
      effect: 'phase-lock-memory',
    },
    {
      level: 100,
      name: 'Exposure',
      blurb: 'Max-ramp contact exposes the target to follow-up fire.',
      effect: 'phase-exposure',
    },
  ],
  'slag-spitter': [
    pending(5, 'Slag Identity', 'Identity/stat slot. Numeric magnitude is not authored.'),
    pending(10, 'Slag Behaviour', 'No M10 behaviour is authored.'),
    socketExpand('power'),
    {
      level: 30,
      name: 'Molten Pool',
      blurb: 'Impact leaves a Molten Pool (radius seed 35).',
      effect: 'slag-molten-pool',
    },
    {
      level: 50,
      name: 'Corrosion',
      blurb: 'Slag lowers effective Armor.',
      effect: 'slag-corrosion',
    },
    {
      level: 75,
      name: 'Bounded Spread',
      blurb: 'Pools can spread a short, bounded distance.',
      effect: 'slag-spread',
    },
    {
      level: 100,
      name: 'Pool Merging',
      blurb: 'Overlapping pools merge up to a cap.',
      effect: 'slag-pool-merge',
    },
  ],
  'plate-layer': [
    pending(5, 'Plate Identity', 'Large predictable Shield bank. Numeric M5 is not authored.'),
    pending(10, 'Impact Bracing', 'Later Plate behaviour. Threshold is not authored.'),
    socketExpand('shield'),
    pending(30, 'Bypass Protection', 'Later Plate behaviour. Threshold is not authored.'),
    pending(50, 'Break Replate', 'Shield-break Temporary Armor / recovery replate. Threshold is not authored.'),
    pending(75, 'Recovery Replate', 'Later Plate behaviour. Threshold is not authored.'),
    {
      level: 100,
      name: 'Citadel Skin',
      blurb: 'Capstone Shield skin. Not Hull regeneration.',
      effect: 'plate-citadel-skin',
    },
  ],
  'rapid-aegis': [
    pending(5, 'Aegis Identity', 'Recovery specialist. Numeric M5 is not authored.'),
    pending(10, 'Regen Ramp', 'Later Aegis behaviour. Threshold is not authored.'),
    socketExpand('universal'),
    pending(30, 'Small-Hit Resilience', 'Later Aegis behaviour. Threshold is not authored.'),
    pending(50, 'Break Recovery', 'Later Aegis behaviour. Threshold is not authored.'),
    pending(75, 'Overflow Buffer', 'Later Aegis behaviour. Threshold is not authored.'),
    {
      level: 100,
      name: 'Perpetual Aegis',
      blurb: 'Recovery loop capstone. Not a second Plate Layer.',
      effect: 'aegis-perpetual',
    },
  ],
  'ablative-mesh': [
    pending(5, 'Mesh Identity', 'Hull/Armor/spike survival. Numeric M5 is not authored.'),
    pending(10, 'Ablative Layer', 'Periodic layer is a base identity. Later thresholds are not authored.'),
    socketExpand('industrial'),
    pending(30, 'Spike Mitigation', 'Later Mesh behaviour. Threshold is not authored.'),
    pending(50, 'Temp Armor After Layer', 'Later Mesh behaviour. Threshold is not authored.'),
    pending(75, 'Regrowth', 'Later Mesh behaviour. Threshold is not authored.'),
    {
      level: 100,
      name: 'Damage Deferral',
      blurb: 'Bounded damage deferral. Not immunity.',
      effect: 'ablative-deferral',
    },
  ],
  'barrier-projector': [
    pending(5, 'Barrier Identity', 'Reactive emergency defense. Numeric M5 is not authored.'),
    pending(10, 'Break Pulse', 'Shield-break slow pulse is base identity. Later thresholds are not authored.'),
    socketExpand('optical'),
    pending(30, 'Emergency Barrier', 'Low-Hull barrier is base identity. Threshold is not authored.'),
    pending(50, 'Lethal Intercept', 'Long-cooldown intercept is base identity. Threshold is not authored.'),
    pending(75, 'Stabilisation', 'Later Barrier behaviour. Threshold is not authored.'),
    {
      level: 100,
      name: 'Weaker Re-arm',
      blurb: 'Successful recovery re-arms a weaker intercept.',
      effect: 'barrier-rearm',
    },
  ],
  'salvage-beacon': [
    pending(5, 'Beacon Identity', 'Visible marks. Marked kills pay extra Salvage.'),
    pending(10, 'Elite Bounty', 'Elite/Commander bounty. Threshold is not authored.'),
    socketExpand('optical'),
    pending(30, 'Deterministic Cache', 'Later Beacon behaviour. Threshold is not authored.'),
    pending(50, 'Two Marks', 'Later Beacon behaviour. Threshold is not authored.'),
    pending(75, 'Group Sweep', 'Later Beacon behaviour. Threshold is not authored.'),
    pending(100, 'Beacon Capstone', 'Capstone is not authored beyond the mark architecture.'),
  ],
  'grav-tether': [
    pending(5, 'Tether Identity', 'Slow and drag on real 2D positions.'),
    pending(10, 'Twin Tether', 'Later Grav behaviour. Threshold is not authored.'),
    socketExpand('industrial'),
    pending(30, 'Mass Bias', 'Later Grav behaviour. Threshold is not authored.'),
    pending(50, 'Control Field', 'Later Grav behaviour. Threshold is not authored.'),
    pending(75, 'Formation Hold', 'Later Grav behaviour. Threshold is not authored.'),
    {
      level: 100,
      name: 'Gravity Well',
      blurb: 'Bounded gravity well. No permanent hard lock.',
      effect: 'grav-gravity-well',
    },
  ],
  'nano-lathe': [
    pending(5, 'Lathe Identity', 'In-combat Hull repair. Numeric M5 is not authored.'),
    pending(10, 'Triage', 'Low-Hull triage is base identity. Threshold is not authored.'),
    socketExpand('shield'),
    pending(30, 'Temp Armor Overflow', 'Excess repair → Temporary Armor is base identity. Threshold is not authored.'),
    pending(50, 'Shield Crossfeed', 'Later Lathe behaviour. Threshold is not authored.'),
    pending(75, 'Critical Burst', 'Later Lathe behaviour. Threshold is not authored.'),
    pending(100, 'Lathe Capstone', 'Capstone is not authored beyond in-combat repair.'),
  ],
  'sensor-array': [
    pending(5, 'Sensor Identity', 'Acquisition and slew support.'),
    pending(10, 'Pre-slew', 'Later Sensor behaviour. Threshold is not authored.'),
    socketExpand('industrial'),
    pending(30, 'Predictive Solution', 'Later Sensor behaviour. Threshold is not authored.'),
    pending(50, 'Overkill Forecast', 'Later Sensor behaviour. Threshold is not authored.'),
    pending(75, 'Shared Tracks', 'Later Sensor behaviour. Threshold is not authored.'),
    {
      level: 100,
      name: 'Fire-Control Network',
      blurb: 'Capstone targeting network. Still composed through PR2 modifiers.',
      effect: 'sensor-fire-control',
    },
  ],
  'choir-tap': [
    pending(5, 'Tap Identity', 'Ash / Furnace economy. Numeric M5 is not authored.'),
    pending(10, 'Resonance', 'Commander/Boss resonance. Threshold is not authored.'),
    socketExpand('power'),
    {
      level: 30,
      name: 'Hot Recovery',
      blurb: 'High-value Choir/Commander/Boss recovery can grant a bounded Heat packet this Sortie.',
      effect: 'choir-hot-recovery',
    },
    {
      level: 50,
      name: 'Furnace Feed',
      blurb: 'Ash→Heat conversion while fitted is more efficient this Sortie. Does not change an Ignited Furnace.',
      effect: 'choir-furnace-feed',
    },
    pending(75, 'Resonant Mark', 'Later Tap behaviour. Threshold is not authored.'),
    pending(100, 'Boss Harvest', 'Deterministic Boss harvest. Threshold details are not authored.'),
  ],
}

export function masteryMilestonesFor(moduleId: string): MasteryMilestoneDef[] {
  return CORE_MASTERY_MILESTONES[moduleId] ?? []
}

export function isMasteryMilestone(moduleId: string, level: number): boolean {
  return masteryMilestonesFor(moduleId).some((ms) => ms.level === level)
}

export function nextMasteryMilestone(
  moduleId: string,
  mastery: number,
): MasteryMilestoneDef | null {
  return masteryMilestonesFor(moduleId).find((ms) => ms.level > mastery) ?? null
}

export function unlockedMasteryMilestones(
  moduleId: string,
  mastery: number,
): MasteryMilestoneDef[] {
  return masteryMilestonesFor(moduleId).filter((ms) => mastery >= ms.level)
}

export function hasMasteryEffect(
  state: Pick<GameState, 'meta'>,
  moduleId: string,
  effect: MasteryEffectId,
): boolean {
  const mastery = moduleMasteryRank(state, moduleId)
  return masteryMilestonesFor(moduleId).some(
    (ms) => ms.effect === effect && mastery >= ms.level && !ms.pending,
  )
}

export function fittedHasMasteryEffect(
  state: GameState,
  effect: MasteryEffectId,
): boolean {
  return (state.shipyard.modules ?? []).some((id) => hasMasteryEffect(state, id, effect))
}

const SOCKET_EFFECT_LABEL: Record<RelicSocketClass, string> = {
  power: 'Power',
  optical: 'Optical',
  ballistic: 'Ballistic',
  shield: 'Shield',
  industrial: 'Industrial',
  universal: 'Universal',
}

export function masteryMilestoneEffect(ms: MasteryMilestoneDef): string {
  if (ms.pending) return `${ms.blurb} (awaiting authored values)`
  if (ms.effect === 'socket-expand' && ms.socket) {
    return `Relic capability expands · ${SOCKET_EFFECT_LABEL[ms.socket]}`
  }
  return ms.blurb
}

/** Mature layout from the Core definition. Unlock schedule is not fully authored. */
export function matureSocketLayout(moduleId: string): RelicSocketSpec[] {
  return getModule(moduleId)?.matureSockets ?? []
}

/**
 * M20 is the canonical point at which meaningful Relic capability expands.
 * Exact later socket-count unlocks are not authored — do not invent them.
 */
export function unlockedSocketLayout(moduleId: string, mastery: number): RelicSocketSpec[] {
  const mature = matureSocketLayout(moduleId)
  if (mature.length === 0) return []
  if (mastery < 20) return mature.slice(0, 1)
  return mature.slice(0, Math.min(2, mature.length))
}
