# Courtside 1.7 — Chunk 11: Game Center Presentation

**Working branch:** `refactor/modular-1.7`; `main` untouched.

## Build-time migrations

Three original scripts become independent esbuild ES module factories: `box-score.js` (15 functions, 4 constants), `charts.js` (20 functions), and `render.js` (1 function). The originals remain byte-for-byte in `.legacy.js` backups for frozen 1.6.1 proof reconstruction. Each compiled IIFE returns to its original classic-script position in a single standalone HTML file.

The box-score module retains ESPN player normalization, aliases, DNP, team comparisons, sorting, wide/compact table, player profile links and overview. Charts retains lead, shot and probability models, three visuals, sliders, shot filters, keyboard/pointer controls and play inspection. Renderer retains Game Center tab presentation, scroll/focus preservation and status text.

The original single `activeChart` global binding still owns chart state. Both chart and render factories read/write it via lazily injected getter/setter. No second chart state, API request or timer is introduced.

**Not touched:** ESPN Game Summary network requests, Game Center state controller, delegated handlers, ticker or iframe playback.

## Verification

Run `npm run check:syntax`, `npm test`, `npm run verify:baseline`, `npm run build`, `npm run test:browser`. New Node comparisons cover box score normalization, ordering and chart models. Offline Chromium comparisons cover Game Center tab layouts, chart types, interactions, scroll/focus, cached stats and iframe `src` stability. Original 1.6.1 proof must remain 374,363 bytes, SHA256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.

Live provider availability, Firefox `file://` and manual regression checklist require separate release validation; merge to `main` only after approval.

**Next:** Chunk 12 — Game Center controller, delegated handlers and ESPN summary request isolation.
