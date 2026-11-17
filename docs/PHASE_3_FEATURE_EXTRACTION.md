# Courtside 1.7 — Phase 3: Live Alerts & Data Log extraction

This phase has split two feature systems into dedicated development files **without changing their executable code or execution order**. The final compiled HTML must still match the 1.6.1 baseline byte for byte.

## Files

| Source file | Responsibility |
| --- | --- |
| `src/features/data-log/core.js` | ESPN request instrumentation, semantic comparisons, bounded snapshots, Data Log rendering and export |
| `src/features/data-log/controls.js` | Data Log tab filter, pause, clear, export and pagination handlers |
| `src/features/live-alerts/alerts.js` | Live-score triggers, deduplication, toasts, bell/history, sounds, team picker and settings event handlers |
| `src/scripts/app.js` | Remaining application code and three insertion markers |
| `scripts/build.mjs` | Resolves these three markers in the **original** lexical order, embeds CSS, and emits one classic-script standalone HTML file |

## Integration approach and limits

These are deliberately **build-time feature fragments**, not independent browser ES modules with `import` / `export` or isolated global state yet. Their identifiers still share the original classic script's lexical scope: existing cross-feature dependencies and initialization order are retained exactly. This is the safest first modularization step; stronger module boundaries and explicit interfaces need a later separately approved change and regression tests.

**Important:** The original `src/scripts/app.js` is not directly runnable by itself after extraction. Always execute the **generated `dist/courtside.html`**, created by `npm run build`.

## Commands

```bash
npm run check:syntax
npm test
npm run verify:baseline
```

All three must pass before committing. Expected compiled file SHA-256:

`0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`

## Boundaries

- Do not change network endpoints, polling, local settings keys, or feature behavior.
- Do not change main or the frozen baseline file.
- Do not advertise this as a user-facing 1.7 release; this is an intermediate refactoring checkpoint.
- Browser regression testing still remains on the 104-item Phase 1 checklist. Byte parity alone proves the generated code is unchanged, not that live third-party sources work.
