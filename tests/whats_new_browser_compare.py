"""Compare legacy and isolated What's New browser behavior without network access.

Requires generated dist/courtside.html and dist/courtside-legacy-proof.html.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
versions = [root / 'dist' / 'courtside-legacy-proof.html', root / 'dist' / 'courtside.html']
assert all(path.exists() for path in versions), 'Run npm run verify:baseline && npm run build'


def inspect(browser, html_path):
    page = browser.new_page(viewport={'width': 1365, 'height': 875})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/*', lambda route: route.abort())
    try:
        page.set_content(html_path.read_text(encoding='utf-8'), wait_until='domcontentloaded', timeout=20000)
        page.locator('#appSettingsOpen').click(timeout=5000)
        page.locator('[data-settings-tab="whatsnew"]').first.click(timeout=5000)
        def snapshot():
            return page.evaluate('''() => ({
                version:document.querySelector('#whatsNewVersion').value,
                details:document.querySelector('#whatsNewDetails').innerHTML,
                count:document.querySelector('#whatsNewCount').textContent,
                olderDisabled:document.querySelector('#whatsNewOlder').disabled,
                newerDisabled:document.querySelector('#whatsNewNewer').disabled,
                announcement:document.querySelector('#whatsNewAnnounce').textContent,
                badgeHidden:document.querySelector('#whatsNewMainDot').hidden
            })''')
        snapshots = [snapshot()]
        page.locator('#whatsNewOlder').click(timeout=5000)
        snapshots.append(snapshot())
        page.locator('#whatsNewOlder').click(timeout=5000)
        snapshots.append(snapshot())
        page.locator('#whatsNewNewer').click(timeout=5000)
        snapshots.append(snapshot())
        page.locator('#appSettingsClose').click(timeout=5000)
        page.locator('#appSettingsOpen').click(timeout=5000)
        page.locator('[data-settings-tab="whatsnew"]').first.click(timeout=5000)
        snapshots.append(snapshot())
        assert not errors, f'{html_path.name} browser errors: {errors[:5]}'
        return snapshots
    finally:
        page.close()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',
        args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--no-first-run'])
    try:
        old = inspect(browser, versions[0])
        modern = inspect(browser, versions[1])
        assert old == modern, 'Modern release-note rendering/navigation differs from the frozen controller'
        print(f"PASS: What's New browser behavior matches 1.6.1 across {len(old)} interaction states; no page errors")
    finally:
        browser.close()
