import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { createWhatsNew } from '../src/features/whats-new/module.mjs';
import { COURTSIDE_RELEASE, WHATS_NEW_RELEASES } from '../src/features/whats-new/releases.module.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const originalReleases = await readFile(join(root, 'src/features/whats-new/releases.legacy.js'), 'utf8');
const originalController = await readFile(join(root, 'src/features/whats-new/controller.legacy.js'), 'utf8');
const { versions, release } = (() => {
  const context = createContext({});
  runInContext(originalReleases + '\nglobalThis.__data = { versions: WHATS_NEW_RELEASES, release: COURTSIDE_RELEASE };', context);
  return context.__data;
})();

function setup({ seed = {}, storageBlocked = false } = {}) {
  const kv = new Map(Object.entries(seed));
  const dom = new Map();
  const $ = (id) => {
    if (!dom.has(id)) {
      const node = {
        value: '', hidden: false, disabled: false, innerHTML: '', textContent: '',
        attributes: {}, handlers: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, callback) { this.handlers[name] = callback; },
      };
      dom.set(id, node);
    }
    return dom.get(id);
  };
  const storage = {
    getItem: key => { if (storageBlocked) throw new Error('Storage denied'); return kv.get(key) ?? null; },
    setItem: (key, value) => { if (storageBlocked) throw new Error('Storage denied'); kv.set(key, value); },
  };
  const safe = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const summary = () => ({
    selected: $('whatsNewVersion').value,
    details: $('whatsNewDetails').innerHTML,
    count: $('whatsNewCount').textContent,
    olderDisabled: $('whatsNewOlder').disabled,
    newerDisabled: $('whatsNewNewer').disabled,
    unread: $('whatsNewMainDot').hidden,
    label: $('appSettingsOpen').attributes['aria-label'],
    announced: $('whatsNewAnnounce').textContent,
    storedVersion: kv.get('courtside.whatsnew.selected.v1') ?? null,
    storedSeen: kv.get('courtside.whatsnew.seen.v1') ?? null,
  });
  return { $, safe, kv, storage, summary };
}

function modern(env) {
  return createWhatsNew({ $: env.$, safe: env.safe, releases: versions, currentRelease: release, getStorage: () => env.storage });
}
function legacy(env) {
  const ctx = createContext({
    $: env.$, safe: env.safe, localStorage: env.storage,
  });
  runInContext(originalReleases + '\n' + originalController + '\nglobalThis.__api = { initWhatsNew, renderWhatsNew, markWhatsNewRead, updateWhatsNewIndicators };', ctx);
  return ctx.__api;
}

function travel(api, env) {
  const states = [];
  api.initWhatsNew();
  states.push(env.summary());
  env.$('whatsNewOlder').handlers.click();
  states.push(env.summary());
  env.$('whatsNewOlder').handlers.click();
  states.push(env.summary());
  env.$('whatsNewNewer').handlers.click();
  states.push(env.summary());
  api.markWhatsNewRead();
  states.push(env.summary());
  return states;
}

test('isolated ES module preserves legacy markup, release navigation and storage side effects', () => {
  const a = setup(), b = setup();
  assert.deepEqual(travel(modern(a), a), travel(legacy(b), b));
  assert.ok(a.$('whatsNewVersion').innerHTML.includes('v1.6'));
  assert.equal(a.$('whatsNewMainDot').hidden, true);
  assert.equal(a.kv.get('courtside.whatsnew.seen.v1'), '1.6.1');
});

test('legacy persisted release selections carry over to isolated module unchanged', () => {
  const seed = { 'courtside.whatsnew.selected.v1': '1.5', 'courtside.whatsnew.seen.v1': '1.6.1' };
  const a=setup({seed}), b=setup({seed});
  assert.deepEqual(travel(modern(a), a), travel(legacy(b), b));
});

test('separate instances have isolated mutable selection/read state', () => {
  const a=setup(), b=setup();
  const fa=modern(a), fb=modern(b);
  fa.initWhatsNew();fb.initWhatsNew();
  a.$('whatsNewOlder').handlers.click();
  assert.notEqual(a.$('whatsNewVersion').value, b.$('whatsNewVersion').value);
  fa.markWhatsNewRead();
  assert.equal(a.$('whatsNewMainDot').hidden, true);
  assert.equal(b.$('whatsNewMainDot').hidden, false);
});

test('storage-denied conditions match the old controller and still render release notes', () => {
  const a=setup({storageBlocked:true}), b=setup({storageBlocked:true});
  assert.deepEqual(travel(modern(a), a), travel(legacy(b), b));
});

test('1.7.0 What's New entry is current, historical 1.6.1 is preserved, and it can be marked read',()=>{
  assert.equal(COURTSIDE_RELEASE,'1.7.0');
  assert.equal(WHATS_NEW_RELEASES.length,18);
  assert.deepEqual(WHATS_NEW_RELEASES.slice(0,3).map(x=>x.version),['1.7.0','1.6.1','1.6']);
  const env=setup(),api=createWhatsNew({$:env.$,safe:env.safe,releases:WHATS_NEW_RELEASES,currentRelease:COURTSIDE_RELEASE,getStorage:()=>env.storage});
  api.initWhatsNew();
  assert.equal(env.$('whatsNewVersion').value,'1.7.0');
  assert.match(env.$('whatsNewDetails').innerHTML,/Modular Architecture &amp; Stability|Modular Architecture & Stability/);
  assert.equal(env.$('whatsNewMainDot').hidden,false);
  api.markWhatsNewRead();
  assert.equal(env.kv.get('courtside.whatsnew.seen.v1'),'1.7.0');
  assert.equal(env.$('whatsNewMainDot').hidden,true);
});
