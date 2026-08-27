# PR6 Relics and socket buildcraft — implementation note

This is an implementation map for Act 1 Relic buildcraft. It does **not** rewrite `docs/act1-canonical-design.md`. Numeric values below are **PR11-tunable seeds** unless the canonical design already named the mechanic.

Save version: **47**. No migration. Incompatible previous versions reset.

## Final 20 families

Canonical authors identity and Standard vs Behavioural. It does **not** assign a socket class to each family. Production data therefore stores:

```ts
socket: RelicSocketClass | null
socketStatus: 'authored' | 'pending'
fabricationStatus: 'ready' | 'pending-design'
```

Every production family is currently `socket: null`, `socketStatus: 'pending'`, `fabricationStatus: 'pending-design'`. UI copy is `Socket class pending design`. Fitting rejects with that pending-design reason. Do not infer class from the family name.

### Behavioural (14)

| ID | Name | Socket | Stage / source |
| --- | --- | --- | --- |
| `overcharge-capacitor` | Overcharge Capacitor | pending | early (source pending) |
| `prismatic-lens` | Prismatic Lens | pending | mid · boss-route W550 seed (PR7) |
| `focusing-array` | Focusing Array | pending | **Dead Reckoning** Challenge (PR10) |
| `phase-needle` | Phase Needle | pending | advanced · boss-route W600 seed (PR7) |
| `fixed-mount` | Fixed Mount | pending | advanced · boss-route W800 seed (PR7) |
| `shatter-mesh` | Shatter Mesh | pending | **Pressure Front** Challenge (PR10) |
| `penetrator-guide` | Penetrator Guide | pending | advanced · boss-route W650 seed (PR7) |
| `aegis-relay` | Aegis Relay | pending | early · boss-route W400 seed (PR7) |
| `salvage-matrix` | Salvage Matrix | pending | mid · boss-route W700 seed (PR7) |
| `gravity-lens` | Gravity Lens | pending | **Bare Hive** Challenge (PR10) |
| `nanite-reservoir` | Nanite Reservoir | pending | **Attrition** Challenge (PR10) |
| `shield-crossfeed` | Shield Crossfeed | pending | late (source pending) |
| `predictive-bus` | Predictive Bus | pending | **Silent Bridge** Challenge (PR10) |
| `resonance-tap` | Resonance Tap | pending | late · Furnace-facing source (PR8) |

### Standard (6)

| ID | Name | Socket | Stage / source |
| --- | --- | --- | --- |
| `power-coupler` | Power Coupler | pending | early (source pending) |
| `tracking-gimbal` | Tracking Gimbal | pending | **Knife Fight** Challenge (PR10) |
| `ballistic-jacket` | Ballistic Jacket | pending | mid (source pending) |
| `reinforcement-plate` | Reinforcement Plate | pending | early (source pending) |
| `industrial-optimiser` | Industrial Optimiser | pending | advanced (source pending; does **not** multiply offline Foundry) |
| `universal-resonator` | Universal Resonator | pending | late · boss-route W850 seed (PR7) |

Universal Resonator is a Relic family. It is **not** a Universal socket. Its socket class is unauthored like every other family.

## Physical inventory

```ts
interface RelicInstance { id: string; familyId: RelicFamilyId; tier: 1 | 2 | 3 }
interface RelicState {
  instances: RelicInstance[]
  nextSerial: Partial<Record<string, number>>
  coreFits: Record<CoreInstanceId, Array<RelicInstanceId | null>>
}
```

IDs are `{familyId}:{serial}` (`power-coupler:1`). Counts are derived from instances. Tier is per physical item. Upgrades transform the same ID.

## Socket classes (generic engine)

`power` · `optical` · `ballistic` · `shield` · `industrial` · `universal`

A typed socket accepts a matching Relic class. A Universal **socket** accepts any class. Relics with class `universal` only fit Universal sockets.

This engine is tested with non-production fixture descriptors. Production families do not claim a class until one is authored.

## Mature layouts (authored metadata)

Weapons: Pulse `Power → Optical → Universal`; Heavy / Flak / Slag `Ballistic → Power → Universal`; Phase `Optical → Power → Universal`.

Defense: Plate `Shield → Shield/Universal`; Rapid Aegis `Shield → Universal`; Ablative `Shield → Industrial/Universal`; Barrier `Shield → Optical/Universal`.

