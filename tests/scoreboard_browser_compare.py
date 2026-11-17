"""Chunk 09: scoreboard cards, keyed DOM patching, search, live-only, watch and navigation parity."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'dist'/'courtside-legacy-proof.html'
NEW=ROOT/'dist'/'courtside.html'
assert OLD.is_file() and NEW.is_file()
fixture=json.loads((ROOT/'tests'/'fixtures'/'scoreboard.json').read_text())
JS=r"""fixture => {
  const calls=[];
  const prev={openViewer,changeDay,selectDay,fetchScores,setMainView};
  openViewer=id=>calls.push(['watch',String(id)]);
  changeDay=n=>calls.push(['day',n]);
  selectDay=d=>calls.push(['date',d]);
  fetchScores=force=>calls.push(['fetchScores',force]);
  setMainView=tab=>calls.push(['mainView',tab]);
  const board=$('scoreboard');
  const viewerFrame=$('playerFrame0');
  const iframeSrc='https://streams.example.org/unchanged-fixture';
  viewerFrame.setAttribute('src',iframeSrc);
  const obs=new MutationObserver(()=>{});
  obs.observe(viewerFrame,{attributes:true,attributeFilter:['src']});
  const states=[];
  const snapshot=tag=>({
    tag,
    cards:[...board.querySelectorAll('article.game')].map(x=>({
      id:x.dataset.gameId,
      phase:[...x.classList].filter(y=>['live','upcoming','final'].includes(y))[0],
      text:x.innerText,
      expanded:x.querySelector('[data-game]')?.getAttribute('aria-expanded'),
      details:!!x.querySelector('.details')
    })),
    headings:[...board.querySelectorAll('.section-heading h2')].map(x=>x.textContent),
    counts:['totalCount','liveCount','upcomingCount','finalCount'].map(id=>$(id).textContent),
    empty:board.querySelector('.empty h2')?.textContent||'',
    query:state.query,
    liveOnly:state.liveOnly,
    iframeSrc:viewerFrame.getAttribute('src'),
    iframeChanges:obs.takeRecords().filter(x=>x.attributeName==='src').length
  });
  try{
    state.games=parseGames(fixture);
    state.firstLoaded=true;state.error='';state.query='';state.liveOnly=false;
    state.expanded.clear();
    render();
    states.push(snapshot('initial'));
    const first=board.querySelector('article.game');
    const stable=first;
    const watch=first.querySelector('[data-watch]');
    watch.focus();
    const beforeFocus=document.activeElement===watch;
    const live=state.games.find(g=>g._phase==='live');
    if(live){
      const target=live.competitions?.[0]?.competitors?.[0];
      target.score=String(Number(target.score||'100')+1);
    }
    render();
    states.push(snapshot('score-update'));
    const afterFocus=document.activeElement===watch;
    const preserved=first===stable&&document.contains(stable);
    watch.click();
    const expand=first.querySelector('[data-game]');
    expand.click();
    states.push(snapshot('expanded'));
    expand.click();
    states.push(snapshot('collapsed'));
    const card=board.querySelector('article.game');
    card.click();
    card.focus();
    const enter=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
    card.dispatchEvent(enter);
    const enterPrevented=enter.defaultPrevented;
    const search=$('teamSearch');
    search.value='unlikely-missing-team';
    search.dispatchEvent(new Event('input',{bubbles:true}));
    states.push(snapshot('search-empty'));
    search.value='';
    search.dispatchEvent(new Event('input',{bubbles:true}));
    states.push(snapshot('search-cleared'));
    $('liveOnly').checked=true;
    $('liveOnly').dispatchEvent(new Event('change',{bubbles:true}));
    states.push(snapshot('live-only'));
    $('liveOnly').checked=false;
    $('liveOnly').dispatchEvent(new Event('change',{bubbles:true}));
    states.push(snapshot('all-games'));
    $('prevDay').click();
    $('nextDay').click();
    $('todayBtn').click();
    $('homeLink').click();
    $('datePicker').value='2026-11-12';
    $('datePicker').dispatchEvent(new Event('change',{bubbles:true}));
    $('refreshBtn').click();
    return {states,calls,preserved,beforeFocus,afterFocus,enterPrevented,
      iframeSrc,iframeChanges:obs.takeRecords().length};
  }finally{
    obs.disconnect();
    ({openViewer,changeDay,selectDay,fetchScores,setMainView}=prev);
  }
}"""
def inspect(browser,path):
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/*',lambda request:request.abort())
    try:
        page.set_content(path.read_text('utf8'),wait_until='domcontentloaded',timeout=20000)
        data=page.evaluate(JS,fixture)
        assert not errors,errors
        return data
    finally:page.close()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    try:
        original=inspect(browser,OLD)
        modular=inspect(browser,NEW)
    finally:browser.close()
assert original==modular,{'legacy':original,'module':modular}
assert len(modular['states'])==8
assert modular['preserved'] and modular['beforeFocus'] and modular['afterFocus']
assert modular['enterPrevented']
assert modular['states'][0]['cards'] and len(modular['states'][0]['cards'])==3
assert modular['states'][4]['empty']=='No matching games'
assert modular['states'][6]['liveOnly']
assert all(s['iframeChanges']==0 and s['iframeSrc']==modular['iframeSrc'] for s in modular['states'])
assert modular['iframeChanges']==0
print('PASS: Chunk 09 scoreboard 8 UI states, DOM/focus preservation, watch/expand/search/date controls and stable Viewer iframe')
