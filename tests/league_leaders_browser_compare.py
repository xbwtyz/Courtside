"""Chunk 15: complete leaderboard filtering, sorting, tie ranks, pagination and focus parity."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'dist/courtside-legacy-proof.html'
NEW=ROOT/'dist/courtside.html'
assert OLD.is_file() and NEW.is_file()

JS=r"""() => {
 const originalSources=combinedSourcesForId,frame=$('playerFrame0');
 const stream='https://streams.example.org/league-leaders-stable';
 frame.setAttribute('src',stream);
 const observer=new MutationObserver(()=>{});
 observer.observe(frame,{attributes:true,attributeFilter:['src']});
 const groups=[
   {name:'general',names:['gamesPlayed','avgMinutes']},
   {name:'offensive',names:['avgPoints','avgAssists','avgRebounds','fieldGoalPct','threePointFieldGoalPct','freeThrowPct']},
   {name:'defensive',names:['avgSteals','avgBlocks']}
 ];
 const raw=(id,points,teamId)=>({
  athlete:{id:String(id),displayName:'Fixture Player '+id,teamId,
    position:{abbreviation:id%2?'G':'F'}},
  categories:[
   {name:'general',values:['20','34:30']},
   {name:'offensive',values:[String(points),'5.4','8.2','48.6%','37.2%','84.1%']},
   {name:'defensive',values:['1.4','0.7']}
  ]
 });
 const log=[];
 const snap=label=>log.push({
  label,mainView,category:leaderState.category,metric:leaderState.metric,desc:leaderState.desc,
  team:leaderState.team,position:leaderState.position,query:leaderState.query,
  games:leaderState.games,minutes:leaderState.minutes,rows:leaderState.rows,page:leaderState.page,
  volume:leaderState.volume,counts:leaderFiltered().ranked.slice(0,5).map(p=>[p.id,p.rank]),
  table:$('leadersTableBody').innerHTML,head:$('leadersTableHead').innerHTML,
  info:$('leadersResults').textContent,progress:$('leadersProgress').textContent,
  searchFocus:document.activeElement===$('leadersSearch'),scroll:$('leadersTableScroll').scrollLeft,
  source:frame.getAttribute('src'),writes:observer.takeRecords().filter(r=>r.attributeName==='src').length
 });
 const change=(id,type,value)=>{
  const el=$(id);el.value=value;el.dispatchEvent(new Event(type,{bubbles:true}));
 };
 try{
  combinedSourcesForId=()=>[{name:'Fixture',url:stream}];
  viewerState.layout=1;viewerState.activeTile=0;
  viewerState.slots=Array.from({length:4},()=>({gameId:null,sourceUrl:null,sources:[]}));
  viewerState.slots[0].gameId='401000002';
  viewerState.slots[0].sourceUrl=stream;
  viewerState.gameId='401000002';
  $('viewer').hidden=false;
  leaderState.pending=null;leaderState.loading=false;leaderState.error='';
  leaderState.category='scoring';leaderState.metric='ppg';leaderState.desc=true;
  Object.assign(leaderState,{team:'all',position:'all',games:5,minutes:0,
   volume:'auto',volumeCustom:2,query:'',rows:25,page:1,
   missingMetrics:[],missingTeamCount:0,season:profileSeasonYear(),
   at:Date.now(),dataCount:31,progress:'All 31 ESPN-listed player entries loaded · 2 API pages.'});
  leaderState.players=Array.from({length:31},(_,i)=>leaderNormalize(raw(100+i,
     i<2?28.5:27-i*.3,i%2?'18':'2'),groups));
  leaderState.players.forEach(p=>teamDirectory.set(p.teamId,{id:p.teamId,name:p.teamName,abbr:p.teamAbbr}));
  $('leadersTableScroll').scrollLeft=37;
  setMainView('leaders');snap('initial');
  $('leadersPaging').querySelector('[data-leader-page="next"]')?.click();snap('page-next');
  $('leadersTableHead').querySelector('[data-leader-sort="ppg"]')?.click();snap('descending-toggle');
  $('leadersCategories').querySelector('[data-leader-category="shooting"]')?.click();snap('shooting-category');
  change('leadersMetric','change','fgPct');snap('fg-percent');
  change('leadersVolume','change','off');snap('volume-off');
  change('leadersTeam','change','2');snap('team-filter');
  $('leadersSearch').focus();change('leadersSearch','input','Fixture Player 10');snap('search-focus');
  $('leadersReset').click();snap('reset');
  change('leadersRows','change','50');snap('rows-50');
  return {log,stable:log.every(x=>x.source===stream&&x.writes===0),
   total:leaderState.players.length};
 }finally{
  observer.disconnect();combinedSourcesForId=originalSources;
 }
}"""
def inspect(browser,path):
 page=browser.new_page(viewport={'width':1500,'height':960})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/*',lambda route:route.abort())
 try:
  page.set_content(path.read_text('utf8'),wait_until='domcontentloaded',timeout=20000)
  output=page.evaluate(JS)
  assert not errors,errors
  return output
 finally:page.close()
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True)
 try:
  old=inspect(browser,OLD)
  new=inspect(browser,NEW)
 finally:browser.close()
assert new==old,next(((i,a['label'],b['label']) for i,(a,b) in enumerate(zip(old['log'],new['log'])) if a!=b),None)
assert len(new['log'])==10
assert new['log'][0]['counts'][:2]==[['100',1],['101',1]]
assert new['log'][1]['page']==2
assert new['log'][3]['category']=='shooting'
assert new['log'][4]['metric']=='fgPct'
assert new['log'][7]['searchFocus']
assert new['log'][8]['team']=='all' and new['log'][8]['query']==''
assert new['log'][9]['rows']==50
assert new['stable'] and new['total']==31
print('PASS: Chunk 15 League Leaders 10 browser states match 1.6.1 (ties, pages, sort, filters, search focus, iframe)')
