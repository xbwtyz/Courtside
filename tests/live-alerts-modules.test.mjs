import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {createLiveAlerts} from '../src/features/live-alerts/alerts.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const copy=v=>JSON.parse(JSON.stringify(v));
const day='2026-11-16';
class FixedDate extends Date {static now(){return 1800000000000;}}
function setup() {
  const listeners=new Map(),nodes=new Map(),saved=[];
  const $=id=>{
    if(!nodes.has(id)){
      const node={id,hidden:id!=='viewer',textContent:'',innerHTML:'',value:'',checked:false,
        addEventListener:(type,fn)=>listeners.set(id+':'+type,fn),
        querySelector:()=>null,setAttribute(){},focus(){},getClientRects:()=>[]};
      nodes.set(id,node);
    }
    return nodes.get(id);
  };
  const document={hidden:false,activeElement:null,addEventListener:(type,fn)=>listeners.set('document:'+type,fn)};
  const prefs={
    alertsEnabled:true,alertsOverlay:false,alertsScope:'all',alertsTeams:[],
    alertsStart:true,alertsHalftime:true,alertsFinal:true,alertsLead:true,alertsClose:true,
    alertsSound:false,alertsVolume:'low'
  };
  const state={date:day,games:[]},viewerState={gameId:null};
  const utilities={
    $,document,window:{},Date:FixedDate,Map,Set,setTimeout:()=>1,clearTimeout:()=>{},
    today:()=>day,classify:game=>game._phase,
    safe:value=>String(value),saveSettingsPrefs:()=>saved.push(copy(prefs)),
    openAppSettings:()=>{},openViewer:()=>{},changeViewerGame:()=>{},
    alert:()=>{},confirm:()=>true
  };
  return {utilities,prefs,state,viewerState,$,document,listeners,saved};
}
async function fixture(mode) {
  const env=setup();
  let activePrefs=env.prefs;
  if(mode==='modern'){
    const api=createLiveAlerts({...env.utilities,
      getPrefs:()=>activePrefs,getState:()=>env.state,getViewerState:()=>env.viewerState});
    return {...env,api,replacePrefs:next=>{activePrefs=next;}};
  }
  const ctx=createContext({...env.utilities,settingsPrefs:activePrefs,state:env.state,viewerState:env.viewerState});
  const source=await readFile(join(root,'src/features/live-alerts/alerts.legacy.js'),'utf8');
  runInContext(source+'\n globalThis.alertApi={ALERT_TEAMS,ALERT_TOAST_DURATION,ALERT_HISTORY_LIMIT,ALERT_LEAD_COOLDOWN,alertsState,alertsScore,alertsResetBaseline,alertsWatchGame,alertsObserveScoreboard,alertsSyncSettings,alertsStatusText,alertsMaybeSound,alertsInit};',ctx);
  return {...env,api:ctx.alertApi,replacePrefs:next=>{ctx.settingsPrefs=next;}};
}
function game({id='401',phase='upcoming',away=0,home=0,period=0,clock='12:00',awayTeam='2',homeTeam='5'}={}){
  return {id,_phase:phase,status:{period,displayClock:clock,type:{name:phase}},
    competitions:[{competitors:[
      {homeAway:'away',score:String(away),team:{id:awayTeam,abbreviation:'BOS'}},
      {homeAway:'home',score:String(home),team:{id:homeTeam,abbreviation:'CLE'}}
    ]}]};
}
function summary(f){
  const a=f.api.alertsState;
  return {history:copy(a.history.map(({timer,...item})=>item)),visible:copy(a.visible.map(({timer,...item})=>item)),
    seen:copy([...a.seen]),needsBaseline:a.needsBaseline,baselineDate:a.baselineDate,
    dedupe:copy([...a.dedupe]),leadAt:copy([...a.leadAt]),sequence:a.sequence};
}
async function runSequence(mode){
  const f=await fixture(mode),observe=f.api.alertsObserveScoreboard;
  const states=[],snap=()=>states.push(summary(f));
  observe([game()],day);snap();
  observe([game({phase:'live',away:10,home:12,period:1,clock:'10:00'})],day);snap();
  observe([game({phase:'live',away:80,home:80,period:4,clock:'2:20'})],day);
  observe([game({phase:'live',away:83,home:80,period:4,clock:'1:59'})],day);snap();
  observe([game({phase:'live',away:82,home:84,period:4,clock:'1:29'})],day);
  observe([game({phase:'final',away:101,home:106,period:4,clock:'0:00'})],day);snap();
  observe([game({phase:'final',away:101,home:106,period:4,clock:'0:00'})],day);snap();
  f.replacePrefs({...f.prefs,alertsScope:'selected',alertsTeams:['99']});
  f.api.alertsResetBaseline();
  observe([game({phase:'upcoming'})],day);
  observe([game({phase:'live',away:10,home:9,period:1})],day);snap();
  f.document.hidden=true;
  observe([game({phase:'final',away:105,home:90,period:4})],day);snap();
  f.document.hidden=false;
  f.replacePrefs({...f.prefs,alertsScope:'selected',alertsTeams:['2']});
  observe([game({phase:'live',away:20,home:15,period:4})],day);snap();
  assert.equal(f.api.alertsState.history.length,4,'never replay historical score changes or emit unseen-team events');
  return states;
}
test('Live Alerts module matches legacy baseline, start, lead, close, final, dedupe, filters, and hidden-tab reset',async()=>{
  const original=await runSequence('legacy'),modern=await runSequence('modern');
  assert.deepEqual(modern,original);
  assert.deepEqual(modern[0].history,[],'initial successful scoreboard is silent');
  assert.deepEqual(modern[3].history.map(e=>e.kind),['Final','Close','Lead','Start']);
  assert.deepEqual(modern[4],modern[3],'repeated final snapshots are deduplicated');
  assert.equal(modern.at(-1).needsBaseline,false);
});
test('Live Alerts score parsing, selected-team checks and lazy preference replacement match legacy',async()=>{
  const a=await fixture('legacy'),b=await fixture('modern');
  const example=game({phase:'live',away:77,home:80,period:4,clock:'1:30'});
  assert.deepEqual(copy(b.api.alertsScore(example)),copy(a.api.alertsScore(example)));
  for(const f of [a,b]){
    f.replacePrefs({...f.prefs,alertsScope:'selected',alertsTeams:['2']});
  }
  assert.equal(b.api.alertsWatchGame(b.api.alertsScore(example)),true);
  assert.equal(a.api.alertsWatchGame(a.api.alertsScore(example)),true);
  const unknown=game({awayTeam:'20',homeTeam:'21'});
  assert.equal(b.api.alertsWatchGame(b.api.alertsScore(unknown)),false);
  assert.equal(a.api.alertsWatchGame(a.api.alertsScore(unknown)),false);
  assert.equal(b.api.ALERT_TEAMS.length,a.api.ALERT_TEAMS.length);
  for(const field of ['ALERT_TOAST_DURATION','ALERT_HISTORY_LIMIT','ALERT_LEAD_COOLDOWN'])
    assert.equal(b.api[field],a.api[field]);
});
test('Live Alerts registers its existing Settings handlers without network or extra timers',async()=>{
  for(const mode of ['legacy','modern']){
    const f=await fixture(mode),initial=f.api.alertsState;
    f.api.alertsInit();
    const handlers=f.listeners;
    assert.ok(handlers.has('settingsAlertsEnabled:change'));
    assert.ok(handlers.has('settingsAlertsScope:change'));
    assert.ok(handlers.has('alertsTeamChoices:change'));
    assert.ok(handlers.has('document:visibilitychange'));
    handlers.get('settingsAlertsEnabled:change')({target:{checked:false}});
    assert.equal(f.prefs.alertsEnabled,false);
    assert.equal(initial.needsBaseline,true);
    handlers.get('settingsAlertsScope:change')({target:{value:'selected'}});
    assert.equal(f.prefs.alertsScope,'selected');
    handlers.get('alertsTeamChoices:change')({target:{closest:()=>({checked:true,dataset:{alertTeam:'2'}})}});
    assert.deepEqual(f.prefs.alertsTeams,['2']);
    handlers.get('settingsAlertsVolume:change')({target:{value:'high'}});
    assert.equal(f.prefs.alertsVolume,'high');
    assert.equal(f.saved.length,4);
    assert.equal(handlers.size>10,true);
  }
});
test('No independent fetch, network polling or interval is introduced by alerts module',async()=>{
  const code=await readFile(join(root,'src/features/live-alerts/alerts.module.mjs'),'utf8');
  assert.doesNotMatch(code,/\bfetch\s*\(|\bsetInterval\s*\(/);
  assert.doesNotMatch(code,/\brequestESPN\s*\(/);
});
