# Courtside 1.7 — Phase 3C: Game Center, profiles and league leaders

**Status:** source extraction completed on the `refactor/modular-1.7` development branch. No user-facing release has been published and `main` remains untouched.

## Extraction checkpoints

| Checkpoint | New files | What moved |
| --- | --- | --- |
| Game Center & Charts | `src/features/game-center/{box-score,charts,render,controller,handlers}.js` | Box scores, team stats, overview, charts/shot maps/win probability, stats tabs and their event handlers |
| Standings & Team Profiles | `src/features/standings/standings.js`, `src/features/team-profile/{profile,handlers}.js` | Conference standings, standings fetch/caching/navigation, team detail, roster and schedule, team dialog controls |
| Player Profiles & League Leaders | `src/features/player-profile/{data,dialog,handlers}.js`, `src/features/league-leaders/{data,render,handlers}.js` | Player overview/game logs/season stats/profile events, six statistical ranking categories, filters, renderers and controls |

**14 new source fragments** across the three checkpoints. All previously extracted ESPN, scoreboard, ticker, Data Log and Live Alert files remain in place.

## Compatibility contract

The new files contain **unaltered subsequences of the original Courtside 1.6.1 classic JavaScript script**. `scripts/build.mjs` puts every fragment back at its original insertion point and embeds the original CSS in one HTML file. No `import`/`export` runtime modules or new dependencies are introduced.

These are **build-time fragments**, not isolated runtime modules. Functions and state still share the original script scope and some cross-feature dependencies remain. True module interfaces and isolation are separate refactoring work.

## Verification

In the local development environment with Node.js 22:

- `npm run check:syntax` — passed (all source fragments and the build script).
- `npm test` — **9/9 passed** (including unique insertion markers, generated script syntax, and exact HTML parity).
- `npm run verify:baseline` — passed. Generated HTML is **374,363 bytes**, SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`, exactly matching `baseline/courtside_1.6.1.html`.
- Chromium in-memory HTML smoke test — Scores and Standings navigation, Settings, What's New selection, and no synchronous JavaScript page errors.
- Chromium direct `file://` navigation — **blocked by test environment policy** (`ERR_BLOCKED_BY_ADMINISTRATOR`); **not passed**.
- Live ESPN requests, stream providers and Firefox on the user's computer — **not tested** in this phase.
- Full 104-point regression checklist — still open.

## Commands

```bash
npm run check:syntax
npm test
npm run verify:baseline
```

The distributable remains `dist/courtside.html`, created only during the build, and is intentionally Git-ignored. Continue using the frozen 1.6.1 baseline for strict parity until intentional behavior changes are separately approved.

## Next checkpoint

Complete extraction of remaining Viewer, Settings, What's New, shared utilities and any leftover event bindings; then plan explicit interfaces and tests before converting build-time fragments into independent modules. No merge to `main` without review and approval.
