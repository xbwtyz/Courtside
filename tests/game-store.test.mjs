import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createContext, runInContext, Script } from 'node:vm';
import { createGameStore } from '../src/core/game-store.module.mjs';
import { build } from '../scripts/build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture=JSON.parse(await readFile(join(root,'tests/fixtures/scoreboard.json'),'utf8'));
const create=()=>createGameStore({date:'2026-11-16',defaultLiveOnly:true});
const clean=obj=>JSON.parse(JSON.stringify(obj));

async function oldState() {
  const legacy=await readFile(join(root,'src/core/state.legacy.js'),'utf8');
  const elements=new Map();
  const $=id=>{if(!elements.has(id))elements.set(id,{value:'',checked:false});return elements.get(id);};
  const ctx=createContext({today:()=> '2026-11-16', settingsPrefs:{defaultLiveOnly:true}, $,Map,Set,Array,Date});
  runInContext(legacy+'\nglobalThis.__legacyState=state;globalThis.__legacyViewer=viewerState;',ctx);
  return {state:ctx.__legacyState,viewer:ctx.__legacyViewer,controls:elements};
}

test('game store creates the exact legacy game-state shape and preserves startup defaults',async()=>{
  const old=await oldState(),store=create();
  assert.deepEqual(Object.keys(store.state),Object.keys(old.state));
  for(const key of Object.keys(store.state)){
    if(key==='expanded') assert.deepEqual([...store.state.expanded],[...old.state.expanded]);
    else assert.deepEqual(clean(store.state[key]),clean(old.state[key]),key);
  }
  assert.equal(store.state.liveOnly,true);
  assert.equal(old.controls.get('datePicker').value,store.state.date);
  assert.equal(old.controls.get('liveOnly').checked,store.state.liveOnly);
});

test('replacing scores preserves the ESPN objects and original mutable state identity',()=>{
  const store=create(),state=store.state,expanded=state.expanded;
  const games=fixture.events.map(e=>({...e,_phase:'live'}));
  assert.equal(store.replaceGames(games),games);
  assert.strictEqual(store.state,state);
  assert.strictEqual(state.games,games);
  assert.strictEqual(state.games[0],games[0]);
  assert.strictEqual(state.expanded,expanded);
  assert.strictEqual(store.findGame(401000002),games[1]);
  assert.strictEqual(store.findGame('401000002'),games[1]);
  assert.equal(store.findGame('missing'),undefined);
});

test('date-selection reset is identical to legacy selectDay, without replacing expanded Set',()=>{
  const store=create(),state=store.state;
  store.replaceGames(fixture.events);
  state.expanded.add('401000002');
  state.error='old error';state.firstLoaded=true;state.lastUpdated=new Date();
  state.nextAt=12345;state.loading=true;state.query='Hawks';state.liveOnly=false;
  const expanded=state.expanded;
  store.selectDate('2026-11-17');
  assert.equal(state.date,'2026-11-17');
  assert.deepEqual(state.games,[]);
  assert.strictEqual(state.expanded,expanded);
  assert.equal(expanded.size,0);
  assert.equal(state.error,'');assert.equal(state.firstLoaded,false);
  assert.equal(state.lastUpdated,null);assert.equal(state.nextAt,0);
  assert.equal(state.loading,true,'in-flight request cancellation remains owned by fetchScores');
  assert.equal(state.query,'Hawks');assert.equal(state.liveOnly,false);
});

test('player game-log navigation changes date and nextAt without clearing the previous game list',()=>{
  const store=create(),state=store.state,games=fixture.events;
  store.replaceGames(games);state.expanded.add('401000001');state.error='keep';
  state.lastUpdated=new Date('2026-11-16T18:00:00Z');state.nextAt=55;
  store.navigateToDate('2026-11-18');
  assert.equal(state.date,'2026-11-18');assert.equal(state.nextAt,0);
  assert.strictEqual(state.games,games);assert.equal(state.expanded.has('401000001'),true);
  assert.equal(state.error,'keep');assert.equal(state.lastUpdated.toISOString(),'2026-11-16T18:00:00.000Z');
});

test('subscriptions receive ordered shallow read-only snapshots and can unsubscribe',()=>{
  const store=create(),events=[];
  const unsubscribe=store.subscribe(e=>events.push(e));
  assert.throws(()=>store.subscribe(5),TypeError);
  store.replaceGames(fixture.events);
  const snap=store.getSnapshot();
  assert.equal(snap.date,'2026-11-16');
  assert(Object.isFrozen(snap));assert(Object.isFrozen(snap.games));
  assert.notStrictEqual(snap.games,store.state.games);
  assert.strictEqual(snap.games[0],store.state.games[0]);
  assert.throws(()=>snap.games.push({id:'rogue'}),TypeError);
  store.navigateToDate('2026-11-17');
  store.selectDate('2026-11-18');
  assert.deepEqual(events.map(e=>e.type),['scores','navigation','date']);
  assert.deepEqual(events.map(e=>e.date),['2026-11-16','2026-11-17','2026-11-18']);
  assert.equal(events[0].games.length,3);
  assert.equal(events[2].games.length,0);
  unsubscribe();store.replaceGames([]);
  assert.equal(events.length,3);
});

test('observer exceptions do not prevent score updates or later observers',()=>{
  const store=create();let received=0;
  store.subscribe(()=>{throw new Error('UI observer failed')});
  store.subscribe(()=>{received++});
  store.replaceGames(fixture.events);
  assert.equal(received,1);
  assert.strictEqual(store.state.games,fixture.events);
});

test('stores are independent and never share mutable date, game lists, or subscriptions',()=>{
  const a=create(),b=create();let bEvents=0;
  b.subscribe(()=>bEvents++);
  a.replaceGames(fixture.events);a.selectDate('2026-11-20');
  assert.equal(b.state.date,'2026-11-16');assert.equal(b.state.games.length,0);
  assert.equal(bEvents,0);assert.notStrictEqual(a.state.expanded,b.state.expanded);
});

test('game-state migration preserves the exact legacy build and a single inline runtime script',async()=>{
  const modern=await build();const html=await readFile(modern.path,'utf8');
  assert.match(html,/CourtsideGameStore/);
  assert.match(html,/CourtsideGameStore\.createGameStore/);
  assert.match(html,/gameStore\.replaceGames\(parseGames\(json\)\)/);
  assert.match(html,/gameStore\.navigateToDate\(day\)/);
  assert.equal((html.match(/<script\b/gi)||[]).length,1);
  assert.doesNotMatch(html,/<script[^>]+\bsrc\s*=/i);
  assert.doesNotMatch(html,/<script[^>]+\btype\s*=\s*["']module/i);
  const match=html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match);assert.doesNotThrow(()=>new Script(match[1]));
  const legacy=await build({verifyBaseline:true});
  const baseline=await readFile(join(root,'baseline/courtside_1.6.1.html'));
  assert.ok((await readFile(legacy.path)).equals(baseline));
  assert.equal(await readFile(modern.path,'utf8'),html);
});
