import { describe, expect, it } from 'vitest'
import { performRebuild } from './actions'
import { tickAutomation } from './automation'
import { canFitModuleOnFrame, getFrame } from './catalog'
import { foundryMasteryStepsFor, foundryRecipeGateNeed, foundrySlotCount, getFoundryRecipe } from './foundry'
import { furnaceChannelSlots } from './furnace'
import {
  HIVE_RESEARCH_BRANCHES,
  HIVE_RESEARCH_FOCUS_MULT,
  HIVE_RESEARCH_NODES,
  HIVE_RESEARCH_NODES_PER_BRANCH,
  RESEARCH_PREVIEW,
  RESEARCH_QUEUE_BASE,
  grantHiveResearchKillXp,
  hiveResearchApproachingBreakthrough,
  hiveResearchDamageMult,
  hiveResearchDroneEffMult,
  hiveResearchExtraUtilitySlots,
  hiveResearchFitSlots,
  hiveResearchFoundrySlots,
  hiveResearchFurnaceSlots,
  hiveResearchInfiniteReduce,
  hiveResearchMasteryReduce,
  hiveResearchNextBreakthrough,
  hiveResearchNodeCost,
  hiveResearchOffFocusMult,
  hiveResearchProtocolXpMult,
  hiveResearchQueueCap,
  hiveResearchSalvageMult,
  hiveResearchShieldMult,
  hiveResearchUnlocksRelay,
  hiveResearchUnlocksReliquary,
  hiveResearchUpcoming,
  hiveResearchXp,
  isResearchBreakthrough,
  isResearchBreakthroughIndex,
} from './hiveResearch'
import { inspectCopyCorpus, inspectResearchBranch } from './inspect'
import { isNetworkBarUnlocked, networkRawFillRate } from './network'
import {
  GUIDE_STEPS,
  NETWORK_GUIDE_IDS,
  RESEARCH_V2_GUIDE_IDS,
  STARTER_GUIDE_IDS,
  activeGuideStep,
  guideBodyLines,
  skipOnboarding,
} from './progression'
import { isReliquarySlotUnlocked } from './reliquary'
import { exportSave, importSave } from './save'
import { createInitialState, SAVE_VERSION } from './state'
import type { GameState, HiveResearchBranch } from './types'

const JARGON = /USI|ITRTG|analogue|black-bar/i

function atResearch(sector = 34): GameState {
  const s = createInitialState(0)
  s.meta.highestSectorEver = sector
  s.combat.highestSector = sector
  s.combat.sector = sector
  return s
}

function complete(state: GameState, branch: HiveResearchBranch, n: number): void {
  state.hiveResearch.completed[branch] = n
}

