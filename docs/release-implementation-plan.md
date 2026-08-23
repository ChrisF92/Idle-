# Hiveworks — Act 1 Release Implementation Plan

**Status:** living working document  
**Authority:** [`Hiveworks_Game_Design_Document_v1.0.md`](../Hiveworks_Game_Design_Document_v1.0.md)  
**Code snapshot:** `main` @ Process Farm/Push/Challenge profiles (SAVE_VERSION 36, package `0.1.0`)  
**Goal:** take the current hybrid (GDD spine + leftover USI/Cosmic Idle) to a polished Act 1 release.

This file is the implementation checklist. Update the Decision Log when a question is answered. Do not silently preserve a mechanic because the code already has it (GDD Appendix E).

---

## 0. How to use this document

- Implement **one phase per branch/PR**. Repo convention is one feature per PR.
- Each phase lists: intent, files, work, acceptance, tests to add/update, SAVE_VERSION impact.
- Prefer expanding existing systems before adding new ones (GDD §3.4).
- If a phase conflicts with a GDD test that encodes a *non-GDD* behaviour, treat that as a review item, not a reason to keep the behaviour.
- Stale docs that fight the GDD: `README.md`, `docs/act1-balance.md`, `docs/usi-reskin-plan.md`. Do not use them as authority. Phase 0 updates them so they stop lying.

---

## 1. What “release ready” means

GDD §163: a polished Act 1 is enough. Act 2 is not required.

A player can:

1. Launch from Dock with a starter Frame and Cores already fitted.
2. Fight a radial Hive Sortie that always starts at Wave 1.
3. Spend Salvage on a visible Attack / Defense / Economy shop while combat stays on screen.
4. Die or Extract, keep Scrap, spend Workshop, launch again stronger.
5. Unfold Foundry → Workers → Directives → Rebuild → Relics → Furnace → Research → Process → Challenges on the GDD wave cadence.
6. Rebuild around W70, feel a real leap, reclaim old waves much faster.
7. Automate solved work with Process (QoL → actions → priorities → conditions → profiles).
8. Clear an authored Wave 300 boss and open Reinforce.

Act 1 is not ready if:

- the player still thinks in sectors, Network bars, or a ship-at-the-bottom lane;
- a major GDD system is a stub, a renamed leftover, or gated-off dead code the UI can still reach;
- onboarding is off and the first hour needs a wiki;
- routine runs are tedious because solved waves are not compressed;
- one shop or one Core absorbs almost all spending;
- W300 is “just a fat HP bar at a round number.”

**Not required for v1.0** (GDD §162, §167): supporter IAP (see D6), PvP, guilds, Echo, Capital, Specialists, Task List, fleet combat, full offline Sortie simulation, random-affix relic loot, ads, energy, battle pass.

**Platform lock for v1.0:** portrait-first PWA **and** a Play Store wrap of that same build (D5). No save migration before the public 1.0 tag (D10). Dev tools and playtests must track the GDD loop on every phase — they are not a late polish item.

---

## 2. Decision Log

Locked 2026-08-22 from owner answers. GDD Appendix E: D1 is an explicit review, not a silent code win.

| ID | Question | Status | Lock |
|---|---|---|---|
| **D1** | How do Cores gain power? | **LOCKED** (revised) | **GDD §22 + §32.** Sortie Cores are upgradeable with **Salvage Run Levels**, bought through **Attack / Defense / Economy** by role (weapon → Attack, defense → Defense, utility → Economy). Run Levels reset when the Sortie ends. **No Dock Scrap Core ranks.** `workshop.coreStarts` and Dock “Upgrade · N Scrap” on Cores are removed. Persistent per-Core progress is **Mastery only** (plus unlocks and Relics). Workshop Scrap still starts the *global* A/D/E upgrades (Weapon Power, Hull, …), not individual Cores. |
| **D2** | Process Tier 4–6 (WHEN/THEN + profiles) for 1.0? | **LOCKED** | **Ship for 1.0.** Thin the rule vocabulary; do not skip the builder. After T1–T3 polish. |
| **D3** | Combat presentation? | **LOCKED** | **Orbiting Cores around a central Hive.** Single Hive hull/shield pool; weapons are per-Core satellites. |
| **D4** | Delete gated leftovers? | **LOCKED** (default kept) | Unwire from UI now. Delete or isolate. Capital / Specialists / Tasks stay deferred, not half-reachable. |
| **D5** | PWA only vs Play Store? | **LOCKED** | **PWA and a Play Store wrap** of the same build. Portrait-first. See Phase 10. |
| **D6** | Supporter upgrade / cosmetics at launch? | **OPEN** | A **supporter SKU** is a Play/App Store product id for an optional “thank you” pack (themes, Hive skins, non-power cosmetics). GDD §162 allows it and forbids P2W. **Not wired.** Stay **no IAP** until you want that pack; the wrap in Phase 10 does not require Billing. |
| **D7** | How authored is combat content? | **LOCKED** (default kept) | Procedural normal waves with a threat budget. Authored mechanic per 10-wave boss band + W300. |
| **D8** | Replace USI hull ladder with GDD Frames? | **LOCKED** | **Yes, one cut.** Starter + Bastion / Swarm / Reactor / Harvester. Old hull ids wipe (pre-1.0). |
| **D9** | Enable onboarding for launch? | **LOCKED** (default kept) | Yes. Rewrite to GDD §125–140. Skip always available. |
| **D10** | Save policy? | **LOCKED** | **No migration before 1.0.** Hard wipes are fine. After the public tag, migrate. **Dev tools and playtests must be updated with the game** — not left on sector / Echo / Task List cheats. |

Do not leave a second authority. If a later answer flips a lock, edit this table and the affected phase in the same PR.

---

## 3. Current-state snapshot

Main already has the **GDD spine**, locked by `src/game/gdd-*.test.ts`:

