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

const LEFTOVER_CORES = [...LEGACY_CORE_IDS]

describe('GDD Core roster and acquisition', () => {
  it('does not farm the final 14 Cores through leftover Foundry prints', () => {
    const late = atCareerWave(createInitialState(0), 400)
    const ids = listFarmableCores(late).map((mod) => mod.id)
    expect(ids).toEqual([])
    for (const id of GDD_ROSTER_CORE_IDS) {
      expect(isGddRosterCore(id)).toBe(true)
      expect(isFarmableModule(id)).toBe(false)
      expect(getBlueprint(id)).toBeUndefined()
    }
    for (const id of LEFTOVER_CORES) {
      expect(isGddRosterCore(id)).toBe(false)
      expect(ids).not.toContain(id)
    }
  })

  it('does not restore leftover Core identities even after a test grant', () => {
    let s = atCareerWave(createInitialState(0), 300)
    s = forceUnlockModule(s, 'rail-driver')
    expect(getModule('rail-driver')).toBeUndefined()
    expect(listFarmableCores(s).some((mod) => mod.id === 'rail-driver')).toBe(false)
  })

  it('keeps leftover Foundry pane labels without leftover-print fabrication of final Cores', () => {
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
    expect(getBlueprint('flak-array')).toBeUndefined()
    expect(s.shipyard.unlockedModules).not.toContain('flak-array')
  })

  it('does not show leftover Foundry cards for the final 14 Cores', () => {
    const early = atCareerWave(createInitialState(0), 20)
    expect(listFarmableCores(early)).toEqual([])
    const cards = listFoundryPrintCards(early)
    for (const id of GDD_ROSTER_CORE_IDS) {
      expect(cards.some((m) => m.id === id)).toBe(false)
    }
    for (const id of LEFTOVER_CORES) {
      expect(cards.some((m) => m.id === id)).toBe(false)
    }
  })
})
