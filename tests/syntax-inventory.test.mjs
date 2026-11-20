import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverSyntaxFiles} from '../scripts/check-syntax.mjs';
test('syntax inventory covers module adapters, historical sources, scripts and tests',async()=>{
 const files=(await discoverSyntaxFiles()).map(path=>path.replaceAll('\\','/'));
 assert.ok(files.length>100);
 for(const expected of ['src/release/version.mjs','src/features/viewer/controller.module.mjs',
   'src/features/viewer/controller.legacy.js','scripts/build.mjs','scripts/check-syntax.mjs',
   'tests/syntax-inventory.test.mjs'])assert.ok(files.includes(expected),'Missing '+expected);
 assert.equal(new Set(files).size,files.length);
});
