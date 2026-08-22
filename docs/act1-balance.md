# Act 1 economy, pacing, and progression

> **SUPERSEDED as design authority.** Career doors, sector language, and Network combat bars in this note are from the USI-era build. Live cadence lives in `src/game/cadence.ts` and GDD §102. Balance philosophy lives in GDD §141–155. Release work is sequenced in [`release-implementation-plan.md`](release-implementation-plan.md).
>
> Keep this file only as a historical curve dump until Phase 9 rewrites `src/game/balance/act1.ts` against the four GDD curves (enemy, Salvage, Scrap, Matter).

Source of truth for Hiveworks Act 1 after Process 2.0, Furnace 2.0, Network layers, Protocol rewards, Foundry depth, and Research breakthroughs.

This document is **not** a return to older USI / ITRTG calendar assumptions. Those games inspired the *shape* of a loop (understand → optimise → push → hit resistance → improve support systems → break through → automate solved work → discover a new layer). The numbers below are authored for the current systems.

Code catalog: `src/game/balance/act1.ts` (`ACT1_TARGETS`, `ACT1_UNLOCKS`, `ACT1_EXPECTED_AT`).

---

## Rhythm

The first hour should hand the player a new lever often. Later beats lengthen, but a wall should mean **engage another system**, not **wait eight hours on the same shop**.

Avoid both effortless steamroll and dead waiting.

---

## Target windows (engaged active time)

Windows are **active play**, not calendar time. Casual sessions stretch the same beats across offline catch-up (~1.5–2.5 h engagement per day).

| Beat | Min | Max | Notes |
|---|---|---|---|
| Sector 1 | 20 s | 4 min | Opening pack + first Pulse/Plate |
| Foundry unlock | 45 s | 8 min | Career door S2 |
| Reliquary unlock | 90 s | 14 min | Career door S3 |
| Furnace unlock | 4 min | 22 min | Career door S5 |
| Research unlock | 8 min | 40 min | Career door S7 |
| First Research breakthrough | 16 min | 90 min | After the desk is understood |
| Sector 10 | 18 min | 90 min | Often around or just after first Rebuild |
| **First Rebuild taken** | **8 min** | **50 min** | After the loop is understood, before stagnation |
| Protocols | 50 min | 6 h | Career door S18 |
| Echo | 80 min | 10 h | Career door S22 |
| Sector 30 (Act 1) | 3 h | 16 h | Next major boundary |

Casual calendar notes: first Rebuild days 0–1, Sector 10 days 0–2, Sector 30 days 4–14.

Warning pads live on each `ACT1_TARGETS` row. Simulator `WARNING` is inside the pad; `FAIL` is outside it.

---

## Career doors

| System | Highest sector ever |
|---|---|
| Process | First Blood (clear S1) |
| Foundry | 2 |
| Reliquary | 3 |
| Rebuild legal | 4 |
| Furnace | 5 |
| Codex | 6 |
| Research | 7 |
| Protocols | 18 |
| Echo | 22 |
| Act 1 | 30 |

Internal milestones between those doors (not new systems): Network Yield/Loom at S2, Relays from S8, Research breakthroughs, Foundry recipe chains, Furnace Extra Taps, Blue Reliquary at 19 or Observation breakthrough, Process accumulation at 10 / 20 / 35 / 50 earned.

---

## Expected bands at key sectors

Engaged player, not rails. From `ACT1_EXPECTED_AT`.

| | Pulse | Plate | Drones | Strike | Foundry recipes | Research nodes | Rebuilds | Process earned |
|---|---|---|---|---|---|---|---|---|
| Sector 4 | 2–8 | 1–6 | 4–6 | 1–8 | 0–4 | 0 | 0–1 | 4–12 |
| Sector 10 | 4–14 | 3–12 | 4–10 | 4–20 | 2–8 | 1–8 | 1–4 | 8–40 |
| Sector 30 | 8–28 | 6–24 | 6–16 | 10–40 | 6–16 | 6–20 | 3–12 | 25–120 |

If a sim sits far outside a band, the curve is wrong — do not “fix” it by adding a new gameplay system.

---

## Formulas and constants

### Salvage

S1–S4 stay linear so three S1 kills still buy Pulse L1 (cost 3).

```
salvageSectorBase(s) = s                         if s ≤ 4
                     = 4 × (s / 4)^0.7           if s > 4
salvageFromKill      = max(1, floor(base^exp × routeMult))
boss                 = 5 × trash
```

`exp` starts at 1. Protocols can raise the exponent; Mute Salvage zeros drops.

