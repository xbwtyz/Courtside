# Courtside 1.7 — Phase 3B: ESPN, Scoreboard & Score Tickers

**Development-only milestone** on `refactor/modular-1.7`. No user-facing change, no change to the released HTML, and no changes to `main`.

## Scope and new source fragments

**ESPN foundation**

- `src/api/espn/endpoint.js` — existing ESPN scoreboard endpoint constant.
- `src/api/espn/config.js` — summary endpoint, 10-second live scoreboard / 15-second live stats / 60-second idle constants, and polling state.
- `src/api/espn/request-scheduler.js` — request priority dispatcher, throttling, backoff, Retry-After handling, shared cooldown.
- `src/api/espn/refresh-policy.js` — cache freshness and adaptive score/Game Center polling policies.
- `src/api/espn/game-summary.js` — Game Center summary fetch, caching, and instrumentation.

**Scoreboard**

- `src/features/scoreboard/data.js` — ESPN scoreboard parsing, fetch/error handling, status updates, date changes.
- `src/features/scoreboard/render.js` — game-card HTML, counts, interactive detail cards, incremental DOM updates, and filtering.
- `src/features/scoreboard/card-controls.js` — scoreboard card click and keyboard interactions.
- `src/features/scoreboard/navigation.js` — date controls, search, Live Only, and manual refresh.

**Score tickers**

- `src/features/ticker/controller.js` — main and viewer ticker rendering, motion, drag/swipe, and lifecycle.
- `src/features/ticker/clicks.js` — ticker click-to-watch navigation.

## Execution model

Each new file contains an **unchanged substring of the original 1.6.1 classic JavaScript script**, not a browser ES module. The original text is inserted by `scripts/build.mjs` at a uniquely named marker in `src/scripts/app.js`. The generated file remains one classic inline script with the original declaration and initialization order. This is a **build-time source decomposition**; cross-feature dependencies still exist and are not yet encapsulated behind module interfaces.

Other ESPN integrations for player profiles, standings, and league leaders remain with their respective feature code for now. Moving them, creating isolated modules, or changing any API behavior requires subsequent review.

## Incremental commits and acceptance

1. Extract ESPN foundations and Game Center summary; confirm byte-identical build.
2. Extract scoreboard data, rendering, and user interactions; confirm byte-identical build.
3. Extract both score tickers and associated click handlers; run final syntax/build tests and verify committed artifacts.

Run from the repository root using Node.js 20+:

```bash
npm run check:syntax
npm test
npm run verify:baseline
```

Expected exact output: **374,363 bytes**, SHA-256 **`0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`**. The `verify:baseline` command fails if the generated HTML differs by a single byte from `baseline/courtside_1.6.1.html`.

The baseline match confirms that no code or visual behavior was *intentionally* changed. Full live ESPN, streaming-provider, Firefox local-file, and complete 104-point functional regression checks remain separately scoped; do not count this limited extraction as having passed those external integration checks.
