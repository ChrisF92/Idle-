# Hiveworks UI Design Guide

**Authority for all Hiveworks UI.** Any future new screen or major UI change must follow this guide unless this document explicitly overrides it.

This is not a visual reskin. Keep the dark industrial sci-fi palette, orange accent, Chakra Petch display type, IBM Plex Mono for numbers and metadata, and the existing Hiveworks aesthetic. The problem this guide solves is **information architecture and screen composition**.

## Design principle

> SIMPLE AT FIRST GLANCE, DETAILED ON INTERACTION.

Hiveworks is a deep game. The UI must not prove that depth by displaying everything at once.

The player should experience:

> clean surface → tap → useful detail → tap again → advanced depth.

Not:

> dense wall of information from the moment a screen opens.

Treat whitespace as part of the interface. Treat sheets and modals as core navigation. Treat Inventory as the canonical view of what the player owns. Treat the Hive and combat as the visual identity.

**Default development mindset:** show the minimum required information, then reveal depth contextually. Do not stack every available statistic into bordered cards.

## Screen purposes

Every screen answers one question.

| Screen | Question |
| --- | --- |
| Sortie | Wave, Hull, Salvage, Scrap this run? |
| Dock | Best Wave, Loadout, Launch / Resume? |
| Loadout | What am I flying? |
| Workshop | Which starting upgrade should I buy? |
| Rebuild | Should I reset this cycle, and can I spend Matter? |
| Inventory | What do I own? |
| Systems | What is running, and where should Workers go? |
| Foundry | What is being produced and what should I build next? |
| More | Settings, help, reload, secondary tools |

Do not mix unrelated workflows into the same view. Do not add Inventory to the permanent bottom navigation.

## Mobile-first screen budget

Design first for portrait:

- 360–430 CSS px width
- modern Android / iPhone proportions
- browser / PWA safe areas
- **do not assume installed-PWA fullscreen height** — Chrome chrome reduces usable height

Validate at approximately:

- 360 × 800
- 390 × 844
- 412 × 915

Before implementing a screen, divide it into explicit vertical regions:

| Region | Target |
| --- | --- |
| Header / contextual status | ~8–12% |
| Primary content / visual focus | ~35–55% |
| Primary interaction area | remaining usable content |
| Persistent bottom navigation | fixed separately |

Never solve insufficient space by shrinking fonts and margins. If it does not fit comfortably: **move secondary content into a sheet or modal**.

On wider desktop / browser: centre the app (current max-width ~480px). Optionally use two columns where genuinely beneficial. Do not stretch cards across enormous widths. Keep the same information hierarchy.

## Progressive disclosure

| Level | When | Examples |
| --- | --- | --- |
| 1 — Glance | Always visible | Pulse Core, M17, 18.4K DPS |
| 2 — Decision | Tap opens a sheet | Damage, Cycle, Range, Relics, every Mastery milestone |
| 3 — Advanced | Expandable inside a sheet | Formulas, contribution breakdown, lifetime stats |

Never place Level 3 information on the default screen.

## Cards are summaries

Default cards contain approximately:

- title
- one state / value
- one meaningful secondary value
- optional status / progress
- optional contextual action

Do **not** put full descriptions, formulas, several paragraphs, all statistics, or every possible action inside the default card. Tap opens a detail sheet.

## One dominant CTA

A screen should normally have one visually dominant action (Launch Sortie, Rebuild, Fabricate, Start Challenge). Secondary actions must not visually compete with it.

## Sheets vs modals

Prefer **bottom sheets** for portrait contextual work:

- Core / Frame / Relic details and pickers
- upgrade details
- Worker allocation
- Material / Blueprint details
- Directive inspection
- run statistics
- quick settings

Sheet sizes (CSS tokens):

| Size | Height | Use |
| --- | --- | --- |
| Compact | 30–40% | Quick info / actions |
| Standard | 55–70% | Most item details |
| Full | 85–95% | Complex selection / Inventory / rule editing |

Sheets must have an obvious close gesture / button, preserve screen context, scroll internally, and must not jump the underlying page.

Use **centred blocking modals** only when the action must interrupt:

- destructive confirmation
- Directive choice
- first-time onboarding that requires an action
- Rebuild / Reinforce confirmation
- important unlock

Do not use blocking modals for ordinary inspection.

## Overlay priority

Only **one** blocking overlay displays at once.

1. Critical app / update warning
2. Destructive confirmation
3. Major unlock
4. Onboarding
5. Ordinary modal / sheet
6. Toast (non-blocking)

If an update / reload dialog is active, onboarding waits. Never stack blocking dialogs.

Browser / Android **Back**:

1. Close the top sheet or modal
2. Only then change primary navigation

Do not trap the player.

## Spacing

Use tokens, not random margins.

