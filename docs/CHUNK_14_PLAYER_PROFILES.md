# Courtside 1.7 — Chunk 14: Player Profiles

**Branch:** `refactor/modular-1.7` only. Do not update `main` or introduce user-facing features.

Three original classic fragments become independently bundled ES module factories: `player-profile/data` (ESPN on-demand player overview/stats/gamelog, 15-minute cache, season-aware normalization and rendering), `player-profile/dialog` (modal tabs, player-to-team focus handoff, stats and game-log panels, Game Center navigation), and `player-profile/handlers` (delegated player links, sorting, retries and Escape/Tab focus). Existing public function declarations remain hoisted wrappers; core callbacks are late-bound. The player cache has exactly one owner.

The original 1.6.1 `dialog.legacy.js` remains untouched. The 1.7 Phase 4H `gameStore.navigateToDate` update was saved separately as `dialog.pre-module.js` and retained in the current factory, without reverting prior work. The data and handler fragments are preserved as exact `.legacy.js` files. The distributable is still one standalone HTML with one inline classic script and no module imports.

Required checks: syntax, Node parity, 374,363-byte frozen 1.6.1 SHA `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`, compilation, and all Chromium browser comparisons. Player-specific tests cover current-season stats, games and date normalization, TTL/dedup, dialog tabs/sort/focus, return-to-team and no iframe src writes.

**Remaining release gates:** manual live ESPN and streaming provider availability, Windows Firefox `file://`, and the 104-case checklist. No merge to `main` without separate approval.

**Next:** Chunk 15 — the final three League Leaders fragments; then full integration review.
