# Hiveworks — Act 1 Release Implementation Plan

**Status:** living working document  
**Authority:** [`Hiveworks_Game_Design_Document_v1.0.md`](../Hiveworks_Game_Design_Document_v1.0.md)  
**Code snapshot:** `main` @ `83d3350` (SAVE_VERSION 34, package `0.1.0`)  
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

**Not required for v1.0** (GDD §162, §167): Play Store native wrap, supporter IAP, PvP, guilds, Echo, Capital, Specialists, Task List, fleet combat, full offline Sortie simulation, random-affix relic loot, ads, energy, battle pass.

**Platform lock for v1.0:** portrait-first PWA (Android install from HTTPS + browser). Native store wrap is post-launch unless Decision D5 changes.

---

## 2. Decision Log

Answer these before the named phase starts. Until answered, use the **Default**.

| ID | Question | Why it matters | Default until answered | Blocks |
|---|---|---|---|---|
| **D1** | Core power: GDD §22 Salvage **Run Levels** during Sortie, or current **Dock Scrap ranks** (`workshop.coreStarts`, commit `2ae52cf`)? | Largest GDD/code conflict. Tests currently encode Dock Scrap. | **Follow GDD §22.** Salvage buys temporary Core Run Levels in Sortie. Dock Scrap ranks become Workshop *starting* Core levels (cycle). Sortie Cores are not inspect-only. | Phase 3 |
| **D2** | Is Process Tier 4–6 (mobile WHEN/THEN rule builder + Farm/Push/Challenge profiles) launch-required? | GDD §83–94 calls this a signature late-Act system. | **Yes for launch**, shipped after T1–T3 polish. Thin the rule vocabulary, do not skip the builder. | Phase 7 |
| **D3** | Combat presentation: orbiting Core units around a central Hive, or keep flagship-mounted weapons with Hive branding? | GDD §13, §18, §110, §160. Current sim is `Flagship` + `buildFlagshipWeapons`. | **Orbiting Cores required.** Sim can keep a single Hive hull; weapons become per-Core units. | Phase 2 |
| **D4** | Delete gated leftovers (Echo, Specialists, Tasks, Capital, Slag tab, Reliquary tab, Network bars, Route B, `sectors.ts` hold/warp) or keep code for Act 2? | Dead paths still import in `App.tsx` and confuse tests/saves. | **Unwire from UI now. Delete or isolate behind `src/game/legacy/` only if a later Act needs the types.** Capital/Specialists/Tasks stay deferred, not half-reachable. | Phase 1 |
| **D5** | Is PWA-on-GitHub-Pages the v1.0 ship target, or is a Play Store APK required? | Scope of install, IAP, orientation lock. | **PWA only.** Portrait-first, installable, offline cache. | Phase 9 |
| **D6** | Supporter upgrade / cosmetics at launch? | GDD §162 allows it; nothing is wired. | **No IAP at v1.0.** Leave a Settings hook for themes only. | Phase 9 |
| **D7** | How authored does combat content need to be? | GDD §9–12 wants threat-budget waves + authored bosses, not only sector-band templates. | **Procedural normal waves with a written threat budget. Authored unique mechanics for every 10th-wave boss band and W300.** Not 300 unique scripts. | Phase 2, 8 |
| **D8** | Frames: replace the USI hull ladder (Scout→Capital) with Bastion / Swarm / Reactor / Harvester sidegrades? | Current `SHIP_FRAMES` are linear hulls plus one Bastion. | **Yes.** Starter balanced Frame + 3 archetypes unlocking by wave/Foundry/Research/Challenge. Old hull IDs migrate or wipe (pre-release). | Phase 3 |
| **D9** | Onboarding: enable `ONBOARDING_ENABLED` for launch? | Currently `false`. Guides exist but are off. | **Yes.** Rewrite to GDD §125–140. Skip always available. | Phase 6 |
| **D10** | Save policy at release? | Pre-release bumps already wipe. Shipping a live audience changes this. | **Hard wipe OK until first public v1.0 tag.** After that, migrate. Document in More. | any SAVE_VERSION bump |

