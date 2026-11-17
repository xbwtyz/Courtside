import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {createStreamProviderConfig} from '../src/api/streams/config.module.mjs';
import {createStreamRequests} from '../src/api/streams/requests.module.mjs';
import {createStreamMatching} from '../src/api/streams/matching.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const copy=v=>JSON.parse(JSON.stringify(v));
const date='2026-11-16T20:00:00Z',kickoff=Date.parse(date)/1000;
const ppvURL='https://stream.example.org/nba-player';
const auraURL='https://aurasports.xyz/embed/nba';
const matchoraURL='https://matchora.to/embed/match/987';
function game(){
  return {id:'401',date,_phase:'live',competitions:[{competitors:[
    {homeAway:'away',team:{id:'2',abbreviation:'BOS',name:'Celtics',displayName:'Boston Celtics'}},
    {homeAway:'home',team:{id:'18',abbreviation:'NYK',name:'Knicks',displayName:'New York Knicks'}}
  ]}]};
}
const ppv=()=>({name:'Boston Celtics at New York Knicks',starts_at:kickoff,tag:'Main',
  iframe:ppvURL,substreams:[{name:'duplicate',iframe:ppvURL},{name:'Alternate',iframe:'https://stream.example.org/alt'}]});
const aura=()=>({match_id:'espn-401',title:'Boston Celtics at New York Knicks',sources:[{name:'One',url:auraURL}]});
const matchora=()=>({league:'NBA',away:'Boston Celtics',home:'New York Knicks',kickoff,
  embed_url:matchoraURL,channels:[{name:'HD',lang:'English',quality:'HD',embed_url:'https://matchora.to/embed/channel/321'}]});
function environment(){
  let now=1800000000000;
  class Clock extends Date {static now(){return now;}}
  class AbortStub {constructor(){this.signal={};}abort(){this.signal.aborted=true;}}
  const cfg=createStreamProviderConfig();
  const state={games:[game()]},calls=[],timeouts=[],responses=new Map();
  const cache={auraGames:new Map(),auraUpdatedAt:0,auraPending:null,
    ppvEvents:[],ppvUpdatedAt:0,ppvPending:null,
    matchoraEvents:[],matchoraUpdatedAt:0,matchoraPending:null};
  responses.set(cfg.AURA_API,[{category_name:'NBA',schedule:[aura()]},{category_name:'NHL',schedule:[aura()]}]);
  for(const url of cfg.PPV_APIS)responses.set(url,[{category:'basketball',streams:[ppv()]},{category:'football',streams:[ppv()]}]);
  for(const url of cfg.MATCHORA_APIS)responses.set(url,{events:[matchora(),{...matchora(),league:'MLB'}]});
  const fetch=async(url,opts)=>{
    calls.push({url,cache:opts.cache,mode:opts.mode||'',accept:opts.headers.Accept});
    const value=responses.get(url);
    if(value instanceof Error)throw value;
    if(!value)return {ok:false,status:503,json:async()=>null};
    return {ok:true,status:200,json:async()=>value};
  };
  return {cfg,cache,state,calls,timeouts,responses,Date:Clock,AbortController:AbortStub,URL,fetch,
    setTimeout:(fn,ms)=>{timeouts.push(ms);return timeouts.length;},clearTimeout:()=>{},
    advance:ms=>{now+=ms;}};
}
const names=['validAuraUrl','validPpvUrl','validMatchoraUrl','matchSources','matchLabel',
  'fetchAuraSchedule','flattenPpvEvents','fetchPpvStreams','fetchMatchoraSchedule',
  'normalized','nicknames','getGameTeams','teamAliases','hasAlias','ppvEventMatches',
  'ppvSourcesForGame','matchoraEventMatches','matchoraSourcesForGame','combinedSourcesForId'];
