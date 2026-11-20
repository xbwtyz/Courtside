> **Historical record (clarified 2026-11-19):** This document captures the pre-merge 1.7.0 state. PR #1 was later merged, v1.7.0 was released, and the Pages homepage was deployed. Outstanding historical manual QA items remain outstanding; do not interpret them as passed. See the current `docs/plans/1.7.1/MAINTENANCE_A_C.md` for maintenance decisions.

# Courtside 1.7 — Final integration audit

**Source branch:** `refactor/modular-1.7` only. **Release state:** development candidate. **Published main:** unchanged.

## Architecture inventory

- **47 / 47** original insertion markers mapped to **47 / 47** unique build-time ES module entrypoints, distinct IIFE global exports, and frozen `.legacy.js` sources. The original script order is maintained by `featureFragments` in `scripts/build.mjs`.
- The standalone HTML contains **one inline classic script, one inline stylesheet**, and **no runtime JavaScript module imports**. Network activity continues to be initiated by the same ESPN and stream-provider code; there is no backend or local server.
- Shared state remains owned by the original core, standings/team profile, Game Center chart, player data, and League Leaders owners. Consumers use injected callback/getter interfaces rather than creating parallel cache objects.
- 1.6.1 frozen baseline: **374,363 bytes**, SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.
- 1.7 Chunk 15 release-candidate artifact: **498,206 bytes**, SHA-256 `e284aa289128728a3121092a914697e00caada02b6dc3fcff1747a9b5cacad60`. This intentionally freezes the current 1.7 candidate for reproducibility checks; no user-visible feature work is authorized in this audit.

## Automated gates

The permanent `tests/architecture-audit.test.mjs` checks all module entries/source/legacy backups, their exact placeholders, IIFE globals and state owners, and repeats the modern build for byte-identical SHA-256 parity while rechecking the original 1.6.1 bytes. `npm test` includes it; it can also run separately with `npm run test:architecture`.

Required CI steps (Node.js 22):

1. Install the exact checked-in dependency graph with `npm ci`.
2. `npm run check:syntax` and `npm test` (Node build, architecture and behavior parity).
3. `npm run verify:baseline` (byte-level 1.6.1 proof).
4. `npm run build` (single HTML artifact and release-candidate SHA).
5. `npm run test:browser` (offline Chromium parity across prior chunks and League Leaders).

## Release readiness / outstanding manual gates

| Gate | Status / notes |
| --- | --- |
| 47 module inventory and complete original backups | **Automated** |
| Standalone single-script build + deterministic artifact SHA | **Automated** |
| Original 1.6.1 byte parity | **Automated** |
| Node behavior tests and Chromium mock regression comparisons | **Automated** |
| Live ESPN scoreboard/game summary/standings/player/leaders APIs | **Manual — outstanding** |
| Live stream-provider listing and embed playback | **Manual — outstanding** |
| Windows Firefox `file://`, popup, storage/privacy setting checks | **Manual — outstanding** |
| Full human regression checklist in `docs/REGRESSION_CHECKLIST_1.6.1.md` | **Manual — outstanding** |
| Merge to `main` or official 1.7 release | **NOT APPROVED** |

The test suite deliberately blocks third-party traffic. A green CI run **cannot** establish availability, CORS permissions or iframe behavior of external providers on a live connection.

## Audit constraints

No source behavior changes, stream provider preference changes, polling cadence changes or CSS/interface alterations. Keep `main` at its pre-refactor commit until the user approves a separate merge. If future source work legitimately changes the release-candidate HTML SHA, update the recorded expected value and explain the change after repeating all gates.

## v1.7.0 release preparation (after the Chunk 15 audit)

The 498,206-byte SHA-256 `e284aa289128728a3121092a914697e00caada02b6dc3fcff1747a9b5cacad60` above describes the **pre-release-stamping** 1.7 modular candidate only. The v1.7.0 identity update changes the generated HTML; the current, fully tested v1.7.0 artifact is **499,291 bytes**, SHA-256 `c07f7066f02df59eff14d9da826ba3d8a793b8dca4bd33197c8cee7a8edc4526` (Github Actions run [44030781875](https://github.com/xbwtyz/Courtside/actions/runs/44030781875)). The root `courtside.html` file has been generated and committed only on the refactor branch.

The visible v1.7.0 title, header, Settings footer, What's New metadata/history, Data Log export version, and `package.json`/lockfile are updated consistently. The exact 1.6.1 `src/index.legacy.html` source template and 47 frozen legacy fragments reconstruct the original baseline without alteration. `npm run release:prepare` copies a freshly compiled HTML to the repository-root `courtside.html`; `npm run release:verify` compares root and output bytes and SHA. Root publishing is only performed on `refactor/modular-1.7` during release preparation, never on `main`.

The six Firefox smoke checks (startup, scores, player profile, League Leaders, viewer/streams, and settings persistence) were reported passed by the project owner. The complete manual historical regression checklist remains outstanding; do not state it is fully executed. No merge, tag, or release publication has been authorized.
