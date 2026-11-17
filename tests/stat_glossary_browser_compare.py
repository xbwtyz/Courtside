"""Offline Chromium comparison: original v1.6.1 glossary vs isolated ES module.

Checks dynamic column headers, accessibility labels, mouse/focus tooltips,
touch-style pinned info buttons, Escape, scrolling, and no duplicate icons.
Requires built dist/courtside.html + dist/courtside-legacy-proof.html.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os
import shutil

root = Path(__file__).resolve().parents[1]
old_html = root / 'dist' / 'courtside-legacy-proof.html'
new_html = root / 'dist' / 'courtside.html'
assert old_html.is_file() and new_html.is_file(), 'Run npm run verify:baseline && npm run build first'


def inspect(browser, html_path):
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/*', lambda route: route.abort())
    try:
        page.set_content(html_path.read_text(encoding='utf-8'), wait_until='domcontentloaded', timeout=20000)
        page.evaluate('''() => {
          const host = document.createElement('section');
          host.id='glossary-fixture-host';
          host.innerHTML = `<table class="cs-leaders-table"><thead><tr id="glossary-fixture-row">
            <th>PPG</th><th><button data-leader-sort="fg_pct">FG%</button></th><th>Q2</th>
            <th>OT2</th><th>UNKNOWN</th></tr></thead></table>`;
          document.body.appendChild(host);
        }''')
        page.wait_for_function('''() =>
          document.querySelectorAll('#glossary-fixture-host .stat-info').length===4
        ''', timeout=12000)
        def snap():
            return page.evaluate('''() => ({
              labels:[...document.querySelectorAll('#glossary-fixture-host th')].map(th=>({
                code:th.dataset.statGlossary||'',
                count:th.querySelectorAll('.stat-info').length,
                aria:th.querySelector('.stat-info')?.getAttribute('aria-label')||''
              })),
              tooltip:{
                hidden:document.getElementById('csStatTooltip').hidden,
                html:document.getElementById('csStatTooltip').innerHTML,
                role:document.getElementById('csStatTooltip').getAttribute('role')
              }
            })''')
        states=[snap()]
        assert [x['code'] for x in states[0]['labels']]==['PPG','FG%','Q2','OT2','']
        assert all(x['count']==1 for x in states[0]['labels'][:4])
        assert states[0]['labels'][4]['count']==0

        page.evaluate('''() => document.querySelector('#glossary-fixture-row th').dispatchEvent(
          new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}))''')
        states.append(snap())
        assert states[-1]['tooltip']['hidden'] is False
        assert 'Points Per Game' in states[-1]['tooltip']['html']

        page.evaluate('''() => document.querySelector('#glossary-fixture-row th').dispatchEvent(
          new PointerEvent('pointerout',{bubbles:true,pointerType:'mouse'}))''')
        states.append(snap())
        assert states[-1]['tooltip']['hidden'] is True

        was_prevented=page.evaluate('''() => {
          const ev=new MouseEvent('click',{bubbles:true,cancelable:true});
          const info=document.querySelector('#glossary-fixture-row th .stat-info');
          return {dispatched:info.dispatchEvent(ev),prevented:ev.defaultPrevented};
        }''')
        assert was_prevented['prevented'] is True, 'Info click must prevent sorting'
        states.append(snap())
        assert states[-1]['tooltip']['hidden'] is False

        page.evaluate("document.dispatchEvent(new Event('scroll',{bubbles:true}))")
        states.append(snap())
        assert states[-1]['tooltip']['hidden'] is False, 'Pinned tooltip should survive scrolling'

        page.evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
        states.append(snap())
        assert states[-1]['tooltip']['hidden'] is True

        page.evaluate('''() => document.querySelector('#glossary-fixture-row th:nth-child(2)').dispatchEvent(
          new FocusEvent('focusin',{bubbles:true}))''')
        states.append(snap())
        assert 'Field Goal Percentage' in states[-1]['tooltip']['html']
        page.evaluate('''() => document.querySelector('#glossary-fixture-row th:nth-child(2)').dispatchEvent(
          new FocusEvent('focusout',{bubbles:true}))''')
        states.append(snap())
        assert states[-1]['tooltip']['hidden'] is True

        page.evaluate('''() => document.getElementById('glossary-fixture-row').insertAdjacentHTML(
          'beforeend','<th>AST</th>')''')
        page.wait_for_function('''() => document.querySelectorAll('#glossary-fixture-host .stat-info').length===5''',timeout=12000)
        states.append(snap())
        page.evaluate('''() => document.getElementById('glossary-fixture-row').setAttribute('data-fixture-recheck','1')''')
        page.wait_for_timeout(100)
        states.append(snap())
        assert all(x['count']==1 for x in states[-1]['labels'] if x['code'])
        assert not errors, f'{html_path.name}: {errors[:5]}'
        return states
    finally:
        page.close()


with sync_playwright() as playwright:
    executable = os.environ.get('COURTSIDE_CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser') or None
    browser = playwright.chromium.launch(headless=True, executable_path=executable,
       args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--no-first-run'])
    try:
        old = inspect(browser,old_html)
        modern = inspect(browser,new_html)
        assert old==modern, 'Tooltip and dynamic-table behavior changed after module migration'
        print(f'PASS: glossary UI matches legacy across {len(old)} interaction states; stable ARIA labels, no page errors')
    finally:
        browser.close()
