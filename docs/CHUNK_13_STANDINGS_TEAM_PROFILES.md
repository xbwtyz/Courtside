# Courtside 1.7 — Chunk 13: Standings and Team Profiles

**Branch:** `refactor/modular-1.7`. `main` untouched; no user-facing features added.

Three original fragments are extracted as build-time ES module factories: `src/features/standings/standings.js`, `src/features/team-profile/profile.js`, and `src/features/team-profile/handlers.js`. Each original is retained byte-for-byte in its `.legacy.js` counterpart; the compiled app remains one classic inline script, no runtime module imports.

The standings factory retains conference normalization/ranking, ESPN 10-minute cache, retries, audit, shared cooldown, app-wide navigation, and the shared `teamDirectory`, `standingsState`, and `profileState` objects. The team-profile factory retains on-demand 15-minute roster/schedule caches, schedule-score numeric parsing, dialog tabs/focus behavior and data logging. The team-profile handler factory registers the same delegated click, keyboard, modal-Escape and Tab focus trap handlers.

The app-level `mainView` remains one mutable binding, with lazy module getter/setter. Original named functions are hoisted wrappers (rather than non-hoisted const declarations) to preserve early callers from ESPN, scoreboard and Viewer. Callback references into later fragments are injected lazily to retain script order and mocking behavior.

## Required checks

Run `npm run check:syntax`, `npm test`, `npm run verify:baseline`, `npm run build`, `npm run test:browser`. New Node tests compare parsing, caches, schedule scores and markup with the frozen source. Browser comparison exercises Standings, team cards, roster/schedule, focus trapping, View in Courtside and no unintended iframe reloads.

Frozen 1.6.1 proof must be exactly 374,363 bytes (SHA256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`). Live ESPN / stream availability, Windows Firefox `file://` and the full manual regression checklist remain separate before any merge to `main`.

**Next:** Chunk 14 — Player Profiles, then League Leaders.
