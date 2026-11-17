import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {createStandings} from '../src/features/standings/standings.module.mjs';
import {createTeamProfile} from '../src/features/team-profile/profile.module.mjs';
import {registerTeamProfileHandlers} from '../src/features/team-profile/handlers.module.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=path=>readFile(join(root,path),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x));
const clock=1794860000000;
class Clock extends Date{
  constructor(...args){super(...(args.length?args:[clock]));}
  static now(){return clock;}
}
const standingsFixture={
 children:[
  {name:'Eastern Conference',standings:{entries:[
    {team:{id:'2',displayName:'Boston Celtics',shortDisplayName:'Celtics',abbreviation:'BOS',logos:[{href:'https://example.org/bos.png'}]},
      stats:[{name:'wins',displayValue:'12'},{name:'losses',displayValue:'3'},{name:'playoffSeed',displayValue:'1'},{name:'winPercent',displayValue:'.800'}]},
    {team:{id:'18',displayName:'New York Knicks',shortDisplayName:'Knicks',abbreviation:'NYK'},
      stats:[{name:'wins',displayValue:'10'},{name:'losses',displayValue:'5'},{name:'playoffSeed',displayValue:'2'}]}
  ]}},
  {name:'Western Conference',standings:{entries:[
    {team:{id:'13',displayName:'Los Angeles Lakers',abbreviation:'LAL'},
      stats:[{name:'wins',displayValue:'11'},{name:'losses',displayValue:'4'},{name:'playoffSeed',displayValue:'1'}]}
  ]}}
 ]};
