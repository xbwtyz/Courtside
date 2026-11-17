# Courtside 1.7 — Phase 3D: Viewer, Settings & shared code extraction

**Status:** Development-source decomposition only on `refactor/modular-1.7`. No merge into `main`; no new features or changed runtime logic.

## Checkpoints

| Checkpoint | Extracted source | Responsibility |
| --- | --- | --- |
| 3D.1 | `src/api/streams/{config,requests,matching}.js` | Provider URLs, caching/fetches, validation and matchup/source matching |
| 3D.1 | `src/features/viewer/{title,controller,controls,keyboard}.js` | Viewer rendering, 1/2/4-tile layouts, opening/closing, source selection, refresh, controls and keyboard behavior |
| 3D.2 | `src/features/settings/{preferences,shortcut,dialog,initialization}.js` | Saved preferences, settings interface, event handlers, reset, and startup defaults |
| 3D.2 | `src/features/whats-new/{releases,controller}.js` | Sixteen historical release records, selector, older/newer navigation, unread indicator and saved read status |
| 3D.2 | `src/core/{utils,state}.js` | Shared value formatting, HTML sanitization, application and viewer state |
| 3D.3 | `src/core/{dom,main-navigation,polling-bootstrap}.js` | DOM lookup, main tab controls, adaptive polling and startup |
| 3D.3 | `src/features/stat-glossary/glossary.js` | Statistical abbreviation dictionary and tooltip controls |

**19 new development files in Phase 3D**, joining previously extracted Phase 3A–3C systems. The host `src/scripts/app.js` now primarily contains original strict-mode declaration and the 47 insertion markers, in their original order.

## Important architectural distinction

These are **build-time source fragments**, not independent runtime JavaScript modules. The `scripts/build.mjs` script concatenates each fragment into the same classic script scope in the same lexical order as the original v1.6.1 code. No imports, exports, extra runtime files, new network calls, or new backend were added. Cross-feature references remain shared; clean module interfaces are future work and require separate approval.

Do **not** run `src/scripts/app.js` by itself. Build and open `dist/courtside.html` instead.

## Verifications

```sh
npm run check:syntax
npm test
npm run verify:baseline
```

Local checks for Phase 3D passed: 12/12 Node build tests, JavaScript syntax checks across all source fragments, and byte-for-byte equivalence to the frozen `baseline/courtside_1.6.1.html`.

- Expected build: **374,363 bytes**.
- Expected SHA-256: `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.
- Version shown in generated application stays **1.6.1** intentionally, because 1.7 is not a user-facing release yet.
- These checks verify the generated application code is unchanged; they do **not** verify live ESPN, stream providers, every possible browser interaction, or Firefox `file://` usage.
- Full `docs/REGRESSION_CHECKLIST_1.6.1.md` remains open until explicitly executed.

## Next phase recommendations

1. Inventory cross-feature dependencies before introducing true module scopes.
2. Add functional test fixtures and browser regression coverage for scores, viewer, Settings and statistics.
3. Introduce typed/data-contract-style boundaries incrementally, without changing polling, streaming, or stored preferences.
4. Review in a pull request; do not merge to `main` or label 1.7 released without approval.
