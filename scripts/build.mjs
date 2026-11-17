import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { build as bundleJavaScript } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const cssMarker = '__COURTSIDE_INLINE_STYLES__';
const jsMarker = '__COURTSIDE_INLINE_SCRIPT__';
const target = join(root, 'dist', 'courtside.html');
// Migrated features are real ES modules at build time. Only their compiled
// browser IIFEs are placed back into the original classic-script positions.
const bundledFeatures = new Map([
  ['src/features/game-center/box-score.js', {
    entry: join(root, 'src/features/game-center/box-score.entry.mjs'),
    name: 'CourtsideGameCenterBoxScore',
    legacy: 'src/features/game-center/box-score.legacy.js',
  }],
  ['src/features/game-center/charts.js', {
    entry: join(root, 'src/features/game-center/charts.entry.mjs'),
    name: 'CourtsideGameCenterCharts',
    legacy: 'src/features/game-center/charts.legacy.js',
  }],
  ['src/features/game-center/render.js', {
    entry: join(root, 'src/features/game-center/render.entry.mjs'),
    name: 'CourtsideGameCenterRender',
    legacy: 'src/features/game-center/render.legacy.js',
  }],
  ['src/features/scoreboard/data.js', {
    entry: join(root, 'src/features/scoreboard/data.entry.mjs'),
    name: 'CourtsideScoreboardData',
    legacy: 'src/features/scoreboard/data.legacy.js',
  }],
  ['src/features/scoreboard/render.js', {
    entry: join(root, 'src/features/scoreboard/render.entry.mjs'),
    name: 'CourtsideScoreboardRender',
    legacy: 'src/features/scoreboard/render.legacy.js',
  }],
  ['src/features/scoreboard/card-controls.js', {
    entry: join(root, 'src/features/scoreboard/card-controls.entry.mjs'),
    name: 'CourtsideScoreboardCardControls',
    legacy: 'src/features/scoreboard/card-controls.legacy.js',
  }],
  ['src/features/scoreboard/navigation.js', {
    entry: join(root, 'src/features/scoreboard/navigation.entry.mjs'),
    name: 'CourtsideScoreboardNavigation',
    legacy: 'src/features/scoreboard/navigation.legacy.js',
  }],
  ['src/features/ticker/controller.js', {
    entry: join(root, 'src/features/ticker/controller.entry.mjs'),
    name: 'CourtsideTickerController',
    legacy: 'src/features/ticker/controller.legacy.js',
  }],
  ['src/features/viewer/controller.js', {
    entry: join(root, 'src/features/viewer/controller.entry.mjs'),
    name: 'CourtsideViewerController',
    legacy: 'src/features/viewer/controller.legacy.js',
  }],
  ['src/features/viewer/title.js', {
    entry: join(root, 'src/features/viewer/title.entry.mjs'),
    name: 'CourtsideViewerTitle',
    legacy: 'src/features/viewer/title.legacy.js',
  }],
  ['src/features/viewer/controls.js', {
    entry: join(root, 'src/features/viewer/controls.entry.mjs'),
    name: 'CourtsideViewerControls',
    legacy: 'src/features/viewer/controls.legacy.js',
  }],
  ['src/features/viewer/keyboard.js', {
    entry: join(root, 'src/features/viewer/keyboard.entry.mjs'),
    name: 'CourtsideViewerKeyboard',
    legacy: 'src/features/viewer/keyboard.legacy.js',
  }],
  ['src/features/ticker/clicks.js', {
    entry: join(root, 'src/features/ticker/clicks.entry.mjs'),
    name: 'CourtsideTickerClicks',
    legacy: 'src/features/ticker/clicks.legacy.js',
  }],
  ['src/core/main-navigation.js', {
    entry: join(root, 'src/core/main-navigation.entry.mjs'),
    name: 'CourtsideMainNavigation',
    legacy: 'src/core/main-navigation.legacy.js',
  }],
  ['src/api/streams/config.js', {
    entry: join(root, 'src/api/streams/config.entry.mjs'),
    name: 'CourtsideStreamConfig',
    legacy: 'src/api/streams/config.legacy.js',
  }],
  ['src/api/streams/requests.js', {
    entry: join(root, 'src/api/streams/requests.entry.mjs'),
    name: 'CourtsideStreamRequests',
    legacy: 'src/api/streams/requests.legacy.js',
  }],
  ['src/api/streams/matching.js', {
    entry: join(root, 'src/api/streams/matching.entry.mjs'),
    name: 'CourtsideStreamMatching',
    legacy: 'src/api/streams/matching.legacy.js',
  }],
  ['src/features/live-alerts/alerts.js', {
    entry: join(root, 'src/features/live-alerts/alerts.entry.mjs'),
    name: 'CourtsideLiveAlerts',
    legacy: 'src/features/live-alerts/alerts.legacy.js',
  }],
  ['src/features/data-log/core.js', {
    entry: join(root, 'src/features/data-log/core.entry.mjs'),
    name: 'CourtsideDataLogCore',
    legacy: 'src/features/data-log/core.legacy.js',
  }],
  ['src/features/data-log/controls.js', {
    entry: join(root, 'src/features/data-log/controls.entry.mjs'),
    name: 'CourtsideDataLogControls',
    legacy: 'src/features/data-log/controls.legacy.js',
  }],
  ['src/features/settings/preferences.js', {
    entry: join(root, 'src/features/settings/preferences.entry.mjs'),
    name: 'CourtsideSettingsPreferences',
    legacy: 'src/features/settings/preferences.legacy.js',
  }],
  ['src/features/settings/shortcut.js', {
    entry: join(root, 'src/features/settings/shortcut.entry.mjs'),
    name: 'CourtsideSettingsShortcut',
    legacy: 'src/features/settings/shortcut.legacy.js',
  }],
  ['src/features/settings/dialog.js', {
    entry: join(root, 'src/features/settings/dialog.entry.mjs'),
    name: 'CourtsideSettingsDialog',
    legacy: 'src/features/settings/dialog.legacy.js',
  }],
  ['src/features/settings/initialization.js', {
    entry: join(root, 'src/features/settings/initialization.entry.mjs'),
    name: 'CourtsideSettingsInitialization',
    legacy: 'src/features/settings/initialization.legacy.js',
  }],
  ['src/features/whats-new/releases.js', {
    entry: join(root, 'src/features/whats-new/releases.entry.mjs'),
    name: 'CourtsideWhatsNewReleases',
    legacy: 'src/features/whats-new/releases.legacy.js',
  }],
  ['src/api/espn/endpoint.js', {
    entry: join(root, 'src/api/espn/endpoint.entry.mjs'),
    name: 'CourtsideEspnEndpoints',
    legacy: 'src/api/espn/endpoint.legacy.js',
  }],
  ['src/core/dom.js', {
    entry: join(root, 'src/core/dom.entry.mjs'),
    name: 'CourtsideDom',
    legacy: 'src/core/dom.legacy.js',
  }],
  ['src/api/espn/config.js', {
    entry: join(root, 'src/api/espn/config.entry.mjs'),
    name: 'CourtsideEspnConfig',
    legacy: 'src/api/espn/config.legacy.js',
  }],
  ['src/api/espn/refresh-policy.js', {
    entry: join(root, 'src/api/espn/refresh-policy.entry.mjs'),
    name: 'CourtsideEspnRefreshPolicy',
    legacy: 'src/api/espn/refresh-policy.legacy.js',
  }],
  ['src/core/polling-bootstrap.js', {
    entry: join(root, 'src/core/polling.entry.mjs'),
    name: 'CourtsidePollCoordinator',
    legacy: 'src/core/polling-bootstrap.legacy.js',
  }],
  ['src/core/state.js', {
    entry: join(root, 'src/core/game-store.entry.mjs'),
    name: 'CourtsideGameStore',
    legacy: 'src/core/state.legacy.js',
  }],
  ['src/api/espn/request-scheduler.js', {
    entry: join(root, 'src/api/espn/request-scheduler.entry.mjs'),
    name: 'CourtsideEspnScheduler',
    legacy: 'src/api/espn/request-scheduler.legacy.js',
  }],
  ['src/core/utils.js', {
    entry: join(root, 'src/core/entry.mjs'),
    name: 'CourtsideCoreUtils',
    legacy: 'src/core/utils.legacy.js',
  }],
  ['src/features/whats-new/controller.js', {
    entry: join(root, 'src/features/whats-new/entry.mjs'),
    name: 'CourtsideWhatsNew',
    legacy: 'src/features/whats-new/controller.legacy.js',
  }],
  ['src/features/stat-glossary/glossary.js', {
    entry: join(root, 'src/features/stat-glossary/entry.mjs'),
    name: 'CourtsideStatGlossary',
    legacy: 'src/features/stat-glossary/glossary.legacy.js',
  }],
]);

