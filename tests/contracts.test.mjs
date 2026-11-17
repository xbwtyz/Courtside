import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = async path => readFile(join(root, path), 'utf8');
const snapshot = obj => JSON.parse(JSON.stringify(obj));
const scoreboardFixture = async () => JSON.parse(await source('tests/fixtures/scoreboard.json'));

function runFragment(js, globals, names) {
  const ctx = createContext({ console, Date, Promise, Map, Set, ...globals });
  runInContext(js + '\n' + 'globalThis.__testExports = { ' + names.join(', ') + ' };', ctx);
  return { ...ctx.__testExports, ctx };
}

test('scoreboard normalization identifies pre/live/final without mutating ESPN input', async () => {
  const full = await source('src/features/scoreboard/data.js');
  const code = full.slice(0, full.indexOf('  function updateStatus()'));
  assert.ok(code.includes('function classify(') && code.includes('function parseGames('), 'expected original source declarations');
  const { parseGames } = runFragment(code, {}, ['parseGames']);
  const fixture = await scoreboardFixture();
  const before = JSON.stringify(fixture);
  const games = parseGames(fixture);
  assert.deepEqual(games.map(g => g._phase), ['upcoming','live','final']);
  assert.deepEqual(games.map(g => g.id), ['401000001','401000002','401000003']);
  assert.equal(JSON.stringify(fixture), before, 'normalization must not modify ESPN JSON');
  assert.throws(() => parseGames({ games: [] }), /Unexpected data format/);
  assert.throws(() => parseGames(null), /Unexpected data format/);
});

test('refresh policy respects 10s/15s/60s and stops polling historical final games', async () => {
  const { ctx, scoresRefreshMs, statsRefreshMs } = runFragment(
    (await source('src/api/espn/config.legacy.js')) + '\n' + (await source('src/api/espn/refresh-policy.legacy.js')),
    {
      state: { date:'2026-11-16',games: [],lastUpdated: null },
      viewerState:{liveGames:[],statsCache:new Map(),statsOpen:false,gameId:null,statsPending:new Map()},
      today: () => '2026-11-16',
      document:{hidden:false},
      $: () => ({hidden:true}),
      updateStatsSidebar: () => {},
    }, ['scoresRefreshMs','statsRefreshMs']
  );
  const games = (await scoreboardFixture()).events.map((g,i)=>({ ...g,_phase:['upcoming','live','final'][i] }));
  ctx.state.games = games;
  assert.equal(scoresRefreshMs(), 10000);
  assert.equal(statsRefreshMs('401000002'), 15000);
  assert.equal(statsRefreshMs('401000001'), 60000);
  assert.equal(statsRefreshMs('401000003'), Infinity);
  ctx.state.games = games.filter(g => g._phase !== 'live');
  assert.equal(scoresRefreshMs(), 60000);
  ctx.state.games = [games[2]];
  ctx.state.date = '2026-11-15';
  ctx.state.lastUpdated = new Date();
  assert.equal(scoresRefreshMs(), Infinity);
});

test('ESPN request queue prioritizes live requests, respects cooldown, and limits overlapping jobs', async () => {
  const config = await source('src/api/espn/request-scheduler.legacy.js');
  const ctx = createContext({ console, Promise, Date, setTimeout, clearTimeout, espnPoll:{sharedUntil:0,scoreFailures:0}, statsPoll:{failures:0}, ESPN_MAX_BACKOFF_MS:300000 });
  runInContext(config + '\nglobalThis.__request = requestESPN; globalThis.__retry = retryAfterMs; globalThis.__note = noteEspnResponseError;', ctx);
  const requestESPN=ctx.__request;
  const order=[];
  let release;
  const first=requestESPN(() => {order.push('first score');return new Promise(resolve => {release=resolve;});},0);
  const background=requestESPN(() => {order.push('leaderboard');return 'leaderboard';},3);
  const second=requestESPN(() => {order.push('second score');return 'second';},0);
  await Promise.resolve();
  assert.deepEqual(order,['first score']);
  release('first');
  assert.equal(await first,'first');
  assert.equal(await second,'second');
  assert.equal(await background,'leaderboard');
  assert.deepEqual(order,['first score','second score','leaderboard']);
  assert.equal(ctx.__retry('3'),3000);
  assert.equal(ctx.__retry('garbage'),0);
  ctx.espnPoll.sharedUntil=Date.now()+30000;
  let invoked=false;
  await assert.rejects(requestESPN(() => {invoked=true;},0),/rate limited/);
  assert.equal(invoked,false, 'cooldown must reject before network work starts');
  ctx.espnPoll.sharedUntil=0;
  ctx.__note({status:429,headers:{get: ()=>'2'}},'scores');
  assert.ok(ctx.espnPoll.sharedUntil>Date.now(), '429 Retry-After should create shared cooldown');
});

