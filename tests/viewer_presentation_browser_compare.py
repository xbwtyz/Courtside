"""Chunk 06: legacy-versus-modular Viewer/title/navigation and iframe stability."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
OLD=root/'dist'/'courtside-legacy-proof.html'
NEW=root/'dist'/'courtside.html'
assert OLD.is_file() and NEW.is_file()
JS=r"""() => {
  const snap={};
  // Exercise actual tab buttons and keyboard handlers.
  $('csTabScores').focus();
  $('csTabStandings').click();
  snap.standingsVisible=!$('standingsView').hidden;
  $('csTabScores').click();
  snap.scoresVisible=!$('scoresView').hidden;
  const arrow=new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true});
  $('csTabScores').dispatchEvent(arrow);
  snap.arrowPrevented=arrow.defaultPrevented;
  snap.arrowFocus=document.activeElement?.id;
  $('csTabScores').click();
  const game={id:'401',date:'2026-11-16T20:00:00Z',_phase:'live',
    status:{type:{state:'in'}},competitions:[{competitors:[
      {homeAway:'away',score:'101',team:{abbreviation:'BOS',displayName:'Boston Celtics',name:'Celtics'}},
      {homeAway:'home',score:'103',team:{abbreviation:'NYK',displayName:'New York Knicks',name:'Knicks'}}
    ]}]};
  state.games=[game];
  auraGames=new Map([['aura-fixture',{title:'AuraSports auxiliary game'}]]);
  snap.espnTitle=viewerGameTitle('401');
  snap.auraTitle=viewerGameTitle('aura-fixture');
  snap.unknownTitle=viewerGameTitle('nope');
  ppvEvents=[{name:'Boston Celtics at New York Knicks',
    starts_at:Date.parse(game.date)/1000,iframe:'https://streams.example.org/main',tag:'Main'}];
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
  snap.srcBefore=frame.getAttribute('src');
  const observer=new MutationObserver(()=>{});
  observer.observe(frame,{attributes:true,attributeFilter:['src']});
  $('tickerToggle').click();
  $('theaterToggle').click();
  snap.tickerOpen=viewerState.tickerOpen;
  snap.theater=viewerState.theater;
  snap.theaterPressed=$('theaterToggle').getAttribute('aria-pressed');
  snap.tickerHidden=$('viewerTicker').hidden;
  game.competitions[0].competitors[0].score='104';
  paintViewer();
  snap.srcChanges=observer.takeRecords().length;
  observer.disconnect();
  snap.srcAfter=frame.getAttribute('src');
  const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});
  document.dispatchEvent(escape);
  snap.escapePrevented=escape.defaultPrevented;
  snap.viewerClosed=$('viewer').hidden;
  return snap;
}"""
def inspect(browser,path):
    page=browser.new_page(viewport={'width':1365,'height':900})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
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
assert original==updated,{'legacy':original,'modular':updated}
assert original['standingsVisible'] and original['scoresVisible']
assert original['arrowPrevented'] and original['arrowFocus']=='csTabStandings'
assert original['espnTitle']=='Boston Celtics at New York Knicks'
assert original['auraTitle']=='AuraSports auxiliary game'
assert original['unknownTitle']=='NBA game'
assert original['srcBefore']=='https://streams.example.org/main'
assert original['srcChanges']==0 and original['srcAfter']==original['srcBefore']
assert original['tickerOpen'] and original['theater']
assert original['escapePrevented'] and original['viewerClosed']
print('PASS: Chunk 06 title, navigation, Viewer controls, Escape and zero iframe src changes match legacy')
