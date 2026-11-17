# Courtside 1.7 — Chunk 08: Live Score Ticker

**Branch:** `refactor/modular-1.7` only. No user-facing changes, no modification to `main`.

## Module extraction

The original `src/features/ticker/controller.js` (9,106 bytes) is frozen unchanged as `controller.legacy.js`. A real ES module `controller.module.mjs` owns the same nine ticker functions, the tickerControllers Map, the reduced-motion and desktop-hover media queries, and one animation frame loop; it is compiled into the same original classic-script location by esbuild.

The `controller.js` adapter retains all original classic-script identifiers, including the current `tickerFrame` counter, and injects the DOM, observer APIs, timer, requestAnimationFrame, and late-bound game and Settings state. This preserves the ticker's existing runtime order and permits a Settings object to be replaced by Restore Defaults.

The original logic for three mirrored score cycles, dynamic copy counts for large viewports, element reuse on score updates, pixel remainder accumulation, drag suppression, touch and wheel handling, left/right arrow navigation, 6-second interaction pause, hover/focus/reduced-motion suppression, and AbortController/ResizeObserver cleanup is retained.

## Verification

Required gates: `npm run check:syntax`, `npm test`, `npm run verify:baseline`, `npm run build`, `npm run test:browser`.

New Node tests compare the frozen legacy ticker and modern factory for formatting, normalization, copies, frame tick scheduling, current preferences, and disposal. New offline Chromium tests compare scoreboard and Viewer ticker rendering, scroll position and DOM identity across score changes, keyboard/wheel interaction, drag behavior, settings updates, no-games disposal, and iframe stability. All third-party requests remain blocked by the browser harness.

The original 1.6.1 baseline must still produce 374,363 bytes, SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`. The distributable stays a single HTML file with one classic inline script and no runtime modules.

**Remaining release gates:** real-world streaming providers and ESPN, Windows Firefox `file://` verification, and the full 104-case manual checklist. Merge to `main` only after separate approval.

**Next:** Chunk 09 — scoreboard rendering and navigation, with player/card regression coverage.
