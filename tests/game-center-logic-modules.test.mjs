import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {createGameSummary} from '../src/api/espn/game-summary.module.mjs';
import {createGameCenterController} from '../src/features/game-center/controller.module.mjs';
import {registerGameCenterHandlers} from '../src/features/game-center/handlers.module.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=path=>readFile(join(root,path),'utf8');
const copy=obj=>JSON.parse(JSON.stringify(obj));
const tick=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
class Clock extends Date {
  constructor(...args){super(...(args.length?args:[1794859200000]));}
  static now(){return 1794859200000;}
}
async function summaryEnv(modern){
  const id='401000002',pending=[],requests=[],events=[],timers=new Map();
  let nextTimer=0,phase='live';
  const viewerState={statsCache:new Map(),statsPending:new Map(),gameId:id};
  const statsPoll={gameId:id,nextAt:0,failures:0};
  const espnPoll={sharedUntil:0};
  const deps={
    viewerState,statsPoll,espnPoll,Date:Clock,AbortController,encodeURIComponent,
    SUMMARY_API:'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary',
    setTimeout:(fn,ms)=>{const timer=++nextTimer;timers.set(timer,{fn,ms});return timer;},
    clearTimeout:id=>timers.delete(id),
    statsNeedsRequest:(requested,force)=>{
      if(force)return true;
      const cached=viewerState.statsCache.get(requested);
      if(!cached)return true;
      return phase==='final'?cached.phase!=='final':Clock.now()-cached.at>=15000;
    },
    phaseForGameId:()=>phase,
    auditESPNJob:async(meta,fn)=>{events.push(['audit',meta.source,meta.resource,meta.priority]);return fn(()=>events.push(['report']));},
    fetch:(url,opts)=>{requests.push({url:String(url),signal:opts.signal,cache:opts.cache});const d=deferred();pending.push(d);return d.promise;},
    noteEspnResponseError:(res,label)=>events.push(['responseError',res.status,label]),
    dataLogObserve:(json,key)=>events.push(['dataLog',key]),
    dataLogSummaryRecords:()=>[],
    dataLogInvalid:()=>events.push(['dataLogInvalid']),
    exponentialBackoff:()=>30000
  };
  let api;
  if(modern)api=createGameSummary(deps);
  else{
    const ctx=createContext({...deps});
    runInContext((await source('src/api/espn/game-summary.legacy.js'))+'\nglobalThis.api={fetchGameSummary};',ctx);
    api=ctx.api;
  }
  return {id,api,pending,requests,events,timers,viewerState,statsPoll,espnPoll,setPhase:p=>{phase=p;}};
}
async function summarySuccess(modern){
  const h=await summaryEnv(modern);
  const first=h.api.fetchGameSummary(h.id),again=h.api.fetchGameSummary(h.id),force=h.api.fetchGameSummary(h.id,true);
  await tick();
  const queued={requestCount:h.requests.length,pending:h.viewerState.statsPending.size,
    timerMs:[...h.timers.values()].map(x=>x.ms),events:copy(h.events)};
  h.pending[0].resolve({ok:true,status:200,json:async()=>({header:{id:h.id},boxscore:{players:[]}})});
  const results=await Promise.all([first,again,force]);
  const resultIdentity=results[0]===results[1]&&results[1]===results[2];
  const afterSuccess={requests:h.requests.length,phase:h.viewerState.statsCache.get(h.id)?.phase,
    pending:h.viewerState.statsPending.size,timerCount:h.timers.size,events:copy(h.events),resultIdentity};
  const cached=await h.api.fetchGameSummary(h.id);
  h.setPhase('final');
  const final=h.api.fetchGameSummary(h.id);
  await tick();
  h.pending[1].resolve({ok:true,status:200,json:async()=>({header:{id:h.id,final:true}})});
  await final;
  const finalCached=await h.api.fetchGameSummary(h.id);
  return {queued,afterSuccess,cached:cached.header.id,
    finalCached:finalCached.header.final,finalRequests:h.requests.length,
    finalPhase:h.viewerState.statsCache.get(h.id)?.phase};
}
test('Game Center summary dedup, 9s timer, audit priority, cache and final snapshot match 1.6.1',async()=>{
  const old=await summarySuccess(false),mod=await summarySuccess(true);
  assert.deepEqual(mod,old);
  assert.equal(mod.queued.requestCount,1);
  assert.deepEqual(mod.queued.timerMs,[9000]);
  assert.equal(mod.queued.events[0][3],1);
  assert.equal(mod.afterSuccess.resultIdentity,true);
  assert.equal(mod.finalRequests,2);
  assert.equal(mod.finalPhase,'final');
});
async function summaryFailures(modern){
  const h=await summaryEnv(modern);
  const errors=[];
  const first=h.api.fetchGameSummary(h.id);await tick();
  h.pending[0].resolve({ok:false,status:503,headers:{get:()=>null}});
  try{await first;}catch(e){errors.push(e.message);}
  try{await h.api.fetchGameSummary(h.id);}catch(e){errors.push(e.message);}
  const afterError={count:h.requests.length,failures:h.statsPoll.failures,nextAt:h.statsPoll.nextAt,
    pending:h.viewerState.statsPending.size,events:copy(h.events)};
  h.statsPoll.nextAt=0;
  const recovery=h.api.fetchGameSummary(h.id);await tick();
  h.pending[1].resolve({ok:true,status:200,json:async()=>({ok:true})});
  await recovery;
  h.viewerState.statsCache.clear();h.espnPoll.sharedUntil=Clock.now()+60000;
  try{await h.api.fetchGameSummary(h.id,true);}catch(e){errors.push(e.message);}
  return {errors,afterError,recovered:{failures:h.statsPoll.failures,nextAt:h.statsPoll.nextAt,
    pending:h.viewerState.statsPending.size,requests:h.requests.length}};
}
test('summary HTTP failures, retry backoff and shared cooldown preserve 1.6.1 behavior',async()=>{
  const a=await summaryFailures(false),b=await summaryFailures(true);
  assert.deepEqual(b,a);
  assert.match(b.errors[0],/503/);
  assert.match(b.errors[1],/waiting for retry/);
  assert.match(b.errors[2],/rate limit cooldown/);
  assert.equal(b.afterError.failures,1);
  assert.equal(b.afterError.pending,0);
  assert.equal(b.recovered.requests,2);
});
async function controllerEnv(modern){
  const gameA={id:'401',_phase:'live'},gameB={id:'402',_phase:'live'};
  const state={games:[gameA,gameB]},viewerState={
    gameId:'401',statsOpen:true,statsSeq:0,statsTab:'box',statsCache:new Map([['401',{data:{v:'cached'}}]]),statsError:''
  };
  const espnPoll={sharedUntil:0},statsPoll={nextAt:0};
  const elements=new Map(),events=[],pending=[];
  const $=id=>{
    if(!elements.has(id))elements.set(id,{id,hidden:id==='viewer'?false:false,innerHTML:'',scrollTop:30});
    return elements.get(id);
  };
  const deps={
    $,viewerState,statsPoll,espnPoll,Date:Clock,
    getState:()=>state,
    gameStore:{findGame:id=>state.games.find(g=>g.id===id)},
    resetStatsPollFor:id=>events.push(['reset',id]),
    renderStats:(game,summary)=>events.push(['renderStats',game?.id,summary?.v]),
    statsNeedsRequest:()=>true,
    fetchGameSummary:(id,force)=>{events.push(['fetchSummary',id,force]);const d=deferred();pending.push(d);return d.promise;},
    paintViewer:()=>events.push(['paintViewer'])
  };
  let api;
  if(modern)api=createGameCenterController(deps);
  else{
    const ctx=createContext({...deps,state});
    runInContext((await source('src/features/game-center/controller.legacy.js'))+'\nglobalThis.api={updateStatsSidebar,setStatsTab};',ctx);
    api=ctx.api;
  }
  return {api,viewerState,state,espnPoll,statsPoll,$,events,pending};
}
async function controllerTrace(modern){
  const h=await controllerEnv(modern),{api}=h;
  api.setStatsTab('bad');api.setStatsTab('charts');
  const tab={tab:h.viewerState.statsTab,scroll:h.$('statsContent').scrollTop};
  h.viewerState.gameId=null;
  await api.updateStatsSidebar();
  const blank=h.$('statsContent').innerHTML;
  h.viewerState.gameId='401';
  const pending=api.updateStatsSidebar(true);await tick();
  const stale=api.updateStatsSidebar(true);await tick();
  h.pending[1].resolve({v:'new'});await stale;
  const afterNew=copy(h.events);
  h.pending[0].resolve({v:'old'});await pending;
  const afterStale=copy(h.events);
  h.espnPoll.sharedUntil=Clock.now()+60000;
  await api.updateStatsSidebar(true);
  const cooled={error:h.viewerState.statsError,calls:h.pending.length};
  h.$('viewer').hidden=true;
  await api.updateStatsSidebar(true);
  return {tab,blank,afterNew,afterStale,cooled,all:copy(h.events)};
}
test('Game Center controller sidebar, tabs, stale tokens and cooldown preserve original behavior',async()=>{
  const original=await controllerTrace(false),module=await controllerTrace(true);
  assert.deepEqual(module,original);
  assert.equal(module.tab.tab,'charts');
  assert.equal(module.tab.scroll,0);
  assert.match(module.blank,/Choose an NBA game/);
  assert.equal(module.afterStale.length,module.afterNew.length);
  assert.equal(module.cooled.calls,2);
  assert.equal(module.cooled.error,'ESPN rate limited');
});
async function handlersTrace(modern){
  const listeners=new Map(),events=[],requestedFrames=[],observerEntries=[];
  const state={games:[{id:'401'}]},viewerState={gameId:'401',statsCache:new Map([['401',{data:{id:'data'}}]]),
    boxTeam:null,boxSort:'pts',boxSortDesc:true,boxWide:false,statsTab:'box',statsOpen:true};
  const $=id=>({
    hidden:false,querySelector:()=>({focus:()=>events.push(['focus'])}),
    addEventListener(type,fn){listeners.set(type,fn);},
  });
  const deps={ $,viewerState,state,Math,
    ResizeObserver:class {constructor(fn){this.callback=fn;observerEntries.push(this);}observe(){}},
    requestAnimationFrame:fn=>{requestedFrames.push(fn);return requestedFrames.length;},
    cancelAnimationFrame:id=>events.push(['cancel',id]),
    setStatsTab:tab=>events.push(['tab',tab]),
    setChartView:kind=>events.push(['chart',kind]),
    inspectShot:id=>events.push(['shot',id]),
    renderStats:game=>events.push(['render',game?.id]),
    chartInput:e=>events.push(['chartInput',e.type]),
    inspectChartPointer:e=>events.push(['pointer',e.type]),
    chartKeydown:e=>events.push(['chartKeydown',e.key])
  };
  if(modern){
    let width=0,frame=0;
    registerGameCenterHandlers({...deps,getState:()=>state,
      getChartResizeWidth:()=>width,setChartResizeWidth:v=>{width=v;},
      getChartResizeFrame:()=>frame,setChartResizeFrame:v=>{frame=v;}});
  }else{
    const ctx=createContext(deps);
    runInContext(await source('src/features/game-center/handlers.legacy.js'),ctx);
  }
  function match(selector,attr,value){
    return {target:{closest:s=>s===selector?{dataset:{[attr]:value}}:null}};
  }
  const click=listeners.get('click');
  click(match('button[data-bs-team]','bsTeam','home'));
  click(match('button[data-bs-sort]','bsSort','pts'));
  click({target:{closest:s=>s==='#bsWideToggle'?{}:null}});
  click(match('button[data-bs-tab]','bsTab','team'));
  click(match('button[data-cs-view]','csView','shots'));
  click(match('[data-cs-shot]','csShot','p1'));
  listeners.get('input')({type:'input'});
  listeners.get('change')({type:'change'});
  listeners.get('pointermove')({type:'pointermove'});
  listeners.get('pointerdown')({type:'pointerdown'});
  const key={key:'ArrowRight',preventDefault:()=>events.push(['preventDefault']),
    target:{closest:s=>s==='[data-bs-tab]'?{dataset:{bsTab:'box'}}:null}};
  listeners.get('keydown')(key);
  viewerState.statsTab='charts';
  observerEntries[0].callback([{contentRect:{width:600}}]);
  requestedFrames[0]?.();
  observerEntries[0].callback([{contentRect:{width:600}}]);
  observerEntries[0].callback([{contentRect:{width:630}}]);
  return {events:copy(events),sort:viewerState.boxSort,desc:viewerState.boxSortDesc,
    team:viewerState.boxTeam,wide:viewerState.boxWide,
    frames:requestedFrames.length,resizeObservers:observerEntries.length};
}
test('Game Center delegated team/sort/chart/keyboard handlers and resize observer mirror 1.6.1',async()=>{
  const before=await handlersTrace(false),after=await handlersTrace(true);
  assert.deepEqual(after,before);
  assert.equal(after.team,'home');
  assert.equal(after.wide,true);
  assert.equal(after.frames,2);
  assert.equal(after.resizeObservers,1);
  assert.ok(after.events.some(x=>x[0]==='tab'));
});
