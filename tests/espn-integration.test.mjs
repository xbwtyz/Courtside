import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {createGameStore} from '../src/core/game-store.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=path=>readFile(join(root,path),'utf8');
const fixture=JSON.parse(await source('tests/fixtures/scoreboard.json'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<9;i++)await Promise.resolve();};

function makeSummary() {
  const id='401000002';
  const state={games:[{...fixture.events[1],_phase:'live'}]};
  const viewerState={statsCache:new Map(),statsPending:new Map(),liveGames:[],statsOpen:true,gameId:id};
  const statsPoll={gameId:id,nextAt:0,failures:0};
  const espnPoll={sharedUntil:0};
  const pending=[],requests=[];
  let phase='live';
  const ctx=createContext({
    console,Promise,Date,Map,Set,AbortController,setTimeout,clearTimeout,
    viewerState,statsPoll,espnPoll,
    SUMMARY_API:'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary',
    auditESPNJob:async (meta,fn)=>fn(()=>{}),
    fetch:async(url,options)=>{requests.push({url,options});const gate=deferred();pending.push(gate);return gate.promise;},
    dataLogObserve:()=>{},dataLogSummaryRecords:()=>[],dataLogInvalid:()=>{},
    noteEspnResponseError:()=>{},
    exponentialBackoff:()=>30000,
    phaseForGameId:()=>phase,
    statsNeedsRequest:(requested,force)=>{
      if(force)return true;
      const cache=viewerState.statsCache.get(requested);
      if(!cache)return true;
      if(phase==='final')return cache.phase!=='final';
      return Date.now()-cache.at>=15000;
    },
  });
  return {id,state,viewerState,statsPoll,espnPoll,pending,requests,ctx,setPhase:p=>{phase=p;}};
}

test('Game Center deduplicates concurrent summary requests, caches live data and takes exactly one final snapshot',async()=>{
  const h=makeSummary();
  runInContext((await source('src/api/espn/game-summary.js'))+'\nglobalThis.runSummary=fetchGameSummary;',h.ctx);
  const first=h.ctx.runSummary(h.id),second=h.ctx.runSummary(h.id),forced=h.ctx.runSummary(h.id,true);
  await tick();
  assert.equal(h.requests.length,1,'Three callers for one event must share exactly one network request');
  assert.match(h.requests[0].url,/event=401000002/);
  const response1={ok:true,json:async()=>({header:{id:h.id},boxscore:{players:[]}})};
  h.pending[0].resolve(response1);
  const [a,b,c]=await Promise.all([first,second,forced]);
  assert.strictEqual(a,b);assert.strictEqual(b,c);
  assert.equal(h.viewerState.statsPending.size,0);
  assert.equal((await h.ctx.runSummary(h.id)).header.id,h.id);
  assert.equal(h.requests.length,1,'Fresh cached summary must not refetch');
  h.setPhase('final');
  const final=h.ctx.runSummary(h.id);await tick();
  assert.equal(h.requests.length,2,'Final transition should get one final snapshot');
  h.pending[1].resolve({ok:true,json:async()=>({header:{id:h.id,final:true}})});
  assert.equal((await final).header.final,true);
  assert.equal((await h.ctx.runSummary(h.id)).header.final,true);
  assert.equal(h.requests.length,2,'Final data must not poll again');
});

test('Game Center summary failures clear pending requests, apply backoff and permit recovery',async()=>{
  const h=makeSummary();
  runInContext((await source('src/api/espn/game-summary.js'))+'\nglobalThis.runSummary=fetchGameSummary;',h.ctx);
  const failure=h.ctx.runSummary(h.id);await tick();
  assert.equal(h.requests.length,1);
  h.pending[0].resolve({ok:false,status:503,headers:{get:()=>null}});
  await assert.rejects(failure,/ESPN statistics HTTP 503/);
  assert.equal(h.viewerState.statsPending.size,0,'Failure must release request deduplication entry');
  assert.equal(h.statsPoll.failures,1);
  assert.ok(h.statsPoll.nextAt>Date.now());
  await assert.rejects(h.ctx.runSummary(h.id),/waiting for retry/);
  assert.equal(h.requests.length,1,'Failed request should not trigger immediate retry storm');
  h.statsPoll.nextAt=0;
  const recovered=h.ctx.runSummary(h.id);await tick();
  h.pending[1].resolve({ok:true,json:async()=>({ok:true})});
  assert.equal((await recovered).ok,true);
  assert.equal(h.statsPoll.failures,0);
});

