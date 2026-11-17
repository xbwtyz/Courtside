import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { build } from '../scripts/build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const expectedSha256 = '0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e';

test('Phase 2 build reproduces the untouched 1.6.1 file byte for byte', async () => {
  const result = await build({ verifyBaseline: true });
  const original = await readFile(join(root, 'baseline/courtside_1.6.1.html'));
  const generated = await readFile(result.path);
  assert.ok(generated.equals(original));
  assert.equal(generated.length, 374363);
  assert.equal(result.sha256, expectedSha256);
  assert.equal(createHash('sha256').update(original).digest('hex'), expectedSha256);
});

test('Final artifact contains inlined CSS and JS, not source placeholders or module imports', async () => {
  const result = await build();
  const html = await readFile(result.path, 'utf8');
  assert.equal((html.match(/<style\b/gi) || []).length, 1);
  assert.equal((html.match(/<script\b/gi) || []).length, 1);
  assert.doesNotMatch(html, /__COURTSIDE_INLINE_(?:STYLES|SCRIPT)__/);
  assert.doesNotMatch(html, /<script[^>]+\bsrc\s*=/i);
  assert.doesNotMatch(html, /<script[^>]+\btype\s*=\s*["']module/i);
  assert.match(html, /Courtside 1\.6\.1/);
});


test('Phase 3 extracts both features into named source files without changing their behavior', async () => {
  const host = await readFile(join(root, 'src/scripts/app.js'), 'utf8');
  const parts = [
    ['/*__COURTSIDE_DATA_LOG_CORE__*/', 'src/features/data-log/core.js', 'function dataLogCompare('],
    ['/*__COURTSIDE_LIVE_ALERTS__*/', 'src/features/live-alerts/alerts.js', 'function alertsObserveScoreboard('],
    ['/*__COURTSIDE_DATA_LOG_CONTROLS__*/', 'src/features/data-log/controls.js', "$('dataLogExport').addEventListener"],
  ];
  for (const [marker, path, expected] of parts) {
    assert.equal(host.split(marker).length - 1, 1, `${marker} should appear once`);
    const text = await readFile(join(root, path), 'utf8');
    assert.ok(text.includes(expected), `${path} should contain ${expected}`);
  }
});

test('The generated browser script parses without adding import or export statements', async () => {
  const result = await build({ verifyBaseline: true });
  const html = await readFile(result.path, 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'Classic application script should remain inline');
  assert.doesNotMatch(match[1], /__COURTSIDE_(?:DATA_LOG|LIVE_ALERTS)_/);
  assert.doesNotMatch(match[1], /(^|\n)\s*(?:import\s|export\s)/);
  assert.doesNotThrow(() => new Script(match[1]));
});


test('Build reconstitutes source fragments at exact original positions', async () => {
  const result = await build({verifyBaseline:true});
  const original = await readFile(join(root,'baseline/courtside_1.6.1.html'));
  const output = await readFile(result.path);
  assert.ok(output.equals(original));
});


test('Phase 3B ESPN, scoreboard and ticker fragments have exactly one insertion point each', async () => {
  const app = await readFile(join(root, 'src/scripts/app.js'), 'utf8');
  const paths = [
    ['ESPN_SCOREBOARD_ENDPOINT','src/api/espn/endpoint.js'],
    ['ESPN_CONFIG','src/api/espn/config.js'],
    ['ESPN_REQUEST_SCHEDULER','src/api/espn/request-scheduler.js'],
    ['ESPN_REFRESH_POLICY','src/api/espn/refresh-policy.js'],
    ['ESPN_GAME_SUMMARY','src/api/espn/game-summary.js'],
    ['SCOREBOARD_DATA','src/features/scoreboard/data.js'],
    ['SCOREBOARD_RENDER','src/features/scoreboard/render.js'],
    ['SCOREBOARD_CARD_CONTROLS','src/features/scoreboard/card-controls.js'],
    ['SCOREBOARD_NAVIGATION','src/features/scoreboard/navigation.js'],
    ['TICKER_CONTROLLER','src/features/ticker/controller.js'],
    ['TICKER_CLICKS','src/features/ticker/clicks.js'],
  ];
  for (const [name,path] of paths) {
    const marker = `/*__COURTSIDE_${name}__*/`;
    assert.equal(app.split(marker).length-1,1, `Expected one ${name} marker`);
    const section=await readFile(join(root,path),'utf8');
    assert.ok(section.length>15,`Empty feature fragment: ${path}`);
  }
  const result = await build({verifyBaseline:true});
  const output=await readFile(result.path,'utf8');
  for (const [name] of paths) assert.ok(!output.includes(`/*__COURTSIDE_${name}__*/`));
});


test('Phase 3C stage 1 feature files reconstruct at unique marker positions', async () => {
  const app=await readFile(join(root,'src/scripts/app.js'),'utf8');
  for(const [name,path] of [['GAME_CENTER_BOX_SCORE', 'src/features/game-center/box-score.js'], ['GAME_CENTER_CHARTS', 'src/features/game-center/charts.js'], ['GAME_CENTER_RENDER', 'src/features/game-center/render.js'], ['GAME_CENTER_CONTROLLER', 'src/features/game-center/controller.js'], ['GAME_CENTER_HANDLERS', 'src/features/game-center/handlers.js']]){
    const marker = `/*__COURTSIDE_${name}__*/`;
    assert.equal(app.split(marker).length-1,1,marker);
    const source=await readFile(join(root,path),'utf8');
    assert.ok(source.length>30,path);
  }
  const result=await build({verifyBaseline:true});
  assert.ok((await readFile(result.path)).equals(await readFile(join(root,'baseline/courtside_1.6.1.html'))));
});


test('Phase 3C stage 2 feature files reconstruct at unique marker positions', async () => {
  const app=await readFile(join(root,'src/scripts/app.js'),'utf8');
  for(const [name,path] of [['STANDINGS', 'src/features/standings/standings.js'], ['TEAM_PROFILE', 'src/features/team-profile/profile.js'], ['TEAM_PROFILE_HANDLERS', 'src/features/team-profile/handlers.js']]){
    const marker = `/*__COURTSIDE_${name}__*/`;
    assert.equal(app.split(marker).length-1,1,marker);
    const source=await readFile(join(root,path),'utf8');
    assert.ok(source.length>30,path);
  }
  const result=await build({verifyBaseline:true});
  assert.ok((await readFile(result.path)).equals(await readFile(join(root,'baseline/courtside_1.6.1.html'))));
});


test('Phase 3C stage 3 feature files reconstruct at unique marker positions', async () => {
  const app=await readFile(join(root,'src/scripts/app.js'),'utf8');
  for(const [name,path] of [['PLAYER_PROFILE_DATA', 'src/features/player-profile/data.js'], ['PLAYER_PROFILE_DIALOG', 'src/features/player-profile/dialog.js'], ['PLAYER_PROFILE_HANDLERS', 'src/features/player-profile/handlers.js'], ['LEAGUE_LEADERS_DATA', 'src/features/league-leaders/data.js'], ['LEAGUE_LEADERS_RENDER', 'src/features/league-leaders/render.js'], ['LEAGUE_LEADERS_HANDLERS', 'src/features/league-leaders/handlers.js']]){
    const marker = `/*__COURTSIDE_${name}__*/`;
    assert.equal(app.split(marker).length-1,1,marker);
    const source=await readFile(join(root,path),'utf8');
    assert.ok(source.length>30,path);
  }
  const result=await build({verifyBaseline:true});
  assert.ok((await readFile(result.path)).equals(await readFile(join(root,'baseline/courtside_1.6.1.html'))));
});


test('Phase 3D stage 1 modular source files reconstruct at unique markers', async () => {
  const app=await readFile(join(root,'src/scripts/app.js'),'utf8');
  for(const [name,path] of [['STREAM_PROVIDERS_CONFIG', 'src/api/streams/config.js'], ['STREAM_PROVIDERS_REQUESTS', 'src/api/streams/requests.js'], ['STREAM_PROVIDERS_MATCHING', 'src/api/streams/matching.js'], ['VIEWER_TITLE', 'src/features/viewer/title.js'], ['VIEWER_CONTROLLER', 'src/features/viewer/controller.js'], ['VIEWER_CONTROLS', 'src/features/viewer/controls.js'], ['VIEWER_KEYBOARD', 'src/features/viewer/keyboard.js']]){
    const marker = `/*__COURTSIDE_${name}__*/`;
    assert.equal(app.split(marker).length-1,1,marker);
    const source=await readFile(join(root,path),'utf8');
    assert.ok(source.length>30,path);
  }
  const result=await build({verifyBaseline:true});
  assert.ok((await readFile(result.path)).equals(await readFile(join(root,'baseline/courtside_1.6.1.html'))));
});


test('Phase 3D stage 2 modular source files reconstruct at unique markers', async () => {
  const app=await readFile(join(root,'src/scripts/app.js'),'utf8');
  for(const [name,path] of [['PREFERENCES', 'src/features/settings/preferences.js'], ['CORE_UTILS', 'src/core/utils.js'], ['CORE_STATE', 'src/core/state.js'], ['SETTINGS_SHORTCUT', 'src/features/settings/shortcut.js'], ['WHATS_NEW_RELEASES', 'src/features/whats-new/releases.js'], ['WHATS_NEW_CONTROLLER', 'src/features/whats-new/controller.js'], ['SETTINGS_DIALOG', 'src/features/settings/dialog.js'], ['SETTINGS_INITIALIZATION', 'src/features/settings/initialization.js']]){
    const marker = `/*__COURTSIDE_${name}__*/`;
    assert.equal(app.split(marker).length-1,1,marker);
    const source=await readFile(join(root,path),'utf8');
    assert.ok(source.length>30,path);
  }
  const result=await build({verifyBaseline:true});
  assert.ok((await readFile(result.path)).equals(await readFile(join(root,'baseline/courtside_1.6.1.html'))));
});


test('Phase 3D stage 3 modular source files reconstruct at unique markers', async () => {
  const app=await readFile(join(root,'src/scripts/app.js'),'utf8');
  for(const [name,path] of [['CORE_DOM', 'src/core/dom.js'], ['MAIN_NAVIGATION', 'src/core/main-navigation.js'], ['CORE_POLLING_BOOTSTRAP', 'src/core/polling-bootstrap.js'], ['STAT_GLOSSARY', 'src/features/stat-glossary/glossary.js']]){
    const marker = `/*__COURTSIDE_${name}__*/`;
    assert.equal(app.split(marker).length-1,1,marker);
    const source=await readFile(join(root,path),'utf8');
    assert.ok(source.length>30,path);
  }
  const result=await build({verifyBaseline:true});
  assert.ok((await readFile(result.path)).equals(await readFile(join(root,'baseline/courtside_1.6.1.html'))));
});
