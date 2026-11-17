"""Chunk 08: ticker DOM, score repaint, scroll/interaction, two controllers, and iframe parity."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
legacy=root/'dist'/'courtside-legacy-proof.html'
modern=root/'dist'/'courtside.html'
assert legacy.is_file() and modern.is_file()
JS=r"""() => {
  const fixture=(id,phase,away,home)=>({
    id,date:'2026-11-16T20:00:00Z',_phase:phase,status:{
      displayClock:'1:30',period:4,type:{state:phase==='live'?'in':phase==='final'?'post':'pre'}
    },
    competitions:[{competitors:[
      {homeAway:'away',score:String(away),team:{abbreviation:'BOS',displayName:'Boston Celtics'}},
      {homeAway:'home',score:String(home),team:{abbreviation:'NYK',displayName:'New York Knicks'}}
    ]}]
  });
  settingsPrefs.autoScroll=false;
  settingsPrefs.tickerSpeed='normal';
  settingsPrefs.showTicker=true;
  state.games=[fixture('401','live',104,102),fixture('402','upcoming',0,0)];
  $('viewer').hidden=false;
  $('viewerTicker').hidden=false;
  const frame=$('playerFrame0');
  const iframe='https://streams.example.org/unchanged-player';
  frame.setAttribute('src',iframe);
  const iframeObserver=new MutationObserver(()=>{});
  iframeObserver.observe(frame,{attributes:true,attributeFilter:['src']});
  const states=[],capture=label=>{
    const detail=id=>{
      const el=$(id),win=el.querySelector('.ticker-window'),
        track=el.querySelector('.ticker-track'),c=tickerControllers.get(el);
      return {present:!!win,tracked:!!c,
        count:c?.count||0,ready:!!c?.ready,unit:c?.unit||0,
        scroll:win?.scrollLeft||0,copies:track?.children.length||0,
        buttons:[...(track?.querySelectorAll('.ticker-item')||[])].slice(0,2).map(e=>({
          game:e.dataset.tickerGame,label:e.getAttribute('aria-label'),
          html:e.innerHTML,className:e.className
        }))
      };
    };
    states.push({label,score:detail('scoreTicker'),viewer:detail('viewerTicker'),
      frame:frame.getAttribute('src'),
      iframeMutations:iframeObserver.takeRecords().filter(x=>x.attributeName==='src').length});
  };
  try{
    renderTickers();
    capture('initial');
    const firstTrack=$('scoreTicker').querySelector('.ticker-track'),
      firstWindow=$('scoreTicker').querySelector('.ticker-window');
    const viewerTrack=$('viewerTicker').querySelector('.ticker-track');
    const c=tickerControllers.get($('scoreTicker'));
    const d=tickerControllers.get($('viewerTicker'));
    state.games[0].competitions[0].competitors[0].score='105';
    renderTickers();
    capture('same-order-new-score');
    const reused=firstTrack===$('scoreTicker').querySelector('.ticker-track');
    const viewerReused=viewerTrack===$('viewerTicker').querySelector('.ticker-track');
    const registrations=tickerControllers.size;
    firstWindow.focus();
    const arrow=new KeyboardEvent('keydown',{key:'ArrowRight',cancelable:true,bubbles:true});
    firstWindow.dispatchEvent(arrow);
    const arrowStatus={prevented:arrow.defaultPrevented,paused:c.pauseUntil>performance.now()};
    capture('keyboard-scroll');
    const wheel=new WheelEvent('wheel',{deltaY:112,shiftKey:true,cancelable:true,bubbles:true});
    firstWindow.dispatchEvent(wheel);
    const wheelStatus={prevented:wheel.defaultPrevented,paused:c.pauseUntil>performance.now()};
    capture('shift-wheel-scroll');
    const pointer=(name,x)=>new PointerEvent(name,{pointerType:'mouse',
      pointerId:17,button:0,clientX:x,cancelable:true,bubbles:true});
    firstWindow.dispatchEvent(pointer('pointerdown',200));
    const move=pointer('pointermove',150);
    firstWindow.dispatchEvent(move);
    const dragging=c.dragging,dragPrevented=move.defaultPrevented;
    firstWindow.dispatchEvent(pointer('pointerup',150));
    const suppressedBeforeClick=c.suppressClick;
    const click=new MouseEvent('click',{cancelable:true,bubbles:true});
    firstWindow.dispatchEvent(click);
    const suppressedClick=click.defaultPrevented;
    capture('pointer-drag');
    firstWindow.blur();
    settingsPrefs.tickerSpeed='fast';
    settingsPrefs.autoScroll=true;
    c.pauseUntil=0;
    c.lastTime=1000;c.autoRemainder=0;
    const beforeAuto=firstWindow.scrollLeft;
    for(const t of [1100,1200,1300,1400,1500,1600])tickerFrameStep(t);
    const afterAuto=firstWindow.scrollLeft;
    const autoTest={changed:afterAuto!==beforeAuto,remaining:c.autoRemainder>0};
    capture('fast-auto-scroll');
    settingsPrefs.autoScroll=false;
    for(const t of [1700,1800,1900])tickerFrameStep(t);
    const idleTest={unchanged:afterAuto===firstWindow.scrollLeft};
    capture('paused-auto-scroll');
    const initialController=c;
    state.games=[];
    renderTickers();
    capture('no-games-cleanup');
    return {states,reused,viewerReused,registrations,arrowStatus,wheelStatus,
      dragging,dragPrevented,suppressedBeforeClick,suppressedClick,
      autoTest,idleTest,disposed:!tickerControllers.has($('scoreTicker')),
      independent:initialController!==d,iframe};
  }finally{iframeObserver.disconnect();}
}"""
def inspect(browser,path):
    page=browser.new_page(viewport={'width':1460,'height':900})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/*',lambda request:request.abort())
    try:
        page.set_content(path.read_text('utf8'),wait_until='domcontentloaded',timeout=20000)
        data=page.evaluate(JS)
        assert not errors,errors
        return data
    finally:page.close()
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True)
    try:
        original=inspect(browser,legacy)
        updated=inspect(browser,modern)
    finally:browser.close()
assert original==updated,next(((i,a,b) for i,(a,b) in enumerate(zip(original['states'],updated['states'])) if a!=b),None)
assert original['reused'] and original['viewerReused']
assert original['registrations']==2
assert original['independent'] and original['disposed']
assert original['arrowStatus']['prevented'] and original['wheelStatus']['prevented']
assert original['dragging'] and original['dragPrevented']
assert original['suppressedBeforeClick'] and original['suppressedClick']
assert original['autoTest']['changed'] and original['idleTest']['unchanged']
assert original['states'][0]['score']['present']
assert original['states'][0]['score']['copies']>=6
assert original['states'][1]['score']['buttons'][0]['html']!=original['states'][0]['score']['buttons'][0]['html']
assert all(s['iframeMutations']==0 and s['frame']==original['iframe'] for s in original['states'])
assert not original['states'][-1]['score']['present']
print('PASS: Chunk 08 ticker old/new parity, two controllers, scroll/drag, stable DOM on score updates and unchanged Viewer iframe')
