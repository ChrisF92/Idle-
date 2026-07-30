# Cosmic Idle

Working title for a space idle game: fleet combat against alien / godlike entities, with industry, research, an AI Points network, prestige, and ITRTG-style challenges.

## Stack

- **Vite + React + TypeScript**
- Local save (`localStorage`) + export/import codes
- Simulation core under `src/game/` (UI-free, unit-tested)
- PWA / Capacitor Android wrap planned later

## Systems (skeleton tabs)

| Tab | Purpose |
|---|---|
| Combat | Sector push, tick combat, entity enemies |
| Shipyard | Frames + modules |
| Base | Idle industry |
| Research | Unlock tree |
| AI | AI Points / automation doctrines |
| Prestige | Soft reset + challenges |
| Stats | Save management |

## Develop

```bash
npm install
npm run dev
npm test
npm run build
```

## Notes

- Art is UI/text-first by design.
- Game logic should stay in `src/game/`; React is presentation + input.
- Solo project: still use branches/PRs so agents can iterate cleanly.
