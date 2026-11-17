"""Chunk 12: Game Center summary/cache and controller/handler parity with 1.6.1."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'dist'/'courtside-legacy-proof.html'
MODERN=ROOT/'dist'/'courtside.html'
assert OLD.is_file() and MODERN.is_file()
JS=r"""async () => {
  const game={id:'401000002',_phase:'live',
    status:{type:{state:'in',shortDetail:'Q4 2:30'}},
    competitions:[{competitors:[
      {homeAway:'away',score:'104',team:{id:'2',abbreviation:'BOS',displayName:'Boston Celtics'}},
      {homeAway:'home',score:'102',team:{id:'18',abbreviation:'NYK',displayName:'New York Knicks'}}
    ]}]};
  const summary={header:{competitions:[{competitors:game.competitions[0].competitors,
    status:{type:{state:'in'},period:4}}]},
    boxscore:{players:[],teams:[]},plays:[],winprobability:[]};
  const iframe=$('playerFrame0');
  const src='https://streams.example.org/keep-running';
  iframe.setAttribute('src',src);
  const observer=new MutationObserver(()=>{});
  observer.observe(iframe,{attributes:true,attributeFilter:['src']});
  const originalFetch=window.fetch,previousCombined=combinedSourcesForId;
  const requests=[],states=[];
  const snap=label=>states.push({label,tab:viewerState.statsTab,statsOpen:viewerState.statsOpen,
    gameId:viewerState.gameId,cacheSize:viewerState.statsCache.size,
    pending:viewerState.statsPending.size,statsError:viewerState.statsError,
    statsSeq:viewerState.statsSeq,boxWide:viewerState.boxWide,
    boxTeam:viewerState.boxTeam,boxSort:viewerState.boxSort,boxSortDesc:viewerState.boxSortDesc,
    chart:viewerState.chartView,
    panelText:$('statsContent').textContent.replace(/\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)/gi,'TIME').slice(0,600),
    requests:requests.length,src:iframe.getAttribute('src'),
    iframeMutations:observer.takeRecords().length});
  try{
    combinedSourcesForId=()=>[{name:'Mock source',url:src}];
    state.games=[game];
    viewerState.layout=1;viewerState.activeTile=0;
    viewerState.liveGames=[];viewerState.statsDisplayKey=null;
    viewerState.slots=Array.from({length:4},()=>({gameId:null,sourceUrl:null,sources:[]}));
    viewerState.slots[0].gameId=game.id;
    viewerState.slots[0].sourceUrl=src;
    viewerState.gameId=game.id;
    viewerState.statsOpen=true;
    viewerState.statsTab='box';
    viewerState.statsSeq+=10;
    viewerState.statsError='';
    viewerState.boxWide=false;viewerState.boxTeam=null;viewerState.boxSort='pts';viewerState.boxSortDesc=true;
    viewerState.statsCache.clear();viewerState.statsPending.clear();
    statsPoll.nextAt=0;statsPoll.failures=0;statsPoll.gameId=null;
    espnPoll.sharedUntil=0;
    $('viewer').hidden=false;
    window.fetch=async(url,opts)=>{
      requests.push({url:String(url),signal:!!opts?.signal,cache:opts?.cache});
      return {ok:true,status:200,headers:{get:()=>null},json:async()=>summary};
    };
    await updateStatsSidebar(true);
    snap('summary-fetched');
    await updateStatsSidebar(false);
    snap('summary-cache-used');
    const sort=$('statsSidebar').querySelector('[data-bs-sort="pts"]');
    sort?.click();
    snap('sort-interaction');
    $('statsSidebar').querySelector('#bsWideToggle')?.click();
    snap('wide-interaction');
    const tab=$('statsSidebar').querySelector('[data-bs-tab="team"]');
    tab?.click();
    snap('team-tab');
    const chartTab=$('statsSidebar').querySelector('[data-bs-tab="charts"]');
    chartTab?.click();
    snap('charts-tab');
    if(statsPoll.gameId!==game.id)statsPoll.gameId=game.id;
    espnPoll.sharedUntil=Date.now()+60000;
    await updateStatsSidebar(true);
    snap('cooldown');
    $('viewer').hidden=true;
    await updateStatsSidebar(true);
    snap('hidden-no-refresh');
    return {states,requests,iframeStable:states.every(s=>s.src===src&&s.iframeMutations===0)};
  }finally{
    window.fetch=originalFetch;combinedSourcesForId=previousCombined;observer.disconnect();
  }
}"""
def inspect(browser,path):
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda route:route.abort())
    try:
        page.set_content(path.read_text('utf8'),wait_until='domcontentloaded',timeout=20000)
        result=page.evaluate(JS)
        assert not errors,errors
        return result
    finally:page.close()
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    try:
        before=inspect(browser,OLD)
        after=inspect(browser,MODERN)
    finally:browser.close()
assert after==before,{'legacy':before,'modular':after}
assert len(after['states'])==8
assert after['states'][0]['cacheSize']==1
assert after['states'][1]['requests']==1
assert after['states'][3]['boxWide']
assert after['states'][4]['tab']=='team'
assert after['states'][5]['tab']=='charts'
assert after['states'][6]['requests']==after['states'][5]['requests'], 'Cooldown must not start another ESPN request'
assert after['iframeStable']
assert len(after['requests'])==1
print('PASS: Chunk 12 summary, cache, tab/sort/width controls and cooldown match 1.6.1; no Viewer iframe reloads')
