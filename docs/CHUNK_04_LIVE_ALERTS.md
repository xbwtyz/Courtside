# Courtside 1.7 — Chunk 04: Live Alerts module

**Scope:** `refactor/modular-1.7` only. Keep `main`, user-visible alerts, request frequency, preferences storage, and stream state untouched.

## Implementation

The original `src/features/live-alerts/alerts.js` is retained byte-for-byte as `alerts.legacy.js`. The runtime engine was moved to `alerts.module.mjs`, compiled from `alerts.entry.mjs` via esbuild into the same original inline classic-script position. `alerts.js` is now an adapter that exposes exactly the same top-level names for unmigrated callers.

Instead of capturing mutable `settingsPrefs`, `state`, and `viewerState` during the early alerts bootstrap, the module receives `getPrefs`, `getState`, and `getViewerState` functions that read their *current* objects at call time. This preserves the original startup source order, Settings Restore Defaults reference replacement, and existing viewer state.

Original detection logic is otherwise unchanged: the first successful scoreboard is silent; game starts, halftime, final, late lead changes, and close game edges are detected from **already-fetched** ESPN data. The same selected-team filtering, 60-second lead cooldown, per-period close dedupe, 50-entry history cap, three visible toasts, 8-second toast timers, sound opt-in, modal focus and keyboard behavior are preserved.

## Safety and regression verification

Run:

```bash
npm run check:syntax
npm test
npm run verify:baseline
npm run build
npm run test:browser
```

- New Node tests compare the original and modern engines for baseline suppression, all transition categories, deduplication, hidden tabs, team filters, Settings handlers and late preferences replacement.
- Offline Chromium `alerts_browser_compare.py` compares history, bells, settings labels, and history open/close states against the exact 1.6.1 baseline.
- No alert-specific network request, `fetch()`, independent polling interval, or additional ESPN call is introduced.
- Baseline reconstruction still requires the frozen 374,363-byte 1.6.1 HTML and exact SHA-256.

**Release gate:** Live third-party streams, real ESPN availability, manual Firefox `file://` checks and the full 104-case manual regression checklist remain outstanding. Do not merge into `main` without separate approval.

**Next:** Chunk 05 — review the stream-provider connector (3 source fragments) before modularizing request/cache/matching behavior. The Viewer must not reload its iframe during score updates.
