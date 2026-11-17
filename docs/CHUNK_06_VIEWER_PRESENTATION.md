# Courtside 1.7 — Chunk 06: Viewer Presentation and Navigation

**Branch:** `refactor/modular-1.7`, development only. Do not touch `main` or introduce user-facing feature changes.

## Scope

Five existing source fragments now compile as independent build-time ES modules inserted at their original classic-script positions:

| Fragment | Module | Original responsibility |
| --- | --- | --- |
| `src/features/viewer/title.js` | `title.module.mjs` | Resolve ESPN game title; fall back to current AuraSports title |
| `src/features/viewer/controls.js` | `controls.module.mjs` | Viewer buttons, layout selectors, stream/game controls and toggles |
| `src/features/viewer/keyboard.js` | `keyboard.module.mjs` | Escape handling and Tab/Shift+Tab focus trap |
| `src/features/ticker/clicks.js` | `clicks.module.mjs` | Open/switch Viewer games through ticker buttons |
| `src/core/main-navigation.js` | `main-navigation.module.mjs` | Four primary tabs, refresh click and directional keyboard navigation |

Each fragment's exact original is retained in a `.legacy.js` file for byte-identical baseline reconstruction. Legacy callers retain the existing `viewerGameTitle` and `onTickerClick` identifiers as mutable bindings. Current game and cache collections are read lazily, while Viewer controls use a live getter for `viewerState`.

The Viewer iframe controller, `paintPlayer`, `paintViewer`, game/source changes and network connectors are **not migrated or modified** in this chunk. In particular, routine repaints should never alter an unchanged iframe `src`.

## Regression gates

Run `npm run check:syntax`, `npm test`, `npm run verify:baseline`, `npm run build`, and `npm run test:browser`. New Node tests compare legacy event handlers, focus navigation, Viewer toggles, ticker routing and title fallbacks. New offline Chromium comparisons exercise real navigation and Viewer controls with mock stream data and assert no unnecessary iframe `src` mutation. All outbound requests are blocked.

Frozen 1.6.1 build: **374,363 bytes**, SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.

**Limits:** Real provider availability, Windows Firefox `file://`, and complete manual regression checklist are still release gates. Never merge into `main` without separate approval.

**Next:** Chunk 07 — inspect and test the larger Viewer iframe controller before any extraction; isolate source/selection logic only with explicit stable-`src` protections.
