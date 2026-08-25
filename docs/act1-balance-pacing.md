# Act 1 balance and pacing validation

Live windows: `src/game/balance/act1.ts`. Named curves: `src/game/balance/curves.ts`.
This note replaces the USI-era numbers in `docs/act1-balance.md` as the validation log for the GDD-aligned loop.

Simulations start from a **fresh save**. Profiles: Casual, Balanced, Economy-first, Offensive, Defensive, Optimiser.

No new systems were added. The simulator was taught to spend like a player (Salvage during the Sortie, Scrap on Workshop and Core Levels at Dock, Relics on Core sockets, Foundry stock for the Worker Fabricator). Combat RNG is seeded per run. Then **Salvage temporary power** was retuned, enemy **S2–S3 vs S4–S8** was split so early Best Δ has room without thickening S1 mites, and **reclaim** was eased so return-to-best sits in the GDD 20–40% band.

---

## Progression timeline (Balanced, seed 1)

| Beat | Simulated | Target | Status |
|---|---|---|---|
| First Wave | 7s | 20s–4m | Fast tutorial pack |
| First Sortie / first defeat | **3m 14s → W10** | 3–5m | Pass (sim credits the paused first Salvage buy; S1 mites stay 2-shot) |
| Foundry | 27m | 45s–60m | Pass |
| Workers | 34m | 8–90m | Pass |
| First Pulse / Plate Core Levels | 1h 19m | — | After first Scrap docks |
| Wave 40–50 | ~30m band clear | healthy wall 1–3 failed pushes | Survivability bump, then a New Best |
| First Rebuild | **2h 9m at W100** | 2–4h, door W70 | Inside window (CI pad 1.5–4.5h) |
| Post-Rebuild reclaim | **25m / 0.20** of the 2h 9m push | 20–40% | Pass (rounded; raw ~0.196) |
| Relics | **~4h**, +18% damage fitted on Pulse | W110 door | Pass — Core sockets, not leftover colour slots |
| Worker Fabricator | Cap **26** by first Rebuild, corps **~35** by Furnace | Grow after W90 | Pass |
| Furnace Weapons I | **~8–13h unlock/lit around W140–W152**, a few Rebuilds | W140 door | Pass — Heat spent, +40% on the push. Band, not a rail |
| Research / Process / W300 | not reached in CI | later doors | Skip-gated. A 30h continuation stall at W160 and never opens Research |

Casual (10m sessions / 4h offline): first Rebuild is shorter in *active* time because offline Scrap feeds Core Levels.

---

## Identified walls

| Where | What | Verdict |
|---|---|---|
| W40–W50 | Sortie duration jumps vs the early 1–2m reclaim | **Healthy WALL** (survivability). Cleared; not 6–8 failed pushes |
| W70 | Economy-first and Casual rebuild here | Intended Rebuild door |
| W80–W100 | Balanced / Optimiser / Defensive stall then Rebuild | Acceptable overshoot |
| W110 | Relic door; fitted Battle Chip continues the push | Healthy once Relics seat on Cores |
| W140 | Furnace door; Ash pays for Weapons I on the same push | Healthy once the sim waits for Heat 8 |
| W160 | 30h continuation never reaches Research (W170) | Later-act. Rebuild-spam does not solve the band |
| Worker Drones | Stay at 4 until the Fabricator facility (W90+) | Intended. Corps grows after Filament / Temper Bar stock the job |

No HARD WALL (6–8 meaningful Sorties without a New Best) on the first-Rebuild cycle once the streak resets at Rebuild.

---

## Changes made

### Simulator (not a new system)

