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
| Combat | Sector push, tick combat, entity enemies |
| Shipyard | Unlock/fit frames + modules (affects damage/hull) |
| Base | Idle industry upgrades |
| Research | Unlock tree + damage bonuses |
| AI | AI Points / Auto Engage |
| Prestige | Soft reset at sector 8+ + challenge runs |
| Stats | Save management |

## Develop

```bash
npm install
npm run dev
npm test
npm run build
npm run preview   # serves production build (PWA SW active)
```

### Phone install (PWA)

1. Deploy the `dist/` folder to any static HTTPS host (GitHub Pages, Cloudflare Pages, Netlify, etc.).
2. Open the URL in Android Chrome → browser menu → **Install app** / **Add to Home screen**.
3. Saves are per-origin/browser — use Stats → export/import to move between devices.

If hosting under a subpath (e.g. `https://user.github.io/Idle-/`), set Vite `base` to that path before building.

## Notes

- Art is UI/text-first by design.
- Game logic should stay in `src/game/`; React is presentation + input.
- Solo project: use **one feature per branch/PR** so slices stay reviewable.
- Offline catch-up (up to 8h) runs on load; Auto Engage continues combat while away.
- Combat uses entity families (Swarm/Armored/Ethereal/Divine) with module role counters; bosses every 5 sectors drop Essence.
- Essence buys permanent constructs; AI Points buy per-run doctrines (Focus Fire, Boss Protocol, Scavenger, Tactical Retreat).
- Challenge Points can be spent in a permanent shop (or kept banked for a small damage bonus).
