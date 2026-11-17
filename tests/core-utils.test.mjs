import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { fmtDate, dateFromString, today, safe, safeLogo } from '../src/core/formatters.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const original = await readFile(join(root,'src/core/utils.legacy.js'),'utf8');
const legacyContext = createContext({Date, URL});
runInContext(original+'\nglobalThis.legacy = { fmtDate, dateFromString, today, safe, safeLogo };',legacyContext);
const legacy = legacyContext.legacy;
const modern = {fmtDate,dateFromString,today,safe,safeLogo};

function compareHelper(name,inputs) {
  for(const input of inputs){
    const newer = modern[name](input);
    const old = legacy[name](input);
    assert.equal(newer,old,`${name} changed for ${String(input)}`);
  }
}

test('date formatting and parsing preserve local noon and all existing date semantics',()=>{
  compareHelper('fmtDate',[
    new Date(2026,10,16,12),new Date(2024,1,29,12),new Date(2026,0,1,0),
    new Date(2026,11,31,23),new Date(2000,0,1,12),new Date(2026,2,8,12)
  ]);
  for(const date of ['2026-11-16','2024-02-29','2026-01-01','2026-03-08','2026-11-01','2026-02-30']){
    const a=modern.dateFromString(date),b=legacy.dateFromString(date);
    assert.equal(a.getTime(),b.getTime());
    assert.equal(a.getHours(),12,'parser should keep the original noon behavior');
  }
  assert.equal(fmtDate(dateFromString('2026-11-16')),'2026-11-16');
  assert.equal(today(),legacy.today());
});

test('HTML escaping is identical for text, attributes and malicious payloads',()=>{
  const inputs=[undefined,null,'',0,false,NaN,123,'Darius Garland',
    `&<>"'`, `<img src=x onerror="alert('NBA')">`, `O'Brien & the Nets`,
    `</button><script>alert(1)</script>`, `📊 Won—Lost`, ['a','b']];
  compareHelper('safe',inputs);
  assert.equal(safe(`&<>"'`),'&amp;&lt;&gt;&quot;&#39;');
  assert.equal(safe(null),'');
  assert.ok(!safe('<script>').includes('<script>'));
});

test('ESPN logo URL validation keeps the exact legacy allowlist and HTTPS rules',()=>{
  const urls=['https://a.espncdn.com/logo.png','https://espncdn.com/a',
    'https://images.espncdn.com/a?x=1','HTTPS://CDN.ESPNCDN.COM/logo',
    'http://cdn.espncdn.com/logo','https://espncdn.com.evil.test/a',
    'https://fakeespncdn.com/a','javascript:alert(1)','data:image/svg+xml,<svg></svg>',
    '/relative.png','',null,undefined,'https://cdn.espncdn.com/a#frag'];
  compareHelper('safeLogo',urls);
  assert.equal(safeLogo('http://cdn.espncdn.com/a'),'');
  assert.equal(safeLogo('https://espncdn.com.evil.test/a'),'');
  assert.equal(safeLogo('https://images.espncdn.com/img.png'),'https://images.espncdn.com/img.png');
});

test('ES module exposes only the original five pure helpers; no application state dependency',async()=>{
  const source=await readFile(join(root,'src/core/formatters.mjs'),'utf8');
  const adapter=await readFile(join(root,'src/core/utils.js'),'utf8');
  const entry=await readFile(join(root,'src/core/entry.mjs'),'utf8');
  assert.equal((source.match(/export const /g)||[]).length,5);
  assert.match(adapter,/const \{ fmtDate, dateFromString, today, safe, safeLogo \} = CourtsideCoreUtils/);
  assert.match(entry,/export \{ fmtDate, dateFromString, today, safe, safeLogo \}/);
  assert.doesNotMatch(source,/\b(?:document|window|viewerState|settingsPrefs|localStorage)\b/);
});
