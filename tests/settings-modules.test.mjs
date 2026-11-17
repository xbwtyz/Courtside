import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { createSettingsPreferences } from '../src/features/settings/preferences.module.mjs';
import { registerSettingsShortcut } from '../src/features/settings/shortcut.module.mjs';
import { initializeSettings } from '../src/features/settings/initialization.module.mjs';
import { COURTSIDE_RELEASE, WHATS_NEW_RELEASES } from '../src/features/whats-new/releases.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=path=>readFile(join(root,path),'utf8');
const copy=v=>JSON.parse(JSON.stringify(v));

function createFixture({seed,denied=false}={}) {
  const kv=new Map(seed!==undefined?[['courtside.preferences.v1',seed]]:[]);
  const writes=[],lookups=[],elements=new Map();
  const $=id=>{
    if(!elements.has(id))elements.set(id,{id,hidden:false,textContent:''});
    return elements.get(id);
  };
  const storage={
    getItem(key){lookups.push(key);if(denied)throw Error('Denied read');return kv.get(key)??null;},
    setItem(key,value){if(denied)throw Error('Denied write');kv.set(key,value);writes.push([key,value]);}
  };
  function legacy() {
    const ctx=createContext({ $,localStorage:storage });
    return source('src/features/settings/preferences.legacy.js').then(code=>{
      runInContext(code+'\nglobalThis.test={load:loadSettingsPrefs,save:saveSettingsPrefs,apply:applySettingsPrefs,getPrefs:()=>settingsPrefs,changePrefs:next=>settingsPrefs=next,defaults:SETTINGS_DEFAULTS,available:()=>settingsStorageAvailable};',ctx);
      return ctx.test;
    });
  }
  function modern() {
    const x=createSettingsPreferences({$,getStorage:()=>storage});
    return {load:x.loadSettingsPrefs,save:x.saveSettingsPrefs,apply:x.applySettingsPrefs,
      getPrefs:x.getPrefs,changePrefs:x.setPrefs,defaults:x.SETTINGS_DEFAULTS,available:x.isStorageAvailable};
  }
  const state=()=>({prefs:copy(kv),writes:copy(writes),lookups:copy(lookups),storageLabel:$('settingsStorageStatus').textContent, tickerHidden:$('scoreTicker').hidden});
  return {legacy,modern,state,kv};
}

const datasets=[
  undefined,
  '{}',
  JSON.stringify({landing:'standings',defaultLiveOnly:true,showTicker:false,autoScroll:false,tickerSpeed:'fast',defaultStatsTab:'charts',defaultLayout:4,defaultStatsOpen:false,defaultViewerTicker:true,leadersCategory:'shooting',leadersRows:50,alertsEnabled:true,alertsSound:true,alertsVolume:'high',alertsScope:'selected',alertsTeams:['2','5']}),
  JSON.stringify({landing:'invalid',defaultLayout:7,leadersRows:21,tickerSpeed:'bad',alertsScope:'invalid',alertsTeams:['2','02','x','2','1000','100','4'],alertsStart:'true',alertsVolume:'max'}),
  'null','[]','1','"scores"','{broken json',
];

test('all persisted preference schemas and malformed entries match original behavior',async()=>{
  for(const seed of datasets){
    const a=createFixture({seed}),b=createFixture({seed});
    const old=await a.legacy(),modern=b.modern();
    assert.deepEqual(copy(modern.getPrefs()),copy(old.getPrefs()),seed);
    assert.deepEqual(copy(modern.defaults),copy(old.defaults));
    assert.equal(modern.available(),old.available());
    modern.apply();old.apply();
    assert.deepEqual(b.state(),a.state(),`initial apply for ${seed}`);
    const next={...copy(modern.getPrefs()),defaultLayout:2,alertsTeams:['7','11'],landing:'leaders'};
    old.changePrefs(next);modern.changePrefs({...next});
    modern.save();old.save();modern.apply();old.apply();
    assert.deepEqual(b.state(),a.state(),`persist for ${seed}`);
    assert.deepEqual(copy(modern.load()),copy(old.load()));
  }
});

test('storage blocked on read and write retains session-only preferences and original warnings',async()=>{
  for(const seed of ['{}','{bad',undefined]){
    const a=createFixture({seed,denied:true}),b=createFixture({seed,denied:true});
    const old=await a.legacy(),modern=b.modern();
    assert.equal(old.available(),false);
    assert.equal(modern.available(),false);
    modern.changePrefs({...modern.getPrefs(),defaultLayout:4});
    old.changePrefs({...old.getPrefs(),defaultLayout:4});
    modern.save();old.save();
    modern.apply();old.apply();
    assert.deepEqual(b.state(),a.state());
    assert.match(b.state().storageLabel,/session only/);
    assert.equal(modern.getPrefs().defaultLayout,4);
  }
});

test('restoring defaults replaces the preferences object and preserves the original storage key',async()=>{
  const a=createFixture({seed:JSON.stringify({defaultLayout:4,landing:'leaders'})});
  const modern=a.modern();
  const previous=modern.getPrefs();
  modern.changePrefs({...modern.defaults});
  assert.notStrictEqual(modern.getPrefs(),previous);
  modern.save();
  assert.equal(a.kv.has('courtside.preferences.v1'),true);
  assert.equal(JSON.parse(a.kv.get('courtside.preferences.v1')).defaultLayout,1);
  assert.equal(JSON.parse(a.kv.get('courtside.preferences.v1')).landing,'scores');
});

test('release history module preserves all historical entries, ordering, and release label',async()=>{
  const ctx=createContext({});
  runInContext((await source('src/features/whats-new/releases.legacy.js'))+'\nglobalThis.data={COURTSIDE_RELEASE,WHATS_NEW_RELEASES};',ctx);
  assert.equal(COURTSIDE_RELEASE,'1.7.0');
  assert.equal(ctx.data.COURTSIDE_RELEASE,'1.6.1');
  assert.deepEqual(copy(WHATS_NEW_RELEASES.slice(2)),copy(ctx.data.WHATS_NEW_RELEASES));
  assert.equal(WHATS_NEW_RELEASES.length,18);
  assert.deepEqual(WHATS_NEW_RELEASES.slice(0,3).map(entry=>entry.version),['1.7.0','1.6.1','1.6']);
});

test('Settings shortcut delegates to whichever dialog is registered later',()=>{
  const calls=[],listeners={};
  registerSettingsShortcut({$:id=>({addEventListener:(name,fn)=>listeners[id+':'+name]=fn}),openAppSettings:tab=>calls.push(tab)});
  assert.deepEqual(calls,[]);
  listeners['refreshSettingsToggle:click']();
  assert.deepEqual(calls,['data']);
});

test('initialization runs release/alert/controls/apply in original order before landing selection',()=>{
  for(const landing of ['scores','standings','leaders']){
    const events=[];
    const emit=name=>()=>events.push(name);
    initializeSettings({initWhatsNew:emit('news'),alertsInit:emit('alerts'),syncSettingsControls:emit('controls'),applySettingsPrefs:emit('apply'),getLanding:()=>landing,setMainView:tab=>events.push('view:'+tab)});
    assert.deepEqual(events,['news','alerts','controls','apply',...(landing==='scores'?[]:['view:'+landing])]);
  }
});