When a default is wrong, edit this table and the affected phase. Do not leave two authorities.

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

What is *not* done is the **identity pass**: Hive + orbiting Cores, GDD Frames, GDD Core run levels (D1), Network retirement, enemy taxonomy, Process rule builder, onboarding, leftover deletion, and a balance pass that treats the four GDD curves as first-class.

---

## 4. Gap matrix

Status: **DONE** matches GDD · **PARTIAL** exists but diverges · **MISSING** · **LEGACY** should leave Act 1 · **CONFLICT** GDD vs recent main.

| System | Status | Notes |
|---|---|---|
| Sortie loop (W1, auto-combat, death/Extract) | DONE | Extract +12% Scrap |
| Salvage Attack/Defense/Economy shop | PARTIAL | Only 6 upgrades; later crit/pen/armor/scrap-kill missing |
| Workshop | DONE | Caps 80; preview Current/Next exists |
| Rebuild + Matter + Rebuild UI facts | DONE | Decision copy landed in `83d3350` |
| Reinforce door after W300 | PARTIAL | Door exists; Act 2 rules correctly deferred; climax needs feel |
| Directives | DONE | |
| Furnace push channels | DONE | Extra non-GDD channels still in types |
| Foundry processing + fabrication | PARTIAL | 18 recipes; mastery shorter than GDD table; UI still “smelter” flavoured |
| Worker Drones | PARTIAL | Jobs exist; Network bar UI + fill still live |
| Network Strike/Ward/Yield bars | LEGACY | Combat mults = 1; Yield/Loom/Archive still multiply |
| Core Salvage Run Levels | CONFLICT | GDD §22 vs Dock Scrap ranks + `gdd-visual.test.tsx` |
| Orbiting Core units + visual families | MISSING | Weapons mounted on `Flagship` |
| Duplicate Cores | MISSING | `canFitModuleOnFrame` rejects same `moduleId` |
| Hive Frames as archetypes | PARTIAL | 9 USI hulls + Bastion; no Swarm/Reactor/Harvester |
| Core Mastery milestones 5/10/20/…/100 | PARTIAL | Part-invest mastery, cap 10→20 at W275 |
| Relics on Cores | DONE | Socket classes thinner than GDD 9-class set |
| Standalone Reliquary / colour slots | LEGACY | Tab still in `App.tsx`; colour bonuses disabled |
| Research visual branching tree | PARTIAL | 4×9 nodes, preview-one; not a reconnecting tree |
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
| Threat-budget wave variation | PARTIAL | `buildWavePack` + sector templates; no seedable budget |
| Authored bosses | PARTIAL | Every 10th is a boss; W300 climax exists; most are scaled fatties |
| Offline freeze | DONE | |
| PWA / portrait | PARTIAL | Works; description still says “USI-style”; orientation `any` |
| Codex / Stats / Settings | PARTIAL | Present; copy still hull/sector flavoured |
| Audio | MISSING | No SFX/music pipeline |
| Telemetry GDD §154–156 | PARTIAL | `sortieTelemetry.ts` + sim; not the full event set |
| README / old balance docs | LEGACY | Describe sectors, Network, USI combat |

---

## 5. Implementation phases

Order is dependency order, not calendar. Each phase is one PR off the previous. Tests + `npm run build` required. Bump `SAVE_VERSION` only when the save shape changes; pre-release wipe is fine (D10).

### Phase 0 — Align docs and freeze the plan *(this PR)*

**Intent:** one authority. Stop the old USI/sector docs from steering later work.

**Work:**

- Add this file.
- Rewrite `README.md` to the GDD loop (Waves, Hive, Workshop, Rebuild, no sectors-as-career).
- Mark `docs/usi-reskin-plan.md` **superseded**. Keep it as history; do not follow it.
- Retitle `docs/act1-balance.md` as a **historical USI-era curve note**, or slim it to a pointer at `src/game/balance/act1.ts` + GDD §141–155. Do not use its sector doors.

**Acceptance:** a new reader of README describes the GDD game, not USI sectors.

**SAVE_VERSION:** no.

