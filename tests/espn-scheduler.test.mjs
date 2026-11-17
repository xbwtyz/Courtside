import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { createEspnScheduler } from '../src/api/espn/request-scheduler.module.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const legacySource = await readFile(join(root, 'src/api/espn/request-scheduler.legacy.js'), 'utf8');
const sleepMicrotasks = async () => { for(let i=0;i<12;i++)await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}; };

function fakeClock(start=10_000) {
  let now=start, nextId=0;
  const timers=new Map();
  class Clock extends Date {
    constructor(...args){super(...(args.length?args:[now]));}
    static now(){return now;}
  }
  return {
    Clock,
    setTimeout(fn,delay){const id=++nextId;timers.set(id,{at:now+Math.max(0,delay),fn});return id;},
    clearTimeout(id){timers.delete(id);},
    advance(delta){
      const end=now+delta;
      for(let steps=0;steps<100;steps++){
        const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0]);
        if(!due.length)break;
        const [id,t]=due[0];timers.delete(id);now=t.at;t.fn();
      }
      now=end;
    },
    pending(){return [...timers.values()].map(t=>t.at-now);},
    get now(){return now;},
  };
}

function setup(kind='modern') {
  const timer=fakeClock();
  const espnPoll={sharedUntil:0,scoreFailures:0};
  const statsPoll={failures:0};
  const deps={espnPoll,statsPoll,ESPN_MAX_BACKOFF_MS:300000,Date:timer.Clock,Promise,setTimeout:timer.setTimeout,clearTimeout:timer.clearTimeout};
  let api;
  if(kind==='modern')api=createEspnScheduler(deps);
  else {
    const context=createContext(deps);
    runInContext(legacySource+'\nglobalThis.testApi = {requestESPN, exponentialBackoff, retryAfterMs, noteEspnResponseError};',context);
    api=context.testApi;
  }
  return {api,timer,espnPoll,statsPoll};
}

async function simulateQueues(kind) {
  const {api,timer}=setup(kind);
  const trace=[], running=new Set();
  let max=0;
  function job(name,gate){
    return ()=>{running.add(name);max=Math.max(max,running.size);trace.push('start:'+name);
      return gate.promise.finally(()=>{running.delete(name);trace.push('end:'+name);});};
  }
  const first=deferred(), next=deferred(), leader=deferred(), leader2=deferred(), highWhileLeader=deferred();
  const p1=api.requestESPN(job('score1',first),0);
  const p2=api.requestESPN(job('leader1',leader),3);
  const p3=api.requestESPN(job('score2',next),0);
  const p4=api.requestESPN(job('leader2',leader2),3);
  await sleepMicrotasks();
  assert.deepEqual(trace,['start:score1'],'Only first high-priority request starts initially');
  first.resolve('a');await p1;await sleepMicrotasks();
  assert.deepEqual(trace.slice(0,3),['start:score1','end:score1','start:score2']);
  next.resolve('b');await p3;await sleepMicrotasks();
  assert.ok(trace.includes('start:leader1'),'Leader starts after high lane drains');
  const p5=api.requestESPN(job('scoreWhileLeader',highWhileLeader),0);
  await sleepMicrotasks();
  assert.ok(trace.includes('start:scoreWhileLeader'),'New live score can bypass a slow leaderboard');
  assert.ok(!trace.includes('start:leader2'),'Second leaderboard cannot overlap the first');
  assert.equal(max,2,'No more than two in-flight ESPN jobs');
  highWhileLeader.resolve('e');await p5;await sleepMicrotasks();
  leader.resolve('c');await p2;await sleepMicrotasks();
  assert.ok(!trace.includes('start:leader2'),'Leaders paced at least 2.6 seconds apart');
  assert.ok(timer.pending().some(t=>t===2600),'Second leader should be scheduled after 2600ms');
  timer.advance(2599);await sleepMicrotasks();
  assert.ok(!trace.includes('start:leader2'));
  timer.advance(1);await sleepMicrotasks();
  assert.ok(trace.includes('start:leader2'));
  leader2.resolve('d');await p4;await sleepMicrotasks();
  return {trace,max};
}

