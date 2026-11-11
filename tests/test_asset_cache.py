import hashlib, importlib.util, json, tempfile, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class CacheTests(unittest.TestCase):
 def module(self):
  p=ROOT/'scripts/asset_cache.py'
  self.assertTrue(p.exists(),'The asset cache and integrity inventory are not implemented')
  s=importlib.util.spec_from_file_location('asset_cache',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
 def test_seed_reuses_only_unchanged_binary_assets_after_matching_source(self):
  m=self.module(); raw=b'known original module';h=hashlib.sha256(raw).hexdigest()
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);(root/'build-report.json').write_text(json.dumps({'sourceSHA256':h}))
   p=root/'assets/pokemon/pikachu.gif';p.parent.mkdir(parents=True);p.write_bytes(b'GIF89aexample')
   calls=[]
   def get(u):calls.append(u);return raw if u.endswith('index-BBhViti1.js') else b'fresh'
   f=m.SeededFetcher(get,root)
   self.assertEqual(f('https://poke2darena.com/assets/pokemon/pikachu.gif'),b'fresh')
   f('https://poke2darena.com/play-online/assets/index-BBhViti1.js')
   self.assertEqual(f('https://poke2darena.com/assets/pokemon/pikachu.gif'),b'GIF89aexample')
   self.assertEqual(f('https://poke2darena.com/play-online/assets/other.js'),b'fresh')
   self.assertEqual(f.reused,1)
 def test_mismatch_and_outside_origin_do_not_reuse_local_files(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);(root/'build-report.json').write_text(json.dumps({'sourceSHA256':'wrong'}))
   p=root/'a.gif';p.write_bytes(b'GIF89abad')
   f=m.SeededFetcher(lambda u:b'fresh',root)
   f('https://poke2darena.com/play-online/assets/index-BBhViti1.js')
   self.assertEqual(f('https://poke2darena.com/a.gif'),b'fresh')
   self.assertEqual(f('https://bad.example/a.gif'),b'fresh')
   self.assertEqual(f.reused,0)
 def test_inventory_has_verifiable_byte_counts_and_digests(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);p=root/'assets/pokemon/pikachu.gif';p.parent.mkdir(parents=True);data=b'GIF89atest';p.write_bytes(data)
   r=m.write_inventory(root,{'sourceSHA256':'test','missingOptionalResources':[]})
   self.assertEqual(r['files'][0]['sha256'],hashlib.sha256(data).hexdigest())
   self.assertEqual(r['files'][0]['bytes'],len(data));self.assertEqual(r['categories']['pokemon'],1)
