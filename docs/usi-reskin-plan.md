# Hiveworks — USI-inspired rewrite plan

> **SUPERSEDED.** This document is historical. Design authority is [`Hiveworks_Game_Design_Document_v1.0.md`](../Hiveworks_Game_Design_Document_v1.0.md). Implementation order is [`docs/release-implementation-plan.md`](release-implementation-plan.md).
>
> Sectors, Network combat bars, Echo, starting-wave select, and USI hull-ladder cadence are **removed or deferred** by the GDD. Do not implement from this file.

Working title: **Hiveworks** (package/PWA name stays `cosmic-idle` until a rename pass).

**Status:** superseded 2026-08-22. Originally accepted 2026-08-13. Defaults locked, then amended: USI combat + cores, no towers, **USI depth and run length**, sectors kept as the career ladder with waves inside each sector. The GDD later dropped sectors and several USI doors.

---

## 1. North star

Clone the *shape* of [Unnamed Space Idle](https://spaceidle.game-vault.net/wiki/Gameplay): unfolding idle systems, salvage-leveled **Cores** (weapon / shield / utility), prestige-as-loadout-swap, and a long ladder of systems that each change how you play.

Do **not** clone USI’s always-on sector crawl or its UI.

Non-negotiables:

1. **Story** — last. Wire hooks now; write it with onboarding.
2. **Player starts a run.** Hub when docked. Combat is a sortie, not a permanent background view.
3. **USI combat + cores vs waves**, not a distance bar and not tower defense. Theme and names change. Idle mechanics can shift (drones instead of Compute Power).
4. **Equipping stays USI.** You fit Cores on the ship, level them with Salvage during a sortie, and Rebuild to swap the loadout. No placed structures, no turret-building.
5. **Depth and run length stay USI.** Same systems, same sector unlock numbers, same career walls (Crew at 51, Task List at 72, Capital at 75). We do not shrink that into a 100-wave tutorial.

---

## 2. Locked decisions

| Decision | Lock |
|---|---|
| Theme / title | **Hiveworks** — orbital foundry, industrial amber / oxidised teal |
| Combat | **USI-style:** player ship at the bottom, waves spawn from the far side and close in. Auto-firing Cores. Shields then hull |
| Equipping | **USI Cores:** Weapon / Shield / Utility slots, Salvage levels, milestone nodes, Rebuild to swap |
| Towers | **None.** No placeable tiles, no orbiting turret drones, no “defend the dock with guns” fantasy |
| Geometry | USI battlefield (bottom ship, incoming waves). Not an orbital TD arena |
| Depth | **USI’s unlock table.** Foundry 2, Reliquary 3, Furnace 5, Research 7, Protocols 18, Echo Runs 22, Specialists 51, Task List 72, Capital 75, Reinforce 80 |
| Run length | **USI’s.** First sitting clears early sectors and unfolds Synth→Research; first Rebuild when you want to swap Cores (often ~4–12); Crew/Capital are week-scale walls, not one-run climaxes |
| Ship power scope | **Prestige-scoped, like USI.** Salvage and Core levels persist across Extract / Defeat. They wipe on **Rebuild** (and Protocol start). Extract is leaving the battlefield, not cashing out a roguelike run |
| Sectors → waves | **Keep sectors.** Each sector is a short wave gauntlet + boss. See §8 |
| Clickables | Auto-collect; no clicker layer |
| Repo | Keep history + stack; start from `main`; do not merge expedition PRs 28–31 |
| Story | Last, as Foundry logs + onboarding |
| Saves | Hard version bump, no Cosmic Idle migration |
| Target | Phone PWA, portrait |

---

## 3. Repo strategy — keep history, rewrite content

**Do not wipe the repo. Do not merge the open expedition PRs.**

| What | Why |
|---|---|
| Keep git history, GH Pages, PWA, Vite + React + TS | Already works on phone; tests and CI exist |
| Keep `src/game/` vs React split | Simulation stays unit-testable |
| Keep canvas combat primitives (units, projectiles, VFX, save/export, offline catch-up, guide overlay) | Engine, not genre |
| **Do not merge** PRs 29–31 (expeditions / salvage store / forward base) | Half a different Cosmic Idle redesign; would fight this one |
| **Do not merge** PR 28 (offline combat rewards) | Built for the old sector campaign |
| Start the rewrite from **`main`** | Cleanest base |
| Steal *ideas* from the expedition work, not the branches | Hub/run split, in-run salvage spend on Cores |

Open draft PRs 28–31 should be closed as superseded. Old Cosmic Idle systems (ITRTG challenges, AI doctrines, Core training tab, 7-wave sectors) are retired, not migrated.

Saves: **hard version bump, no migration.** First rewrite build wipes `localStorage`. Call that out in the UI once.

---

## 4. What USI actually is (so we copy the right parts)

USI’s loop is: combat is always running → Salvage levels Cores → idle systems multiply that → prestige to swap Cores and cash Base bonuses.

We keep the combat *feel* and the Core loadout. We change the *session*: you launch a sortie of waves, then return to a Hub.

| USI system | Role | Unlocks |
|---|---|---|
| Battlefield / sectors | Always-on combat; distance bar; boss at sector end | Start |
| Core Equipment | Weapons / shields / utility, Salvage-leveled, milestone nodes | Start |
| Compute | Idle bars; Compute Power allocated; damage + shields | Start |
| Synth | Craft materials → equippable modules; Synth Points permanent | **Sector 2** |
| V-Device | Shard loadout / links | **Sector 3** |
| Prestige ships | Frigate, then Cruiser / Heavy Cruiser / … | **4 / 8 / 24 / 41 / 75** |
| Reactor | Void Matter → Void Power → system boosts | **Sector 5** |
| Research | 3 parallel branches fed by kills; one focused | **Sector 7** |
| Bases | Building grid; bonuses apply **on prestige** | First prestige; upgrades 14 / 27 / 40 / 55 |
| Challenges | Restricted runs that buff a system | **Sector 18** |
| Warp Drive | Short gauntlets → skill tree | **Sector 22** |
| Crew / Mastery | Print + level specialists; mastery points | **Sector 51** |
| Task List | Gate into capital phase | **Sector 72** |
| Capital / Fighters | Second combat scale | **Sector 75** (tasks done) |
| Reinforce | Second prestige layer | **Sector 80** |

USI’s UI problem: the battlefield never goes away. Systems fight a strip of combat for space. On a phone that is worse.

USI’s design win: systems *unfold*. Prestige is how you change the ship, not a generic multiplier dump. Cores are the ship.

---

## 5. Theme

**Hiveworks.** You are the surviving process of an orbital foundry. The crew is gone. The drone corps is what is left — they run the idle Network, not the guns. Something in the dark (the Choir) keeps sending hulls at you. You launch the foundry’s remaining ship, fight a wave sortie, and Rebuild it between runs.

Why this theme:

- Drones-as-Compute is native, not a sticker on “CPU bars”.
- Industrial amber / slag teal / soot, not USI’s navy-blue cockpit and not Cosmic Idle’s god-entity chrome.
- Story writes itself later: logs, failed crew, the Foundry waking up, the Choir answering.
- Combat fantasy is **USI’s:** your equipped ship vs incoming waves — not “hold a lane with structures”.

Palette sketch (implementation later):

- Background: slag-black `#12100e`
- Accent: furnace amber `#e08a3a`
- Secondary: oxidised teal `#3d8f88`
- Danger: slag red `#c45c5c`
- Type: keep IBM Plex Mono; replace Orbitron with a heavier industrial face

Enemy families stay useful (Swarm / Armored / Ethereal / Divine / Titan) under new names.

---

## 6. The loop: Hub vs Sortie

This is the layout change. It is the whole game’s skeleton.

```
┌─────────────────────────────────────────┐
│  HUB  (docked)                          │
│  Station systems get the full screen.   │
│  Drones, Foundry, Research, Reliquary,  │
│  Furnace, Grid, Prestige, Codex.        │
│                                         │
│  [ Launch Sortie ]  ← player starts it  │
└─────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  SORTIE  (in combat)                    │
│  USI battlefield + Cores + Salvage.     │
│  Auto-push sectors until Extract        │
│  (after a boss) or Defeat (knockback).  │
│  Hub systems still tick.                │
└─────────────────────────────────────────┘
                 │
                 ▼
            Extract / Defeat
                 │
                 ▼
              HUB + run summary
```

**Launch** starts the combat **sim**. Kill-fed systems (Salvage, later Research / Reliquary / Furnace / Specialists) keep ticking even if you are looking at the Dock or Cores — same as USI, minus the permanent battlefield pane. A live **combat chip** in the header jumps back to the Sortie view.

**Extract** freezes the sim (true pause). Use it to Rebuild, swap later, or go idle without dying. Extract does **not** wipe Cores or Salvage.

**Defeat** knocks the current sector back to wave 1 and returns you to the Dock. Ship loadout stays.

This is the hybrid: player still *initialises* a run; systems that need kills do not stall because you opened Foundry.

Idle systems (drone bars, foundry crafts, research, furnace) **do not pause** while you are in a sortie, except when the player hits Pause (freezes the sortie only).

Offline catch-up: Hub systems always. Sortie combat only if an automation node is owned (late). Early game: you come back to a finished/failed run or a paused dock, plus industry report.

---

## 7. UI layout (phone-first)

USI: battlefield is a permanent pane. We will not do that.

### Hub

- Top: brand + resources that exist yet (unfold; don’t show Research/Choir-ash until those systems exist).
- Body: one system page at a time.
- Bottom tab bar, **context-sensitive**, gated like USI:
  - Always: Dock, Stats
  - Sector 2: Foundry
  - Sector 3: Reliquary
  - Sector 5: Furnace
  - Sector 7: Research
  - First Rebuild: Yard
  - Sector 4+: Rebuild (Prestige)
  - Later: Protocols, Echo, Specialists, Codex
- Dock page is the “home”: last run summary, launch button, ship + Core preview. **No live combat.**

### Sortie

- Top: **sector**, wave-in-sector, hull/shield, salvage, pause / extract
- Centre: canvas battlefield (majority of the screen) — USI composition: ship low, enemies incoming
- Bottom sheet: **Cores | Shop | Drones** (Network peek; Drones are idle, not combat units)
- Hub tabs are hidden or collapsed to a single “Station” peek so we don’t put Research next to a live fight

Combat is a mode, not a tab you live in.

---

## 8. Combat — USI ship vs waves

Stay true to USI’s combat and equipping. Replace only the **distance bar** (and engine speed) with a fixed wave gauntlet per sector. Keep **sectors** as the named map.

### Battlefield

- **Your ship** is the only player combatant. It sits toward the bottom of the canvas, like USI.
- Enemies spawn in waves from the far side and close in. They shoot / ram; they drain **Shields**, then **Hull**.
- Equipped **Cores** auto-fire. You do not place, aim, or path anything.
- Kill the wave → next wave in this sector → sector boss → next sector.
- If hull hits 0 → Defeat. After a sector boss you may Extract.

This is USI’s fight with the engine-speed meter removed. It is **not** tower defense.

### Sectors → waves (the translation)

USI does **not** have a fixed wave count. A sector is a **distance range**; waves spawn every ~12s while you travel; engine speed decides how many packs you see before the boss. Later sectors are longer so that speed still matters.

We are deleting engine speed (it only exists to feed that meter). Mapping “1 sector = N× distance in waves” would make sector 22 ten times longer than sector 1 and blow up run length.

**Lock:**

1. **Sector number is the career key.** Unlocks, A/B routes, Warp locations, starting-sector, and player language stay “Sector 22”, not “Wave 110”.
2. **Each sector is a gauntlet:** trash/mixed waves, then a **boss**. Clear the boss = clear the sector = USI “defeated the sector boss”.
3. **Wave count is short and stable**, not scaled to USI distance:
   - Sector 1: **2 waves + boss** (USI’s tiny 1–10 tutorial)
   - Sectors 2–8: **3 waves + boss**
   - Sectors 9+: **4 waves + boss**
   - Elite **B/C** routes (from 9, like USI): same count, harder / different packs
4. **Difficulty scales, length does not.** Later sectors hit harder and mix USI-style enemy types (skirmishers, shield, sniper, juggernaut, armored…). They do not become 15-wave maps.
5. **A sortie is a sector push.** Launch at a starting sector, auto-advance sector after sector, until Extract (after a boss) or Defeat. That is USI’s continuous push, with a door on each end.
6. **Career waves** (achievements, stats) = waves actually fought. **Gates** always read sector clears.

Why 3–4 + boss: a first sitting that reaches Research (sector 7) is ~25 fights — minutes to a short session once Cores are leveled, same ballpark as crawling USI 1→7 with a young engine. A sitting that walls at ~18–22 is ~80–100 fights across one or more sorties, not a single authored 100-wave map. Crew at 51 is still a long career, as in USI.

### Run length (inline with USI)

| Moment | Hiveworks | USI analogue |
|---|---|---|
| First death | Can happen in sector 1–2 if you greed | Knockback in an early sector |
| First sitting | Unfold Foundry → Reliquary → Furnace → Research (sectors 2–7) | Same opening hours |
| First Rebuild | When you want another Core / Frigate (sector 4+) or you wall ~8–12 | Prestige to swap cores / first ship |
| Challenges | Sector 18 | Sector 18 |
| Echo Runs | Sector 22 | Warp Drive |
| Specialists | Sector 51 | Crew |
| Task List | Sector 72 | Task List |
| Capital | Sector 75 | Capital / fighters |
| Reinforce | Sector 80 | Reinforce |

No “wave 100 is Act 1 climax”. The climax of the *standard* phase is Task List → Capital, same as USI.

### Equipping (USI Cores)

Same model as USI Core Equipment:

| Slot | Role |
|---|---|
| **Weapon** | Damage, tags, fire rate, range. Counters enemy families |
| **Shield** | Max shield, regen, resistances |
| **Utility** | Unfolds later: salvage, engine-less QoL, special effects |

During a sortie, **Salvage** (from kills) buys Core levels. Milestones on a Core offer a 2-pick node (USI Core nodes). Levels and unspent Salvage **persist until Rebuild**, including across Extract / Defeat. Which Cores are *fitted* also persists until Rebuild — that is the hangar swap.

Modules (Foundry / Synth) are a separate layer: equip in Hub, snapshot at Launch, like USI Synth modules.

Starter loadout: 1 weapon Core + 1 shield Core. Extra weapon / utility slots unfold.

### Pacing

- Push is automatic between waves after Launch (idle).
- Pause freezes the sortie (no free repair).
- Extract is offered after a **sector boss**.
- Farming a sector: Launch with that sector as start (once unlocked as a start point), Extract after its boss, relaunch — USI’s “start at sector N” rather than Hold-mode.

### Families / matchups

Keep role counters (kinetic vs armored, energy vs shields, etc.). Codex records them. That is USI (cores vs enemy types) and worth keeping.

### What combat is not

- Placeable towers or tiles
- Orbiting turret drones / combat escorts as a second army
- A central “dock” that you defend with structures (the Hub dock is where you *launch from*)
- Lane-holding TD, Bloons, Kingdom Rush, or “orbital defence grid”

Drones exist only as the **idle Network** (Compute reskin). They do not appear on the battlefield.

---

## 9. System map — USI → Hiveworks

Rename hard. Keep the *job* and the **unlock sector**. Combat and Cores stay close to USI; the session (Hub vs Sortie) and Compute (drones) do not.

| USI | Hiveworks | Unlock | Notes |
|---|---|---|---|
| Battlefield / sectors | **Sortie** (sectors, wave gauntlets) | 1 | Player-launched; USI ship combat; no distance bar |
| Salvage | **Salvage** | 1 | Spend on Core levels; persists until Rebuild |
| Cores | **Cores** | 1 | Weapon / Shield / Utility. Same equipping as USI |
| Compute | **Drone Network** | 1 | Drones allocated to *idle* bars. Not combat units |
| Synth | **Foundry** | **2** | Recipes → modules. Foundry Points permanent. Snapshot at Launch |
| V-Device | **Reliquary** | **3** | Shards in colour slots (red/orange at 3, then 6 / 19 / 32) |
| Frigate / ships | **Hulls** | **4 / 8 / 24 / 41 / 75** | Rebuild to swap hull + Cores |
| Reactor | **Furnace** | **5** | Choir-ash → Heat → system boosts |
| Research | **Research** | **7** | Material / Energy / Observation. Focus one branch |
| Bases | **Yard Grid** | First Rebuild; upgrades **14 / 27 / 40 / 55** | Bonuses **apply on Rebuild** |
| Challenges | **Protocols** | **18** | Restricted sorties that buff one system |
| Warp Drive | **Echo Runs** | **22** | Short authored gauntlets → skill tree |
| Crew | **Specialists** | **51** | Print / rank / mastery |
| Task List | **Task List** | **72** | Gate into Capital |
| Capital / Fighters | **Capital** | **75** | Second combat scale (still the ship, not towers) |
| Reinforce | **Reinforce** | **80** | Second prestige layer |
| Energy Voids / click scrap | **Flare** | with Furnace | Auto-collect |
| Prestige | **Rebuild** | from sector **4** (Frigate) | Swap Cores/hull, arm Yard |
| AI modules | **Process** | sparse / achievements | Automation / QoL |
| Engine speed / distance | *Deleted* | — | Replaced by fixed waves per sector |

### Drone Network (Compute reskin)

USI Compute: allocate Compute Power into bars; filled bars grant levels → damage/shields.

Hiveworks: you **build drones** (slow, permanent, capacity-capped). You **assign** them to Network bars:

- **Strike** — sortie damage (buffs the ship, drones do not shoot)
- **Ward** — max shield / armour
- **Yield** — salvage + scrap
- **Loom** — Foundry speed
- **Archive** — research income

Bars still fill over time (the idle toy). Extra drones on a bar fill it faster. Later bars boost earlier ones (USI’s Cap+ idea) without using the word Compute.

Drones never spawn on the battlefield.

### Cores

At Rebuild you pick the next prestige’s hull / weapon / shield / utility. During combat, Salvage buys Core levels. Milestones offer a 2-pick node. Levels wipe on **Rebuild** only (plus Protocol runs). Extract / Defeat do not touch the loadout.

That is USI’s “I prestige to swap guns”, without combat running while you shop.

### Foundry (Synth)

Keep it simpler than USI’s full recipe encyclopedia **at first**, then grow toward USI depth as sectors unlock recipes:

- 1 slot at start of Foundry (sector 2), extra slots as Foundry Point unlocks (USI Synth Unlock)
- Recipe chain unfolds with sectors, not a toy three-step forever
- Recipe XP is permanent
- Equipped modules are Hub loadout, frozen at Launch

### Yard Grid (Bases)

Unlocks at first Rebuild. Small grid (3×3, then 4×4). Buildings for Yard-only goods. Spending those goods, and the production bonus, **arms on the next Rebuild**.

Do **not** reuse the current worker-station list as the Yard. Stations become the Drone Network; the Yard is a prestige-layer puzzle.

### What we drop from Cosmic Idle

- 7-wave sectors, Advance/Hold, warp-to-sector
- Core *training* tab (attributes fold into Drone Network / Cores)
- AI doctrines (Focus Fire, Boss Protocol, …)
- ITRTG-style challenge pack as currently written — rewrite as Protocols later
- Prestige Matter / Challenge Point *banked percent* shops as the main meta. Rebuild currency buys **unlocks and ranks**
- Named Cosmic Idle Ascension as a separate flavour — use **Reinforce** at 80, like USI
- Fleet escorts as the player combat identity (the ship + Cores is the identity)

---

## 10. Other changes I recommend

1. **Unfold, don’t dump tabs.** Follow USI’s sector gates: Dock + Cores + Drones at start; Foundry at 2; Reliquary at 3; Furnace at 5; Research at 7; Yard on first Rebuild; Protocols at 18; Echo Runs at 22; Specialists at 51.

2. **No clicker chores on mobile.** Flares auto-collect.

3. **Prestige layers match USI.** Rebuild (cores/hull/Yard) from sector 4; Reinforce at 80. No extra homemade layer.

4. **Run summary is the dopamine.** Extract/Defeat shows sectors cleared, salvage spent, Core milestones, research gained, drone bar levels.

5. **Rebuild is a hangar, not a reset button.** Full-screen loadout: pick hull / weapon / shield / utility, start sector, see Yard bonuses that will arm, confirm.

6. **Phone portrait is the target.** Canvas battlefield ~40–50% of sortie height; Core/shop sheet below.

7. **Story as logs, not cutscenes.** Each system unlock + each sector boss can drop a Foundry log. Written last.

8. **Keep achievements → Process points.** Cleaner than USI’s AI module shop.

9. **Clean save, always.** This rewrite is a new game.

10. **Do clone USI’s late game — on USI’s schedule.** Echo Runs, Specialists, Task List, Capital, Reinforce are not “Act 2 maybe”. They land at 22 / 51 / 72 / 75 / 80. Content volume can be thinner than USI’s wiki, but the *doors* stay.

---

## 11. Content cut (implementation order, not a smaller game)

Ship the **doors** on USI’s schedule. Thin the *amount of stuff behind a door* if we have to; do not delay Crew to a homemade Act 2.

**Phase-1 playable spine (sectors 1–8):**

- Hub + Launch (start-sector) + Extract after boss + Defeat
- USI-style ship combat, Cores (weapon + shield), Salvage levels
- Drone Network (two bars)
- Foundry at 2, Reliquary at 3, Furnace at 5, Research at 7, Hull Frigate at 4, Cruiser at 8
- Rebuild hangar once Frigate exists
- PWA, save/export, offline Hub catch-up, dev tools, mechanical onboarding

**Then, still in the main career (not a sequel):**

- Yard Grid on first Rebuild; base upgrades at 14 / 27 / 40 / 55
- Utility Cores, extra weapon slots, Core milestone nodes
- Protocols at 18
- Echo Runs at 22
- Specialists at 51
- Task List 72 → Capital 75 → Reinforce 80
- A/B sector routes from 9
- Story logs last

**Never:**

- Placeable towers, combat drones on the field, orbital TD arena
- Engine-speed distance bar
- Cosmic Idle’s ITRTG challenge pack / AI doctrines / Core training tab

---

## 12. Implementation phases

Each phase is one branch / one PR off the previous, from `main`. Saves bump when the model changes. Tests + build required.

| Phase | Deliverable |
|---|---|
| **0** | This plan (this PR) |
| **1** | Hub + Launch / Extract / Defeat; sectors 1–5 as wave gauntlets (2–3 + boss); ship + starter Cores; Salvage on kill; clean save. Combat is a *mode* |
| **2** | Core milestones + in-run Salvage spend; Rebuild hangar; Frigate (4); Foundry (2) stub if not already in |
| **3** | Drone Network (full bars + assignment + corps cap) |
| **4** | Foundry depth (recipes / modules / points) |
| **5** | Reliquary (3) + Furnace (5) + Research (7) |
| **6** | Yard Grid + Rebuild bonuses; Cruiser (8); A/B routes from 9; sectors through ~18 |
| **7** | Protocols (18) + Echo Runs (22) + Process automation + onboarding polish |
| **8** | Sectors through 51: Specialists; visual theme pass |
| **9** | Task List / Capital / Reinforce doors; story logs |

Phase 1 should be playable on the phone: launch, clear a sector boss, die, extract, relaunch. If that loop is not fun, we stop and fix it before adding idle systems.

Invasiveness: content/systems rewrite, not a new engine. `src/game/combat.ts`, `tick.ts`, `catalog.ts`, `progression.ts`, and every tab will be replaced in slices. Canvas, save, PWA, and the tick loop stay. Battlefield composition becomes USI-like (ship low, waves incoming).

---

## 13. Mapping from existing code (what we reuse)

Reuse as libraries, not as the product:

- `src/game/combat.ts` projectile / hull / telegraph / family matchup math
- `src/components/Battlefield.tsx` canvas + VFX (retarget to USI-style ship-at-bottom)
- `src/game/save.ts` / export-import / PWA
- `src/components/GuideOverlay.tsx` spotlight machine
- `src/game/offline.ts` catch-up pattern (Hub-only at first)
- Drone corps cap / black-bar idea → Drone Network saturation
- Signal Cores merge rules → Reliquary (later)
- Shipyard frames/modules as a starting point for Core + Foundry module data, rewritten

Do not reuse: sector campaign, Core training tab, AI doctrines, current research list, current prestige shops, expedition PR code (copy ideas, rewrite), fleet-escort combat as the player identity.

---

## 14. Next

1. Close draft PRs 28–31 as superseded.
2. Phase 1 branch from `main`: Hub + Launch + sectors 1–5 as wave gauntlets (ship + starter Cores).
3. Playable preview on GH Pages as usual.

`main` stays the current Cosmic Idle sector game until Phase 1 lands.
