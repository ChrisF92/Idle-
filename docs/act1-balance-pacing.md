# Act 1 balance and pacing validation

Live windows: `src/game/balance/act1.ts`. Named curves: `src/game/balance/curves.ts`.
This note replaces the USI-era numbers in `docs/act1-balance.md` as the validation log for the GDD-aligned loop.

Simulations start from a **fresh save**. Profiles: Casual, Balanced, Economy-first, Offensive, Defensive, Optimiser.

Combat still rolls `Math.random` in places, so times are bands, not exact repeats. No new systems were added. The simulator was taught to spend like a player (Salvage during the Sortie, Scrap on Workshop and Core Levels at Dock). Then **one curve was retuned**: Salvage temporary power.

---

## Progression timeline (Balanced, seed 1)

| Beat | Simulated | Target | Status |
|---|---|---|---|
| First Wave | 7s | 20s–4m | Fast tutorial pack |
| First Sortie / first defeat | 1m 24s → W10 | 3–5m | Short in sim combat; live Salvage pause stretches this |
| Foundry | ~31m | 45s–60m | Pass |
| Workers | ~32m | 8–90m | Pass |
| First Pulse / Plate Core Levels | 40–55m | — | After first Scrap docks |
| Wave 40–50 | 10–20m band clears | healthy wall 1–3 failed pushes | Survivability bump, then a New Best |
| First Rebuild | **~1h 50m–2h 20m at W80–W100** | 2–4h, door W70 | Inside window (CI pad 1.5–4.5h) |
| Post-Rebuild reclaim | ~19–25% of the push when measured | 20–40% | Slightly fast; not REBUILD EXPLOSIVE |
| Relics / Furnace / Research / Process / W300 | not required to *reach* first Rebuild | later doors | Expected |

Casual (10m sessions / 4h offline): first Rebuild is shorter in *active* time because offline Scrap feeds Core Levels.

---

## Identified walls

| Where | What | Verdict |
|---|---|---|
| W40–W50 | Sortie duration jumps vs the early 1–2m reclaim | **Healthy WALL** (survivability). Cleared; not 6–8 failed pushes |
| W70 | Economy-first and Casual rebuild here | Intended Rebuild door |
| W80–W100 | Balanced / Optimiser / Defensive stall then Rebuild | Acceptable overshoot |
| Worker Drones | Stay at 4 until the Fabricator facility (W90+) | Not a combat lever; industrial. Flagged only if still 4 after W140 |
| First Sortie 1m 24s | S1 mites stay 2-shot; sim skips the Salvage pause | Remaining: live onboarding is closer to 3–5m |
| Early Best Δ | Successful early pushes often +1 Wave | Target +2–4; Salvage nerf made pushes grindier |

No HARD WALL (6–8 meaningful Sorties without a New Best) on the first-Rebuild cycle once the streak resets at Rebuild.

---

## Changes made

### Simulator (not a new system)

- Spend **Salvage** on temporary run upgrades during the Sortie.
- Spend **Scrap** on Workshop starts **and** Pulse/Plate Core Levels at Dock.
- Assign Workers only to jobs that have work; start Foundry facilities when stock allows.
- Record Sorties, Core starting levels and Workshop ranks on Rebuild, failed-push streaks.
- HARD WALL is **6+ Sorties without a New Best**, not a single slow 10-wave band. The streak resets at Rebuild so reclaim is not a false HARD WALL.
- Sortie duration is launch→dock (Launch timestamp), not time since t=0.

### Salvage curve (the one retuned layer)

Temporary ranks were as strong as Workshop starts (`1.08^N` on the summed level). A Balanced run dumped 20k+ Salvage into Weapon Power and reached W110 in ~1h 35m.

| Constant | Before | After |
|---|---|---|
| Run-upgrade cost growth | `8 × 1.18^n` | `8 × 1.30^n` (first buy still 8) |
| Mid Salvage income | `4 × (s/4)^0.7` after band 4 | `4 × (s/4)^0.5` (`SALVAGE_MID_EXPONENT`) |
| Temporary power vs Workshop | same 8%/rank | **0.36 ×** Workshop per-level (`RUN_UPGRADE_POWER_SCALE`) |

Enemy hull/damage identities for S1–S8 were left on the authored 1.235 / 1.28 curve.

Workshop at first Rebuild is the cycle carry (Weapon Power ~L21–L23). That is the Scrap layer, not a Salvage steamroll. Salvage / Kill stays modest (~L5–L7) so it is not a dead economy rank.

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

