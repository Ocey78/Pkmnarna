"""Integration uses synthetic HTTP responses, never claims to run the real game."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('build',ROOT/'scripts/build.py')
build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)
ORIGIN='https://poke2darena.com'
ENTRY=ORIGIN+'/play-online/assets/index-BBhViti1.js'
HTML=b'''<!doctype html><html><head><base href="https://wrong.example/">
<link rel="stylesheet" href="/play-online/assets/main.css">
<script type="module" src="/play-online/assets/index-BBhViti1.js"></script></head>
<body><div id="app"></div><button id="play">PLAY</button></body></html>'''
FIXTURES={
  ORIGIN+'/play-online/':HTML,
  ENTRY:b'import "./vendor.js"; const sprite="/play-online/sprites/pikachu.svg"; window.syntheticOnly=true;',
  ORIGIN+'/play-online/assets/vendor.js':b'window.syntheticDependency=true;',
  ORIGIN+'/play-online/assets/main.css':b'body{background-image:url(./tile.svg)}',
  ORIGIN+'/play-online/assets/tile.svg':b'<svg xmlns="http://www.w3.org/2000/svg"/>',
  ORIGIN+'/play-online/sprites/pikachu.svg':b'<svg xmlns="http://www.w3.org/2000/svg"/>'
}

def fake_fetch(url):
    if url not in FIXTURES: raise RuntimeError('Unexpected fixture URL '+url)
    return FIXTURES[url]

def fixture_patcher(data,url):
    assert url==ENTRY
    return {'source':data.decode()+'\nwindow.syntheticPatched=true;', 'hash':'SYNTHETIC-NOT-UPSTREAM'}

class BuildTests(unittest.TestCase):
    def test_resource_scope_and_paths(self):
        self.assertIsNone(build.resource_url('https://other.example/private.js',ENTRY))
        self.assertIsNone(build.resource_url('/api/user.json',ENTRY))
        self.assertIsNone(build.resource_url('/play-online/data.json?token=private',ENTRY))
        self.assertIsNone(build.resource_url('javascript:alert(1)',ENTRY))
        self.assertEqual(build.resource_url('./vendor.js',ENTRY),ORIGIN+'/play-online/assets/vendor.js')
        with self.assertRaises(ValueError):build.disk_path(ORIGIN+'/play-online/%2e%2e/secret.js')
    def test_html_rewrites_preserve_shell_and_run_compatibility_before_module(self):
        urls=set(FIXTURES)
        html=build.rewrite_html(HTML.decode(),ORIGIN+'/play-online/',urls,'/demo/')
        self.assertIn('id="app"',html)
        self.assertIn('id="play"',html)
        self.assertIn('href="/demo/play-online/"',html)
        self.assertNotIn('wrong.example',html)
        self.assertIn('src="/demo/play-online/assets/index-BBhViti1.js"',html)
        self.assertLess(html.index('network.js'),html.index('index-BBhViti1.js'))
        self.assertEqual(html.count('index-BBhViti1.js'),1)
    def test_build_stages_resources_and_keeps_api_status_unverified(self):
        with tempfile.TemporaryDirectory() as td:
            dest=Path(td)/'dist'
            report=build.build_site(dest,'/demo/',fetcher=fake_fetch,patcher=fixture_patcher)
            self.assertTrue((dest/'index.html').is_file())
            self.assertTrue((dest/'play-online/assets/vendor.js').is_file())
            source=(dest/'play-online/assets/index-BBhViti1.js').read_text()
            self.assertIn('syntheticPatched',source)
            self.assertIn('/demo/play-online/assets/vendor.js',source)
            self.assertIn('/demo/play-online/sprites/pikachu.svg',source)
            self.assertIn('/demo/play-online/assets/tile.svg',(dest/'play-online/assets/main.css').read_text())
            self.assertEqual(report['officialMultiplayer'],'unverified')
            self.assertEqual(report['rosterEntries'],1066)
            self.assertIn('/play-online/assets/vendor.js',(dest/'runtime-config.js').read_text())
            self.assertTrue((dest/'.nojekyll').exists())
    def test_failure_leaves_previous_site_unchanged(self):
        with tempfile.TemporaryDirectory() as td:
            dest=Path(td)/'dist';dest.mkdir();(dest/'old.txt').write_text('last good build')
            def broken(url):raise RuntimeError('Network unavailable')
            with self.assertRaises(RuntimeError):build.build_site(dest,'/',fetcher=broken,patcher=fixture_patcher)
            self.assertEqual((dest/'old.txt').read_text(),'last good build')
    def test_unrecognized_entry_stops_before_resource_crawl(self):
        calls=[]
        def fake(url):calls.append(url);return FIXTURES[url]
        def reject(data,url):raise RuntimeError('Unsupported upstream game build')
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaisesRegex(RuntimeError,'Unsupported'):
                build.build_site(Path(td)/'dist','/',fetcher=fake,patcher=reject)
        self.assertEqual(set(calls),{ORIGIN+'/play-online/',ENTRY})
    def test_json_metadata_and_frame_names_are_not_rewritten(self):
        local=dict(FIXTURES)
        url=ORIGIN+'/play-online/assets/atlas.json'
        raw=b'{"meta":{"image":"tile.svg"},"description":"tile.svg","frames":{"tile.svg":{"x":0}}}'
        local[url]=raw
        local[ENTRY]+=b' const atlas="/play-online/assets/atlas.json";'
        with tempfile.TemporaryDirectory() as td:
            dest=Path(td)/'dist'
            build.build_site(dest,'/demo/',fetcher=lambda u:local[u],patcher=fixture_patcher)
            self.assertEqual((dest/'play-online/assets/atlas.json').read_bytes(),raw)
    def test_multiple_entry_modules_are_rejected(self):
        with self.assertRaisesRegex(ValueError,'single'):
            build.discover_entry(HTML.decode().replace('</head>','<script type="module" src="/play-online/assets/index-other.js"></script></head>'))

if __name__=='__main__':unittest.main(verbosity=2)
