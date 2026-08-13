# Hiveworks — USI-inspired rewrite plan

Working title: **Hiveworks** ( Cosmic Idle stays as the repo/PWA name until we lock a title ).

This is a design plan only. No gameplay rewrite until this document is accepted.

---

## 1. North star

Clone the *shape* of [Unnamed Space Idle](https://spaceidle.game-vault.net/wiki/Gameplay): unfolding idle systems, salvage-leveled hardpoints, prestige-as-loadout-swap, and a long ladder of systems that each change how you play.

Do **not** clone USI’s always-on sector crawl or its UI.

Three non-negotiables from you:

1. **Story** — last. Wire hooks now; write it with onboarding.
2. **Player starts a run.** Hub when docked. Combat is a sortie, not a permanent background view.
3. **Wave tower-defense**, not USI’s distance/sector push. Theme and names change. Mechanics can shift (drones instead of Compute Power).

---

## 2. Repo strategy — keep history, rewrite content

**Do not wipe the repo. Do not merge the open expedition PRs.**

| What | Why |
|---|---|
| Keep git history, GH Pages, PWA, Vite + React + TS | Already works on phone; tests and CI exist |
| Keep `src/game/` vs React split | Simulation stays unit-testable |
| Keep canvas combat primitives (units, projectiles, VFX, save/export, offline catch-up, guide overlay) | Engine, not genre |
| **Do not merge** PRs 29–31 (expeditions / salvage store / forward base) | Half a different Cosmic Idle redesign; would fight this one |
| **Do not merge** PR 28 (offline combat rewards) | Built for the old sector campaign |
| Start the rewrite from **`main`** | Cleanest base |
| Steal *ideas* from the expedition work, not the branches | Hub/run split, 100-wave sortie, orbital arena, in-run salvage shop |

Open draft PRs should be closed as superseded once this plan is accepted. Old Cosmic Idle systems (ITRTG challenges, AI doctrines, Core training tab, 7-wave sectors) are retired, not migrated.

Saves: **hard version bump, no migration.** First rewrite build wipes `localStorage`. Call that out in the UI once.

---

## 3. What USI actually is (so we copy the right parts)

USI’s loop is: combat is always running → Salvage levels Cores → idle systems multiply that → prestige to swap Cores and cash Base bonuses.

| USI system | Role | When it unlocks (approx.) |
|---|---|---|
| Battlefield / sectors | Always-on combat; distance bar; bosses at sector end | Start |
| Core Equipment | Weapons / shields / utility, Salvage-leveled, milestone nodes | Start |
| Compute | Idle bars; Compute Power allocated; damage + shields | Start |
| Synth | Craft materials → equippable modules; Synth Points permanent | Sector 2 |
| V-Device | Shard loadout / links | Mid |
| Reactor | Void Matter → Void Power → system boosts | Mid |
| Research | 3 parallel branches fed by kills; one focused | Mid |
| Bases | Building grid; bonuses apply **on prestige** | Prestige |
| Challenges | Restricted runs that buff a system | After first systems |
| Warp Drive | Short gauntlets → skill tree | Later |
| Crew / Mastery | Print + level specialists; mastery points | Sector 51 |
| Task List / Capital | End of “normal” phase | Late |

USI’s UI problem: the battlefield never goes away. Systems fight a strip of combat for space. On a phone that is worse.

USI’s design win: systems *unfold*. You are not given ten tabs on minute one. Prestige is how you change the ship, not a generic multiplier dump.

---

## 4. Theme (proposed — please confirm)

**Hiveworks.** You are the surviving process of an orbital foundry. The crew is gone. The drone corps is what is left. Something in the dark (the Choir, keep the name or not) keeps sending hulls at the dock.

Why this theme:

- Drones-as-Compute is native, not a sticker on “CPU bars”.
- Industrial amber / slag teal / soot, not USI’s navy-blue cockpit and not Cosmic Idle’s god-entity chrome.
- Story writes itself later: logs, failed crew, the Foundry waking up, the Choir answering.
- TD fantasy is “defend the dock”, not “fly through sectors”.

Palette sketch (implementation later):

- Background: slag-black `#12100e`
- Accent: furnace amber `#e08a3a`
- Secondary: oxidised teal `#3d8f88`
- Danger: slag red `#c45c5c`
- Type: keep IBM Plex Mono; replace Orbitron with a heavier industrial face

Enemy families stay useful (Swarm / Armored / Ethereal / Divine / Titan) under new names.

---

## 5. The loop: Hub vs Sortie

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
│  SORTIE  (in run)                       │
│  Arena + hardpoints + in-run shop.      │
│  Waves until Extract or Defeat.         │
│  Hub systems still tick in the          │
│  background (true idle).                │
└─────────────────────────────────────────┘
                 │
                 ▼
            Extract / Defeat
                 │
                 ▼
              HUB + run summary
```

**Launch** is a loadout confirm: hull, hardpoints, modules, drone deployment cap. After launch, frame/hardpoints lock for that sortie (USI prestige-lock, but per-run instead of per-prestige).

**Extract** after a wave clear. **Defeat** if the dock’s hull hits 0. Both return to Hub with a summary.

Idle systems (drone bars, foundry crafts, research, furnace) **do not pause** while you are in a sortie, except when the player hits Pause (freezes the sortie only). That keeps the idle fantasy without USI’s always-visible battlefield.

Offline catch-up: Hub systems always. Sortie combat only if an automation node is owned (late). Early game: you come back to a finished/failed run or a paused dock, plus industry report.

---

## 6. UI layout (phone-first)

USI: battlefield is a permanent pane. We will not do that.

### Hub

- Top: brand + resources that exist yet (unfold; don’t show Research/Choir-ash until those systems exist).
- Body: one system page at a time.
- Bottom tab bar, **context-sensitive**:
  - Always: Dock, Foundry (once unlocked), Research, Prestige, Stats
  - Unfolded later: Reliquary, Furnace, Grid, Codex
- Dock page is the “home”: last run summary, launch button, hull/hardpoint preview. **No live combat.**

### Sortie

- Top: wave, hull/shield, salvage, pause / extract
- Centre: canvas arena (majority of the screen)
- Bottom sheet: **Hardpoints | Shop | Drones** (three panels, not nine tabs)
- Hub tabs are hidden or collapsed to a single “Station” peek so we don’t put Research next to a live fight

This is the improved layout. Combat is a mode, not a tab you live in.

---

## 7. Combat — wave tower defense

Keep Cosmic Idle’s **orbital arena** idea (flagship/dock at centre, enemies spawn on the rim and close in). It already plays as TD, it is readable on a phone, and it is not USI’s top-spawn distance bar.

### Sortie structure

- Waves **1–100**, then Endless 101+
- Mix of trash / elite / commander / boss waves (bosses on 10 / 25 / 50 / 75 / 100)
- Wave 100 is Act 1’s soft climax (USI “first real wall”, ITRTG “first Baal”)
- First prestige around wave **20–30** of a later run, not wave 100 — prestige must exist as a tool, not a credit roll

### Player side

- **Dock (core):** the thing that dies = run over. Not a flying fleet.
- **Hardpoints:** 1 weapon + 1 shield at start; utility and extra weapons unfold. Salvage-leveled during the sortie (USI Cores).
- **Drones (combat):** a few escort/turret drones orbit the dock. Count and jobs come from the Drone Network, not from placing Minecraft towers. Still TD: they hold range rings and fire; you don’t path-build.

Placeable tiles (classic Bloons/Kingdom Rush grids) are **out** for Act 1. They fight the idle fantasy and the phone canvas. If we ever add them, they belong in a later “Yard” system, not the first combat model.

### Pacing

- Push is automatic between waves after Launch (idle).
- Pause freezes the sortie (no free repair).
- Extract is manual after a clear.
- No Hold-farm of a single USI-style sector. Farming is “stay in the sortie” or “extract and relaunch”.

### Families / matchups

Keep role counters (kinetic vs armored, energy vs shields, etc.). Codex records them. That is one of the current game’s better ideas and USI’s too (cores vs enemy types).

---

## 8. System map — USI → Hiveworks

Rename hard. Keep the *job* of each system. Cut anything that needs USI’s always-on combat to make sense.

| USI | Hiveworks | Act 1? | Notes |
|---|---|---|---|
| Battlefield / sectors | **Sortie** | Yes | Player-launched wave TD |
| Salvage | **Salvage** | Yes | In-run only; resets on extract/defeat |
| Cores | **Hardpoints** | Yes | Weapon / Ward / Utility. Salvage levels + milestone nodes |
| Compute Power + bars | **Drone Network** | Yes | Drones allocated to bars (Damage, Ward, Yield, Fabrication, …). Bars fill idle. Drone *count* is the resource, not an abstract CPU number |
| Synth | **Foundry** | Yes | Recipes → materials → modules. Foundry Points = permanent. Modules equip in Hub, snapshot at Launch |
| V-Device / shards | **Reliquary** | Mid Act 1 | Current Signal Cores, renamed. Merge 3. Slot bonuses |
| Reactor / Void Matter | **Furnace** | Mid Act 1 | Choir-ash → Heat → spend on timed boosts (damage, drone speed, foundry, research) |
| Research (3 branches) | **Research** | Yes | Material / Energy / Observation. Fed by kills + a Hub trickle. Focus one branch |
| Bases (grid) | **Yard Grid** | After first prestige | Buildings produce Yard goods; bonuses **apply on prestige** (this is USI’s best prestige trick — keep it) |
| Challenges | **Protocols** | After first prestige | Restricted sorties that buff one system |
| Warp Drive | **Echo Runs** | Act 2 | Short authored 10–15 wave gauntlets → skill tree. Natural fit for TD |
| Crew | **Specialists** | Act 2 | Print / rank / mastery. Too much for Act 1 |
| Energy Voids / click scrap | **Flare** | Optional, late | Auto-collect by default. No mandatory clicking on a phone |
| Prestige | **Rebuild** | Yes | Swap hardpoints, activate Yard bonuses, reset sortie-scoped stuff |
| AI modules | **Process** | Sparse | Automation / QoL only. No combat doctrines tab. Unlock via achievements (keep that — it is cleaner than USI’s AI shop) |
| Engine speed / distance | *Deleted* | — | That meter is the sector system |

### Drone Network (Compute reskin — the one you called out)

USI Compute: allocate Compute Power into bars; filled bars grant levels → damage/shields.

Hiveworks: you **build drones** (slow, permanent, capacity-capped — we already have this). You **assign** them to Network bars:

- **Strike** — sortie damage
- **Ward** — max shield / armour
- **Yield** — salvage + scrap
- **Loom** — Foundry speed
- **Archive** — research income

Bars still fill over time (the idle toy). Extra drones on a bar fill it faster. Later bars boost earlier ones (USI’s Cap+ idea) without using the word Compute.

Combat drones on the arena are a *separate* small cap derived from the Network, not a second army to micro.

### Hardpoints (Cores)

At Rebuild (prestige) you pick the next sortie’s weapon/ward/utility. During a sortie, Salvage buys levels. Milestones on a hardpoint offer a 2-pick node (USI Core nodes). Levels wipe on Extract/Defeat; the *choice of which hardpoints exist* persists until Rebuild.

That gives USI’s “I prestige to swap guns” without forcing combat to run while you shop.

### Foundry (Synth)

Keep it simpler than USI’s full recipe encyclopedia for Act 1:

- 1 slot at start, 2nd slot as a Foundry Point unlock
- Short recipe chain (scrap → plate → lens → module)
- Recipe XP is permanent
- Equipped modules are Hub loadout, frozen at Launch

### Yard Grid (Bases)

Unlocks at first Rebuild. Small grid (3×3, then 4×4). Buildings for Yard-only goods. Spending those goods, and the production bonus, **arms on the next Rebuild** — so prestige has a reason besides swapping guns.

Do **not** reuse the current worker-station list as the Yard. Stations become the Drone Network; the Yard is a prestige-layer puzzle.

### What we drop from Cosmic Idle

- 7-wave sectors, Advance/Hold, warp-to-sector
- Core training tab (attributes fold into Drone Network / Hardpoints)
- AI doctrines (Focus Fire, Boss Protocol, …)
- ITRTG-style challenge pack as currently written (Silent Bridge, Glass Frame, …) — rewrite as Protocols later
- Prestige Matter / Challenge Point *banked percent* shops as the main meta. Rebuild currency should buy **unlocks and ranks**, not a grey “+0.6% per banked”
- Endless Cosmic Idle content gates (Ascension as a named second layer can wait; one prestige layer + Yard is enough for Act 1)

---

## 9. Other changes I recommend

These are not in your list. They are the difference between “USI with a coat of paint” and a game that is nicer to play.

1. **Unfold, don’t dump tabs.** First 10 minutes: Dock, one weapon, Salvage, Drone Network with two bars. Foundry at first commander. Research after first boss. Yard after first Rebuild. Reliquary / Furnace later. USI does this well; Cosmic Idle currently shows too much chrome too soon.

2. **No clicker chores on mobile.** Flares auto-collect. If we ever add a tap bonus, it is extra, not required.

3. **One prestige layer for Act 1.** USI’s Crew/Warp/Capital explosion is why veterans have 20 systems. We stop at Sortie + Hardpoints + Drones + Foundry + Research + Yard + Rebuild. Reliquary and Furnace if they earn their slot.

4. **Run summary is the dopamine.** Extract/Defeat always shows waves reached, salvage spent, hardpoint milestones, research gained, drone bar levels. USI never celebrates a “run” because there isn’t one.

5. **Rebuild is a hangar, not a reset button.** Full-screen loadout: pick weapon / ward / utility, see Yard bonuses that will arm, confirm. This is USI Prestige’s best screen.

6. **Phone portrait is the target.** Canvas arena ~40–50% of sortie height; shop is a sheet, not a second page of tiny buttons.

7. **Story as logs, not cutscenes.** Each system unlock + each boss drops a Foundry log. Written last, with onboarding spotlights.

8. **Keep achievements → Process points.** Cleaner than USI’s AI module shop, and we already have the pattern.

9. **Clean save, always.** This rewrite is a new game. No migration from Cosmic Idle.

10. **Do not clone USI’s late game.** Echo Runs + Specialists are Act 2 on purpose. If Act 1 is good, we have earned them.

---

## 10. Act 1 content cut

**In v1 (playable spine):**

- Hub + Launch + orbital wave TD 1–100 + Endless stub
- Hardpoints (weapon + ward; utility later in Act 1)
- In-run Salvage shop (offence / defence / yield)
- Drone Network (build + assign to bars)
- Foundry (short recipe chain + 1–2 module slots)
- Research (3 branches, focus one)
- Rebuild (prestige) + Yard Grid (small)
- Achievements → Process (automation/QoL)
- Guided onboarding (mechanical; flavour text later)
- PWA, save/export, offline Hub catch-up
- Dev tools

**Explicitly later:**

- Story / logs
- Reliquary, Furnace
- Protocols (challenges)
- Echo Runs, Specialists
- Placeable towers
- Authored boss scripts beyond telegraphs
- Second prestige layer

---

## 11. Implementation phases

Each phase is one branch / one PR off the previous, from `main`. Saves bump when the model changes. Tests + build required.

| Phase | Deliverable |
|---|---|
| **0** | This plan (this PR). No gameplay change |
| **1** | Skeleton strip: Hub Dock + Launch/Extract/Defeat, orbital waves 1–20, one weapon hardpoint, salvage on kill, clean save. Combat tab is a *mode*, not the home screen |
| **2** | Hardpoints + in-run Salvage shop (offence/defence/yield). Rebuild as loadout swap |
| **3** | Drone Network (bars + assignment + corps cap) |
| **4** | Foundry recipes / modules |
| **5** | Research branches |
| **6** | Yard Grid + Rebuild bonuses |
| **7** | Waves 21–100, bosses, Endless stub, Process automation, onboarding |
| **8** | Visual theme pass (Hiveworks palette, dock art, enemy shapes) |
| **9** | Story logs + onboarding flavour (last) |

Phase 1 should be playable on the phone: launch a run, die, extract, relaunch. If that loop is not fun, we stop and fix it before adding idle systems.

Estimated invasiveness: this is a content/systems rewrite, not a new engine. `src/game/combat.ts`, `tick.ts`, `catalog.ts`, `progression.ts`, and every tab will be replaced in slices. `Battlefield.tsx`, save, PWA, and the tick loop stay.

---

## 12. Mapping from existing code (what we reuse)

Reuse as libraries, not as the product:

- `src/game/combat.ts` projectile / hull / telegraph / family matchup math
- `src/components/Battlefield.tsx` canvas + VFX (retarget to radial dock)
- `src/game/save.ts` / export-import / PWA
- `src/components/GuideOverlay.tsx` spotlight machine
- `src/game/offline.ts` catch-up pattern (Hub-only at first)
- Drone corps cap / black-bar idea → Drone Network saturation
- Signal Cores merge rules → Reliquary (later)

Do not reuse: sector campaign, Core tab, AI doctrines, current research list, current prestige shops, expedition PR code (copy ideas, rewrite).

---

## 13. Open questions

Please answer these. Defaults are in **bold** if you just want to say “ship it”.

1. **Theme / title.** Hiveworks + industrial foundry, or stay generic space-navy, or a third aesthetic you have in mind?
2. **Combat geometry.** **Orbital dock (centre)** vs bottom-lane TD vs USI-style top spawn? I strongly prefer orbital.
3. **Towers.** **Orbiting/auto hardpoints + combat drones** vs player-placed tiles each run?
4. **How close to USI.** **Act 1 cut in §10** vs you want Synth-depth / Void / Crew earlier?
5. **Run length.** First death in minutes; first Rebuild in a sitting; wave 100 as a multi-session wall. Sound right?
6. **Flares / clickables.** **Auto-collect, no clicker layer** vs you like USI voids?
7. **Working title lock.** Hiveworks / keep Cosmic Idle / you pick?

Not asking (locked unless you override): keep the stack; start from `main`; abandon expedition PRs; wave TD; Hub vs Sortie; drones as Compute; story last; phone PWA; clean saves.

---

## 14. What happens after approval

1. Close draft PRs 28–31 as superseded.
2. Phase 1 branch from `main`: Hub + Launch + short orbital sortie.
3. Playable preview on GH Pages as usual.

Until then, `main` stays the current Cosmic Idle sector game.
