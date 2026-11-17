import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { createDataLog } from '../src/features/data-log/core.module.mjs';
import { attachDataLogControls } from '../src/features/data-log/controls.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const json=v=>JSON.parse(JSON.stringify(v));
function environment() {
  const intervals=[], calls=[], elements=new Map();
  const $=id=>{
    if(!elements.has(id))elements.set(id,{hidden:id==='dataLogView'});
    return elements.get(id);
  };
  const dependencies={
    $,document:{hidden:true},window:{innerHeight:800,scrollBy(){}},
    performance:{now:()=>20},Date,URL,Blob,Map,WeakMap,
    setInterval:(_fn,ms)=>{intervals.push(ms);return intervals.length;},
    setTimeout:()=>1,clearTimeout:()=>{},
    requestESPN:async(work,priority)=>{calls.push(priority);return work();},
    parsePlayerBoxscore:()=>[],gameStatValues:()=>({}),standStat:()=>null,
    parseTeamSchedule:()=>[],extractPlayerStats:()=>({}),parsePlayerGameLog:()=>[],
    safe:value=>String(value)
  };
  return {dependencies,intervals,calls};
}
async function engine(mode) {
  const env=environment();
  if(mode==='modern')return {api:createDataLog(env.dependencies),...env};
  const context=createContext(env.dependencies);
  const legacy=await readFile(join(root,'src/features/data-log/core.legacy.js'),'utf8');
  runInContext(legacy+'\n globalThis.dataLogApi={dataLog,DATA_LOG_LIMIT,DATA_LOG_CHANGE_LIMIT,DATA_LOG_SNAPSHOT_SCOPES,DATA_LOG_SNAPSHOT_RECORDS,DATA_LOG_SNAPSHOT_BYTES,DATA_LOG_SNAPSHOT_IDLE_MS,DATA_LOG_UI_BATCH_MS,DATA_LOG_PERF_SAMPLE_LIMIT,auditESPNJob,dataLogCompare,dataLogObserve,dataLogInvalid,dataLogScoreRecords,dataLogPerformanceText};',context);
  return {api:context.dataLogApi,...env};
}
function snapshot(api) {
  return {
    entries:json(api.dataLog.entries.map(({at,...entry})=>entry)),
    dropped:api.dataLog.dropped,
    snapshots:json([...api.dataLog.snapshots].map(([key,records])=>[key,[...records]])),
    snapshotBytes:api.dataLog.snapshotBytes,
    snapshotRecords:api.dataLog.snapshotRecords,
    snapshotEvictions:api.dataLog.snapshotEvictions,
    snapshotOversize:api.dataLog.snapshotOversize,
    compareMs:json(api.dataLog.compareMs),
    uiRenders:api.dataLog.uiRenders
  };
}
async function scenario(which) {
  const fixture=await engine(which),a=fixture.api;
  assert.equal(fixture.intervals.length,1,'keep only the original five-second diagnostics interval');
  assert.equal(fixture.intervals[0],5000);
  const records=[{id:1,label:'Player',fields:{PTS:10,AST:2}}];
  for(const [n,points] of [[0,10],[1,10],[2,13]]) {
    const payload={n};
    const returned=await a.auditESPNJob({source:'Standings',resource:'standings',url:'https://example.com/standings',priority:1},
      response=>{response({status:200});return payload;});
    assert.strictEqual(returned,payload);
    a.dataLogCompare(payload,'standings',records.map(r=>({...r,fields:{...r.fields,PTS:points}})));
  }
  a.dataLog.paused=true;
  const pausedPayload={paused:true};
  await a.auditESPNJob({source:'Standings',resource:'standings',url:'https://example.com/standings',priority:2},
    response=>{response({status:200});return pausedPayload;});
  a.dataLogCompare(pausedPayload,'standings',[{id:1,label:'Player',fields:{PTS:19,AST:2}}]);
  a.dataLog.paused=false;
  const failedPayload={bad:true};
  await a.auditESPNJob({source:'League Leaders',resource:'leaders',url:'https://example.com/leaders',priority:2},
    response=>{response({status:200});return failedPayload;});
  a.dataLogInvalid(failedPayload,new Error('bad schema'));
  assert.equal(fixture.calls.length,5,'one queue invocation per audited operation, no extra calls');
  return {snapshot:snapshot(a),calls:fixture.calls,performance:a.dataLogPerformanceText()};
}
test('Data Log module mirrors original audit outcomes, snapshots, paused baselines and error handling',async()=>{
  const legacy=await scenario('legacy'),modern=await scenario('modern');
  assert.deepEqual(modern,legacy);
  assert.deepEqual(modern.snapshot.entries.map(e=>e.outcome),['error','received','changed','unchanged','baseline']);
});
test('snapshot cap, semantic score records, and constants are unchanged',async()=>{
  const old=(await engine('legacy')).api,modern=(await engine('modern')).api;
  for(const name of ['DATA_LOG_LIMIT','DATA_LOG_CHANGE_LIMIT','DATA_LOG_SNAPSHOT_SCOPES',
    'DATA_LOG_SNAPSHOT_RECORDS','DATA_LOG_SNAPSHOT_BYTES','DATA_LOG_SNAPSHOT_IDLE_MS',
    'DATA_LOG_UI_BATCH_MS','DATA_LOG_PERF_SAMPLE_LIMIT'])assert.equal(modern[name],old[name]);
  const games=[{id:'123',_phase:'live',status:{period:2},competitions:[{competitors:[
    {homeAway:'away',team:{abbreviation:'SEA',displayName:'Seattle'},score:'12'},
    {homeAway:'home',team:{abbreviation:'NY',displayName:'New York'},score:'16'}
  ]}]}];
  assert.deepEqual(json(modern.dataLogScoreRecords(games)),json(old.dataLogScoreRecords(games)));
  const oversize=Array.from({length:8001},(_,id)=>({id,label:'x',fields:{PTS:id}}));
  modern.dataLogCompare(null,'oversize',oversize);
  old.dataLogCompare(null,'oversize',oversize);
  assert.deepEqual(snapshot(modern),snapshot(old));
  assert.equal(modern.dataLog.snapshotOversize,1);
  assert.equal(modern.dataLog.snapshots.size,0);
});
test('Data Log UI controls preserve filter, pause, clear cancellation and export without network calls',()=>{
  const handlers={};let renders=0,exports=0,allowed=false;
  const log={source:'all',outcome:'all',search:'',shown:50,paused:false,entries:[{id:1}],dropped:4};
  attachDataLogControls({
    $:id=>({addEventListener:(type,callback)=>{handlers[id+':'+type]=callback;}}),
    dataLog:log,renderDataLog:()=>renders++,dataLogExport:()=>exports++,confirm:()=>allowed
  });
  handlers['dataLogSource:change']({target:{value:'Player Profile'}});
  assert.equal(log.source,'Player Profile');
  log.shown=100;
  handlers['dataLogOutcome:change']({target:{value:'changed'}});
  assert.equal(log.outcome,'changed');assert.equal(log.shown,50);
  handlers['dataLogSearch:input']({target:{value:'   points   '}});
  assert.equal(log.search,'points');
  handlers['dataLogPause:click']();assert.equal(log.paused,true);
  handlers['dataLogMore:click']();assert.equal(log.shown,100);
  handlers['dataLogClear:click']();assert.equal(log.entries.length,1);
  allowed=true;handlers['dataLogClear:click']();
  assert.equal(log.entries.length,0);assert.equal(log.dropped,0);assert.equal(log.shown,50);
  handlers['dataLogExport:click']();
  assert.equal(exports,1);assert.equal(renders,6);
});
test('Data Log adapters retain every declared legacy binding and do not introduce direct fetches',async()=>{
  const core=await readFile(join(root,'src/features/data-log/core.js'),'utf8');
  const controls=await readFile(join(root,'src/features/data-log/controls.js'),'utf8');
  for(const name of ['auditESPNJob','dataLogObserve','dataLogInvalid','dataLogScoreRecords',
    'dataLogSummaryRecords','dataLogStandingsRecords','dataLogTeamRecords',
    'dataLogPlayerRecords','dataLogLeadersRecords','renderDataLogPerformance','renderDataLog','dataLogExport'])
    assert.match(core,new RegExp('\\b'+name+'\\b'));
  assert.match(controls,/attachDataLogControls/);
  const service=await readFile(join(root,'src/features/data-log/core.module.mjs'),'utf8');
  assert.doesNotMatch(service,/\bfetch\s*\(/);
  assert.doesNotMatch(service,/\bsetInterval\s*\([^)]*requestESPN/);
});
