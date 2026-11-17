"""Optional Chromium smoke check. Requires: pip install playwright, installed Chromium.

Renders the generated single-file application in memory and blocks external requests.
Does not assert that live ESPN or third-party video services are reachable.
"""
from pathlib import Path
import os
import shutil
import json
from playwright.sync_api import sync_playwright

html = Path(__file__).resolve().parents[1] / 'dist' / 'courtside.html'
assert html.is_file(), 'Run npm run build before this optional browser smoke test'
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path=os.environ.get('COURTSIDE_CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser') or None,
        args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-background-networking', '--no-first-run'],
    )
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.route('**/*', lambda route: route.abort())
    try:
        page.set_content(html.read_text(encoding='utf8'), wait_until='domcontentloaded', timeout=20000)
        assert page.locator('#csTabScores').count() == 1, 'Scores navigation missing'
        page.locator('#appSettingsOpen').click(timeout=5000)
        assert page.locator('#appSettingsModal').is_visible(), f'Settings failed to open; page errors: {errors}'
        page.locator('[data-settings-tab="whatsnew"]').first.click(timeout=5000)
        versions = page.locator('#whatsNewVersion')
        assert versions.count() == 1, "What's New version selector missing"
        before = versions.input_value()
        page.locator('#whatsNewOlder').click(timeout=5000)
        assert versions.input_value() != before, "What's New older release did not change"
        page.locator('#appSettingsClose').click(timeout=5000)
        page.locator('#csTabStandings').click(timeout=5000)
        assert page.locator('#standingsView').is_visible(), 'Standings navigation failed'

        page.locator('#csTabScores').click(timeout=5000)
        fixture = json.loads((html.parent.parent / 'tests' / 'fixtures' / 'scoreboard.json').read_text())
        page.evaluate('''data => {
          state.games=parseGames(data);
          state.firstLoaded=true;
          state.lastUpdated=new Date();
          state.error='';
          render();
        }''', fixture)
        assert page.locator('#scoreboard .game').count() == 3, 'Expected three fixture game cards'
        page.locator('#liveOnly').check(timeout=5000)
        assert page.locator('#scoreboard .game').count() == 1, 'Live only must show exactly one game'
        page.locator('#liveOnly').uncheck(timeout=5000)
        assert page.locator('#scoreboard .game').count() == 3, 'Disabling Live only must restore games'

        # Supply a simulated provider result rather than loading a real stream.
        # Repainting the viewer must never replace the src of a stable iframe.
        result=page.evaluate('''() => {
          const url='https://example.invalid/courtside-fixture-player';
          const game={id:'401000002',_phase:'live',date:'2026-11-16T22:00:00Z',status:{type:{state:'in'}},competitions:[{competitors:[{homeAway:'away',team:{displayName:'Away',abbreviation:'AWY'}},{homeAway:'home',team:{displayName:'Home',abbreviation:'HME'}}]}]};
          const previous = combinedSourcesForId;
          combinedSourcesForId = () => [{name:'Mock source',url}];
          try {
            state.games=[game];
            viewerState.layout=1;
            viewerState.activeTile=0;
            viewerState.statsOpen=false;
            viewerState.statsDisplayKey=null;
            viewerState.liveGames=[];
            viewerState.slots=Array.from({length:4},()=>({gameId:null,sourceUrl:null,sources:[]}));
            viewerState.slots[0].gameId=game.id;
            viewerState.slots[0].sourceUrl=url;
            document.getElementById('viewer').hidden=false;
            paintViewer();
            const frame=document.getElementById('playerFrame0');
            if(frame.getAttribute('src')!==url) throw Error('Initial source did not render');
            const observer=new MutationObserver(() => {});
            observer.observe(frame,{attributes:true,attributeFilter:['src']});
            paintViewer();
            paintViewer();
            state.games[0].competitions[0].competitors[0].score='103';
            render();
            paintViewer();
            const entries=observer.takeRecords().filter(r=>r.attributeName==='src');
            observer.disconnect();
            if(entries.length)throw Error('Routine viewer redraw unexpectedly modified iframe src');
            return {src:frame.getAttribute('src'), srcMutations:entries.length};
          } finally {
            combinedSourcesForId=previous;
          }
        }''')
        assert result['srcMutations'] == 0, result
        assert not errors, f'Page-level JavaScript errors: {errors[:4]}'
        print('PASS: Settings, Whats New, Standings, fixture game cards + filtering, stable iframe after scoreboard redraw; no page errors')
    finally:
        browser.close()