const scheduleFixture={events:[
 {id:'401',date:'2026-11-14T03:00:00Z',status:{type:{state:'post',completed:true}},
  competitions:[{competitors:[
   {homeAway:'away',team:{id:'2',abbreviation:'BOS'},score:{value:108,displayValue:'108'}},
   {homeAway:'home',team:{id:'18',abbreviation:'NYK'},score:{value:104,displayValue:'104'}}]}]},
 {id:'402',date:'2026-11-19T03:00:00Z',status:{type:{state:'pre'}},
  competitions:[{competitors:[
   {homeAway:'home',team:{id:'2',abbreviation:'BOS'}},
   {homeAway:'away',team:{id:'13',abbreviation:'LAL'}}]}]}
]};
const rosterFixture={athletes:[{items:[
 {athlete:{id:'101',displayName:'Jayson Tatum',jersey:'0',position:{abbreviation:'SF'},displayHeight:'6\u20328\u2033'}},
 {athlete:{id:'102',displayName:'Derrick White',jersey:'9',position:{abbreviation:'G'}}}
]}]};
function deferred(){let resolve,reject;let promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
async function tick(){for(let i=0;i<35;i++)await Promise.resolve();}
function setup(){
 const requests=[],pending=[],audit=[],timers=new Map(),elements=new Map(),listeners=new Map();
 let seq=0,view='scores';const state={games:[{id:'401',competitions:[{competitors:[{team:{id:'2',displayName:'Boston Celtics',abbreviation:'BOS'}}]}]}]};
 const viewerState={gameId:null},espnPoll={sharedUntil:0};
 const $=id=>{
  if(!elements.has(id)){
    const el={id,hidden:id==='teamProfileModal',disabled:false,innerHTML:'',textContent:'',
      value:'',scrollTop:0,tabIndex:0,isConnected:true,
      setAttribute(){},addEventListener(type,fn){listeners.set(id+':'+type,fn);},
      focus(){document.activeElement=el;},querySelectorAll:()=>[]};
    elements.set(id,el);
  }
  return elements.get(id);
 };
 const document={activeElement:null,
    body:{classList:{add(){},remove(){}}},
    addEventListener(type,fn){listeners.set('document:'+type,fn);}
 };
 const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fetch=(_url,_opts)=>{const p=deferred();requests.push(String(_url));pending.push(p);return p.promise;};
 const logs={
  auditESPNJob:async(meta,job)=>{audit.push(['audit',meta.priority]);return job(()=>audit.push(['report']));},
  dataLogRequestInfo:()=>({source:'Standings',resource:'NBA'}),
  retryAfterMs:()=>45000,exponentialBackoff:()=>30000,
  dataLogObserve:(_json,key)=>audit.push(['log',key]),
  dataLogStandingsRecords:()=>[],dataLogTeamRecords:()=>[],
  dataLogInvalid:()=>audit.push(['invalid'])
 };
 const bindings={
  $,document,Date:Clock,Map,Math,Number,String,Array,AbortController,
  viewerState,espnPoll,state,fetch,...logs,safe,safeLogo:x=>String(x||''),
  setTimeout:(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id;},
  clearTimeout:id=>timers.delete(id),
  renderLeaders:()=>{},fetchLeaders:()=>{},renderDataLog:()=>{}
 };
 return {bindings,$,document,state,viewerState,espnPoll,requests,pending,audit,timers,listeners,
   getView:()=>view,setView:x=>{view=x;}};
}
async function make(mode){
 const h=setup();let st,profile;
 if(mode==='modular'){
   let pa;
   st=createStandings({...h.bindings,getState:()=>h.state,
      getMainView:h.getView,setMainViewValue:h.setView,
      profileSeasonYear:(...args)=>pa.profileSeasonYear(...args),
      renderTeamProfile:(...args)=>pa.renderTeamProfile(...args)});
   pa=createTeamProfile({...h.bindings,...st,getState:()=>h.state});
   profile=pa;
   registerTeamProfileHandlers({...h.bindings,getState:()=>h.state,...pa});
 }else{
   const ctx=createContext({...h.bindings});
   runInContext((await source('src/features/standings/standings.legacy.js'))+
     '\n'+(await source('src/features/team-profile/profile.legacy.js'))+
     '\n'+(await source('src/features/team-profile/handlers.legacy.js'))+
     '\nglobalThis.api={STANDINGS_API,TEAM_API,teamDirectory,standingsState,profileState,simpleId,statNumber,parseStandings,standStat,renderConference,renderStandings,fetchStandings,fetchFeatureJson,setMainView,mainView:()=>mainView,profileSeasonYear,fetchTeamData,parseTeamSchedule,scheduleScoreNumber,renderTeamProfile,openTeamProfile,closeTeamProfile,selectTeamProfileTab};',ctx);
   st=ctx.api;profile=ctx.api;
   h.getView=()=>runInContext('mainView',ctx);
 }
 return {...h,st,profile};
}
function examine(h){
 const groups=h.st.parseStandings(clone(standingsFixture));
 const html=groups.map(x=>h.st.renderConference(x));
 const schedule=h.profile.parseTeamSchedule(clone(scheduleFixture),'2')
   .map(g=>({...g,date:g.date.toISOString()}));
 const scores=[{value:107,displayValue:'107'},{displayValue:'111'},'99',{value:'oops'},null,{}]
  .map(x=>h.profile.scheduleScoreNumber(x));
 return {groups:clone(groups),html,schedule:clone(schedule),scores,
   teams:[...h.st.teamDirectory.keys()],simpleId:h.st.simpleId('0013')};
}
test('conference grouping, team directory, schedule score objects, profile calendar and HTML match frozen v1.6.1',async()=>{
 const old=examine(await make('legacy')),mod=examine(await make('modular'));
 assert.deepEqual(clone(mod),clone(old));
 assert.deepEqual(mod.groups.map(x=>x.name),['Eastern Conference','Western Conference']);
 assert.deepEqual(mod.scores,[107,111,99,null,null,null]);
 assert.equal(mod.schedule[0].score,'108–104');
 assert.equal(mod.schedule[0].won,true);
 assert.ok(mod.html[0].includes('Boston Celtics'));
});
function renderTrace(h){
 const group=h.st.parseStandings(clone(standingsFixture));
 h.st.standingsState.groups=group;h.st.standingsState.at=Clock.now();h.st.standingsState.season=2026;
 h.st.setMainView('standings');const view=h.getView();
 const board=h.$('standingsContent').innerHTML;
 const profile=h.st.profileState;
 profile.cache.set('2|schedule|2026',{at:Clock.now(),data:clone(scheduleFixture),error:''});
 profile.cache.set('2|roster|',{at:Clock.now(),data:clone(rosterFixture),error:''});
 h.profile.openTeamProfile('2');
 const overview=h.$('teamProfileContent').innerHTML;
 h.profile.selectTeamProfileTab('roster');
 const roster=h.$('teamProfileContent').innerHTML;
 h.profile.selectTeamProfileTab('schedule');
 const schedule=h.$('teamProfileContent').innerHTML;
 h.profile.closeTeamProfile();
 return {view,board,overview,roster,schedule,hidden:h.$('teamProfileModal').hidden,cacheSize:profile.cache.size};
}
test('standings view, roster, schedule, team modal and cached render paths match frozen v1.6.1',async()=>{
 const old=renderTrace(await make('legacy')),mod=renderTrace(await make('modular'));
 assert.deepEqual(clone(mod),clone(old));
 assert.equal(mod.view,'standings');
 assert.match(mod.roster,/Jayson Tatum/);
 assert.match(mod.schedule,/108–104/);
 assert.match(mod.board,/Western Conference/);
 assert.equal(mod.hidden,true);
});
async function requestTrace(h){
 h.st.standingsState.at=0;
 const one=h.st.fetchStandings(true),two=h.st.fetchStandings(true);
 await tick();
 const inFlight={requests:h.requests.length,pending:!!h.st.standingsState.pending,
  timer:[...h.timers.values()].map(x=>x.ms)};
 h.pending[0].resolve({ok:true,status:200,headers:{get:()=>null},json:async()=>clone(standingsFixture)});
 await Promise.all([one,two]);
 const first={groups:h.st.standingsState.groups.map(g=>g.name),
  at:h.st.standingsState.at,requests:h.requests.length,errors:h.st.standingsState.error,
  pending:!!h.st.standingsState.pending};
 await h.st.fetchStandings();
 const id='2';h.st.profileState.id=id;
 const a=h.profile.fetchTeamData('roster'),b=h.profile.fetchTeamData('roster');
 await tick();
 const afterStart=h.requests.length;
 h.pending[1].resolve({ok:true,status:200,headers:{get:()=>null},json:async()=>clone(rosterFixture)});
 await Promise.all([a,b]);
 return {inFlight,first,afterStart,requests:h.requests.length,
  rosterCache:h.st.profileState.cache.get('2|roster|')?.data?.athletes.length||0,
  timersRemaining:h.timers.size,audit:clone(h.audit)};
}
test('standings and team roster deduplication, 14s timeouts and TTL match original request behavior',async()=>{
 const before=await requestTrace(await make('legacy')),after=await requestTrace(await make('modular'));
 assert.deepEqual(clone(after),clone(before));
 assert.equal(after.inFlight.requests,1);
 assert.deepEqual(after.inFlight.timer,[14000]);
 assert.equal(after.afterStart,2);
 assert.equal(after.rosterCache,1);
 assert.equal(after.timersRemaining,0);
});
test('team modal handlers use the same delegated click, focus, Escape and Tab registration',async()=>{
 const old=await make('legacy'),mod=await make('modular');
 const keys=x=>[...x.listeners.keys()].sort();
 assert.deepEqual(keys(mod),keys(old));
 for(const name of ['document:click','document:keydown','teamProfileDialog:click','teamProfileClose:click','teamProfileBackdrop:click'])
   assert.ok(mod.listeners.has(name),name);
});