| Layer | Present |
|---|---|
| Sortie always W1; death/Extract ends the run; Salvage wipe | `tick.ts`, `gdd-sortie-loop.test.ts` |
| Attack/Defense/Economy Salvage shop + Workshop Scrap starts | `workshop.ts`, Dock + Combat tabs |
| Radial *enemy* headings | `assignRadialHeadings` in `combat.ts` |
| Directives every 50 from W50 (all 5 GDD examples) | `directives.ts` |
| Rebuild @ W70 + 3 sorties; Matter from cycle wave/workshop/scrap *earned* | `rebuild.ts` |
| Relics install into Core sockets; I–III Foundry tiers | `reliquary.ts` |
| Worker jobs exist; Strike/Ward **combat** mults stubbed to 1 | `workers.ts`, `network.ts` |
| Furnace Ash→Heat, Weapons/Ward/Yield-class channels ×1.4/1.8/2.5 @ W140 | `furnace.ts` |
| Timed Research, 4 disciplines, 1 active project @ W170 | `hiveResearch.ts` |
| Process QoL + simple auto + some priorities @ W210 | `process.ts` |
| Challenges @ W250 (6 GDD examples + 1 extra) | `protocols.ts` |
| W300 authored climax + Reinforce door | `reinforce.ts` |
| Offline: live Sortie freezes; industry continues | `offline.ts` |
| Nav: Sortie / Dock / Systems / More | `TabNav.tsx` |
| PWA + local save + export/import + sim harness | existing |
| Hive Frames: Starter + Bastion / Swarm / Reactor / Harvester (D8) | `catalog.ts` `SHIP_FRAMES`, `gdd-frames.test.ts` |
| Threat budget + named 10-wave boss mechanics | `threatBudget.ts`, `bossMechanics.ts`, `gdd-threat-budget.test.ts` |
| Player copy uses Wave / Hive, not Sector / Flagship | HUD, inspect, Codex, Stats, Sortie diagnostics |
| Relic sockets + GDD Core roster | Optical / Ballistic families; leftovers hidden from Prints |
| Foundry factory presentation | Processing / Fabrication panes; Worker efficient/hard copy |
| Research tree + Matter identity | Priority Lock; hangar Matter categories; Rebuild power preview |

**Cadence in code** (`src/game/cadence.ts`) already matches GDD §102:

| Best Wave | Door |
|---:|---|
| 10 | Codex + full Attack/Defense shop |
| 20 | Foundry |
| 30 | Worker Drones |
| 40 | Salvage/Wave economy |
| 50 | Directives |
| 70 | Rebuild |
| 90 | Foundry construction / 3rd slot |
| 110 | Relic sockets |
| 140 | Furnace |
| 170 | Research |
| 210 | Process |
| 250 | Challenges |
| 275 | Late mastery / Computation branch |
| 300 | W300 boss + Reinforce |

What is *not* done is the **identity pass**: Hive + orbiting Cores, GDD Frames (one-cut replace), Network retirement, enemy taxonomy, Process rule builder, onboarding, leftover deletion, Play Store wrap, Wave-native dev tools / playtests, and a four-curve balance pass.

**D1 (revised, GDD-aligned):** Sortie Cores take Salvage Run Levels under Attack / Defense / Economy. Dock does not rank Cores with Scrap. Mastery is the only persistent per-Core stat. The `2ae52cf` Dock Scrap ranks are a **reverted experiment**, not an amendment.

---

## 4. Gap matrix

Status: **DONE** matches GDD · **PARTIAL** exists but diverges · **MISSING** · **LEGACY** should leave Act 1 · **CONFLICT** GDD vs recent main.

| System | Status | Notes |
|---|---|---|
| Sortie loop (W1, auto-combat, death/Extract) | DONE | Extract +12% Scrap |
| Salvage Attack/Defense/Economy shop | PARTIAL | Only 6 upgrades; later crit/pen/armor/scrap-kill missing |
| Workshop | DONE | Caps 80; preview Current/Next exists |
| Rebuild + Matter + Rebuild UI facts | DONE | RESET/KEEP/GAIN; hangar Matter shop by GDD category; Edge vs Workshop preview |
| Reinforce door after W300 | PARTIAL | Door exists; Act 2 rules correctly deferred; climax needs feel |
| Directives | DONE | |
| Furnace push channels | DONE | Extra non-GDD channels still in types |
| Foundry processing + fabrication | PARTIAL | Processing / Fabrication panes + mastery table. Timed fab slots and craft-time retune still deferred |
| Worker Drones | PARTIAL | Jobs + efficient/hard copy. Manufacture bar gone. Overflow dumps to Salvage ops. `train-*` leftover remains |
| Network Strike/Ward/Yield bars | LEGACY | Combat mults = 1; Yield/Loom/Archive still multiply |
| Core Salvage Run Levels (A/D/E by role) | CONFLICT | GDD + D1: Sortie Salvage. Live code + `gdd-visual.test.tsx` still encode Dock Scrap ranks — Phase 3 rewrites that |
| Orbiting Core units + visual families | MISSING | Weapons mounted on `Flagship` |
| Duplicate Cores | MISSING | `canFitModuleOnFrame` rejects same `moduleId` |
| Hive Frames as archetypes | PARTIAL | 9 USI hulls + Bastion; no Swarm/Reactor/Harvester |
| Core Mastery milestones 5/10/20/…/100 | PARTIAL | Part-invest mastery, cap 10→20 at W275 |
| Relics on Cores | DONE | Power / Optical / Ballistic / Shield / Industrial / Universal. Process auto-seats Core sockets |
| Standalone Reliquary / colour slots | LEGACY | Tab still in `App.tsx`; colour bonuses disabled |
| Research visual branching tree | DONE | Tree dots + next-only names. First Hive Engineering node is Priority Lock |
| Process T1–T3 | PARTIAL | 42 nodes, 8 hidden; presets still named Strike/Ward |
| Process T4–T6 rule builder | MISSING | |
| Challenges | PARTIAL | Rules shown; confirm-launch + reward identity can deepen |
| Yard as top-level | LEGACY | Nested under Foundry at W90 — keep nested, drop standalone tab |
| Slag top-level | LEGACY | Matter belongs in Rebuild |
| Echo / Specialists / Tasks / Capital | LEGACY | Gates 999 / no-op |
| Sectors as career key | LEGACY | `requiresSectorEver` holds **wave numbers**; `combat.sector` is a 10-wave band |
| Onboarding | MISSING | `ONBOARDING_ENABLED = false` |
| Toast levels (minor / action / major) | PARTIAL | Toast stack exists; major unlocks do not persist until tap |
| Loadout comparison UI | PARTIAL | Inspect exists; Frame/Core before-after not GDD §117 |
| Game speed ×1.5/×2/×3 | PARTIAL | `sortieSpeed` / reclaim exist; unlock story is unclear |
| Enemy families GDD §11 | PARTIAL | Swarm/Armored/Ethereal/Divine/Titan — no Skirmisher/Shielded/Sniper/Support/Elite taxonomy |
| Threat-budget wave variation | DONE | `threatBudget.ts`; Sortie seed; W87 budget 100; packs vary from Wave 11 |
| Authored bosses | DONE | Named mechanic every 10th Wave; W300 is `climax-choir` |
| Offline freeze | DONE | |
| PWA / portrait | PARTIAL | Works; description still says “USI-style”; orientation `any` |
| Play Store wrap | MISSING | No TWA / Capacitor / listing assets |
| Dev tools / playtests | PARTIAL | Still sector jumps, Echo / Specialists / Task List presets (`dev.ts`, `DevTools.tsx`) |
| Codex / Stats / Settings | PARTIAL | Present; player copy uses Wave / Hive |
| Audio | MISSING | No SFX/music pipeline |
| Telemetry GDD §154–156 | PARTIAL | `sortieTelemetry.ts` + sim; not the full event set |
| README / old balance docs | LEGACY | Describe sectors, Network, USI combat |

