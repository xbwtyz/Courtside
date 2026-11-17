import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
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
