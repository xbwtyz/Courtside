"""Offline 1.6.1 versus Chunk 04 Live Alerts UI / transition equivalence."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
LEGACY=ROOT/'dist'/'courtside-legacy-proof.html'
MODERN=ROOT/'dist'/'courtside.html'
assert LEGACY.is_file() and MODERN.is_file()

SCENARIO=r'''() => {
  const snapshots=[];
  // Keep toasts and audio suppressed while testing game observation; only
  // pre-existing scoreboard data is used, never a newly scheduled request.
  settingsPrefs.alertsEnabled=true;
  settingsPrefs.alertsOverlay=false;
  settingsPrefs.alertsSound=false;
  settingsPrefs.alertsScope='all';
  settingsPrefs.alertsTeams=[];
  settingsPrefs.alertsStart=true;
  settingsPrefs.alertsHalftime=true;
  settingsPrefs.alertsLead=true;
  settingsPrefs.alertsClose=true;
  settingsPrefs.alertsFinal=true;
  $('viewer').hidden=false;
  state.date=today();
  const date=today();
  const game=(phase,away,home,period=0,clock='12:00')=>({
    id:'fixture401',_phase:phase,
    status:{period,displayClock:clock,type:{name:phase}},
    competitions:[{competitors:[
      {homeAway:'away',score:String(away),team:{id:'2',abbreviation:'BOS'}},
      {homeAway:'home',score:String(home),team:{id:'5',abbreviation:'CLE'}}
    ]}]
  });
  const observe=(g)=>alertsObserveScoreboard([g],date);
  const capture=label=>snapshots.push({
    label,baseline:alertsState.needsBaseline,
    history:alertsState.history.map(e=>({kind:e.kind,title:e.title,score:e.score,detail:e.detail,read:e.read})),
    visible:alertsState.visible.length,
    bells:[...document.querySelectorAll('.cs-alert-bell-count')].map(e=>({hidden:e.hidden,text:e.textContent})),
    historyOpen:alertsState.historyOpen,
    historyHidden:$('alertsHistory').hidden,
    status:alertsStatusText(),
    teamCount:$('alertsTeamCount').textContent
  });
  observe(game('upcoming',0,0));capture('first-silent');
  observe(game('live',10,11,1,'10:00'));capture('start');
  observe(game('live',80,80,4,'2:20'));
  observe(game('live',83,80,4,'1:59'));capture('lead-and-close');
  observe(game('final',113,112,4,'0:00'));capture('final');
  observe(game('final',113,112,4,'0:00'));capture('final-deduped');
  $('alertsMainBell').click();capture('history-open');
  $('alertsHistoryClose').click();capture('history-closed');
  settingsPrefs.alertsScope='selected';settingsPrefs.alertsTeams=['2'];
  alertsSyncSettings();capture('selected-settings');
  return snapshots;
}'''
def inspect(browser,path):
    page=browser.new_page(viewport={'width':1365,'height':900})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/*',lambda request:request.abort())
    page.set_content(path.read_text('utf-8'),wait_until='domcontentloaded',timeout=20000)
    data=page.evaluate(SCENARIO)
    page.close()
    assert not errors, errors
    return data

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True)
    try:
        legacy=inspect(browser,LEGACY)
        modern=inspect(browser,MODERN)
    finally:
        browser.close()
assert legacy==modern, next(((a,b) for a,b in zip(legacy,modern) if a!=b),None)
assert len(legacy[0]['history'])==0
assert [x['kind'] for x in legacy[3]['history']]==['Final','Close','Lead','Start']
assert legacy[3]['history']==legacy[4]['history']
assert legacy[5]['historyOpen'] and not legacy[5]['historyHidden']
assert not legacy[6]['historyOpen'] and legacy[6]['historyHidden']
assert legacy[-1]['teamCount'].startswith('1 of 30')
print(f'PASS: Live Alerts legacy/modular equivalence across {len(legacy)} browser interaction states; no page errors')