---

## 5. Implementation phases

Order is dependency order, not calendar. Each phase is one PR off the previous. Tests + `npm run build` required. Bump `SAVE_VERSION` only when the save shape changes; pre-release wipe is fine (D10).

### Phase 0 — Align docs and freeze the plan *(this PR)*

**Intent:** one authority. Stop the old USI/sector docs from steering later work.

**Work:**

- Add this file and lock owner decisions (D1 Sortie Salvage Core Run Levels via A/D/E, no Dock Scrap Core ranks; D2 Process 1.0; D3 orbiting Cores; D5 Play wrap; D8 Frame cut; D10 no migration + mandatory cheats/playtests).
- Rewrite `README.md` to the GDD loop (Waves, Hive, Workshop, Rebuild, no sectors-as-career).
- Mark `docs/usi-reskin-plan.md` **superseded**. Keep it as history; do not follow it.
- Retitle `docs/act1-balance.md` as a **historical USI-era curve note**, or slim it to a pointer at `src/game/balance/act1.ts` + GDD §141–155. Do not use its sector doors.

**Acceptance:** a new reader of README describes the GDD game, not USI sectors. Decision Log is locked, not a list of defaults.

**SAVE_VERSION:** no.

---

### Phase 1 — Legacy excision and naming debt

**Intent:** Act 1 code paths are only GDD systems. Career language is Wave, not Sector. Dev tools jump the GDD cadence, not USI sectors.

**Files:** `App.tsx`, `types.ts`, `state.ts`, `save.ts`, `progression.ts`, `cadence.ts`, `moreStations.ts`, `sectors.ts`, `network.ts`, `echo.ts`, `specialists.ts`, `tasks.ts`, `capital.ts`, `reliquary.ts` (tab vs sockets), `components/tabs/{Echo,Specialists,Tasks,Capital,Slag,Reliquary,Yard}Tab.tsx`, `dev.ts`, `DevTools.tsx`, `playtest.ts`, tests that `expect(SAVE_VERSION).toBe(34)`.

**Work:**

1. Remove leftover tabs from `App.tsx` render/nav. Relics stay on Dock Cores. Construction stays a Foundry pane. Matter stays in Rebuild. Challenges stay on More.
2. `enterEcho`, `setSectorRoute`, `setLaunchSector`, hold/warp, Frontier Hold — already no-ops; delete call sites and dead UI. Keep a thin test that they are gone.
3. Rename player-facing “sector” to Wave. Internally: keep `powerSectorForWave` as a **band helper** with a new name (`waveBand` / `threatBand`). Stop writing `requiresSectorEver` in new code; add `requiresBestWave` and migrate callers.
4. Isolate or delete `NETWORK_BARS` combat UI. Yield/Loom/Archive multipliers must move onto Worker jobs or die (GDD §63: workers are not +damage/+shield; industrial speed is allowed).
5. **Rewrite dev tools and playtest seeds in this PR** (D10). See §5a. `jump-sector` becomes career Best Wave + live Wave. Delete Echo / Specialists / Task List / Capital / S18–S80 USI door buttons. Add GDD door presets (W20 / 30 / 50 / 70 / 140 / 170 / 210 / 250 / 300).
6. Strip Process categories/presets named Strike/Ward/Echo.
7. **Done.** Codex/inspect/help strings: Hive, Wave, Worker Drone, Challenge — not Flagship, Sector, Compute, Warp, Echo.

**Acceptance:**

- `gdd-removed-loop.test.ts` still passes; expand it so Reliquary/Slag/Echo/Specialists/Tasks/Capital are not routable tabs.
- `TabId` shrinks or unused ids are unused.
- No player-facing “Sector N” except as a buried debug label.
- Dev tools can open each GDD door from a wipe without touching leftover systems. Playtest report speaks Wave / Workshop / Rebuild.