describe('Research milestones: nodes and identity', () => {
  it('keeps three named branches and nine nodes with breakthroughs at 2 / 5 / 8', () => {
    expect(HIVE_RESEARCH_BRANCHES.map((b) => b.id)).toEqual(['material', 'energy', 'observation'])
    expect(HIVE_RESEARCH_NODES_PER_BRANCH).toBe(9)
    expect(RESEARCH_PREVIEW).toBe(3)
    for (const branch of HIVE_RESEARCH_BRANCHES) {
      const nodes = HIVE_RESEARCH_NODES[branch.id]
      expect(nodes).toHaveLength(9)
      for (let i = 0; i < nodes.length; i++) {
        expect(isResearchBreakthroughIndex(i)).toBe(i === 2 || i === 5 || i === 8)
        expect(isResearchBreakthrough(nodes[i]!)).toBe(i === 2 || i === 5 || i === 8)
      }
    }
    expect(HIVE_RESEARCH_NODES.material[2]?.name).toBe('Second Smelter Bay')
    expect(HIVE_RESEARCH_NODES.energy[2]?.name).toBe('Extra Tap')
    expect(HIVE_RESEARCH_NODES.observation[2]?.name).toBe('Second Desk')
    expect(HIVE_RESEARCH_NODES.material[5]?.name).toBe('Pattern Floor')
    expect(HIVE_RESEARCH_NODES.energy[5]?.name).toBe('Corps Draw')
    expect(HIVE_RESEARCH_NODES.observation[5]?.name).toBe('Blue Bay')
    expect(HIVE_RESEARCH_NODES.material[8]?.name).toBe('Keel Bay')
    expect(HIVE_RESEARCH_NODES.energy[8]?.name).toBe('Relay Sight')
    expect(HIVE_RESEARCH_NODES.observation[8]?.name).toBe('Queue Hall')
  })

  it('previews the next three discoveries including the first breakthrough from rank 0', () => {
    const s = atResearch()
    const upcoming = hiveResearchUpcoming(s, 'energy')
    expect(upcoming.map((row) => row.node.name)).toEqual(['Ward Current', 'Ash Kindling', 'Extra Tap'])
    expect(hiveResearchNextBreakthrough(s, 'energy')?.node.name).toBe('Extra Tap')
    expect(hiveResearchNextBreakthrough(s, 'energy')?.index).toBe(2)
    expect(hiveResearchApproachingBreakthrough(s)).toBe(false)
    complete(s, 'energy', 2)
    expect(hiveResearchApproachingBreakthrough(s)).toBe(true)
  })

  it('zero completed nodes stay identity', () => {
    const s = atResearch()
    expect(hiveResearchDamageMult(s)).toBe(1)
    expect(hiveResearchShieldMult(s)).toBe(1)
    expect(hiveResearchSalvageMult(s)).toBe(1)
    expect(hiveResearchFurnaceSlots(s)).toBe(0)
    expect(hiveResearchFoundrySlots(s)).toBe(0)
    expect(hiveResearchFitSlots(s)).toBe(0)
    expect(hiveResearchMasteryReduce(s)).toBe(0)
    expect(hiveResearchInfiniteReduce(s)).toBe(0)
    expect(hiveResearchDroneEffMult(s)).toBe(1)
    expect(hiveResearchOffFocusMult(s)).toBe(1)
    expect(hiveResearchQueueCap(s)).toBe(RESEARCH_QUEUE_BASE)
    expect(hiveResearchProtocolXpMult(s)).toBe(1)
    expect(hiveResearchExtraUtilitySlots(s)).toBe(0)
    expect(furnaceChannelSlots(s)).toBe(1)
    expect(foundrySlotCount(s)).toBe(1)
    expect(isNetworkBarUnlocked(s, 'strike-relay')).toBe(true)
    expect(isReliquarySlotUnlocked(s, 'blue')).toBe(false)
  })
})

describe('Research milestones: costs', () => {
  it('keeps SAVE_VERSION at 34 and an achievable first node', () => {
    expect(SAVE_VERSION).toBe(34)
    const s = atResearch()
    expect(hiveResearchNodeCost(0)).toBe(52)
    expect(hiveResearchNodeCost(0, s)).toBe(52)
  })

  it('grows smoothly with a modest bump on breakthroughs, without a 6400 wall', () => {
    const costs = Array.from({ length: 9 }, (_, i) => hiveResearchNodeCost(i))
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]!).toBeGreaterThan(costs[i - 1]!)
    }
    expect(costs[2]!).toBeGreaterThan(Math.floor(52 * Math.pow(1.5, 2)))
    expect(costs[8]!).toBeLessThan(2500)
    expect(costs[8]!).toBeLessThan(6400)
  })
})

