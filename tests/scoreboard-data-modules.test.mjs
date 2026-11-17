import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {createGameStore} from '../src/core/game-store.module.mjs';
import {createScoreRequestStatus} from '../src/api/espn/config.module.mjs';
import {createScoreboardData} from '../src/features/scoreboard/data.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=JSON.parse(await readFile(join(root,'tests/fixtures/scoreboard.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const tick=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function setup(){
  const events=[],requests=[],pending=[],timers=new Map(),elements=new Map();
  let nextTimer=0;
  class Clock extends Date{
    constructor(...args){super(...(args.length?args:[1794859200000]));}
    static now(){return 1794859200000;}
  }
  const gameStore=createGameStore({date:'2026-11-16',defaultLiveOnly:false}),state=gameStore.state;
  const espnPoll={sharedUntil:0,scoreFailures:0};
  const scoreRequestStatus=createScoreRequestStatus({state,espnPoll,AbortController,Date:Clock,
    getScoresRefreshMs:()=>state.games.some(x=>x._phase==='live')?10000:60000,
    getBackoff:()=>30000});
  const viewerState={statsOpen:false,gameId:null};
  function $(id){
    if(!elements.has(id)){
      const node={id,hidden:id==='viewer',innerHTML:'',textContent:'',value:'',disabled:false,
        classList:{spin:false,toggle(name,on){if(name==='spin')this.spin=Boolean(on);}}};
      elements.set(id,node);
    }
    return elements.get(id);
  }
  const setTimeout=(fn,ms)=>{let n=++nextTimer;timers.set(n,{fn,ms});return n;};
  const clearTimeout=id=>timers.delete(id);
  const getResponse={ok:true,status:200,headers:{get:()=>null},json:async()=>clone(fixture)};
  const mockFetch=(url,opts)=>{events.push(['fetch',String(url)]);requests.push({url,opts});
    const gate=deferred();pending.push(gate);return gate.promise;};
  const callbacks={
    fetch:mockFetch,
    auditESPNJob:async(meta,job)=>{events.push(['audit',meta.source,meta.resource,meta.priority]);return job(()=>events.push(['report']));},
    noteEspnResponseError:(response,where)=>events.push(['httpError',response.status,where]),
    selectedStatsDueAt:()=>Infinity,
    alertsResetBaseline:()=>events.push(['resetAlerts']),
    render:()=>events.push(['render']),
    dataLogObserve:(json,key,records)=>{events.push(['log',key]);},
    dataLogScoreRecords:()=>[],
    alertsObserveScoreboard:(_games,requested)=>events.push(['alerts',requested]),
    seedTeamDirectoryFromScores:()=>events.push(['teams']),
    renderTickers:()=>events.push(['tickers']),
    updateLiveGamePicker:()=>events.push(['livePicker']),
    paintViewer:()=>events.push(['viewerPaint']),
    dataLogInvalid:()=>events.push(['invalid']),
    dateFromString:day=>new Clock(day+'T12:00:00Z'),
    fmtDate:d=>d.toISOString().slice(0,10)
  };
  const core={$,state,viewerState,espnPoll,scoreRequestStatus,gameStore,
    API:'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    Date:Clock,DOMException,setTimeout,clearTimeout};
  return {core,callbacks,state,espnPoll,viewerState,events,requests,pending,timers,$,getResponse,gameStore};
}
async function make(mode){
  const h=setup();
  if(mode==='modular'){
    let api;
    const getters={
      callClassify:(...args)=>api.classify(...args),
      callParseGames:(...args)=>api.parseGames(...args),
      callUpdateStatus:(...args)=>api.updateStatus(...args),
      callSelectDay:(...args)=>api.selectDay(...args),
      callFetchScores:(...args)=>api.fetchScores(...args)
    };
    api=createScoreboardData({...h.core,...h.callbacks,...getters});
    return {...h,api};
  }
  const code=await readFile(join(root,'src/features/scoreboard/data.pre-module.js'),'utf8');
  const ctx=createContext({...h.core,...h.callbacks,console});
  runInContext(code+'\nglobalThis.testApi={classify,parseGames,updateStatus,fetchScores,changeDay,selectDay};',ctx);
  return {...h,api:ctx.testApi,ctx};
}
function stateShot(h){
  const state=h.state,$=h.$;
  return clone({date:state.date,ids:state.games.map(g=>g.id),phases:state.games.map(g=>g._phase),
    loading:state.loading,error:state.error,firstLoaded:state.firstLoaded,
    requestSeq:state.requestSeq,fetchDate:state.fetchDate,nextAt:state.nextAt,
    failures:h.espnPoll.scoreFailures,controller:!!state.controller,aborted:h.requests.map(r=>r.opts.signal.aborted),
    pendingTimers:[...h.timers.values()].map(t=>t.ms),events:h.events,
    status:[$('connection').innerHTML,$('updated').textContent,$('nextRefresh').textContent,
      $('refreshBtn').disabled,$('refreshBtn').classList.spin],
    picker:$('datePicker').value
  });
}
test('ESPN phase parsing, malformed payload errors and status banners match Phase 4H',async()=>{
  const before=await make('legacy'),after=await make('modular');
  function exercise(h){
    const g=fixture.events.map(x=>h.api.classify(x));
    const phases=h.api.parseGames(fixture).map(x=>x._phase);
    let malformed='';
    try{h.api.parseGames({bad:[]});}catch(e){malformed=e.message;}
    h.api.updateStatus();
    const initial=stateShot(h);
    h.state.firstLoaded=true;h.state.lastUpdated=new h.core.Date();
    h.state.games=h.api.parseGames(fixture);h.state.nextAt=h.core.Date.now()+10000;
    h.api.updateStatus();
    const live=stateShot(h);
    h.espnPoll.sharedUntil=h.core.Date.now()+120000;
    h.api.updateStatus();
    const cooled=stateShot(h);
    return {g,phases,malformed,initial,live,cooled};
  }
  const old=exercise(before),mod=exercise(after);
  assert.deepEqual(mod,old);
  assert.deepEqual(mod.g,['upcoming','live','final']);
  assert.equal(mod.malformed,'Unexpected data format from the scoreboard provider.');
  assert.match(mod.cooled.status[0],/ESPN RATE LIMITED/);
  assert.match(mod.cooled.status[2],/ESPN cooling down/);
});
async function successful(kind){
  const h=await make(kind),api=h.api;
  const snapshots=[];
  const first=api.fetchScores(true);
  await tick();
  snapshots.push(stateShot(h));
  await api.fetchScores(false);
  await api.fetchScores(true);
  snapshots.push(stateShot(h));
  assert.equal(h.requests.length,1);
  h.pending[0].resolve(h.getResponse);
  await first;
  snapshots.push(stateShot(h));
  h.espnPoll.sharedUntil=h.core.Date.now()+110000;
  await api.fetchScores(true);
  snapshots.push(stateShot(h));
  const requests=h.requests.length;
  api.changeDay(1);
  await tick();
  snapshots.push(stateShot(h));
  return {snapshots,requests,pending:h.pending.length};
}
test('single ESPN request, deduplication, 14s timeout, success, cooldown and date navigation exactly match Phase 4H',async()=>{
  const old=await successful('legacy'),mod=await successful('modular');
  assert.deepEqual(mod,old);
  assert.equal(mod.snapshots[0].loading,true);
  assert.deepEqual(mod.snapshots[0].pendingTimers,[14000]);
  assert.equal(mod.snapshots[1].requestSeq,1);
  assert.equal(mod.snapshots[2].loading,false);
  assert.deepEqual(mod.snapshots[2].phases,['upcoming','live','final']);
  assert.equal(mod.snapshots[3].failures,0);
  assert.match(mod.snapshots[3].error,/rate-limited/);
  assert.equal(mod.snapshots[4].date,'2026-11-17');
  assert.deepEqual(mod.snapshots[4].ids,[]);
  assert.equal(mod.pending,1,'date change under cooldown adds no request');
});
async function stale(kind){
  const h=await make(kind),api=h.api;
  const first=api.fetchScores(true);
  await tick();
  h.gameStore.selectDate('2026-11-17');
  const second=api.fetchScores(true);
  await tick();
  const whilePending=stateShot(h);
  assert.equal(h.requests.length,2);
  h.pending[1].resolve(h.getResponse);
  await second;
  const afterNew=stateShot(h);
  h.pending[0].resolve({...h.getResponse,json:async()=>({events:[{id:'old-date',status:{type:{state:'post'}}}]})});
  await first;
  return {whilePending,afterNew,afterStale:stateShot(h)};
}
test('different-date requests cancel older request and prevent stale score/Viewer repaint',async()=>{
  const before=await stale('legacy'),after=await stale('modular');
  assert.deepEqual(after,before);
  assert.deepEqual(after.whilePending.aborted,[true,false]);
  for(const label of ['render','viewerPaint','tickers'])assert.equal(after.afterStale.events.filter(e=>e[0]===label).length,after.afterNew.events.filter(e=>e[0]===label).length,'stale reply must not repaint '+label);
  assert.deepEqual(after.afterStale.ids,['401000001','401000002','401000003']);
});
async function failure(kind){
  const h=await make(kind),api=h.api;
  const first=api.fetchScores(true);
  await tick();
  h.pending[0].resolve({ok:false,status:503,headers:{get:()=>null},json:async()=>({})});
  await first;
  const failed=stateShot(h);
  const second=api.fetchScores(true);
  await tick();
  h.pending[1].reject(new DOMException('Timed out','AbortError'));
  await second;
  return {failed,aborted:stateShot(h)};
}
test('HTTP failures, aborts, backoff and cleanup preserve the pre-module status transitions',async()=>{
  const before=await failure('legacy'),after=await failure('modular');
  assert.deepEqual(after,before);
  assert.equal(after.failed.failures,1);
  assert.match(after.failed.error,/HTTP 503/);
  assert.match(after.aborted.error,/timed out/i);
  assert.equal(after.aborted.failures,2);
  assert.deepEqual(after.aborted.pendingTimers,[]);
});
test('module retains late-bound call adapters and no additional requests or background loops',async()=>{
  const adapter=await readFile(join(root,'src/features/scoreboard/data.js'),'utf8');
  const module=await readFile(join(root,'src/features/scoreboard/data.module.mjs'),'utf8');
  for(const fn of ['classify','parseGames','updateStatus','fetchScores','changeDay','selectDay']){
    assert.match(adapter,new RegExp('\\b'+fn+'\\b'));
    assert.match(module,new RegExp('(?:async\\s+)?function '+fn+'\\('));
  }
  for(const name of ['callFetchScores','callSelectDay','callParseGames','callClassify','callUpdateStatus'])assert.match(module,new RegExp(name+'\\('));
  assert.equal((module.match(/\bfetch\(endpoint,/g)||[]).length,1);
  assert.equal((module.match(/setTimeout\(\(\)=>controller\.abort\(\),14000\)/g)||[]).length,1);
  assert.doesNotMatch(module,/setInterval\s*\(/);
});
