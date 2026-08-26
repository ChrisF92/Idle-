import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats, SAVE_VERSION } from './state'
import { buyMatterShop, performRebuild } from './actions'
import { canBuyMatterShop, droneCap, shopRank } from './catalog'
import { exportSave, importSave } from './save'
import { armRebuildDoor } from './testHelpers'
import {
  MATTER_SHOP,
  TIME_COMPRESSION_I_COST,
  TIME_COMPRESSION_II_COST,
  TIME_COMPRESSION_III_COST,
  reconstitutionStartingScrap,
  weaponCalibrationMult,
} from './matter'

describe('canonical Matter shop', () => {
  it('has twelve nodes and exact Time Compression costs', () => {
    expect(MATTER_SHOP.map((row) => row.id)).toEqual([
      'weapon-calibration',
      'traverse-actuators',
      'structural-memory',
      'field-memory',
      'recovery-charter',
      'foundry-throughput',
      'worker-racks',
      'reconstitution-cache',
      'sortie-provisioning',
      'time-compression-1',
      'time-compression-2',
      'time-compression-3',
    ])
    expect(MATTER_SHOP.find((row) => row.id === 'time-compression-1')?.costs).toEqual([TIME_COMPRESSION_I_COST])
    expect(MATTER_SHOP.find((row) => row.id === 'time-compression-2')?.costs).toEqual([TIME_COMPRESSION_II_COST])
    expect(MATTER_SHOP.find((row) => row.id === 'time-compression-3')?.costs).toEqual([TIME_COMPRESSION_III_COST])
    expect(MATTER_SHOP.some((row) => /blade|forge|tempo|clock|kit|plating/.test(row.id))).toBe(false)
  })

  it('Weapon Calibration raises weapon-Core output and persists across Rebuild', () => {
    let state = armRebuildDoor(createInitialState(0))
    state.resources.prestigeMatter = 4
    const bankedDamage = computeShipStats(state).damage
    state = buyMatterShop(state, 'weapon-calibration')
    expect(shopRank(state.prestige.matterShop, 'weapon-calibration')).toBe(1)
    expect(state.resources.prestigeMatter).toBe(0)
    expect(weaponCalibrationMult(state)).toBeCloseTo(1.04)
    expect(computeShipStats(state).damage).toBeGreaterThan(bankedDamage)
    state = performRebuild(state, { frameId: state.shipyard.frameId, modules: state.shipyard.modules })
    expect(shopRank(state.prestige.matterShop, 'weapon-calibration')).toBe(1)
  })

  it('rejects purchase without enough Matter', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 2
    state = buyMatterShop(state, 'weapon-calibration')
    expect(shopRank(state.prestige.matterShop, 'weapon-calibration')).toBe(0)
    expect(state.resources.prestigeMatter).toBe(2)
  })

  it('Worker Racks raise capacity without fabricating Workers', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 5
    const before = droneCap(state)
    const workers = state.base.workerDrones
    state = buyMatterShop(state, 'worker-racks')
    expect(droneCap(state)).toBe(before + 1)
    expect(state.base.workerDrones).toBe(workers)
  })

  it('Reconstitution Cache grants starting Scrap that is not cycle-generated', () => {
    let state = armRebuildDoor(createInitialState(0))
    state.resources.prestigeMatter = 5
    state = buyMatterShop(state, 'reconstitution-cache')
    expect(reconstitutionStartingScrap(state)).toBe(24)
    state = performRebuild(state, { frameId: state.shipyard.frameId, modules: state.shipyard.modules })
    expect(state.resources.scrap).toBe(24)
    expect(state.prestige.cycle.scrapGenerated).toBe(0)
  })

  it('cannot buy Time Compression II before I', () => {
    const state = createInitialState(0)
    state.resources.prestigeMatter = 200
    expect(canBuyMatterShop(state, 'time-compression-2').ok).toBe(false)
    expect(canBuyMatterShop(state, 'time-compression-3').ok).toBe(false)
  })

  it('round-trips Matter ranks on a current-version save', () => {
    const state = createInitialState(0)
    state.prestige.matterShop = { 'weapon-calibration': 2, 'time-compression-1': 1 }
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(state))))
    const loaded = importSave(code)
    expect(loaded).not.toBeNull()
    expect(loaded!.version).toBe(SAVE_VERSION)
    expect(shopRank(loaded!.prestige.matterShop, 'weapon-calibration')).toBe(2)
    expect(shopRank(loaded!.prestige.matterShop, 'time-compression-1')).toBe(1)
    const again = importSave(exportSave(loaded!))
    expect(shopRank(again!.prestige.matterShop, 'weapon-calibration')).toBe(2)
  })
})
