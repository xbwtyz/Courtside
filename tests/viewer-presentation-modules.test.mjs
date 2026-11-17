import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {createViewerTitle} from '../src/features/viewer/title.module.mjs';
import {registerViewerControls} from '../src/features/viewer/controls.module.mjs';
import {registerViewerKeyboard} from '../src/features/viewer/keyboard.module.mjs';
import {registerTickerClicks} from '../src/features/ticker/clicks.module.mjs';
import {registerMainNavigation} from '../src/core/main-navigation.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const copy=value=>JSON.parse(JSON.stringify(value));
const paths=['src/features/viewer/title.legacy.js','src/core/main-navigation.legacy.js',
  'src/features/viewer/controls.legacy.js','src/features/ticker/clicks.legacy.js',
  'src/features/viewer/keyboard.legacy.js'];
function environment(){
  const calls=[],handlers=new Map(),elements=new Map();
  const viewerState={tickerOpen:false,theater:false,statsOpen:true};
  const state={games:[]},auraGames=new Map();
  const document={activeElement:null,addEventListener:(type,fn)=>handlers.set('document:'+type,fn),
    querySelectorAll:selector=>selector==='[data-layout]'?[$('layout1'),$('layout2')]:[]};
  function $(id){
    if(!elements.has(id)){
      const node={id,hidden:id==='viewer',checked:false,addEventListener:(type,fn)=>handlers.set(id+':'+type,fn),
        focus(){document.activeElement=this;},closest:()=>null,
        querySelectorAll:selector=>id==='viewerDialog'?[$('focusFirst'),$('focusLast')]:[]};
      elements.set(id,node);
    }
    return elements.get(id);
  }
  const methods={
    closeViewer:()=>calls.push('close'),
    lookupViewerGame:force=>calls.push('lookup:'+force),
    setActiveTile:n=>calls.push('tile:'+n),
    changeViewerGame:(id,n)=>calls.push('game:'+id+':'+n),
    changeViewerSource:(url,n)=>calls.push('source:'+url+':'+n),
    setViewerLayout:n=>calls.push('layout:'+n),
    paintViewer:()=>calls.push('paint'),
    updateStatsSidebar:force=>calls.push('stats:'+force),
    openViewer:id=>calls.push('open:'+id),
    setMainView:id=>calls.push('view:'+id),
    fetchStandings:force=>calls.push('standings:'+force)
  };
  const getGameTeams=g=>[g.competitions?.[0]?.competitors?.find(c=>c.homeAway==='away')?.team,
    g.competitions?.[0]?.competitors?.find(c=>c.homeAway==='home')?.team];
  const matchLabel=match=>String(match?.title||'NBA matchup');
  return {calls,handlers,elements,viewerState,state,auraGames,document,$,getGameTeams,matchLabel,methods};
}
async function setup(mode){
  const e=environment();
  if(mode==='legacy'){
    const text=await Promise.all(paths.map(x=>readFile(join(root,x),'utf8')));
    const ctx=createContext({...e.methods,$:e.$,document:e.document,viewerState:e.viewerState,state:e.state,
      auraGames:e.auraGames,getGameTeams:e.getGameTeams,matchLabel:e.matchLabel});
    runInContext(text.join('\n')+'\nglobalThis.__api={viewerGameTitle,onTickerClick};',ctx);
    return {...e,title:ctx.__api.viewerGameTitle};
  }
  const {viewerGameTitle}=createViewerTitle({
    getGames:()=>e.state.games,getAuraGames:()=>e.auraGames,
    getGameTeams:e.getGameTeams,matchLabel:e.matchLabel
  });
  registerMainNavigation({$:e.$,setMainView:e.methods.setMainView,fetchStandings:e.methods.fetchStandings});
  registerViewerControls({$:e.$,document:e.document,getViewerState:()=>e.viewerState,...e.methods});
  registerTickerClicks({$:e.$,openViewer:e.methods.openViewer,changeViewerGame:e.methods.changeViewerGame});
  registerViewerKeyboard({document:e.document,$:e.$,closeViewer:e.methods.closeViewer});
  return {...e,title:viewerGameTitle};
}
function example(away='Boston Celtics',home='New York Knicks'){
  return {id:'401',competitions:[{competitors:[
    {homeAway:'away',team:{displayName:away,name:'Celtics'}},
    {homeAway:'home',team:{displayName:home,name:'Knicks'}}
  ]}]};
}
function event(e,options={}){
  let blocked=false;
  return {target:e,shiftKey:false,key:'',...options,
    preventDefault(){blocked=true;},get defaultPrevented(){return blocked;}};
}
function runActions(f){
  const h=f.handlers,trigger=(id,type,ev={})=>{
    const fn=h.get(id+':'+type);assert.ok(fn,'missing handler '+id+':'+type);return fn(ev);
  };
  const target=selectors=>({closest:sel=>selectors[sel]||null});
  const originalKeys=[...h.keys()].sort();
  trigger('csTabScores','click');
  trigger('csTabStandings','click');
  trigger('csTabLeaders','click');
  trigger('csTabLog','click');
  trigger('standingsRefresh','click');
  const right=event(null,{key:'ArrowRight'});
  trigger('csTabScores','keydown',right);
  const left=event(null,{key:'ArrowLeft'});
  trigger('csTabStandings','keydown',left);
  trigger('csTabStandings','keydown',event(null,{key:'ArrowRight'}));
  trigger('csTabLeaders','keydown',event(null,{key:'ArrowRight'}));
  trigger('csTabLog','keydown',event(null,{key:'ArrowLeft'}));
  trigger('csTabScores','keydown',event(null,{key:'Space'}));
  trigger('viewerClose','click');
  trigger('viewerBackdrop','click');
  trigger('viewerRetry','click');
  trigger('multiviewGrid','click',event(target({'[data-focus-tile]':{dataset:{focusTile:'2'}}})));
  trigger('multiviewGrid','change',event(target({'[data-slot-game]':{value:'401',dataset:{slotGame:'1'}}})));
  trigger('multiviewGrid','change',event(target({'[data-slot-source]':{value:'https://example.org/',dataset:{slotSource:'0'}}})));
  trigger('layout2','click');
  trigger('tickerToggle','click');
  trigger('theaterToggle','click');
  trigger('statsToggle','click');
  trigger('statsRefresh','click');
  trigger('scoreTicker','click',event(target({'button[data-ticker-game]':{dataset:{tickerGame:'401'}}})));
  f.$('viewer').hidden=false;
  trigger('viewerTicker','click',event(target({'button[data-ticker-game]':{dataset:{tickerGame:'402'}}})));
  trigger('viewerTicker','click',event(target({})));
  const esc=event(null,{key:'Escape'});
  trigger('document','keydown',esc);
  const backwards=event(null,{key:'Tab',shiftKey:true});
  f.$('focusFirst').focus();
  trigger('document','keydown',backwards);
  const focusAfterBack=f.document.activeElement?.id;
  const forwards=event(null,{key:'Tab',shiftKey:false});
  trigger('document','keydown',forwards);
  const result={
    registered:originalKeys,calls:copy(f.calls),viewerState:copy(f.viewerState),
    focusAfterBack,focusAfterForward:f.document.activeElement?.id,
    prevented:{right:right.defaultPrevented,left:left.defaultPrevented,
      esc:esc.defaultPrevented,backwards:backwards.defaultPrevented,forwards:forwards.defaultPrevented}
  };
  return result;
}
test('original Viewer title lookups and new module match through changing ESPN game/cache data',async()=>{
  const original=await setup('legacy'),modern=await setup('modern');
  function run(f){
    const result=[f.title('401')];
    f.state.games=[example()];
    result.push(f.title('401'));
    f.state.games=[example('Chicago Bulls','Miami Heat')];
    result.push(f.title('401'));
    f.state.games=[];
    f.auraGames.set('aura1',{title:'AuraSports late game'});
    result.push(f.title('aura1'),f.title('unknown'));
    return result;
  }
  assert.deepEqual(run(modern),run(original));
  assert.deepEqual(run(await setup('modern')),
    ['NBA game','Boston Celtics at New York Knicks','Chicago Bulls at Miami Heat','AuraSports late game','NBA game']);
});
test('event registration and real callback effects match legacy across navigation, Viewer and ticker inputs',async()=>{
  const old=runActions(await setup('legacy'));
  const modern=runActions(await setup('modern'));
  assert.deepEqual(modern,old);
  assert.equal(modern.viewerState.tickerOpen,true);
  assert.equal(modern.viewerState.theater,true);
  assert.equal(modern.viewerState.statsOpen,false);
  assert.ok(modern.calls.includes('game:401:1'));
  assert.ok(modern.calls.includes('source:https://example.org/:0'));
  assert.ok(modern.calls.includes('open:401'));
  assert.ok(modern.calls.includes('game:402:undefined'));
  assert.ok(modern.calls.includes('lookup:true'));
  assert.deepEqual(modern.prevented,{right:true,left:true,esc:true,backwards:true,forwards:true});
  assert.equal(modern.focusAfterBack,'focusLast');
  assert.equal(modern.focusAfterForward,'focusFirst');
});
test('Viewer keyboard ignores Escape and Tab when viewer is closed',async()=>{
  for(const mode of ['legacy','modern']){
    const f=await setup(mode);
    const handler=f.handlers.get('document:keydown');
    const key=event(null,{key:'Escape'});
    handler(key);
    assert.equal(f.calls.length,0);
    assert.equal(key.defaultPrevented,false);
  }
});
test('presentation modules introduce no iframe src assignments, network requests or timers',async()=>{
  for(const path of ['src/features/viewer/title.module.mjs',
    'src/features/viewer/controls.module.mjs',
    'src/features/viewer/keyboard.module.mjs',
    'src/features/ticker/clicks.module.mjs',
    'src/core/main-navigation.module.mjs']){
    const code=await readFile(join(root,path),'utf8');
    assert.doesNotMatch(code,/\.src\s*=|setAttribute\(['"]src|requestESPN\(|fetch\(|setInterval\(/);
  }
});
