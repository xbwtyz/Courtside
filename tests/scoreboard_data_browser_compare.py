"""Chunk 10 Scoreboard data comparison with the untouched 1.6.1 web app.

No external network is allowed. A mock ESPN response is used; all other APIs
remain blocked and the existing Viewer iframe is checked for unexpected reloads.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'dist'/'courtside-legacy-proof.html'
NEW=ROOT/'dist'/'courtside.html'
fixture=json.loads((ROOT/'tests'/'fixtures'/'scoreboard.json').read_text())
assert OLD.is_file() and NEW.is_file()
JS=r"""async fixture => {
  const frame=$('playerFrame0'),iframe='https://streams.example.org/keep-playing';
  frame.setAttribute('src',iframe);
  const observer=new MutationObserver(()=>{});
  observer.observe(frame,{attributes:true,attributeFilter:['src']});
  const requests=[];
  const initialFetch=window.fetch;
  const records=[];
  const capture=(label)=>({
    label,
    date:state.date,
    ids:state.games.map(g=>String(g.id)),
    phases:state.games.map(g=>g._phase),
    firstLoaded:state.firstLoaded,
    loading:state.loading,
    pending:!!state.controller,
    scoreFailures:espnPoll.scoreFailures,
    error:state.error,
    nextAtCooldown:state.nextAt>=espnPoll.sharedUntil,
    renderedCards:document.querySelectorAll('#scoreboard article.game').length,
    status:$('connection').textContent.replace(/[0-9]{1,2}:[0-9]{2}.*/g,'').trim(),
    iframe:frame.getAttribute('src'),
    iframeWrites:observer.takeRecords().length,
    requestCount:requests.length
  });
  const oldDate=state.date;
  try{
    state.date='2026-11-16';
    state.games=[];state.loading=false;state.error='';state.firstLoaded=false;
    state.lastUpdated=null;state.nextAt=0;state.requestSeq++;
    espnPoll.sharedUntil=Date.now()+90000;
    updateStatus();
    records.push(capture('initial'));
    await fetchScores(true);
    records.push(capture('manual-cooldown'));
    selectDay('2026-11-17');
    records.push(capture('cooldown-date-change'));
    espnPoll.sharedUntil=0;state.nextAt=0;
    window.fetch=async (url,options)=>{
      requests.push({url:String(url),method:'GET',signalPresent:!!options?.signal,cache:options?.cache});
      return {ok:true,status:200,headers:{get:()=>null},json:async()=>fixture};
    };
    await fetchScores(true);
    records.push(capture('ESPN-success'));
    const beforeRender=frame.getAttribute('src');
    const card=document.querySelector('#scoreboard article.game');
    const cardIdentity=card;
    render();renderTickers();
    records.push(capture('ordinary-repaint'));
    return {
      records,requests,cardPreserved:document.contains(cardIdentity),
      originalIframe:beforeRender,unchangedIframe:frame.getAttribute('src')===beforeRender,
      noExtraRequests:requests.length===1
    };
  }finally{
    observer.disconnect();window.fetch=initialFetch;
  }
}"""
def inspect(browser,path):
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/*',lambda route:route.abort())
    try:
        page.set_content(path.read_text('utf8'),wait_until='domcontentloaded',timeout=20000)
        result=page.evaluate(JS,fixture)
        assert not errors,errors
        return result
    finally:page.close()
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    try:
        old=inspect(browser,OLD)
        new=inspect(browser,NEW)
    finally:browser.close()
assert new==old,{'old':old,'new':new}
assert len(new['records'])==5
assert new['records'][1]['requestCount']==0
assert new['records'][2]['date']=='2026-11-17'
assert new['records'][3]['ids']==['401000001','401000002','401000003']
assert new['records'][3]['loading'] is False
assert new['noExtraRequests'] and new['cardPreserved'] and new['unchangedIframe']
assert all(x['iframeWrites']==0 and x['iframe']==new['originalIframe'] for x in new['records'])
print('PASS: Chunk 10 ESPN date/cooldown/synthetic request, scoreboard, and iframe continuity match 1.6.1')