// Legacy byte-parity reconstruction also replaces the three migrated consumers.
const legacyFragmentOverrides = new Map([
  ['src/features/scoreboard/data.js', 'src/features/scoreboard/data.legacy.js'],
  ['src/features/player-profile/dialog.js', 'src/features/player-profile/dialog.legacy.js'],
  ['src/features/game-center/controller.js', 'src/features/game-center/controller.legacy.js'],
]);

async function buildFeatureBundle(feature) {
  const result = await bundleJavaScript({
    entryPoints: [feature.entry],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: feature.name,
    target: ['es2020'],
    write: false,
    outfile: 'courtside-feature.js',
    sourcemap: false,
    minify: false,
    legalComments: 'none',
    logLevel: 'silent',
    charset: 'utf8',
  });
  if (result.outputFiles?.length !== 1 || !result.outputFiles[0].text) {
    throw new Error(`esbuild did not produce one ${feature.name} browser bundle`);
  }
  return result.outputFiles[0].text;
}
// Feature fragments are concatenated back into the original classic script scope.
// This maintains exact execution order and does NOT require runtime ES module loading.
const featureFragments = [
  ['/*__COURTSIDE_ESPN_SCOREBOARD_ENDPOINT__*/', 'src/api/espn/endpoint.js'],
  ['/*__COURTSIDE_STREAM_PROVIDERS_CONFIG__*/', 'src/api/streams/config.js'],
  ['/*__COURTSIDE_CORE_DOM__*/', 'src/core/dom.js'],
  ['/*__COURTSIDE_PREFERENCES__*/', 'src/features/settings/preferences.js'],
  ['/*__COURTSIDE_CORE_UTILS__*/', 'src/core/utils.js'],
  ['/*__COURTSIDE_DATA_LOG_CORE__*/', 'src/features/data-log/core.js'],
  ['/*__COURTSIDE_LIVE_ALERTS__*/', 'src/features/live-alerts/alerts.js'],
  ['/*__COURTSIDE_CORE_STATE__*/', 'src/core/state.js'],
  ['/*__COURTSIDE_ESPN_CONFIG__*/', 'src/api/espn/config.js'],
  ['/*__COURTSIDE_ESPN_REQUEST_SCHEDULER__*/', 'src/api/espn/request-scheduler.js'],
  ['/*__COURTSIDE_ESPN_REFRESH_POLICY__*/', 'src/api/espn/refresh-policy.js'],
  ['/*__COURTSIDE_STREAM_PROVIDERS_REQUESTS__*/', 'src/api/streams/requests.js'],
  ['/*__COURTSIDE_STREAM_PROVIDERS_MATCHING__*/', 'src/api/streams/matching.js'],
  ['/*__COURTSIDE_VIEWER_TITLE__*/', 'src/features/viewer/title.js'],
  ['/*__COURTSIDE_TICKER_CONTROLLER__*/', 'src/features/ticker/controller.js'],
  ['/*__COURTSIDE_VIEWER_CONTROLLER__*/', 'src/features/viewer/controller.js'],
  ['/*__COURTSIDE_GAME_CENTER_BOX_SCORE__*/', 'src/features/game-center/box-score.js'],
  ['/*__COURTSIDE_GAME_CENTER_CHARTS__*/', 'src/features/game-center/charts.js'],
  ['/*__COURTSIDE_GAME_CENTER_RENDER__*/', 'src/features/game-center/render.js'],
  ['/*__COURTSIDE_ESPN_GAME_SUMMARY__*/', 'src/api/espn/game-summary.js'],
  ['/*__COURTSIDE_GAME_CENTER_CONTROLLER__*/', 'src/features/game-center/controller.js'],
  ['/*__COURTSIDE_SCOREBOARD_DATA__*/', 'src/features/scoreboard/data.js'],
  ['/*__COURTSIDE_SCOREBOARD_RENDER__*/', 'src/features/scoreboard/render.js'],
  ['/*__COURTSIDE_STANDINGS__*/', 'src/features/standings/standings.js'],
  ['/*__COURTSIDE_TEAM_PROFILE__*/', 'src/features/team-profile/profile.js'],
  ['/*__COURTSIDE_TEAM_PROFILE_HANDLERS__*/', 'src/features/team-profile/handlers.js'],
  ['/*__COURTSIDE_MAIN_NAVIGATION__*/', 'src/core/main-navigation.js'],
  ['/*__COURTSIDE_SCOREBOARD_CARD_CONTROLS__*/', 'src/features/scoreboard/card-controls.js'],
  ['/*__COURTSIDE_VIEWER_CONTROLS__*/', 'src/features/viewer/controls.js'],
  ['/*__COURTSIDE_GAME_CENTER_HANDLERS__*/', 'src/features/game-center/handlers.js'],
  ['/*__COURTSIDE_TICKER_CLICKS__*/', 'src/features/ticker/clicks.js'],
  ['/*__COURTSIDE_VIEWER_KEYBOARD__*/', 'src/features/viewer/keyboard.js'],
  ['/*__COURTSIDE_SCOREBOARD_NAVIGATION__*/', 'src/features/scoreboard/navigation.js'],
  ['/*__COURTSIDE_SETTINGS_SHORTCUT__*/', 'src/features/settings/shortcut.js'],
  ['/*__COURTSIDE_PLAYER_PROFILE_DATA__*/', 'src/features/player-profile/data.js'],
  ['/*__COURTSIDE_PLAYER_PROFILE_DIALOG__*/', 'src/features/player-profile/dialog.js'],
  ['/*__COURTSIDE_PLAYER_PROFILE_HANDLERS__*/', 'src/features/player-profile/handlers.js'],
  ['/*__COURTSIDE_LEAGUE_LEADERS_DATA__*/', 'src/features/league-leaders/data.js'],
  ['/*__COURTSIDE_LEAGUE_LEADERS_RENDER__*/', 'src/features/league-leaders/render.js'],
  ['/*__COURTSIDE_LEAGUE_LEADERS_HANDLERS__*/', 'src/features/league-leaders/handlers.js'],
  ['/*__COURTSIDE_WHATS_NEW_RELEASES__*/', 'src/features/whats-new/releases.js'],
  ['/*__COURTSIDE_WHATS_NEW_CONTROLLER__*/', 'src/features/whats-new/controller.js'],
  ['/*__COURTSIDE_SETTINGS_DIALOG__*/', 'src/features/settings/dialog.js'],
  ['/*__COURTSIDE_SETTINGS_INITIALIZATION__*/', 'src/features/settings/initialization.js'],
  ['/*__COURTSIDE_DATA_LOG_CONTROLS__*/', 'src/features/data-log/controls.js'],
  ['/*__COURTSIDE_CORE_POLLING_BOOTSTRAP__*/', 'src/core/polling-bootstrap.js'],
  ['/*__COURTSIDE_STAT_GLOSSARY__*/', 'src/features/stat-glossary/glossary.js'],
];

