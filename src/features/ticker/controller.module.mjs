/**
 * Standalone ticker engine: one RAF loop, two independently mounted tickers.
 * The original scroll, drag, resize, focus, reduced-motion and cleanup logic
 * remains intact. Application state and Settings are read lazily.
 */
export function createTickerController({$,window,document,getGames,getSettingsPrefs,
  getGameTeams,getStatus,formatStart,safe,AbortController,ResizeObserver,
  requestAnimationFrame,setTimeout,performance,Date,syncFrame}) {
function formatTickerGame(game){
  const [away,home]=getGameTeams(game);
  const comp=game.competitions?.[0];
  const a=comp?.competitors?.find(c=>c.homeAway==='away');
  const h=comp?.competitors?.find(c=>c.homeAway==='home');
  const phase=game._phase;
  const status=phase==='live'?getStatus(game):phase==='final'?'FINAL':formatStart(game.date);
  const label=`${away?.abbreviation||'AWY'} at ${home?.abbreviation||'HME'} · ${status}`;
  const html=`<span class="ticker-teams"><span>${safe(away?.abbreviation||'AWY')} @ ${safe(home?.abbreviation||'HME')}</span><span class="ticker-meta">${safe(status)}</span></span><span class="ticker-score">${phase==='upcoming'?'—':`${safe(a?.score??'—')}–${safe(h?.score??'—')}`}</span>`;
  return {id:String(game.id),html,label,live:phase==='live'};
}
// One controller per mounted ticker; both the scoreboard and video overlay use it.
const tickerControllers=new Map();
const tickerReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const tickerDesktopHover=window.matchMedia('(hover: hover) and (pointer: fine)');
function tickerDispose(el){
  const c=tickerControllers.get(el);
  if(!c)return;
  c.abort.abort();c.observer?.disconnect();tickerControllers.delete(el);
}
function tickerNormalize(c){
  if(!c.unit||!c.ready)return;
  const x=c.window.scrollLeft;
  // An extra identical copy on either side makes wrapping visually seamless.
  if(x<c.unit)c.window.scrollLeft=x+c.unit;
  else if(x>=c.unit*2)c.window.scrollLeft=x-c.unit;
}
function tickerEnsureCopies(c){
  if(!c.window.isConnected||!c.window.clientWidth||!c.count)return;
  const buttons=c.track.querySelectorAll(':scope > .ticker-item');
  if(buttons.length<c.count*3)return;
  const unit=buttons[c.count].offsetLeft-buttons[0].offsetLeft;
  if(!(unit>0))return;
  // Three complete cycles plus enough copies to cover a large desktop viewport.
  const required=Math.max(3,Math.ceil(c.window.clientWidth/unit)+3);
  const oldUnit=c.unit,oldScroll=c.window.scrollLeft;
  while(c.track.children.length<c.count*required){
    for(let i=0;i<c.count;i++){
      const copy=c.track.children[i].cloneNode(true);
      copy.setAttribute('aria-hidden','true');copy.tabIndex=-1;
      c.track.appendChild(copy);
    }
  }
  while(c.track.children.length>c.count*required)c.track.lastElementChild.remove();
  c.unit=unit;
  if(!c.ready){c.window.scrollLeft=unit;c.ready=true;}
  else if(Math.abs(oldUnit-unit)>.5)c.window.scrollLeft=unit+((oldScroll-oldUnit)/oldUnit)*unit;
  tickerNormalize(c);
}
function tickerPause(c){c.pauseUntil=performance.now()+6000;}
function tickerInitialize(el,count){
  const win=el.querySelector('.ticker-window');
  const track=el.querySelector('.ticker-track');
  if(!win||!track){tickerDispose(el);return;}
  let c=tickerControllers.get(el);
  if(c?.window===win){c.count=count;tickerEnsureCopies(c);return;}
  tickerDispose(el);
  const abort=new AbortController();
  c={el,window:win,track,count,unit:0,ready:false,dragging:false,candidate:null,
    pauseUntil:0,lastTime:0,abort,observer:null,suppressClick:false};
  tickerControllers.set(el,c);
  const signal=abort.signal;
  win.tabIndex=0;
  win.setAttribute('aria-label','Scores ticker. Drag or swipe horizontally, or use left and right arrow keys. Select a score to open its game.');
  win.addEventListener('scroll',()=>tickerNormalize(c),{signal,passive:true});
  win.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='mouse'||event.button!==0)return;
    c.candidate={pointerId:event.pointerId,startX:event.clientX,lastX:event.clientX};
    c.dragging=false;tickerPause(c);
  },{signal});
  win.addEventListener('pointermove',event=>{
    if(!c.candidate||c.candidate.pointerId!==event.pointerId)return;
    const distance=Math.abs(event.clientX-c.candidate.startX);
    if(!c.dragging&&distance>6){
      c.dragging=true;win.classList.add('is-dragging');
      try{win.setPointerCapture(event.pointerId);}catch{}
    }
    if(c.dragging){
      event.preventDefault();
      win.scrollLeft-=event.clientX-c.candidate.lastX;
      tickerNormalize(c);tickerPause(c);
    }
    c.candidate.lastX=event.clientX;
  },{signal});
  const finish=event=>{
    if(!c.candidate||c.candidate.pointerId!==event.pointerId)return;
    if(c.dragging){
      // A mouse press on a game button gives it focus. Clear focus from a drag
      // (not a click), otherwise :focus-within would pause auto-scroll forever.
      if(win.contains(document.activeElement))document.activeElement.blur();
      c.suppressClick=true;
      // Click is dispatched after pointerup; suppress that one, not future clicks.
      setTimeout(()=>{c.suppressClick=false;},0);
      try{if(win.hasPointerCapture(event.pointerId))win.releasePointerCapture(event.pointerId);}catch{}
    }
    c.dragging=false;c.candidate=null;win.classList.remove('is-dragging');tickerPause(c);
  };
  win.addEventListener('pointerup',finish,{signal});
  win.addEventListener('pointercancel',finish,{signal});
  win.addEventListener('lostpointercapture',event=>{
    if(c.candidate?.pointerId===event.pointerId)finish(event);
  },{signal});
  win.addEventListener('click',event=>{
    if(c.suppressClick){event.preventDefault();event.stopImmediatePropagation();c.suppressClick=false;}
  },{capture:true,signal});
  win.addEventListener('touchstart',()=>tickerPause(c),{passive:true,signal});
  win.addEventListener('touchend',()=>tickerPause(c),{passive:true,signal});
  win.addEventListener('wheel',event=>{
    if(!event.shiftKey)return; // Normal vertical page scrolling stays available.
    event.preventDefault();win.scrollLeft+=event.deltaY||event.deltaX;
    tickerNormalize(c);tickerPause(c);
  },{passive:false,signal});
  win.addEventListener('keydown',event=>{
    if(event.target!==win||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();win.scrollLeft+=event.key==='ArrowRight'?130:-130;
    tickerNormalize(c);tickerPause(c);
  },{signal});
  if(typeof ResizeObserver!=='undefined'){
    c.observer=new ResizeObserver(()=>tickerEnsureCopies(c));c.observer.observe(win);
  }
  tickerEnsureCopies(c);
}
// A single animation loop drives both tickers, avoiding animation resets on score updates.
let tickerFrame=0;
function tickerFrameStep(time){
  for(const c of tickerControllers.values()){
    const delta=c.lastTime?Math.min(80,time-c.lastTime):0;c.lastTime=time;
    if(!getSettingsPrefs().autoScroll||!c.ready||!c.window.clientWidth||document.hidden||tickerReducedMotion.matches||c.dragging||time<c.pauseUntil||
       (tickerDesktopHover.matches&&c.el.matches(':hover'))||c.el.matches(':focus-within'))continue;
    const duration=Math.max(22,c.count*7)/(getSettingsPrefs().tickerSpeed==='slow'?.6:getSettingsPrefs().tickerSpeed==='fast'?1.8:1);
    // Accumulate fractional pixels; scrollLeft rounds subpixel writes in some
    // browsers, otherwise a slow auto-scroll can appear completely frozen.
    c.autoRemainder=(c.autoRemainder||0)+c.unit/duration*(delta/1000);
    if(c.autoRemainder>=1){
      const step=Math.floor(c.autoRemainder);
      c.autoRemainder-=step;c.window.scrollLeft+=step;
      tickerNormalize(c);
    }
  }
  tickerFrame=requestAnimationFrame(tickerFrameStep);syncFrame(tickerFrame);
}
tickerFrame=requestAnimationFrame(tickerFrameStep);syncFrame(tickerFrame);
function paintTicker(el){
  if(!el)return;
  if(!getGames().length){
    tickerDispose(el);
    const markup='<div class="score-ticker-label">NBA SCORES</div><span class="ticker-empty">No games listed for this date</span>';
    if(el.innerHTML!==markup)el.innerHTML=markup;
    return;
  }
  const games=[...getGames()].sort((a,b)=>({live:0,upcoming:1,final:2}[a._phase]-({live:0,upcoming:1,final:2}[b._phase]))||new Date(a.date)-new Date(b.date));
  const entries=games.map(formatTickerGame);
  const existing=[...el.querySelectorAll('.ticker-track > .ticker-item')];
  // Preserve scrollLeft and gesture state when the day's game order is unchanged.
  if(existing.length>=entries.length*3&&existing.length%entries.length===0&&
     existing.every((button,i)=>button.dataset.tickerGame===entries[i%entries.length].id)){
    for(const [i,button] of existing.entries()){
      const item=entries[i%entries.length],nextClass=`ticker-item ${item.live?'is-live':''}`;
      if(button.className!==nextClass)button.className=nextClass;
      if(button.getAttribute('aria-label')!==item.label)button.setAttribute('aria-label',item.label);
      if(button.innerHTML!==item.html)button.innerHTML=item.html;
    }
    tickerInitialize(el,entries.length);
    return;
  }
  const buttons=(copy=false)=>entries.map(item=>`<button type="button" class="ticker-item ${item.live?'is-live':''}" data-ticker-game="${safe(item.id)}" aria-label="${safe(item.label)}" ${copy?'tabindex="-1" aria-hidden="true"':''}>${item.html}</button>`).join('');
  el.innerHTML=`<div class="score-ticker-label"><span class="dot"></span>NBA SCORES</div><div class="ticker-window"><div class="ticker-track">${buttons()}${buttons(true)}${buttons(true)}</div></div>`;
  tickerInitialize(el,entries.length);
}
function renderTickers(){paintTicker($('scoreTicker'));paintTicker($('viewerTicker'));}
  return {
    tickerControllers,tickerReducedMotion,tickerDesktopHover,
    formatTickerGame,
    tickerDispose,
    tickerNormalize,
    tickerEnsureCopies,
    tickerPause,
    tickerInitialize,
    tickerFrameStep,
    paintTicker,
    renderTickers,
    get tickerFrame(){return tickerFrame;}
  };
}