describe('Research milestones: breakthrough wiring', () => {
  it('Material Second Smelter Bay adds a Foundry slot, not damage', () => {
    const s = atResearch()
    complete(s, 'material', 3)
    expect(hiveResearchFoundrySlots(s)).toBe(1)
    expect(foundrySlotCount(s)).toBe(2)
    expect(hiveResearchDamageMult(s)).toBe(1)
    expect(hiveResearchSalvageMult(s)).toBeGreaterThan(1)
  })

  it('Pattern Floor opens recipe mastery gates one rank sooner', () => {
    const s = atResearch(5)
    s.foundry.recipeLevels['slag-ingot'] = 3
    expect(foundryRecipeGateNeed(s, 4)).toBe(4)
    complete(s, 'material', 6)
    expect(hiveResearchMasteryReduce(s)).toBe(1)
    expect(foundryRecipeGateNeed(s, 4)).toBe(3)
  })

  it('Keel Bay adds a utility Core slot and solves old recipes two ranks sooner', () => {
    const s = atResearch()
    const frame = getFrame('line-frame')!
    expect(canFitModuleOnFrame(frame, ['drone-bay'], 'vector-thruster')).toBe(false)
    complete(s, 'material', 9)
    expect(hiveResearchExtraUtilitySlots(s)).toBe(1)
    expect(hiveResearchInfiniteReduce(s)).toBe(2)
    expect(
      canFitModuleOnFrame(frame, ['drone-bay'], 'vector-thruster', {
        utility: hiveResearchExtraUtilitySlots(s),
      }),
    ).toBe(true)
    const slag = getFoundryRecipe('slag-ingot')!
    expect(foundryMasteryStepsFor(slag).at(-1)?.at).toBe(20)
    expect(foundryMasteryStepsFor(slag, s).at(-1)?.at).toBe(18)
  })

  it('Energy Extra Tap lights another Furnace channel; Ward Current is shield not damage', () => {
    const s = atResearch()
    complete(s, 'energy', 1)
    expect(hiveResearchShieldMult(s)).toBeGreaterThan(1)
    expect(hiveResearchDamageMult(s)).toBe(1)
    complete(s, 'energy', 3)
    expect(hiveResearchFurnaceSlots(s)).toBe(1)
    expect(furnaceChannelSlots(s)).toBe(2)
    expect(hiveResearchDamageMult(s)).toBe(1)
  })

  it('Corps Draw makes assigned drones fill Network bars harder', () => {
    const s = atResearch()
    s.base.workerDrones = 1
    s.base.assignments.strike = 1
    const before = networkRawFillRate(s, 'strike')
    complete(s, 'energy', 6)
    expect(hiveResearchDroneEffMult(s)).toBeCloseTo(1.12)
    expect(networkRawFillRate(s, 'strike')).toBeGreaterThan(before)
  })

  it('Relay Sight opens Archive Relay early and lights a second extra Furnace channel', () => {
    const s = atResearch(34)
    expect(isNetworkBarUnlocked(s, 'strike-relay')).toBe(true)
    complete(s, 'energy', 9)
    expect(hiveResearchUnlocksRelay(s, 'archive-relay')).toBe(true)
    expect(isNetworkBarUnlocked(s, 'strike-relay')).toBe(true)
    expect(hiveResearchFurnaceSlots(s)).toBe(2)
    expect(furnaceChannelSlots(s)).toBe(3)
  })

  it('Observation Second Desk speeds background branches', () => {
    const s = atResearch()
    s.hiveResearch.focus = 'material'
    complete(s, 'observation', 3)
    expect(hiveResearchOffFocusMult(s)).toBeCloseTo(1.5)
    grantHiveResearchKillXp(s, false)
    const material = hiveResearchXp(s, 'material')
    const energy = hiveResearchXp(s, 'energy')
    expect(material / energy).toBeCloseTo(HIVE_RESEARCH_FOCUS_MULT / 1.5)
  })

  it('Blue Bay opens the blue Reliquary slot before its sector 40 gate', () => {
    const s = atResearch(34)
    expect(isReliquarySlotUnlocked(s, 'blue')).toBe(false)
    complete(s, 'observation', 6)
    expect(hiveResearchUnlocksReliquary(s, 'blue')).toBe(true)
    expect(isReliquarySlotUnlocked(s, 'blue')).toBe(true)
  })

  it('Queue Hall deepens the Research Queue and feeds Protocols into the desk', () => {
    const s = atResearch()
    expect(hiveResearchQueueCap(s)).toBe(3)
    complete(s, 'observation', 9)
    expect(hiveResearchQueueCap(s)).toBe(6)
    expect(hiveResearchProtocolXpMult(s)).toBe(1)
    s.protocols.activeId = 'cold-foundry'
    expect(hiveResearchProtocolXpMult(s)).toBeCloseTo(1.15)
  })
})

