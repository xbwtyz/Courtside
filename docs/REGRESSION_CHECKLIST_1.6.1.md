# Courtside 1.7 — Phase 1 regression checklist

> **Status:** Checklist prepared; tests are **not yet executed**. Every checkbox starts unchecked.
>
> **Purpose:** Preserve the behavior of the released Courtside 1.6.1 application while modularizing its *source*. The distributed product must remain a single standalone HTML file.
>
> **Reference source:** `baseline/courtside_1.6.1.html` on `refactor/modular-1.7`. This reference is an **exact, unmodified copy** of the 1.6.1 artifact, not the older `courtside.html` currently on `main`.
>
> **Reference verification:** 374,363 bytes (UTF-8); 4,913 lines; SHA-256 `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`; Git blob SHA-1 `4246dbc9032b3f3e2c70a21c60304a613394f808`.
>
> **Sources:** Direct inspection of the complete Courtside 1.6.1 HTML, including settings, markup, providers, data pipeline, and embedded release notes. Earlier release history in the app contains explicitly reconstructed entries; do not treat them as independent proof of the corresponding release code.

## A. Build and compatibility contract

- [ ] Modular development source builds into **one** self-contained `.html` file; no runtime JS/CSS imports or companion assets are required.
- [ ] Generated HTML works when opened with `file://` in Firefox, without a local web server.
- [ ] Generated HTML also works over a normal HTTP(S) origin.
- [ ] No framework, background service, backend, account, API key, or install step becomes necessary for end users.
- [ ] No unauthorized external CDN dependency is introduced; verify existing Google Fonts graceful fallback.
- [ ] Current embedded application markup, accessibility structure, layout, and navigation are preserved.
- [ ] Page version, Settings footer version, and JSON Data Log export version agree on release number.
- [ ] Original 1.6.1 reference is never modified; GitHub `main` remains untouched until a separately approved merge.

## B. Scoreboard and navigation

- [ ] Scores, Standings, League Leaders and Data Log tabs all open and preserve accessible tab semantics.
- [ ] Selecting a date, previous/next day, or Today updates games for the selected local date.
- [ ] Team search filters visible game cards without corrupting the cached scoreboard.
- [ ] Live Only toggle works and its startup default follows settings.
- [ ] Game counts distinguish total, live, upcoming and final.
- [ ] Scheduled, live, halftime, final and postponed/unusual game states render sensibly.
- [ ] Scoreboard cards, logos and scores update without unnecessary DOM replacement or focus disruption.
- [ ] Main ticker supports normal movement, pause/resume, dragging, touch, keyboard, and clicking a matchup.
- [ ] Viewer ticker supports corresponding scrolling and game-selection behavior independently.
- [ ] Refresh button and refresh diagnostics operate without duplicate request storms.
- [ ] Times are displayed in the device's local time zone.

## C. ESPN requests, scheduler and resilience

- [ ] ESPN scoreboard requests use the same endpoint(s), response mapping and request parameters as 1.6.1.
- [ ] Normal live scoreboard polling remains **10 seconds**; selected live Game Center remains **15 seconds**; idle polling remains **60 seconds**.
- [ ] Only appropriate active-tab/current-date data is polled; automatic polling pauses in hidden tabs and completed historical dates as in 1.6.1.
- [ ] ESPN scheduler honors request priorities, deduplication, in-flight work and caching.
- [ ] 429 / `Retry-After`, failures, unavailable responses and recovered connections do not cause runaway retry loops.
- [ ] Revisiting tabs uses valid caches where appropriate rather than issuing redundant requests.
- [ ] Data Log and Live Alerts observe existing ESPN responses; **neither generates additional ESPN requests**.
- [ ] Missing/partial ESPN fields render honest empty states instead of fabricated statistics or fatal errors.

## D. Stream viewer and provider matching

