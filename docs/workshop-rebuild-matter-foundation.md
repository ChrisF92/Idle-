# Workshop, Rebuild, and Matter — implementation notes

This is an implementation document for PR3. Canonical design remains `docs/act1-canonical-design.md`.

## Generic unlocks

Permanent known-count lives on `meta.genericUpgradeUnlocks` (`attack` / `defense` / `economy`). Starter-known count is 2 per category. Unlock costs for #3–#6 are `75 / 250 / 750 / 2000` Scrap. Unlock grants **zero** Workshop/Sortie levels. Ash Recovery also requires Furnace (`careerBestWave >= ACT1_CADENCE.furnace`).

First-W1 Sortie shop (`!meta.hullLostOnce`) shows only Weapon Power, Hull, Salvage / Kill. After first death, the starter six are visible.

## Workshop vs temporary levels

Workshop cycle levels: Scrap, Docked, reset on Rebuild, apply as starting power.
Temporary Sortie levels: Salvage, `combat.runUpgrades`, cost uses `runPurchasedLevel` only.

There is no universal 80-level cap. Caps by family (Workshop / Sortie):

| Family | Caps | Used by |
|---|---|---|
| throughput | 40 / 30 | Weapon Power, Hull, Shield, Salvage/Kill |
| cycle | 25 / 20 | Cycle Rate |
| chance | 12 / 8 | Crit Chance (2%/lvl, cap 40%) |
| crit-factor | 15 / 10 | Crit Factor (base 1.5 + 0.04/lvl) |
| penetration | 20 / 15 | Armor Pen |
| targeting | 12 / 8 | Targeting Servos (+3% slew/lvl) |
| protection | Armor 20/15; Damage Control 12/8 (DR cap 24%) | Armor, Damage Control |
| sustain | 20 / 15 | Shield Regen, Repair Rate |
| economy-flat | 25 / 20 | Salvage/Wave, Scrap/Kill, Scrap/Wave |
| economy-chance / yield | 20 / 15 | Fragment Find, Ash Recovery |

Existing per-level magnitudes were preserved where they still fit.

Targeting Servos and Matter Traverse Actuators compose through PR2 `collectTargetingModifiers` as **slew only**.

## Rebuild cycle

`prestige.cycle`: `{ bestWave, normalSortiesCompleted, scrapGenerated }`.

Gross Scrap uses `noteScrapGenerated` / `grantGeneratedScrap`. Spending, refunds, reconstitution, Challenge Sorties, and debug grants do not count.

Matter:

```
waveScore = floor((cycleBestWave / 25) ^ 1.25)
scrapScore = min(floor(sqrt(cycleScrapGenerated / 250)), floor(waveScore * 0.30))
Matter = max(1, waveScore + scrapScore)
```

First Rebuild: career Best ≥ 210, Docked, no Challenge, ≥3 normal Sorties, gain > 0.
Later: Docked, no Challenge, ≥1 normal Sortie this cycle, gain > 0. W210 is discovery-only.

## Reset / persist

Rebuild resets Sortie state, Salvage, temp upgrades, Directives, Heat, Furnace Sortie, Scrap, Workshop levels, physical Core Levels, Ash, and the cycle after payout.

Rebuild preserves Matter, career Best, generic unlocks, Core identity/Mastery/Doctrine, Frames, Relics, Blueprints, Foundry jobs/materials, Workers, Research, Process, Challenges, Codex, Time Compression preference, Matter purchases.

Foundry processing/fabrication and Research continue from the same progress. Reconstitution Cache Scrap is starting capital and is **not** `cycle.scrapGenerated`.

## Matter shop seeds

Non-temporal costs: stat nodes `4, 8, 15, 27, 49`; industrial/foundation `5, 9, 17, 31, 56`.

| Node | Max | Effect seed |
|---|---|---|
| weapon-calibration | 5 | +4% weapon-Core output / rank |
| traverse-actuators | 4 | +5% slew / rank |
| structural-memory | 5 | +4% Hull / rank |
| field-memory | 5 | +4% Shield / rank |
| recovery-charter | 5 | +6% combat Scrap / rank |
| foundry-throughput | 5 | +8% Processing + Fabrication / rank |
| worker-racks | 4 | +1 Worker cap / rank |
| reconstitution-cache | 5 | +24 starting Scrap / rank after Rebuild |
| sortie-provisioning | 5 | +8 starting Salvage / rank at normal Launch |
| time-compression-1/2/3 | 1 | 8 / 35 / 120 Matter → 1.5× / 2× / 3× |

Unspent Matter has no power.

## Time Compression clock

`advanceSeconds(realDt)` applies industry with `realDt` and combat with `realDt * selectedTimeCompression` through `SIM_FIXED_DT` substeps. PAUSED / hidden combat sim is 0. AI / Research / Process do not grant general combat speed.

## Extraction

Unlocks at career Best ≥ 210. Challenge Sorties cannot Extract. Bonus is `floor(sortieMark.grossScrapGenerated * 0.125)` of combat/Sortie Scrap only. Worker Scrap, reconstitution, and Salvage provisioning are excluded. Confirmation pauses; cancel stays PAUSED.

## Extension points

- PR4 Frames / 14-Core catalogue / Core Mastery
- PR5 Foundry materials / Blueprint lifecycle
- PR8 Furnace (Ash Recovery requires availability only)
- PR9 Research / Process / Reclaim Routing
- PR10 Challenge catalogue (structural Rebuild separation is already in place)
