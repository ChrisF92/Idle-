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
| Combat | Sector push (5 waves/sector), Advance / Hold / Dock |
| Shipyard | Unlock/fit frames + modules (affects damage/hull) |
| Base | Worker-drone stations (gated — clear sector 3) |
| Research | Unlock tree + damage bonuses (gated — clear sector 5) |
| Codex | Soft counters (gated — research Tactical Codex) |
| AI | Permanent automation/QoL + per-run doctrines (gated — clear sector 8) |
| Prestige | Soft reset at sector 8+ + challenge runs (tab from sector 5) |
| Stats | Save management |

## Progression notes

- **Act 1** soft climax at sector **30** (6 boss milestones). Infinite push continues after.
- Whole systems unlock by career sector clears; tabs stay visible with requirements.
- Worker drones are manufactured permanently and assigned to named stations; assignments reset on prestige.
- Combat drones are a separate gated pool (assignment later).
- Prestige Matter / Challenge Points spend in permanent shops (or bank for a smaller bonus).


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
- Combat is a multi-unit fleet duel (weapons/cooldowns/tags) with Advance/Hold pacing; hull persists and repairs over time.
- Entity families (Swarm/Armored/Ethereal/Divine) with module role counters; bosses every 5 sectors drop Essence.
- Fitted loadouts persist through prestige; challenges are repeatable with stack bonuses (ITRTG-style).
- Essence buys permanent constructs; AI Points buy per-run doctrines (Focus Fire, Boss Protocol, Scavenger, Tactical Retreat, Rapid Recovery).
- Challenge Points / Prestige Matter can be spent in permanent shops (or banked for a smaller bonus).