- [ ] AuraSports, PPV.st/PPV.to and Matchora listings retain their existing integrations and fallback behavior.
- [ ] Available PPV.st source remains preferred when applicable; manual source changes are retained.
- [ ] Stream indexes retain existing caching/refresh behavior (baseline: roughly two-minute source-index TTLs).
- [ ] Opening a game launches the existing viewer and offers valid available sources, with a safe empty state otherwise.
- [ ] Viewer layouts switch correctly among **1 / 2 / 4** independent video panels.
- [ ] Each panel retains independently selectable game and stream source, with stats tied to the active panel.
- [ ] Stream URLs are not regenerated or changed by routine scoreboard/stats refreshes.
- [ ] Theater mode, stats-sidebar toggle, viewer ticker toggle, retry-source control, and open-in-new-tab action work.
- [ ] Escape, close control, backdrop and focus behavior correctly dismiss the viewer.
- [ ] Closing the viewer unloads embedded frames.
- [ ] Cross-origin iframe audio and embeds continue to use native provider/browser controls; never claim programmatic volume control is available.
- [ ] Resizing to mobile, tablet, desktop and ultrawide widths preserves accessible controls and avoids unusable overflow.

## E. Game Center and charts

- [ ] Game Center **Overview** renders status, scoring overview and period/quarter information where supplied.
- [ ] **Box Score** renders teams, starters, bench, DNP groups and available individual stats correctly.
- [ ] Compact and wide box-score tables and sortable headings work, including missing-value handling.
- [ ] **Team Stats** renders shooting, rebounding, assists and other available team comparisons.
- [ ] **Charts** supports Lead, Shots and Win Probability views with appropriate loading and empty states.
- [ ] Play and shot inspection links the correct time, team/player and event; no fabricated coordinates or score history.
- [ ] Overtime and missing/incomplete play-by-play data do not break charts.
- [ ] Game Center controls never seek/restart a video merely because the user changes a statistics tab.

## F. Standings, team and player profiles

- [ ] East/West standings display ranks, wins/losses, and available records accurately.
- [ ] Standings refresh and navigation to a team profile work.
- [ ] Team Profile **Overview / Roster / Schedule** work with their expected navigation and loading states.
- [ ] Player Profile **Overview / Game Log / Season Stats** load current-season data where ESPN provides it.
- [ ] Player names in box scores, rosters and leaderboards open the correct profile.
- [ ] Player Game Log links navigate to the intended game/Game Center.
- [ ] Profile dialog layering, keyboard dismissal, focus return and open-stream preservation remain intact.

## G. League Leaders

- [ ] Six category selectors remain available: scoring, shooting, playmaking, rebounding, defense and general.
- [ ] ESPN pagination and existing on-demand request/caching policy are preserved.
- [ ] Metric selection, team, position, games played, minutes and shooting-volume qualification filters work.
- [ ] Custom thresholds, player search, clearing filters and table sorting work.
- [ ] Rows-per-page selection and pagination produce stable, consistent results.
- [ ] Player detail navigation works without interrupting other views.
- [ ] Disclosures remain clear: ESPN-ranked data may not include every NBA player.

## H. Live Alerts (introduced in 1.6)

- [ ] Master alerts switch defaults **Off**; all-team monitoring is the default.
- [ ] Selected-team search and multiple selection cover all 30 NBA teams; an empty selection produces no alerts.
- [ ] Game Started defaults **On**, triggers once for observed scheduled-to-live transition.
- [ ] Halftime defaults **Off**, requires ESPN-reported halftime, triggers once per game.
- [ ] Final defaults **On**, triggers once on observed live-to-final transition.
- [ ] Lead Change defaults **Off**, only applies in Q4/overtime, excludes ties as events and enforces a 60-second per-game cooldown.
- [ ] Close Game defaults **On**, requires score gap ≤3 and ≤2:00 remaining in Q4/overtime, at most once per period.
- [ ] First successful response is a silent baseline; stale/failed responses and background-tab resumes do not replay missed events.
- [ ] Monitoring follows today's scoreboard date and active tab without causing background polling.
- [ ] Toasts limit simultaneous visibility to 3; dismiss, auto-timeout and hover-pause work.
- [ ] Bell and last-50-items session history work in the main header and viewer.
- [ ] Optional original two-tone sound, low/medium/high volume and Test Sound respect browser autoplay limits.
- [ ] Video overlay defaults Off to avoid spoilers; alerts still enter history and do not start/change videos automatically.
- [ ] Click-to-view a game requires an intentional action, especially if an existing stream would be replaced.

