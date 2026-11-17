"""Chunk 05: offline old/new source selection, matching, iframe src equivalence."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'dist'/'courtside-legacy-proof.html'
NEW=ROOT/'dist'/'courtside.html'
assert OLD.is_file() and NEW.is_file()
JS=r"""() => {
  const date='2026-11-16T20:00:00Z',start=Date.parse(date)/1000;
  const game={id:'401',date,_phase:'live',status:{type:{state:'in'}},
    competitions:[{competitors:[
      {homeAway:'away',team:{abbreviation:'BOS',displayName:'Boston Celtics',name:'Celtics'},score:'100'},
      {homeAway:'home',team:{abbreviation:'NYK',displayName:'New York Knicks',name:'Knicks'},score:'102'}
    ]}]};
  state.games=[game];
  ppvEvents=[{name:'Boston Celtics at New York Knicks',starts_at:start,tag:'Main',
    iframe:'https://stream.example.org/primary',
    substreams:[{name:'Backup',iframe:'https://stream.example.org/backup'}]},
    {name:'Boston Celtics at Los Angeles Lakers',starts_at:start,iframe:'https://stream.example.org/wrong'}];
  auraGames=new Map([['401',{title:'Boston Celtics at New York Knicks',sources:[{name:'Aura',url:'https://aurasports.xyz/player'}]}]]);
  matchoraEvents=[{league:'NBA',away:'Boston Celtics',home:'New York Knicks',kickoff:start,
    embed_url:'https://matchora.to/embed/match/987',
    channels:[{name:'Channel',embed_url:'https://matchora.to/embed/channel/abc',lang:'English',quality:'HD'}]},
    {league:'NBA',away:'New York Knicks',home:'Boston Celtics',kickoff:start,
      embed_url:'https://matchora.to/embed/match/wrong'}];
  const sources=combinedSourcesForId('401');
  const result={providers:sources.map(s=>s.provider),names:sources.map(s=>s.name),
    urls:sources.map(s=>s.url),missing:combinedSourcesForId('missing').length,
    wrongDates:matchoraEventMatches({...matchoraEvents[0],kickoff:start+86400},game)};
  viewerState.layout=1;
  viewerState.activeTile=0;
  viewerState.statsOpen=false;
  viewerState.statsDisplayKey=null;
  viewerState.liveGames=[];
  viewerState.slots=Array.from({length:4},()=>({gameId:null,sourceUrl:null,sources:[]}));
  viewerState.slots[0].gameId=game.id;
  $('viewer').hidden=false;
  paintPlayer();
  const frame=$('playerFrame0');
  result.initialSrc=frame.getAttribute('src');
  viewerState.slots[0].sourceUrl='https://aurasports.xyz/player';
  paintPlayer();
  result.manualSrc=frame.getAttribute('src');
  const observer=new MutationObserver(()=>{});
  observer.observe(frame,{attributes:true,attributeFilter:['src']});
  paintPlayer();
  game.competitions[0].competitors[0].score='103';
  paintPlayer();
  result.srcChanges=observer.takeRecords().filter(x=>x.attributeName==='src').length;
  observer.disconnect();
  result.postScoreSrc=frame.getAttribute('src');
  result.selectedSource=viewerState.slots[0].sourceUrl;
  return result;
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
    finally:
        page.close()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    try:
        original=inspect(browser,OLD)
        updated=inspect(browser,NEW)
    finally:
        browser.close()
assert original==updated,{'original':original,'updated':updated}
assert original['providers']==['PPV.st','PPV.st','AuraSports','Matchora','Matchora'],original
assert original['initialSrc']=='https://stream.example.org/primary'
assert original['manualSrc']=='https://aurasports.xyz/player'
assert original['postScoreSrc']==original['manualSrc'] and original['srcChanges']==0
assert original['wrongDates']==False and original['missing']==0
print('PASS: Chunk 05 provider priority, source matching, manual selection and zero iframe src mutations')
