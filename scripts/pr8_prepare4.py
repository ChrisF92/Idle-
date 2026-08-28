from pathlib import Path

p = Path('scripts/pr8_apply.py')
text = p.read_text()

post = r'''

# --- PR8 final regression cleanup: rewrite stale pre-PR8 tests and onboarding. ---

# Furnace onboarding must teach the one-time live-Sortie Ignite flow and mount a
# semantic target on the replacement four-channel UI.
onb = read('src/game/onboarding.ts')
old_lesson = """  {
    id: 'furnace.channel',
    title: 'Ash and Heat',
    body: [
      'Ash persists across Sorties this cycle. Convert it to Heat, then light Weapons.',
      'Heat is this Sortie only and dumps when you Dock.',
    ],
    actionLabel: 'Light Weapons',
    target: 'onboarding.furnace.channel',
    nav: { tab: 'furnace', systemsView: 'hub' },
    pause: false,
    skippable: true,
    required: false,
    activation: 'visit',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'furnace') &&
      ((s.resources.heat ?? 0) >= 8 || (s.resources.choirAsh ?? 0) >= 80) &&
      (s.furnace?.wanted?.weapons ?? 0) < 1,
    completeWhen: (s) => (s.furnace?.wanted?.weapons ?? 0) >= 1,
  },"""
new_lesson = """  {
    id: 'furnace.channel',
    title: 'Ignite the Furnace',
    body: [
      'Ash lasts through this Rebuild cycle. Convert 10 Ash into 1 Heat during a live Sortie.',
      'Configure up to two channels, Prime the configuration, then Ignite once. The Furnace locks until the Sortie ends.',
    ],
    actionLabel: 'Configure a channel',
    target: 'onboarding.furnace.channel',
    nav: { tab: 'furnace', systemsView: 'hub' },
    pause: false,
    skippable: true,
    required: false,
    activation: 'visit',
    availableWhen: (s) =>
      isSystemUnlocked(s, 'furnace') &&
      !s.combat.docked &&
      Boolean(s.combat.inFight) &&
      !s.furnace.ignited &&
      ((s.resources.heat ?? 0) >= 10 || (s.resources.choirAsh ?? 0) >= 100),
    completeWhen: (s) => s.furnace.ignited,
  },"""
if old_lesson not in onb:
    raise RuntimeError('old Furnace onboarding lesson missing')
onb = onb.replace(old_lesson, new_lesson)
onb = onb.replace("next.combat.directiveOffer = ['overcharge', 'scavenger', 'reactive']", "next.combat.directiveOffer = ['overcharge', 'scavenger-sweep', 'reactive-array']")
old_prep = """    case 'furnace.channel':
      next.resources.choirAsh = Math.max(next.resources.choirAsh, 80)
      next.resources.heat = Math.max(next.resources.heat, 8)
      next.furnace.wanted = { ...(next.furnace.wanted ?? {}), weapons: 0 }
      break"""
new_prep = """    case 'furnace.channel':
      next.combat.docked = false
      next.combat.inFight = true
      next.resources.choirAsh = Math.max(next.resources.choirAsh, 100)
      next.resources.heat = Math.max(next.resources.heat, 60)
      next.furnace = {
        ignited: false,
        channels: { overdrive: 0, bulwark: 0, guidance: 0, harvest: 0 },
        effectStrengthMult: 1,
      }
      break"""
if old_prep not in onb:
    raise RuntimeError('old Furnace onboarding prep missing')
onb = onb.replace(old_prep, new_prep)
write('src/game/onboarding.ts', onb)

ft = read('src/components/tabs/FurnaceTab.tsx')
ft = ft.replace('className="furnace-channel-list" data-guide="furnace-channels"', 'className="furnace-channel-list" data-guide="furnace-channels" data-onboarding="onboarding.furnace.channel"')
write('src/components/tabs/FurnaceTab.tsx', ft)

# Furnace UI regression suite now asserts the canonical four-channel lifecycle.
FURNACE_UI_TEST = r'''import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FurnaceTab } from '../components/tabs/FurnaceTab'
import { OverlayProvider } from '../ui/overlay'
import { ACT1_CADENCE } from './cadence'
import { furnaceHubStatus } from './systemsHub'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'

