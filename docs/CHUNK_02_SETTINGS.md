# Courtside 1.7 — Chunk 02: Settings & Preferences

**Scope:** Development branch `refactor/modular-1.7` only; no public release or changes to `main`.

## Migrations

Five more existing build-time fragments are emitted from real ES module entry points via the existing esbuild IIFE builder:

| Fragment | ES module | Responsibility |
| --- | --- | --- |
| `src/features/settings/preferences.js` | `preferences.module.mjs` | Versioned storage key `courtside.preferences.v1`, validation/defaults, session-only fallback and ticker visibility |
| `src/features/settings/dialog.js` | `dialog.module.mjs` | Seven-tab Settings dialog, focus return, keyboard navigation, change handlers, Restore Defaults |
| `src/features/settings/shortcut.js` | `shortcut.module.mjs` | Refresh-information shortcut event binding |
| `src/features/settings/initialization.js` | `initialization.module.mjs` | Original startup initialization order and launch-tab selection |
| `src/features/whats-new/releases.js` | `releases.module.mjs` | Full 16-entry historical release data and 1.6.1 release identifier |

The original source of **every** fragment is copied exactly to the corresponding `.legacy.js` file. `npm run verify:baseline` inserts those files at the original positions and must still reproduce the exact frozen 1.6.1 reference (374,363 bytes, SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`).

### Preference compatibility bridge

Older Scores, Leaderboards, Viewer and Alerts code still mutate `settingsPrefs` directly and call `saveSettingsPrefs()`. The adapter maintains the original shared `settingsPrefs` and `settingsStorageAvailable` bindings, while storage and validation now run inside `createSettingsPreferences({$,getStorage})`. The adapter syncs the module's private preferences reference immediately before saving/applying; **Restore Defaults still replaces the legacy `settingsPrefs` object** and does not reset active streams or cached scores. The existing key, validation rules, storage-error warning, and in-session edits are unchanged.

The dialog owns its tab/focus state privately; all effects are injected by the adapter. The event handlers are registered at the original point in startup. Shortcut and initialization entry points preserve the original event registration and call order, including the delayed dialog reference in the refresh shortcut. The What's New controller receives the same release records; their content and ordering are not rewritten.

**Architectural limitation:** these are isolated module boundaries and adapters, not yet a full conversion of the remaining 32 fragments. Older features still read preferences directly and must be converted incrementally before the legacy aliases can be removed.

## Tests

Run:

```bash
npm install --no-audit --no-fund
npm run check:syntax
npm test
npm run verify:baseline
npm run build
npm run test:browser
```

- New Node fixtures compare the original and modular preferences across saved, invalid, malformed and blocked-storage cases; verify defaults, storage-key stability, release-history data, deferred shortcut registration and startup order.
- The new offline Chromium test compares original-vs-modern Settings across eleven UI states with saved storage and ten more with simulated storage denial. Coverage includes layout/Viewer defaults, ticker controls, Alerts preferences, navigation between Settings tabs, the refresh shortcut, Restore Defaults dismissal/acceptance, Escape behavior and a fresh-page restart.
- Existing Chromium checks cover the Scoreboard, Viewer iframe URL stability, What's New, glossary, formatters, Game Store and core request lifecycle.
- **No external requests are made by the offline browser suite.** Real third-party streams and live ESPN endpoints remain unverified.

GitHub Actions uses actual esbuild 0.28.2. Local diagnostics may use a test-only esbuild stand-in for assembling the standalone app. The stand-in is excluded from source distribution; only an HTML artifact retrieved from a successful GitHub Actions run is a validated preview.

## Remaining release gates

This does not complete the full 104-item regression checklist, Windows Firefox `file://` verification or live ESPN/stream-provider checks. Do not merge into `main` or publicly release 1.7 without a separate approval and go/no-go review.

**Next chunk:** Chunk 03 — Data Log (2 fragments), ensuring comparisons and UI controls do not create new network calls.
