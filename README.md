# Courtside

**Live NBA scores, player box scores, interactive charts, and an in-page game viewer in one HTML file.**

Courtside brings the scoreboard, the game, and the numbers into the same browser window. Follow the league, switch between available broadcasts, and explore player statistics and game history while watching.

The interface runs entirely in your browser using HTML, CSS, vanilla JavaScript, and native SVG charts. There is no build step, backend, package installation, or API key to configure.

> **Latest stable release: [Courtside v1.7.0](https://github.com/xbwtyz/Courtside/releases/tag/v1.7.0).** [Download the standalone courtside.html](https://github.com/xbwtyz/Courtside/releases/download/v1.7.0/courtside.html) and open it in your browser. An internet connection is required for scores, statistics, and external players.

## Quick start

1. Download **[courtside.html from the latest release](https://github.com/xbwtyz/Courtside/releases/download/v1.7.0/courtside.html)**. No software installation or build process is needed.
2. Open the downloaded file in a modern browser with JavaScript enabled. Keep the `.html` extension.
3. Use the date picker, team search, or **Live only** filter to find a matchup.
4. Click a game card or its **Watch** button to open the viewer.
5. Choose an available **Stream source**, then press Play inside the embedded player if needed.

Open **Game Center → Charts** for the lead graph, shot chart, and win-probability history. The **Box score** button in the viewer header opens player statistics directly.

The HTML file can have any filename when opened locally. Use `index.html` when publishing it as a website's home page.

## Features

### Follow the league

- Separate sections for live, upcoming, and completed games.
- Date navigation, a **Today** shortcut, team search, and a **Live only** filter.
- Adaptive refresh of **10 seconds for live scores** and **60 seconds when idle**; polling pauses for hidden tabs and stops on completed historical dates.
- Clickable score tickers on the scoreboard and inside the viewer.
- Game times displayed in your device's time zone.
- Expandable game-card statistics and links to ESPN Gamecast.

### Watch in the same window

- **1-, 2-, and 4-screen** viewing layouts, each with its own game and stream source.
- Stream indexes from **PPV.st**, **AuraSports**, and **Matchora**. PPV.st sources appear first when available, while valid manually selected sources are preserved.
- A live-game dropdown and previous/next buttons with wraparound navigation for the selected screen.
- Navigation arrows positioned outside the video.
- **Theater** mode and a collapsible statistics sidebar.
- **Retry lookup** to refresh provider listings and **Open stream in new tab** for an external player.
- Closing the viewer unloads its embedded player.

Routine statistical updates and chart interactions leave the selected stream URL unchanged. Switching games or choosing another source loads the new player.

## Game Center

| Tab | What it shows |
| --- | --- |
| **Overview** | Current score and game status, leading scorers, and quarter-by-quarter results when available. |
| **Box Score** | Player statistics, team selection, sortable headings, compact and wide tables, and separate starters, bench, and DNP groups. |
| **Team Stats** | Shooting percentages, rebounds, assists, turnovers, steals, and blocks for both teams. |
| **Charts** | Interactive Lead, Shots, and Win Probability views built from ESPN game history. |

### Player box scores

The compact table shows **Player, MIN, PTS, REB, AST, and +/−**. Switch to **Wide table** to add **FG, 3PT, FT, STL, BLK, TO, and PF**.

Click a column heading to sort within the starters and bench groups. Clicking it again reverses the order. Shooting columns sort by made shots. Missing values appear as a dash rather than an invented zero.

### Charts

| View | Explore |
| --- | --- |
| **Lead** | The home team's score minus the away team's score over game time. Positive values mean the home team leads; negative values mean the away team leads. |
| **Shots** | Made and missed field-goal events on a court, filtered by team, player, and quarter, including overtime. Select a mark or use **Shot details** to inspect an attempt. |
| **Win Probability** | ESPN's estimated chances for both teams, linked to the corresponding plays. The home team uses a solid line and the away team a dashed line. |

Move over a line chart, tap a moment, or use **Inspect plays** to view the associated clock, score, and play description. Chart inspection does not rewind or seek the video.

Charts support overtime, show an empty state when data is unavailable, omit unusable shot coordinates, and flag certain discrepancies between final scores and recorded play scores. Shot locations are approximate. Logged heaves can differ from official individual shot-attempt totals; use **Box Score** for official shooting statistics.

## Controls

| Action | Control |
| --- | --- |
| Open a matchup | Click its game card or **Watch**. |
| Switch games | Use the live-game menu, side arrows, or a ticker matchup. |
| Change broadcast | Choose another **Stream source**. |
| Expand the viewer | Select **Theater**. |
| Show or hide Game Center | Select **Show stats** / **Hide stats**. |
| Close the viewer | Press **Escape**, use the close button, or click the backdrop. |
| Navigate section tabs | Focus a tab and use **Left/Right Arrow**. |
| Navigate chart-view tabs | Use **Left/Right Arrow**, **Home**, or **End** while a chart tab is focused. |

## Data and updates

| Component | Source | Refresh behavior |
| --- | --- | --- |
| Scores and schedule | ESPN scoreboard feed | 10 seconds during live games; 60 seconds otherwise, with background and 429 cooldown safeguards. |
| Game Center and charts | ESPN game-summary feed | 15 seconds for selected live games with stats visible; 60 seconds for non-final idle games; final data is retained. |
| Available streams | PPV.st, AuraSports, Matchora indexes | Cached for two minutes by provider, with periodic refresh while viewing and manual **Retry lookup**. |

Periodic network refreshes pause while the document is hidden. Game-summary requests share a cache so changing statistical views does not require a separate request for each chart. If a refresh fails, previously loaded summary data can remain visible with a status message.

AuraSports entries are linked using ESPN game IDs. PPV.st basketball entries are matched against both NBA team names, with a start-time check when the provider supplies one. This helps keep unrelated basketball events out of the NBA source list.

### Configured endpoints

- [ESPN scoreboard](https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard) — scores and schedules.
- [ESPN game summary](https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary) — queried with `?event=GAME_ID` for box scores and chart data.
- [AuraSports schedule](https://aurasports.xyz/api/schedule) — NBA stream listings.
- [PPV.st streams](https://api.ppv.st/api/streams) — primary PPV index, with [PPV.to](https://api.ppv.to/api/streams) as a fallback host.
- [Matchora schedule](https://matchora.to/api/v1/schedule?watchable=1) — additional NBA schedule and stream index, with a fallback host.

These are external website feeds. Their availability, formats, and browser-access policies can change.

## Publish as a website

### GitHub Pages

1. Upload a copy of the app to your repository as **`index.html`**.
2. Open the repository's **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch**.
4. Select the branch containing the file and **`/(root)`**, then save.
5. Open the published URL shown by GitHub and check scores, statistics, and player behavior.

See [GitHub's publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

### Netlify Drop

Put `index.html` at the top level of a folder and drag that folder onto [Netlify Drop](https://app.netlify.com/drop). No app build is required. See the [Netlify Drop quickstart](https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/) for publishing and updating the site.

Hosting the file makes the interface available online. External API access and embedded playback still depend on the providers and the browser; test them from the published URL.

## Troubleshooting

| Problem | What to try or expect |
| --- | --- |
| Scores do not load | Check the connection and use the scoreboard's **Refresh** button. A browser request restriction or provider outage may prevent access. |
| No streams are listed | Check that the matchup has available broadcasts and use **Retry lookup**. A scheduled or completed game may have statistics without a stream. |
| A listed source does not play | Select another source or use **Open stream in new tab**. A source listing does not guarantee working playback. |
| Ads, popups, or overlays appear | These can come from the third-party player. This version has no built-in ad blocker or popup-protection sandbox. |
| A chart is empty | The game may not have started, or ESPN may not supply the required history, coordinates, or probabilities. |
| Chart totals differ from the box score | Event history can contain corrections or special events such as heaves. Check the official box-score values and any chart warning. |
| Updates stop in another tab | Periodic refreshes pause when the document is hidden. Return to Courtside or refresh manually. |

## Technical notes and privacy

The application consists of one HTML file containing its styles, application logic, and SVG rendering. The delivered HTML has no application backend or runtime build tooling, and uses no external JavaScript chart library. Developers use esbuild to produce this standalone artifact. Google Fonts and ESPN-hosted team logos are loaded externally.

The browser contacts ESPN, stream-index services, and embedded-player hosts directly. External players may make additional requests and use their own cookies or tracking. Running the app from a local file does not make those external services private or offline.

The scoreboard refresh interval is saved in browser `localStorage` under `courtsideRefreshInterval`. Game summaries and provider indexes are cached in memory for the current page session. Video is not downloaded or recorded by Courtside.

## Development: Courtside 1.7+ modular source

> The **downloaded HTML requires no installation, build tooling or server**. The 1.7 source on `main` uses a build-time toolchain to preserve that single-file delivery format. These steps are for contributors, not end users.

Use **Node.js 22** and the checked-in npm lockfile:

```bash
npm ci
npm run check:syntax
npm test
npm run verify:baseline
npm run build
npm run test:browser
npm run release:prepare
npm run release:verify
```

The 47 original script fragments each have one build-time entry, one compiled IIFE in the final classic script, and a frozen `.legacy.js` reference. Run `npm run test:architecture` to confirm the source inventory, shared state ownership, deterministic release-candidate hash and the exact 1.6.1 baseline. Chromium browser tests also require Python 3 with Playwright and its Chromium browser installed (see `.github/workflows/ci.yml`).

**Published v1.7.0 artifact:** 499,291 bytes, SHA-256 `c07f7066f02df59eff14d9da826ba3d8a793b8dca4bd33197c8cee7a8edc4526` (see the release preparation report). **Development output:** `dist/courtside.html`. **1.6.1 reconstruction:** `dist/courtside-legacy-proof.html`. Neither file needs to be committed. The original 1.6.1 SHA-256 is `0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e`.

**Courtside v1.7.1 is currently a maintenance candidate, not an approved public release.** The production GitHub Pages `index.html` and root `courtside.html` intentionally remain at v1.7.0 until an explicit release approval. PR CI creates an auditable candidate HTML as a downloadable Actions artifact without changing the site. To test the candidate locally, run `npm run release:prepare` and `npm run release:verify` in that order; the first command replaces only your local root `courtside.html`, not the website. Do not commit it into `main` as an ordinary maintenance change.

**Courtside v1.7.0 was released from the tested merge commit [`a79aada`](https://github.com/xbwtyz/Courtside/commit/a79aada8b743e735fa83d33e937796070b08a7a7).** The [GitHub Release](https://github.com/xbwtyz/Courtside/releases/tag/v1.7.0) contains the verified standalone HTML. To prepare an identical local distribution, run `npm run release:prepare`; to assert that committed `courtside.html` still equals a fresh build, run `npm run release:verify`. The build also supports frozen 1.6.1 output through its immutable `src/index.legacy.html` template. Six owner-run Firefox smoke checks passed; the full historical manual regression checklist remains separate. Future tags and distribution changes require separate approval. After PR review, an authorized maintainer explicitly runs **Publish approved Courtside release** on `main` with a matching version input. That workflow runs the same complete automated gates, commits matching `courtside.html` and `index.html` only as part of the approved publication, creates the release asset and tag, and explicitly requests the Pages build (workflow-token pushes alone do not trigger branch-based Pages builds). Normal PR/main CI never deploys Pages. See `docs/plans/1.7.1/MAINTENANCE_A_C.md`.

## Feedback

When reporting a problem, include your browser and version, whether you opened a local file or hosted site, the matchup and date, the selected provider/source if relevant, and the steps that reproduce the issue. Screenshots or the exact error message help distinguish a dashboard problem from a provider problem.

## Credits

Scores and statistical data come from **ESPN**. Stream listings come from **AuraSports** and **PPV.st**. The interface uses **Barlow Condensed** and **DM Sans** through Google Fonts.

Courtside is an independent project and is not affiliated with the NBA, ESPN, or the stream providers. It does not host the broadcasts. Live data may be delayed, and external playback is not guaranteed.
