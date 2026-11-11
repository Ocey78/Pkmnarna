"""Chromium + synthetic game fixtures; not a physical iPhone or real-server test."""
import importlib.util
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import tempfile
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('fixture_tests',ROOT/'tests/test_build.py')
fx=importlib.util.module_from_spec(spec);spec.loader.exec_module(fx)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();cls.parent=Path(cls.temp.name)
        fx.build.build_site(cls.parent/'demo','/demo/',fetcher=fx.fake_fetch,patcher=fx.fixture_patcher)
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(cls.parent)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.url=f'http://127.0.0.1:{cls.server.server_port}/demo/'
        cls.p=sync_playwright().start();cls.browser=cls.p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.p.stop();cls.server.shutdown();cls.server.server_close();cls.temp.cleanup()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        self.page=self.context.new_page();self.page.set_default_timeout(2500)
    def tearDown(self):self.context.close()
    def test_01_mobile_picker_layout_and_exact_forms(self):
        p=self.page;p.goto(self.url);p.locator('#player-species option').first.wait_for(state='attached')
        self.assertEqual(p.locator('#player-species option').count(),1066)
        p.locator('#player-search').fill('charizard mega x')
        self.assertEqual(p.locator('#player-species').input_value(),'charizardmegax')
        p.locator('#cpu-search').fill('#1000')
        self.assertEqual(p.locator('#cpu-species').input_value(),'gholdengo')
        href=p.locator('#duel-link').get_attribute('href')
        self.assertIn('charizardmegax%2Cgholdengo',href)
        self.assertTrue(p.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        evidence=ROOT/'tests/evidence';evidence.mkdir(exist_ok=True)
        p.screenshot(path=str(evidence/'mobile-launcher.png'),full_page=True)
    def test_02_native_game_runs_once_without_iframe(self):
        p=self.page;p.goto(self.url+'play-online/')
        p.wait_for_function('window.syntheticPatched===true && window.syntheticDependency===true')
        self.assertEqual(p.locator('iframe').count(),0)
        p.locator('#poke2d-host-tools').locator('#show').click()
        self.assertIn('Client code: evaluated',p.locator('#poke2d-host-tools').locator('textarea').input_value())
        self.assertIn('NOT VERIFIED',p.locator('#poke2d-host-tools').locator('textarea').input_value())
    def test_03_missing_build_report_disables_game(self):
        p=self.page;p.route('**/build-report.json',lambda route:route.fulfill(status=404,body='missing'))
        p.goto(self.url);p.locator('#build-state').get_by_text('Build required').wait_for()
        self.assertEqual(p.locator('#duel-link').get_attribute('aria-disabled'),'true')
    def test_04_private_invite_is_preserved_without_guessing_parameters(self):
        p=self.page;p.goto(self.url);p.locator('#invite').fill('https://poke2darena.com/play-online/?room=ABCDEF&token=private-token#keep')
        p.locator('#join-invite').click();p.wait_for_url('**/play-online/?room=ABCDEF&token=private-token#keep')
        self.assertEqual(p.evaluate('location.search'),'?room=ABCDEF&token=private-token')
    def test_05_launcher_and_fixture_create_no_background_server_checks(self):
        requests=[];self.page.on('request',lambda request:requests.append(request.url))
        self.page.goto(self.url);self.page.wait_for_timeout(400)
        self.assertFalse(any('poke2darena.com' in url for url in requests),requests)
    def test_06_post_request_body_survives_upstream_routing(self):
        captured=[]
        def route(request_route):
            captured.append((request_route.request.url,request_route.request.method,request_route.request.post_data))
            request_route.fulfill(status=200,headers={'access-control-allow-origin':'*','content-type':'text/plain'},body='OK')
        self.page.route('https://poke2darena.com/api/echo',route)
        self.page.goto(self.url+'play-online/')
        result=self.page.evaluate('''async()=>{const request=new Request('/api/echo',{method:'POST',body:'payload unchanged'});return await (await fetch(request)).text()}''')
        self.assertEqual(result,'OK');self.assertIn(('https://poke2darena.com/api/echo','POST','payload unchanged'),captured)
    def test_07_websocket_url_and_packets_preserved_with_tokens_redacted(self):
        self.page.add_init_script('''window.WebSocket=class extends EventTarget {static OPEN=1;constructor(url,protocols){super();window.socketArgs=[url,protocols];queueMicrotask(()=>this.dispatchEvent(new Event('open')))}send(x){window.sentPacket=x}}''')
        self.page.goto(self.url+'play-online/')
        self.page.evaluate("const ws=new WebSocket('/socket?token=private-token',['original-protocol']);ws.send('original packet');")
        self.assertEqual(self.page.evaluate('window.socketArgs'),['wss://poke2darena.com/socket?token=private-token',['original-protocol']])
        self.assertEqual(self.page.evaluate('window.sentPacket'),'original packet')
        self.page.locator('#poke2d-host-tools').locator('#show').click()
        report=self.page.locator('#poke2d-host-tools').locator('textarea').input_value()
        self.assertIn('WebSocket transport opened',report);self.assertNotIn('private-token',report)
    def test_08_zero_search_results_disable_duel(self):
        self.page.goto(self.url);self.page.locator('#player-search').fill('no-such-pokemon-xyz')
        self.assertEqual(self.page.locator('#duel-link').get_attribute('aria-disabled'),'true')

if __name__=='__main__':unittest.main(verbosity=2)