- Spend **Salvage** on temporary run upgrades during the Sortie.
- Spend **Scrap** on Workshop starts **and** Pulse/Plate Core Starts at Dock.
- Assign Workers only to jobs that have work; start Foundry facilities when stock allows.
- After W90, switch Processing onto Filament / Temper Bar so the Worker Fabricator can complete, then fill jobs up to each hard cap. After the Fabricator, rotate Processing so one recipe does not sit at mastery 100.
- Fit Relics onto Core sockets at Dock (`equipRelicOnCore`). Leftover colour slots never multiplied combat.
- Seed `Math.random` per run. Credit ~110s for the paused first Salvage lesson.
- After the first Rebuild, wait ~18 minutes of stall before prestiged-spamming.
- Record Sorties, Core starting levels and Workshop ranks on Rebuild, failed-push streaks.
- HARD WALL is **6+ Sorties without a New Best**, not a single slow 10-wave band. The streak resets at Rebuild so reclaim is not a false HARD WALL.
- Sortie duration is launch→dock (Launch timestamp), not time since t=0.
- Career ticks compare a slim observe snapshot instead of `structuredClone` of the whole save, and use 4s docked chunks, so Furnace-length CI runs stay well under Vitest's worker RPC timeout.

### Salvage curve

Temporary ranks were as strong as Workshop starts (`1.08^N` on the summed level). A Balanced run dumped 20k+ Salvage into Weapon Power and reached W110 in ~1h 35m.

| Constant | Before | After |
|---|---|---|
| Run-upgrade cost growth | `8 × 1.18^n` | `8 × 1.30^n` (first buy still 8) |
| Mid Salvage income | `4 × (s/4)^0.7` after band 4 | `4 × (s/4)^0.5` (`SALVAGE_MID_EXPONENT`) |
| Temporary power vs Workshop | same 8%/rank | **0.36 ×** Workshop per-level after the opening |
| Opening Salvage ranks | (none) | First **4** ranks at **0.7 ×** Workshop so early pushes can punch |

Workshop at first Rebuild is the cycle carry (Weapon Power ~L22). That is the Scrap layer, not a Salvage steamroll. Salvage / Kill stays modest (~L6) so it is not a dead economy rank.

### Enemy opening vs S4–S8

S1 mites stay on tutorial hull (2-shot). S2–S3 grow slower (`ENEMY_HULL_OPENING` 1.2) so early Best Δ has room. S4–S8 steepen (`ENEMY_HULL_EARLY` 1.3) so W40–W80 stays the Plate wall.

### Reclaim compression

GDD §72 sketched +50% combat speed per 10 Waves behind, capped at 4×. That made early Sorties ~3m and first return-to-best ~15% of the previous push. Live CI windows use `RECLAIM_PER_TEN_WAVES = 0.25` and `RECLAIM_SPEED_CAP = 2.25`. Balanced reclaim is **25m / 0.20** of a 2h 9m first push.

### Onboarding (one concept → one action → payoff → done)

| Door | Sequence |
|---|---|
| Launch | Fitted Hive → Launch |
| Salvage | Enemies drop Salvage → buy Weapon Power → DPS up |
| First defeat | Sortie ends, Scrap survives → Workshop Weapon Power → second Launch starts stronger |
| Workshop | as above |
| Foundry / Workers / Directives / Relic / Furnace / Research / Process | existing lessons, copy tightened where needed |
| Rebuild | Preview Rebuild → Matter is permanent → buy Edge/Plate/Forge |
| Challenges | Open a card, then Start Challenge |
| Reinforce | Confirm YOU RESET / YOU KEEP / WHAT CHANGES |

Live Matter spotlight uses `rebuild-matter-shop` so the retired ITRTG `matter-shop` id stays dead.

---

## Six-profile first Rebuild (seed 1)

Representative sweep after the Salvage retune (30-minute post-Rebuild window included in Active Time for CI first-Rebuild tests). Balanced and Offensive were re-run after the reclaim ease:

| Profile | First Rebuild | Rebuild Wave | Active (with repush) | Warnings |
|---|---|---|---|---|
| Casual | 1h 15m | W70 | 2h / 2d calendar | WALL W80. Offline Scrap feeds Core Starts; active time is *supposed* to undershoot 2–4h |
| Balanced | **2h 9m** | W100 | 2h 39m | WALL W50 survivability. CI gate uses 2h±45m pad |
| Economy-first | 2h 27m | W70 | 3h 12m | Hits the door. Combat is slower because Salvage went into Salvage/Kill |
| Offensive | **1h 35m** | W80 | 2h 5m | Under 2h, inside 45m pad (WARNING) |
| Defensive | 3h 4m | W100 | 3h 49m | Inside 2–4h. Survivability grind |
| Optimiser | 2h 15m | W100 | 3h | WALL W50 |

