# Courtside 1.7 — Phase 4A dependency map

**Scope:** Architecture review only. The single-file application is unchanged. All paths refer to the `refactor/modular-1.7` branch.

The current builder combines **47 build-time source fragments** into one classic browser script. These are not independent JavaScript runtime modules: all their top-level state and declarations still share the same lexical scope.

## Source ownership and coupling

| Current owner | Existing shared dependencies | Proposed future boundary |
| --- | --- | --- |
| `src/core/state.js` | `today()`, DOM helper `$()`, `settingsPrefs`; defines `state`, `viewerState` | One authoritative game store, separate viewer session state, validated preferences |
| `src/api/espn/request-scheduler.js` | `espnPoll`, `statsPoll`, backoff constants | An explicit request queue and shared rate-limit state |
| `src/api/espn/refresh-policy.js` | `state.games`, `viewerState`, ESPN poll state | Pure read-only due-time and game-phase selectors |
| `src/features/scoreboard/data.js` | `auditESPNJob`, `dataLogObserve`, `alertsObserveScoreboard`, `renderTickers`, `paintViewer`, team-directory seeding | One data pipeline delivering normalized game updates to consumers |
| `src/features/live-alerts/alerts.js` | `state`, `settingsPrefs`, game classification, viewer navigation, Settings UI | An alert engine accepting snapshots/preferences and emitting notification events |
| `src/features/data-log/core.js` | Existing ESPN audit callbacks, UI | Observe existing requests without launching independent polling |
| `src/features/viewer/controller.js` | `state.games`, `viewerState`, stream-provider caches, Game Center | Encapsulated session and iframe lifecycle, keeping stable `src` across score redraws |
| `src/features/settings/preferences.js` | `localStorage`, `$()` | Validated preference storage and safe browser-storage fallback |
| Profiles, standings and League Leaders | ESPN queue, team directory, modal navigation | Data provider plus narrowly scoped UI events |
| `src/core/polling-bootstrap.js` | ESPN/Game Center due times, visibility, viewer refresh | One poll coordinator rather than per-feature timers |

A one-time TypeScript AST **identifier scan** across 47 fragments found approximately **197 candidate cross-fragment symbol relationships**. These are *not* proven import requirements: name shadowing and local scope have not been fully resolved. Commonly referenced fragments include `core/dom.js` (32 other files), `core/state.js` (23), and `core/utils.js` (18).

## Future interfaces (design only)

1. ESPN service owns concurrency, caching, cooldown/backoff and emits normalized scoreboard updates. No extra ESPN requests are introduced by Alerts or Data Log.
2. Game store supplies read-only snapshots/selectors to Scoreboard, Viewer, Alerts and other consumers.
3. Live Alerts receives snapshots and preferences; notification delivery is injected, with a silent first-success baseline and deduplication.
4. Viewer owns its stream session and iframe URLs; ordinary score and Game Center updates must not reload a playing iframe.
5. Settings owns the existing `courtside.preferences.v1` key and validation defaults; other features receive a narrow preferences interface.
6. Presentation components consume data and emit UI intents, without owning transport or network behavior.

## Safety and migration order

**4A–4B:** map dependencies and add deterministic behavior tests; **no application source changes**.  
**4C:** assess a module-aware bundler only after test coverage is in place.  
**4D:** migrate pure utilities, release-note presentation and then preferences, one isolated interface at a time.  
**4E:** introduce normalized store, ESPN queue, alerts and scoreboard contracts.  
**4F:** convert viewer and higher-coupling UI modules, followed by full integration testing.

Preserve 10-second live-score / 15-second active Game Center / 60-second idle polling, ESPN 429 cooldown, stored settings, and stable iframe `src`. The distributed HTML must remain directly openable in Firefox with no runtime server. The frozen 1.6.1 baseline (374,363 bytes; SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`) remains the strict byte-parity guard until a separately approved intentional runtime change.

**Next architecture gate:** behavior tests, a reviewed interface design, a small single-module conversion, and rollback. No merge to `main` without approval.
