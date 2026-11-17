import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createContext,runInContext,Script} from 'node:vm';
import {build} from '../scripts/build.mjs';
import {createEspnEndpoints} from '../src/api/espn/endpoint.module.mjs';
import {createDomLookup} from '../src/core/dom.module.mjs';
import {createEspnConfig,createScoreRequestStatus} from '../src/api/espn/config.module.mjs';
import {createEspnRefreshPolicy} from '../src/api/espn/refresh-policy.module.mjs';
import {createPollingCoordinator} from '../src/core/polling.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFile(join(root,path),'utf8');
const json=value=>JSON.parse(JSON.stringify(value));
function clock(now=1700000000000){
  class FixedDate extends Date {
    constructor(...args){super(...(args.length?args:[now]));}
    static now(){return now;}
  }
  return {Date:FixedDate,advance:ms=>{now+=ms},get now(){return now}};
}
test('endpoint and DOM factories preserve original values and element identity',async()=>{
  const context=createContext({});
  runInContext((await read('src/api/espn/endpoint.legacy.js'))+'\nglobalThis.api=API;',context);
  assert.equal(createEspnEndpoints().API,context.api);
  const element={id:'appSettingsOpen'};
  const get=createDomLookup({getElementById:id=>id===element.id?element:null});
  assert.strictEqual(get('appSettingsOpen'),element);
  assert.equal(get('missing'),null);
});
test('ESPN configuration preserves original endpoint, intervals, poll keys and instance isolation',async()=>{
  const context=createContext({});
  runInContext((await read('src/api/espn/config.legacy.js'))+
    '\nglobalThis.values={SUMMARY_API,ESPN_LIVE_SCORES_MS,ESPN_LIVE_STATS_MS,ESPN_IDLE_MS,ESPN_MAX_BACKOFF_MS,espnPoll,statsPoll};',context);
  const a=createEspnConfig(),b=createEspnConfig();
  for(const key of ['SUMMARY_API','ESPN_LIVE_SCORES_MS','ESPN_LIVE_STATS_MS','ESPN_IDLE_MS','ESPN_MAX_BACKOFF_MS'])
    assert.equal(a[key],context.values[key]);
  assert.deepEqual(json(a.espnPoll),json(context.values.espnPoll));
  assert.deepEqual(json(a.statsPoll),json(context.values.statsPoll));
  a.espnPoll.sharedUntil=9000;a.statsPoll.failures=8;
  assert.equal(b.espnPoll.sharedUntil,0);assert.equal(b.statsPoll.failures,0);
});
function createStatus(){
  const time=clock(),state={date:'2026-11-16',games:[{_phase:'live'}],nextAt:0,requestSeq:0,
    controller:null,fetchDate:null,loading:false,error:'',lastUpdated:null,firstLoaded:false};
  const espnPoll={sharedUntil:0,scoreFailures:0};
  const status=createScoreRequestStatus({state,espnPoll,AbortController,Date:time.Date,
    getScoresRefreshMs:()=>state.games.some(g=>g._phase==='live')?10000:60000,
    getBackoff:n=>30000*Math.pow(2,Math.max(0,n-1))});
  return {status,state,espnPoll,time};
}
test('request status begins, succeeds and schedules the same 10-second interval',()=>{
  const {status,state,espnPoll,time}=createStatus();
  const {seq,controller}=status.begin();
  assert.equal(seq,1);assert.strictEqual(state.controller,controller);
  assert.equal(state.loading,true);assert.equal(state.fetchDate,state.date);assert.equal(state.error,'');
  status.succeeded();
  assert.equal(state.lastUpdated.getTime(),time.now);assert.equal(state.firstLoaded,true);
  assert.equal(espnPoll.scoreFailures,0);
  assert.equal(status.complete(seq),true);assert.equal(state.nextAt,time.now+10000);
  assert.equal(state.loading,false);assert.equal(state.controller,null);assert.equal(state.fetchDate,null);
});
test('request status preserves cooldown, backoff, AbortError message, Infinity and manual error',()=>{
  const {status,state,espnPoll,time}=createStatus();
  const first=status.begin();status.incrementFailure();status.recordError(new Error('HTTP 503'));
  espnPoll.sharedUntil=time.now+90000;
  assert.equal(status.complete(first.seq),true);
  assert.equal(state.nextAt,time.now+90000);assert.equal(state.error,'HTTP 503');
  status.rateLimited(true);assert.match(state.error,/temporarily rate-limited/);
  state.nextAt=Infinity;status.rateLimited(false);assert.equal(state.nextAt,Infinity);
  const second=status.begin();status.incrementFailure();status.recordError({name:'AbortError',message:'aborted'});
  assert.equal(state.error,'The request timed out. Please retry.');
  espnPoll.sharedUntil=0;status.complete(second.seq);
  assert.equal(state.nextAt,time.now+60000);
});
test('stale request completion cannot overwrite newer request fields',()=>{
  const {status,state}=createStatus();
  const old=status.begin(),current=status.begin();
  assert.equal(status.complete(old.seq),false);
  assert.equal(state.loading,true);assert.strictEqual(state.controller,current.controller);
  assert.equal(state.requestSeq,2);
  assert.equal(status.complete(current.seq),true);assert.equal(state.loading,false);
});
async function refreshStory(kind){
  const time=clock(),state={date:'2026-11-16',games:[],lastUpdated:null};
  const viewerState={liveGames:[],statsCache:new Map(),statsPending:new Map(),statsOpen:true,gameId:'live'};
  const espnPoll={sharedUntil:0},statsPoll={gameId:'live',nextAt:0,failures:0};
  const doc={hidden:false},viewer={hidden:false};let calls=0;
  const deps={state,viewerState,espnPoll,statsPoll,today:()=> '2026-11-16',document:doc,$:()=>viewer,
    Date:time.Date,ESPN_LIVE_SCORES_MS:10000,ESPN_LIVE_STATS_MS:15000,ESPN_IDLE_MS:60000,
    updateStatsSidebar:()=>{calls++}};
  let policy;
  if(kind==='modern')policy=createEspnRefreshPolicy(deps);
  else {
    const context=createContext(deps);
    runInContext((await read('src/api/espn/refresh-policy.legacy.js'))+
      '\nglobalThis.api={phaseForGameId,scoresRefreshMs,statsRefreshMs,resetStatsPollFor,statsNeedsRequest,selectedStatsDueAt,refreshSelectedStatsIfDue};',context);
    policy=context.api;
  }
  const result=[];
  const note=()=>result.push([policy.scoresRefreshMs(),policy.statsRefreshMs('live'),policy.selectedStatsDueAt()]);
  note();
  state.games=[{id:'live',_phase:'live'},{id:'final',_phase:'final'}];note();
  viewerState.statsCache.set('live',{phase:'live',at:time.now-15000,data:{}});note();
  policy.refreshSelectedStatsIfDue();result.push(calls);
  statsPoll.nextAt=time.now+30000;espnPoll.sharedUntil=time.now+60000;note();
  doc.hidden=true;note();doc.hidden=false;
  viewer.hidden=true;note();viewer.hidden=false;
  policy.resetStatsPollFor('final');viewerState.gameId='final';
  viewerState.statsCache.set('final',{phase:'final',at:time.now,data:{}});note();
  state.date='2026-11-15';state.games=[{id:'final',_phase:'final'}];state.lastUpdated=new time.Date();note();
  return result;
}
test('refresh policy matches legacy across phase, final snapshot, cache, cooldown and visibility',async()=>{
  const a=await refreshStory('modern'),b=await refreshStory('legacy');
  assert.deepEqual(a,b);assert.equal(a[1][0],10000);assert.equal(a.at(-1)[0],Infinity);
});
async function pollStory(kind){
  const time=clock(),state={loading:false,nextAt:0},espnPoll={sharedUntil:0};
  const standingsState={pending:null,at:0},document={hidden:true},viewer={hidden:true};
  let view='standings';const events=[];
  const deps={document,Date:time.Date,state,espnPoll,standingsState,STANDINGS_TTL_MS:300000,
    $:()=>viewer,getMainView:()=>view,fetchScores:()=>events.push('scores'),
    refreshSelectedStatsIfDue:()=>events.push('stats'),fetchStandings:()=>events.push('standings'),
    updateStatus:()=>events.push('status')};
  let run;
  if(kind==='modern')run=createPollingCoordinator(deps).runAdaptivePolls;
  else{
    const context=createContext({...deps,mainView:view});
    const code=(await read('src/core/polling-bootstrap.legacy.js')).split("  document.addEventListener('visibilitychange'")[0];
    runInContext(code+'\nglobalThis.poll=runAdaptivePolls;',context);
    run=()=>{context.mainView=view;context.poll()};
  }
  const step=()=>{run();events.push('|')};
  step();document.hidden=false;step();espnPoll.sharedUntil=time.now+40000;step();
  view='scores';espnPoll.sharedUntil=0;state.loading=true;step();
  state.loading=false;viewer.hidden=false;view='standings';standingsState.at=time.now;step();
  return events;
}
test('adaptive polling preserves visibility, cooldown, standings TTL and status ticks',async()=>{
  const modern=await pollStory('modern'),legacy=await pollStory('legacy');
  assert.deepEqual(modern,legacy);assert.deepEqual(modern.slice(0,2),['status','|']);
  assert.ok(modern.includes('scores'));assert.ok(modern.includes('standings'));
});
test('five source modules build into one classic script and retain frozen 1.6.1 proof',async()=>{
  const modern=await build(),html=await readFile(modern.path,'utf8');
  for(const name of ['CourtsideEspnEndpoints','CourtsideDom','CourtsideEspnConfig','CourtsideEspnRefreshPolicy','CourtsidePollCoordinator'])
    assert.match(html,new RegExp(name));
  assert.match(html,/scoreRequestStatus\.complete\(seq\)/);
  assert.equal((html.match(/<script\b/gi)||[]).length,1);
  assert.doesNotMatch(html,/<script[^>]+\bsrc\s*=/i);
  assert.doesNotMatch(html,/<script[^>]+\btype\s*=\s*["']module/i);
  const code=html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(code);assert.doesNotThrow(()=>new Script(code[1]));
  const legacy=await build({verifyBaseline:true});
  const original=await readFile(join(root,'baseline/courtside_1.6.1.html'));
  assert.ok((await readFile(legacy.path)).equals(original));
  assert.equal(await readFile(modern.path,'utf8'),html);
});
