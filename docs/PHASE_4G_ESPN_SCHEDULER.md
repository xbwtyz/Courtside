# Courtside 1.7 — Phase 4G: Isolated ESPN Scheduler and Integration Tests

**Status:** development-only checkpoint on `refactor/modular-1.7`; `main` remains untouched. No new features, polling interval changes, streaming changes, or intentional differences in API request behavior.

## Scope

The original `src/api/espn/request-scheduler.js` is preserved byte-for-byte in `src/api/espn/request-scheduler.legacy.js` for the frozen reference build and rollback. The original scheduler body has been wrapped in a dependency-injected `createEspnScheduler` factory in `src/api/espn/request-scheduler.module.mjs`. A real ESM entrypoint (`request-scheduler.entry.mjs`) feeds esbuild; the resulting self-contained browser IIFE is placed at the same position in Courtside's original classic script.

The browser adapter binds exactly four existing names—`requestESPN`, `exponentialBackoff`, `retryAfterMs`, and `noteEspnResponseError`—to the private scheduler instance. Its dependencies are the existing ESPN polling objects, backoff limit, `Date`, `Promise` and timers. All existing consumers (including the scoreboard, Game Center, standings, leaders and Data Log) continue calling those names. The scheduler's queue, busy flags, timer and ordinal are now private. **Shared application state itself remains legacy and is not migrated in this checkpoint.**

## Regression protections

`tests/espn-scheduler.test.mjs` compares original and migrated implementations using deterministic fake clocks, asynchronous gates and simulated responses. It exercises:

- Serialized high-priority lane, priority order, and at most two concurrent requests
- Live scores starting while a slow leaderboard request is in flight
- Leaderboard pacing at least 2.6 seconds apart
- `Retry-After` seconds/date parsing, exponential backoff cap, HTTP 429 and HTTP 503 behavior
- No request work during shared cooldown, recovery afterward, and queue recovery after failure
- Scheduler-instance isolation and absence of direct UI/network dependencies

`tests/espn-integration.test.mjs` exercises the existing (unchanged) Scoreboard and Game Center implementations using offline ESPN-shaped fixtures:

- Concurrent summary calls dedupe, reuse a live cache, take one final snapshot, and stop re-fetching
- Failed summaries clear pending work, back off, and recover
- Changing dates aborts the prior request; even a late response cannot overwrite the new game day
- Same-day duplicate refreshes and requests during cooldown do not launch extra fetches
- Adaptive poll coordinator skips hidden tabs and respects cooldown and viewer visibility

The original `contracts.test.mjs` scheduler baseline now explicitly targets the retained `.legacy.js` source. A new build test ensures the modern bundle remains one inline classic script and baseline proof still matches **exactly 374,363 bytes**, SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.

## Reproducibility

```sh
npm install --no-audit --no-fund
npm run check:syntax
npm test
npm run verify:baseline
npm run build
npm run test:browser
```

The modern HTML intentionally differs in bytes because the source now includes another isolated module. GitHub Actions installs real esbuild 0.28.2 and verifies Node tests, the frozen baseline, an inline modern bundle, and the four existing offline Chromium smoke/comparison scripts. The local development environment uses a temporary diagnostic bundler stand-in because npm download access is unavailable; treat **GitHub Actions** as authoritative for the production esbuild bundle.

## Release gate and next step

Do not merge to `main` or call this a public 1.7 release until the larger 104-point regression checklist, Windows Firefox `file://` tests, live ESPN request monitoring, and actual third-party iframe checks are completed. Introduce a narrowly scoped **game-store interface** next, with explicit state ownership and tests for event emissions, visibility and identity, before modifying shared `state` or `viewerState`.
