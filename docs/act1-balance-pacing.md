# Act 1 balance and pacing validation

Live windows: `src/game/balance/act1.ts`. Named curves: `src/game/balance/curves.ts`.
This note replaces the USI-era numbers in `docs/act1-balance.md` as the validation log for the GDD-aligned loop.

Simulations start from a **fresh save**. Profiles: Casual, Balanced, Economy-first, Offensive, Defensive, Optimiser.

No new systems were added. The simulator was taught to spend like a player (Salvage during the Sortie, Scrap on Workshop and Core Levels at Dock). Then **one curve was retuned**: Salvage temporary power.

---

## Progression timeline (Balanced, seed 1)

| Beat | Simulated | Target | Status |
|---|---|---|---|
| First Wave | 7s | 20s–4m | Fast tutorial pack |
| First Sortie / first defeat | 1m 24s → W10 | 3–5m | Short in sim combat; live Salvage pause stretches this |
| Foundry | ~25m | 45s–60m | Pass |
| Workers | ~29m | 8–90m | Pass |
| First Pulse / Plate Core Levels | 25–50m | — | After first Scrap docks |
| Wave 40–50 | 10–40m band clears | healthy wall 1–3 failed pushes | Survivability bump, then a New Best |
| First Rebuild | **2h 1m at W100** | 2–4h, door W70 | Inside window; slightly past the door |
| Relics / Furnace / Research / Process / W300 | not reached before first Rebuild | later doors | Expected |

Casual (10m sessions / 4h offline): first Rebuild at **1h active / 1 calendar day**, Wave 70.

---

## Identified walls

| Where | What | Verdict |
|---|---|---|
| W40–W50 | Sortie duration jumps vs the early 1–2m reclaim | **Healthy WALL** (survivability). Cleared; not 6–8 failed pushes |
| W70 | Economy-first and Casual rebuild here | Intended Rebuild door |
| W80–W100 | Balanced / Optimiser / Defensive stall then Rebuild | Acceptable overshoot |
| Worker Drones | Stay at 4 until the Fabricator facility (W90+) | Not a combat lever; industrial. Flagged only if still 4 after W140 |
| First Sortie 1m 24s | S1 mites stay 2-shot; sim skips the Salvage pause | Remaining: live onboarding is closer to 3–5m |

No HARD WALL (6–8 meaningful Sorties without a New Best) on the first-Rebuild profiles.

---

## Changes made

### Simulator (not a new system)

- Spend **Salvage** on temporary run upgrades during the Sortie.
- Spend **Scrap** on Workshop starts **and** Pulse/Plate Core Levels at Dock.
- Assign Workers only to jobs that have work; start Foundry facilities when stock allows.
- Record Sorties, Core starting levels on Rebuild, failed-push streaks.
- HARD WALL is **6+ Sorties without a New Best**, not a single slow 10-wave band.

### Salvage curve (the one retuned layer)

Temporary ranks were as strong as Workshop starts (`1.08^N` on the summed level). A Balanced run dumped 20k+ Salvage into Weapon Power and reached W110 in ~1h 35m.

| Constant | Before | After |
|---|---|---|
| Run-upgrade cost growth | `8 × 1.18^n` | `8 × 1.26^n` (first buy still 8) |
| Mid Salvage income | `4 × (s/4)^0.7` after band 4 | `4 × (s/4)^0.58` |
| Temporary power vs Workshop | same 8%/rank | **0.48 ×** Workshop per-level (`RUN_UPGRADE_POWER_SCALE`) |

Enemy hull/damage identities for S1–S8 were left on the authored 1.235 / 1.28 curve.

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

---

## Six-profile first Rebuild (seed 1)

| Profile | Active | Calendar | End Wave | Matter | Pulse/Plate bought | Salvage spent | Warnings |
|---|---|---|---|---|---|---|---|
| Casual | 1h | 1d 1h | 73 | 82 | 15 / 15 | 3.1k | WALL W40 |
| Balanced | 2h 1m | 2h 1m | 100 | 100 | 4 / 4 | 18k | WALL W50 |
| Economy-first | 2h 4m–2h 43m | same | 72–73 | cores bought | — | WALL W40 |
| Offensive | 1h 17m | 1h 17m | 75 | Pulse-biased | high | Under 2h (WARNING/FAIL) |
| Defensive | 2h 13m | 2h 13m | 90 | 7 / 8 | 7.3k | WALL W50 |
| Optimiser | 1h 55m | 1h 55m | 100 | 100 | 4 / 4 | 25k | WALL W50 |

Balanced, Economy-first, and Defensive land inside **2–4h**. Optimiser is a few minutes under (WARNING pad 30m). Offensive can rebuild at ~1h 17m — damage-first Salvage still outruns the window; a later enemy-mid pass can pull it back. Casual active time is shorter because offline Scrap feeds Core Levels.

No profile treated a single Worker job as the only legal spend: Salvage Operations + Processing when the Foundry is running.

Economy payback: Salvage/Kill did not dominate Weapon Power on Balanced. Dead-upgrade detector stays quiet unless Salvage/Kill is Workshop L16+ before the first Rebuild.

---

## Remaining concerns

1. **First Sortie combat clock is ~1.5 minutes** (W10 defeat). GDD 3–5 minutes includes the paused first Salvage buy. Do not thicken S1 mites (2-shot identity).
2. **Balanced / Optimiser first Rebuild at W80–W100**, not W70. Economy-first and Casual hit the door. A later enemy-mid pass can pull the offensive profiles back if needed — not this Salvage PR.
3. **Post-Rebuild 20–40% reclaim** was not fully measured (90s repush window). Needs a longer post-Rebuild stop.
4. **W300 70–100h** is not CI. Extrapolation from ~2h to W70–100 and later doors (Furnace W140, Research W170, Process W210, Challenges W250) is plausible but unverified. Run `fresh-wave-300` locally.
5. **Worker Fabricator** (W90, Foundry stock) is the first drone-growth job. Corps size 4 until then is intended, not SYSTEM IRRELEVANT.
6. **Furnace / Research / Process / Challenges** are after the first Rebuild. This pass only proves they are not required to *reach* Rebuild. A second loop should check that lighting Weapons changes a push, that one Research breakthrough is readable, and that Process QoL arrives after the manual Salvage/Workshop loop is repetitive.
7. **Material Mastery** still cannot broadly max in hours (Foundry recipes tick on the existing craft times).

---

## W1 → W300 simulated career summary

Verified in CI: **W1 → first Rebuild**.

```
W1   7s     opening pack
W10  1m24s  first defeat (sim)
W20  ~25m   Foundry
W30  ~29m   Workers
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

Projected Act 1 length: first Rebuild at ~2h, then 3–5 Rebuilds through W140–W210 with 20–40% reclaim, then slower late bands. **70–100h remains the authored W300 window**; treat as SKIP until a long Balanced run is gated.