**Tests:** update every `SAVE_VERSION === 34` pin if you bump; prefer not bumping unless save keys change.

**SAVE_VERSION:** bump if Network bar state or Echo fields are dropped from the save.

---

### 5a. Standing rule — Dev tools and playtests (D10)

Owner lock: **updated cheats and playtests are required**, not optional polish. Every gameplay PR that changes a door, resource, or loop must leave `dev.ts`, `DevTools.tsx`, `playtest.ts`, and the simulator able to exercise that change.

Current leftovers to kill in Phase 1 (`dev.ts`, `DevTools.tsx`):

- `jump-sector` / Sector number box / `S8 S18 S22 S51 S72 S75 S80`
- `prepDoor` for Protocols@18, Echo@22, Specialists@51, Task List / Capital / Reinforce@80
- `seed-late-game` writing Echo clears, Specialist ranks, Task List
- `force-boss-wave` via `wavesForSector`
- Resource grants for essence / challengePoints / yard goods if those leave Act 1
- Copy that says “sector”

Required surface after Phase 1 (extend in later phases):

| Control | Behaviour |
|---|---|
| Set Best Wave | Sets `bestWave` / `highestSectorEver` alias and grants doors |
| Set live Wave | In-sortie wave only; does not grant career |
| Door presets | W20 Foundry, W30 Workers, W50 Directives, W70 Rebuild (legal + 3 sorties), W110 Relics, W140 Furnace, W170 Research, W210 Process (also 2 Rebuilds + 1 research), W250 Challenges, W300 climax / Reinforce |
| +Resources | Scrap, Salvage, Matter, Ash, Heat, Foundry mats, Process points — GDD names |
| Set Core Run Levels | Salvage Run Levels on fitted Cores (Sortie only; does not grant Mastery) |
| Set Core Mastery | Permanent Mastery only |
| Force boss | Next or current 10th-wave boss / W300 climax |
| Skip / reset onboarding | Keep |
| Wipe career | Keep (pre-1.0 wipes are expected) |
| Balance Simulator + Playtest report | Keep; report fields match GDD §154 |

Automated playtests (`playtest.ts`, `src/game/simulation/**`, `gdd-*.test.ts` helpers) must launch at Wave 1, spend Scrap at Dock for Core ranks, and use `ACT1_CADENCE` doors. No Route B, Hold, Echo, or starting-wave helpers in new tests.

When Phase 2 adds orbiting Cores, add a “show hitboxes / orbit debug” toggle. **Done (Phase 7).** Dev Tools can inject Farm / Push Process profiles. When Phase 10 wraps Android, confirm `?dev=1` still works in the TWA (or a long-press More gesture).

---

### Phase 2 — Hive combat presentation and wave language

**Intent:** the player sees a Hive in the middle and Cores working. Enemies come from around it. Waves read as GDD families.

**Files:** `combat.ts`, `waves.ts`, `Battlefield.tsx`, `catalog.ts` (enemy defs), `sortie-feel` / `gdd-visual` / `combat.test.ts`.

**Work:**

1. Rename the player combatant to Hive. Keep one hull/shield pool (GDD §19: Cores have no HP).
2. Spawn equipped Cores as satellite units: orbit radius + behaviour by family (Flak close, Beam mid, Lance outer, Barrier geometry, Repair pulses, Utility outward ticks). They fire; the Hive is the target.
3. Drive Core position from `heading` + orbit, not lane `y`. Finish retiring lane-only movement for enemies.
4. Core visual identity: distinct projectile / beam / burst / pulse per family (GDD §160). Restrained damage numbers; default Minimal/Standard (GDD §113).
5. Enemy taxonomy pass (GDD §11–12):

   | Wave | Introduce |
   |---:|---|
   | 1–9 | Basic |
   | 10–19 | Swarm |
   | 20–39 | Skirmisher |
   | 40–69 | Armoured |
   | 70–99 | Shielded |
   | 100–139 | Sniper (must close into lowest valid weapon range) |
   | 140–179 | Support |
   | 180–219 | Mixed |
   | 220–259 | Elite modifiers |
   | 260–299 | Complex mixes |
   | 300 | Act 1 boss |

6. **Done.** Threat-budget generator (GDD §10): each wave band has budget, density, allowed families, elite chance. Seed stored on the Sortie for telemetry.
7. **Done.** Boss every 10th wave: a **mechanic**, not only HP (telegraph, add spawn, shield phase, support aura). W300 stays authored climax (`climax-choir`).
8. **Done.** Sortie HUD is Wave / Salvage / Scrap / Speed. Combat logs, Stats, inspect, Codex help, and Sortie diagnostics say Wave / Hive, not Sector / Flagship.

**Acceptance:**

- Screenshot/test: Hive near centre, ≥2 distinct Core orbits, enemy headings wrap 360°.
- A Sniper eventually enters Pulse range.
- `encounterForWave(10).isBoss` remains true; W10/20/… have a named mechanic id.
- No Core is permanently out of range of legal targets.

**SAVE_VERSION:** only if unit shape on save changes (usually combat is ephemeral).

---

### Phase 3 — Buildcraft: Frames, Cores, Relics, loadout UI

**Intent:** build identity is Frame + Cores + Relics. Cores level in the Sortie through Attack / Defense / Economy. Dock never spends Scrap on Core ranks (D1).

**Files:** `catalog.ts` (`SHIP_FRAMES`, `SHIP_MODULES`), `actions.ts` (`upgradeModule`, `fitModule`, `canFitModuleOnFrame`), `workshop.ts` (`coreStarts`), `CombatTab.tsx`, `DockTab.tsx`, `inspect.ts`, `reliquary.ts`, `gdd-visual.test.tsx`, `gdd-sortie-loop.test.ts`.

**Work:**