function replaceExactlyOnce(template, marker, content) {
  const first = template.indexOf(marker);
  if (first === -1 || template.indexOf(marker, first + marker.length) !== -1) {
    throw new Error('Expected exactly one occurrence of ' + marker + ' in src/index.html');
  }
  return template.replace(marker, content);
}

export async function build({ verifyBaseline = false } = {}) {
  const [template, css, js] = await Promise.all([
    readFile(join(root, 'src/index.html'), 'utf8'),
    readFile(join(root, 'src/styles/main.css'), 'utf8'),
    readFile(join(root, 'src/scripts/app.js'), 'utf8'),
  ]);
  let compiledJs = js;
  for (const [marker, sourcePath] of featureFragments) {
    let fragment = await readFile(join(root, sourcePath), 'utf8');
    if (verifyBaseline && legacyFragmentOverrides.has(sourcePath)) {
      fragment = await readFile(join(root, legacyFragmentOverrides.get(sourcePath)), 'utf8');
    }
    const feature = bundledFeatures.get(sourcePath);
    if (feature) {
      if (verifyBaseline) {
        // Frozen source: used ONLY to prove unchanged v1.6.1 output.
        fragment = await readFile(join(root, feature.legacy), 'utf8');
      } else {
        // Bundle a real ESM dependency graph; no runtime imports or servers.
        const compiledFeature = await buildFeatureBundle(feature);
        fragment = `  ${compiledFeature}\n${fragment}`;
      }
    }
    compiledJs = replaceExactlyOnce(compiledJs, marker, fragment);
  }
  const html = replaceExactlyOnce(replaceExactlyOnce(template, cssMarker, css), jsMarker, compiledJs);
  const output = Buffer.from(html, 'utf8');
  if (verifyBaseline) {
    const baseline = await readFile(join(root, 'baseline/courtside_1.6.1.html'));
    if (!output.equals(baseline)) {
      throw new Error('Build differs from the frozen 1.6.1 baseline. Stop and investigate.');
    }
  }
  await mkdir(join(root, 'dist'), { recursive: true });
  const outputPath = verifyBaseline ? join(root, 'dist', 'courtside-legacy-proof.html') : target;
  await writeFile(outputPath, output);
  return { path: outputPath, bytes: output.length, sha256: createHash('sha256').update(output).digest('hex') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await build({ verifyBaseline: process.argv.includes('--verify-baseline') });
    console.log('Built ' + result.path + ' (' + result.bytes + ' bytes; SHA-256 ' + result.sha256 + ')');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