describe('Research milestones: Process queue and Auto Research', () => {
  it('Auto Research follows the queue and can be turned off for a breakthrough choice', () => {
    const s = atResearch()
    s.process.purchased = ['research-queue', 'research-priorities', 'research-focus']
    s.process.config.research.queue = ['energy', 'material']
    s.process.config.research.autoResearch = true
    expect(s.hiveResearch.focus).toBe('material')
    tickAutomation(s)
    expect(s.hiveResearch.focus).toBe('energy')

    s.process.config.research.autoResearch = false
    s.hiveResearch.focus = 'material'
    tickAutomation(s)
    expect(s.hiveResearch.focus).toBe('material')
  })

  it('honours queue capacity so extra entries past the cap are ignored', () => {
    const s = atResearch()
    s.process.purchased = ['research-queue', 'research-focus']
    s.process.config.research.autoResearch = true
    complete(s, 'material', 9)
    s.process.config.research.queue = ['material', 'material', 'material', 'energy']
    expect(hiveResearchQueueCap(s)).toBe(3)
    tickAutomation(s)
    expect(s.hiveResearch.focus).toBe('material')

    complete(s, 'observation', 9)
    expect(hiveResearchQueueCap(s)).toBe(6)
    tickAutomation(s)
    expect(s.hiveResearch.focus).toBe('energy')
  })
})

describe('Research milestones: Rebuild, save, onboarding', () => {
  it('Rebuild keeps completed nodes, XP, and focus', () => {
    let s = atResearch()
    complete(s, 'energy', 3)
    s.hiveResearch.xp.energy = 40
    s.hiveResearch.focus = 'energy'
    s = performRebuild(s, { frameId: 'scout-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.hiveResearch.completed.energy).toBe(3)
    expect(s.hiveResearch.xp.energy).toBe(40)
    expect(s.hiveResearch.focus).toBe('energy')
    expect(furnaceChannelSlots(s)).toBeGreaterThanOrEqual(2)
  })

  it('round-trips completed nodes through save without bumping version', () => {
    const s = atResearch()
    complete(s, 'material', 6)
    complete(s, 'observation', 2)
    s.hiveResearch.focus = 'observation'
    s.hiveResearch.xp.observation = 12
    const loaded = importSave(exportSave(s))
    expect(SAVE_VERSION).toBe(34)
    expect(loaded?.hiveResearch.completed.material).toBe(6)
    expect(loaded?.hiveResearch.completed.observation).toBe(2)
    expect(loaded?.hiveResearch.focus).toBe('observation')
    expect(loaded?.hiveResearch.xp.observation).toBe(12)
    expect(hiveResearchMasteryReduce(loaded!)).toBe(1)
  })

  it('offers a single Research focus hint instead of a desk tour', () => {
    const s = atResearch()
    s.meta.seenOnboarding = [...STARTER_GUIDE_IDS, ...NETWORK_GUIDE_IDS]
    expect(activeGuideStep(s, 'research')?.id).toBe('guide-research-focus')
    const skipped = skipOnboarding(s, 'guide-research-focus')
    for (const id of RESEARCH_V2_GUIDE_IDS) {
      expect(skipped.meta.seenOnboarding).toContain(id)
    }
    expect(activeGuideStep(skipped, 'research')).toBeNull()
  })

  it('does not tour breakthroughs, queues, or auto-research', () => {
    const ids = new Set(GUIDE_STEPS.map((g) => g.id))
    for (const id of ['guide-research-xp', 'guide-research-bt-near', 'guide-research-queue', 'guide-research-auto']) {
      expect(ids.has(id)).toBe(false)
    }
  })

  it('keeps Research inspect and guide copy free of designer jargon', () => {
    const s = atResearch(8)
    complete(s, 'energy', 2)
    const blob = [
      inspectCopyCorpus(s).join('\n'),
      inspectResearchBranch(s, 'energy')?.body.join('\n') ?? '',
      GUIDE_STEPS.filter((g) => g.id.startsWith('guide-research'))
        .flatMap((g) => [g.title, ...guideBodyLines(g)])
        .join('\n'),
    ].join('\n')
    expect(blob).not.toMatch(JARGON)
    expect(blob).toMatch(/breakthrough/i)
    expect(blob).toMatch(/Furnace channel/)
  })
})
