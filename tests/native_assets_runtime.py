"""Exercise actual imported native code, assets and CPU simulation. No mock game/network.
Use GAME_TEST_URL for a deployed-site test; otherwise serve dist under its Pages base.
The only instrumentation exposes the existing Phaser instance for read-only state checks.
"""
import functools,json,os,pathlib,subprocess,tempfile,threading,time
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
DIST=ROOT/'dist'
OUT=ROOT/'runtime-evidence';OUT.mkdir(exist_ok=True)
report=json.loads((DIST/'build-report.json').read_text())
base=report['base']
entry=DIST/'play-online/assets/index-BBhViti1.js'
instrumented=OUT/'observed-native.js'
subprocess.run(['node',str(ROOT/'tests/expose-game.mjs'),str(entry),str(instrumented)],check=True)
code=instrumented.read_text();instrumented.unlink()
class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass

with tempfile.TemporaryDirectory() as temp:
 webroot=pathlib.Path(temp)
 mount=webroot/base.strip('/') if base!='/' else webroot/'root'
 mount.parent.mkdir(parents=True,exist_ok=True);mount.symlink_to(DIST,target_is_directory=True)
 directory=mount if base=='/' else webroot
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(directory)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 url=os.environ.get('GAME_TEST_URL',f'http://127.0.0.1:{server.server_port}'+base)
 results=[]
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   result={'engine':engine,'errors':[],'assetFailures':[],'result':'failed'}
   browser=getattr(p,engine).launch(headless=True)
   context=browser.new_context(viewport={'width':852,'height':393} if engine=='webkit' else {'width':1280,'height':720},is_mobile=engine=='webkit',has_touch=engine=='webkit')
   page=context.new_page()
   page.route('**/play-online/assets/index-BBhViti1.js',lambda r:r.fulfill(status=200,content_type='application/javascript',body=code))
   page.on('pageerror',lambda e:result['errors'].append(str(e)))
   def response(r):
    u=urlsplit(r.url)
    if r.status>=400 and u.netloc==urlsplit(url).netloc and pathlib.PurePosixPath(u.path).suffix.lower() in {'.gif','.png','.mp3','.m4a','.css','.js','.ttf','.woff','.woff2'}:
     result['assetFailures'].append({'path':u.path,'status':r.status})
   page.on('response',response)
   state_script="""() => {const game=globalThis.__assetTestGame;for(const scene of game?.scene?.scenes||[]){if(scene.sys.isActive() && scene.world?.getState){const s=scene.world.getState();return {scene:scene.sys.settings.key,phase:s.phase,elapsedMs:s.elapsedMs,remainingMs:s.remainingMs,playerSpecies:scene.playerSpecies?.id,opponentSpecies:scene.opponentSpecies?.id,active:true};}}return null;}"""
   try:
    page.goto(url,wait_until='domcontentloaded',timeout=45000)
    page.wait_for_function("document.querySelector('#player-species')?.options.length===1066",timeout=30000)
    page.locator('#player-species').select_option('charizardmegax')
    page.locator('#cpu-species').select_option('gholdengo')
    page.locator('#duel-link').click()
    page.wait_for_load_state('domcontentloaded')
    # Some browsers display the native click-to-play/audio permission gate.
    gate=page.get_by_role('button',name='PLAY',exact=False)
    if gate.count() and gate.first.is_visible():gate.first.click()
    page.wait_for_function('('+state_script+')()?.phase === "fight"',timeout=60000)
    first=page.evaluate(state_script);result['before']=first
    page.screenshot(path=str(OUT/(engine+'-battle-before.png')))
    page.wait_for_timeout(2000)
    later=page.evaluate(state_script);result['after']=later
    assert later and later['elapsedMs']>first['elapsedMs']+500,'Native battle simulation did not advance'
    assert not result['errors'],'Unhandled native JavaScript errors: '+str(result['errors'][:5])
    assert not result['assetFailures'],'Missing native media assets: '+str(result['assetFailures'][:5])
    result['result']='passed: native CPU battle active and simulation advanced'
    result['bodyText']=page.locator('body').inner_text()[:1500]
    page.screenshot(path=str(OUT/(engine+'-battle-after.png')))
   except Exception as e:
    result['failure']=str(e)
    try:
     result['bodyText']=page.locator('body').inner_text()[:2000]
     result['nativeState']=page.evaluate(state_script)
     page.screenshot(path=str(OUT/(engine+'-failure.png')))
    except Exception:pass
   finally:
    results.append(result);print('NATIVE_GAME_TEST',json.dumps(result),flush=True);browser.close()
 server.shutdown()
 (OUT/'native-results.json').write_text(json.dumps(results,indent=2))
 if any(not r['result'].startswith('passed:') for r in results):raise SystemExit('Native battle verification failed; no gameplay-success claim.')