Examples: S1 = 1, S4 = 4, S10 ≈ 7, S30 ≈ 16. Salvage stays relevant; it must not vacuum Foundry / Furnace / Research before the first Rebuild.

### Combat (hull / damage)

S1–S8 exponents are identity with the early-game feel tests. Do not retune those to “fix” late Act 1.

| Band | Hull growth | Damage growth |
|---|---|---|
| Base | 1.55 | 0.90 |
| S1–S8 | 1.235 | 1.28 |
| S9–S18 | 1.18 | 1.155 |
| S19+ | 1.22 | 1.245 |

S1 mites stay 2-shot by L0 Pulse. Plate matters because packs live long enough to fire.

### Cores

| Core | Cost | Per-level |
|---|---|---|
| Pulse Cannon | `ceil(3 × 1.21^n)` | +5 damage (base 10, RoF 0.50/s) |
| Plate Layer | `ceil(6 × 1.2^n)` | +5 max shield (base +30, 5%/s regen) |

Buy Max and Auto Salvage **leave `foundrySalvageReserve` Salvage** (one Slag Ingot craft) once Pulse and Plate are at least L1 and Foundry is open. Manual taps are unaffected. This stops a pathological “spend every scrap of Salvage on Pulse forever” pattern.

### Network

```
fillCost = fillBase × (1 + growth × L^1.08)
primary fillBase = 12
growth            = 0.18
fill cap          = 0.085 levels/s before Relays
docked fill       = ×0.012
starting drones   = 4
bonus             = 1 + k × ((8L + 1)^exp − 1)
Strike k = 0.065   Ward k = 0.07   Yield k = 0.05
exp = 0.5 + 0.02√lattice + hooks
```

Early levels land in seconds on a sortie. Later fills take much longer, which is why extra drones, Relays (fill cap + cheaper later fills), and Links are breakthroughs rather than a second flat shop. **Docked bars crawl** so a closed app is not a full Strike shift. Bar levels reset on Rebuild; drones and Link ranks stay.

### Furnace

Live Heat channels. You cannot light everything permanently in early Act 1.

| Constant | Value |
|---|---|
| Unlock | S5 |
| Ash → Heat | 10 ash / 1 Heat at Kindling 0 |
| Idle gen | 0.02 /s |
| Hearth idle | 0.035 /s per rank |
| Base ash feed | 0.055 /s |
| Base capacity | 24 |
| Channel max level | 3 |
| Slot cap | 5 |

Weapons I / II / III: ×1.18 / ×1.34 / ×1.52 at 0.05 / 0.16 / 0.48 Heat/s.

If consuming outruns generating, the lowest-priority channel drops a level (starvation). That is shown, not silent.

### Foundry

| Recipe | Time | Cost | Opens |
|---|---|---|---|
| Slag Ingot | 6 s | 10 Salvage | S2 |
| Filament | 6 s | 5 scrap | S2 |

Later recipes spend those materials. Mastery shortens crafts, raises output, cheapens costs, then solves the floor. Foundry Points buy smelters and shop-floor ranks. Recipe levels persist on Rebuild; fitted bits come off.

New production complexity should arrive around the time the player has a second smelter, a queue, or Smart Smelt.

### Research

```
nodeCost(index) = floor(52 × 1.5^index × (breakthrough ? 1.3 : 1))
kill XP         = 0.58 + 0.085 × (sector − 1)   (boss ×2.5)
focus           = 4×     off-focus crawls
nodes / branch  = 9      breakthroughs at indices 2, 5, 8
```

First node 52 XP. Important breakthroughs: Extra Tap (Energy 2), Second Smelter Bay (Material 2), Blue Bay (Observation 5). Nodes persist across Rebuild.

### Process

First Blood grants 4 PP. Core Buy Max costs 4. Early QoL should land quickly enough to prove the board. Major smart automation is earned later.

Accumulation (lifetime Earned, does not drop when you buy): 10 Salvage ×1.10, 20 Network fill ×1.10, 35 damage/shield ×1.10, 50 Foundry, then later ranks.

### Rebuild

Legal at sector 4.

```
matter = floor(sector / 2) + rebuildsAlreadyDone + 1
       × (1 + 0.4 × ascensions)   then Protocol multipliers
momentum damage = min(0.5, rebuilds × 0.04)
```

First S10 Rebuild yields 6 Matter. Simulator takes a Rebuild after an 8-minute highest-sector stall **or** 3 consecutive hull losses — not every sector, not a spam reset.

Swap when the push stalls and another system cannot break the wall.

---

## System value audit

Question: if the player ignored this system entirely, how much slower is Act 1?