---

### Phase 1 — Legacy excision and naming debt

**Intent:** Act 1 code paths are only GDD systems. Career language is Wave, not Sector.

**Files:** `App.tsx`, `types.ts`, `state.ts`, `save.ts`, `progression.ts`, `cadence.ts`, `moreStations.ts`, `sectors.ts`, `network.ts`, `echo.ts`, `specialists.ts`, `tasks.ts`, `capital.ts`, `reliquary.ts` (tab vs sockets), `components/tabs/{Echo,Specialists,Tasks,Capital,Slag,Reliquary,Yard}Tab.tsx`, tests that `expect(SAVE_VERSION).toBe(34)`.

**Work:**

1. Remove leftover tabs from `App.tsx` render/nav. Relics stay on Dock Cores. Construction stays a Foundry pane. Matter stays in Rebuild. Challenges stay on More.
2. `enterEcho`, `setSectorRoute`, `setLaunchSector`, hold/warp, Frontier Hold — already no-ops; delete call sites and dead UI. Keep a thin test that they are gone.
3. Rename player-facing “sector” to Wave. Internally: keep `powerSectorForWave` as a **band helper** with a new name (`waveBand` / `threatBand`). Stop writing `requiresSectorEver` in new code; add `requiresBestWave` and migrate callers.
4. Isolate or delete `NETWORK_BARS` combat UI. Yield/Loom/Archive multipliers must move onto Worker jobs or die (GDD §63: workers are not +damage/+shield; industrial speed is allowed).
5. Strip Process categories/presets named Strike/Ward/Echo.
6. Codex/inspect/help strings: Hive, Wave, Worker Drone, Challenge — not Flagship, Sector, Compute, Warp, Echo.

**Acceptance:**

- `gdd-removed-loop.test.ts` still passes; expand it so Reliquary/Slag/Echo/Specialists/Tasks/Capital are not routable tabs.
- `TabId` shrinks or unused ids are unused.
- No player-facing “Sector N” except as a buried debug label.

**Tests:** update every `SAVE_VERSION === 34` pin if you bump; prefer not bumping unless save keys change.

**SAVE_VERSION:** bump if Network bar state or Echo fields are dropped from the save.

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

6. Threat-budget generator (GDD §10): each wave band has budget, density, allowed families, elite chance. Seed stored on the Sortie for telemetry.
7. Boss every 10th wave: a **mechanic**, not only HP (telegraph, add spawn, shield phase, support aura). W300 stays authored climax.
8. Sortie HUD already has Salvage/Scrap/Wave/Speed/Pressure/Time — keep, tighten to GDD §111–112.

**Acceptance:**

- Screenshot/test: Hive near centre, ≥2 distinct Core orbits, enemy headings wrap 360°.
- A Sniper eventually enters Pulse range.
- `encounterForWave(10).isBoss` remains true; W10/20/… have a named mechanic id.
- No Core is permanently out of range of legal targets.

**SAVE_VERSION:** only if unit shape on save changes (usually combat is ephemeral).

---

### Phase 3 — Buildcraft: Frames, Cores, Relics, loadout UI

**Intent:** build identity is Frame + Cores + Relics, readable at the decision site.

**Depends on D1, D8.**

**Files:** `catalog.ts` (`SHIP_FRAMES`, `SHIP_MODULES`), `actions.ts` (`upgradeModule`, `fitModule`, `canFitModuleOnFrame`), `workshop.ts` (`coreStarts`), `CombatTab.tsx`, `DockTab.tsx`, `inspect.ts`, `reliquary.ts`.

**Work if D1 default (GDD §22) holds:**

1. **Run Level** on each fitted Core, bought with Salvage during Sortie. Reset on Sortie end to Workshop starting level.
2. **Workshop Core Starts:** Scrap at Dock buys the next Sortie’s starting Run Level (cycle). Rebuild clears starts.
3. Sortie Cores tab: compact GDD §115 card (Run Lv, Mastery, DPS, next cost). Expanded sheet: stats, relics, contribution %.
4. Revert “inspect-only Cores” copy and `gdd-visual.test.tsx` assertions that forbid Salvage Core buys.

