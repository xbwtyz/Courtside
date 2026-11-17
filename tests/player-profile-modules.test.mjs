import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {createPlayerProfileData} from '../src/features/player-profile/data.module.mjs';
import {createPlayerProfileDialog} from '../src/features/player-profile/dialog.module.mjs';
import {registerPlayerProfileHandlers} from '../src/features/player-profile/handlers.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const src=path=>readFile(join(root,path),'utf8');
const plain=obj=>JSON.parse(JSON.stringify(obj));
const tick=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;let promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
class Clock extends Date{constructor(...args){super(...(args.length?args:[1794859200000]));}static now(){return 1794859200000;}}
const stats={categories:[{name:'Per Game',labels:['GP','PTS','REB','AST','FG%','3P%','FT%'],averages:['15','28.6','7.2','4.6','.515','.386','.900']}]};
const gamelog={seasonTypes:[
 {displayName:'Regular Season',categories:[{labels:['MIN','PTS','REB','AST'],events:[
  {eventId:'401000002',date:'2026-11-12T00:00:00Z',stats:['34','30','9','6'],opponent:{abbreviation:'NYK'},gameResult:'W'},
  {eventId:'401000003',date:'2026-11-15T03:00:00Z',stats:['35','24','7','4'],opponent:{abbreviation:'LAL'},gameResult:'L'}
 ]}]},
 {displayName:'Preseason',categories:[{labels:['PTS'],events:[{eventId:'401000004',date:'2026-10-02',stats:['45']}]}]}
]};
function fixture(){
 const events=[],pending=[],network=[],elements=new Map(),listeners=new Map(),timer=[];
 const state={date:'2026-11-12',games:[{id:'401000002'}],error:''};
 const viewerState={statsTab:'overview',statsOpen:false};
 const teamDirectory=new Map([['2',{id:'2',name:'Boston Celtics'}]]);
 const profileState={id:'2'};
 const document={
  activeElement:null,body:{classList:{add:x=>events.push(['classAdd',x]),remove:x=>events.push(['classRemove',x])}},
  addEventListener(type,fn){listeners.set('document:'+type,fn);},
 };
 function $(id){
  if(elements.has(id))return elements.get(id);
  const el={id,hidden:id.endsWith('Modal')||id==='viewer',innerHTML:'',textContent:'',scrollTop:0,
    value:'',tabIndex:0,isConnected:true,dataset:{},focus(){document.activeElement=this;},
    setAttribute(){},addEventListener(type,fn){listeners.set(id+':'+type,fn);},
    querySelectorAll:()=>[]};
  elements.set(id,el);return el;
 }
 const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const calls={
  profileSeasonYear:()=>2027,fetchFeatureJson:url=>{const d=deferred();pending.push(d);network.push(url);return d.promise;},
  dataLogObserve:(_j,key)=>events.push(['log',key]),
  dataLogPlayerRecords:()=>[],dataLogInvalid:()=>events.push(['invalid']),
  safe,safeLogo:x=>String(x||''),simpleId:x=>/^\d{1,12}$/.test(String(x||''))?String(x):'',
  fmtDate:d=>d.toISOString().slice(0,10),
  closeTeamProfile:()=>{events.push(['closeTeam']);$('teamProfileModal').hidden=true;},
  setMainView:view=>events.push(['mainView',view]),
  fetchScores:async()=>events.push(['fetchScores']),
  render:()=>events.push(['render']),openViewer:id=>events.push(['openViewer',id]),
  changeViewerGame:id=>events.push(['changeViewerGame',id]),
  paintViewer:()=>events.push(['paintViewer'])
 };
 const gameStore={navigateToDate:day=>{state.date=day;events.push(['navigate',day]);}};
 return {$,document,events,pending,network,viewerState,state,teamDirectory,profileState,gameStore,calls,listeners};
}
async function make(mode){
 const f=fixture();
 if(mode==='modular'){
  let dialog;
  const data=createPlayerProfileData({
   $:f.$,Date:Clock,Number,String,Array,Map,Math,...f.calls,
   renderPlayerProfile:(...args)=>dialog.renderPlayerProfile(...args)
  });
  dialog=createPlayerProfileDialog({
   $:f.$,document:f.document,getState:()=>f.state,playerState:data.playerState,
   viewerState:f.viewerState,teamDirectory:f.teamDirectory,gameStore:f.gameStore,
   ...f.calls,...data
  });
  registerPlayerProfileHandlers({
   $:f.$,document:f.document,Array,playerState:data.playerState,
   ...dialog,fetchPlayerKind:data.fetchPlayerKind
  });
  return {...f,api:{...data,...dialog}};
 }
 const ctx=createContext({
  $:f.$,document:f.document,state:f.state,viewerState:f.viewerState,
  teamDirectory:f.teamDirectory,gameStore:f.gameStore,Date:Clock,Number,String,Array,Map,Math,
  ...f.calls
 });
 const code=(await src('src/features/player-profile/data.legacy.js'))+
 '\n'+(await src('src/features/player-profile/dialog.pre-module.js'))+
 '\n'+(await src('src/features/player-profile/handlers.legacy.js'))+
 '\nglobalThis.testApi={playerState,playerCacheKey,playerStatKey,playerStatsFromLabels,extractPlayerStats,parsePlayerGameLog,playerCached,fetchPlayerKind,playerStatDisplay,playerProfileMetrics,playerDataStatus,playerGameLogTable,playerSeasonTable,renderPlayerProfile,openPlayerProfile,closePlayerProfile,playerOpenGame};';
 runInContext(code,ctx);
 return {...f,api:ctx.testApi};
}
function parsing(f){
 const a=f.api.extractPlayerStats(plain(stats));
 const games=f.api.parsePlayerGameLog(plain(gamelog));
 return {stats:plain(a),games:plain(games.map(g=>({...g,date:g.date.toISOString()}))),
  metrics:f.api.playerProfileMetrics(a),season:f.api.playerSeasonTable(a),
  gameHtml:f.api.playerGameLogTable(games),shortHtml:f.api.playerGameLogTable(games,true),
  pct:[f.api.playerStatDisplay(a,'fgpct'),f.api.playerStatDisplay(a,'tppct')],
  empty:f.api.parsePlayerGameLog({})};
}
test('player season averages, percentages, current-season game log and date-only normalization match prior 1.7',async()=>{
 const old=parsing(await make('legacy')),mod=parsing(await make('modular'));
 assert.deepEqual(plain(mod),plain(old));
 assert.equal(mod.games.length,2);
 assert.equal(mod.games[1].id,'401000002');
 assert.match(mod.metrics,/28.6/);
 assert.match(mod.season,/51.5%/);
 assert.equal(mod.pct[0],'51.5%');
 assert.match(mod.gameHtml,/data-player-game/);
});
function modalTrace(f){
 const {api,$,state,viewerState,document}=f;
 api.playerState.cache.set('101|2027|overview',{at:Clock.now(),data:{athlete:{displayName:'Jayson Tatum',team:{id:'2'},jersey:'0'}},error:''});
 api.playerState.cache.set('101|2027|stats',{at:Clock.now(),data:plain(stats),error:''});
 api.playerState.cache.set('101|2027|gamelog',{at:Clock.now(),data:plain(gamelog),error:''});
 const fromTeam=$('teamProfileModal');fromTeam.hidden=false;
 const link={dataset:{playerProfile:'101',playerName:'Jayson Tatum',playerTeam:'2',
  playerTeamName:'Boston Celtics',playerPos:'SF',playerJersey:'0'}};
 $('teamProfileContent').scrollTop=60;
 document.activeElement=link;
 api.openPlayerProfile(link);
 const opened={modal:$('playerProfileModal').hidden,team:fromTeam.hidden,
  text:$('playerProfileContent').innerHTML,focus:document.activeElement?.id,
  fromTeam:api.playerState.fromTeam};
 api.playerState.tab='season';api.renderPlayerProfile();
 const season=$('playerProfileContent').innerHTML;
 api.playerState.tab='gamelog';api.renderPlayerProfile();
 const log=$('playerProfileContent').innerHTML;
 api.playerState.sort='pts';api.playerState.sortDesc=false;api.renderPlayerProfile();
 const sorted=$('playerProfileContent').innerHTML;
 api.closePlayerProfile();
 return {opened,season,log,sorted,closed:{
   modal:$('playerProfileModal').hidden,team:fromTeam.hidden,
   scroll:$('teamProfileContent').scrollTop,focus:document.activeElement===link
 }};
}
test('player modal opens from team, shows overview/season/game log, sorts and restores prior focus/scroll',async()=>{
 const old=modalTrace(await make('legacy')),mod=modalTrace(await make('modular'));
 assert.deepEqual(plain(mod),plain(old));
 assert.equal(mod.opened.focus,'playerProfileClose');
 assert.equal(mod.opened.modal,false);
 assert.equal(mod.opened.fromTeam,true);
 assert.match(mod.opened.text,/Season averages/);
 assert.match(mod.season,/Current-season statistics/);
 assert.match(mod.log,/Game Log|game log/i);
 assert.equal(mod.closed.team,false);
 assert.equal(mod.closed.scroll,60);
 assert.equal(mod.closed.focus,true);
});
async function requestTrace(f){
 const {api,pending,network,$,events}=f;
 api.playerState.id='101';
 const a=api.fetchPlayerKind('stats'),b=api.fetchPlayerKind('stats');
 await tick();
 const queued={requests:network.length,pending:api.playerState.pending.size};
 pending[0].resolve(plain(stats));
 await Promise.all([a,b]);
 const cached=await api.fetchPlayerKind('stats');
 const loaded={requests:network.length,cached:!!cached,
  pending:api.playerState.pending.size,log:plain(events)};
 const failure=api.fetchPlayerKind('gamelog');
 await tick();
 pending[1].reject(new Error('ESPN unavailable'));
 await failure;
 return {queued,loaded,error:api.playerCached('gamelog').entry.error,
  requests:network.length,cache:api.playerState.cache.size};
}
test('player stats requests deduplicate, retain TTL and gracefully cache errors as before',async()=>{
 const a=await requestTrace(await make('legacy')),b=await requestTrace(await make('modular'));
 assert.deepEqual(plain(b),plain(a));
 assert.equal(b.queued.requests,1);
 assert.equal(b.queued.pending,1);
 assert.equal(b.loaded.requests,1);
 assert.equal(b.loaded.pending,0);
 assert.match(b.error,/ESPN unavailable/);
});
async function navigation(f){
 const {api,events,state,$,document}=f;
 $('playerProfileModal').hidden=false;
 api.playerState.id='101';api.playerState.fromTeam=false;
 await api.playerOpenGame('401000002','2026-11-12');
 const same=plain(events);
 $('playerProfileModal').hidden=false;api.playerState.id='101';api.playerState.fromTeam=false;
 await api.playerOpenGame('401000002','2026-11-14');
 return {same,all:plain(events),date:state.date,modal:$('playerProfileModal').hidden};
}
test('player game-log navigation preserves game-store date change and Viewer handoff',async()=>{
 const before=await navigation(await make('legacy')),after=await navigation(await make('modular'));
 assert.deepEqual(plain(after),plain(before));
 assert.equal(after.date,'2026-11-14');
 assert.deepEqual(after.all.filter(x=>x[0]==='navigate'),[['navigate','2026-11-14']]);
 assert.equal(after.modal,true);
});
test('delegated player link, sort, retry and focus-trap listeners are registered once',async()=>{
 const a=await make('legacy'),b=await make('modular');
 assert.deepEqual([...a.listeners.keys()].sort(),[...b.listeners.keys()].sort());
 for(const id of ['document:click','document:keydown','playerProfileDialog:click','playerProfileClose:click','playerProfileBackdrop:click','playerBackTeam:click'])
  assert.ok(b.listeners.has(id),id);
});
