"""Chunk 07: Viewer playback controller old-vs-new iframe lifecycle and state parity.

All provider endpoints, images and stream requests are blocked. The test compares
the full original 1.6.1 implementation with the new standalone compiled HTML.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'dist'/'courtside-legacy-proof.html'
NEW=ROOT/'dist'/'courtside.html'
assert OLD.is_file() and NEW.is_file()
JS=r"""async () => {
  const game=(id,away,home)=>({
    id,date:'2026-11-16T20:00:00Z',_phase:'live',status:{type:{state:'in'},period:3},
    competitions:[{competitors:[
      {homeAway:'away',score:'101',team:{id:'2',abbreviation:'BOS',displayName:away}},
      {homeAway:'home',score:'103',team:{id:'18',abbreviation:'NYK',displayName:home}}
    ]}]
  });
  const one=game('401','Boston Celtics','Miami Heat');
  const two=game('402','New York Knicks','Chicago Bulls');
  state.games=[one,two];
  const url1='https://streams.example.org/ppv-main';
  const urlAlt='https://streams.example.org/ppv-backup';
  const url2='https://aurasports.xyz/embed/other';
  auraGames=new Map();
  ppvEvents=[];
  matchoraEvents=[];
  settingsPrefs={...settingsPrefs,defaultLayout:2,defaultViewerTicker:true,
    defaultStatsTab:'team',defaultStatsOpen:false};
  // Preserve the original injectable function name. Its URL lists are
  // deterministic, and no provider API calls or iframe content are allowed.
  const previousSources=combinedSourcesForId;
  const previousPpv=fetchPpvStreams,previousAura=fetchAuraSchedule,previousMatchora=fetchMatchoraSchedule;
  combinedSourcesForId=id=>String(id)==='401'?
    [{provider:'PPV.st',name:'PPV.st · Main',url:url1},{provider:'PPV.st',name:'PPV.st · Backup',url:urlAlt}]:
    String(id)==='402'?[{provider:'AuraSports',name:'AuraSports · Other',url:url2}]:[];
  fetchPpvStreams=async()=>[];
  fetchAuraSchedule=async()=>new Map();
  fetchMatchoraSchedule=async()=>[];
  const frames=[0,1,2,3].map(i=>$('playerFrame'+i));
  const records=[];
  const observers=frames.map((frame,i)=>{
    const observer=new MutationObserver(()=>{});
    observer.observe(frame,{attributes:true,attributeFilter:['src']});
    return observer;
  });
  const capture=label=>{
    const mutations=observers.map(observer=>observer.takeRecords().filter(x=>x.attributeName==='src').length);
    const slots=viewerState.slots.map(s=>({
      id:s.gameId,url:s.sourceUrl,providers:s.sources.map(x=>x.provider)
    }));
    records.push({
      label,mutations,
      frameSources:frames.map(f=>f.getAttribute('src')),
      frameHidden:frames.map(f=>f.hidden),
      viewerHidden:$('viewer').hidden,
      sourceValue:$('slotSource0').value,
      sourceOptions:[...$('slotSource0').options].map(x=>x.value),
      defaultPrefs:{layout:viewerState.layout,statsOpen:viewerState.statsOpen,
        tickerOpen:viewerState.tickerOpen,statsTab:viewerState.statsTab},
      activeTile:viewerState.activeTile,gameId:viewerState.gameId,
      slots,retryDisabled:$('viewerRetry').disabled
    });
  };
  try{
    openViewer('401');
    await Promise.resolve();await Promise.resolve();
    capture('opened-using-saved-defaults');
    paintViewer();paintViewer();
    capture('repeat-paint');
    changeViewerSource(urlAlt);
    capture('manual-source-switch');
    one.competitions[0].competitors[0].score='104';
    paintViewer();
    capture('score-updated');
    changeViewerGame('402',1);
    capture('second-slot');
    setViewerLayout(1);
    capture('hide-inactive-slot');
    setViewerLayout(2);
    capture('restore-slot');
    setActiveTile(0);
    capture('activate-original-slot');
    closeViewer();
    capture('close-all-iframes');
    return records;
  }finally{
    observers.forEach(o=>o.disconnect());
    combinedSourcesForId=previousSources;
    fetchPpvStreams=previousPpv;fetchAuraSchedule=previousAura;fetchMatchoraSchedule=previousMatchora;
  }
}"""
def inspect(browser,path):
    page=browser.new_page(viewport={'width':1450,'height':920})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/*',lambda request:request.abort())
    try:
        page.set_content(path.read_text('utf8'),wait_until='domcontentloaded',timeout=20000)
        state=page.evaluate(JS)
        assert not errors,errors
        return state
    finally:page.close()
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True)
    try:
        original=inspect(browser,OLD)
        modern=inspect(browser,NEW)
    finally:browser.close()
assert modern==original,next(((i,a,b) for i,(a,b) in enumerate(zip(original,modern)) if a!=b),None)
assert len(modern)==9
assert modern[0]['defaultPrefs']=={'layout':2,'statsOpen':False,'tickerOpen':True,'statsTab':'team'}
assert modern[0]['frameSources'][0]=='https://streams.example.org/ppv-main'
assert modern[1]['mutations']==[0,0,0,0]
assert modern[2]['frameSources'][0]=='https://streams.example.org/ppv-backup'
assert modern[3]['mutations']==[0,0,0,0]
assert modern[4]['frameSources'][1]=='https://aurasports.xyz/embed/other'
assert modern[5]['frameSources'][1] is None
assert modern[6]['frameSources'][1]=='https://aurasports.xyz/embed/other'
assert modern[8]['viewerHidden']
assert all(src is None for src in modern[8]['frameSources'])
print('PASS: Chunk 07 9 Viewer lifecycle states equal 1.6.1: defaults, stream switching, no repaint reload, hidden/closed iframe cleanup')