test('saved preferences preserve valid options and reject unsafe or obsolete values', async () => {
  const code=await source('src/features/settings/preferences.legacy.js');
  let current=JSON.stringify({ defaultLayout:4,landing:'leaders',alertsEnabled:true,alertsTeams:['2','2','abc','5'],tickerSpeed:'invalid',leadersRows:999 });
  let writes=[];
  const status={textContent:''};
  const ctx=createContext({
    localStorage:{ getItem:() => current,setItem:(k,v)=>writes.push([k,v]) },
    $: () => status,
  });
  runInContext(code + '\nglobalThis.__load=loadSettingsPrefs; globalThis.__save=saveSettingsPrefs; globalThis.__prefs=()=>settingsPrefs; globalThis.__available=()=>settingsStorageAvailable;',ctx);
  const pref=snapshot(ctx.__prefs());
  assert.equal(pref.defaultLayout,4);
  assert.equal(pref.landing,'leaders');
  assert.equal(pref.alertsEnabled,true);
  assert.deepEqual(pref.alertsTeams,['2','5']);
  assert.equal(pref.tickerSpeed,'normal');
  assert.equal(pref.leadersRows,25);
  assert.equal(pref.alertsSound,false);
  ctx.__save();
  assert.equal(writes.length,1);
  assert.equal(writes[0][0],'courtside.preferences.v1');
  assert.equal(status.textContent,'Saved in this browser');
  current='{bad json';
  assert.equal(snapshot(ctx.__load()).defaultLayout,1);
  assert.equal(ctx.__available(),false);
});

test('alerts do not replay baseline; emit start/lead/close/final only on observed transitions', async () => {
  const code=(await source('src/features/live-alerts/alerts.js')).split('  function alertsUpdateToastVisibility()')[0];
  assert.ok(code.includes('function alertsObserveScoreboard('));
  const date='2026-11-16';
  const settingsPrefs={ alertsEnabled:true,alertsOverlay:false, alertsScope:'all',alertsTeams:[],alertsStart:true,alertsHalftime:false,alertsFinal:true,alertsLead:true,alertsClose:true };
  const $ = id => ({hidden:id==='viewer'?false:true});
  const functions=runFragment(code,{
    document:{hidden:false},state:{date},settingsPrefs,today:()=>date,$,
    classify:g=>g.status?.type?.state==='in'?'live':g.status?.type?.state==='post'?'final':'upcoming',
    alertsUpdateBells:()=>{}, alertsRenderHistory:()=>{},alertsRenderToasts:()=>{},alertsMaybeSound:()=>{},alertsDismissToast:()=>{},
  },['alertsObserveScoreboard','alertsResetBaseline']);
  const fixture=await scoreboardFixture();
  const upcoming=structuredClone(fixture.events[0]);
  const update=(g,phase,away,home,period=4,clock='1:50')=>{
    const r=structuredClone(g);r.status.type.state=phase;r.status.period=period;r.status.displayClock=clock;
    const [a,h]=r.competitions[0].competitors;a.score=String(away);h.score=String(home);return r;
  };
  const watch=functions.alertsObserveScoreboard;
  const history=()=>snapshot(runInContext('alertsState.history.map(x=>({kind:x.kind,gameId:x.gameId}))',functions.ctx));
  watch([upcoming],date);
  assert.deepEqual(history(),[], 'first response is always silent');
  watch([update(upcoming,'in',1,2,1,'10:00')],date);
  assert.deepEqual(history().map(x=>x.kind),['Start']);
  // Observe a tie, then a new outright leader in the final two minutes.
  watch([update(upcoming,'in',2,2,4,'2:20')],date);
  assert.equal(history().filter(x=>x.kind==='Lead').length,0);
  watch([update(upcoming,'in',3,2)],date);
  assert.equal(history().filter(x=>x.kind==='Lead').length,1);
  assert.equal(history().filter(x=>x.kind==='Close').length,1);
  watch([update(upcoming,'in',2,4)],date);
  assert.equal(history().filter(x=>x.kind==='Lead').length,1,'lead cooldown blocks repeated alerts');
  assert.equal(history().filter(x=>x.kind==='Close').length,1,'close alert is once per period');
  watch([update(upcoming,'post',115,110,4,'0:00')],date);
  assert.equal(history().filter(x=>x.kind==='Final').length,1);
  const before=history().length;
  watch([update(upcoming,'post',115,110,4,'0:00')],date);
  assert.equal(history().length,before, 'repeated final snapshot cannot emit a duplicate');
});
