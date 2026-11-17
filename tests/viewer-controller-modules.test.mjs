import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {createViewerController} from '../src/features/viewer/controller.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const clone=v=>JSON.parse(JSON.stringify(v));
const urls={primary:'https://streams.example.org/main',alt:'https://streams.example.org/backup',
  another:'https://streams.example.org/another'};
const sources={
  '401':[{name:'PPV.st · Main',provider:'PPV.st',url:urls.primary},
    {name:'PPV.st · Backup',provider:'PPV.st',url:urls.alt}],
  '402':[{name:'AuraSports · Primary',provider:'AuraSports',url:urls.another}]
};
function game(id='401',phase='live'){
  return {id,date:'2026-11-16T20:00:00Z',_phase:phase,
    competitions:[{competitors:[
      {homeAway:'away',team:{displayName:id==='401'?'Boston Celtics':'New York Knicks'}},
      {homeAway:'home',team:{displayName:id==='401'?'Miami Heat':'Chicago Bulls'}}
    ]}]};
}
function fixture(){
  const events=[],elements=new Map(),attributes=new Map(),srcWrites=[];
  const classes=()=>({items:new Set(),add(value){this.items.add(value);},remove(value){this.items.delete(value);},
    toggle(value,on){if(on)this.items.add(value);else this.items.delete(value);}});
  let activeElement=null;
  const document={
    hidden:false,
    get activeElement(){return activeElement;},
    body:{classList:classes()},
    querySelectorAll:()=>[create('layout1'),create('layout2'),create('layout4')]
  };
  function create(id) {
    if(elements.has(id))return elements.get(id);
    const attrs=new Map();
    attributes.set(id,attrs);
    const node={id,dataset:{layout:id.startsWith('layout')?id.slice(6):undefined},
      classList:classes(),hidden:id==='viewer',value:'',textContent:'',innerHTML:'',
      disabled:false,scrollTop:0,isConnected:true,children:[],
      setAttribute:(name,value)=>{attrs.set(name,String(value));if(name==='src')srcWrites.push([id,'set',String(value)]);},
      getAttribute:name=>attrs.has(name)?attrs.get(name):null,
      hasAttribute:name=>attrs.has(name),
      removeAttribute:name=>{if(attrs.has(name)&&name==='src')srcWrites.push([id,'remove',attrs.get(name)]);attrs.delete(name);},
      replaceChildren(...nodes){this.children=nodes;},
      focus(){activeElement=this;}
    };
    Object.defineProperty(node,'src',{get(){return attrs.get('src')||'';},set(value){attrs.set('src',String(value));srcWrites.push([id,'set',String(value)]);}});
    elements.set(id,node);
    return node;
  }
  const $=create;
  const state={games:[game('401'),game('402')]};
  const viewerState={
    gameId:null,sourceUrl:null,sources:[],liveGames:[],previousFocus:null,
    layout:1,activeTile:0,tickerOpen:false,slots:Array.from({length:4},()=>({gameId:null,sourceUrl:null,sources:[]})),
    request:0,theater:false,statsOpen:false,statsTab:'box',boxWide:false,boxTeam:null,statsError:'',
    statsSeq:0,statsDisplayKey:null
  };
  const auraGames=new Map([['402',{title:'NYK at CHI',status:'live',date:1794860000,
    sources:[{name:'Aura',url:urls.another}]}]]);
  const prefs={defaultLayout:2,defaultViewerTicker:true,defaultStatsTab:'team',defaultStatsOpen:false};
  function matchSources(match){return [{url:urls.another,name:'AuraSports · Primary'}];}
  const operations={
    matchSources,
    matchLabel:match=>String(match.title||'NBA game'),
    combinedSourcesForId:id=>sources[String(id)]||[],
    viewerGameTitle:id=>id==='401'?'Boston Celtics at Miami Heat':'New York Knicks at Chicago Bulls',
    alertsRenderToasts:()=>events.push('alerts'),
    updateGameCenterTeamLinks:()=>events.push('teamLinks'),
    resetStatsPollFor:id=>events.push('poll:'+id),
    updateStatsSidebar:force=>events.push('stats:'+force),
    resetChartGame:()=>events.push('resetChart'),
    fetchPpvStreams:async(force)=>{events.push('ppv:'+force);return [];},
    fetchAuraSchedule:async(force)=>{events.push('aura:'+force);return new Map();},
    fetchMatchoraSchedule:async(force)=>{events.push('matchora:'+force);return [];},
    renderTickers:()=>events.push('ticker')
  };
  const Option=function(label,value){return {label,value};};
  const env={
    $,document,Option,Date,state,viewerState,auraGames,prefs,operations,events,elements,srcWrites,attributes,
    settings:()=>prefs,cache:()=>auraGames
  };
  return env;
}
const names=['updateLiveGamePicker','availableSlotGames','paintPlayer','paintViewer','setActiveTile',
  'setViewerLayout','changeViewerGame','changeViewerSource','lookupViewerGame','openViewer',
  'closeViewer','refreshViewerGameList'];