| Token | Size | Use |
| --- | --- | --- |
| `--space-1` | 4px | Hairline |
| `--space-2` | 8px | Tight related |
| `--space-3` | 12px | Internal card |
| `--space-4` | 16px | Related groups |
| `--space-5` | 24px | Between cards |
| `--space-6` | 32px | Major sections |

Distinguish:

- **Internal card spacing** — small (`--space-2` / `--space-3`)
- **Between related cards** — medium (`--space-4` / `--space-5`)
- **Between major screen sections** — large (`--space-6`)

Increase whitespace between conceptual groups. Empty space is acceptable. A calm screen is better than a crowded one.

## Borders and elevation

Too many outlined rectangles make every element look equally important.

Use spacing, typography, background elevation, subtle separators, accent rails, and progress lines.

Reserve **strong outlined borders** for:

- selected elements
- important interactive controls
- warnings
- the major CTA
- focused state

Do not surround every text group with a rectangle.

## Typography

Semantic classes (see `src/ui/tokens.css` and `src/ui/primitives.tsx`):

| Style | Role |
| --- | --- |
| Screen title | Largest / brand (Chakra Petch) |
| Section heading | Prominent but smaller |
| Primary value | High contrast |
| Body | Readable (not all-caps mono paragraphs) |
| Metadata | Smaller muted |
| Kicker | Small uppercase |

Keep IBM Plex Mono for numbers, technical metadata, and system labels. Use display / body type for readable prose and large headings. Do not introduce external fonts for UI work. Do not use uppercase monospaced metadata for almost everything.

Prefer:

```
Best Wave
W13
```

over `BEST WAVE W13` as a single shout.

## Sticky CTA

A sticky action footer lives **above** bottom navigation and owns reserved layout space.

Content scrolling area bottom padding =

`sticky CTA height + navigation height + safe-area inset`.

Nothing may hide behind the CTA, the nav, the browser safe area, or the keyboard.

## Header and navigation

Bottom nav (fixed, not in the scroll):

- DOCK
- SYSTEMS when unlocked
- MORE

Do **not** put Sortie on the bottom bar. Launch Sortie from Dock is the way in. While a Sortie is live, Dock’s sticky CTA becomes **Return to Sortie**.

Locked destinations stay hidden according to progression.

Header is compact. Do not repeat every resource on every screen.

- **Dock:** Hiveworks + ⓘ + Wallet icon. No currency chips in the header.
- **Wallet:** icon opens a modal of all owned/visible currencies. Individual currencies only appear on the screens that spend them (Scrap on Workshop, Matter on Rebuild).
- **Sortie:** own HUD only while a run is live. No Wallet. No generic header.
- **Systems:** contextual header
- **More:** no game currencies required

Dock home is the post-Sortie landing. Loadout, Workshop, and Rebuild are their own screens, opened from full-width buttons on Dock.

### Dock mobile column

```
Header     Hiveworks  ⓘ                         [Wallet]
Dock       Best Wave
           Loadout ›
           Workshop ›
           Rebuild ›   (Inactive until available)
CTA        Launch Sortie  (or Return to Sortie)
Nav        Dock | Systems | More
```

Loadout screen: back to Dock, Inventory button, Frame + Cores. Relics live in the Core sheet and Inventory. Prep stays visible but locked during a live Sortie.

Workshop screen: back to Dock, Scrap, Attack / Defense / Economy, two-up cards. Buy ×1 / ×10 / MAX only after those modes unlock.

Rebuild screen: back to Dock, Matter, Best Wave, Cycle, projected Matter, Preview Rebuild (inactive until available). Matter upgrades stay spendable when the player has Matter.

Rules:

- Do not put Sortie on the bottom bar. Launch / Resume from Dock is the way in.
- Inventory is a Loadout-page button.
- Do not show the Hive preview on Dock for now.
- The expanded Core sheet lists **every** mastery milestone and highlights unlocked ranks plus the next one.

### Sortie live HUD

Sortie exists only while a run is live. Dock launches. After the report, land on Dock home.

```
Boss bars   (only on boss waves, top of screen)
HUD         Salvage / Scrap this run (tap for /s)   Wave · DPS · time   ☰
Canvas      combat
Status      Shield · Hull     speed (only after extra speeds unlock)
Shop        Upgrades  → expands to ~80% with Attack / Defense / Economy / Cores
```

Extract lives in the hamburger stub. Directives stay a centered full-screen pick; the Directives chip stays hidden until Wave 50.

## Onboarding

Onboarding teaches. After a system is learned, remove instructional paragraphs from primary screens. Provide ⓘ / ? for contextual help.

Do not use large rectangular tutorial panels floating over controls. Prefer:

- dimmed background
- highlighted target
- compact anchored callout
- standard bottom tutorial sheet for longer text

## Inventory

Inventory is a **reference and item-management** screen: *what permanent items and resources do I own?*

Access: Dock Inventory control, More → Inventory, contextual “View in Inventory”. **Not** a bottom-nav destination.

