# Courtside 1.7 — Phase 4B behavior test foundation

This phase adds **fixtures, tests and CI only**. No Courtside application source or network behavior has changed.

## Tests

- `tests/fixtures/scoreboard.json`: three synthetic ESPN-shaped games (upcoming, live, final). The matchups are **not** actual current-game data.
- `tests/contracts.test.mjs`: Node VM tests of the existing implementation: game normalization, polling intervals, high-priority ESPN request scheduling and 429 cooldown, preferences parsing/storage, and Live Alerts transitions.
- `tests/browser_smoke.py`: optional offline Chromium smoke test of Settings, What's New, Standings, a three-game mocked scoreboard, Live Only filtering, and iframe URL stability during a score redraw. It blocks external traffic; no actual stream or ESPN service is verified.
- `.github/workflows/ci.yml`: Node 22 checks for source syntax, all unit/build tests, and unchanged HTML parity on the development branch and pull requests. Browser smoke runs locally only because it requires Python Playwright and Chromium.

## Commands

```bash
npm run check:syntax
npm test
npm run verify:baseline
npm run test:browser  # optional; requires Python Playwright and Chromium
```

**At this checkpoint:** 12 existing build tests plus 5 new contract tests = **17 Node tests**, all passing locally. The browser smoke also passed locally. The built HTML remains exactly 374,363 bytes with SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.

## Limits and follow-up

This is not yet the full 104-point regression checklist. Firefox `file://` on Windows, live ESPN behavior and real request totals, unreliable third-party video providers, iframe audio restrictions, and all chart/profile edge cases are still unverified. Add fixtures for overtime/halftime/missing stats/rate limits and deeper Game Center, profiles and video teardown tests before large-scale module conversion.

The exact-file hash proves only that **this phase left the generated application unchanged**. After converting runtime modules, accept/reject based on behavior tests rather than byte equality.