Utility: Beacon `Industrial → Optical/Universal`; Grav `Optical → Industrial/Universal`; Nano `Industrial → Shield/Universal`; Sensor `Optical → Industrial/Universal`; Choir `Industrial → Power/Universal`.

Slash notation is mature typing / evolution metadata. `/Universal` is **not** automatically active because an earlier typed socket is active.

## Socket activation (A / B / C)

Separated on purpose:

- **A. Mature socket metadata** — the layouts above. Always shown (`Mature layout: Power → Optical → Universal`).
- **B. Authored activation metadata** — provider hook. Production default is empty. PR4 M20 `socket-expand` records remain in Core Mastery as expansion metadata; they do not imply a universal count sequence.
- **C. Runtime active sockets** — only indexes supplied by B.

Production does **not** invent `W320 = first socket` or `M20 = second socket`. Unauthored sockets stay pending (`Activation milestone pending design`). M50 / M75 / M100 do not auto-unlock later Universal positions.

Tests may inject authored activation to drive the generic fitting engine.

## Fitting

Docked only. Free. No destruction. One Behavioural Relic per **physical Core instance**. Duplicate Cores have independent fits. Live Sortie swaps are refused.

A family with pending socket class cannot be fitted. A Core socket that is not authored-active cannot be fitted.

## Foundry

Production Fabrication requires `fabricationStatus: 'ready'`, which itself requires authored identity, Standard/Behavioural class, socket compatibility, and Tier-I effect semantics. All 20 families are currently `pending-design`. Blueprint/source metadata may exist; physical framework may exist; production Fabrication stays unavailable (`Design details pending`).

Generic Foundry `kind: 'relic'` remains implemented. Fully-authored fixture descriptors prove the engine can fabricate a Relic without contaminating the production catalogue.

Tier II/III: Foundry job `upgrade:t{2|3}:{instanceId}` transforms that instance. The instance ID encoded in the job ID is authoritative. If `targetRelicId` is present it **must** equal that instance ID; otherwise the slot sanitizes to idle and nothing transforms. Capability providers:

- `canUpgradeRelicToTier2` — Relic Tempering (PR9, dormant)
- `canUpgradeRelicToTier3` — Masterwork Tempering (PR9, dormant)

Legacy `hiveResearchTree` colour / Temper Line nodes do **not** open these gates.

## Fabrication seeds (PR11)

Standard and Behavioural use the same tables.

**Generic Tier I templates by socket class** (not bound to any production family while sockets are pending):

- Power: 4 Conductive Filament + 2 Recovered Stock, 90s
- Optical: 4 Optical Glass + 2 Conductive Filament, 90s
- Ballistic: 4 Ballistic Composite + 2 Recovered Stock, 90s
- Shield: 4 Shield Lattice + 2 Tempered Alloy, 90s
- Industrial: 4 Control Mesh + 2 Recovered Stock, 90s
- Universal: 4 Control Mesh + 2 Resonant Ceramic, 120s

**Untyped T2/T3 infrastructure base** (`GENERIC_UPGRADE_T1_BASE`, used while a family's socket is unauthored; not that family's authored T1 recipe):

- 4 Conductive Filament + 2 Recovered Stock, 90s

Tier II: 2.5× base materials + 2 Phase Crystal, 180s.

Tier III: 2.5× Tier II materials + 2 Thermal Conductor, 300s.

Core duplicate-cost discount does not apply.

## Effects

All 20 family combat/economy effects are **pending**. Providers exist (`coreRelicModifiers`, behavioural handlers, Resonance Tap Furnace stub) and return identity / null. No leftover account-global shard bonuses.

## Process / PR9 boundary

PR9 owns Relic automation. PR6 does not auto-fit, auto-upgrade, or auto-seat Relics. There is no `autoSeatShards` hook. Physical Relic ownership does not satisfy leftover Process Reliquary mastery. Legacy `auto-relic` / keep / quality / merge nodes remain in Process data and are not wired into Relic gameplay.

## Challenge / later-system leftovers

PR10 owns Challenge Relic grants. PR7 owns Boss drop tables. PR8 owns Furnace Resonance Tap acquisition. PR9 owns Research Tempering and Process Relic automation. Legacy Research `unlockReliquary` colour nodes remain in those systems and are not wired into Relic gameplay.