1. **Remove Dock Scrap Core ranks.** Delete `workshop.coreStarts`, Dock “Upgrade · N Scrap” on Cores, and any Scrap cost on `upgradeModule`. Dock Loadout is equip / Relics / Mastery inspect only.
2. **Salvage Run Levels on fitted Cores during the Sortie** (GDD §22, §115). Paid with Salvage. Reset to 0 when the Sortie ends (Extract or death). Rebuild also clears them because the Sortie is gone.
3. **Buy them through Attack / Defense / Economy by role:**
   - Weapon Cores (Pulse, Beam, Flak, Lance, …) under **Attack**
   - Defense Cores (Plate, Barrier, Repair, …) under **Defense**
   - Utility Cores (Salvage, targeting, …) under **Economy**
   Fitted Cores of that role appear as cards in that shop pane (Run Lv, next Salvage cost, Buy). The Cores sheet can show the same buy or deep-link to the pane. Global A/D/E upgrades (Weapon Power, Hull, Salvage/Kill, …) stay as they are and still use Workshop starts + Salvage buys (GDD §36).
4. **Mastery is the only persistent per-Core stat.** Slow, account-wide. Milestones at 5 / 10 / 20 / 30 / 50 (75/100 remote). Socket unlocks and behaviour mods live here. Mastery is not bought with Scrap.
5. **Done (D8).** USI hull ladder wiped for Starter + Bastion / Swarm / Reactor / Harvester (`SAVE_VERSION` 35).
6. **Done.** Bastion = Wave 70. Swarm = Foundry Temper Bar. Reactor = Research Extra Tap. Harvester = Swarm Pressure first clear.
7. **Done.** Duplicate Core types; limits are Frame slot counts and role caps.
8. **Done.** Slot curve 2 / 5 / 6 / 4 / 5.
9. **Done (this slice).** Relic sockets: Power / Optical / Ballistic / Shield / Industrial / Universal. Focus Lens + Burst Mesh families. Process auto-relic seats Core sockets. Dock Upgrade Relic. Reactor / Sensor still later.
10. **Done.** Dock Loadout comparison shows Hull / Shield / DPS / slots before → after. Locked Frames list their unlock line.
11. **Done (this slice).** Core roster whitelist (Pulse, Beam, Flak, Lance, Plate, Barrier, Lathe, Drone Bay, Charge Prism, Choir Tap). Leftovers hide unless already unlocked.
12. **Done (this slice).** Acquisition copy: assemble then fit at Dock. Mid-Sortie assemble toasts “available next Sortie.”
13. Rewrite `gdd-visual.test.tsx` and any “inspect-only Cores / Scrap at Dock” assertions. Add tests: Salvage Run Level on Pulse lives under Attack; Plate under Defense; reset on Extract; Dock cannot spend Scrap on a Core; Mastery survives Rebuild.
14. **Done.** Dev Tools Frame picker (Starter / Bastion / Swarm / Reactor / Harvester) + Run Levels / Mastery. USI hull cheats gone.

**Acceptance:**

- Player can run 3 Pulse + 1 Barrier + 1 Salvage on Swarm Frame and Salvage-level each Pulse separately under Attack.
- Switching Bastion ↔ Swarm shows % deltas without leaving Dock.
- Mid-Sortie Salvage raises Core Run Levels. Dock Scrap cannot. Extract/defeat returns Run Levels to 0.
- Mastery and Relics persist through Rebuild. Workshop still starts global Weapon Power / Hull / etc.

**SAVE_VERSION:** yes (drop `coreStarts`, add run-level fields). Hard wipe is fine (D10).

---

### Phase 4 — Industry: Workers and Foundry as one factory

**Intent:** Worker Drones allocate real work. Foundry is processing + timed fabrication. Construction is a Foundry layer.

**Files:** `workers.ts`, `foundry.ts`, `yard.ts`, `NetworkTab.tsx` (rename), `FoundryTab.tsx`, `systemsHub.ts`, `catalog.ts` `STATIONS` / `FOUNDRY_RECIPES`.

**Work:**

1. **Done (this slice).** Manufacture bar gone. Assignment screen is **jobs**: Processing, Fabrication, Research, Drone production, Construction, Salvage ops.
2. **Done (this slice).** Each job shows `{assigned}/{efficient} efficient · cap {hard}`. Construction remains 4 / 8.
3. Drone production is a real investment (workers now vs more workers later). Slow. Unchanged this slice.
4. **Done (presentation).** Foundry panes: **Processing** vs **Fabrication**. Timed fabrication slots still deferred (would want SAVE 37; 36 was used for Process profiles).
5. **Done (table).** Mastery steps render per recipe. Rare-chance column still later.
6. **Done (this slice).** Mid-Sortie assemble → “available next Sortie”; cannot refit live.
7. Times: first job ~30s, early component 2–5 min, early Core 5–15 min. Deferred with timed fab.
8. **Done (this slice).** Hub cards show Temper Bar Mastery, running recipe, idle drones.
9. Overflow no longer dumps to `train-*`. Stations remain in catalog this slice.

**Acceptance:**

- No Strike/Ward assign target.
- A player who never opens Foundry is slower by S/W mid-Act, but the first hour still works (GDD system-value idea).
- Hub cards do not require entering the pane to know “something is done.”

**SAVE_VERSION:** likely yes (drop `network` bar levels or migrate into job state).

---

### Phase 5 — Research tree and Matter shop identity

**Intent:** Research is breakthroughs, not a third stat shop. Matter is the exponential engine inside Rebuild.

**Files:** `hiveResearch.ts`, `ResearchTab.tsx`, `rebuild.ts`, `RebuildHangar.tsx`, leftover `buyResearch` string shop in `actions.ts` / `catalog.ts`.

**Work:**