test('ESPN scheduler preserves high-priority ordering and two-request concurrency under blocked background jobs',async()=>{
  const a=await simulateQueues('modern');
  const b=await simulateQueues('legacy');
  assert.deepEqual(a,b,'Modern and legacy queue execution order must match');
  assert.equal(a.max,2);
});

test('ESPN scheduler preserves retry-after seconds, HTTP dates, cap, 429/503 and cooldown',async()=>{
  for(const kind of ['modern','legacy']){
    const {api,timer,espnPoll,statsPoll}=setup(kind);
    assert.deepEqual([0,1,2,3,4,10].map(api.exponentialBackoff),[30000,30000,60000,120000,240000,300000]);
    assert.equal(api.retryAfterMs(' 4 '),4000);
    assert.equal(api.retryAfterMs('0'),0);
    assert.equal(api.retryAfterMs('nonsense'),0);
    assert.equal(api.retryAfterMs(new Date(timer.now+180000).toUTCString()),180000);
    api.noteEspnResponseError({status:500,headers:{get:()=>null}},'scores');
    assert.equal(espnPoll.sharedUntil,0,'500 without Retry-After does not initiate shared throttle');
    api.noteEspnResponseError({status:503,headers:{get:()=>null}},'stats');
    assert.equal(espnPoll.sharedUntil,0,'503 without Retry-After does not initiate shared throttle');
    api.noteEspnResponseError({status:429,headers:{get:()=> '45'}},'scores');
    assert.equal(espnPoll.sharedUntil,timer.now+45000);
    let called=false;
    await assert.rejects(api.requestESPN(()=>{called=true},0),/rate limited/);
    assert.equal(called,false);
    timer.advance(45001);
    assert.equal(await api.requestESPN(()=>{called=true;return 'recovered';},0),'recovered');
    assert.equal(called,true);
    statsPoll.failures=3;
    api.noteEspnResponseError({status:503,headers:{get:()=> '2'}},'stats');
    assert.equal(espnPoll.sharedUntil,timer.now+240000,'Backoff must override shorter Retry-After');
  }
});

test('failed high-priority work releases its queue slot for later jobs',async()=>{
  for(const kind of ['modern','legacy']){
    const {api}=setup(kind);
    const gate=deferred();
    const result=[];
    const failed=api.requestESPN(()=>gate.promise,0);
    const subsequent=api.requestESPN(()=>{result.push('ran');return 'ok'},0);
    gate.reject(new Error('Simulated ESPN failure'));
    await assert.rejects(failed,/Simulated ESPN failure/);
    assert.equal(await subsequent,'ok');
    assert.deepEqual(result,['ran']);
  }
});

test('two scheduler instances isolate queue and cooldown state',async()=>{
  const a=setup('modern'),b=setup('modern');
  a.espnPoll.sharedUntil=a.timer.now+99999;
  await assert.rejects(a.api.requestESPN(()=>123,0),/rate limited/);
  assert.equal(await b.api.requestESPN(()=>456,0),456);
  assert.equal(b.espnPoll.sharedUntil,0);
});

test('migrated source is isolated and exposes only the four legacy callable contracts',async()=>{
  const code=await readFile(join(root,'src/api/espn/request-scheduler.module.mjs'),'utf8');
  const adapter=await readFile(join(root,'src/api/espn/request-scheduler.js'),'utf8');
  assert.match(code,/export function createEspnScheduler\(/);
  assert.match(code,/return \{ requestESPN, exponentialBackoff, retryAfterMs, noteEspnResponseError \}/);
  assert.match(adapter,/CourtsideEspnScheduler\.createEspnScheduler/);
  assert.doesNotMatch(code,/\b(?:document|window|viewerState|localStorage)\b|\bfetch\s*\(/);
});