Combat still rolls `Math.random`, so times are a band. Representative sweep after the Salvage retune (45-minute post-Rebuild window included in Active Time):

| Profile | First Rebuild | Rebuild Wave | Active (with repush) | Warnings |
|---|---|---|---|---|
| Casual | 1h 15m | W70 | 2h / 2d calendar | WALL W80. Offline Scrap feeds Core Starts; active time is *supposed* to undershoot 2–4h |
| Balanced | 1h 33m–2h 20m | W80–W100 | ~2h–2h 45m | WALL W40–W50 survivability. CI gate uses 2h±45m pad |
| Economy-first | 2h 27m | W70 | 3h 12m | Hits the door. Combat is slower because Salvage went into Salvage/Kill |
| Offensive | 1h 35m | W70 | 2h 20m | Under 2h (WARNING). Damage-first Salvage |
| Defensive | 3h 4m | W100 | 3h 49m | Inside 2–4h. Survivability grind |
| Optimiser | 2h 15m | W100 | 3h | WALL W50 |

Post-Rebuild reclaim (Balanced, when measured): **22m / 0.23** of a ~1h 33m–1h 56m push — inside 20–40%.

No profile treated a single Worker job as the only legal spend: Salvage Operations + Processing when the Foundry is running.

Economy payback: Salvage/Kill did not dominate Weapon Power on Balanced (~L5–L7 vs Weapon Power L20+). Dead-upgrade detector stays quiet unless Salvage/Kill is Workshop L16+ before the first Rebuild. Workshop Weapon Power is the intended cycle spend and converts to Matter at Rebuild.

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
| Relics | Lesson needs an owned Relic; W110 door cheat now grants a Battle Chip |
| Furnace | PASS — Ash/Heat, light Weapons |
| Research | PASS — start a project |
| Process / Challenges / Reinforce | Covered by unit tests + copy; browser pass was partial (time) |

---

## Remaining concerns

1. **First Sortie combat clock is ~1.5 minutes** (W10 defeat). GDD 3–5 minutes includes the paused first Salvage buy. Do not thicken S1 mites (2-shot identity).
2. **Early Sortie duration ~3m** vs 5–12m, Best Δ often +1 vs +2–4. The Salvage nerf that lands first Rebuild at ~2h also makes early pushes grindier. A later enemy-mid pass can restore +2–4 without touching S1.
3. **Offensive first Rebuild can undershoot 2h** because damage-first Salvage still outruns the window.
4. **Post-Rebuild reclaim** measured ~23% on a W80 door (target 20–40%). Inside the band.
5. **W300 70–100h** is not CI. Extrapolation from ~2h to W70–100 and later doors (Furnace W140, Research W170, Process W210, Challenges W250) is plausible but unverified. Run `fresh-wave-300` locally.
6. **Worker Fabricator** (W90, Foundry stock) is the first drone-growth job. Corps size 4 until then is intended, not SYSTEM IRRELEVANT.
7. **Furnace / Research / Process / Challenges** are after the first Rebuild. This pass only proves they are not required to *reach* Rebuild. A second loop should check that lighting Weapons changes a push, that one Research breakthrough is readable, and that Process QoL arrives after the manual Salvage/Workshop loop is repetitive.
8. **Material Mastery** still cannot broadly max in hours (Foundry recipes tick on the existing craft times).
9. Combat RNG (`Math.random` in hit/crit/loot) makes sim times a band.

---

## W1 → W300 simulated career summary

Verified in CI: **W1 → first Rebuild** (plus a 45-minute post-Rebuild window).

```
W1   7s     opening pack
W10  1m24s  first defeat (sim)
W20  ~31m   Foundry
W30  ~32m   Workers
W40–50      survivability wall (1–3 failed pushes)
W70         Rebuild legal; Casual / Economy-first take it
W80–100     Balanced / Defensive / Optimiser Rebuild (~2h)
W110        Relics (after Rebuild for most profiles)
W140        Furnace
W170        Research
W210        Process (after two Rebuilds + a project)
W250        Challenges
W300        Act 1 climax / Reinforce   [not simulated this PR]
```

Projected Act 1 length: first Rebuild at ~2h, then 3–5 Rebuilds through W140–W210 with ~20–40% reclaim, then slower late bands. **70–100h remains the authored W300 window**; treat as SKIP until a long Balanced run is gated.
