"""Release-only identity checks; all remote requests blocked, no provider claims."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
PATH=ROOT/'dist/courtside.html'
assert PATH.exists()
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':1380,'height':900})
 errors=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.route('**/*',lambda route:route.abort())
 try:
  page.set_content(PATH.read_text('utf8'),wait_until='domcontentloaded',timeout=20000)
  assert page.title().startswith('Courtside 1.7.0')
  tag_text=page.locator('.version-tag').text_content().strip()
  assert tag_text=='v1.7.0',repr(tag_text)
  assert page.locator('.version-tag').get_attribute('aria-label')=='Courtside version 1.7.0'
  assert page.locator('.cs-settings-foot').inner_text().endswith('Courtside v1.7.0')
  page.locator('#appSettingsOpen').click()
  page.locator('#csSettingsTabWhatsnew').click()
  assert page.locator('#whatsNewVersion option').count()==18
  assert page.locator('#whatsNewVersion').input_value()=='1.7.0'
  assert 'Modular Architecture' in page.locator('#whatsNewDetails').inner_text()
  page.locator('#whatsNewOlder').click()
  assert page.locator('#whatsNewVersion').input_value()=='1.6.1'
  page.locator('#whatsNewOlder').click()
  assert page.locator('#whatsNewVersion').input_value()=='1.6'
  page.locator('#appSettingsClose').click()
  version=page.evaluate("""async()=> {
    let blob;
    const previousCreate=URL.createObjectURL;
    const previousClick=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=value=>{blob=value;return 'blob:fixture';};
    HTMLAnchorElement.prototype.click=function(){};
    try{
      dataLogExport();
      if(!blob)throw Error('Data Log failed to export its JSON Blob');
      const result=JSON.parse(await blob.text());
      return {version:result.version,app:result.app,scope:result.scope};
    }finally{
      URL.createObjectURL=previousCreate;
      HTMLAnchorElement.prototype.click=previousClick;
    }
  }""")
  assert version=={'version':'1.7.0','app':'Courtside','scope':'ESPN requests only'},version
  assert not errors,errors
  print("PASS: v1.7.0 browser title, badge, footer, 18 What's New releases, old history and Data Log export agree")
 finally:
  page.close()
  browser.close()
