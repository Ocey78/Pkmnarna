"""In-memory menu/bridge test ONLY: no native game or network verification."""
import json,pathlib,os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    options={'headless':True}
    if pathlib.Path('/usr/bin/chromium').is_file():options['executable_path']='/usr/bin/chromium'
    browser=p.chromium.launch(**options)
    page=browser.new_page(viewport={'width':852,'height':393})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content('<html><body><div id="app"></div></body></html>')
    page.evaluate('''() => {
      const data=new Map([['poke2d-save','unchanged']]);
      Object.defineProperty(window,'localStorage',{value:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},configurable:true});
    }''')
    page.add_script_tag(content=(ROOT/'dist/rocket-menu.js').read_text())
    page.wait_for_selector('#arena-mod-menu',state='attached')
    assert not page.locator('#arena-mod-menu #menu-button').is_visible(),'Rocket button must begin locked'
    page.evaluate("document.documentElement.setAttribute('data-arena-rocket-access','unlocked');document.dispatchEvent(new Event('arena-rocket-access'))")
    button=page.locator('#arena-mod-menu #menu-button');assert button.is_visible()
    button.click()
    assert page.locator('#arena-mod-menu #panel').is_visible()
    assert page.locator('#arena-mod-menu input:checked').count()==0,'New session must not enable cheats'
    assert page.evaluate("localStorage.getItem('poke2d-save')")=='unchanged'
    assert page.evaluate("typeof window.browser")=='undefined'
    assert not errors,errors
    print(json.dumps({'test':'in-memory original Rocket Menu + storage bridge','passed':True,'checks':7,'nativeGameplay':'not tested'}))
    browser.close()
