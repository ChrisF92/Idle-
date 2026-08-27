# Frames, Cores, and Core Mastery — implementation notes

This is an implementation document for PR4. Canonical design remains `docs/act1-canonical-design.md`.

## Universal Core slots

All Frame slots are untyped. Role tags (`weapon` / `defense` / `utility`) are labels for UI, targeting, and later Relic/Challenge rules. They never decide legality.

Authoritative capacity is `usableCoreSlots(state)`:

- normal bus: starter 2, +1 at career Best Wave 75, +1 at 330, optional later grants via `meta.coreSlotGrants` (Engineering/Foundry — PR5)
- cap 5 for Standard / Bastion / Reactor / Harvester
- Swarm: `min(6, normal + 1)`

Do not encode Swarm as a permanent 6-slot Frame.

## Frames

Production catalogue is exactly:

| ID | Name | Source metadata |
|---|---|---|
| `starter-frame` | Standard | starter |
| `bastion-frame` | Bastion | Tempered Alloy Material Mastery (PR5) |
| `swarm-frame` | Swarm | Single Pattern Challenge (PR10) |
| `reactor-frame` | Reactor | W500 route (later PR) |
| `harvester-frame` | Harvester | Cold Furnace Challenge (PR10) |

Locked Frames show **Not yet obtainable**. PR4 does not grant them from Best Wave or leftover shops. Dev Tools can still select any Frame.

Frame modifiers PR8/PR5 consume: `heatMult`, `furnaceOutputMult`, `extraFurnaceChannels: 0`, `foundryOutputMult` (Harvester stays 1), combat Salvage/Scrap/Ash mults.

## Cores

Exactly fourteen production types. Leftover IDs in `LEGACY_CORE_IDS` are absent.

Physical copies live in `shipyard.coreInstances` with `id` like `pulse-cannon:1`. Fitted order is `modules` + `equippedCoreIds`. Instance-specific: Core Level, Doctrine, future Relic fits. Type-shared: Mastery.

Fresh account: Standard, Pulse Cannon `:1`, Plate Layer `:1`, two universal slots.

## Core Level vs Mastery

- Core Level: Scrap, physical copy, survives Defeat/Extraction/next Sortie, **resets on Rebuild**.
- Mastery: use-driven XP, shared by Core type, M0→M100, survives Defeat/Extraction/Rebuild/loadout change. Unequipped copies do not earn use XP.

Mastery XP curve is the PR3 seed in `masteryXpToNext` (`coreProgression.ts`). PR11 owns final balance.

There is no Salvage Core-level purchase and no per-Sortie `coreRunLevels`. Leftover USI 2-pick Core Level nodes no longer apply combat bonuses; authored Mastery effects are the only Core milestone path.

## Mastery milestones

Authored in `coreMastery.ts`. Explicit weapon milestones and Choir Tap M30/M50 are implemented. Defense/utility intermediate thresholds that the canonical design does not assign to a level remain `pending: true` slots. M20 is Relic capability expand metadata only (PR6). Socket-count unlocks after the second socket are not invented.

## Targeting geometry

PR2 targeting engine is unchanged. Final authored profiles live in `targetingProfiles.ts`. Acquisition > fire range. Projectiles/beams originate from the physical Core. Heavy Lance does not pre-charge before a legal firing solution.

## Later-system hooks

- Frame furnace modifiers for PR8
- Choir Tap Heat packet / Furnace Feed multipliers for PR8
- mature socket layouts for PR6
- Core/Frame `unlockSource` metadata for PR5/PR10
- `meta.coreSlotGrants` for the late fifth slot (PR5)

Save version is **45**. Incompatible saves reset. No Frame/Core ID migration.
