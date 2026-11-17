# Courtside 1.7 — Chunk 10: Scoreboard Data and ESPN Requests

**Development branch:** `refactor/modular-1.7`. Do not modify `main` or introduce new user-facing features.

## Migration

The six-function scoreboard data fragment moves from `src/features/scoreboard/data.js` into `data.module.mjs`, compiled with esbuild via `data.entry.mjs` into the same classic-script position. Existing public script names (`classify`, `parseGames`, `updateStatus`, `fetchScores`, `changeDay`, `selectDay`) remain mutable.

**Two rollback snapshots:** `data.legacy.js` retains the frozen original 1.6.1 source byte-for-byte; `data.pre-module.js` retains the 1.7 Phase 4H code immediately before this migration, including `gameStore.replaceGames`, `gameStore.selectDate` and `scoreRequestStatus` usage. Existing ESPN integration tests continue to run the pre-module fragment, with additional module-to-pre-module parity tests.

The factory retains the existing ESPN fetch flow, 14-second timeout, request sequencing and cancellation, 10s live/60s idle poll policy via the scheduler, shared cooldown, logging, Live Alerts, Game Store, ticker and Viewer updates, success/error/finalization paths, and date changes. It adds **no extra API requests, intervals, or new runtime dependencies**.

Legacy code relies on reassignment of `fetchScores`, `selectDay` and renderer functions in tests and UI. The adapter resolves these functions at call time; the module calls back via `callFetchScores`, `callSelectDay`, `callParseGames`, `callClassify`, and `callUpdateStatus` to retain that behavior. Global fetch and ESPN helpers are similarly late-bound.

## Required verification

Run `npm run check:syntax`, `npm test`, `npm run verify:baseline`, `npm run build`, and `npm run test:browser`. Offline Node tests compare date changes, raw ESPN classification, status text, cooldown, duplicate requests, stale requests, timeout/error finalization, and the exact ordered callbacks to the Phase 4H source. Offline Chromium checks real source replacements and Viewer iframe stability. Frozen 1.6.1 proof must remain 374,363 bytes with SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.

**Not verified in CI:** live ESPN/third-party stream availability and Windows Firefox `file://`. No change to `main` without separate approval.

**Next:** Chunk 11 — Game Center UI and stats presentation boundaries.
