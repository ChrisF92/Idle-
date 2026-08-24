import { describe, expect, it } from 'vitest'
import { performRebuild } from './actions'
import { tickAutomation } from './automation'
import { canFitModuleOnFrame, getFrame } from './catalog'
import { foundryMasteryStepsFor, foundryRecipeGateNeed, foundrySlotCount, getFoundryRecipe } from './foundry'
import { furnaceChannelSlots } from './furnace'
import {
  HIVE_RESEARCH_BRANCHES,
  HIVE_RESEARCH_NODES,
  RESEARCH_BREAKTHROUGH_S,
  RESEARCH_PREVIEW,
  RESEARCH_QUEUE_BASE,
  RESEARCH_TREE,
  getHiveResearchNode,
  hiveResearchApproachingBreakthrough,
  hiveResearchDamageMult,
  hiveResearchDroneEffMult,
  hiveResearchExtraUtilitySlots,
  hiveResearchFocusFire,
  hiveResearchFitSlots,
  hiveResearchFoundrySlots,
  hiveResearchFurnaceSlots,
  hiveResearchInfiniteReduce,
  hiveResearchMasteryReduce,
  hiveResearchNextBreakthrough,
  hiveResearchNodeDuration,
  hiveResearchProtocolXpMult,
  hiveResearchQueueCap,
  hiveResearchSalvageMult,
  hiveResearchShieldMult,
  hiveResearchUnlocksReliquary,
  hiveResearchUpcoming,
  isResearchBreakthrough,
} from './hiveResearch'
import { inspectCopyCorpus, inspectResearchBranch } from './inspect'
import { networkRawFillRate } from './network'
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
import type { GameState } from './types'

const JARGON = /USI|ITRTG|analogue|black-bar/i

function atResearch(sector = 34): GameState {
  const s = createInitialState(0)
  s.meta.highestSectorEver = sector
  s.combat.highestSector = sector
  s.combat.sector = sector
  return s
}

function completeIds(state: GameState, ids: string[]): void {
  state.hiveResearch.completedIds = [...new Set([...(state.hiveResearch.completedIds ?? []), ...ids])]
  for (const branch of HIVE_RESEARCH_BRANCHES) {
    state.hiveResearch.completed[branch.id] = state.hiveResearch.completedIds.filter(
      (id) => getHiveResearchNode(id)?.branch === branch.id,
    ).length
  }
}

describe('Research milestones: nodes and identity', () => {
  it('keeps four named disciplines with genuine forks and reconnects', () => {
    expect(HIVE_RESEARCH_BRANCHES.map((b) => b.id)).toEqual([
      'energy',
      'observation',
      'material',
      'computation',
    ])
    expect(HIVE_RESEARCH_BRANCHES.map((b) => b.name)).toEqual([
      'Hive Engineering',
      'Drone Systems',
      'Industrial Science',
      'Computational Systems',
    ])
    expect(RESEARCH_PREVIEW).toBe(1)
    expect(RESEARCH_TREE.length).toBeGreaterThanOrEqual(24)
    for (const branch of HIVE_RESEARCH_BRANCHES) {
      expect(HIVE_RESEARCH_NODES[branch.id].length).toBeGreaterThanOrEqual(6)
      expect(HIVE_RESEARCH_NODES[branch.id].some((node) => isResearchBreakthrough(node))).toBe(true)
    }
    const children = (id: string) => RESEARCH_TREE.filter((node) => node.prerequisites.includes(id))
    expect(children('plate-bank').length).toBeGreaterThanOrEqual(3)
    expect(children('priority-lock').length).toBeGreaterThanOrEqual(2)
    expect(children('second-processor').length).toBeGreaterThanOrEqual(2)
    expect(children('queue-desk').length).toBeGreaterThanOrEqual(2)
    expect(getHiveResearchNode('hangar-swap')?.prerequisites).toEqual(['extra-tap', 'keel-bay'])
    expect(getHiveResearchNode('hearth-line')?.prerequisites).toEqual(['pattern-floor', 'fab-machinery'])
  })

  it('previews only the next available discovery', () => {
    const s = atResearch()
    const upcoming = hiveResearchUpcoming(s, 'energy')
    expect(upcoming.map((row) => row.node.name)).toEqual(['Plate Bank'])
    expect(hiveResearchNextBreakthrough(s, 'energy')?.node.name).toBe('Plate Bank')
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
    expect(hiveResearchQueueCap(s)).toBe(RESEARCH_QUEUE_BASE)
    expect(hiveResearchProtocolXpMult(s)).toBe(1)
    expect(hiveResearchExtraUtilitySlots(s)).toBe(0)
    expect(furnaceChannelSlots(s)).toBe(1)
    expect(foundrySlotCount(s)).toBe(1)
    expect(isReliquarySlotUnlocked(s, 'blue')).toBe(false)
  })
})

