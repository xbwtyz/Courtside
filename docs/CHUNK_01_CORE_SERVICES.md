# Courtside 1.7 — Chunk 01: Core Services & Request Status

**Branch:** `refactor/modular-1.7` (development only). **Scope:** isolate five existing source fragments and centralize scoreboard request-status transitions. No new user-facing features and no changes to `main`.

## What changed

| Old source-fragment location | New module / exported interface | Compatibility binding |
| --- | --- | --- |
| `src/api/espn/endpoint.js` | `endpoint.module.mjs`: `createEspnEndpoints()` | `API` (scoreboard URL) |
| `src/core/dom.js` | `dom.module.mjs`: `createDomLookup(document)` | `$` (original DOM ID getter) |
| `src/api/espn/config.js` | `config.module.mjs`: `createEspnConfig()`, `createScoreRequestStatus()` | `SUMMARY_API`, 4 interval/backoff constants, `espnPoll`, `statsPoll`, `scoreRequestStatus` |
| `src/api/espn/refresh-policy.js` | `refresh-policy.module.mjs`: `createEspnRefreshPolicy(dependencies)` | All 7 original refresh-phase selectors and functions |
| `src/core/polling-bootstrap.js` | `polling.module.mjs`: `createPollingCoordinator(dependencies)` | `runAdaptivePolls`, with original listener/timer/initialization statements retained in the bootstrap fragment |

Each `.entry.mjs` is bundled by esbuild as a browser IIFE and inserted at **the same script position** as its historical fragment. Legacy callers keep the same identifiers. The generated application remains **one inline classic script in one standalone HTML file**, with no runtime imports or server.

### Request-status ownership

The scoreboard still controls *whether* to request scores, handles fetches, alerts, rendering, and logging. `scoreRequestStatus` now owns just the previously scattered mutable request-status assignments:

- `rateLimited(force)`: deadline and visible manual-refresh error message
- `begin()`: request sequence, abort-controller ownership, loading and requested date
- `succeeded()`: last successful update, first-load flag, error clearing and failure counter reset
- `incrementFailure()` and `recordError(error)`: existing failure count and error-message behavior, with alert baseline reset between them as before
- `complete(seq)`: only the latest request may clear loading state or schedule a subsequent refresh; the existing interval/backoff/cooldown formula remains unchanged

This is **not** an HTTP client rewrite. Shared mutable `state`, `espnPoll`, and `statsPoll` retain their original identity, and the ESPN request queue from Phase 4G is unchanged. Only the status field writes in `fetchScores()` were delegated. Source `data.phase4h.js` records the immediately previous development version for inspection; frozen 1.6.1 uses `data.legacy.js`.

A subtle source-order dependency is preserved: `API` originates in the early endpoint fragment, but `SUMMARY_API` originates in the later ESPN configuration fragment. The modular adapters retain that ordering exactly. Likewise, mutable `mainView` is read by `getMainView()` at polling time rather than captured during module construction.

## Regression protection

Run these commands at the project root:

```bash
npm install --no-audit --no-fund
npm run check:syntax
npm test
npm run verify:baseline
npm run build
npm run test:browser
```

Tests cover:

- Endpoints, DOM getter identity, and original ESPN configuration defaults
- Independent config instances and scoreboard request-status fields
- Success, failure, abort-error message, 429 cooldown, exponential backoff, stale-request settlement and Infinity deadlines
- Old-versus-new refresh decisions for scheduled/live/final games, Game Center cache, document visibility and shared cooldown
- Old-versus-new polling coordinator decisions for hidden tabs, live scores, standings TTL, request throttling and status updates
- Real application browser comparisons for loading indicators, forced cooldowns, successful mocked ESPN fetches, HTTP 503, and unchanged Viewer state
- Existing What’s New, glossary, core formatting, Game Store, and Video Viewer smoke tests
- Frozen 1.6.1 reference build **374,363 bytes** with SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`

**Local checkpoint:** 59/59 Node tests and six separate offline Chromium scripts passed. Local esbuild is a temporary *diagnostic stand-in* because external npm downloads are unavailable in this container. **Only the successful GitHub Actions build using real esbuild 0.28.2 is distribution-ready.** CI repeats the Node/browser tests and publishes the generated HTML.

## Limits and follow-on

This migration does **not** verify real ESPN traffic, provider availability, Windows Firefox `file://` operation, or the full 104-case manual regression checklist. Those gates are still required before merging to `main` or releasing 1.7. The current `runAdaptivePolls()` still keeps the original timers (1-second poll, stream-index refresh TTL) and score polling rules (10-second live, 15-second active Game Center, 60-second idle). No new polling or stream requests are introduced.

Next is **Chunk 02 — Settings & Preferences** (5 fragments), including blocked-storage behavior and saved preference persistence. Preserve rollback source and introduce tests before changing runtime behavior.