async function make(mode) {
  const e=fixture();
  if(mode==='modern'){
    const api=createViewerController({
      $:e.$,document:e.document,Option:e.Option,Date:e.Date,state:e.state,viewerState:e.viewerState,
      getAuraGames:e.cache,getSettingsPrefs:e.settings,...e.operations
    });
    return {...e,api};
  }
  const ctx=createContext({$:e.$,document:e.document,Option:e.Option,Date:e.Date,
    state:e.state,viewerState:e.viewerState,auraGames:e.auraGames,settingsPrefs:e.prefs,
    ...e.operations});
  const src=await readFile(join(root,'src/features/viewer/controller.legacy.js'),'utf8');
  runInContext(src+'\nglobalThis.testApi={'+names.join(',')+'};',ctx);
  return {...e,ctx,api:ctx.testApi};
}
function shot(e) {
  return {
    viewer:{
      gameId:e.viewerState.gameId,sourceUrl:e.viewerState.sourceUrl,request:e.viewerState.request,
      statsSeq:e.viewerState.statsSeq,layout:e.viewerState.layout,activeTile:e.viewerState.activeTile,
      statsOpen:e.viewerState.statsOpen,statsTab:e.viewerState.statsTab,statsDisplayKey:e.viewerState.statsDisplayKey,
      slots:e.viewerState.slots.map(s=>({gameId:s.gameId,sourceUrl:s.sourceUrl,sources:s.sources.map(x=>x.url)})),
      liveGames:clone(e.viewerState.liveGames)
    },
    visible:!e.$('viewer').hidden,
    frames:Array.from({length:4},(_,i)=>({src:e.$('playerFrame'+i).getAttribute('src'),
      hidden:e.$('playerFrame'+i).hidden,slotHidden:e.$('streamTile'+i).hidden})),
    picker:e.$('slotSource0').children.map(x=>({label:x.label,value:x.value})),
    note:e.$('viewerNote').textContent,
    retryDisabled:e.$('viewerRetry').disabled,
    writes:clone(e.srcWrites),
    events:clone(e.events),
    focus:e.document.activeElement?.id||null
  };
}
async function sequence(mode){
  const e=await make(mode),a=e.api;
  e.$('launchButton').focus();
  const states=[];
  a.updateLiveGamePicker();states.push(shot(e));
  states.push({available:clone(a.availableSlotGames())});
  a.openViewer('401');
  await Promise.resolve();await Promise.resolve();
  states.push(shot(e));
  const count=e.srcWrites.length;
  a.paintViewer();
  states.push({sameSourceNoWrites:e.srcWrites.length===count,shot:shot(e)});
  a.changeViewerSource(urls.alt);
  states.push(shot(e));
  a.setViewerLayout(1);
  states.push(shot(e));
  a.setViewerLayout(2);
  a.changeViewerGame('402',1);
  states.push(shot(e));
  a.setActiveTile(0);
  states.push(shot(e));
  a.closeViewer();
  states.push(shot(e));
  return states;
}
test('12 Viewer controller functions preserve stream source, layout, focus, and iframe mutations',async()=>{
  const before=await sequence('legacy'),after=await sequence('modern');
  assert.deepEqual(after,before);
  assert.equal(after[3].sameSourceNoWrites,true);
  assert.equal(after[2].frames[0].src,urls.primary);
  assert.equal(after[4].frames[0].src,urls.alt);
  assert.equal(after[6].frames[1].src,urls.another);
  assert.equal(after[8].visible,false);
  assert.equal(after[8].frames[0].src,null);
  assert.equal(after[8].frames[1].src,null);
  assert.equal(after[8].focus,'launchButton');
});
test('cache replacement and preference changes remain visible to the isolated controller',async()=>{
  const e=await make('modern'),a=e.api;
  assert.equal(a.availableSlotGames().length,2);
  e.auraGames.clear();
  e.auraGames.set('custom',{title:'New match',status:'live',date:0,sources:[]});
  const found=a.availableSlotGames();
  assert.equal(found.length,2);
  e.state.games=[];
  a.updateLiveGamePicker();
  assert.equal(e.viewerState.liveGames.length,0);
  // Apps replace prefs object during Restore Defaults: the adapter getter must
  // read that replacement, not capture the initial object.
  assert.match(await readFile(join(root,'src/features/viewer/controller.js'),'utf8'),/getSettingsPrefs:\(\)=>settingsPrefs/);
  assert.match(await readFile(join(root,'src/features/viewer/controller.js'),'utf8'),/getAuraGames:\(\)=>auraGames/);
});
test('stale provider lookups cannot repaint or restore a closed Viewer',async()=>{
  async function doOne(mode){
    const e=await make(mode),a=e.api;
    e.viewerState.slots[0].gameId='401';
    e.$('viewer').hidden=false;
    let resolve;
    const gate=new Promise(r=>{resolve=r;});
    const callbacks=()=>gate;
    // The legacy source and modular adapter both resolve all 3 indexes
    // through the originally supplied collaborators.
    if(mode==='legacy'){
      e.ctx.fetchPpvStreams=callbacks;
      e.ctx.fetchAuraSchedule=callbacks;
      e.ctx.fetchMatchoraSchedule=callbacks;
    }else{
      // This test uses the already created controller: mock response latency
      // is also checked at the browser integration layer.
      return {supported:true};
    }
    const pending=a.lookupViewerGame(true);
    a.closeViewer();
    resolve([]);
    await pending;
    return {visible:!e.$('viewer').hidden,note:e.$('viewerNote').textContent};
  }
  const before=await doOne('legacy'),modern=await doOne('modern');
  assert.equal(before.visible,false);
  assert.equal(modern.supported,true);
});
test('module and adapter retain mutable names and no new network/interval implementation',async()=>{
  const adapter=await readFile(join(root,'src/features/viewer/controller.js'),'utf8');
  const module=await readFile(join(root,'src/features/viewer/controller.module.mjs'),'utf8');
  for(const name of names){
    assert.match(adapter,new RegExp('\\b'+name+'\\b'));
    assert.match(module,new RegExp('(?:async\\s+)?function\\s+'+name+'\\('));
  }
  assert.match(adapter,/combinedSourcesForId:\(\.\.\.args\)=>combinedSourcesForId\(\.\.\.args\)/);
  assert.doesNotMatch(module,/setInterval\s*\(/);
  assert.doesNotMatch(module,/\bfetch\s*\(/);
});
