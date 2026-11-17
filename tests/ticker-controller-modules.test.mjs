import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createContext,runInContext} from 'node:vm';
import {createTickerController} from '../src/features/ticker/controller.module.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const copy=value=>JSON.parse(JSON.stringify(value));
function sampleGame(phase='live',awayScore='104',homeScore='101'){
  return {id:'401',_phase:phase,date:'2026-11-16T20:00:00Z',
    competitions:[{competitors:[
      {homeAway:'away',score:awayScore,team:{abbreviation:'BOS',displayName:'Boston Celtics'}},
      {homeAway:'home',score:homeScore,team:{abbreviation:'NYK',displayName:'New York Knicks'}}
    ]}]};
}
function setup(){
  const raf=[],timers=[],observers=[],disposals=[],media={reduced:{matches:false},hover:{matches:false}};
  const settingsPrefs={autoScroll:true,tickerSpeed:'normal'},state={games:[sampleGame()]};
  let now=2000;
  const performance={now:()=>now};
  const window={matchMedia:query=>query.includes('reduced-motion')?media.reduced:media.hover};
  const document={hidden:false,activeElement:null};
  class AbortStub{constructor(){this.signal={};}abort(){disposals.push('abort');}}
  class ResizeStub{
    constructor(fn){this.callback=fn;observers.push(this);}
    observe(win){this.element=win;}
    disconnect(){disposals.push('resize-disconnect');}
  }
  const getGameTeams=game=>{
    const a=game.competitions[0].competitors;
    return [a.find(x=>x.homeAway==='away').team,a.find(x=>x.homeAway==='home').team];
  };
  const getStatus=()=> 'Q4 1:30',formatStart=()=> '7:00 PM',safe=x=>String(x);
  const requestAnimationFrame=fn=>{raf.push(fn);return raf.length;};
  const setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length;};
  const elements=new Map(),$=id=>elements.get(id)||null;
  return {raf,timers,observers,disposals,media,settingsPrefs,state,performance,window,document,
    AbortController:AbortStub,ResizeObserver:ResizeStub,requestAnimationFrame,setTimeout,
    getGameTeams,getStatus,formatStart,safe,$,Date,now:v=>{now=v;}};
}
async function make(mode){
  const e=setup();
  if(mode==='module'){
    const api=createTickerController({
      ...e,getGames:()=>e.state.games,getSettingsPrefs:()=>e.settingsPrefs,
      syncFrame:id=>{e.latestFrame=id;}
    });
    return {...e,api};
  }
  const source=await readFile(join(root,'src/features/ticker/controller.legacy.js'),'utf8');
  const ctx=createContext({...e});
  runInContext(source+'\nglobalThis.testApi={'+[
    'formatTickerGame','tickerControllers','tickerReducedMotion','tickerDesktopHover',
    'tickerDispose','tickerNormalize','tickerEnsureCopies','tickerPause','tickerInitialize',
    'tickerFrameStep','paintTicker','renderTickers'
  ].join(',')+',get tickerFrame(){return tickerFrame;}};',ctx);
  return {...e,api:ctx.testApi};
}
function mockTicker(){
  const handlers=new Map(),children=[];
  const cls={add(){},remove(){}};
  const win={isConnected:true,clientWidth:620,scrollLeft:0,tabIndex:-1,
    classList:cls,addEventListener:(type,fn)=>handlers.set(type,fn),
    setAttribute(){},matches:()=>false,contains:()=>false,
    hasPointerCapture:()=>false,releasePointerCapture(){},setPointerCapture(){}};
  const track={children,querySelectorAll:()=>children,
    appendChild(item){children.push(item);},get lastElementChild(){return children.at(-1);}};
  function button(i){
    const item={offsetLeft:i*180,className:'ticker-item',
      setAttribute(){},cloneNode(){return button(i);},remove(){children.splice(children.indexOf(item),1);}};
    return item;
  }
  for(let i=0;i<6;i++)children.push(button(i));
  const el={matches:()=>false,querySelector:selector=>selector==='.ticker-window'?win:selector==='.ticker-track'?track:null};
  return {el,win,track,handlers};
}
function inspect(f){
  const a=f.api,box=mockTicker();
  a.tickerInitialize(box.el,2);
  const c=a.tickerControllers.get(box.el);
  const init={controllers:a.tickerControllers.size,copies:box.track.children.length,
    ready:c.ready,unit:c.unit,scroll:box.win.scrollLeft,
    observed:!!c.observer,windowLabel:box.win.tabIndex};
  box.win.scrollLeft=0;
  a.tickerNormalize(c);
  const wrapped=box.win.scrollLeft;
  box.win.scrollLeft=c.unit*2+14;
  a.tickerNormalize(c);
  const wrappedRight=box.win.scrollLeft;
  c.lastTime=1000;c.pauseUntil=0;c.autoRemainder=0;
  box.win.scrollLeft=c.unit;
  for(const t of [1100,1200,1300,1400,1500])a.tickerFrameStep(t);
  const moved=box.win.scrollLeft;
  f.settingsPrefs.autoScroll=false;
  for(const t of [1600,1700,1800])a.tickerFrameStep(t);
  const paused=box.win.scrollLeft;
  f.settingsPrefs.autoScroll=true;
  f.media.reduced.matches=true;
  for(const t of [1900,2000,2100])a.tickerFrameStep(t);
  const reduced=box.win.scrollLeft;
  f.media.reduced.matches=false;
  a.tickerPause(c);
  f.now(3000);
  const pauseUntil=c.pauseUntil;
  a.tickerFrameStep(3200);
  const duringPause=box.win.scrollLeft;
  const format=['live','upcoming','final'].map(phase=>a.formatTickerGame(sampleGame(phase)));
  a.tickerDispose(box.el);
  return {init,wrapped,wrappedRight,moved,paused,reduced,pauseUntil,duringPause,
    format:copy(format),controllersAfterDispose:a.tickerControllers.size,
    disposals:copy(f.disposals),scheduled:f.raf.length,currentFrame:a.tickerFrame};
}
test('ticker engine matches frozen legacy for formats, continuous loop, scroll wrap, pause, reduced motion and disposal',async()=>{
  const old=inspect(await make('legacy')),mod=inspect(await make('module'));
  assert.deepEqual(mod,old);
  assert.equal(mod.init.controllers,1);
  assert.equal(mod.init.ready,true);
  assert.equal(mod.init.copies,14,'ticker clones enough copies to cover 620px');
  assert.equal(mod.wrapped,mod.init.unit);
  assert.equal(mod.wrappedRight,mod.init.unit+14);
  assert.ok(mod.moved>mod.init.unit,'normal autoscroll advances');
  assert.equal(mod.paused,mod.moved);
  assert.equal(mod.reduced,mod.paused);
  assert.ok(mod.pauseUntil>3000);
  assert.equal(mod.duringPause,mod.paused);
  assert.equal(mod.controllersAfterDispose,0);
  assert.deepEqual(mod.disposals,['abort','resize-disconnect']);
  assert.equal(mod.scheduled,12); // initial RAF plus eleven manually driven ticks
  assert.equal(mod.currentFrame,mod.scheduled);
  assert.equal(mod.format[0].id,'401');
});
test('separate main and Viewer ticker controllers share only one RAF loop and clean up independently',async()=>{
  for(const mode of ['legacy','module']){
    const f=await make(mode),a=f.api,left=mockTicker(),right=mockTicker();
    assert.equal(f.raf.length,1);
    a.tickerInitialize(left.el,2);
    a.tickerInitialize(right.el,2);
    assert.equal(a.tickerControllers.size,2);
    assert.equal(f.raf.length,1,'creating a second ticker does not start a second animation loop');
    const count=f.observers.length;
    a.tickerInitialize(left.el,2);
    assert.equal(f.observers.length,count,'same DOM subtree reuses existing controller');
    a.tickerDispose(left.el);
    assert.equal(a.tickerControllers.size,1);
    assert.ok(a.tickerControllers.has(right.el));
    a.tickerDispose(right.el);
    assert.equal(a.tickerControllers.size,0);
  }
});
test('read-through game and Settings getters, late-bound formatters and no independent network calls',async()=>{
  const env=await make('module'),api=env.api;
  const first=api.formatTickerGame(env.state.games[0]);
  assert.match(first.html,/Q4 1:30/);
  env.state.games=[sampleGame('final')];
  assert.match(api.formatTickerGame(env.state.games[0]).html,/FINAL/);
  const fragment=await readFile(join(root,'src/features/ticker/controller.js'),'utf8');
  assert.match(fragment,/getGames:\(\)=>state\.games/);
  assert.match(fragment,/getSettingsPrefs:\(\)=>settingsPrefs/);
  const source=await readFile(join(root,'src/features/ticker/controller.module.mjs'),'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/\bsetInterval\s*\(/);
});