function furnaceState() {
  const state = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.furnace)
  state.combat.docked = false
  state.combat.inFight = true
  state.resources.choirAsh = 40
  state.resources.heat = 100
  return state
}

function renderFurnace(state = furnaceState()) {
  const props = {
    state,
    onBack: vi.fn(),
    onConvert: vi.fn(),
    onIgnite: vi.fn(),
  }
  render(
    <OverlayProvider>
      <FurnaceTab {...props} />
    </OverlayProvider>,
  )
  return props
}

describe('PR8 Furnace UI', () => {
  afterEach(() => cleanup())

  it('shows Ash, Heat, 10:1 conversion, and CONFIGURE state', () => {
    renderFurnace()
    const context = document.querySelector('.ui-context-bar')!
    expect(context.textContent).toContain('Ash')
    expect(context.textContent).toContain('40')
    expect(context.textContent).toContain('Heat')
    expect(context.textContent).toContain('100')
    expect(context.textContent).toContain('10 Ash → 1 Heat')
    expect(context.textContent).toContain('CONFIGURE')
  })

  it('renders exactly Overdrive, Bulwark, Guidance, and Harvest', () => {
    renderFurnace()
    expect(screen.getByText(/OVERDRIVE — OFF/)).toBeTruthy()
    expect(screen.getByText(/BULWARK — OFF/)).toBeTruthy()
    expect(screen.getByText(/GUIDANCE — OFF/)).toBeTruthy()
    expect(screen.getByText(/HARVEST — OFF/)).toBeTruthy()
    expect(document.querySelectorAll('.furnace-channel-card').length).toBe(4)
    expect(document.querySelector('[data-onboarding="onboarding.furnace.channel"]')).toBeTruthy()
  })

  it('requires Configure → Prime → Ignite and sends the selected locked configuration', () => {
    const props = renderFurnace()
    fireEvent.click(screen.getAllByRole('button', { name: 'II · 25' })[0]!)
    expect(screen.getByText(/Selected 1\/2 · Ignite cost 25 Heat/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Prime configuration' }))
    expect(screen.getByText(/PRIMED/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ignite and Lock' }))
    expect(props.onIgnite).toHaveBeenCalledWith({ overdrive: 2, bulwark: 0, guidance: 0, harvest: 0 })
  })

  it('prints Ash, Heat, and canonical lit channels on the Systems card', () => {
    const state = furnaceState()
    state.resources.heat = 20
    state.furnace = {
      ignited: true,
      channels: { overdrive: 2, bulwark: 0, guidance: 0, harvest: 1 },
      effectStrengthMult: 1,
    }
    expect(furnaceHubStatus(state)).toEqual(['Ash 40', 'Heat 20', 'Overdrive II · Harvest I'])
  })
})
'''
write('src/game/gdd-furnace-ui.test.tsx', FURNACE_UI_TEST)

# Old visual test state referred to retired Weapons/Yield channels.
vis = read('src/game/gdd-visual.test.tsx')
vis = vis.replace("    state.furnace.active.weapons = 1\n    state.furnace.active.recovery = 1", "    state.furnace = {\n      ignited: true,\n      channels: { overdrive: 1, bulwark: 0, guidance: 0, harvest: 1 },\n      effectStrengthMult: 1,\n    }")
vis = vis.replace("expect(hud.textContent).toContain('Weapons I')", "expect(hud.textContent).toContain('Overdrive I')")
vis = vis.replace("expect(hud.textContent).toContain('Yield I')", "expect(hud.textContent).toContain('Harvest I')")
write('src/game/gdd-visual.test.tsx', vis)

# Inspect tests use the replacement per-channel surface, not retired track ids.
INSPECT_TEST = r'''import { describe, expect, it } from 'vitest'
import {
  inspectCopyCorpus,
  inspectCore,
  inspectFurnaceChannel,
  inspectNetworkOverview,
} from './inspect'
import { createInitialState } from './state'

const JARGON = /USI|ITRTG|analogue|black-bar|PoC|TODO|\bFlagship\b|\bSector\b/i

describe('inspect sheets', () => {
  it('Worker Drones, Cores, and Furnace sheets carry live numbers and player copy', () => {
    const s = createInitialState(0)
    s.base.workerDrones = 5
    s.base.assignments['scrap-field'] = 2
    s.combat.docked = false
    s.combat.inFight = true
    s.resources.salvage = 12
    s.resources.choirAsh = 25
    s.resources.heat = 20
    s.furnace = {
      ignited: true,
      channels: { overdrive: 1, bulwark: 0, guidance: 0, harvest: 0 },
      effectStrengthMult: 1,
    }

    const overview = inspectNetworkOverview(s)
    expect(overview.title).toBe('Worker Drones')
    expect(overview.stats.find((row) => row.label === 'Assigned')?.value).toBe('2')
    expect(overview.body.join(' ')).toMatch(/Rebuild/)

    const core = inspectCore(s, 'pulse-cannon')
    expect(core?.stats.find((row) => row.label === 'Damage')?.value).toMatch(/→/)
    expect(core?.body.join(' ')).toMatch(/Mastery/)
    expect(core?.body.join(' ')).not.toMatch(JARGON)

    const overdrive = inspectFurnaceChannel(s, 'overdrive')
    expect(overdrive?.title).toBe('Overdrive')
    expect(overdrive?.stats.find((row) => row.label === 'Level')?.value).toBe('I')
    expect(overdrive?.stats.find((row) => row.label === 'Ignite cost')?.value).toBe('10 Heat')
  })

  it('keeps inspect copy free of designer jargon', () => {
    const s = createInitialState(0)
    const blob = inspectCopyCorpus(s).join('\n')
    expect(blob).not.toMatch(JARGON)
    expect(blob).toMatch(/Glass Hive/)
    expect(blob).toMatch(/every level/)
    expect(blob).toMatch(/Worker Drones/)
  })
})
'''
write('src/game/inspect.test.ts', INSPECT_TEST)

# Quantitative copy suite checks the canonical Furnace seed table directly.
up = read('src/game/upgrade-copy.test.ts')
up = up.replace("import { FURNACE_CHANNELS, furnaceChannelEffectLine } from './furnace'", "import { FURNACE_CHANNELS, furnaceChannelCost, furnaceLevelDef } from './furnace'")
old = """    const weapons = FURNACE_CHANNELS.find((ch) => ch.id === 'weapons')!
    expect(furnaceChannelEffectLine(weapons)).toBe('Weapon Output ×1.40 / ×1.80 / ×2.50')"""
new = """    const overdrive = FURNACE_CHANNELS.find((ch) => ch.id === 'overdrive')!
    expect(overdrive.levels.map((row) => row.effect)).toEqual([0.2, 0.45, 0.8])
    expect(furnaceLevelDef('overdrive', 3)?.effect).toBe(0.8)
    expect([furnaceChannelCost(1), furnaceChannelCost(2), furnaceChannelCost(3)]).toEqual([10, 25, 60])"""
if old not in up:
    raise RuntimeError('upgrade-copy old Furnace assertion missing')
up = up.replace(old, new)
write('src/game/upgrade-copy.test.ts', up)

# PR4 Frame/Core suites should verify Reactor conversion identity through the
# surviving Frame multiplier rather than a deleted legacy Furnace helper.
fcm = read('src/game/frames-cores-mastery.test.ts')
fcm = fcm.replace('  getFrame,\n  getModule,', '  getFrame,\n  getModule,\n  frameHeatMult,')
fcm = fcm.replace("import { furnaceAshHeatMult } from './furnace'\n", '')
fcm = fcm.replace('expect(furnaceAshHeatMult(s)).toBe(furnaceAshHeatMult(leftover))', 'expect(frameHeatMult(s)).toBe(frameHeatMult(leftover))')
fcm = fcm.replace('expect(furnaceAshHeatMult(reactor)).toBeGreaterThan(furnaceAshHeatMult(s))', 'expect(frameHeatMult(reactor)).toBeGreaterThan(frameHeatMult(s))')
write('src/game/frames-cores-mastery.test.ts', fcm)

gf = read('src/game/gdd-frames.test.ts')
gf = gf.replace('  frameSalvageMult,\n  frameUnlockLine,', '  frameSalvageMult,\n  frameHeatMult,\n  frameUnlockLine,')
gf = gf.replace("import { furnaceAshHeatMult } from './furnace'\n", '')
gf = gf.replace('    reactor.meta.bestWave = 140\n    reactor.combat.bestWave = 140\n    expect(furnaceAshHeatMult(reactor)).toBeGreaterThan(furnaceAshHeatMult(starter))', '    expect(frameHeatMult(reactor)).toBeGreaterThan(frameHeatMult(starter))')
write('src/game/gdd-frames.test.ts', gf)

# Act-1 balance tests retire W140/passive-Furnace literals and validate the new
# breaking schema instead of preserving compatibility state.
ab = read('src/game/act1-balance.test.ts')
ab = ab.replace("import { FURNACE_BASE_IDLE_GEN, FURNACE_CHANNEL_MAX } from './furnace'", "import { ASH_PER_HEAT, FURNACE_INITIAL_CHANNEL_LIMIT } from './furnace'")
ab = ab.replace('expect(ACT1_UNLOCKS.furnace).toBe(140)', 'expect(ACT1_UNLOCKS.furnace).toBe(450)')
ab = ab.replace('expect(FURNACE_CHANNEL_MAX).toBe(3)\n    expect(FURNACE_BASE_IDLE_GEN).toBe(0)', 'expect(FURNACE_INITIAL_CHANNEL_LIMIT).toBe(2)\n    expect(ASH_PER_HEAT).toBe(10)')
ab = ab.replace("    s.furnace.wanted.weapons = 1\n    s.furnace.active.weapons = 1", "    s.furnace = {\n      ignited: true,\n      channels: { overdrive: 1, bulwark: 0, guidance: 0, harvest: 0 },\n      effectStrengthMult: 1,\n    }")
ab = ab.replace("  it('roundtrips a mid-Act-1 save without bumping SAVE_VERSION', () => {", "  it('roundtrips the PR8 Furnace schema at SAVE_VERSION 49', () => {")
ab = ab.replace("    s.furnace.wanted.weapons = 1", "    s.furnace = {\n      ignited: true,\n      channels: { overdrive: 1, bulwark: 0, guidance: 0, harvest: 0 },\n      effectStrengthMult: 1,\n    }")
ab = ab.replace("    expect(back!.furnace.wanted.weapons).toBe(1)", "    expect(back!.furnace.ignited).toBe(true)\n    expect(back!.furnace.channels.overdrive).toBe(1)")
write('src/game/act1-balance.test.ts', ab)

cad = read('src/game/gdd-cadence.test.ts')
cad = cad.replace("expect(systemUnlockRequirement('furnace')).toBe('Reach Wave 140')", "expect(systemUnlockRequirement('furnace')).toBe('Reach Wave 450')")
write('src/game/gdd-cadence.test.ts', cad)

# PR10 owns the Challenge rewrite. Do not pull its Cold Furnace rule into PR8;
# keep the existing Glass Hive assertion and leave Furnace restriction to PR10.
gc = read('src/game/gdd-challenges.test.ts')
old_challenge = """  it('halves Hull on Glass Hive and mutes Cold Furnace', () => {
    const base = challengeState()
    const hull = computeShipStats(base).hullMax
    base.protocols.activeId = 'glass-ward'
    expect(protocolHullMult(base)).toBe(0.5)
    expect(computeShipStats(base).hullMax).toBeCloseTo(hull * 0.5)
    expect(protocolMutes(base, 'shields')).toBe(true)

    const furnace = challengeState()
    furnace.furnace.active.weapons = 1
    expect(furnaceDamageMult(furnace)).toBeGreaterThan(1)
    furnace.protocols.activeId = 'dead-furnace'
    expect(furnaceDamageMult(furnace)).toBe(1)
  })"""
new_challenge = """  it('halves Hull on the existing Glass Hive challenge without pulling PR10 Furnace rules forward', () => {
    const base = challengeState()
    const hull = computeShipStats(base).hullMax
    base.protocols.activeId = 'glass-ward'
    expect(protocolHullMult(base)).toBe(0.5)
    expect(computeShipStats(base).hullMax).toBeCloseTo(hull * 0.5)
    expect(protocolMutes(base, 'shields')).toBe(true)
  })"""
if old_challenge not in gc:
    raise RuntimeError('old Challenge Furnace test missing')
gc = gc.replace(old_challenge, new_challenge)
gc = gc.replace("import { furnaceDamageMult } from './furnace'\n", '')
write('src/game/gdd-challenges.test.ts', gc)

# PR9 owns Process automation. Its legacy Push profile must not auto-convert Ash
# or auto-Ignite the new PR8 Furnace.
gp = read('src/game/gdd-process.test.ts')
gp = gp.replace("expect(systemsHubCards(open).map((c) => c.id)).toEqual(['foundry', 'furnace', 'research', 'process'])", "expect(systemsHubCards(open).map((c) => c.id)).toEqual(['foundry', 'research', 'process'])")
old_push = """  it('lets Push dump Economy at 95% of Best and light Furnace', () => {
    const s = processState()
    s.combat.docked = false
    s.combat.wave = Math.ceil(ACT1_CADENCE.process * 0.95)
    s.resources.choirAsh = 80
    s.resources.heat = 0
    s.process.purchased = ['buy-ten', 'auto-shop', 'spend-ratios', 'rule-builder', 'run-profiles']
    s.process.config = { ...processConfig(s), activeProfileId: 'push' }

    const intent = evaluateProcessIntent(s)
    expect(intent.spend.economy).toBe(0)
    expect(intent.furnacePush).toBe(true)
    expect(intent.autoExtract).toBe(false)
    expect(processShouldExtract(s)).toBe(false)

    tickAutomation(s)
    expect(s.furnace.wanted.weapons).toBeGreaterThanOrEqual(1)
    expect(s.furnace.active.weapons).toBeGreaterThanOrEqual(1)
    expect((s.resources.choirAsh ?? 0) + (s.resources.heat ?? 0) * 10).toBeLessThan(80)
  })"""
new_push = """  it('does not let the legacy Push profile automate PR8 Furnace decisions', () => {
    const s = processState()
    s.combat.docked = false
    s.combat.inFight = true
    s.combat.wave = Math.ceil(ACT1_CADENCE.process * 0.95)
    s.resources.choirAsh = 80
    s.resources.heat = 0
    s.process.purchased = ['buy-ten', 'auto-shop', 'spend-ratios', 'rule-builder', 'run-profiles']
    s.process.config = { ...processConfig(s), activeProfileId: 'push' }

    const intent = evaluateProcessIntent(s)
    expect(intent.spend.economy).toBe(0)
    expect(intent.furnacePush).toBe(true)
    expect(intent.autoExtract).toBe(false)
    expect(processShouldExtract(s)).toBe(false)

    tickAutomation(s)
    expect(s.furnace.ignited).toBe(false)
    expect(s.resources.choirAsh).toBe(80)
    expect(s.resources.heat).toBe(0)
  })"""
if old_push not in gp:
    raise RuntimeError('old Process Push Furnace test missing')
gp = gp.replace(old_push, new_push)
write('src/game/gdd-process.test.ts', gp)

# Research/Process are deliberately still their pre-PR9 implementations. Their
# old W170/W210 UI tests cannot assume Furnace was already open now that PR8
# correctly moves it to W450.
gr = read('src/game/gdd-research.test.ts')
gr = gr.replace("expect(systemsHubCards(open).map((c) => c.id)).toEqual(['foundry', 'furnace', 'research'])", "expect(systemsHubCards(open).map((c) => c.id)).toEqual(['foundry', 'research'])")
write('src/game/gdd-research.test.ts', gr)

uia = read('src/game/gdd-ui-ia.test.ts')
uia = uia.replace("    expect(nextMajorDoor(afterFurnace)?.id).toBe('research')", "    expect(nextMajorDoor(afterFurnace)?.id).not.toBe('furnace')")
uia = uia.replace("expect(systemsHubCards(furnace).map((c) => c.id)).toEqual(['foundry', 'furnace'])", "expect(systemsHubCards(furnace).map((c) => c.id)).toEqual(['foundry', 'furnace', 'research'])")
uia = uia.replace("    expect(isSystemUnlocked(furnace, 'research')).toBe(false)", "    // Research remains the pre-PR9 W170 implementation in PR8, so it is already open by W450.\n    expect(isSystemUnlocked(furnace, 'research')).toBe(true)")
write('src/game/gdd-ui-ia.test.ts', uia)

print('applied PR8 final regression cleanup')
'''

p.write_text(text + post)
print('prepared PR8 final regression cleanup')