**Work if D1 is reversed (keep Dock Scrap ranks):**

- Document the amendment at the top of the GDD or in this Decision Log as accepted.
- Sortie Cores stay inspect-only.
- Still do Frames, duplicates, mastery, comparison UI.

**Work regardless:**

1. Replace hull ladder with:
   - **Starter** (balanced, 2 slots: Pulse + Plate)
   - **Bastion** (hull/shield, defensive slots)
   - **Swarm** (more slots, weaker per-Core / Hive durability)
   - **Reactor** (Furnace/Heat)
   - **Harvester** (economy / fragments / Ash)
2. Unlock Frames from wave milestones, Foundry blueprints, Research, Challenges — not a linear “bigger hull.”
3. Allow duplicate Core types; limits are Frame slot counts and role caps.
4. Slot curve: ~2–3 early, ~5–6 late Act 1 (GDD §20).
5. Mastery: permanent, slow. Milestones at 5 / 10 / 20 / 30 / 50 (75/100 can exist as remote caps). Socket unlocks and behaviour mods live here.
6. Relic sockets: grow toward Power / Optical / Ballistic / Shield / Reactor / Sensor / Utility / Industrial / Universal. Do not require every class on day one; add as Cores need them.
7. Dock Loadout comparison (GDD §117): Hull, Shield, DPS, slots, before → after when previewing a Frame or Core.
8. Core roster: keep a small set that is visually and strategically distinct (Pulse, Beam, Flak, Lance, Barrier, Repair, Salvage/utility). Cut or merge USI leftovers that are generic +% modules.
9. Acquisition loop: combat discovers fragment/blueprint → Foundry fabricates → Dock equips (GDD §24).

**Acceptance:**

- Player can run 3 Pulse + 1 Barrier + 1 Salvage on Swarm Frame.
- Switching Bastion ↔ Swarm shows % deltas without leaving Dock.
- Run Levels (if D1) reset on Extract/defeat; Mastery and Relics persist through Rebuild.

**SAVE_VERSION:** yes (frame ids, run-level fields).

---

### Phase 4 — Industry: Workers and Foundry as one factory

**Intent:** Worker Drones allocate real work. Foundry is processing + timed fabrication. Construction is a Foundry layer.

**Files:** `workers.ts`, `foundry.ts`, `yard.ts`, `NetworkTab.tsx` (rename), `FoundryTab.tsx`, `systemsHub.ts`, `catalog.ts` `STATIONS` / `FOUNDRY_RECIPES`.

**Work:**

1. Kill remaining Network bar fill/level UI. Assignment screen is **jobs**: processing, fabrication, Research, drone production, construction, salvage ops.
2. Each job: minimum / efficient range / hard cap (GDD §61). Show “4/4 efficient” not an abstract bar.
3. Drone production is a real investment (workers now vs more workers later). Slow.
4. Foundry UI split: **Processing** (continuous chains, 2–3 stages) vs **Fabrication** (timed slots, 1 then more at W90).
5. Material Mastery XP + milestone table (output, time, efficiency, rare chance). Act 1 must not max materials.
6. Fabrication completes mid-Sortie → toast “available next Sortie”; cannot refit live (GDD §58).
7. Times: first job ~30s, early component 2–5 min, early Core 5–15 min. Never introduce Foundry empty.
8. Systems hub cards show live status (Temper Bar Mastery, job %, Ash, current Research, active Process rules) — GDD §120.
9. Drop training-station leftovers (`train-ballistics` etc.) unless they are rewritten as Worker jobs with a GDD purpose.

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

1. Delete or freeze the old `research.unlocked` string shop if it still grants parallel power.
2. Visual branching tree per discipline (Hive Engineering, Drone Systems, Industrial Science, Computational Systems). Preview a small first slice on unlock (GDD §138).
3. Prefer nodes that add mechanics / queues / targeting / automation over tiny %.
4. 1 active project; later queue / second slot / Worker assist / Process auto-pick.
5. Matter shop categories inside Rebuild only (GDD §70): Offensive, Defensive, Industrial, Foundation (baseline Workshop), Temporal (reclaim / Rebuild value). No Slag tab.
6. Rebuild screen already lists RESET/KEEP/GAIN — add honest power preview where the formula is stable (GDD §119).