1. **Done (freeze).** Leftover `research.unlocked` shop no longer grants damage, essence, or training power. Station unlock keys stay (`alloy-smelting`, `drone-logistics`, …).
2. **Done.** Visual tree per discipline; only the next project is named (GDD §138).
3. **Done (first cut).** Hive Engineering opens on Priority Lock (targeting). Later incrementals still exist.
4. **Done already.** 1 active project; Worker Sensor Net assist; queue/second slot still later.
5. **Done.** Matter shop is Rebuild-only, grouped Offensive / Defensive / Industrial / Foundation / Temporal. Workshop Kit + Reclaim Clock added. No Slag tab.
6. **Done.** RESET / KEEP / GAIN labels plus Edge ×1.15 vs Workshop Weapon Power ×1.08 preview.

**Acceptance:** first Research unlock is one project with a duration and a permanent rule change. Matter purchases are visibly stronger than Workshop.

**SAVE_VERSION:** if old research shop keys die.

---

### Phase 6 — Onboarding, toasts, progressive disclosure

**Intent:** the first hour teaches the loop with real actions. Advanced UI arrives when the player has earned it.

**Depends on D9. Best after Phases 2–3 so the screens being taught are the real ones.**

**Files:** `progression.ts` (`ONBOARDING_ENABLED`, `GUIDE_STEPS`), `GuideOverlay.tsx`, `toasts.ts`, `playerGuidance.ts`, `screenHelp.ts`.

**Work:** **Done.** GDD §125–140 as a checklist, one concept / one action / one payoff / end. `ONBOARDING_ENABLED` is true. Skip is never blocked; skip groups are per door.

| Step | Trigger | Action |
|---|---|---|
| Launch | New career, Dock | Launch — no loadout required |
| First Salvage | Enough Salvage | **Pause.** Buy one upgrade. Show stat change. Resume |
| Defense (optional) | Real hull pressure | Suggest Hull/Shield; do not force |
| First defeat | Sortie complete | Wave, New Best, Scrap, drops → introduce Workshop |
| First Workshop | Dock after first defeat | One Scrap purchase; “next Sortie starts Weapon Power Lv1” |
| Second Sortie | Launch | “Workshop carried in” |
| Foundry | Door + enough material for a real first job | Process → start job → Mastery → offline |
| Workers | Door | Assign 1 drone; show time 60s → 52s |
| Directive | W50 | Pause, pick 1 of 3, show effect |
| Relic | First drop | Dock: empty socket → install → stat change |
| Rebuild | Door | RESET / KEEP / GAIN; do not force confirm |
| Furnace | Door + enough Ash | Ash persists; Heat is this Sortie; large mult |
| Research | Door | One project, duration, offline |
| Process | Door + history | “You bought N upgrades; automate that.” One QoL. No rule builder yet |
| Challenge | Door | Restriction, goal, reward, disabled, best — confirm |

Also:

- **Done.** Toast tiers: minor / action (deep-link) / major unlock queued until tap (GDD §124).
- **Done.** Progressive disclosure: ×10 / MAX / AUTO / DPS share locked to Process or Research (GDD §122).
- **Done (first cut).** Universal information audit (GDD §123) on Sortie/Workshop tiles (This Sortie / Until Rebuild), Rebuild RESET/KEEP/GAIN, Challenge confirm.
- **Done.** Re-enable `ONBOARDING_ENABLED`. Skip never blocked. Skipping a door does not skip a later system’s first lesson.

**Acceptance:** a fresh state can complete Launch → Salvage buy → death → Workshop buy → second Launch without opening More. `gdd-furnace.test.ts` onboarding assertion updates to `true`.

**SAVE_VERSION:** if `seenOnboarding` shape changes.

---

### Phase 7 — Process as earned automation

**Intent:** manual → convenience → auto → priority → condition → profiles (GDD §84). **In the 1.0 train (D2).**

**Files:** `process.ts`, `processProfiles.ts`, `ProcessTab.tsx`, `automation.ts`, `tick.ts`, `workshop.ts`, `UpgradeGrid.tsx`.

**Work:** **Done.** QoL → Actions → Priorities → Conditions → Cross-system → Farm / Push / Challenge (D2).

1. **Done (T1 QoL).** Shop Readout (`shop-readout`) shows time-to-afford and Economy ROI on Salvage / Workshop tiles. ×10, Buy Max, contribution %, repeat recipe, presets already existed.
2. **Done (T2 Actions).** `auto-shop` spends Salvage on Attack / Defense / Economy globals during a live Sortie. Core Auto Upgrade and Worker presets already existed.
3. **Done (T3 Priorities).** `spend-ratios` sets Attack / Defense / Economy targets plus a Salvage reserve. Core / Foundry / Worker priorities already existed.
4. **Done (T4 Conditions).** Chip builder (`rule-builder`): WHEN Wave ≥ N / % of Best / threat / queue empty / Ash / hull / Research idle THEN spend / extract / Furnace push / recipe. Selectors + numbers only.
5. **Done (T5 Cross-system).** Push profile at 95% of Best dumps Economy and converts Ash → Heat → Weapons channel. Research auto-queue and tracked fab remain existing later nodes.
6. **Done (T6 Profiles).** Farm / Push / Challenge (`run-profiles`). Farm banks Economy and Extracts at 50% hull. Push dumps Economy near Best and lights Furnace. Challenge leans Defense on Survivability. **No closed-app Sortie sim** (GDD §90, §167).
7. **Done already.** Mastery gates from `processLessonCount`.
8. **Done already.** Process Points stay achievement-shaped.
9. **Done.** First-open still hides priorities and the builder. Builder is a later node after two purchases.

**Acceptance:**

- **Done.** Farm auto-buys Economy first and Extracts; Push dumps Economy after 95% of Best and lights Furnace (`gdd-process.test.ts`).
- **Done.** No typed code. Selectors + chips + numbers only.
- **Done.** Hidden nodes stay hidden: `offline-sortie`, `auto-bank`, `echo-repeat`, `network-tune`.

**SAVE_VERSION:** 36 (rule list + profiles).

---

### Phase 8 — Content depth, Challenges, speed, finale feel

