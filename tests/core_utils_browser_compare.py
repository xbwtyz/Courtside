"""Offline, old-vs-new browser comparison of shared formatters and scoreboard rendering."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import os
import shutil

root = Path(__file__).resolve().parents[1]
old_html = root/'dist'/'courtside-legacy-proof.html'
new_html = root/'dist'/'courtside.html'
fixture = json.loads((root/'tests'/'fixtures'/'scoreboard.json').read_text())
assert old_html.is_file() and new_html.is_file(), 'Run npm run verify:baseline && npm run build first'

def check(browser, html_path):
    page = browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda route:route.abort())
    try:
        page.set_content(html_path.read_text(encoding='utf8'),wait_until='domcontentloaded',timeout=20000)
        data=page.evaluate('''fixture => {
          const outputs={
            dates:['2026-11-16','2024-02-29','2026-03-08'].map(x=>({input:x,atNoon:dateFromString(x).getHours(),roundTrip:fmtDate(dateFromString(x))})),
            escaped:['&<>"\\u0027','<img src=x onerror=alert(1)>',null,'Boston Celtics'].map(safe),
            logos:['https://cdn.espncdn.com/a','http://cdn.espncdn.com/a','https://espncdn.com.evil.test/a'].map(safeLogo)
          };
          state.games=parseGames(fixture);
          state.firstLoaded=true;
          state.lastUpdated=new Date('2026-11-16T20:00:00Z');
          state.error='';
          state.liveOnly=false;
          state.query='';
          render();
          outputs.cards=[...document.querySelectorAll('#scoreboard .game')].map(card=>({html:card.innerHTML, text:card.textContent}));
          return outputs;
        }''',fixture)
        assert len(data['cards'])==3, f'Expected 3 fixture scoreboard cards, got {len(data["cards"])}'
        assert data['dates'][0]['roundTrip']=='2026-11-16'
        assert data['logos'][1:]==['','']
        assert not errors, f'Browser JavaScript errors: {errors[:3]}'
        return data
    finally:
        page.close()

with sync_playwright() as p:
    executable=os.environ.get('COURTSIDE_CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser') or None
    browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--no-first-run'])
    try:
        old=check(browser,old_html)
        modern=check(browser,new_html)
        assert old==modern, 'Shared formatting or rendered scoreboard changed in the new module build'
        print('PASS: shared formatters and three rendered scoreboard cards match the legacy build')
    finally:
        browser.close()
