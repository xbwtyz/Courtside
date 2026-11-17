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
