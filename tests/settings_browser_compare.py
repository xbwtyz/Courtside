"""Offline old-versus-new Settings compatibility including saved preferences and storage denial.

Uses a virtual HTTPS origin for localStorage, but intercepts all requests and NEVER
contacts an outside server. Playback and external ESPN calls are not tested.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import os
import shutil

root=Path(__file__).resolve().parents[1]
legacy=root/'dist'/'courtside-legacy-proof.html'
modern=root/'dist'/'courtside.html'
assert legacy.exists() and modern.exists(), 'Build both legacy and modern HTML first'
URL='https://courtside-fixture.invalid/app'
SEED={
    'landing':'standings','defaultLiveOnly':True,'showTicker':True,'autoScroll':True,
    'defaultLayout':4,'defaultStatsTab':'team','defaultStatsOpen':False,
    'defaultViewerTicker':True,'tickerSpeed':'fast','leadersCategory':'rebounding',
    'leadersRows':50,'alertsEnabled':True,'alertsScope':'selected','alertsTeams':['2','5']
}


def inspect(browser, path, blocked=False):
    page=browser.new_page(viewport={'width':1500,'height':990})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    html=path.read_text(encoding='utf8')
    page.route('**/*', lambda route: route.abort())
    # about:blank denies native localStorage; install an in-memory browser API
    # *before* executing the exact standalone HTML, no URL navigation required.
    page.evaluate('''(config) => {
        const values=new Map(Object.entries(config.seed));
        const storage={
          getItem(key){if(config.blocked)throw Error('Storage denied');return values.has(key)?values.get(key):null;},
          setItem(key,value){if(config.blocked)throw Error('Storage denied');values.set(key,String(value));},
          removeItem(key){if(config.blocked)throw Error('Storage denied');values.delete(key);}
        };
        Object.defineProperty(window,'localStorage',{configurable:true,value:storage});
    }''',{'seed':{'courtside.preferences.v1':json.dumps(SEED)},'blocked':blocked})
    try:
        page.set_content(html,wait_until='domcontentloaded',timeout=18000)
        page.locator('#appSettingsOpen').click(timeout=7000)
        assert page.locator('#appSettingsModal').is_visible()
        def snapshot(pg=page):
            return pg.evaluate('''() => ({
              prefs:JSON.parse(JSON.stringify(settingsPrefs)),
              stored:(()=>{try{return localStorage.getItem('courtside.preferences.v1')}catch{return 'DENIED'}})(),
              status:document.getElementById('settingsStorageStatus').textContent,
              showTicker:document.getElementById('scoreTicker').hidden,
              landing:document.getElementById('settingsLanding').value,
              layout:document.getElementById('settingsDefaultLayout').value,
              scrollSpeed:document.getElementById('settingsTickerSpeed').value,
              scrollDisabled:document.getElementById('settingsTickerSpeed').disabled,
              activeTab:[...document.querySelectorAll('[data-settings-tab]')].filter(el=>el.getAttribute('aria-selected')==='true').map(el=>el.dataset.settingsTab),
              modalHidden:document.getElementById('appSettingsModal').hidden,
              viewer:{layout:viewerState.layout,statsOpen:viewerState.statsOpen,slots:viewerState.slots.map(s=>s.sourceUrl)},
              release:document.getElementById('whatsNewVersion').options.length,
              whatsNew:document.getElementById('whatsNewVersion').value
            })''')
        states=[snapshot()]
        page.locator('#csSettingsTabViewer').click(timeout=5000)
        page.locator('#settingsDefaultLayout').select_option('2')
        page.locator('#settingsDefaultStatsTab').select_option('charts')
        page.locator('#settingsDefaultViewerTicker').uncheck()
        states.append(snapshot())
        page.locator('#csSettingsTabTicker').click()
        page.locator('#settingsShowTicker').uncheck()
        page.locator('#settingsAutoScroll').uncheck()
        assert page.locator('#settingsTickerSpeed').is_disabled()
        states.append(snapshot())
        page.locator('#csSettingsTabGeneral').click()
        page.locator('#settingsLanding').select_option('scores')
        page.locator('#settingsDefaultLiveOnly').uncheck()
        states.append(snapshot())
        page.locator('#csSettingsTabAlerts').click()
        page.locator('#settingsAlertsEnabled').uncheck()
        states.append(snapshot())
        page.locator('#csSettingsTabWhatsnew').click()
        page.locator('#whatsNewOlder').click()
        states.append(snapshot())
        page.locator('#appSettingsClose').click()
        assert page.locator('#appSettingsModal').is_hidden()
        page.locator('#csTabScores').click(timeout=5000)
        page.locator('#refreshSettingsToggle').click(timeout=5000)
        assert page.locator('#csSettingsData').is_visible(), 'Refresh settings shortcut should open Data tab'
        states.append(snapshot())
        page.locator('#csSettingsTabGeneral').click()
        # Canceling Restore Defaults must not alter any preferences or stream session.
        page.once('dialog',lambda dialog: dialog.dismiss())
        page.locator('#settingsResetAll').click(timeout=5000)
        states.append(snapshot())
        # Accepting Restore Defaults returns to original defaults without clearing video.
        page.once('dialog',lambda dialog: dialog.accept())
        page.locator('#settingsResetAll').click(timeout=5000)
        states.append(snapshot())
        assert states[-1]['prefs']['defaultLayout']==1
        assert states[-1]['prefs']['landing']=='scores'
        assert states[-1]['viewer']==states[0]['viewer'], 'Settings must not modify active viewer session'
        # Focused Escape should close modal; next click should return focus.
        page.locator('#appSettingsClose').focus()
        page.keyboard.press('Escape')
        assert page.locator('#appSettingsModal').is_hidden()
        page.locator('#appSettingsOpen').click()
        states.append(snapshot())
        page.locator('#appSettingsClose').click()
        if not blocked:
            # A genuinely fresh browser page avoids duplicate top-level const
            # declarations, and models a restart using persisted JSON.
            saved=page.evaluate("localStorage.getItem('courtside.preferences.v1')")
            restart=browser.new_page(viewport={'width':1500,'height':990})
            restart.on('pageerror',lambda e:errors.append(str(e)))
            restart.route('**/*',lambda route:route.abort())
            restart.evaluate('''saved=>{
              const values=new Map([['courtside.preferences.v1',saved]]);
              Object.defineProperty(window,'localStorage',{configurable:true,value:{
                getItem:key=>values.get(key)||null,
                setItem:(key,value)=>values.set(key,String(value))
              }});
            }''',saved)
            try:
                restart.set_content(html,wait_until='domcontentloaded',timeout=18000)
                restart.locator('#appSettingsOpen').click(timeout=7000)
                states.append(snapshot(restart))
                assert states[-1]['prefs']['defaultLayout']==1
            finally:
                restart.close()
        else:
            assert 'Browser storage unavailable' in states[-1]['status']
        assert not errors, f'{path.name}: page errors {errors[:4]}'
        return states
    finally:
        page.close()

with sync_playwright() as playwright:
    executable=os.environ.get('COURTSIDE_CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser') or None
    browser=playwright.chromium.launch(headless=True,executable_path=executable,
       args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--no-first-run'])
    try:
        for blocked in (False,True):
            original=inspect(browser,legacy,blocked)
            migrated=inspect(browser,modern,blocked)
            for i,(before,after) in enumerate(zip(original,migrated)):
                # The v1.7.0 and v1.7.1 entries extend the immutable 1.6.1 release list.
                common=lambda state:{key:value for key,value in state.items() if key not in ('release','whatsNew')}
                assert common(before)==common(after),f'Settings diverged at step {i} (storage blocked={blocked})'
                assert after['release']==before['release']+3
            assert migrated[0]['whatsNew']=='1.7.1'

            print(f'PASS: Settings {len(original)} interaction states, storage blocked={blocked}')
    finally:
        browser.close()
