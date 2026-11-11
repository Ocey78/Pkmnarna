"""No-network DOM checks. Mock URL/fetch/transport, actual browser DOM and shipped UI code.
These explicitly do not verify hosting, browser origin policy, the real game or an iPhone.
"""
from pathlib import Path
import json
import re
import unittest
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
ROSTER=json.loads((ROOT/'data/roster.json').read_text())
REPORT={'buildStatus':'imported','builtAt':'2026-11-10T23:00:00Z','staticResources':5,'sourceSHA256':'SYNTHETIC'}

class DOMTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p=sync_playwright().start();cls.browser=cls.p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],headless=True)
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.p.stop()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        self.page=self.context.new_page();self.page.set_default_timeout(2500)
    def tearDown(self):self.context.close()
    def ui(self,missing=False):
        html=(ROOT/'site/index.html').read_text()
        html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S)
        html=re.sub(r'<link\b[^>]*>','',html)
        html=html.replace('<head>','<head><base href="https://user.github.io/demo/"><style>'+(ROOT/'site/styles.css').read_text()+'</style>')
        self.page.set_content(html)
        self.page.evaluate('''payload=>{window.fixtureRequests=[];window.fetch=async url=>{const key=new URL(url).pathname;fixtureRequests.push(key);return new Response(JSON.stringify(key.endsWith('roster.json')?payload.roster:payload.report),{status:key.endsWith('build-report.json')&&payload.missing?404:200,headers:{'content-type':'application/json'}})}}''',{'roster':ROSTER,'report':REPORT,'missing':missing})
        roster=(ROOT/'site/roster.mjs').read_text().replace('export function ','function ')
        app=(ROOT/'site/app.mjs').read_text();app=re.sub(r'^import[^\n]+\n','',app)
        self.page.evaluate('()=>{'+roster+'\n'+app+'\n}')
        self.page.wait_for_function("document.querySelector('#player-search').disabled===false")
    def runtime(self):
        self.page.set_content('<html><body><div id="app"></div></body></html>')
        self.page.evaluate('''()=>{
          window.Poke2DHostConfig={upstream:'https://poke2darena.com',base:'/demo/',assets:['/play-online/assets/game.js']};
          window.fixtureRequests=[];
          window.fetch=async(input,init)=>{const r=input instanceof Request?input:new Request(input,init);fixtureRequests.push({url:r.url,method:r.method,body:await r.text()});return new Response('OK')};
          window.WebSocket=class extends EventTarget{constructor(url,protocols){super();window.socketArgs=[url,protocols];queueMicrotask(()=>this.dispatchEvent(new Event('open')))}send(packet){window.sentPacket=packet}};
          window.EventSource=class {constructor(url){window.eventURL=url}};
        }''')
        routing=(ROOT/'site/routing.mjs').read_text().replace('export function routeURL','function routeURL')
        code=routing+'\n'+(ROOT/'site/network.js').read_text()
        self.page.evaluate('source=>{new Function("location",source)(new URL("https://user.github.io/demo/play-online/"))}',code)
    def test_01_mobile_picker_and_layout(self):
        self.ui();p=self.page
        self.assertEqual(p.locator('#player-species option').count(),1066)
        self.assertEqual(p.locator('#mega-total').inner_text(),'24')
        p.locator('#player-search').fill('charizard mega x')
        self.assertEqual(p.locator('#player-species').input_value(),'charizardmegax')
        p.locator('#cpu-search').fill('#1000');self.assertEqual(p.locator('#cpu-species').input_value(),'gholdengo')
        self.assertIn('charizardmegax%2Cgholdengo',p.locator('#duel-link').get_attribute('href'))
        self.assertTrue(p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        evidence=ROOT/'tests/evidence';evidence.mkdir(exist_ok=True)
        p.screenshot(path=str(evidence/'mobile-launcher.png'),full_page=True)
    def test_02_missing_build_does_not_claim_ready(self):
        self.ui(missing=True)
        self.assertEqual(self.page.locator('#build-state').inner_text(),'Build required')
        self.assertEqual(self.page.locator('#duel-link').get_attribute('aria-disabled'),'true')
        self.assertIsNone(self.page.locator('#menu-link').get_attribute('href'))
    def test_03_swap_and_invalid_search(self):
        self.ui();p=self.page
        p.locator('#player-search').fill('charizard mega x');p.locator('#cpu-search').fill('#1000');p.locator('#swap').click()
        self.assertEqual(p.locator('#player-species').input_value(),'gholdengo')
        self.assertEqual(p.locator('#cpu-species').input_value(),'charizardmegax')
        p.locator('#player-search').fill('does-not-exist')
        self.assertEqual(p.locator('#duel-link').get_attribute('aria-disabled'),'true')
    def test_04_no_background_connection_probe(self):
        self.ui()
        self.assertEqual(self.page.evaluate('fixtureRequests'),['/demo/data/roster.json','/demo/build-report.json'])
    def test_05_request_body_preserved(self):
        self.runtime()
        self.page.evaluate("async()=>await fetch(new Request('https://user.github.io/api/echo',{method:'POST',body:'unchanged body'}))")
        self.assertEqual(self.page.evaluate('fixtureRequests[0]'),{'url':'https://poke2darena.com/api/echo','method':'POST','body':'unchanged body'})
    def test_06_ws_messages_preserved_and_tokens_redacted(self):
        self.runtime();self.page.evaluate("new WebSocket('/socket?token=private-token',['native-protocol']).send('native packet')")
        self.assertEqual(self.page.evaluate('socketArgs'),['wss://poke2darena.com/socket?token=private-token',['native-protocol']])
        self.assertEqual(self.page.evaluate('sentPacket'),'native packet')
        report=self.page.locator('#poke2d-host-tools').locator('textarea').input_value()
        self.assertIn('WebSocket transport opened',report);self.assertNotIn('private-token',report);self.assertIn('NOT VERIFIED',report)
    def test_07_runtime_does_not_initiate_requests(self):
        self.runtime();self.assertEqual(self.page.evaluate('fixtureRequests'),[])
    def test_08_desktop_layout(self):
        self.page.set_viewport_size({'width':1440,'height':1000});self.ui()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        evidence=ROOT/'tests/evidence';evidence.mkdir(exist_ok=True)
        self.page.screenshot(path=str(evidence/'desktop-launcher.png'),full_page=True)

if __name__=='__main__':unittest.main(verbosity=2)
