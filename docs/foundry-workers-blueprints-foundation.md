# PR5 Foundry / Workers / Blueprints — implementation note

This is an implementation map for the Act 1 industrial foundation. It does **not** rewrite `docs/act1-canonical-design.md`. Numeric values below are **PR11-tunable seeds** unless the canonical design already named the mechanic.

Save version: **46**. No migration. Incompatible previous versions reset.

## 12-material Processing network

| ID | Name | Inputs | Time | Prerequisite |
| --- | --- | --- | --- | --- |
| `recovered-stock` | Recovered Stock | 8 Scrap | 20s | Foundry |
| `conductive-filament` | Conductive Filament | 6 Scrap | 20s | Foundry |
| `tempered-alloy` | Tempered Alloy | 2 Recovered Stock + 4 Scrap | 40s | Foundry |
| `ballistic-composite` | Ballistic Composite | 2 Recovered Stock + 2 Conductive Filament | 45s | Foundry |
| `optical-glass` | Optical Glass | 2 Conductive Filament + 4 Scrap | 45s | Foundry |
| `shield-lattice` | Shield Lattice | 2 Tempered Alloy + 2 Conductive Filament | 60s | Foundry |
| `control-mesh` | Control Mesh | 2 Optical Glass + 2 Conductive Filament | 75s | Foundry |
| `phase-crystal` | Phase Crystal | 3 Optical Glass | 90s | explicit `advanced-processing` capability |
| `nanite-compound` | Nanite Compound | 2 Control Mesh + 2 Tempered Alloy | 120s | Foundry |
| `resonant-ceramic` | Resonant Ceramic | 2 Tempered Alloy + 10 Ash | 90s | Foundry |
| `thermal-conductor` | Thermal Conductor | 2 Resonant Ceramic + 2 Conductive Filament + 15 Ash | 120s | Foundry |
| `crown-matrix` | Crown Matrix | *unauthored* | 180s placeholder | `late-choir-apex-recovery` + authored recipe |

Output is always **1**. One paid cycle. No auto-repeat (Processing Repeat is PR9).

Ash is cycle currency. Resonant Ceramic / Thermal Conductor persist through Rebuild after they are made.

## Material Mastery M0→M5

- Keyed by material. XP only from completed Processing of that output.
- Direct recovery does **not** grant XP.
- Cumulative XP: `[0, 4, 10, 20, 36, 60]`. **1 XP per cycle**. Cap M5.
- Persists Sortie / Defeat / Extraction / Rebuild / save.

## Blueprint lifecycle

States: `UNKNOWN` → `FRAGMENTED` → `DISCOVERED` → `OWNED`.

- Fragments: `foundry.fragments[blueprintId]`
- Discovery: `foundry.discovered[]` (type knowledge only)
- OWNED = discovered **and** physical ownership (`shipyard.coreInstances` / `shipyard.unlockedFrames`)
- Discovery **never** creates a Core instance
- `unlockedModules` is type knowledge from discovery, not physical ownership

Schematic fragments are Blueprint-specific (`Heavy Lance Schematic 2/5`). Required counts are seeds:

- Starters: 0
- Flak: 3
- Heavy / Grav / Slag: 5
- Phase / Sensor / Barrier: 6
- Salvage Beacon / Rapid Aegis / Nano Lathe: 4
- Ablative Mesh / Choir Tap / Frames (non-starter): 5

Fragment drop seed: base **0.025**, boss ×**2.2**. Eligibility `max(W50, sourceWave − 40)`. Completed Blueprints do not drop.

Guaranteed Wave-secure sources (boss-secure event, not `careerBestWave` backfill):

- W50 Flak, W100 Heavy, W150 Grav, W200 Slag, W250 Phase, W300 Sensor, W350 Barrier
- W500 Reactor Frame

Metadata-only (do not auto-complete): Salvage Beacon / Rapid Aegis / Bastion (`minRank: null`), Nano Lathe (`advanced-foundry` pending), Ablative Mesh (PR10), Choir Tap (PR8), Swarm / Harvester (PR10).

## Physical fabrication

Uses `addCoreInstance(shipyard, moduleId)`. Completes on industrial time even during a Sortie. Does **not** change the fitted loadout. Duplicate Cores get distinct IDs (`heavy-lance:1`, `:2`). Duplicate cost ×**0.7** after the first copy.

Relic kind exists. `RELIC_FABRICATION_RECIPES = []`. PR6 populates it.

## Infrastructure

Exactly:

1. `processing-line` — Processing Line — +1 Processing slot (max 2)
2. `fabrication-bay` — Fabrication Bay — +1 Fabrication slot (max 2)
3. `worker-fabricator` — Worker Fabricator — enables Worker jobs (max 1)
4. `research-annex` — Research Annex — Research speed ×1.25 seed (PR9)
5. `recovery-storage` — Recovery Storage — Salvage-ops Scrap ×1.25 seed (not a storage cap)

Times: 8 / 10 / 12 / 15 / 8 minutes. Matter Worker Racks is **not** a Foundry facility.

## Workers

- Ownership: `base.workerDrones`. Capacity: `6 + Matter Racks + hiveResearch droneCapBonus`.
- Worker Racks: +1 capacity, does not fabricate.
- Worker Fabricator job: 8 Recovered Stock + 4 Conductive Filament + 20 Scrap / 90s.
- Assignments: `assigned ≤ owned`, not capacity. Idle is allowed.
- Contribution curve seed: full value through efficient, then ×0.35 through hard; speed +0.12 per contribution.
- Passive Scrap is industry (`grantGeneratedScrap`), not Extraction Sortie Scrap.
- Rebuild persists ownership and capacity; assignments still clear as PR3 operational state.

Workers surface with Foundry at **W50**. `~W110` is a progression seed, not a hard gate.

## Clocks

Foundry/Workers use real industrial time. Time Compression and Harvester do **not** accelerate Foundry. Offline catch-up uses the existing industry-only path and duration cap. One elapsed period is applied once.

## Rebuild

Preserve: materials, Material Mastery, fragments, discovery, jobs, infrastructure, Workers/capacity, physical Cores/Frames, Ash-derived materials.

Reset: Scrap, Ash, Core Levels, cycle Workshop, assignments.

## Extension points

- PR6: `kind: 'relic'` recipes empty
- PR7: family recovery provider (`swarm`/`armored` wired; Veil/Siege/Choir/Apex keys reserved; no ethereal/divine/titan remap)
- PR8: Choir Tap / Furnace sources metadata only; Ash consumed when recipes ask
- PR9: Research Annex, hiveResearch slot/cap bonuses, Process automation APIs; no Processing Repeat
- PR10: Challenge Blueprint sources metadata only
- PR11: every numeric seed in `src/game/foundrySeeds.ts` and fabrication tables

## Design gaps left explicit

- Exact M-level for Salvage Beacon, Rapid Aegis, Bastion, Nano Lathe
- Exact Crown Matrix deterministic inputs
- What grants `advanced-processing` / `advanced-foundry`
- Exact Processing ratios/times (seeds used)
- Assignments reset on Rebuild (not listed as persist in canonical)