**Acceptance:** first Research unlock is one project with a duration and a permanent rule change. Matter purchases are visibly stronger than Workshop.

**SAVE_VERSION:** if old research shop keys die.

---

### Phase 6 — Onboarding, toasts, progressive disclosure

**Intent:** the first hour teaches the loop with real actions. Advanced UI arrives when the player has earned it.

**Depends on D9. Best after Phases 2–3 so the screens being taught are the real ones.**

**Files:** `progression.ts` (`ONBOARDING_ENABLED`, `GUIDE_STEPS`), `GuideOverlay.tsx`, `toasts.ts`, `playerGuidance.ts`, `screenHelp.ts`.

**Work:** GDD §125–140 as a checklist, one concept / one action / one payoff / end.

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

- Toast tiers: minor / action (deep-link) / major unlock queued until tap (GDD §124).
- Progressive disclosure: ×10 / MAX / AUTO / ROI / DPS breakdowns locked to Process or Research (GDD §122).
- Universal information audit (GDD §123, Appendix C) on Sortie shop, Dock loadout, Workshop, Rebuild, Foundry job, Challenge launch.
- Re-enable `ONBOARDING_ENABLED`. Skip never blocked. Skipping a door does not skip a later system’s first lesson.

**Acceptance:** a fresh state can complete Launch → Salvage buy → death → Workshop buy → second Launch without opening More. `gdd-furnace.test.ts` onboarding assertion updates to `true`.

**SAVE_VERSION:** if `seenOnboarding` shape changes.

---

### Phase 7 — Process as earned automation

**Intent:** manual → convenience → auto → priority → condition → profiles (GDD §84).

**Depends on D2.**

**Files:** `process.ts`, `ProcessTab.tsx`, `automation.ts`, `tick.ts` (auto-buy hooks).

**Work:**

1. **T1 QoL:** ×10, Buy Max, contribution %, economy ROI, time-to-afford, repeat recipe, presets. All must change a real tap.
2. **T2 Actions:** auto-level Cores (if D1), auto-buy Attack/Defense/Economy, repeat Foundry, apply a Worker preset.
3. **T3 Priorities:** spend ratios, Salvage reserve, Core priority, Foundry priority, Worker presets. Example Attack 50 / Defense 30 / Economy 20.
4. **T4 Conditions:** mobile chip builder. WHEN Wave ≥ N / threat = Survivability / queue empty AND … THEN spend profile / repeat recipe / extract.
5. **T5 Cross-system:** Furnace push profile near Best; Research auto-queue; empty fab slot → tracked recipe.
6. **T6 Profiles:** Farm / Push / Challenge, editable. Auto Extract / Auto Launch exist as late nodes. **No closed-app Sortie sim** (GDD §90, §167).
7. Mastery gates from real history (`processLessonCount`), not grind counters.
8. Process Points from Best-Wave, Rebuilds, Foundry, Research, Challenges — already achievement-shaped; keep that, drop leftover `aiPoints` naming.
9. First-open onboarding hides the builder (Phase 6). Builder is a later node.

**Acceptance:**

- A player can run a Farm profile that auto-buys Economy early and Extracts; a Push profile that dumps Economy after 95% of Best and lights Furnace.
- No typed code. Selectors + chips + numbers only.
- Hidden nodes stay hidden: `offline-sortie`, furnace-always-on, etc.

**SAVE_VERSION:** yes (rule list + profiles).

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
7. PWA: portrait-first (`orientation` portrait-primary), fix meta description, install prompt copy, cache bust already tested.
8. Settings: notation, damage-number mode, reduced motion (exists), export/import, wipe career.
9. Rewrite README “Systems (tabs)” to the four-tab IA. Archive or stub old balance doc.
10. Manual playtest script: first 30 min; first Rebuild; one Furnace push; one Challenge; W300 in dev-jump for finale feel.
11. Version `1.0.0` when the above is green. Dev tools remain behind `?dev=1` / More toggle.

