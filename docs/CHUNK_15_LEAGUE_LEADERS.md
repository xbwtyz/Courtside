# Courtside 1.7 — Chunk 15: League Leaders (47 / 47 modules)

**Work branch:** `refactor/modular-1.7` only. Never modify `main` without separate approval.

The final three original classic-script fragments are extracted as esbuild ES modules, then reinserted as IIFEs at their exact original script positions. Runtime remains **one offline-openable standalone HTML with one classic inlined script**, without ES module imports or a local server.

- `src/features/league-leaders/data.js` — ESPN league-wide pagination and 100-page safety limit, schema/season/regular-season validation, unique-athlete ID and count checks, completeness gating, 30-minute TTL, last-good-cache retention on failure, diagnostics/data logging, and shared `leaderState`. Dynamic references to `mainView` stay late-bound.
- `src/features/league-leaders/render.js` — six statistic categories, ties, sorting, missing-value handling, shooting-volume eligibility, pagination, focus-preserving control updates, table diffing, loading status and completeness cautions. `leaderControlsInitialized`, `leaderControlsCategory` and `leaderLastTableKey` remain one renderer-owned state.
- `src/features/league-leaders/handlers.js` — delegated category, sort, team, position, minimum games/minutes, shooting volume, search, rows, paging, refresh and reset controls, including settings persistence.

Exact original fragments are preserved as `.legacy.js`. Named functions remain hoisted classic-script adapters, preserving cross-fragment references. App-level state is still a single object. No new request timer, endpoint or stream change.

Required gates: `npm run check:syntax`, `npm test`, `npm run verify:baseline`, `npm run build`, and `npm run test:browser`. Additional Node and Chromium parity checks exercise ESPN page completeness, rank ties, filters, rendering and control behavior. Original 1.6.1 proof remains 374,363 bytes with SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.

**After this extraction:** all 47 original inline script fragments have independent build-time module factories. A separate final integration audit, live ESPN/stream-provider checks, Firefox `file://` testing and manual 104-case regression checklist are required before any discussion of merging to `main`.
