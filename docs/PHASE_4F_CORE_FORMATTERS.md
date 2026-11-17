# Courtside 1.7 — Phase 4F: Shared formatting utilities

**Scope:** Development-only ES-module migration on `refactor/modular-1.7`. No change to `main`, version numbering, user-facing features, endpoints or stream providers.

## What migrated

Five original utility functions now come from `src/core/formatters.mjs`, a native ES module with no imports, global application state, or DOM dependencies:

- `fmtDate(date)`: local YYYY-MM-DD rendering
- `dateFromString(value)`: local-noon parsing of YYYY-MM-DD strings
- `today()`: current local date using `fmtDate`
- `safe(value)`: HTML escaping for user-facing markup and attributes
- `safeLogo(url)`: HTTPS-only ESPN CDN image URL validation

`src/core/entry.mjs` exports these five functions to esbuild. The build emits a browser-compatible IIFE named `CourtsideCoreUtils` at the original utility position in the classic script. `src/core/utils.js` binds the original five function names from the IIFE. Existing Scoreboard, Game Center, profiles, charts, standings, and viewer code still call those function names unchanged.

`src/core/utils.legacy.js` contains the **exact original fragment** and is used for the frozen legacy proof build. The build manifest adds a third isolated module without changing the What’s New or Statistical Glossary adapters. The final HTML remains one file, with one inline classic `<script>` and no runtime module files or backend.

## Verification commands

```sh
npm install --no-audit --no-fund
npm run check:syntax
npm test
npm run verify:baseline
npm run build
npm run test:browser
```

- **32 Node tests**: the previous 27 plus four pure formatter contract tests and one build-integration test. Cases compare original/new implementations for HTML injection escaping, invalid logo hosts and schemes, current dates, DST-sensitive dates, parsing and source isolation.
- **Four Chromium test scripts**: existing smoke, What’s New legacy comparison, Glossary legacy comparison, and a new browser comparison of date formatting, escaping, logo validation, and the rendered HTML of three synthetic ESPN-shaped scoreboard games.
- **Frozen reference**: `dist/courtside-legacy-proof.html` must remain **374,363 bytes**, SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.
- The new development HTML intentionally differs byte-for-byte from the original; the behavioral tests are the acceptance criteria. The module build is produced with real esbuild in GitHub Actions, not the temporary offline stand-in used during local smoke tests.

## Remaining release gates

Windows Firefox `file://` verification, live ESPN and third-party streaming tests, and the comprehensive 104-point regression checklist remain outstanding. Do not merge into `main` or label the refactoring as a public 1.7 release without a separate go/no-go review.

## Next recommended migration

Before converting stateful ESPN or viewer systems, add explicit contracts and browser fixtures for request scheduling, viewer lifecycle, failed requests and the shared game store. Maintain independently reversible commits for each migrated feature.
