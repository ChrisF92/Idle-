import { describe, expect, it } from 'vitest'
import {
  GDD_ROSTER_CORE_IDS,
  getBlueprint,
  getModule,
  isFarmableModule,
  isGddRosterCore,
  LEGACY_CORE_IDS,
  listFarmableCores,
  listFoundryPrintCards,
} from './catalog'
import { FOUNDRY_PANE_LABELS } from './foundry'
import { FOUNDRY_LOGS } from './logs'
import { createInitialState } from './state'
import { atCareerWave, forceUnlockModule } from './testHelpers'
import { ACT1_CADENCE } from './cadence'

const LEFTOVER_CORES = [...LEGACY_CORE_IDS]

describe('GDD Core roster and acquisition', () => {
  it('exposes the final 14 Cores as Blueprints without leftover print IDs', () => {
    const late = atCareerWave(createInitialState(0), 400)
    const ids = listFarmableCores(late).map((mod) => mod.id)
    for (const id of GDD_ROSTER_CORE_IDS) {
      expect(isGddRosterCore(id)).toBe(true)
      expect(isFarmableModule(id)).toBe(true)
      expect(getBlueprint(id)?.id).toBe(id)
    }
    expect(ids.every((id) => (GDD_ROSTER_CORE_IDS as readonly string[]).includes(id))).toBe(true)
    for (const id of LEFTOVER_CORES) {
      expect(isGddRosterCore(id)).toBe(false)
      expect(ids).not.toContain(id)
      expect(getBlueprint(id)).toBeUndefined()
    }
  })

  it('does not restore leftover Core identities even after a test grant', () => {
    let s = atCareerWave(createInitialState(0), 300)
    s = forceUnlockModule(s, 'rail-driver')
    expect(getModule('rail-driver')).toBeUndefined()
    expect(listFarmableCores(s).some((mod) => mod.id === 'rail-driver')).toBe(false)
  })

  it('keeps four Foundry panes; Blueprint discovery is not physical ownership', () => {
    const log = FOUNDRY_LOGS.find((entry) => entry.id === 'core-prints')
    expect(log?.body).toMatch(/equip the Core at Dock/i)
    expect(log?.body).not.toMatch(/Rebuild to equip/)
    expect(FOUNDRY_PANE_LABELS).toEqual({
      processing: 'Processing',
      fabrication: 'Fabrication',
      mastery: 'Mastery',
      blueprints: 'Blueprints',
    })
    const s = atCareerWave(createInitialState(0), 80)
    expect(getBlueprint('flak-array')?.id).toBe('flak-array')
    expect(s.shipyard.coreInstances.some((row) => row.moduleId === 'flak-array')).toBe(false)
  })

  it('does not show Foundry cards before the Foundry door', () => {
    const early = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry - 1)
    expect(listFarmableCores(early)).toEqual([])
    expect(listFoundryPrintCards(early)).toEqual([])
  })
})