**Intent:** enough variety that systems stay relevant through W300. Not a second game.

**Work:**

1. Run shop expansion after the starter pair: Cycle Rate @10 (exists), then Crit / Pen / Regen / Armor / Scrap/Kill / Fragment / Ash as **gated later options**, not dump-at-once (GDD §33–35).
2. Challenge presentation: restriction, goal (Reach W150…), reward, disabled systems, current best, confirm (GDD §97). Rewards expand the tested system (Relic, Research node, Process, blueprint) — not global damage.
3. Game speed unlocks ×1.5 / ×2 / ×3 via Rebuild / Research / Process. Reclaim acceleration remains **time compression**, not extra DPS (GDD §72, §106).
4. W300: authored phases, readable telegraphs, Reinforce fiction line (Rebuild = knowledge backward; Reinforce = change the loop). No Act 2 shop required.
5. Codex: family silhouettes and counters, filled by encounter, not a wiki dump.
6. Flavour: short Foundry logs / milestone lines only (GDD §4.2). No cutscenes.
7. Cut leftover catalog junk (old challenge-shop ranks, AI doctrines, essence if unused).

**Acceptance:** Appendix D health checklist can be run in the simulator without “SYSTEM IRRELEVANT” on Foundry, Workers, Furnace, Research.

**SAVE_VERSION:** only if new reward fields.

---

### Phase 9 — Balance, telemetry, feel, ship

**Intent:** the four curves are independently tunable; casual/balanced profiles beat the Act without TAS play.

**Files:** `src/game/balance/act1.ts`, `src/game/simulation/**`, `sortieTelemetry.ts`, `playtest.ts`, VFX/audio if added, `index.html`, PWA manifest, `package.json` version.

**Work:**

1. Expose named curves: enemy HP/dmg vs Wave; Salvage income; Scrap income; Workshop starting power; Matter. Change one layer per balance PR after this phase’s first land.
2. Simulator profiles: Casual, Balanced, Offensive, Defensive, Economy First, Optimiser (GDD §153). Gate CI on Casual/Balanced windows, not Optimiser.
3. Warning detectors: WALL, HARD WALL, STEAMROLL, ECON TRAP, DEAD/DOMINANT UPGRADE, SYSTEM IRRELEVANT/DOMINANT, REBUILD WEAK/EXPLOSIVE (GDD §155).
4. Targets (validate, do not hard-code as time gates):

   | Beat | Active-equivalent |
   |---|---|
   | First defeat | 3–5 min |
   | Foundry | 30–60 min |
   | First Rebuild | 2–4 h |
   | Process | 24–36 h |
   | W300 | 70–100 h |

   Sortie lengths: open 3–5, early 5–12, mid 10–20, late 15–30. Compress with speed + reclaim if late runs exceed that.
   Rebuild recovery: return to previous Best in ~20–40% of original time. Then +5–15 Best over the next pushes.

5. Sortie telemetry blob (GDD §154): seed, start Best, end Wave, duration, death cause, spend shares, Directives, Furnace, New Best delta, extract vs death.
6. Audio/VFX only on meaningful events (GDD §159). Readable over spectacle. Optional mute in Settings.
7. PWA: portrait-first (`orientation` portrait-primary), fix meta description, install prompt copy, cache bust already tested. This is the web ship **and** the body of the Play wrap.
8. Settings: notation, damage-number mode, reduced motion (exists), export/import, wipe career.
9. Manual playtest script using the rewritten cheats: first 30 min from a wipe; first Rebuild via W70 preset; one Furnace push; one Challenge; W300 climax. Record gaps in the playtest report, not in ad-hoc notes.
10. Version `1.0.0` when Phase 9 + 10 are green. Dev tools stay behind `?dev=1` / More toggle and must still match the shipped cadence.

**Acceptance:** Casual profile hits first Rebuild inside the pad; Balanced does not skip Foundry/Workers; Optimiser is faster but not a different game. W300 is a peak on a slope, not a 10× cliff then a trivial W301. A tester can reproduce each beat from Dev Tools without sector leftovers.

**SAVE_VERSION:** freeze a release number; start migrations after the public tag.

---

### Phase 10 — Play Store wrap

**Intent:** the same Hiveworks build installs from the browser (PWA) and from Google Play. One game, two skins around it.

**Approach:** Trusted Web Activity (Chrome **Bubblewrap** / `@bubblewrap/cli`) wrapping the production PWA origin (`https://chrisf92.github.io/Idle-/` or a custom domain if one exists by then). Do **not** fork the sim into a second Capacitor app unless D6 later needs Play Billing.

**Repo work (agent can do):**

1. `android/` (or `store/android/`) generated by Bubblewrap; commit the Gradle project or a documented generate script.
2. Application id e.g. `com.hiveworks.app` (confirm before first upload — cannot change later).
3. Portrait lock, `display: standalone`, Digital Asset Links (`assetlinks.json`) so the TWA opens without the Chrome URL bar.
4. Store assets in `store/play/`: 512 icon, feature graphic, phone screenshots (portrait Sortie + Dock + Systems), short/full description, content rating notes (violence: abstract space combat).
5. Privacy policy page (local save only; no account; export/import). Required for Play.
6. Target current Play API level; 64-bit; no ads SDK.
7. Signing: document upload-key vs app-signing. **Do not commit a production keystore.** Owner keeps the key.
8. QA: install TWA, Launch → first Salvage, background/resume (Sortie freeze + industry), export/import, `?dev=1` if exposed.

**Owner-only (cannot be done from this repo alone):**

- Google Play Console account + one-time developer fee
- Create the app listing, content rating questionnaire, target countries
- Upload AAB, roll out internal testing → production
- If a custom domain is preferred over GitHub Pages, DNS + HTTPS

**If D6 later becomes “yes”:** add Play Billing (then Capacitor or a thin native billing bridge is justified). Until then, no IAP code.

