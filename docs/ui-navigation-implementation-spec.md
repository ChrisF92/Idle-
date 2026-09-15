# Hiveworks UI & Navigation Implementation Specification

**Status:** Approved implementation contract  
**Revision:** 1.1 — 2026-09-14  
**Scope:** Act 1 navigation, fresh-save screens, progressive systems, and interaction rules

This ledger records the approved UI decisions for implementation. It supersedes older UI or onboarding language where it conflicts with this document. The Act 1 canonical design remains authoritative for mechanics, cadence, formulas, and content.

## 1. Navigation constitution

- Top-level navigation is **Dock | Systems | More**.
- A fresh account shows **Dock | More**. Systems appears when Foundry unlocks at Wave 50.
- Sortie is a focused mode entered from Dock; it is never a bottom-navigation tab.
- Locked destinations are hidden rather than displayed as disabled cards.
- Switching bottom destinations does not create back history.
- A child screen returns to its owning hub. A sheet closes to the exact screen beneath it.
- Android/browser Back closes the top overlay first, then a child screen, then follows normal app-exit behavior from a hub.
- No nested overlays. Decisions and inspections may use sheets; repeat workflows use full screens.
- Each resource has one primary home. Pinned resource UI is contextual rather than an all-currency strip.
- A live Sortie may be browsed only after explicit suspension. Browsing never advances combat.

## 2. Fresh-save surface

A new career begins at Dock with the starter Frame and Pulse/Plate Cores fitted. It does not auto-launch Wave 1.

### Fresh Dock

Purpose: answer “What am I taking into battle, and how do I begin?” immediately.

- Header: Hiveworks identity and Help.
- Wallet is absent until a persistent resource has been discovered.
- Status: **Best Wave W0**.
- Compact animated Hive preview. Tapping it opens Loadout.
- Explicit Loadout row: **Standard Frame · 2/2 Cores · Ready**.
- Sticky primary action: **Launch Sortie**.
- Launch is immediate and manual.
- Initial bottom navigation: **Dock | More**.
- Workshop, Rebuild, Foundry, Matter, and locked-feature cards are absent.
- During a suspended live run the Dock action becomes **Return to Sortie**.
- The Hive preview and Loadout row are equivalent entry points.

### Loadout

- Full Dock child screen with **Dock** Back and **Inventory** action.
- Shows Frame and physical Core slots.
- Docked changes apply immediately.
- During a live suspended Sortie it is read-only.
- Loadout does not contain a Launch action.
- Inventory is entered from Loadout or More, never from bottom navigation.

### Fresh More

Fresh entries, in order:

1. Inventory
2. Help & Guides
3. Settings
4. Save Data
5. About

Career Statistics appears after the first completed Sortie. Codex and Challenges appear only when unlocked. Save Data is separate from Settings. Developer tools and the balance simulator are absent from normal production UI.

## 3. Sortie

- Sortie hides global bottom navigation and app chrome.
- Main HUD shows Wave, Salvage, Scrap, Shield, Hull, Menu, and Upgrades.
- DPS, elapsed time, and hostile detail belong in a Run Details sheet, not the primary HUD.
- Upgrades open in a 60–70% height drawer with Attack, Defence, and Economy tabs.
- Cores do not appear in the Sortie upgrade drawer.
- The first Salvage tutorial pauses play and requires a Weapon Power purchase.
- Leave Sortie offers **Suspend Sortie**, later **Withdraw**, and **Keep Fighting**.
- Suspension pauses the simulation. There is no offline combat progress.

## 4. First defeat and Workshop loop

- The first report is full-screen.
- It shows Wave reached, new-best treatment, Scrap earned, and a clear note that Salvage was lost.
- Additional run detail is expandable.
- The only primary action is **Return to Dock**.
- Workshop receives attention after the report, but the player opens it manually.
- The first guided purchase is Weapon Power, Lv0 → Lv1, ×1 → ×1.08.
- Purchasing the first row unlocks the next row.
- Bulk controls remain hidden until Process enables them.
- The player manually relaunches from Dock.

## 5. Dock progression

- Workshop appears after the first defeat.
- Rebuild appears only when its system is relevant.
- Dock remains the home for Loadout, Workshop, Rebuild, Frames, Relics, and sortie launch/return.
- Workshop is a full Dock child with Scrap pinned, Attack/Defence/Economy tabs, and a two-column upgrade layout.
- Whole upgrade cards are purchase targets.

## 6. Systems progression

- Systems appears at Wave 50 with Foundry as its first and only card.
- Worker Drones appears at Wave 110; it is not teased before unlock.
- Later Foundry-adjacent systems join the same hub at their canonical doors.
- Systems cards report useful current status and attention without exposing locked systems.

### Foundry

Foundry is a Systems child with four stable panes:

- Processing
- Fabrication
- Mastery
- Blueprints

Physical Core identity, copies, fitted state, mastery, fabrication jobs, recipes, and blueprint flows must remain consistent across Foundry, Inventory, and Loadout.

## 7. More progression

- More is one destination list, not separate Stations and Settings tabs.
- Codex unlocks at Wave 30 and shows discovered entries only.
- Codex sections are Hostiles and Bosses; details open as sheets.
- Challenges, Career Statistics, and other utility destinations appear only when useful.
- Industrial systems never migrate into More.

## 8. Reports, overlays, and attention

- Reports are full-screen transitions when they close a gameplay loop.
- Inspection uses a sheet; confirmation uses one modal layer.
- Opening a sheet preserves its parent screen and scroll context.
- Attention signals identify newly useful actions and clear predictably after the relevant view or action.
- Onboarding overlays may pause play but must not create navigation destinations.

## 9. Later Act 1 screens already approved

The following approved systems retain their canonical wave/research gates and must conform to the navigation constitution:

- Slot expansions at Waves 75, 300, 420, and 600
- Worker Drones at Wave 110
- Directives
- Withdrawal
- Rebuild and Matter
- Frames
- Relics and Relic tier upgrades
- Challenges
- Furnace
- Research
- Process
- Combat Overlay
- Advanced Analysis
- Choir Crown
- Act 1 completion report

## 10. Fire-Control Targeting correction

Fire-Control Doctrine uses canonical per-Core doctrines, never generic closest/fastest targeting.

| Core | Default | Allowed doctrines |
|---|---|---|
| Pulse | Threat | Threat, Focus, Execution, Shield |
| Heavy | Heavy | Heavy, Focus, Shield, Threat |
| Flak | Cluster | Cluster, Threat, Execution |
| Beam | Focus | Focus, Heavy, Shield |
| Slag | Cluster | Cluster, Heavy, Threat |
| Grav | Threat | Threat, Heavy, Cluster |
| Salvage Beacon | Execution | Execution, Heavy |

- Configuration is per physical Core after D1 Research.
- It may be changed while Docked or during an explicitly paused live Sortie.
- Opening the targeting sheet pauses the Sortie.
- Challenges may block configuration.
- Process may load a doctrine once but may not dynamically flip it during combat.

## 11. Implementation slices

1. ✅ Fresh Dock and navigation foundation.
2. ✅ More single-list conversion and utility child screens.
3. ✅ Loadout and Inventory workflow polish.
4. ✅ Sortie HUD, upgrade drawer, pause/browse, and Leave Sortie.
5. ✅ Report and first-Workshop loop.
6. Progressive Systems and later-system screen passes.
7. Accessibility, Back behavior, responsive polish, and end-to-end navigation tests.

Each slice must update focused tests and this ledger when behavior changes.
