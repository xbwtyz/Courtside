import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {createLeagueLeadersData} from '../src/features/league-leaders/data.module.mjs';
import {createLeagueLeadersRender} from '../src/features/league-leaders/render.module.mjs';
import {registerLeagueLeadersHandlers} from '../src/features/league-leaders/handlers.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const src=path=>readFile(join(root,path),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const tick=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
const gate=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
class Clock extends Date{constructor(...a){super(...(a.length?a:[1794859200000]));}static now(){return 1794859200000;}}
const categories=[
 {name:'general',names:['gamesPlayed','avgMinutes']},
 {name:'offensive',names:['avgPoints','avgAssists','avgRebounds','fieldGoalPct','threePointFieldGoalPct','freeThrowPct']},
 {name:'defensive',names:['avgSteals','avgBlocks']}
];
function athlete(id,ppg=20,gp=15,teamId='2'){
 return {athlete:{id:String(id),displayName:'Player '+id,teamId,position:{abbreviation:'G'}},
  categories:[
   {name:'general',values:[String(gp),'34:30']},
   {name:'offensive',values:[String(ppg),'5.4','8.2','48.6%','37.2%','84.1%']},
   {name:'defensive',values:['1.4','0.7']}
  ]};
}
const payload=(page,season=2027,rows=[athlete(page+100)],count=2,pages=2)=>({
 athletes:rows,categories,pagination:{page,count,pages},
 currentSeason:{year:season,type:{id:2}}
});
function fakeDom(){
 const nodes=new Map(),handlers=new Map();
 const document={hidden:false,activeElement:null,createElement:tag=>({
  tagName:tag.toUpperCase(),innerHTML:'',querySelector:()=>({innerHTML:'<thead></thead>'})
 })};
 function $(id){
  if(nodes.has(id))return nodes.get(id);
  const node={id,value:'',innerHTML:'',textContent:'',className:'',disabled:false,hidden:false,
   tabIndex:0,scrollLeft:0,focus(){document.activeElement=this;},
   scrollIntoView(){},setAttribute(){},querySelectorAll:()=>[],
   addEventListener(type,fn){handlers.set(id+':'+type,fn);}};
  nodes.set(id,node);return node;
 }
 return {$,document,nodes,handlers};
}
async function make(modern){
 const ui=fakeDom(),events=[],requests=[],pending=[];
 const teamDirectory=new Map(),settingsPrefs={leadersCategory:'scoring',leadersRows:25};
 const config={
  ...ui,settingsPrefs,teamDirectory,Date:Clock,Math,Number,String,Object,Map,Set,Array,
  safe:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  safeLogo:x=>String(x||''),simpleId:x=>/^\d{1,12}$/.test(String(x))?String(x):'',
  profileSeasonYear:()=>2027,getMainView:()=> 'leaders',mainView:'leaders',
  fetchFeatureJson:(url,priority)=>{const g=gate();pending.push(g);requests.push({url,priority});return g.promise;},
  dataLogObserve:(_json,key)=>events.push(['observe',key]),
  dataLogLeadersRecords:()=>[],dataLogInvalid:(_json,e)=>events.push(['invalid',e.message]),
  saveSettingsPrefs:()=>events.push(['saveSettings']),
  syncSettingsControls:()=>events.push(['syncSettings']),
  patchGameDOM:(to,node)=>{to.innerHTML=node.innerHTML;}
 };
 let api;
 if(modern){
  let renderer;
  const data=createLeagueLeadersData({...config,renderLeaders:(...args)=>renderer.renderLeaders(...args)});
  renderer=createLeagueLeadersRender({...config,...data});
  registerLeagueLeadersHandlers({...config,...data,...renderer});
  api={...data,...renderer};
 }else{
  const ctx=createContext(config);
  runInContext((await src('src/features/league-leaders/data.legacy.js'))+
   '\n'+(await src('src/features/league-leaders/render.legacy.js'))+
   '\n'+(await src('src/features/league-leaders/handlers.legacy.js'))+
   '\nglobalThis.testApi={leaderState,leaderNumeric,leaderNormalize,leaderPagePayload,leaderStatObject,leaderMetricValue,fetchLeaders,leaderFiltered,leaderFormat,leaderSetCategory,leaderSetSort,leaderVolumeMinimum,renderLeaders};',ctx);
  api=ctx.testApi;
 }
 return {...ui,events,requests,pending,teamDirectory,settingsPrefs,api};
}
function inspect(a){
 const {api}=a;
 const one=api.leaderNormalize(athlete(101,28.7),categories);
 const two=api.leaderNormalize(athlete(102,28.7),categories);
 const three=api.leaderNormalize(athlete(103,14,4),categories);
 const bad=[];
 for(const json of [
  {athletes:[],categories,pagination:{page:1,count:2,pages:2},currentSeason:{year:2027,type:2}},
  payload(1,2026),payload(1,2027,[athlete(1)],2,99),
  {...payload(1),pagination:{count:2,pages:2,page:2}}
 ]){try{api.leaderPagePayload(json,1,2027);}catch(e){bad.push(e.message);}}
 const numeric=['34:30','3,300','42%','—','invalid',null].map(api.leaderNumeric);
 api.leaderState.players=[one,two,three];
 api.leaderState.at=Clock.now();
 api.leaderState.dataCount=3;
 api.renderLeaders();
 const initial=api.leaderFiltered();
 api.leaderState.metric='fgPct';api.leaderState.volume='auto';
 const volume=api.leaderVolumeMinimum();
 const filtered=api.leaderFiltered();
 api.leaderState.metric='ppg';api.leaderState.volume='off';
 api.leaderState.query='102';
 const searched=api.leaderFiltered();
 api.leaderSetCategory('rebounding');
 const category={category:api.leaderState.category,metric:api.leaderState.metric,
  selected:a.$('leadersMetric').value};
 return plain({first:{id:one.id,name:one.name,v:one.v,team:one.teamName,position:one.pos},
  bad,numeric,initial:{ranked:initial.ranked.map(x=>[x.id,x.rank]),visible:initial.visible.map(x=>x.id)},
  volume,filtered:filtered.visible.map(x=>x.id),
  searched:searched.visible.map(x=>x.id),category,
  summary:a.$('leadersSummary').innerHTML,
  results:a.$('leadersResults').textContent});
}
test('League Leaders numeric parsing, season/page validation, ties, filters and categories match 1.6.1',async()=>{
 const before=inspect(await make(false)),after=inspect(await make(true));
 assert.deepEqual(after,before);
 assert.equal(after.numeric[0],34.5);
 assert.equal(after.numeric[1],3300);
 assert.equal(after.numeric[2],42);
 assert.equal(after.bad.length,4);
 assert.deepEqual(after.initial.ranked.map(x=>x[1]),[1,1,null]);
 assert.equal(after.searched.length,1);
 assert.equal(after.volume.on,true);
 assert.equal(after.category.category,'rebounding');
});
async function loads(a){
 const {api,requests,pending,events}=a;
 const p1=api.fetchLeaders(true),p2=api.fetchLeaders(true);
 await tick();
 const started={count:requests.length,priority:requests[0]?.priority,loading:api.leaderState.loading,
  pending:!!api.leaderState.pending};
 pending[0].resolve(payload(1,2027,[athlete(101,29)],2,2));
 await tick();
 const mid={requests:requests.length,count:api.leaderState.players.length,
  progress:api.leaderState.progress};
 pending[1].resolve(payload(2,2027,[athlete(102,29,'15','18')],2,2));
 await Promise.all([p1,p2]);
 const completed={count:api.leaderState.players.length,dataCount:api.leaderState.dataCount,
  season:api.leaderState.season,at:api.leaderState.at,
  pending:!!api.leaderState.pending,error:api.leaderState.error,
  teamDirectory:[...a.teamDirectory.keys()].sort(),logs:plain(events),requests:requests.length};
 await api.fetchLeaders();
 const cached=requests.length;
 const failing=api.fetchLeaders(true);await tick();
 pending[2].resolve(payload(1,2027,[athlete(101,1)],3,1));
 await failing;
 const afterFailure={count:api.leaderState.players.length,error:api.leaderState.error,
  at:api.leaderState.at,dataCount:api.leaderState.dataCount,failures:api.leaderState.failures,
  requests:requests.length};
 return plain({started,mid,completed,cached,afterFailure});
}
test('complete ESPN pagination, 30-minute cache, dedup, last-good-cache on error match frozen behavior',async()=>{
 const original=await loads(await make(false)),modular=await loads(await make(true));
 assert.deepEqual(modular,original);
 assert.equal(modular.started.count,1);
 assert.equal(modular.started.priority,3);
 assert.equal(modular.mid.requests,2);
 assert.equal(modular.completed.count,2);
 assert.equal(modular.completed.dataCount,2);
 assert.equal(modular.completed.pending,false);
 assert.equal(modular.cached,2);
 assert.equal(modular.afterFailure.count,2);
 assert.equal(modular.afterFailure.failures,1);
 assert.match(modular.afterFailure.error,/unique entries|ESPN returned/);
});
test('League Leaders event handlers retain all delegated listeners and live filter state',async()=>{
 const before=await make(false),after=await make(true);
 assert.deepEqual([...after.handlers.keys()].sort(),[...before.handlers.keys()].sort());
 const compare=f=>{
  const ui=f.$;
  const run=(id,type,value)=>{
   const target=ui(id);target.value=value;
   f.handlers.get(id+':'+type)({target});
  };
  run('leadersSearch','input','player 10');
  run('leadersTeam','change','2');
  run('leadersPosition','change','G');
  run('leadersRows','change','50');
  run('leadersGames','change','10');
  run('leadersVolume','change','off');
  return {state:{query:f.api.leaderState.query,team:f.api.leaderState.team,
    position:f.api.leaderState.position,rows:f.api.leaderState.rows,
    games:f.api.leaderState.games,volume:f.api.leaderState.volume},
   prefs:plain(f.settingsPrefs),events:plain(f.events)};
 };
 assert.deepEqual(compare(after),compare(before));
});
