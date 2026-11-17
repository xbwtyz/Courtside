# Courtside 1.7 — Phase 4H: Game Store ownership checkpoint

**Development-only.** Branch: `refactor/modular-1.7`; `main` is not modified. The public app is not released as 1.7. No new feature, stream source, polling interval, or network endpoint is intended.

## What moved

`src/core/game-store.module.mjs` is a real, build-time ES module that owns the creation of Courtside's existing mutable `state` object and the selected-game-date/game-list mutations. `src/core/game-store.entry.mjs` feeds esbuild; `src/core/state.js` now obtains `const state = gameStore.state` at the original initialization position. **The shape and object identity of `state` are deliberately unchanged**, so legacy features continue reading it while we migrate incrementally.

Explicit methods:

- `replaceGames(games)` — assigns the original ESPN event array without cloning game objects; called after accepted scoreboard fetches.
- `selectDate(day)` — resets games, expansion, errors, first-load and refresh tracking with the original order; called by the Scoreboard date navigation.
- `navigateToDate(day)` — moves to a player game-log date **without clearing old games before the fetch**, as the original code did.
- `findGame(id)` — ID-normalized lookup, initially used by Game Center.
- `getSnapshot()` — frozen *shallow* snapshot of date and the game-list array. ESPN game objects in it remain shared and are **not** deeply immutable.
- `subscribe(callback)` — optional synchronous change notifications for the three new game-store mutation entry points. Subscribers cannot block a score update; the function returns an unsubscribe callback. No existing UI uses subscriptions yet.

The original state fragment and the three modified consumer fragments are preserved verbatim as `*.legacy.js` for rollback and the exact 1.6.1 proof build.

## Architectural limitations

This is a **compatibility bridge**, not complete immutable-state enforcement. Existing code still accesses `state` directly and mutates other state properties (e.g. request sequencing, loading, errors, settings-derived filters and expanded game IDs). `viewerState`, caching, ESPN scheduling, alerts, and other subsystems are unchanged. Subscriptions only track mutations made through store methods, not arbitrary direct writes into the legacy `state`. This design avoids a hazardous app-wide rewrite.

The distributable is still a **single standalone HTML file** containing bundled browser-compatible JavaScript and CSS; no runtime ES module imports, server, or additional files are necessary for users.

## Test contract

The module's independent Node tests validate: the exact legacy state shape and defaults, game reference identity, normalized ID lookups, expansion Set identity, reset order, player-navigation non-reset semantics, frozen shallow snapshots, subscription order/unsubscribe, resilience to observer exceptions, and independent store instances. Existing integration tests use the real store on scoreboard fetch paths and retain out-of-order/stale-response protections.

The new offline Chromium comparison runs original-vs-modern generated HTML through equivalent synthetic Scoreboard renders, expanded game details, date navigation during an ESPN cooldown, simulated successful scoreboard fetch, and Viewer state checks. It deliberately blocks external requests.

Run:

```sh
npm install --no-audit --no-fund
npm run check:syntax
npm test
npm run verify:baseline
npm run build
npm run test:browser
```

At the development checkpoint, **51/51 Node tests and 5/5 Chromium scripts** passed locally. GitHub Actions must repeat with real esbuild. Offline development builds can use a local bundler diagnostic stub; such builds are **not** the distribution artifact. Use the HTML published by successful CI instead.

The frozen `baseline/courtside_1.6.1.html` and `dist/courtside-legacy-proof.html` remain **374,363 bytes**, SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.

## Remaining gates

Windows Firefox `file://`, real ESPN traffic/request totals, live third-party streams, and the full 104-case manual regression checklist are not yet validated. **Do not merge to main or make a public 1.7 release** until a separate review and approval.

## Next step

Test and migrate explicit ownership of request-status fields, settings-derived filters, and Viewer session lifecycle in small independent increments. Keep legacy source snapshots and behavioral regressions for each change.
