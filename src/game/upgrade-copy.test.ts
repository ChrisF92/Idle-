import { describe, expect, it } from 'vitest'
import {
  CORE_MASTERY_MILESTONES,
  masteryMilestoneEffect,
  masteryMilestonesFor,
} from './coreProgression'
import { FURNACE_CHANNELS, furnaceChannelEffectLine } from './furnace'
import { FOUNDRY_MASTERY_STEPS, FOUNDRY_UPGRADES, foundryMasteryEffect } from './foundry'
import { HIVE_RESEARCH_NODES, hiveResearchNodeEffectLine } from './hiveResearch'
import { protocolHookEffect } from './protocols'
import { RUN_UPGRADES, runUpgradeEffectLine } from './workshop'
import { YARD_ARMS, yardArmEffect } from './yard'

describe('upgrade copy is quantitative', () => {
  it('formats Plate Layer mastery from the numbers', () => {
    const plate = masteryMilestonesFor('plate-layer')
    expect(masteryMilestoneEffect(plate.find((ms) => ms.level === 5)!)).toBe('Shield ×1.12')
    expect(masteryMilestoneEffect(plate.find((ms) => ms.level === 10)!)).toBe('Regen +2%/s')
    expect(masteryMilestoneEffect(plate.find((ms) => ms.level === 20)!)).toBe('+1 Shield Relic socket')
    expect(masteryMilestoneEffect(plate.find((ms) => ms.level === 30)!)).toBe('Core Level scaling ×1.10')
    expect(masteryMilestoneEffect(plate.find((ms) => ms.level === 50)!)).toBe('Shield ×1.15 · Regen +2%/s')
    expect(masteryMilestoneEffect(plate.find((ms) => ms.level === 75)!)).toBe('Damage ×1.06 · Shield ×1.06')
    expect(masteryMilestoneEffect(plate.find((ms) => ms.level === 100)!)).toBe(
      'Damage ×1.10 · Shield ×1.08 · Core Level scaling ×1.08',
    )
  })

  it('formats every authored Core mastery from its fields', () => {
    for (const [id, list] of Object.entries(CORE_MASTERY_MILESTONES)) {
      for (const ms of list) {
        const line = masteryMilestoneEffect(ms)
        expect(line.length, `${id} M${ms.level}`).toBeGreaterThan(0)
        expect(line).not.toMatch(/evolves|understood|Synergy|thicken the bank|scale harder/i)
        expect(line).toMatch(/×|\+|RoF|Range|Splash|socket|Regen|Salvage|Damage|Shield|Core Level/)
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

  it('states Foundry recipe mastery and shop ranks as numbers', () => {
    expect(foundryMasteryEffect(FOUNDRY_MASTERY_STEPS[0]!)).toBe('Recipe available')
    expect(foundryMasteryEffect(FOUNDRY_MASTERY_STEPS[1]!)).toBe('Output +1 per craft')
    expect(foundryMasteryEffect(FOUNDRY_MASTERY_STEPS[3]!)).toBe('Craft cost ×0.82')
    expect(foundryMasteryEffect(FOUNDRY_MASTERY_STEPS[4]!)).toBe('Output ×2')
    expect(foundryMasteryEffect(FOUNDRY_MASTERY_STEPS[7]!)).toBe('Craft time ×0.70 · Output +2')
    expect(FOUNDRY_UPGRADES).toEqual([])
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
    expect(YARD_ARMS).toEqual([])
    expect(yardArmEffect('processing-line')).toMatch(/Processing slot/)
  })
})