async function setup(mode) {
  const env=environment();
  if(mode==='modern'){
    const req=createStreamRequests({...env.cfg,...env,cache:env.cache});
    const matching=createStreamMatching({cache:env.cache,getGames:()=>env.state.games,
      validPpvUrl:req.validPpvUrl,validMatchoraUrl:req.validMatchoraUrl,
      matchSources:req.matchSources,Date:env.Date});
    return {...env,api:{...req,...matching}};
  }
  const ctx=createContext({...env,...env.cache});
  // The module adapters preserve the old global bindings from core/state.js.
  const source=(await Promise.all(['config','requests','matching'].map(name=>
    readFile(join(root,'src/api/streams/'+name+'.legacy.js'),'utf8')))).join('\n');
  runInContext(source+'\nglobalThis.testApi={'+names.join(',')+'};',ctx);
  const cache=Object.fromEntries(Object.keys(env.cache).map(n=>[n,undefined]));
  for(const key of Object.keys(cache)){
    Object.defineProperty(cache,key,{enumerable:true,
      get(){return ctx[key];},set(value){ctx[key]=value;}});
  }
  return {...env,cache,api:ctx.testApi};
}
function snapshot(f){
  const c=f.cache;
  return {aura:copy([...c.auraGames]),ppv:copy(c.ppvEvents),matchora:copy(c.matchoraEvents),
    updated:[c.auraUpdatedAt,c.ppvUpdatedAt,c.matchoraUpdatedAt],
    pending:[c.auraPending!==null,c.ppvPending!==null,c.matchoraPending!==null],
    calls:copy(f.calls),timeouts:copy(f.timeouts)};
}
async function scenario(mode) {
  const f=await setup(mode),a=f.api;
  const value={
    aura:copy([...await a.fetchAuraSchedule()]),
    ppv:copy(await a.fetchPpvStreams()),
    matchora:copy(await a.fetchMatchoraSchedule()),
    sources:copy(a.combinedSourcesForId('401'))
  };
  value.countInitial=f.calls.length;
  await Promise.all([a.fetchAuraSchedule(),a.fetchPpvStreams(),a.fetchMatchoraSchedule()]);
  value.countCached=f.calls.length;
  f.advance(2*60*1000+1);
  await a.fetchPpvStreams();
  value.countExpired=f.calls.length;
  value.state=snapshot(f);
  return value;
}
test('all provider caches, 2-minute TTL, PPV-first priority and matching preserve legacy behavior',async()=>{
  const original=await scenario('legacy'),modern=await scenario('modern');
  assert.deepEqual(modern,original);
  assert.deepEqual(modern.sources.map(s=>s.provider),['PPV.st','PPV.st','AuraSports','Matchora','Matchora']);
  assert.equal(modern.sources[0].url,ppvURL);
  assert.equal(modern.countInitial,3);
  assert.equal(modern.countCached,3);
  assert.equal(modern.countExpired,4);
  assert.deepEqual(modern.state.pending,[false,false,false]);
  assert.deepEqual(modern.state.timeouts,[12000,8500,10000,8500]);
});
test('URL allowlists, PPV alias/time and Matchora strict home-away pairing match original',async()=>{
  const old=await setup('legacy'),newer=await setup('modern');
  const urls=['https://aurasports.xyz/watch','http://aurasports.xyz/watch',
    'https://aurasports.xyz.evil.example/watch','https://localhost/private',
    'https://10.0.0.1/embed','https://matchora.to/embed/channel/321',
    'https://matchora.to/private','https://fake.matchora.to/embed/channel/321'];
  for(const fn of ['validAuraUrl','validPpvUrl','validMatchoraUrl'])
    for(const url of urls)assert.equal(newer.api[fn](url),old.api[fn](url),fn+' '+url);
  assert.equal(newer.api.validMatchoraUrl(matchoraURL),matchoraURL);
  assert.equal(newer.api.validMatchoraUrl('https://evil.org/embed/match/987'),'');
  assert.equal(newer.api.validPpvUrl('http://stream.example.org/nba'),'');
  for(const match of [game(),{...game(),date:'2026-11-19T20:00:00Z'},{...game(),competitions:[]}]){
    for(const event of [ppv(),{...ppv(),name:'Boston Celtics at Los Angeles Lakers'}])
      assert.equal(newer.api.ppvEventMatches(event,match),old.api.ppvEventMatches(event,match));
    for(const event of [matchora(),{...matchora(),away:'New York Knicks',home:'Boston Celtics'}])
      assert.equal(newer.api.matchoraEventMatches(event,match),old.api.matchoraEventMatches(event,match));
  }
  assert.equal(newer.api.matchoraEventMatches({...matchora(),away:'New York Knicks',home:'Boston Celtics'},game()),false);
  assert.deepEqual(copy(newer.api.matchSources(aura())),copy(old.api.matchSources(aura())));
  assert.deepEqual(copy(newer.api.flattenPpvEvents([{category:'NBA',streams:[ppv()]}])),
    copy(old.api.flattenPpvEvents([{category:'NBA',streams:[ppv()]}])));
});
test('host fallback, one concurrent network fetch and pending reset match original',async()=>{
  async function exercise(mode) {
    const f=await setup(mode),a=f.api;
    f.responses.set(f.cfg.PPV_APIS[0],new Error('first PPV host failed'));
    f.responses.set(f.cfg.MATCHORA_APIS[0],new Error('first Matchora host failed'));
    const p=a.fetchPpvStreams(),q=a.fetchPpvStreams();
    const results=await Promise.all([p,q]);
    assert.deepEqual(copy(results[0]),copy(results[1]));
    await a.fetchMatchoraSchedule();
    assert.equal(f.calls.filter(x=>x.url===f.cfg.PPV_APIS[0]).length,1);
    assert.equal(f.calls.filter(x=>x.url===f.cfg.PPV_APIS[1]).length,1);
    assert.equal(f.calls.filter(x=>x.url===f.cfg.MATCHORA_APIS[0]).length,1);
    assert.equal(f.calls.filter(x=>x.url===f.cfg.MATCHORA_APIS[1]).length,1);
    const count=f.calls.length;
    await a.fetchPpvStreams();
    assert.equal(f.calls.length,count);
    return snapshot(f);
  }
  assert.deepEqual(await exercise('modern'),await exercise('legacy'));
});
test('provider configuration, aliases and missing ESPN games retain original shape',async()=>{
  const old=await setup('legacy'),modern=await setup('modern');
  for(const key of ['AURA_API','AURA_TTL_MS','PPV_APIS','PPV_TTL_MS','MATCHORA_APIS','MATCHORA_TTL_MS'])
    assert.deepEqual(copy(old.cfg[key]),copy(modern.cfg[key]));
  assert.deepEqual(copy(old.api.teamAliases(game().competitions[0].competitors[0].team)),
    copy(modern.api.teamAliases(game().competitions[0].competitors[0].team)));
  assert.deepEqual(copy(modern.api.combinedSourcesForId('does-not-exist')),[]);
});
test('all old stream provider source declarations stay intact for rollback',async()=>{
  for(const name of ['config','requests','matching']){
    const legacy=await readFile(join(root,'src/api/streams/'+name+'.legacy.js'),'utf8');
    const module=await readFile(join(root,'src/api/streams/'+name+'.module.mjs'),'utf8');
    assert.ok(legacy.length>300 && module.length>400);
    assert.doesNotMatch(module,/^import\s+[^;]+from ['"]https?:\/\//m);
  }
});
