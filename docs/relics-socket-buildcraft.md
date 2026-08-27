# PR6 Relics and socket buildcraft — implementation note

This is an implementation map for Act 1 Relic buildcraft. It does **not** rewrite `docs/act1-canonical-design.md`. Numeric values below are **PR11-tunable seeds** unless the canonical design already named the mechanic.

Save version: **47**. No migration. Incompatible previous versions reset.

## Final 20 families

### Behavioural (14)

| ID | Name | Socket | Stage / source |
| --- | --- | --- | --- |
| `overcharge-capacitor` | Overcharge Capacitor | Power | early (source pending) |
| `prismatic-lens` | Prismatic Lens | Optical | mid · boss-route W550 seed (PR7) |
| `focusing-array` | Focusing Array | Optical | **Dead Reckoning** Challenge (PR10) |
| `phase-needle` | Phase Needle | Optical | advanced · boss-route W600 seed (PR7) |
| `fixed-mount` | Fixed Mount | Ballistic | advanced · boss-route W800 seed (PR7) |
| `shatter-mesh` | Shatter Mesh | Ballistic | **Pressure Front** Challenge (PR10) |
| `penetrator-guide` | Penetrator Guide | Ballistic | advanced · boss-route W650 seed (PR7) |
| `aegis-relay` | Aegis Relay | Shield | early · boss-route W400 seed (PR7) |
| `salvage-matrix` | Salvage Matrix | Industrial | mid · boss-route W700 seed (PR7) |
| `gravity-lens` | Gravity Lens | Optical | **Bare Hive** Challenge (PR10) |
| `nanite-reservoir` | Nanite Reservoir | Industrial | **Attrition** Challenge (PR10) |
| `shield-crossfeed` | Shield Crossfeed | Shield | late (source pending) |
| `predictive-bus` | Predictive Bus | Optical | **Silent Bridge** Challenge (PR10) |
| `resonance-tap` | Resonance Tap | Industrial | late · Furnace-facing source (PR8) |

### Standard (6)

| ID | Name | Socket | Stage / source |
| --- | --- | --- | --- |
| `power-coupler` | Power Coupler | Power | early (source pending) |
| `tracking-gimbal` | Tracking Gimbal | Optical | **Knife Fight** Challenge (PR10) |
| `ballistic-jacket` | Ballistic Jacket | Ballistic | mid (source pending) |
| `reinforcement-plate` | Reinforcement Plate | Shield | early (source pending) |
| `industrial-optimiser` | Industrial Optimiser | Industrial | advanced (source pending; does **not** multiply offline Foundry) |
| `universal-resonator` | Universal Resonator | Universal | late · boss-route W850 seed (PR7) |

Universal Resonator is a Relic family. It is **not** a Universal socket.

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

## Socket classes

`power` · `optical` · `ballistic` · `shield` · `industrial` · `universal`

A typed socket accepts a matching Relic class. A Universal **socket** accepts any class. Relics with class `universal` only fit Universal sockets.

## Mature layouts (authored metadata)

Weapons: Pulse `Power → Optical → Universal`; Heavy / Flak / Slag `Ballistic → Power → Universal`; Phase `Optical → Power → Universal`.

Defense: Plate `Shield → Shield/Universal`; Rapid Aegis `Shield → Universal`; Ablative `Shield → Industrial/Universal`; Barrier `Shield → Optical/Universal`.

Utility: Beacon `Industrial → Optical/Universal`; Grav `Optical → Industrial/Universal`; Nano `Industrial → Shield/Universal`; Sensor `Optical → Industrial/Universal`; Choir `Industrial → Power/Universal`.

Slash notation is mature typing metadata, not a global unlock schedule.

## Active sockets (PR4 Mastery)

- Relic system unlock (~W320): socket 0 of each physical Core (first mature type).
- M20 `socket-expand`: socket 1 using the authored expand class.
- Later positions (weapon 3rd Universal, any unauthored extra count) stay **pending**. Not invented at M50/M75/M100.

## Fitting

Docked only. Free. No destruction. One Behavioural Relic per **physical Core instance**. Duplicate Cores have independent fits. Live Sortie swaps are refused.

## Foundry

Tier I: discovered Relic Blueprint → `kind: 'relic'` job → one physical Tier I instance.

Tier II/III: Foundry job `upgrade:t{2|3}:{instanceId}` transforms that instance. Capability providers:

- `canUpgradeRelicToTier2` — Relic Tempering (PR9, dormant)
- `canUpgradeRelicToTier3` — Masterwork Tempering (PR9, dormant)

Legacy `hiveResearchTree` colour / Temper Line nodes do **not** open these gates.

## Fabrication seeds (PR11)

Standard and Behavioural use the same tables.

Tier I (90s, Universal 120s) by socket class:

- Power: 4 Conductive Filament + 2 Recovered Stock
- Optical: 4 Optical Glass + 2 Conductive Filament
- Ballistic: 4 Ballistic Composite + 2 Recovered Stock
- Shield: 4 Shield Lattice + 2 Tempered Alloy
- Industrial: 4 Control Mesh + 2 Recovered Stock
- Universal: 4 Control Mesh + 2 Resonant Ceramic

Tier II: 2.5× Tier I materials + 2 Phase Crystal, 180s.

Tier III: 2.5× Tier II materials + 2 Thermal Conductor, 300s.

Core duplicate-cost discount does not apply.

## Effects

All 20 family combat/economy effects are **pending**. Providers exist (`coreRelicModifiers`, behavioural handlers, Resonance Tap Furnace stub) and return identity / null. No leftover account-global shard bonuses.

## Challenge / later-system leftovers

PR10 owns Challenge Relic grants. PR7 owns Boss drop tables. PR8 owns Furnace Resonance Tap acquisition. PR9 owns Research Tempering and Process Relic automation. Legacy Process `auto-relic` / Research `unlockReliquary` colour nodes remain in those systems and are not wired into Relic gameplay.
