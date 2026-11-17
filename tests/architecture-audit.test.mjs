import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  build, bundledFeatures, featureFragments, legacyFragmentOverrides
} from '../scripts/build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const originalSha = '0f52ad272cd3fe2259b62ad81464868573c4f1a9dbe8c37607b6bb53a243629e';
const candidateSha = 'c07f7066f02df59eff14d9da826ba3d8a793b8dca4bd33197c8cee7a8edc4526';
const read = path => readFile(join(root, path), 'utf8');

test('Architecture audit: all 47 original fragment markers are registered once and bundled once', async () => {
  assert.equal(featureFragments.length, 47);
  assert.equal(bundledFeatures.size, 47);
  const markers = featureFragments.map(([marker]) => marker);
  const sources = featureFragments.map(([, path]) => path);
  assert.equal(new Set(markers).size, 47, 'Every insertion marker must be unique');
  assert.equal(new Set(sources).size, 47, 'Every original fragment must have one insertion point');
  assert.deepEqual([...bundledFeatures.keys()].sort(), [...sources].sort());
  const host = await read('src/scripts/app.js');
  const embeddedMarkers = [...host.matchAll(/\/\*__COURTSIDE_[A-Z0-9_]+__\*\//g)].map(x => x[0]);
  assert.equal(embeddedMarkers.length, 47, 'No untracked or duplicate original host placeholders');
  assert.deepEqual([...embeddedMarkers].sort(), [...markers].sort());
  for (const [marker] of featureFragments) {
    assert.equal(host.split(marker).length - 1, 1, 'Missing or repeated ' + marker);
  }
});

test('Architecture audit: unique module entries, globals and frozen legacy paths exist', async () => {
  const entries = new Set(), names = new Set(), legacy = new Set();
  const entryCount = 47;
  for (const [path, feature] of bundledFeatures) {
    assert.ok(path.startsWith('src/') && path.endsWith('.js'), 'Invalid source: ' + path);
    assert.ok(feature.entry.startsWith(root), 'Entry must be inside repo: ' + path);
    const entry = feature.entry.slice(root.length).replace(/^[/\\]/, '').replaceAll('\\', '/');
    assert.ok(entry.startsWith('src/') && entry.endsWith('.mjs'), 'Invalid entry: ' + entry);
    assert.ok(feature.legacy.startsWith('src/') && feature.legacy.endsWith('.legacy.js'),
      'Invalid frozen backup: ' + feature.legacy);
    assert.ok(!entries.has(entry), 'Entry shared by multiple fragments: ' + entry);
    assert.ok(!names.has(feature.name), 'Duplicate bundle global: ' + feature.name);
    assert.ok(!legacy.has(feature.legacy), 'Duplicate frozen backup: ' + feature.legacy);
    entries.add(entry);
    names.add(feature.name);
    legacy.add(feature.legacy);
    const [sourceText, entryText, frozenText] = await Promise.all([
      read(path), read(entry), read(feature.legacy)
    ]);
    assert.ok(sourceText.length > 0 && frozenText.length > 0, 'Empty fragment: ' + path);
    assert.match(entryText, /\bexport\b/, 'Missing ES module export: ' + entry);
    assert.match(entryText, /\bfrom\s+['"]\.\//, 'Entry must use local source: ' + entry);
    assert.doesNotMatch(entryText, /\bfrom\s+['"](?:https?:|node:)/, 'External runtime import: ' + entry);
    const basename = entry.replace(/[^/]+$/, '');
    const relative = [...entryText.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/g)];
    assert.ok(relative.length >= 1, 'Entry has no relative source: ' + entry);
    for (const [, imported] of relative) {
      const importedPath = join(root, basename, imported);
      assert.ok((await stat(importedPath)).isFile(),
        'Missing local entry import: ' + importedPath);
    }
  }
  assert.equal(entries.size, entryCount);
  assert.equal(names.size, entryCount);
  assert.equal(legacy.size, entryCount);
  assert.equal(legacyFragmentOverrides.size, 3);
  for (const [source, original] of legacyFragmentOverrides) {
    assert.ok(bundledFeatures.has(source), 'Untracked original override: ' + source);
    assert.equal(bundledFeatures.get(source).legacy, original,
      'Frozen 1.6.1 backup must remain the exact override for ' + source);
    assert.ok((await stat(join(root, original))).isFile());
  }
});

test('Architecture audit: shared Game Center, standings, players and leaders keep a single state owner', async () => {
  const [
    chartAdapter, chartsModule, sidebarModule, standingsAdapter, standingsModule,
    teamModule, playerData, playerDialog, leaderData, leaderRender
  ] = await Promise.all([
    read('src/features/game-center/charts.js'),
    read('src/features/game-center/charts.module.mjs'),
    read('src/features/game-center/render.module.mjs'),
    read('src/features/standings/standings.js'),
    read('src/features/standings/standings.module.mjs'),
    read('src/features/team-profile/profile.module.mjs'),
    read('src/features/player-profile/data.module.mjs'),
    read('src/features/player-profile/dialog.module.mjs'),
    read('src/features/league-leaders/data.module.mjs'),
    read('src/features/league-leaders/render.module.mjs')
  ]);
  assert.match(chartAdapter, /let activeChart=null/);
  assert.match(chartsModule, /getActiveChart\(/);
  assert.match(chartsModule, /setActiveChart\(/);
  assert.match(sidebarModule, /getActiveChart\(/);
  assert.doesNotMatch(sidebarModule, /(?:const|let) activeChart\s*=/);
  assert.match(standingsAdapter, /let mainView='scores'/);
  assert.doesNotMatch(standingsModule, /\blet mainView\s*=/);
  assert.match(standingsModule, /const teamDirectory=new Map/);
  assert.match(standingsModule, /const standingsState=/);
  assert.match(standingsModule, /const profileState=/);
  assert.doesNotMatch(teamModule, /\bconst profileState\s*=/);
  assert.match(playerData, /const playerState=/);
  assert.doesNotMatch(playerDialog, /\bconst playerState\s*=/);
  assert.match(leaderData, /const leaderState=/);
  assert.doesNotMatch(leaderRender, /\bconst leaderState\s*=/);
});

test('Architecture audit: exact esbuild dependency tree is locked with integrity hashes', async () => {
  const pkg = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies);
  assert.equal(lock.packages['node_modules/esbuild'].version, '0.28.2');
  for (const [path, dep] of Object.entries(lock.packages)) {
    if (path === '') continue;
    assert.equal(dep.version, '0.28.2', 'Unexpected dependency version: ' + path);
    assert.match(dep.integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/, 'Missing npm checksum for ' + path);
  }
  assert.equal(Object.keys(lock.packages).length, 28);
});

test('Architecture audit: deterministic modern candidate and immutable original 1.6.1 HTML', async () => {
  const modern = await build();
  const first = await readFile(modern.path);
  const repeat = await build();
  const second = await readFile(repeat.path);
  assert.ok(first.equals(second), 'Two back-to-back builds must match byte for byte');
  assert.equal(modern.sha256, repeat.sha256);
  assert.equal(modern.bytes, 499291, 'Release candidate byte length changed');
  assert.equal(repeat.sha256, candidateSha, 'Release-candidate checksum changed unexpectedly');
  assert.equal(createHash('sha256').update(second).digest('hex'), candidateSha);
  assert.match(second.toString('utf8'), /Courtside 1\.7\.0 — Live NBA Scores/);
  const html = second.toString('utf8');
  assert.equal((html.match(/<style\b/gi) || []).length, 1);
  assert.equal((html.match(/<script\b/gi) || []).length, 1);
  assert.doesNotMatch(html, /<script[^>]*\b(?:src|type)\s*=\s*['"](?:[^'"]*module|https?:)/i);
  assert.doesNotMatch(html, /__COURTSIDE_[A-Z_]+__/);
  const original = await build({ verifyBaseline: true });
  assert.equal(original.bytes, 374363);
  assert.equal(original.sha256, originalSha);
  assert.equal(createHash('sha256').update(await readFile(original.path)).digest('hex'), originalSha);
});