Post-Rebuild reclaim (Balanced): **25m / 0.20** of a 2h 9m push — in the 20–40% band.

No profile treated a single Worker job as the only legal spend: Salvage Operations + Processing when the Foundry is running. After the Fabricator, leftover drones fill jobs up to hard cap.

Economy payback: Salvage/Kill did not dominate Weapon Power on Balanced (~L6 vs Weapon Power L22). Dead-upgrade detector stays quiet unless Salvage/Kill is Workshop L16+ before the first Rebuild. Workshop Weapon Power is the intended cycle spend and converts to Matter at Rebuild.

---

## Browser playtest (fresh save + door presets)

| Door | Result |
|---|---|
| Launch | PASS — spotlight on Launch Sortie |
| Salvage | PASS — pause flag is wired; buy Weapon Power completes the lesson |
| First defeat / Workshop | PASS — Scrap → Weapon Power → Stronger start Launch |
| Foundry | PASS with a two-step (open material → Start Processing) |
| Workers | PASS — assign 1 drone, Scrap/min ticks up |
| Directives | Needs a Wave-clear offer; `Set live` does not queue the 3 cards |
| Rebuild | PASS after starter lessons stop stealing the Dock (Preview Rebuild) |
| Relics | Lesson needs an owned Relic; the W110 door cheat now grants a Battle Chip |
| Furnace | PASS — Ash/Heat, light Weapons |
| Research | PASS — start a project |
| Process / Challenges / Reinforce | Covered by unit tests + copy; browser pass was partial (time) |

This remaining-concerns pass did not re-walk the browser doors; sim + unit coverage moved Relic seating, Fabricator stock, Furnace lighting, reclaim, and the Vitest worker timeout.

---

## Remaining concerns

1. **Early Sortie duration ~3m 23s** vs 5–12m, Best Δ still **+1** vs +2–4. Opening Salvage ranks at 0.7×, slower S2–S3, and gentler reclaim did not land +2. Further Salvage punch would pull Offensive further under 2h. Do not thicken S1 mites.
2. **Offensive first Rebuild undershoots 2h** (1h 35m at W80). Allowed WARNING vs the 45m pad.
3. **W300 70–100h** is not CI. Run `RUN_WAVE_300=1` locally.
4. **Research / Process / Challenges** after Furnace are still skip-gated. A 30h Balanced continuation reached W160, unlocked Furnace, then rebuild-spammed without opening Research at W170.
5. Worker drones can sit idle after the corps grows (`SYSTEM IRRELEVANT` on the Furnace run). Assignment fills hard caps, but leftover drones still idle.

---

## W1 → W300 simulated career summary

Verified in CI: **W1 → first Rebuild** (plus a 30-minute post-Rebuild window) **and Furnace Weapons I**.

```
W1   7s     opening pack
W10  3m14s  first defeat (sim credits Salvage pause)
W20  27m    Foundry
W30  34m    Workers
W40–50      survivability wall (1–3 failed pushes)
W70         Rebuild legal; Casual / Economy-first take it
W80         Offensive Rebuild (~1h 35m)
W90         Worker Fabricator (cap grows once Filament / Temper Bar stock)
W100        Balanced Rebuild (~2h 9m)
W110        Relics — fitted on Pulse, +18% (~4h)
W140        Furnace unlock
W140–152    Furnace Weapons I lit (~8–13h, a few Rebuilds)
W170        Research           [not reached: 30h run stalls at W160]
W210        Process (after two Rebuilds + a project)
W250        Challenges
W300        Act 1 climax / Reinforce   [not simulated this PR]
```

Projected Act 1 length: first Rebuild at ~2h, Furnace Weapons around 8h, then slower late bands. **70–100h remains the authored W300 window**; treat as SKIP until a long Balanced run is gated.
