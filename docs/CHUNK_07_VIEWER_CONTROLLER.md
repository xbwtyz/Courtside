# Courtside 1.7 — Chunk 07: Viewer Playback Controller

**Branch:** `refactor/modular-1.7`; `main` untouched. Development-only refactor: no playback feature changes.

## Isolation

All 12 functions from `src/features/viewer/controller.js` now live in `controller.module.mjs`, exposed through a single `createViewerController` factory compiled via esbuild. The original 10,751-byte fragment is retained *unchanged* in `controller.legacy.js` for rollback and exact baseline reconstruction. The `controller.js` adapter exports the same mutable lexical function names at exactly the previous inlined script location.

Cross-fragment collaborators are injected as **late-bound callbacks** rather than captured values, preserving legacy rebinding (particularly `combinedSourcesForId`) and helpers declared later in the script. Provider caches and saved Settings preferences use read-through getters, so replacement cache Maps and restored preference objects are seen without re-instantiation.

The original `paintPlayer()` iframe mutation logic is intentionally unchanged: `src` changes only if the selected URL differs, is removed when hidden/closed, and is not touched by a normal same-source scoreboard repaint. The controller retains the existing pending provider lookup token, prioritized PPV.st-first stream list, four slot objects, stats sidebar gating, session defaults, and focus restoration.

## Verification gates

Run `npm run check:syntax`, `npm test`, `npm run verify:baseline`, `npm run build`, `npm run test:browser`. Added Node regression fixtures compare old and new game selection, player paint, source switch, layout changes, close cleanup, in-flight lookup behavior, and restored Settings defaults. Added offline Chromium comparison checks actual iframe `src` mutation counts for repaint, manual switch, layout hide/re-show and close, plus provider cache replacement. The pre-existing browser and provider tests remain enabled.

The final distributable remains a **single HTML file** with no runtime module imports. Baseline 1.6.1 proof remains 374,363 bytes and SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.

**Release restrictions:** Real ESPN and streaming hosts, Firefox `file://`, and the full manual 104-case checklist have not been verified by offline CI. Do not merge to `main` without separate approval.

**Next:** Chunk 08 — move the complex ticker controller in a separate, browser-measured chunk.
