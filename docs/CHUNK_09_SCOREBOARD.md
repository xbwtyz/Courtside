# Courtside 1.7 — Chunk 09: Scoreboard Presentation

**Working branch:** `refactor/modular-1.7`. Never modify `main` or add user-facing functionality in this migration.

## Build-time extractions

- `src/features/scoreboard/render.js` → `render.module.mjs`: preserves the original 10 rendering functions, `formatStart`, the WeakMap HTML cache, HTML escaping, ESPN logo fallback, score filtering, game-card focus preservation, expanded details, and keyed DOM reconciliation.
- `src/features/scoreboard/card-controls.js` → `card-controls.module.mjs`: preserves delegated card Watch/Expand/Enter/Space handlers and ignores nested links/buttons.
- `src/features/scoreboard/navigation.js` → `navigation.module.mjs`: preserves date controls, Home, search, Live-only toggle, and manual refresh.

All three original fragments remain byte-identical in `.legacy.js` backups. The build uses esbuild IIFEs at their **original exact classic-script locations**; only the single self-contained HTML is distributed. Classic function names remain in the app-level script and are rebound only by the existing original call sites. Input/Settings state and external callbacks are resolved lazily so subsequent changes remain visible.

**Not in scope:** `src/features/scoreboard/data.js`, which already contains the separate ESPN request-scheduler integration and rate-limit guards. This refactor does not alter API endpoints, polling frequency, ESPN cooldown handling, game-store decisions, stream selection, the ticker, or iframe lifecycle.

## Required checks

Run `npm run check:syntax`, `npm test`, `npm run verify:baseline`, `npm run build`, and `npm run test:browser`. New regression checks compare old/new card markup, DOM node stability after score updates, expanded quarters, team filtering, Live-only, date navigation, Watch clicks, keyboard control, and uninterrupted Viewer iframe sources. All outbound requests are blocked. The original 1.6.1 output must remain **374,363 bytes** with SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.

**Release gate:** Real ESPN and third-party providers, Windows Firefox `file://`, and full manual 104-case regression checklist need separate validation before `main` is updated.

**Next:** Chunk 10 — inspect Scoreboard data and ESPN scheduling boundary before migrating any network-sensitive fragment.