function makeScoreboard(){
  const gameStore=createGameStore({date:'2026-11-16',defaultLiveOnly:false});
  const state=gameStore.state;
  const espnPoll={sharedUntil:0,scoreFailures:0};
  const pending=[],calls=[], renders=[];
  const ctx=createContext({
    state,gameStore,espnPoll,console,Date,Promise,AbortController,DOMException,setTimeout,clearTimeout,
    API:'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    auditESPNJob:async (_meta,job)=>job(()=>{}),
    fetch:(url,options)=>{calls.push({url,options});const gate=deferred();pending.push(gate);return gate.promise;},
    parseGames:json=>json.events.map(g=>({...g,_phase:g.status.type.state==='in'?'live':'upcoming'})),
    alertsResetBaseline:()=>{},alertsObserveScoreboard:()=>{},
    seedTeamDirectoryFromScores:()=>{},
    dataLogObserve:()=>{},dataLogScoreRecords:()=>[],dataLogInvalid:()=>{},
    render:()=>renders.push('render'),renderTickers:()=>{},
    $:id=>id==='viewer'?{hidden:true}:{},updateStatus:()=>{},
    scoresRefreshMs:()=>10000,exponentialBackoff:()=>30000,
    noteEspnResponseError:()=>{},
  });
  return {state,espnPoll,pending,calls,renders,ctx};
}

test('switching dates cancels old scoreboard request and ignores stale ESPN response',async()=>{
  const h=makeScoreboard();
  const full=await source('src/features/scoreboard/data.js');
  const code=full.slice(full.indexOf('  async function fetchScores('),full.indexOf('  function changeDay('));
  runInContext(code+'\nglobalThis.runScores=fetchScores;',h.ctx);
  const old=h.ctx.runScores(true);await tick();
  assert.equal(h.calls.length,1);
  assert.match(h.calls[0].url,/dates=20261116/);
  const oldSignal=h.calls[0].options.signal;
  h.state.date='2026-11-17';
  const next=h.ctx.runScores(true);await tick();
  assert.equal(h.calls.length,2);
  assert.equal(oldSignal.aborted,true);
  assert.match(h.calls[1].url,/dates=20261117/);
  const newer={events:[{id:'new',status:{type:{state:'in'}}}]};
  h.pending[1].resolve({ok:true,json:async()=>newer});
  await next;
  const renderCount=h.renders.length;
  h.pending[0].resolve({ok:true,json:async()=>({events:[{id:'stale',status:{type:{state:'post'}}}]})});
  await old;
  assert.deepEqual(h.state.games.map(g=>g.id),['new']);
  assert.equal(h.renders.length,renderCount,'Old request must not repaint the new date');
  assert.equal(h.state.loading,false);
  assert.equal(h.state.fetchDate,null);
  assert.equal(h.state.nextAt>=Date.now(),true);
});

test('scoreboard avoids duplicate same-day requests and blocks requests during rate-limit cooldown',async()=>{
  const h=makeScoreboard();
  const full=await source('src/features/scoreboard/data.js');
  const code=full.slice(full.indexOf('  async function fetchScores('),full.indexOf('  function changeDay('));
  runInContext(code+'\nglobalThis.runScores=fetchScores;',h.ctx);
  const pending=h.ctx.runScores(true);await tick();
  await h.ctx.runScores(true);
  await h.ctx.runScores(false);
  assert.equal(h.calls.length,1);
  h.pending[0].resolve({ok:true,json:async()=>fixture});
  await pending;
  h.espnPoll.sharedUntil=Date.now()+100000;
  await h.ctx.runScores(true);
  assert.equal(h.calls.length,1,'ESPN cooldown must stop even manual refresh requests');
  assert.match(h.state.error,/rate-limited/);
  assert.ok(h.state.nextAt>=h.espnPoll.sharedUntil);
});

test('adaptive polling skips background tabs, respects cooldown, and does not refetch on viewer repaint',async()=>{
  const code=(await source('src/core/polling-bootstrap.js')).split('  document.addEventListener(\'visibilitychange\'')[0];
  const events={scores:0,stats:0,standings:0,status:0};
  const doc={hidden:true};let viewerHidden=true;
  const context=createContext({
    document:doc,Date,mainView:'standings',STANDINGS_TTL_MS:300000,
    state:{loading:false,nextAt:0},espnPoll:{sharedUntil:0},
    standingsState:{pending:null,at:0},
    $:()=>({hidden:viewerHidden}),
    fetchScores:()=>events.scores++,refreshSelectedStatsIfDue:()=>events.stats++,
    fetchStandings:()=>events.standings++,updateStatus:()=>events.status++
  });
  runInContext(code+'\nglobalThis.runPolls=runAdaptivePolls;',context);
  context.runPolls();assert.deepEqual(events,{scores:0,stats:0,standings:0,status:1});
  doc.hidden=false;context.runPolls();assert.deepEqual(events,{scores:1,stats:1,standings:1,status:2});
  context.espnPoll.sharedUntil=Date.now()+300000;
  viewerHidden=false;context.runPolls();
  assert.deepEqual(events,{scores:1,stats:2,standings:1,status:3});
});
