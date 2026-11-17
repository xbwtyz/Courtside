"""Offline browser equivalence for Chunk 01: status, endpoints and refresh policy.

Uses the frozen 1.6.1 classic script and the modern single-file build.
Actual ESPN requests and stream providers are deliberately mocked/blocked.
"""
from pathlib import Path
import json
import os
import shutil
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
legacy=root/'dist'/'courtside-legacy-proof.html'
modern=root/'dist'/'courtside.html'
fixture=json.loads((root/'tests'/'fixtures'/'scoreboard.json').read_text())
assert legacy.exists() and modern.exists(), 'Run both builds first'

def inspect(browser,path):
    page=browser.new_page(viewport={'width':1365,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.abort())
    try:
        page.set_content(path.read_text('utf8'),wait_until='domcontentloaded',timeout=20000)
        boot=page.evaluate('''() => ({
          api:API,summary:SUMMARY_API,live:ESPN_LIVE_SCORES_MS,stats:ESPN_LIVE_STATS_MS,
          idle:ESPN_IDLE_MS,maxBackoff:ESPN_MAX_BACKOFF_MS,
          statsPoll:Object.keys(statsPoll).sort(),espnPoll:Object.keys(espnPoll).sort(),
          domIdentity: $('datePicker')===document.getElementById('datePicker')
        })''')
        assert boot['live']==10000 and boot['stats']==15000 and boot['idle']==60000
        assert boot['domIdentity']
        states=page.evaluate('''async fixture => {
          const events=[];
          const normalize=value=>Number.isFinite(value)?value:'Infinity';
          const snap=()=>({
            connection:document.querySelector('#connection').textContent.trim(),
            refreshDisabled:document.querySelector('#refreshBtn').disabled,
            refreshing:document.querySelector('#refreshBtn').classList.contains('spin'),
            loading:state.loading,error:state.error,firstLoaded:state.firstLoaded,
            date:state.date,gameIds:state.games.map(g=>g.id),
            nextAtFuture:state.nextAt>=Date.now(),
            nextAtFinite:Number.isFinite(state.nextAt),
            scorePeriod:normalize(scoresRefreshMs()),
            statsLive:normalize(statsRefreshMs('401000002')),
            statsFinal:normalize(statsRefreshMs('401000003')),
            viewerUnchanged:viewerState.slots.length===4 && viewerState.layout===1,
            requestSeq:state.requestSeq
          });
          // Ignore any unresolved startup request; the remaining operations are
          // deterministic synthetic calls against the existing fetchScores path.
          if(state.controller)state.controller.abort();
          state.loading=false;state.controller=null;state.fetchDate=null;
          state.error='';state.firstLoaded=true;state.nextAt=0;
          state.games=parseGames(fixture);state.lastUpdated=new Date('2026-11-16T20:00:00Z');
          state.date='2026-11-16';
          espnPoll.sharedUntil=0;espnPoll.scoreFailures=0;
          updateStatus();events.push(snap());
          state.loading=true;updateStatus();events.push(snap());
          state.loading=false;updateStatus();
          espnPoll.sharedUntil=Date.now()+120000;
          await fetchScores(true);events.push(snap());
          espnPoll.sharedUntil=0;
          const originalFetch=window.fetch;
          window.fetch=async()=>({ok:true,status:200,headers:{get:()=>null},json:async()=>fixture});
          await fetchScores(true);events.push(snap());
          window.fetch=async()=>({ok:false,status:503,headers:{get:()=>null}});
          await fetchScores(true);events.push(snap());
          window.fetch=originalFetch;
          return events;
        }''',fixture)
        assert len(states)==5
        assert 'UPDATING SCORES' in states[1]['connection']
        assert states[1]['refreshDisabled'] is True
        assert 'RATE LIMITED' in states[2]['connection']
        assert 'rate-limited' in states[2]['error']
        assert not states[3]['error'] and states[3]['gameIds']==[g['id'] for g in fixture['events']]
        assert 'HTTP 503' in states[4]['error']
        assert states[4]['nextAtFuture']
        assert all(s['viewerUnchanged'] for s in states)
        assert not errors, f'{path.name}: page exceptions {errors[:5]}'
        return {'boot':boot,'states':states}
    finally:
        page.close()

with sync_playwright() as p:
    executable=os.environ.get('COURTSIDE_CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser') or None
    browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--no-first-run'])
    try:
        a=inspect(browser,legacy)
        b=inspect(browser,modern)
        # A startup async abort can advance a request counter unpredictably;
        # the test compares relative transitions, not absolute sequence values.
        for value in (a,b):
            sequence=value['states'][0]['requestSeq']
            for state in value['states']:
                state['requestSeq']-=sequence
        assert a==b, 'Endpoint, request-status or polling behavior diverged from v1.6.1'
        print('PASS: Chunk 01 startup, refresh intervals and 5 request-status browser states match legacy')
    finally:
        browser.close()