**Acceptance:** internal-track AAB installs, runs portrait, uses the same save format as the PWA (export/import between them is nice-to-have, not required — different origins). No Chrome toolbar. Listing copy matches the GDD loop, not USI.

**SAVE_VERSION:** no.

---

## 6. Suggested PR sequence (compact)

| PR | Phase | Player-visible? |
|---|---|---|
| 0 | Docs + this plan + locked decisions | no |
| 1 | Legacy excision + Wave naming + **dev/playtest rewrite** | yes (cleaner IA + cheats) |
| 2 | Hive + orbiting Cores + families | yes (the game’s look) |
| 3 | GDD Frames / Sortie A/D/E Core Run Levels / loadout UI | yes (buildcraft) |
| 4 | Workers + Foundry factory | yes |
| 5 | Research tree + Matter shop | yes |
| 6 | Onboarding + toasts | yes |
| 7 | Process rules + profiles (1.0) | yes (late) |
| 8 | Content / Challenges / finale | yes |
| 9 | Balance + PWA polish + playtest script | yes |
| 10 | Play Store TWA wrap + listing assets | store |

D1 / D3 / D8 are locked — Phases 2 and 3 can proceed without another design pass. Phase 7 is in the 1.0 train. Phase 10 can start in parallel with 9 once the PWA origin and portrait manifest are stable. Do not retune curves (9) until 2–5 exist.

**Every PR after 1:** if a door, Frame, Core, or resource changes, update Dev Tools + playtest helpers in that same PR.

---

## 7. Explicitly out of scope for Act 1 launch

From GDD §99–101, §166–167:

- Echo, Route A/B, Frontier Hold, starting-wave select
- Network-as-combat-multiplier
- Standalone Reliquary / Slag / Yard tabs
- Specialists, Capital, Task List, fleet combat
- Full offline autonomous Sorties
- PvP, guilds, battle pass, gacha, ads, energy, FOMO
- Tower placement, manual Hive movement
- Act 2 Reinforce mechanics beyond the door + fiction
- Play Billing / supporter IAP unless D6 flips to yes
- Pre-1.0 save migration (wipes are expected)

---

## 8. Engineering constraints (do not regress)

- Simulation stays in `src/game/`. React is view + input.
- Deterministic combat: Sortie seed in telemetry.
- One feature per PR.
- `npm test` and `npm run build` green.
- Portrait-first; combat arena ~45–50%, shop sheet ~35–40% (GDD §111).
- Pre-release save wipes are OK; announce on More.
- Do not retune S1–early feel to “fix” late Act 1 (same lesson as the old act1-balance note).
- When asked for a fix and an exploit/debug jump, keep official cheats in `?dev=1` only.

---

## 9. File map (where work will land)

| Concern | Primary files |
|---|---|
| Loop / dock / death | `tick.ts`, `workshop.ts`, `rebuild.ts`, `reinforce.ts` |
| Combat / waves | `combat.ts`, `waves.ts`, `Battlefield.tsx` |
| Cores / frames / relics | `catalog.ts`, `actions.ts`, `reliquary.ts`, `inspect.ts` |
| Industry | `foundry.ts`, `workers.ts`, `yard.ts`, `furnace.ts` |
| Research / Process | `hiveResearch.ts`, `process.ts`, `processProfiles.ts`, `automation.ts` |
| Challenges | `protocols.ts` |
| Cadence / unlocks | `cadence.ts`, `progression.ts`, `moreStations.ts`, `systemsHub.ts` |
| Save | `state.ts`, `save.ts`, `types.ts` |
| UI shell | `App.tsx`, `TabNav.tsx`, `CombatTab.tsx`, `DockTab.tsx`, `SystemsTab.tsx` |
| Balance | `balance/act1.ts`, `simulation/**`, `sortieTelemetry.ts` |
| Onboarding | `progression.ts`, `GuideOverlay.tsx`, `toasts.ts` |
| Dev / playtest | `dev.ts`, `DevTools.tsx`, `playtest.ts` |
| Play wrap | `store/` (new), Bubblewrap `android/` (new), `vite.config.ts` manifest |

---

## 10. Contract tests to keep vs rewrite

**Keep as regression (they already express GDD):**  
`gdd-sortie-loop`, `gdd-rebuild`, `gdd-reinforce`, `gdd-directives`, `gdd-furnace`, `gdd-workers`, `gdd-foundry-construction`, `gdd-research`, `gdd-process` (T1–T3 gates), `gdd-challenges`, `gdd-relics`, `gdd-mastery`, `gdd-removed-loop`, `gdd-ui-ia`, `gdd-offline`, `gdd-cadence`.

**Rewrite for D1 (current tests encode the discarded Dock Scrap experiment):**  
`gdd-visual.test.tsx` (inspect-only Cores / Scrap ranks), `gdd-sortie-loop` if it forbids Salvage Core buys. New contract: Salvage Run Levels by role under A/D/E; no Dock Scrap Core ranks; Mastery persists.

**Add:**

- Hive + orbit unit tests (positions, range rule).
- Threat-budget invariance (two seeds, similar effective HP) — `gdd-threat-budget.test.ts`.
- Frame archetype comparison readout.
- Process rule evaluation (WHEN/THEN).
- Onboarding path (enabled).
- No leftover tab ids in More/Systems.
- Dev Tools: each GDD door preset grants that system and no removed one.
- Playtest / sim: Wave-1 launch, Salvage Core Run Levels via A/D/E, `ACT1_CADENCE` doors. No Scrap Core ranks.

---

## 11. Remaining questions

1. **D6 Supporter SKU** — optional cosmetic Play purchase (see §2). Stay **no IAP** unless you want it. Not needed for the wrap.
2. **Play application id + listing publisher name** — needed before the first AAB upload (Phase 10).
3. **Production origin** — keep `https://chrisf92.github.io/Idle-/` for the TWA, or move to a custom domain?

Phase 1 can start now.
