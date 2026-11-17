"""Chunk 11: browser parity across Game Center box, team, overview and three chart views."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
LEGACY=ROOT/'dist'/'courtside-legacy-proof.html'
MODERN=ROOT/'dist'/'courtside.html'
assert LEGACY.is_file() and MODERN.is_file()
JS=r"""() => {
  const game={id:'401000002',_phase:'live',status:{type:{state:'in',shortDetail:'Q4 2:30'}},
    competitions:[{competitors:[
      {homeAway:'away',score:'104',linescores:[{displayValue:'25'},{displayValue:'22'}],
        team:{id:'2',abbreviation:'BOS',displayName:'Boston Celtics',shortDisplayName:'Celtics'}},
      {homeAway:'home',score:'102',linescores:[{displayValue:'24'},{displayValue:'20'}],
        team:{id:'18',abbreviation:'NYK',displayName:'New York Knicks',shortDisplayName:'Knicks'}}
    ]}]};
  const summary={
    header:{competitions:[{status:{type:{state:'in',shortDetail:'Q4 2:30'},period:4},
      competitors:[
        {homeAway:'away',score:'104',team:{id:'2',abbreviation:'BOS',displayName:'Boston Celtics'}},
        {homeAway:'home',score:'102',team:{id:'18',abbreviation:'NYK',displayName:'New York Knicks'}}
      ]}]},
    boxscore:{
      teams:[
        {homeAway:'away',team:{id:'2',abbreviation:'BOS'},statistics:[{name:'fieldGoalPct',displayValue:'48.1'},{name:'rebounds',displayValue:'44'}]},
        {homeAway:'home',team:{id:'18',abbreviation:'NYK'},statistics:[{name:'fieldGoalPct',displayValue:'46.9'},{name:'rebounds',displayValue:'41'}]}
      ],
      players:[
        {team:{id:'2',abbreviation:'BOS',displayName:'Boston Celtics'},statistics:[{
          keys:['minutes','points','rebounds','assists','plusMinus'],
          labels:['MIN','PTS','REB','AST','+/-'],names:['minutes','points','rebounds','assists','plusMinus'],
          athletes:[
            {athlete:{id:'101',displayName:'Jayson Tatum',position:{abbreviation:'SF'}},starter:true,stats:['34','28','7','5','+8']},
            {athlete:{id:'102',displayName:'Derrick White',position:{abbreviation:'G'}},starter:false,stats:['22','18','3','4','+1']},
            {athlete:{id:'103',displayName:'Resting Player'},didNotPlay:true,reason:'Coaches decision',stats:[]}
          ]
        }]},
        {team:{id:'18',abbreviation:'NYK',displayName:'New York Knicks'},statistics:[{
          keys:['minutes','points','rebounds','assists','plusMinus'],
          labels:['MIN','PTS','REB','AST','+/-'],names:['minutes','points','rebounds','assists','plusMinus'],
          athletes:[{athlete:{id:'201',displayName:'Jalen Brunson',position:{abbreviation:'PG'}},
            starter:true,stats:['37','31','2','9','-2']}]
        }]}
      ]
    },
    plays:[
      {id:'p1',sequenceNumber:1,period:{number:1},clock:{displayValue:'10:30'},
        homeScore:2,awayScore:0,text:'Brunson made two point shot',shootingPlay:true,
        pointsAttempted:2,scoringPlay:true,coordinate:{x:21,y:18},team:{id:'18'},
        participants:[{athlete:{id:'201',displayName:'Jalen Brunson'}}]},
      {id:'p2',sequenceNumber:2,period:{number:1},clock:{displayValue:'9:50'},
        homeScore:2,awayScore:3,text:'Tatum made three point shot',shootingPlay:true,
        pointsAttempted:3,scoringPlay:true,coordinate:{x:34,y:22},team:{id:'2'},
        participants:[{athlete:{id:'101',displayName:'Jayson Tatum'}}]},
      {id:'p3',sequenceNumber:3,period:{number:1},clock:{displayValue:'9:00'},
        homeScore:2,awayScore:3,text:'Brunson missed shot',shootingPlay:true,
        pointsAttempted:2,scoringPlay:false,coordinate:{x:16,y:12},team:{id:'18'},
        participants:[{athlete:{id:'201',displayName:'Jalen Brunson'}}]}
    ],
    winprobability:[
      {playId:'p1',homeWinPercentage:.54,tiePercentage:0},
      {playId:'p2',homeWinPercentage:.42,tiePercentage:0},
      {playId:'p3',homeWinPercentage:.4,tiePercentage:0}
    ]
  };
  const frame=$('playerFrame0'),url='https://streams.example.org/existing-session';
  frame.setAttribute('src',url);
  const observer=new MutationObserver(()=>{});
  observer.observe(frame,{attributes:true,attributeFilter:['src']});
  state.games=[game];
  viewerState.gameId=game.id;viewerState.statsOpen=true;
  viewerState.statsTab='box';viewerState.boxSort='pts';viewerState.boxSortDesc=true;
  viewerState.boxTeam=null;viewerState.boxWide=false;
  viewerState.statsError='';viewerState.chartView='lead';
  viewerState.shotTeam='all';viewerState.shotPlayer='all';viewerState.shotPeriod='all';
  viewerState.chartSelections={lead:null,prob:null,shots:null};
  viewerState.statsCache.set(game.id,{at:1794859200000,data:summary,phase:'live'});
  $('viewer').hidden=false;
  const panel=$('statsContent'),records=[];
  const snap=name=>{
    const html=panel.innerHTML;
    const c=activeChart;
    const selected=panel.querySelector('.bs-table-scroll');
    records.push({
      name,html,chart:c?.kind||null,rows:c?.rows?.length||0,
      index:c?.index??null,scroll:panel.scrollTop,tableScroll:selected?.scrollLeft||0,
      focused:document.activeElement?.id||null,
      status:$('boxStatsStatus').textContent,
      iframe:frame.getAttribute('src'),
      mutations:observer.takeRecords().filter(x=>x.attributeName==='src').length
    });
  };
  try{
    for(const tab of ['overview','team','box']){
      viewerState.statsTab=tab;renderStats(game,summary);snap(tab);
    }
    $('bsWideToggle')?.focus();
    panel.scrollTop=65;
    const table=panel.querySelector('.bs-table-scroll');if(table)table.scrollLeft=18;
    renderStats(game,summary);snap('box-repeat-preserve-focus-scroll');
    const sort=panel.querySelector('button[data-bs-sort="pts"]');sort?.click();snap('sort-pts');
    $('bsWideToggle')?.click();snap('toggle-wide');
    for(const kind of ['lead','prob','shots']){
      viewerState.statsTab='charts';viewerState.chartView=kind;
      renderStats(game,summary);snap('chart-'+kind);
    }
    const teamSelect=$('csShotTeam');
    if(teamSelect){
      teamSelect.value='18';
      teamSelect.dispatchEvent(new Event('change',{bubbles:true}));
    }
    snap('shots-team-filter');
    const select=$('csShotSelect');
    if(select?.options?.length){
      select.value=select.options[0].value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }
    snap('shots-inspect');
    viewerState.chartView='prob';
    renderStats(game,summary);
    const slider=$('csPlayRange');
    if(slider){
      slider.value='0';slider.dispatchEvent(new Event('input',{bubbles:true}));
    }
    snap('probability-scrub');
    return {records,stableIframe:records.every(x=>x.iframe===url&&x.mutations===0),
      wideStatus:viewerState.boxWide,shotsTeam:viewerState.shotTeam,
      lastChart:activeChart?.kind||null};
  }finally{
    observer.disconnect();frame.removeAttribute('src');
  }
}"""
def inspect(browser,path):
    page=browser.new_page(viewport={'width':1520,'height':980})
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
        a=inspect(browser,LEGACY)
        b=inspect(browser,MODERN)
    finally:browser.close()
assert b==a,next(((i,x['name'],y['name']) for i,(x,y) in enumerate(zip(a['records'],b['records'])) if x!=y),None)
assert len(a['records'])==12
assert [r['chart'] for r in a['records'][6:9]]==['lead','prob','shots']
assert a['stableIframe']
assert a['records'][2]['chart'] is None
assert a['records'][8]['rows']==3
assert a['records'][9]['rows']==2
print('PASS: Chunk 11 Game Center 12 states match 1.6.1: box, team, overview, lead/probability/shots, filters, scroll/focus, stable iframe')
