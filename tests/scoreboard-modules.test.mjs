import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createContext,runInContext} from 'node:vm';
import {createScoreboardRender} from '../src/features/scoreboard/render.module.mjs';
import {registerScoreboardCardControls} from '../src/features/scoreboard/card-controls.module.mjs';
import {registerScoreboardNavigation} from '../src/features/scoreboard/navigation.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const norm=value=>JSON.parse(JSON.stringify(value));
function scoreboardGame(phase='live'){
  return {id:'401000002',_phase:phase,date:'2026-11-16T20:15:00Z',
    status:{type:{shortDetail:phase==='live'?'Q4 2:30':phase==='final'?'Final':'Upcoming'}},
    competitions:[{
      broadcasts:[{names:['ESPN','ABC']}],
      competitors:[
        {homeAway:'away',score:'104',team:{id:'2',displayName:'Boston Celtics',shortDisplayName:'Celtics',abbreviation:'BOS',logo:'https://example.org/bos.png'},
          records:[{name:'overall',summary:'10-5'}],linescores:[{displayValue:'22'},{displayValue:'30'}],
          leaders:[{name:'points',leaders:[{athlete:{displayName:'Tatum'},displayValue:'28'}]}]},
        {homeAway:'home',score:'102',team:{id:'18',displayName:'New York Knicks',shortDisplayName:'Knicks',abbreviation:'NYK'},
          records:[{name:'overall',summary:'9-6'}],linescores:[{displayValue:'25'},{displayValue:'28'}],
          leaders:[{name:'points',leaders:[{athlete:{displayName:'Brunson'},displayValue:'27'}]}]}
      ],
      notes:[{headline:'In-Season Game'}]
    }]
  };
}
function fixture(){
  const state={games:[scoreboardGame()],expanded:new Set(),query:'',liveOnly:false,
    firstLoaded:true,lastUpdated:new Date('2026-11-16T20:00:00Z'),error:''};
  const handlers=new Map(),events=[],elements=new Map();
  function $(id) {
    if(elements.has(id))return elements.get(id);
    const el={id,value:'',checked:false,addEventListener(type,fn){handlers.set(id+':'+type,fn);}};
    elements.set(id,el);
    return el;
  }
  const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeLogo=value=>String(value||'');
  const fns={
    openViewer:id=>events.push(['openViewer',id]),
    render:()=>events.push(['render']),
    changeDay:n=>events.push(['changeDay',n]),
    selectDay:d=>events.push(['selectDay',d]),
    today:()=> '2026-11-16',
    setMainView:v=>events.push(['setMainView',v]),
    fetchScores:force=>events.push(['fetchScores',force])
  };
  const document={};
  return {$,state,safe,safeLogo,handlers,events,fns,document,elements};
}
async function sourceFile(name){return readFile(join(root,'src/features/scoreboard/'+name+'.legacy.js'),'utf8');}
async function make(mode){
  const f=fixture();
  if(mode==='modular'){
    const render=createScoreboardRender({$:f.$,document:f.document,Node:{ELEMENT_NODE:1,TEXT_NODE:3},
      WeakMap,Date,getState:()=>f.state,safe:f.safe,safeLogo:f.safeLogo});
    registerScoreboardCardControls({$:f.$,getState:()=>f.state,
      openViewer:(...args)=>f.fns.openViewer(...args),render:(...args)=>f.fns.render(...args)});
    registerScoreboardNavigation({$:f.$,getState:()=>f.state,
      changeDay:(...args)=>f.fns.changeDay(...args),
      selectDay:(...args)=>f.fns.selectDay(...args),
      today:(...args)=>f.fns.today(...args),
      setMainView:(...args)=>f.fns.setMainView(...args),
      render:(...args)=>f.fns.render(...args),
      fetchScores:(...args)=>f.fns.fetchScores(...args)});
    return {...f,api:render};
  }
  const renderSrc=await sourceFile('render'),controlSrc=await sourceFile('card-controls'),navSrc=await sourceFile('navigation');
  const context=createContext({$:f.$,document:f.document,Node:{ELEMENT_NODE:1,TEXT_NODE:3},
    WeakMap,Date,state:f.state,safe:f.safe,safeLogo:f.safeLogo,...f.fns,callbackRender:f.fns.render});
  runInContext(renderSrc+'\nglobalThis.api={formatStart,getStatus,teamData,logoHTML,scoreHTML,detailHTML,gameCard,sectionHTML,patchGameDOM,reconcileGameSections,render,gameMarkupCache};\n'+controlSrc+'\n'+navSrc+'\nrender=callbackRender;',context);
  return {...f,api:context.api};
}
test('renderer markup and status/score helpers exactly equal legacy across live, final, upcoming, and expanded cards',async()=>{
  const old=await make('legacy'),mod=await make('modular');
  const results=f=>{
    const r=[];
    for(const phase of ['live','final','upcoming']){
      const g=scoreboardGame(phase);
      r.push({phase,status:f.api.getStatus(g),card:f.api.gameCard(g)});
      f.state.expanded.add(g.id);
      r.push({phase,details:f.api.gameCard(g),section:f.api.sectionHTML('ignored',phase,[g])});
      f.state.expanded.delete(g.id);
    }
    return r;
  };
  assert.deepEqual(results(mod),results(old));
  assert.match(results(mod)[0].card,/Boston|Celtics/);
  assert.match(results(mod)[1].details,/Quarter-by-quarter/);
  assert.match(results(mod)[2].card,/Q4 2:30|Final/);
  assert.equal(mod.api.formatStart('not a time'),'Time TBA');
  assert.equal(mod.api.gameMarkupCache instanceof WeakMap,true);
});
function event(target,key){
  let prevented=false;
  return {target,key,preventDefault(){prevented=true;},get prevented(){return prevented;}};
}
const closest=(obj)=>({closest:selector=>obj[selector]??null});
function callbacks(f){
  const at=(id,type,e)=>{const fn=f.handlers.get(id+':'+type);assert.ok(fn,id+' '+type);return fn(e);};
  const button=(selector,data)=>closest({[selector]:{dataset:data}});
  at('scoreboard','click',event(button('button[data-watch]',{watch:'401000002'})));
  at('scoreboard','click',event(button('button[data-game]',{game:'401000002'})));
  const expanded=f.state.expanded.has('401000002');
  at('scoreboard','click',event(button('button[data-game]',{game:'401000002'})));
  at('scoreboard','click',event(button('article.game[data-game-id]',{gameId:'401000002'})));
  const onlyButton=closest({'a,button,input,select,textarea':{}});
  at('scoreboard','click',event(onlyButton));
  const card={dataset:{gameId:'401000002'},closest:selector=>selector==='article.game[data-game-id]'?card:null};
  const keyEvent=event(card,'Enter');
  at('scoreboard','keydown',keyEvent);
  const space=event(card,' ');
  at('scoreboard','keydown',space);
  const rowTarget=card;
  const invalid=event({closest:()=>card},'Enter');
  at('scoreboard','keydown',invalid);
  at('prevDay','click',event({}));
  at('nextDay','click',event({}));
  at('todayBtn','click',event({}));
  const home=event({});
  at('homeLink','click',home);
  f.$('datePicker').value='2026-11-12';
  at('datePicker','change',event(f.$('datePicker')));
  f.$('teamSearch').value='Boston';
  at('teamSearch','input',event(f.$('teamSearch')));
  f.$('liveOnly').checked=true;
  at('liveOnly','change',event(f.$('liveOnly')));
  at('refreshBtn','click',event({}));
  return {registered:[...f.handlers.keys()].sort(),events:norm(f.events),
    state:{expanded:[...f.state.expanded],query:f.state.query,liveOnly:f.state.liveOnly},
    expanded,keys:{enter:keyEvent.prevented,space:space.prevented,nonCard:invalid.prevented},
    homePrevented:home.prevented};
}
test('watch, card expand, keyboard, search, Live Only and date navigation callbacks preserve legacy behavior',async()=>{
  const old=callbacks(await make('legacy')),mod=callbacks(await make('modular'));
  assert.deepEqual(mod,old);
  assert.equal(mod.expanded,true);
  assert.equal(mod.state.expanded.length,0);
  assert.deepEqual(mod.events.filter(x=>x[0]==='changeDay'),[['changeDay',-1],['changeDay',1]]);
  assert.ok(mod.events.find(x=>x[0]==='fetchScores'&&x[1]===true));
  assert.equal(mod.homePrevented,true);
  assert.equal(mod.state.query,'Boston');
  assert.equal(mod.state.liveOnly,true);
});
test('renderer source retains the keyed DOM patcher, safe escaping, and does not add network requests',async()=>{
  const c=await readFile(join(root,'src/features/scoreboard/render.module.mjs'),'utf8');
  const legacy=await sourceFile('render');
  for(const needle of ['patchGameDOM','reconcileGameSections','gameMarkupCache','new WeakMap()']){
    assert.ok(c.includes(needle)&&legacy.includes(needle));
  }
  assert.doesNotMatch(c,/\bfetch\s*\(/);
  assert.doesNotMatch(c,/setInterval\s*\(/);
  const data=await readFile(join(root,'src/features/scoreboard/data.js'),'utf8');
  assert.match(data,/scoreRequestStatus/);
});
