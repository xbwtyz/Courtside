"""Chunk 13: conference standings and team-profile modal browser parity with frozen v1.6.1."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'dist/courtside-legacy-proof.html'
MODERN=ROOT/'dist/courtside.html'
assert OLD.exists() and MODERN.exists()

JS=r"""() => {
  const standings={children:[
    {name:'Eastern Conference',standings:{entries:[
      {team:{id:'2',displayName:'Boston Celtics',shortDisplayName:'Celtics',abbreviation:'BOS'},
        stats:[{name:'wins',displayValue:'12'},{name:'losses',displayValue:'3'},{name:'playoffSeed',displayValue:'1'}]},
      {team:{id:'18',displayName:'New York Knicks',abbreviation:'NYK'},
        stats:[{name:'wins',displayValue:'10'},{name:'losses',displayValue:'5'},{name:'playoffSeed',displayValue:'2'}]}
    ]}},
    {name:'Western Conference',standings:{entries:[
      {team:{id:'13',displayName:'Los Angeles Lakers',abbreviation:'LAL'},
        stats:[{name:'wins',displayValue:'11'},{name:'losses',displayValue:'4'}]}
    ]}}
  ]};
  const schedule={events:[
    {id:'401000002',date:'2026-11-14T03:00:00Z',status:{type:{state:'post',completed:true}},
      competitions:[{competitors:[
        {homeAway:'away',team:{id:'2',abbreviation:'BOS'},score:{value:108}},
        {homeAway:'home',team:{id:'18',abbreviation:'NYK'},score:{value:104}}]}]},
    {id:'401000003',date:'2026-11-19T03:00:00Z',status:{type:{state:'pre'}},
      competitions:[{competitors:[
        {homeAway:'home',team:{id:'2',abbreviation:'BOS'}},
        {homeAway:'away',team:{id:'13',abbreviation:'LAL'}}]}]}
  ]};
  const roster={athletes:[{items:[
    {athlete:{id:'101',displayName:'Jayson Tatum',jersey:'0',position:{abbreviation:'SF'}}},
    {athlete:{id:'102',displayName:'Derrick White',jersey:'9',position:{abbreviation:'G'}}}
  ]}]};
  const frame=$('playerFrame0'),original='https://streams.example.org/stable-team-profile';
  const oldSource=combinedSourcesForId;
  frame.setAttribute('src',original);
  const changes=new MutationObserver(()=>{});
  changes.observe(frame,{attributes:true,attributeFilter:['src']});
  const logs=[];
  const capture=label=>{
    const teamContent=$('teamProfileContent');
    logs.push({
      label,mainView,modal:!$('teamProfileModal').hidden,
      standings: $('standingsContent').innerHTML,
      activeTab:profileState.tab,
      teamHtml:teamContent.innerHTML,
      teamScroll:teamContent.scrollTop,
      focus:document.activeElement?.id||'',
      iframe:frame.getAttribute('src'),
      writes:changes.takeRecords().filter(x=>x.attributeName==='src').length
    });
  };
  try{
    combinedSourcesForId=()=>[{name:'Fixture',url:original}];
    viewerState.layout=1;viewerState.activeTile=0;
    viewerState.slots=Array.from({length:4},()=>({gameId:null,sourceUrl:null,sources:[]}));
    viewerState.slots[0].gameId='401000002';
    viewerState.slots[0].sourceUrl=original;
    viewerState.gameId='401000002';
    state.games=[{id:'401000002',_phase:'final'}];
    standingsState.groups=parseStandings(standings);
    standingsState.at=Date.now();standingsState.season=2026;standingsState.pending=null;standingsState.error='';
    espnPoll.sharedUntil=Date.now()+60000;
    profileState.cache.clear();profileState.pending.clear();
    profileState.cache.set('2|schedule|2026',{at:Date.now(),data:schedule,error:''});
    profileState.cache.set('2|roster|',{at:Date.now(),data:roster,error:''});
    setMainView('standings');
    capture('standings-visible');
    $('standingsContent').querySelector('[data-team-profile="2"]').click();
    capture('team-overview');
    $('teamProfileDialog').querySelector('[data-profile-tab="roster"]').click();
    capture('team-roster');
    $('teamProfileDialog').querySelector('[data-profile-tab="schedule"]').click();
    capture('team-schedule');
    const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});
    document.dispatchEvent(esc);
    capture('team-escape-close');
    setMainView('scores');
    capture('scores-return');
    return {logs,escapePrevented:esc.defaultPrevented,requestsStarted:!!profileState.pending.size,
      frameStable:logs.every(x=>x.iframe===original&&x.writes===0)};
  }finally{
    combinedSourcesForId=oldSource;changes.disconnect();
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
        modern=inspect(browser,MODERN)
    finally:browser.close()
assert modern==original,{'legacy':original,'modular':modern}
assert len(modern['logs'])==6
assert 'Eastern Conference' in modern['logs'][0]['standings']
assert modern['logs'][1]['modal']
assert 'Jayson Tatum' in modern['logs'][2]['teamHtml']
assert '108–104' in modern['logs'][3]['teamHtml']
assert not modern['logs'][4]['modal']
assert modern['escapePrevented'] and modern['frameStable']
assert not modern['requestsStarted']
print('PASS: Chunk 13 standings/team-profile 6 browser states, roster/schedule, Escape/focus, and iframe continuity match 1.6.1')
