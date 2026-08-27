/**
 * Boss-clear source / milestone provider.
 *
 * Distinguishes authored source events from fully implemented downstream
 * systems (PR5 Blueprints, PR6 Relics, PR8 Furnace).
 */

import type { GameState } from './types'
import { bossDefForWave, type BossDef, type BossSourceKind } from './bossRegistry'
import { recordBossClearId, recordCodexMilestone } from './codex'
import { grantDirectMaterial } from './foundryRecovery'
import { W950_CROWN_MATRIX_GRANT } from './hostileSeeds'
import { getRelicFamily } from './relicCatalogue'

export const RELIC_ROUTE_WAVES = [400, 550, 600, 650, 700, 800, 850] as const

export const RELIC_ROUTE_FAMILY: Record<number, string> = {
  400: 'aegis-relay',
  550: 'prismatic-lens',
  600: 'phase-needle',
  650: 'penetrator-guide',
  700: 'salvage-matrix',
  800: 'fixed-mount',
  850: 'universal-resonator',
}

export function bossClearMilestoneId(wave: number): string {
  return `boss-cleared:w${wave}`
}

export function recordBossClearSources(state: GameState, wave: number): void {
  const def = bossDefForWave(wave)
  if (!def) return
  const key = bossClearMilestoneId(wave)
  if (state.codex?.milestones.includes(key)) return
  recordCodexMilestone(state, key)
  recordBossClearId(state, def.id)
  recordCodexMilestone(state, `boss-source:${def.sourceKind}`)
  applyPendingDownstream(state, def)
}

function applyPendingDownstream(state: GameState, def: BossDef): void {
  if (def.sourceKind === 'furnace-unlock') {
    recordCodexMilestone(state, 'furnace-unlock-source')
    return
  }
  if (def.sourceKind === 'reactor-choir-tap') {
    recordCodexMilestone(state, 'choir-tap-progression-source')
    return
  }
  if (def.sourceKind === 'advanced-resources') {
    recordCodexMilestone(state, 'advanced-resources-source')
    return
  }
  if (def.sourceKind === 'crown-signal') {
    recordCodexMilestone(state, 'crown-signal')
    return
  }
  if (def.sourceKind === 'crown-matrix') {
    recordCodexMilestone(state, 'crown-matrix-source')
    grantDirectMaterial(state, 'crown-matrix', W950_CROWN_MATRIX_GRANT)
    return
  }
  if (def.sourceKind === 'act1-complete') {
    recordCodexMilestone(state, 'act1-boss-clear')
    if (!state.meta.act1Cleared) state.meta.act1Cleared = true
    return
  }
  if (RELIC_ROUTE_WAVES.includes(def.wave as (typeof RELIC_ROUTE_WAVES)[number])) {
    const familyId = RELIC_ROUTE_FAMILY[def.wave]
    const family = familyId ? getRelicFamily(familyId) : undefined
    recordCodexMilestone(state, `relic-route:${familyId ?? def.wave}`)
    if (family) {
      recordCodexMilestone(
        state,
        `relic-pending:${family.id}:socket=${family.socketStatus}:effect=${family.effectStatus}:fab=${family.fabricationStatus}`,
      )
    }
  }
}

export function relicRouteRemainsPending(wave: number): boolean {
  const familyId = RELIC_ROUTE_FAMILY[wave]
  if (!familyId) return true
  const family = getRelicFamily(familyId)
  if (!family) return true
  return (
    family.socketStatus === 'pending' &&
    family.effectStatus === 'pending' &&
    family.fabricationStatus === 'pending-design'
  )
}

export function furnaceUnlockIsSourceOnly(state: GameState): boolean {
  return ensureCodexHas(state, 'furnace-unlock-source')
}

function ensureCodexHas(state: GameState, id: string): boolean {
  return (state.codex?.milestones ?? []).includes(id)
}

export const BOSS_SOURCE_TABLE: { wave: number; kind: BossSourceKind; implemented: string }[] = [
  { wave: 50, kind: 'foundry-flak', implemented: 'PR5 wave-secure Blueprint (Flak). PR7 records boss-cleared:w50.' },
  { wave: 100, kind: 'heavy-lance', implemented: 'PR5 wave-secure Blueprint (Heavy Lance).' },
  { wave: 150, kind: 'grav-tether', implemented: 'PR5 wave-secure Blueprint (Grav Tether).' },
  { wave: 200, kind: 'slag-spitter', implemented: 'PR5 wave-secure Blueprint (Slag Spitter).' },
  { wave: 250, kind: 'phase-beam', implemented: 'PR5 wave-secure Blueprint (Phase Beam).' },
  { wave: 300, kind: 'sensor-array', implemented: 'PR5 wave-secure Blueprint (Sensor Array).' },
  { wave: 350, kind: 'barrier-projector', implemented: 'PR5 wave-secure Blueprint (Barrier Projector).' },
  { wave: 400, kind: 'aegis-relay-route', implemented: 'Milestone only. Relic remains pending-design (PR6).' },
  { wave: 450, kind: 'furnace-unlock', implemented: 'Milestone only. Final Furnace is PR8.' },
  { wave: 500, kind: 'reactor-choir-tap', implemented: 'PR5 Reactor Blueprint + Choir Tap source milestone. No physical Choir Tap.' },
  { wave: 550, kind: 'prismatic-lens-route', implemented: 'Milestone only. Relic pending-design.' },
  { wave: 600, kind: 'phase-needle-route', implemented: 'Milestone only. Relic pending-design.' },
  { wave: 650, kind: 'penetrator-guide-route', implemented: 'Milestone only. Relic pending-design.' },
  { wave: 700, kind: 'salvage-matrix-route', implemented: 'Milestone only. Relic pending-design.' },
  { wave: 750, kind: 'advanced-resources', implemented: 'Milestone only.' },
  { wave: 800, kind: 'fixed-mount-route', implemented: 'Milestone only. Relic pending-design.' },
  { wave: 850, kind: 'universal-resonator-route', implemented: 'Milestone only. Relic pending-design.' },
  { wave: 900, kind: 'crown-signal', implemented: 'Milestone only. No new currency.' },
  { wave: 950, kind: 'crown-matrix', implemented: 'Milestone + Crown Matrix grant seed. Existing material, not a 13th type.' },
  { wave: 1000, kind: 'act1-complete', implemented: 'Act 1 boss-clear milestone. No Act 2 / Reinforce reset.' },
]
