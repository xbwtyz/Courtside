"""Offline Chromium parity check for the shared game-store transition.

Compares real Scoreboard render, synthetic ESPN update, date-reset side effects,
Game Center game lookup, and Viewer state stability against frozen 1.6.1.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import os
import shutil

root = Path(__file__).resolve().parents[1]
old_file = root / 'dist' / 'courtside-legacy-proof.html'
new_file = root / 'dist' / 'courtside.html'
fixture = json.loads((root / 'tests' / 'fixtures' / 'scoreboard.json').read_text())
assert old_file.is_file() and new_file.is_file(), 'Build modern and legacy HTML first'


def inspect(browser, filename):
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.route('**/*', lambda route: route.abort())
    try:
        page.set_content(filename.read_text(encoding='utf8'), wait_until='domcontentloaded', timeout=20000)
        # Flush any initial request before beginning deterministic fixture checks.
        initial = page.evaluate('''fixture => {
          state.games=parseGames(fixture);
          state.firstLoaded=true;
          state.error='';
          state.loading=false;
          state.lastUpdated=new Date('2026-11-16T20:00:00Z');
          state.liveOnly=false;
          state.query='';
          render();
          const viewerIdentity=viewerState;
          return {
            date:state.date,
            gameIds:state.games.map(g=>g.id),
            cards:[...document.querySelectorAll('#scoreboard .game')].map(e=>e.innerHTML),
            gameFound:state.games.find(g=>String(g.id)==='401000002')?.id,
            viewerLayout:viewerIdentity.layout,
            viewerSlots:viewerIdentity.slots.length
          };
        }''', fixture)
        assert len(initial['cards']) == 3
        assert initial['gameFound'] == '401000002'

        expanded = page.evaluate('''() => {
          state.expanded.add('401000002');
          render();
          return {
            expanded:[...state.expanded],
            cards:[...document.querySelectorAll('#scoreboard .game')].map(e=>e.innerHTML)
          };
        }''')

        # Force the original selectDay() logic to use the cooldown path so
        # the automatic fetch cannot depend on external network availability.
        switched = page.evaluate('''() => {
          espnPoll.sharedUntil=Date.now()+120000;
          selectDay('2026-11-17');
          return {
            date:state.date,gameCount:state.games.length,
            expanded:[...state.expanded],error:state.error,
            firstLoaded:state.firstLoaded,lastUpdated:state.lastUpdated,
            nextAtCooling:state.nextAt>=espnPoll.sharedUntil,
            picker:document.querySelector('#datePicker').value
          };
        }''')
        assert switched['date']=='2026-11-17'
        assert switched['gameCount']==0
        assert switched['expanded']==[]
        assert switched['nextAtCooling']

        # Exercise the actual fetchScores() -> gameStore.replaceGames() call.
        fetched = page.evaluate('''async fixture => {
          espnPoll.sharedUntil=0;
          state.nextAt=0;
          const originalFetch=window.fetch;
          window.fetch=async()=>({
            ok:true,status:200,headers:{get:()=>null},
            json:async()=>fixture
          });
          try { await fetchScores(true); }
          finally { window.fetch=originalFetch; }
          return {
            date:state.date,
            gameIds:state.games.map(g=>g.id),
            phase:state.games.map(g=>g._phase),
            cards:[...document.querySelectorAll('#scoreboard .game')].map(e=>e.innerHTML),
            isLoading:state.loading,
            firstLoaded:state.firstLoaded,
            hasError:!!state.error,
            gameFound:state.games.find(g=>String(g.id)==='401000002')?.id,
            viewerLayout:viewerState.layout,viewerSlots:viewerState.slots.length
          };
        }''',fixture)
        assert fetched['gameIds']==initial['gameIds'], fetched
        assert fetched['isLoading'] is False
        assert fetched['hasError'] is False, fetched
        assert not errors, f'JavaScript exceptions in {filename.name}: {errors[:4]}'
        return {'initial':initial,'expanded':expanded,'switched':switched,'fetched':fetched}
    finally:
        page.close()


with sync_playwright() as p:
    chromium = os.environ.get('COURTSIDE_CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser') or None
    browser=p.chromium.launch(headless=True,executable_path=chromium,
        args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--no-first-run'])
    try:
        baseline=inspect(browser,old_file)
        modern=inspect(browser,new_file)
        assert baseline==modern, 'Old and modern game-data/Scoreboard behavior differed'
        print('PASS: Game Store migration matches legacy Scoreboard and date changes, synthetic ESPN refresh, and viewer state')
    finally:
        browser.close()
