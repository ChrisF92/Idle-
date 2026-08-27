import { describe, expect, it } from 'vitest'
import {
  CORE_MASTERY_MILESTONES,
  masteryMilestoneEffect,
  masteryMilestonesFor,
} from './coreProgression'
import { FURNACE_CHANNELS, furnaceChannelEffectLine } from './furnace'
import { FOUNDRY_PANE_LABELS, materialMasteryRank } from './foundry'
import { FOUNDRY_FACILITIES, FOUNDRY_MATERIAL_IDS } from './foundryCatalogue'
import { MATERIAL_MASTERY_MAX_RANK } from './foundrySeeds'
import { createInitialState } from './state'
import { HIVE_RESEARCH_NODES, hiveResearchNodeEffectLine } from './hiveResearch'
import { protocolHookEffect } from './protocols'
import { RUN_UPGRADES, runUpgradeEffectLine } from './workshop'

describe('upgrade copy is quantitative', () => {
  it('formats Plate Layer mastery from authored slots, not invented percents', () => {
    const plate = masteryMilestonesFor('plate-layer')
    expect(masteryMilestoneEffect(plate.find((ms) => ms.level === 5)!)).toMatch(/awaiting authored/)
    expect(masteryMilestoneEffect(plate.find((ms) => ms.level === 10)!)).toMatch(/awaiting authored/)
    expect(masteryMilestoneEffect(plate.find((ms) => ms.level === 20)!)).toMatch(/Relic capability expands/)
    expect(masteryMilestoneEffect(plate.find((ms) => ms.level === 100)!)).toMatch(/Capstone Shield skin/)
  })

  it('formats every authored Core mastery from its fields', () => {
    for (const [id, list] of Object.entries(CORE_MASTERY_MILESTONES)) {
      for (const ms of list) {
        const line = masteryMilestoneEffect(ms)
        expect(line.length, `${id} M${ms.level}`).toBeGreaterThan(0)
        expect(line).not.toMatch(/evolves|understood|Synergy|thicken the bank|scale harder/i)
        if (ms.pending) {
          expect(line, `${id} M${ms.level}`).toMatch(/awaiting authored/)
        } else if (ms.effect === 'socket-expand') {
          expect(line, `${id} M${ms.level}`).toMatch(/Relic capability/)
        } else {
          expect(line, `${id} M${ms.level}`).toBe(ms.blurb)
        }
      }
    }
  })

  it('states Workshop / Sortie shop per-rank amounts', () => {
    for (const def of RUN_UPGRADES) {
      const line = runUpgradeEffectLine(def.id)
      expect(line.length, def.id).toBeGreaterThan(0)
      expect(line).toMatch(/per rank|1\.06\^rank/)
      expect(line).not.toMatch(/more damage|more often|withstands|refills faster/i)
    }
    expect(runUpgradeEffectLine('weapon-power')).toBe('Weapon-Core output ×1.08 per rank')
    expect(runUpgradeEffectLine('shield-regen')).toBe('Shield regen +0.4%/s per rank')
  })

  it('states Material Mastery as M0→M5 rather than 100 recipe levels', () => {
    expect(MATERIAL_MASTERY_MAX_RANK).toBe(5)
    expect(FOUNDRY_MATERIAL_IDS).toHaveLength(12)
    expect(Object.values(FOUNDRY_PANE_LABELS)).toEqual(['Processing', 'Fabrication', 'Mastery', 'Blueprints'])
    const s = createInitialState(0)
    expect(materialMasteryRank(s, 'recovered-stock')).toBe(0)
  })

  it('states Hive Research, Challenge, Furnace, and Yard amounts', () => {
    const keel = HIVE_RESEARCH_NODES.energy.find((n) => n.name === 'Keel Bay')!
    expect(hiveResearchNodeEffectLine(keel)).toMatch(/Utility Core slots \+1/)
    expect(hiveResearchNodeEffectLine(keel)).toMatch(/Mastery gates −2/)
    const corps = HIVE_RESEARCH_NODES.observation.find((n) => n.name === 'Worker Calibration')!
    expect(hiveResearchNodeEffectLine(corps)).toBe('Worker contribution +12%')
    expect(protocolHookEffect({ kind: 'networkExponent', add: 0.02 })).toBe('Network exponent +0.02')
    expect(protocolHookEffect({ kind: 'furnaceDrain', mult: 0.88 })).toBe('Channel Heat cost ×0.88')
    const weapons = FURNACE_CHANNELS.find((ch) => ch.id === 'weapons')!
    expect(furnaceChannelEffectLine(weapons)).toBe('Weapon Output ×1.40 / ×1.80 / ×2.50')
    expect(FOUNDRY_FACILITIES.map((row) => row.id)).toEqual([
      'processing-line',
      'fabrication-bay',
      'worker-fabricator',
      'research-annex',
      'recovery-storage',
    ])
    expect(FOUNDRY_FACILITIES[0]?.effect).toMatch(/Processing slot/)
  })
})
