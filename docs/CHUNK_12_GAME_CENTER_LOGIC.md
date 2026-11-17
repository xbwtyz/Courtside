# Courtside 1.7 — Chunk 12: Game Center Logic

**Development branch:** `refactor/modular-1.7`; do not touch `main`.

### Build-time module extractions

- `src/api/espn/game-summary.js` → `game-summary.module.mjs`: cached ESPN game-summary requests, request deduplication, 9-second timeout, error/backoff, shared ESPN cooldown, and one final snapshot policy preserved unchanged.
- `src/features/game-center/controller.js` → `controller.module.mjs`: Game Center sidebar refresh, cached display, stale response tokens, tab changes, score lookup, and rate-limit behavior preserved.
- `src/features/game-center/handlers.js` → `handlers.module.mjs`: tab navigation, box-score team sorting and width, chart inputs, shot/pointer handlers, keyboard navigation and resize handling preserved.

The three originals are copied byte-for-byte to `.legacy.js`, keeping frozen 1.6.1 reconstruction independent of new module factories. All three modules are compiled as IIFEs back into **exactly their original classic-script positions**, leaving the production build as one standalone HTML file with no runtime module imports.

External behavior is resolved via late-bound classic-script function wrappers. The chart resize observer retains its original two mutable variables in one shared classic scope; it does not create a second observer or animation loop.

### Verification

Run `npm run check:syntax`, `npm test`, `npm run verify:baseline`, `npm run build`, and `npm run test:browser`. Compare old/new ESPN request priority, dedup, caching, timeout and backoff; sidebar stale-result guards, tab focus, sortable box scores, chart and shot handlers, resize gating and iframe src stability. The original proof must remain 374,363 bytes with SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.

Live ESPN and streaming-provider checks, Windows Firefox `file://` and the 104-case manual checklist remain separate release gates. Never merge to `main` without explicit approval.

**Next:** Chunk 13 — standings, team profile, and player profile boundaries.