**Acceptance:** Casual profile hits first Rebuild inside the pad; Balanced does not skip Foundry/Workers; Optimiser is faster but not a different game. W300 is a peak on a slope, not a 10× cliff then a trivial W301.

**SAVE_VERSION:** freeze a release number; start migrations after the public tag.

---

## 6. Suggested PR sequence (compact)

| PR | Phase | Player-visible? |
|---|---|---|
| 0 | Docs + this plan | no |
| 1 | Legacy excision + Wave naming | yes (cleaner IA) |
| 2 | Hive + orbiting Cores + families | yes (the game’s look) |
| 3 | Frames / Core levels / loadout UI | yes (buildcraft) |
| 4 | Workers + Foundry factory | yes |
| 5 | Research tree + Matter shop | yes |
| 6 | Onboarding + toasts | yes |
| 7 | Process rules + profiles | yes (late) |
| 8 | Content / Challenges / finale | yes |
| 9 | Balance + PWA + 1.0 tag prep | yes |

Phases 2 and 3 can overlap if D1/D3/D8 are settled. Phase 7 can start in parallel with 8 once T1–T3 APIs are stable. Do not balance (9) until 2–5 exist, or the curves will be retuned twice.

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
- Native store IAP (unless D5/D6 flip)

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
| Research / Process | `hiveResearch.ts`, `process.ts`, `automation.ts` |
| Challenges | `protocols.ts` |
| Cadence / unlocks | `cadence.ts`, `progression.ts`, `moreStations.ts`, `systemsHub.ts` |
| Save | `state.ts`, `save.ts`, `types.ts` |
| UI shell | `App.tsx`, `TabNav.tsx`, `CombatTab.tsx`, `DockTab.tsx`, `SystemsTab.tsx` |
| Balance | `balance/act1.ts`, `simulation/**`, `sortieTelemetry.ts` |
| Onboarding | `progression.ts`, `GuideOverlay.tsx`, `toasts.ts` |

---

## 10. Contract tests to keep vs rewrite

**Keep as regression (they already express GDD):**  
`gdd-sortie-loop`, `gdd-rebuild`, `gdd-reinforce`, `gdd-directives`, `gdd-furnace`, `gdd-workers`, `gdd-foundry-construction`, `gdd-research`, `gdd-process` (T1–T3 gates), `gdd-challenges`, `gdd-relics`, `gdd-mastery`, `gdd-removed-loop`, `gdd-ui-ia`, `gdd-offline`, `gdd-cadence`.

**Rewrite when D1 lands:**  
`gdd-visual.test.tsx` (inspect-only Cores / Scrap ranks), `gdd-sortie-loop` “does not spend Salvage on Core ranks mid-Sortie” if that assertion exists as a lock against GDD.

**Add:**

- Hive + orbit unit tests (positions, range rule).
- Threat-budget invariance (two seeds, similar effective HP).
- Frame archetype comparison readout.
- Process rule evaluation (WHEN/THEN).
- Onboarding path (enabled).
- No leftover tab ids in More/Systems.

---

## 11. Open questions (ask if a default is wrong)

1. **D1 Core ranks** — GDD Salvage Run Levels, or keep the recent Dock Scrap ranks?
2. **D2 Process builder** — required for 1.0, or ship T1–T3 and defer conditions?
3. **D3 Orbiting Cores** — required visual, or Hive branding on the current flagship model is enough for 1.0?
4. **D5 Platform** — PWA only, or Play Store wrapper in the same release train?
5. **D6 Monetisation** — any supporter SKU at launch?
6. **D7 Boss authorship** — unique mechanic per 10-wave boss, or shared mechanic kit + W300 unique?
7. **D8 Frames** — replace hull ladder in one PR, or add GDD archetypes beside old hulls and hide the ladder?
8. **Save wipes** — is anyone on `gh-pages` production (`Idle-/`) whose career we must migrate before 1.0?

Defaults in §2 are enough to start Phase 0–1 immediately.
