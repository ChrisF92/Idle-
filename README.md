# Cosmic Idle

Working title for a space idle game: fleet combat against alien / godlike entities, with industry, research, an AI Points network, prestige, and ITRTG-style challenges.

## Stack

- **Vite + React + TypeScript**
- **PWA** (`vite-plugin-pwa`) — installable on Android from a deployed HTTPS URL
- Local save (`localStorage`) + export/import codes
- Simulation core under `src/game/` (UI-free, unit-tested)

## Systems (tabs)

| Tab | Purpose |
|---|---|
| Combat | Sector push (5 waves/sector), Advance / Hold / Pause (refit) |
| Shipyard | Unlock/fit frames + modules (affects damage/hull); farmable modules appear after a blueprint fragment drop |
| Base | Worker-drone stations + Fabrication Bay (gated — clear sector 3; research Module Fabrication) |
| Research | Unlock tree + damage bonuses (gated — clear sector 5) |
| Codex | Soft counters (gated — research Tactical Codex **once**; permanent) |
| AI | Achievements → AI Points; permanent automation/QoL + per-run doctrines (unlocks with First Blood) |
| Prestige | Soft reset at sector 10+; Ascension + Ascension-entry challenges after Act 1 |
| Stats | Save management |

## Progression notes

- **Act 1** soft climax at sector **30** (6 boss milestones). Infinite push continues after.
- Whole systems unlock by career sector clears; tabs stay visible with requirements.
- Boss sectors: vanguard waves first, **boss only on wave 5**. Waves use varied packs.
- Header resources appear only once their system is unlocked (Data/Research, AI Points/AI, etc.).
- AI Points come from achievements (modal in the AI tab), not combat drops. Unspent AI Points persist across prestige.
- Research unlocks are **permanent** across prestige / ascension (Core attribute ranks still wipe).
- Guided onboarding spotlights the next control to tap; starter dock/launch tips retire after the first prestige, and ascension clears the full guide catalog.
- Act 1 pacing maps to ITRTG: first prestige ≈ first Hyperion (~1h session); first sector 30 ≈ first Baal (~1–2 week tutorial career across many prestiges). Research is permanent; enemy hull scales steeply while damage stays flatter so length comes from walls, not death loops.
- Dev tools (Stats tab): toggle on anytime, or append `?dev=1` / `?dev=0`. Includes jump, boss force, achievements, guide skip.
- Boss telegraphs: titan slams wind up before firing; phase shifts flash a warn ring.
- Hold Accountant shows estimated scrap/data/salvage per second while farming.
- Worker drones are manufactured permanently and assigned to named stations; assignments reset on prestige. Labor Router unlocks presets / Fill / Clear; Labor Loop + drone efficiency AI reduce babysitting.
- Prestige Matter / Challenge Points spend in permanent **rankable** shops (banked PM is +0.6% dmg/prod each; banked CP +1% dmg; ranks beat banking). No respec.
- CP shop prefers unique unlocks (schematics → Surge Capacitor / Mirror Plate, Deep Vault 24h offline, Clearance Board +5 max clears) plus stackable run-kits.
- Post-prestige re-push: returning kits scale with prestige/ascension count (USI-style); doctrine AIP is refunded; first S8 prestige yields 5 PM. Prestige/ascension momentum also grants soft damage & production.
- Distinct frames: Razor (2W/0D/1U glass-cannon) and Pathfinder (1W/0D/2U utility scout).
- **Blueprint farming:** enemies drop casing/core/lens parts; Fabrication Bay workers assemble discovered blueprints into permanent module unlocks. Dupes sell for scrap or invest into permanent module mastery (cap 10). Starter kit is Pulse Cannon (free) + Plate Layer (scrap); CP schematics remain shop-only.
- **Signal Cores:** typed Assault/Ward/Signal slots under Core; merge 3 identical ranks; wipe on prestige until **Null Signal** (sector 30, no cores equipped) unlocks permanent carryover.


## Develop

```bash
npm install
npm run dev
npm test
npm run build
npm run build:pages   # GitHub Pages base path (/Idle-/)
npm run preview
```

### Phone install (PWA)

1. Merge the PR stack to `main`, then in the repo: **Settings → Pages → Source: GitHub Actions**.
2. After `Deploy GitHub Pages` succeeds, open **https://chrisf92.github.io/Idle-/**
3. Android Chrome → **Install app** / **Add to Home screen**.
4. Saves are per-browser origin — use Stats → export/import between devices.

Local Pages-shaped build: `npm run build:pages && npm run preview`

## Notes

- Art is UI/text-first with simple SVG fleet shapes in Combat.
- Game logic should stay in `src/game/`; React is presentation + input.
- Solo project: use **one feature per branch/PR** so slices stay reviewable.
- Offline catch-up (up to 8h) runs on load: industry + sector-scaled rewards (no fight simulation).
- Combat is a multi-unit fleet duel (weapons/cooldowns/tags) with Advance/Hold pacing; hull persists and repairs over time. Combat tab shows fleet DPS/hull/shield/armor; module cards list Damage, RoF, Range.
- Entity families (Swarm/Armored/Ethereal/Divine) with module role counters; bosses every 5 sectors drop Essence.
- Fitted loadouts persist through prestige; challenges are repeatable with stack bonuses (ITRTG-style).
- Challenge pack: Silent Bridge, Glass Frame, Data Drought, Bare Rig, Knife Fight, **Mono Pulse**, **Attrition**, plus Ascension-entry runs (**Long Haul**, **Null Signal**, **Hollow Choir**) that start via Ascension at sector 30 rather than Prestige.
- Essence buys permanent constructs; AI Points buy per-run doctrines (Focus Fire, Boss Protocol, Scavenger, Tactical Retreat, Rapid Recovery).
- Challenge Points / Prestige Matter buy permanent shop ranks (or bank for a smaller bonus).
- Ascension: +40% future PM gains each; unlocks deep Matter ranks and Ascension-entry challenges.
