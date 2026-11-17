import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const cssMarker = '__COURTSIDE_INLINE_STYLES__';
const jsMarker = '__COURTSIDE_INLINE_SCRIPT__';
const target = join(root, 'dist', 'courtside.html');
// Feature fragments are concatenated back into the original classic script scope.
// This maintains exact execution order and does NOT require runtime ES module loading.
const featureFragments = [
  ['/*__COURTSIDE_ESPN_SCOREBOARD_ENDPOINT__*/', 'src/api/espn/endpoint.js'],
  ['/*__COURTSIDE_STREAM_PROVIDERS_CONFIG__*/', 'src/api/streams/config.js'],
  ['/*__COURTSIDE_DATA_LOG_CORE__*/', 'src/features/data-log/core.js'],
  ['/*__COURTSIDE_LIVE_ALERTS__*/', 'src/features/live-alerts/alerts.js'],
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
  ['/*__COURTSIDE_SCOREBOARD_CARD_CONTROLS__*/', 'src/features/scoreboard/card-controls.js'],
  ['/*__COURTSIDE_VIEWER_CONTROLS__*/', 'src/features/viewer/controls.js'],
  ['/*__COURTSIDE_GAME_CENTER_HANDLERS__*/', 'src/features/game-center/handlers.js'],
  ['/*__COURTSIDE_TICKER_CLICKS__*/', 'src/features/ticker/clicks.js'],
  ['/*__COURTSIDE_VIEWER_KEYBOARD__*/', 'src/features/viewer/keyboard.js'],
  ['/*__COURTSIDE_SCOREBOARD_NAVIGATION__*/', 'src/features/scoreboard/navigation.js'],
  ['/*__COURTSIDE_PLAYER_PROFILE_DATA__*/', 'src/features/player-profile/data.js'],
  ['/*__COURTSIDE_PLAYER_PROFILE_DIALOG__*/', 'src/features/player-profile/dialog.js'],
  ['/*__COURTSIDE_PLAYER_PROFILE_HANDLERS__*/', 'src/features/player-profile/handlers.js'],
  ['/*__COURTSIDE_LEAGUE_LEADERS_DATA__*/', 'src/features/league-leaders/data.js'],
  ['/*__COURTSIDE_LEAGUE_LEADERS_RENDER__*/', 'src/features/league-leaders/render.js'],
  ['/*__COURTSIDE_LEAGUE_LEADERS_HANDLERS__*/', 'src/features/league-leaders/handlers.js'],
  ['/*__COURTSIDE_DATA_LOG_CONTROLS__*/', 'src/features/data-log/controls.js'],
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
    const fragment = await readFile(join(root, sourcePath), 'utf8');
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
  await writeFile(target, output);
  return { path: target, bytes: output.length, sha256: createHash('sha256').update(output).digest('hex') };
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