## I. Data Log and performance (1.5.5–1.5.6)

- [ ] Data Log captures **ESPN requests only**, including timing, status, outcomes and source context.
- [ ] Bounded in-memory history remains at 2,000 entries with filtering, search, details, pause/resume, clear and JSON export.
- [ ] Stable IDs and field-level diffs distinguish baseline, changed, unchanged and error outcomes.
- [ ] Responses that lack complete data or encounter failures cannot invent false changes.
- [ ] Semantic comparison snapshots respect baseline caps: 96 scopes, 8,000 records and approximately 3 MiB text budget.
- [ ] Snapshot eviction causes a fresh baseline instead of a false change.
- [ ] Visible log rendering uses optimized row reconciliation and approximately 250 ms coalescing, not full rerender on each ESPN response.
- [ ] Settings → Data & Refresh displays request and Data Log performance diagnostics.
- [ ] Pausing/clearing log does not stop ESPN polling or interrupt video, and log export does not leak raw streaming URLs.

## J. Preferences, What's New and accessibility

- [ ] Settings opens from the main header and viewer, with working tabs and focus/escape handling.
- [ ] General, Score Ticker, Viewer & Game Center, League Leaders, Live Alerts, and Data & Refresh settings still function.
- [ ] Saved preferences continue reading the existing `courtside.preferences.v1` storage key without resetting user choices.
- [ ] Browser-storage failures degrade gracefully to session preferences.
- [ ] Startup page, Live Only, ticker speed/visibility, leaderboard category/page size, default Game Center tab, viewer layout/sidebar/ticker defaults work.
- [ ] Preferences for *next viewer open* never alter a currently playing stream unexpectedly.
- [ ] Restore Defaults produces documented defaults and does not corrupt other saved keys.
- [ ] What's New shows **16 selectable milestones**, versions 1.0 through 1.6, plus the explanatory v1.6.1 banner.
- [ ] Dropdown and Older/Newer navigation update one release's notes at a time and preserve keyboard/focus behavior.
- [ ] Historical caveats remain visible for reconstructed early releases; do not falsely attribute the original intro versions for full box scores or charts.
- [ ] Unread-release marker and last-selected version persist via existing version-specific storage keys.
- [ ] Main, viewer, modal and settings controls remain usable by keyboard and at narrow/mobile widths.

## K. Regression test execution and sign-off

- [ ] Establish deterministic fixtures for upcoming/live/half/final/overtime scoreboards, Game Center, standings, profile and leader data.
- [ ] Record baseline browser/API request counts and timing behavior for comparison with modular output.
- [ ] Run pure-function tests for score normalization, alert transitions, statistics and data comparisons.
- [ ] Run integrated mocked-ESPN/browser checks for major screens and interactions.
- [ ] Validate generated HTML syntax and check for console/runtime errors.
- [ ] Open generated HTML as a **local file in Firefox**; personally validate live requests and streaming/provider constraints where permitted.
- [ ] Compare generated HTML with the unmodified 1.6.1 baseline and log every intentional difference.
- [ ] Attach final test results to the proposed pull request and request separate approval before merging into `main`.

## Phase boundaries

- **Phase 1:** Preserve 1.6.1 reference and this checklist on the `refactor/modular-1.7` branch. No application refactoring, build system or main-branch edits.
- **Phase 2 (requires separate approval):** Introduce development folder layout and build tooling, prove parity for one-file output.
- **Phase 3 onward:** Extract features incrementally and test against this checklist.

**Note:** This is a *test plan*, not a claim that the features have already been verified in Firefox or against live third-party providers.