| System | If ignored | Role |
|---|---|---|
| Cores | Run dies. Pulse/Plate are the hull. | Primary combat spend. Must not dwarf every other lever. |
| Network | Damage/shield trail badly by S6–S10. Strike L10 is about +52% damage; Relays are later breakthroughs. | First support system after Cores. Early levels must matter. |
| Foundry | Miss Relay Coil (~×1.10), extra smelters, solved stock. First hour still works; S10+ walls last longer. | Needs Salvage reservation so Buy Max cannot starve it. |
| Furnace | Miss Weapons I (+18%) and later Extra Taps. Heat Links for extra drones also lag. | Tradeoff system — lighting everything at once is the wrong “win”. |
| Research | Miss Extra Tap, Second Smelter, Blue Reliquary, fill/XP multipliers. First Rebuild still happens; S18+ stretch. | Breakthroughs are pacing beats, not a passive dump. |
| Reliquary | Small early; Blue/green later. Resonance makes duplicates matter. | Colour doors sprinkle the S3–S19 gap. |
| Process | Playable but chores stay manual. Buy Max / Optimise / queues are the “automate solved work” beat. | QoL first; smart automation earned. |
| Rebuild | Soft-capped at the first real wall. No Matter shop, no momentum. | Must not be spam (sub-8 min) or mandatory multi-hour waits. |
| Protocols / Echo | Optional until Task List / S22. Completions change **scaling**, not a flat shop. | Late Act 1 layers, not required for first Rebuild. |

Do not “buff” a weak system with a flat ×10. Raise it through its existing mechanic (Foundry actually running, Network Relays arriving, Furnace slots as a choice).

---

## Simulator assumptions

Implementation: `src/game/simulation/`. Accurate 1 s chunks. Guides are skipped (`skipGuides`) so the career is not blocked on overlay taps.

| Strategy | Behaviour |
|---|---|
| active | Spends Cores on a simple Pulse/Plate score, keeps Foundry smelting, lights Furnace weapons/shielding, buys Process when cheap. |
| optimiser | Value-spend Cores, chase Energy then Material then Observation breakthroughs, may enter Mute Network after a Rebuild with Pulse L0. |
| casual | Shorter decision loop. Session profile default 10 min active / 4 h offline (tests may override). Docks between sessions. |
| idle | Launch + advance only. |

Rebuild heuristic (`DEFAULT_REBUILD`): 8 min stall on highest sector, or 3 consecutive losses, or a large TTK spike.

Stops used for this pass: `first-rebuild`, `duration` (casual 8 h calendar), optional `RUN_SIM_BASELINES=1` for S30 / multi-day.

Snapshots (`Act1Snapshot`) record sector, Salvage, Cores, Network, drones, Foundry, Furnace, Research, Process, Rebuilds, Protocols, Echo, and theoretical damage contribution at each major milestone.

The sim is a **representative engaged player**, not a TAS. It still must actually use Foundry / Furnace / Research rather than dump 100% of Salvage into Pulse.

---

## Onboarding

Every major Act 1 system has a door that explains:

1. What it is  
2. Why you care  
3. What resource it uses  
4. What decision you are making  
5. What to do first  

Important first-time mechanical explanations **pause** (`required: true`). Secondary tips stay non-blocking.

Toast says something exists. Onboarding teaches how it works. The toast is not the tutorial.

Doors: Dock / Sortie / Cores / Network / Foundry / Reliquary / Rebuild / Furnace / Research / Process / Protocols / Echo.

Skip is always available. Skip of a system door does not retire a later v2 tour (e.g. skip Research tab, still get Research XP). Reloads and migrated saves (SAVE_VERSION 33) keep `seenOnboarding`.

---

## Player-facing cause / effect

Exact advanced maths can stay hidden. Cause and effect must not.

| Symptom | Where it is explained |
|---|---|
| Damage went up | Core inspect, Network Strike, Furnace Weapons, Reliquary, Research, Rebuild momentum |
| Network slowed down | Inspect “Cycle work” vs first fill; screen help: later cycles take longer |
| Furnace shut off a channel | Inspect Net + starve note: drain exceeded generation |
| Rebuild reward changed | Inspect Rebuild: ~half sector + Rebuilds already done |
| Research sped up | Inspect branch: Focus 4×, others crawl |

---

## What this pass does not change

- Pulse `3 × 1.21^n` / Plate `6 × 1.2^n`
- S1–S8 enemy hull/damage exponents
- SAVE_VERSION (still 33) — numbers and copy only
- Furnace “light everything forever” arriving early
- Adding a new major gameplay system
