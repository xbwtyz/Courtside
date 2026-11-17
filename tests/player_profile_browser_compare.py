"""Chunk 14: player-profile modal, season averages, game logs, team handoff and Viewer stability."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'dist/courtside-legacy-proof.html'
NEW=ROOT/'dist/courtside.html'
assert OLD.exists() and NEW.exists()
JS=r"""() => {
 const original=combinedSourcesForId,iframe=$('playerFrame0');
 const url='https://streams.example.org/player-profile-stable';
 iframe.setAttribute('src',url);
 const observer=new MutationObserver(()=>{});
 observer.observe(iframe,{attributes:true,attributeFilter:['src']});
 const playerId='101',gameId='401000002',year=profileSeasonYear(),now=Date.now();
 const stats={categories:[{name:'Per Game',labels:['GP','PTS','REB','AST','FG%'],
   averages:['15','28.6','7.2','4.6','.515']}]};
 const log={seasonTypes:[{displayName:'Regular Season',categories:[{
   labels:['MIN','PTS','REB','AST'],events:[
     {eventId:gameId,date:'2026-11-12T00:00:00Z',stats:['34','30','9','6'],
       opponent:{abbreviation:'NYK'},gameResult:'W'},
     {eventId:'401000003',date:'2026-11-15T03:00:00Z',stats:['32','24','7','4'],
       opponent:{abbreviation:'LAL'},gameResult:'L'}
   ]
 }]}]};
 const records=[],snap=label=>records.push({
   label,playerModal:!$('playerProfileModal').hidden,teamModal:!$('teamProfileModal').hidden,
   playerId:playerState.id,tab:playerState.tab,sort:playerState.sort,desc:playerState.sortDesc,
   html:$('playerProfileContent').innerHTML,subtitle:$('playerProfileSubtitle').textContent,
   focus:document.activeElement?.id||'',
   scroll:$('teamProfileContent').scrollTop,
   iframe:iframe.getAttribute('src'),
   writes:observer.takeRecords().filter(x=>x.attributeName==='src').length
 });
 const fake=document.createElement('button');
 fake.dataset.playerProfile=playerId;fake.dataset.playerName='Jayson Tatum';
 fake.dataset.playerTeam='2';fake.dataset.playerTeamName='Boston Celtics';
 fake.dataset.playerPos='SF';fake.dataset.playerJersey='0';fake.id='fixturePlayerLink';
 try{
  combinedSourcesForId=()=>[{name:'Fixture',url}];
  viewerState.layout=1;viewerState.activeTile=0;
  viewerState.slots=Array.from({length:4},()=>({gameId:null,sourceUrl:null,sources:[]}));
  viewerState.slots[0].gameId=gameId;viewerState.slots[0].sourceUrl=url;
  viewerState.gameId=gameId;
  state.date='2026-11-12';state.games=[{id:gameId,_phase:'final',
    competitions:[{competitors:[]}]}];
  playerState.cache.clear();playerState.pending.clear();playerState.id=null;
  playerState.fromTeam=false;
  $('viewer').hidden=false;
  teamDirectory.set('2',{id:'2',name:'Boston Celtics',abbr:'BOS'});
  playerState.cache.set(playerId+'|'+year+'|overview',{
    at:now,data:{athlete:{displayName:'Jayson Tatum',team:{id:'2'},jersey:'0'}},error:''});
  playerState.cache.set(playerId+'|'+year+'|stats',{at:now,data:stats,error:''});
  playerState.cache.set(playerId+'|'+year+'|gamelog',{at:now,data:log,error:''});
  $('teamProfileModal').hidden=true;
  document.body.appendChild(fake);fake.focus();
  fake.click();snap('open-direct');
  $('playerProfileDialog').querySelector('[data-player-tab="season"]').click();
  snap('season-stats');
  $('playerProfileDialog').querySelector('[data-player-tab="gamelog"]').click();
  snap('game-log');
  $('playerProfileDialog').querySelector('[data-player-sort="pts"]')?.click();
  snap('sort-by-points');
  const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});
  document.dispatchEvent(esc);snap('escape-close');
  $('teamProfileModal').hidden=false;
  $('teamProfileContent').scrollTop=74;
  fake.focus();fake.click();snap('open-from-team');
  $('playerBackTeam').click();snap('return-to-team');
  return {records,escapePrevented:esc.defaultPrevented,
   iframeStable:records.every(s=>s.iframe===url&&s.writes===0),
   networkStarted:playerState.pending.size};
 }finally{
  observer.disconnect();combinedSourcesForId=original;fake.remove();
 }
}"""
def inspect(browser,path):
 page=browser.new_page(viewport={'width':1440,'height':920})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/*',lambda route:route.abort())
 try:
  page.set_content(path.read_text('utf8'),wait_until='domcontentloaded',timeout=20000)
  result=page.evaluate(JS)
  assert not errors,errors
  return result
 finally:page.close()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 try:
  original=inspect(browser,OLD)
  modern=inspect(browser,NEW)
 finally:browser.close()
assert modern==original,{'legacy':original,'modular':modern}
assert len(modern['records'])==7
assert modern['records'][0]['playerModal']
assert 'Season averages' in modern['records'][0]['html']
assert 'Current-season statistics' in modern['records'][1]['html']
assert 'Game Log' in modern['records'][2]['html'] or 'game log' in modern['records'][2]['html'].lower()
assert modern['records'][4]['playerModal'] is False
assert modern['records'][5]['teamModal'] is False
assert modern['records'][6]['teamModal'] is True
assert modern['escapePrevented'] and modern['iframeStable'] and modern['networkStarted']==0
print('PASS: Chunk 14 player profiles, 7 UI states, sorting, team handoff and stable Viewer iframe match 1.6.1')
