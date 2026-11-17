import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { createStatGlossary } from '../src/features/stat-glossary/module.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const oldCode = await readFile(join(root, 'src/features/stat-glossary/glossary.legacy.js'), 'utf8');
const json = obj => JSON.parse(JSON.stringify(obj));

function makeEnvironment() {
  const listeners = new Map(), headers = [], queued = [], observers = [];
  let frameId = 0;
  class Element {
    constructor(tag) {
      this.tagName=tag.toUpperCase();this.parentNode=null;this.children=[];this.childNodes=[];
      this.attributes={};this.className='';this.id='';this.type='';this.hidden=false;
      this.textContent='';this.innerHTML='';this.dataset={};this.style={};
      this.offsetWidth=240;this.offsetHeight=44;this.isConnected=true;
    }
    appendChild(el){el.parentNode=this;this.children.push(el);this.childNodes.push(el);return el;}
    setAttribute(key,value){this.attributes[key]=value;}
    querySelector(selector){
      if(selector==='.stat-info')return this.children.find(el=>el.className==='stat-info')||null;
      if(selector.includes('button[data-leader-sort]'))return this.children.find(el=>el.sortButton)||null;
      return null;
    }
    closest(selector){
      if(selector==='button.stat-info'&&this.tagName==='BUTTON'&&this.className==='stat-info')return this;
      if(selector==='th' && this.tagName==='TH')return this;
      if(selector==='th[data-stat-glossary]'){
        let n=this;while(n){if(n.tagName==='TH'&&n.dataset.statGlossary)return n;n=n.parentNode;}return null;
      }
      if(selector==='.ticker-window')return null;
      return this.parentNode?.closest(selector) || null;
    }
    contains(target){while(target){if(target===this)return true;target=target.parentNode;}return false;}
    getBoundingClientRect(){return {left:100,top:200,bottom:228,width:100,height:28};}
  }
  const body = new Element('body');
  const document={body,createElement:tag=>new Element(tag),
    querySelectorAll:()=>headers,
    addEventListener:(type,fn,capture)=>{
      if(!listeners.has(type))listeners.set(type,[]);
      listeners.get(type).push({fn,capture:!!capture});
    }};
  const window={innerWidth:1280,innerHeight:800,listeners:new Map(),addEventListener(type,fn){this.listeners.set(type,fn);}};
  class MutationObserver {
    constructor(fn){this.notify=fn;observers.push(this);}
    observe(){this.observing=true;}
  }
  const requestAnimationFrame=fn=>{queued.push(fn);return ++frameId;};
  const Node={TEXT_NODE:3};
  const safe=text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function header(label,{sort=false}={}) {
    const th=new Element('th');
    if(sort){const button=new Element('button');button.sortButton=true;button.textContent=label;th.appendChild(button);}
    else th.childNodes.push({nodeType:3,textContent:label});
    headers.push(th);return th;
  }
  function flush(){let n=0;while(queued.length){if(++n>30)throw Error('Infinite RAF');queued.shift()();}}
  function emit(type,target,extras={}){
    const event={type,target,relatedTarget:null,pointerType:'mouse',key:'',prevented:false,stopped:false,
      preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extras};
    for(const {fn} of listeners.get(type)||[])fn(event);
    return event;
  }
  const tooltip=()=>body.children.find(x=>x.id==='csStatTooltip');
  return {globals:{document,window,Node,MutationObserver,requestAnimationFrame,safe},header,headers,flush,emit,tooltip,observers};
}
function createLegacy(env){
  const context=createContext(env.globals);
  runInContext(oldCode+'\nglobalThis.__api={statDetail,statLabel,decorateStatHeaders,scheduleStatHeaders};',context);
  return context.__api;
}
function createModern(env){return createStatGlossary(env.globals);}

function exercise(create){
  const env=makeEnvironment();
  const ppg=env.header('PPG'),fg=env.header('FG%',{sort:true}),quarter=env.header('Q2'),overtime=env.header('OT2');
  const api=create(env);env.flush();
  const snapshot=()=>({labels:env.headers.map(h=>h.dataset.statGlossary||null),buttons:env.headers.map(h=>h.children.filter(x=>x.className==='stat-info').length),
    tooltip:{hidden:env.tooltip().hidden,innerHTML:env.tooltip().innerHTML,top:env.tooltip().style.top||'',left:env.tooltip().style.left||''}});
  const states=[snapshot()];
  assert.equal(json(api.statDetail(ppg)).title,'Points Per Game');
  assert.equal(json(api.statDetail(fg)).title,'Field Goal Percentage');
  assert.equal(json(api.statDetail(quarter)).title,'Quarter 2');
  assert.equal(json(api.statDetail(overtime)).title,'Overtime 2');
  api.decorateStatHeaders();states.push(snapshot()); // Idempotent
  env.emit('pointerover',ppg);states.push(snapshot());
  env.emit('pointerout',ppg);states.push(snapshot());
  const info=ppg.querySelector('.stat-info');const event=env.emit('click',info);
  assert.equal(event.prevented,true);assert.equal(event.stopped,true);
  states.push(snapshot());
  env.emit('scroll',ppg);states.push(snapshot()); // pinned tooltip survives scroll
  env.emit('keydown',ppg,{key:'Escape'});states.push(snapshot());
  env.emit('focusin',fg);states.push(snapshot());
  env.emit('focusout',fg);states.push(snapshot());
  const added=env.header('AST');env.observers.forEach(o=>o.notify());env.flush();
  states.push(snapshot());assert.equal(added.children.filter(x=>x.className==='stat-info').length,1);
  const unknown=env.header('UNKNOWN');api.decorateStatHeaders();states.push(snapshot());
  assert.equal(unknown.querySelector('.stat-info'),null);
  assert.equal(env.tooltip().attributes.role,'tooltip');
  return {states,infoLabel:info.attributes['aria-label'],listenerCounts:[...env.observers].length};
}

test('isolated glossary reproduces all original tooltip interactions and dynamic table decoration',()=>{
  assert.deepEqual(exercise(createModern),exercise(createLegacy));
});

test('stat glossary instances hold separate tooltip and header state',()=>{
  const first=makeEnvironment(),second=makeEnvironment();
  const a=first.header('PTS'),b=second.header('REB');
  createModern(first);createModern(second);first.flush();second.flush();
  first.emit('click',a.querySelector('.stat-info'));
  assert.equal(first.tooltip().hidden,false);
  assert.equal(second.tooltip().hidden,true);
  first.emit('keydown',a,{key:'Escape'});
  assert.equal(first.tooltip().hidden,true);
  assert.equal(second.tooltip().hidden,true);
  second.emit('pointerover',b);
  assert.match(second.tooltip().innerHTML,/Rebounds/);
  assert.equal(first.tooltip().innerHTML.includes('Rebounds'),false);
});

test('stat glossary source is only initialized once and keeps all original definitions',async()=>{
  const adapter=await readFile(join(root,'src/features/stat-glossary/glossary.js'),'utf8');
  const modern=await readFile(join(root,'src/features/stat-glossary/module.mjs'),'utf8');
  assert.match(adapter,/CourtsideStatGlossary\.createStatGlossary\(/);
  assert.equal((adapter.match(/createStatGlossary\(/g)||[]).length,1);
  assert.match(modern,/statObserver\.observe\(document\.body/);
  assert.match(modern,/document\.addEventListener\('click'/);
  assert.match(modern,/\['Plus\/Minus'/);
  assert.match(modern,/scheduleStatHeaders\(\);/);
});
