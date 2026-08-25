import { describe, expect, it } from 'vitest'
import { assembleBlueprint, canAssembleBlueprint } from './actions'
import {
  canDropModulePart,
  getBlueprint,
  GDD_ROSTER_CORE_IDS,
  isGddRosterCore,
  listFarmableCores,
  listFoundryPrintCards,
  formatPrintSourceLine,
  modulePrintWave,
  PART_TYPES,
  partId,
} from './catalog'
import { claimFoundryCompletions, FOUNDRY_PANE_LABELS, tickFoundry } from './foundry'
import { FOUNDRY_LOGS } from './logs'
import { createInitialState } from './state'
import { atCareerWave, forceUnlockModule } from './testHelpers'

const LEFTOVER_CORES = [
  'rail-driver',
  'ion-burst',
  'swarm-rack',
  'arc-lash',
  'slag-spit',
  'lattice-ward',
  'ablative-mesh',
  'keel-baffle',
  'vector-thruster',
  'grav-tether',
  'sensor-whisker',
  'salvage-rig',
]

describe('GDD Core roster and acquisition', () => {
  it('hides leftover Cores from Foundry Blueprints on a fresh career', () => {
    const late = atCareerWave(createInitialState(0), 300)
    const ids = listFarmableCores(late).map((mod) => mod.id)
    expect(ids).toEqual(expect.arrayContaining(['flak-array', 'phase-beam', 'heavy-lance', 'barrier-projector']))
    for (const id of LEFTOVER_CORES) {
      expect(isGddRosterCore(id)).toBe(false)
      expect(ids).not.toContain(id)
      expect(canDropModulePart(late, id)).toBe(false)
    }
    for (const id of GDD_ROSTER_CORE_IDS) {
      if (id === 'pulse-cannon' || id === 'plate-layer') continue
      expect(ids).toContain(id)
    }
  })

  it('still lists a leftover Core after it is already unlocked', () => {
    let s = atCareerWave(createInitialState(0), 300)
    s = forceUnlockModule(s, 'rail-driver')
    expect(listFarmableCores(s).some((mod) => mod.id === 'rail-driver')).toBe(true)
  })

  it('tells the player to fabricate then equip at Dock, including mid-Sortie', () => {
    const log = FOUNDRY_LOGS.find((entry) => entry.id === 'core-prints')
    expect(log?.body).toMatch(/equip the Core at Dock/i)
    expect(log?.body).not.toMatch(/Rebuild to equip/)
    expect(FOUNDRY_PANE_LABELS).toEqual({
      processing: 'Processing',
      fabrication: 'Fabrication',
      mastery: 'Mastery',
      blueprints: 'Blueprints',
    })

    let s = atCareerWave(createInitialState(0), 80)
    s.combat.docked = false
    const recipe = getBlueprint('flak-array')
    expect(recipe).toBeTruthy()
    if (!recipe) return
    for (const pt of PART_TYPES) {
      s.parts[partId('flak-array', pt)] = recipe[pt]
    }
    expect(canAssembleBlueprint(s, 'flak-array').ok).toBe(true)
    s = assembleBlueprint(s, 'flak-array')
    expect(s.foundry.fabrication[0]?.kind).toBe('core')
    expect(s.shipyard.unlockedModules.includes('flak-array')).toBe(false)
    tickFoundry(s, 12 * 60 + 5)
    expect(s.foundry.pendingCores).toContain('flak-array')
    expect(s.shipyard.unlockedModules.includes('flak-array')).toBe(false)
    s.combat.docked = true
    claimFoundryCompletions(s)
    expect(s.shipyard.unlockedModules).toContain('flak-array')
    expect(s.foundry.pendingCores).not.toContain('flak-array')
  })

  it('shows upcoming GDD prints with drop Wave and family at Foundry unlock', () => {
    const early = atCareerWave(createInitialState(0), 20)
    expect(listFarmableCores(early).map((m) => m.id)).toEqual(
      expect.arrayContaining(['flak-array', 'heavy-lance']),
    )
    const cards = listFoundryPrintCards(early)
    expect(cards.map((m) => m.id)).toEqual(expect.arrayContaining(['flak-array', 'heavy-lance', 'phase-beam']))
    for (const id of LEFTOVER_CORES) {
      expect(cards.some((m) => m.id === id)).toBe(false)
    }
    expect(formatPrintSourceLine('flak-array')).toMatch(/Swarm · Wave \d+\+/)
    expect(formatPrintSourceLine('heavy-lance')).toMatch(/Armored · Wave \d+\+/)
    expect(modulePrintWave('flak-array')).toBeGreaterThanOrEqual(20)
    expect(formatPrintSourceLine('flak-array')).not.toMatch(/fragments do not drop/i)
  })
})