Categories:

- EQUIPMENT — unlocked Frames + owned Core copies
- RELICS — collection with socket-class filters
- MATERIALS — Foundry ledger

Do **not** list Blueprints as an Inventory category. Blueprint progression belongs in Foundry. Consumables may appear later.

### Core copies

Duplicate Cores are allowed. Communicate:

- Owned ×N
- Equipped ×M
- Available ×(N−M)
- Shared Mastery for the Core type

### Relic copies vs Core copies

**Relics are stored by Core type, not by Core instance.** `reliquary.coreFits[moduleId]` is one socket set per module id. Extra copies of Pulse Cannon share the same Relic loadout. Inventory must not pretend copies have separately configured Relics unless the save model changes.

Owned / equipped / free Relic counts must account for copies fitted across Cores so the player understands why a Relic cannot be equipped.

### Materials

One central ledger. Group by family when useful (Industrial, Recovered). Do not put every material in the global header. Tap a material for stock, Foundry Mastery, sources, consuming / producing recipes, and an Open Foundry link.

### Contextual links

- Dock Core picker and Relic socket picker source from Inventory counts
- Foundry fabrication complete → View in Inventory
- Blueprint complete → View project (Foundry), not Inventory
- Material detail → Open Foundry

## Foundry

If a Processing / Fabrication / Mastery / Blueprint redesign is not yet on the working branch, do not merge that redesign into a UI-architecture PR. Keep Inventory integration ready (material ledger, View in Inventory, primitives).

## Systems / Workers

Keep the Systems dashboard architecture. Worker Drones stay at the top. System cards use the spacing / elevation rules (fewer competing borders).

Worker allocation must show **why** a player would move a drone: current multiplier or job time consequence, not only a generic count row.

## Combat presentation

Do not change combat balance in a UI pass.

- Projectile origins use real Core position
- Weapon Cores have an outward firing arc
- If a target would cause a shot through the Hive, the Core repositions on its orbit
- Do not teleport projectile origins or materially reduce DPS
- No projectile / beam should visibly pass through the central Hive

VFX should distinguish Core families (muzzle, projectile / beam, impact, cadence), shield states, enemy death scale, New Best, Mastery pulse, and Rebuild. Respect `prefers-reduced-motion`.

UI transitions: 100–250ms. Sheets slide. Tabs use a small indicator. Cards get subtle press feedback. Avoid long page transitions and animating every element on render.

## Accessibility

Maintain semantic labels, keyboard navigation, focus-visible, reduced motion, contrast, and ~44px touch targets.

Do **not** solve accessibility with duplicate **visible** controls that clutter the interface. Use visually hidden accessible alternatives when the visual Hive or other custom control is the primary interaction.

## CSS architecture

Design tokens live in `src/ui/tokens.css`. Reusable primitives live in `src/ui/primitives.tsx`.

Tokens cover at least: spacing, radii, elevation, section gaps, card padding, sheet sizes, sticky footer heights, typography scale.

Avoid one-off magic values. Remove obsolete styling for layouts that no longer exist.

## Quality gate

Before considering a screen complete:

1. What is the primary purpose of this screen?
2. What is the most important thing the player should see within one second?
3. What is the most common action?
4. Is anything visible that is only needed occasionally? → sheet
5. Is information repeated? → remove it
6. Are more than two major bordered containers competing? → simplify
7. Does the screen fit comfortably at 360px width with browser chrome?
8. Does a sticky control obscure scrollable content?
9. Is there enough spacing to parse sections?
10. Can detailed information still be reached within one or two taps?

If any answer is poor, the screen is not finished.

## Primitives

Future Cursor tasks should use these (names may evolve; the contract must not):

| Primitive | Role |
| --- | --- |
| `Screen` | Scroll region + reserved sticky / nav padding |
| `ScreenHeader` | Compact title + optional actions |
| `ContextBar` | Glance stats (Best Wave, Cycle) |
| `Section` / `SectionHeader` | Major groups with `--space-6` gaps |
| `SummaryCard` | Title + 1–2 values |
| `StatPair` | Label over value |
| `ProgressCard` | Title + bar + secondary |
| `TabBar` | In-screen panes (not bottom nav) |
| `BottomSheet` / `FullSheet` | Contextual detail |
| `ConfirmModal` | Blocking interrupt |
| `StickyAction` | Reserved dominant CTA |
| `ItemRow` / `ItemGrid` | Inventory / loadout lists |
| `EmptyState` | Calm empty |
| `Badge` | Compact status |
| `InfoButton` | Contextual help, not permanent prose |

## Related documents

- `Hiveworks_Game_Design_Document_v1.0.md` — gameplay authority
- `docs/release-implementation-plan.md` — shipping checklist; references this guide
- `src/ui/tokens.css` — CSS tokens
- `src/ui/primitives.tsx` — implementation
- `src/game/inventory.ts` — owned-item model
