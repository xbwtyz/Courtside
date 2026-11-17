# Courtside 1.7 — Chunk 03: Data Log

**Scope:** `refactor/modular-1.7` only; no public release, changes to `main`, or user-facing features.

## What moved

- `src/features/data-log/core.js` now instantiates `createDataLog()` from `core.module.mjs` at the same original script position. The service owns the request audit entries, WeakMap response association, bounded semantic snapshots, LRU eviction, comparison baselines, UI reconciliation, export and performance sampling.
- `src/features/data-log/controls.js` now registers the original seven local-only controls using `attachDataLogControls()` from `controls.module.mjs`. The same source-order and event registration timing are retained.
- Both frozen source fragments are copied *unchanged* to `core.legacy.js` and `controls.legacy.js`. Baseline reconstruction uses these exact originals.
- All legacy top-level names remain available as destructured adapters, so existing ESPN, standings, player/team profiles and settings continue calling their original identifiers. The migration changes code ownership rather than behavior.

## Request and performance safeguards

`requestESPN` is injected as a deferred function and is called only from `auditESPNJob()`; it still wraps the *existing* prioritized queue. Data Log creates **no fetch, timer-based polling, or independent API requests**. The original 5-second interval remains solely a visible settings diagnostics refresh. Snapshot limits (96 scopes, 8,000 records, 3 MiB approximate normalized field text), 250-ms UI batching and 2,000-entry history cap remain unchanged.

The deferred adapters for scoreboard/profile helpers prevent early evaluation of later code: Data Log is instantiated before the request scheduler, box-score parsing and several profile readers are defined.

## Verification

Run `npm run check:syntax`, `npm test`, `npm run verify:baseline`, `npm run build`, and `npm run test:browser`. Added Node regression tests compare the original and new engines for received/baseline/unchanged/changed/error audits, pause semantics, snapshot eviction, ESPN queue call counts, score projection, and UI controls.

Baseline parity is enforced by the existing byte-for-byte 1.6.1 reference guard. GitHub Actions runs the real esbuild 0.28.2 toolchain and offline Chromium comparisons. **Only after CI passes can the output be treated as a validated development preview.**

## Still outstanding

Real ESPN and third-party stream availability, complete 104-case manual regression checks and Firefox `file://` verification remain release gates. Do not merge into `main` or publish a 1.7 release without separate approval.

**Next:** Chunk 04 — inspect Live Alerts boundaries and baseline/deduplication before extracting the alert engine. This is higher-coupling than the Data Log and requires fixtures covering first-success silence, selected teams and notification throttling.