describe('Research milestones: costs', () => {
  it('keeps SAVE_VERSION and timed breakthroughs', () => {
    expect(SAVE_VERSION).toBe(38)
    const s = atResearch()
    const plate = getHiveResearchNode('plate-bank')!
    expect(hiveResearchNodeDuration(plate)).toBe(RESEARCH_BREAKTHROUGH_S)
    expect(hiveResearchNodeDuration(plate, s)).toBe(RESEARCH_BREAKTHROUGH_S)
  })

  it('keeps later nodes slower than the first breakthrough without a 6400 wall', () => {
    const hangar = getHiveResearchNode('hangar-swap')!
    const plate = getHiveResearchNode('plate-bank')!
    expect(hangar.duration).toBeGreaterThan(plate.duration)
    expect(hangar.duration).toBeLessThan(6400)
  })
})

describe('Research milestones: breakthrough wiring', () => {
  it('Industrial Science Second Processor adds a Foundry slot, not damage', () => {
    const s = atResearch()
    completeIds(s, ['second-processor'])
    expect(hiveResearchFoundrySlots(s)).toBe(1)
    expect(foundrySlotCount(s)).toBe(2)
    expect(hiveResearchDamageMult(s)).toBe(1)
  })

  it('Pattern Floor opens recipe mastery gates one rank sooner', () => {
    const s = atResearch(5)
    s.foundry.recipeLevels['slag-ingot'] = 3
    expect(foundryRecipeGateNeed(s, 4)).toBe(4)
    completeIds(s, ['second-processor', 'pattern-floor'])
    expect(hiveResearchMasteryReduce(s)).toBe(1)
    expect(foundryRecipeGateNeed(s, 4)).toBe(3)
  })

  it('Keel Bay adds a utility Core slot and solves old recipes two ranks sooner', () => {
    const s = atResearch()
    const frame = getFrame('bastion-frame')!
    expect(canFitModuleOnFrame(frame, ['drone-bay'], 'vector-thruster')).toBe(false)
    completeIds(s, ['plate-bank', 'keel-bay'])
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

  it('Hive Engineering Extra Tap lights another Furnace channel; Priority Lock is targeting', () => {
    const s = atResearch()
    completeIds(s, ['priority-lock'])
    expect(hiveResearchFocusFire(s)).toBe(true)
    expect(hiveResearchDamageMult(s)).toBe(1)
    completeIds(s, ['plate-bank', 'extra-tap'])
    expect(hiveResearchFurnaceSlots(s)).toBe(1)
    expect(furnaceChannelSlots(s)).toBe(2)
    expect(hiveResearchDamageMult(s)).toBe(1)
  })

  it('Worker Calibration makes assigned drones fill jobs harder', () => {
    const s = atResearch()
    s.base.workerDrones = 1
    s.base.assignments.strike = 1
    const before = networkRawFillRate(s, 'strike')
    completeIds(s, ['priority-lock', 'worker-calibration'])
    expect(hiveResearchDroneEffMult(s)).toBeCloseTo(1.12)
    expect(networkRawFillRate(s, 'strike')).toBeGreaterThan(before)
  })

  it('Blue Bay opens the blue Reliquary slot before its sector 40 gate', () => {
    const s = atResearch(34)
    expect(isReliquarySlotUnlocked(s, 'blue')).toBe(false)
    completeIds(s, ['priority-lock', 'combat-sim', 'blue-bay'])
    expect(hiveResearchUnlocksReliquary(s, 'blue')).toBe(true)
    expect(isReliquarySlotUnlocked(s, 'blue')).toBe(true)
  })

  it('Queue Desk and Auto Desk deepen the Research Queue', () => {
    const s = atResearch()
    expect(hiveResearchQueueCap(s)).toBe(3)
    completeIds(s, ['queue-desk'])
    expect(hiveResearchQueueCap(s)).toBe(4)
    completeIds(s, ['inspect-layer', 'process-primer', 'auto-desk'])
    expect(hiveResearchQueueCap(s)).toBe(6)
    expect(hiveResearchProtocolXpMult(s)).toBe(1)
    completeIds(s, ['challenge-log'])
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
    completeIds(s, HIVE_RESEARCH_NODES.material.map((node) => node.id))
    s.process.config.research.queue = ['material', 'material', 'material', 'energy']
    expect(hiveResearchQueueCap(s)).toBe(3)
    tickAutomation(s)
    expect(s.hiveResearch.focus).toBe('material')

    completeIds(s, ['queue-desk', 'inspect-layer', 'process-primer', 'auto-desk'])
    expect(hiveResearchQueueCap(s)).toBe(6)
    tickAutomation(s)
    expect(s.hiveResearch.focus).toBe('energy')
  })
})

describe('Research milestones: Rebuild, save, onboarding', () => {
  it('Rebuild keeps completed nodes, XP, and focus', () => {
    let s = atResearch()
    completeIds(s, ['plate-bank', 'extra-tap'])
    s.hiveResearch.xp.energy = 40
    s.hiveResearch.focus = 'energy'
    s.hiveResearch.active = true
    s.hiveResearch.activeNodeId = 'workshop-primer'
    s.hiveResearch.progress = 40
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.hiveResearch.completed.energy).toBe(2)
    expect(s.hiveResearch.xp.energy).toBe(40)
    expect(s.hiveResearch.focus).toBe('energy')
    expect(furnaceChannelSlots(s)).toBeGreaterThanOrEqual(2)
  })

  it('round-trips completed nodes through save', () => {
    const s = atResearch()
    completeIds(s, ['second-processor', 'pattern-floor', 'priority-lock', 'combat-sim'])
    s.hiveResearch.focus = 'observation'
    s.hiveResearch.xp.observation = 12
    const loaded = importSave(exportSave(s))
    expect(SAVE_VERSION).toBe(38)
    expect(loaded?.hiveResearch.completed.material).toBe(2)
    expect(loaded?.hiveResearch.completed.observation).toBe(2)
    expect(loaded?.hiveResearch.completedIds).toEqual(
      expect.arrayContaining(['second-processor', 'pattern-floor', 'priority-lock', 'combat-sim']),
    )
    expect(loaded?.hiveResearch.focus).toBe('observation')
    expect(loaded?.hiveResearch.xp.observation).toBe(12)
    expect(hiveResearchMasteryReduce(loaded!)).toBe(1)
  })

  it('offers a single Research start hint instead of a desk tour', () => {
    const s = atResearch()
    s.meta.seenOnboarding = [...STARTER_GUIDE_IDS, ...NETWORK_GUIDE_IDS]
    expect(activeGuideStep(s, 'research')?.id).toBe('guide-research-focus')
    expect(activeGuideStep(s, 'research')?.title).toBe('Start a project')
    expect(guideBodyLines(activeGuideStep(s, 'research')!).join(' ')).toMatch(/offline/)
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
    completeIds(s, ['plate-bank', 'extra-tap'])
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
